import fs from 'node:fs';
import path from 'node:path';
import { CallGraph, RepositoryScanSummary } from '../scanner/call_graph.js';
import { AstMutator, MutateFileResult } from '../synthesizer/ast_mutator.js';
import { PatchGenerator, RepositoryPatchSummary } from '../synthesizer/patch_generator.js';
import { ManifestUpdater, ManifestUpdateResult } from '../synthesizer/manifest_updater.js';
import { SnapshotEngine } from './snapshot.js';
import { ReportGenerator } from '../git/report_generator.js';
import { PythonScanner } from '../scanner/python_scanner.js';
import { RunnerFactory } from '../sandbox/runner_factory.js';
import { ErrorParser } from '../sandbox/error_parser.js';
import { AgentMemory } from './memory.js';
import { MigrationRecipe } from '../spec/types.js';
import { SandboxMode, TestExecutionResult, ErrorReport } from '../sandbox/types.js';

export interface MigrationOptions {
  repoPath: string;
  recipe: MigrationRecipe;
  testCommand?: string;
  sandboxMode?: SandboxMode;
  maxIterations?: number;
  dryRun?: boolean;
  selectedFiles?: string[];
  autoUpgradeManifest?: boolean;
  rollbackOnFailure?: boolean;
  generateReport?: boolean;
  onEvent?: (event: MigrationEvent) => void;
}

export interface MigrationEvent {
  step: 'INITIALIZING' | 'SCANNING' | 'SYNTHESIZING' | 'TESTING' | 'HEALING' | 'PASSED' | 'FAILED' | 'ROLLBACK';
  iteration: number;
  message: string;
  data?: any;
}

export interface MigrationRunResult {
  success: boolean;
  totalIterations: number;
  initialScan: RepositoryScanSummary;
  mutatedFiles: string[];
  patchSummary: RepositoryPatchSummary;
  manifestResult?: ManifestUpdateResult;
  snapshotId?: string;
  reportPath?: string;
  finalTestResult?: TestExecutionResult;
  errorReport?: ErrorReport;
  healingLog: string[];
}

export class MigrationAgent {
  public static snapshotEngine = new SnapshotEngine();

  public static async run(options: MigrationOptions): Promise<MigrationRunResult> {
    const {
      repoPath,
      recipe,
      testCommand = 'npm test',
      sandboxMode = 'auto',
      maxIterations = 5,
      dryRun = false,
      selectedFiles,
      autoUpgradeManifest = true,
      rollbackOnFailure = false,
      generateReport = true,
      onEvent = () => {},
    } = options;

    const absRepoPath = path.resolve(repoPath);
    const memory = new AgentMemory();
    const healingLog: string[] = [];

    const emit = (
      step: MigrationEvent['step'],
      iteration: number,
      message: string,
      data?: any
    ) => {
      onEvent({ step, iteration, message, data });
    };

    emit('INITIALIZING', 0, `Starting migration for ${recipe.name} in ${absRepoPath}`);

    // Step 1: Scan repository (TS/JS and Python)
    emit('SCANNING', 0, `Scanning AST for ${recipe.packageName} callsites...`);
    const scanSummary = CallGraph.scanRepository(absRepoPath, recipe);
    const pyResults = PythonScanner.scanRepository(absRepoPath, recipe);

    let totalCalls = scanSummary.totalCallsitesCount;
    for (const py of pyResults) {
      totalCalls += py.callsites.length;
    }

    emit(
      'SCANNING',
      0,
      `Found ${totalCalls} callsites across ${scanSummary.affectedFilesCount + pyResults.length} files.`,
      { scanSummary, pyResults }
    );

    if (scanSummary.affectedFilesCount === 0 && pyResults.length === 0) {
      emit('PASSED', 0, 'No callsites matching recipe found in target repository.');
      return {
        success: true,
        totalIterations: 0,
        initialScan: scanSummary,
        mutatedFiles: [],
        patchSummary: {
          files: [],
          totalAdditions: 0,
          totalDeletions: 0,
          totalFilesChanged: 0,
          unifiedPatch: '',
        },
        healingLog: ['No matching callsites found.'],
      };
    }

    // Step 2: Create pre-mutation snapshot for instant rollback protection
    const filesToTouch: string[] = [];
    for (const fr of scanSummary.fileResults) {
      if (!selectedFiles || selectedFiles.includes(fr.filePath)) {
        filesToTouch.push(fr.filePath);
      }
    }
    for (const py of pyResults) {
      if (!selectedFiles || selectedFiles.includes(py.filePath)) {
        filesToTouch.push(py.filePath);
      }
    }

    // Include manifest in snapshot if present
    const pkgJson = path.join(absRepoPath, 'package.json');
    if (fs.existsSync(pkgJson)) filesToTouch.push(pkgJson);
    const reqTxt = path.join(absRepoPath, 'requirements.txt');
    if (fs.existsSync(reqTxt)) filesToTouch.push(reqTxt);

    const snapshot = this.snapshotEngine.createSnapshot(absRepoPath, filesToTouch);

    // Step 3: Auto-upgrade package manifest if requested
    let manifestResult: ManifestUpdateResult | undefined;
    if (autoUpgradeManifest && !dryRun) {
      manifestResult = ManifestUpdater.updateProjectManifest(absRepoPath, recipe);
      if (manifestResult.updated) {
        emit(
          'SYNTHESIZING',
          0,
          `Auto-upgraded ${manifestResult.manifestType}: ${recipe.packageName} from ${manifestResult.oldVersion} to ${manifestResult.newVersion}`
        );
        healingLog.push(`Upgraded manifest ${manifestResult.manifestType} to ${manifestResult.newVersion}`);
      }
    }

    // Step 4: Synthesize initial AST patches
    emit('SYNTHESIZING', 0, `Synthesizing style-preserving AST transformations...`);
    const mutations: MutateFileResult[] = [];
    const originalFileContents = new Map<string, string>();

    // Mutate TS/JS files
    for (const fileResult of scanSummary.fileResults) {
      if (selectedFiles && !selectedFiles.includes(fileResult.filePath)) {
        continue;
      }
      const orig = fs.readFileSync(fileResult.filePath, 'utf8');
      originalFileContents.set(fileResult.filePath, orig);

      const mutated = AstMutator.mutateCode(orig, recipe, fileResult.filePath);
      mutations.push(mutated);

      if (mutated.hasChanges && !dryRun) {
        fs.writeFileSync(fileResult.filePath, mutated.modifiedCode, 'utf8');
      }
    }

    // Mutate Python files
    for (const pyResult of pyResults) {
      if (selectedFiles && !selectedFiles.includes(pyResult.filePath)) {
        continue;
      }
      const orig = fs.readFileSync(pyResult.filePath, 'utf8');
      originalFileContents.set(pyResult.filePath, orig);

      const pyMut = PythonScanner.mutateFile(pyResult.filePath, orig, recipe);
      mutations.push({
        filePath: pyResult.filePath,
        originalCode: orig,
        modifiedCode: pyMut.modifiedCode,
        hasChanges: pyMut.hasChanges,
        appliedCount: pyMut.appliedCount,
        appliedTransformations: ['PYTHON_METHOD_RENAME'],
      });

      if (pyMut.hasChanges && !dryRun) {
        fs.writeFileSync(pyResult.filePath, pyMut.modifiedCode, 'utf8');
      }
    }

    let patchSummary = PatchGenerator.generateRepositoryPatch(mutations);
    const mutatedFiles = mutations.filter(m => m.hasChanges).map(m => m.filePath);

    emit(
      'SYNTHESIZING',
      0,
      `Applied transformations to ${mutatedFiles.length} files (+${patchSummary.totalAdditions} / -${patchSummary.totalDeletions} lines).`,
      patchSummary
    );

    if (dryRun) {
      emit('PASSED', 0, 'Dry run completed. No files modified on disk.');
      return {
        success: true,
        totalIterations: 0,
        initialScan: scanSummary,
        mutatedFiles,
        patchSummary,
        snapshotId: snapshot.id,
        healingLog: ['Dry run finished.'],
      };
    }

    // Step 5: Sandboxed Test-Driven Healing Loop
    let iteration = 0;
    let testsPassed = false;
    let lastTestResult: TestExecutionResult | undefined;
    let lastErrorReport: ErrorReport | undefined;

    while (iteration < maxIterations && !testsPassed) {
      iteration++;
      emit('TESTING', iteration, `Running test suite in sandbox (iteration ${iteration}/${maxIterations})...`);

      lastTestResult = await RunnerFactory.execute({
        cwd: absRepoPath,
        command: testCommand,
        sandboxMode,
      });

      emit(
        'TESTING',
        iteration,
        `Tests finished with exit code ${lastTestResult.exitCode} (${lastTestResult.modeUsed} sandbox, ${lastTestResult.durationMs}ms).`
      );

      if (lastTestResult.passed) {
        testsPassed = true;
        emit(
          'PASSED',
          iteration,
          `100% of tests passed successfully on iteration ${iteration}! Codebase fully healed.`,
          { exitCode: 0, stdout: lastTestResult.stdout }
        );
        healingLog.push(`Iteration ${iteration}: All tests passed on green.`);
        break;
      }

      // Tests failed. Parse errors
      const combinedOutput = `${lastTestResult.stdout}\n${lastTestResult.stderr}`;
      lastErrorReport = ErrorParser.parse(combinedOutput);

      emit(
        'HEALING',
        iteration,
        `Encountered ${lastErrorReport.totalFailures} test/compiler failure(s). Analyzing error signatures...`,
        lastErrorReport
      );

      memory.recordAttempt(iteration, lastErrorReport.errors, [
        `Tests failed with exit code ${lastTestResult.exitCode}`,
      ]);

      // Apply targeted healing heuristics based on parsed error reports
      let healedAny = false;

      for (const err of lastErrorReport.errors) {
        if (memory.isCyclic(err, 3)) {
          healingLog.push(`Skipping cyclic error: ${err.message}`);
          continue;
        }

        // Targeted Heal 0: ReferenceError Configuration is not defined
        if (err.message.includes('Configuration is not defined') || err.message.includes('Configuration')) {
          for (const filePath of mutatedFiles) {
            let code = fs.readFileSync(filePath, 'utf8');
            if (code.includes('new Configuration(')) {
              code = code.replace(/new Configuration\(([\s\S]*?)\)/g, '$1');
              fs.writeFileSync(filePath, code, 'utf8');
              healedAny = true;
              healingLog.push(`Iteration ${iteration}: Replaced new Configuration(...) with plain options in ${path.basename(filePath)}`);
              emit('HEALING', iteration, `Self-healed: Replaced orphaned new Configuration(...) with plain options in ${path.basename(filePath)}`);
            }
          }
        }

        // Targeted Heal 1: response.data property access error
        if (
          err.message.includes("'data'") ||
          err.message.includes("reading 'choices'") ||
          err.message.includes('response.data')
        ) {
          for (const filePath of mutatedFiles) {
            let code = fs.readFileSync(filePath, 'utf8');
            if (code.includes('.data.')) {
              code = code.replace(/\.data\./g, '.');
              fs.writeFileSync(filePath, code, 'utf8');
              healedAny = true;
              healingLog.push(`Iteration ${iteration}: Stripped legacy .data wrapper from ${path.basename(filePath)}`);
              emit('HEALING', iteration, `Stripped legacy .data property wrapper from ${path.basename(filePath)}`);
            }
          }
        }

        // Targeted Heal 2: Legacy method name failure
        if (err.message.includes('createChatCompletion is not a function') || err.message.includes('ChatCompletion')) {
          for (const filePath of mutatedFiles) {
            let code = fs.readFileSync(filePath, 'utf8');
            if (code.includes('createChatCompletion')) {
              code = code.replace(/createChatCompletion/g, 'chat.completions.create');
              fs.writeFileSync(filePath, code, 'utf8');
              healedAny = true;
              healingLog.push(`Iteration ${iteration}: Updated legacy createChatCompletion in ${path.basename(filePath)}`);
            }
          }
        }

        // Targeted Heal 3: Parameter renaming residue (e.g. model_name -> model)
        if (err.message.includes('model_name') || (err.expected && err.actual === 'undefined')) {
          for (const filePath of mutatedFiles) {
            let code = fs.readFileSync(filePath, 'utf8');
            if (code.includes('model_name:')) {
              code = code.replace(/model_name:/g, 'model:');
              fs.writeFileSync(filePath, code, 'utf8');
              healedAny = true;
              healingLog.push(`Iteration ${iteration}: Replaced model_name with model in ${path.basename(filePath)}`);
            }
          }
        }
      }

      if (!healedAny) {
        healingLog.push(`Iteration ${iteration}: No automated heuristics matched remaining error output.`);
        emit('HEALING', iteration, 'No additional automated healing mutations available for this failure signature.');
        break;
      }
    }

    // Step 6: Rollback on failure if configured
    if (!testsPassed && rollbackOnFailure) {
      emit('ROLLBACK', iteration, `Migration did not reach green tests. Rolling back all files to pre-mutation snapshot...`);
      this.snapshotEngine.rollback(snapshot.id);
      healingLog.push('Automatic rollback executed due to unhealed test regressions.');
    }

    // Recompute final patch summary
    const finalMutations: MutateFileResult[] = [];
    for (const [filePath, orig] of originalFileContents.entries()) {
      if (fs.existsSync(filePath)) {
        const currentCode = fs.readFileSync(filePath, 'utf8');
        finalMutations.push({
          filePath,
          originalCode: orig,
          modifiedCode: currentCode,
          hasChanges: orig !== currentCode,
          appliedCount: 1,
          appliedTransformations: ['HEALED'],
        });
      }
    }
    patchSummary = PatchGenerator.generateRepositoryPatch(finalMutations);

    if (!testsPassed) {
      emit(
        'FAILED',
        iteration,
        `Healing loop reached maximum iterations (${maxIterations}) without all tests passing. Review test logs.`,
        lastErrorReport
      );
    }

    const finalResult: MigrationRunResult = {
      success: testsPassed,
      totalIterations: iteration,
      initialScan: scanSummary,
      mutatedFiles,
      patchSummary,
      manifestResult,
      snapshotId: snapshot.id,
      finalTestResult: lastTestResult,
      errorReport: lastErrorReport,
      healingLog,
    };

    // Step 7: Generate audit report file
    if (generateReport && !dryRun) {
      try {
        const reportPath = ReportGenerator.saveReport(absRepoPath, {
          repoPath: absRepoPath,
          recipe,
          result: finalResult,
        });
        finalResult.reportPath = reportPath;
        emit('PASSED', iteration, `Generated audit report at: ${path.basename(reportPath)}`);
      } catch {
        // ignore report write error
      }
    }

    return finalResult;
  }
}
