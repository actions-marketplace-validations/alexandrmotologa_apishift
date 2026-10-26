#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import pc from 'picocolors';
import { SpecIngestor } from './spec/ingestor.js';
import { OpenApiDiffer } from './spec/openapi_differ.js';
import { CallGraph } from './scanner/call_graph.js';
import { MigrationAgent } from './agent/loop.js';
import { BranchManager } from './git/branch_manager.js';
import { PrPublisher } from './git/pr_publisher.js';
import { ApiServer } from './server/api.js';
import { SandboxMode } from './sandbox/types.js';

const program = new Command();

program
  .name('apishift')
  .description('Autonomous API migration and breaking change healing engine')
  .version('1.0.0');

// 1. Recipes Command
program
  .command('recipes')
  .description('List all available built-in migration recipes')
  .action(() => {
    console.log(pc.bold(pc.cyan('\nAvailable Built-in Migration Recipes:\n')));
    const recipes = SpecIngestor.listBuiltinRecipes();

    for (const r of recipes) {
      console.log(`  ${pc.bold(pc.green(r.id))}`);
      console.log(`    ${pc.white(r.name)} (${r.packageName} ${r.fromVersion} -> ${r.toVersion})`);
      console.log(`    ${pc.dim(r.description)}`);
      console.log(`    ${pc.dim(`Transformations: ${r.transformations.length} rule(s)`)}\n`);
    }
  });

// 2. Scan Command
program
  .command('scan')
  .description('Scan a target repository AST for API breaking change callsites')
  .requiredOption('-r, --repo <path>', 'Path to target repository')
  .requiredOption('-m, --recipe <recipe>', 'Recipe ID or path to JSON/YAML recipe')
  .action(async (options) => {
    try {
      const repoPath = path.resolve(options.repo);
      const recipe = SpecIngestor.loadRecipe(options.recipe);

      console.log(pc.bold(pc.cyan(`\nScanning repository: ${repoPath}`)));
      console.log(`Recipe: ${pc.bold(recipe.name)} (${recipe.packageName})\n`);

      const summary = CallGraph.scanRepository(repoPath, recipe);

      console.log(pc.bold('Scan Summary:'));
      console.log(`  Total files checked:   ${summary.totalFilesScanned}`);
      console.log(`  Affected files:        ${pc.bold(summary.affectedFilesCount.toString())}`);
      console.log(`  Total callsites:       ${pc.bold(pc.green(summary.totalCallsitesCount.toString()))}\n`);

      if (summary.totalCallsitesCount > 0) {
        console.log(pc.bold('Callsites by File:'));
        for (const f of summary.fileResults) {
          const rel = path.relative(repoPath, f.filePath);
          console.log(`  ${pc.cyan(rel)} (${f.callsites.length} callsites):`);
          for (const cs of f.callsites) {
            console.log(`    L${cs.line}:${cs.column} [${cs.transformationType}] ${pc.dim(cs.rawSnippet.trim().replace(/\n/g, ' '))}`);
          }
        }
      } else {
        console.log(pc.yellow('No callsites found matching the selected recipe.'));
      }
    } catch (err: any) {
      console.error(pc.red(`Scan failed: ${err.message}`));
      process.exit(1);
    }
  });

// 3. Diff Command (OpenAPI)
program
  .command('diff')
  .description('Compare two OpenAPI specs and generate an automated migration recipe')
  .requiredOption('--spec-old <path>', 'Path to old OpenAPI spec (JSON/YAML)')
  .requiredOption('--spec-new <path>', 'Path to new OpenAPI spec (JSON/YAML)')
  .option('-o, --out <path>', 'Path to save generated recipe JSON')
  .action((options) => {
    try {
      console.log(pc.bold(pc.cyan('\nComparing OpenAPI specifications...')));
      const diffResult = OpenApiDiffer.diffFiles(options.specOld, options.specNew);

      console.log(pc.bold(`\nAPI: ${diffResult.title} (${diffResult.oldVersion} -> ${diffResult.newVersion})`));
      console.log(`Endpoint Changes Detected: ${diffResult.endpointChanges.length}`);
      console.log(`Generated Transformation Rules: ${diffResult.generatedRecipe.transformations.length}\n`);

      for (const change of diffResult.endpointChanges) {
        const color = change.type === 'ADDED' ? pc.green : change.type === 'REMOVED' ? pc.red : pc.yellow;
        console.log(`  ${color(`[${change.type}]`)} ${change.method} ${change.path}: ${change.details}`);
      }

      if (options.out) {
        const outPath = path.resolve(options.out);
        SpecIngestor.saveRecipe(outPath, diffResult.generatedRecipe);
        console.log(pc.green(`\nSaved generated recipe to: ${outPath}`));
      } else {
        console.log(pc.dim('\nUse --out <path> to save the generated recipe.'));
      }
    } catch (err: any) {
      console.error(pc.red(`OpenAPI diff failed: ${err.message}`));
      process.exit(1);
    }
  });

// 4. Migrate Command
program
  .command('migrate')
  .description('Run full migration pipeline with sandboxed test-driven self-healing')
  .requiredOption('-r, --repo <path>', 'Path to target repository')
  .requiredOption('-m, --recipe <recipe>', 'Recipe ID or path to JSON/YAML recipe')
  .option('-s, --sandbox <mode>', 'Sandbox mode: docker, local, or auto', 'auto')
  .option('-t, --test-cmd <cmd>', 'Test command to execute', 'npm test')
  .option('--dry-run', 'Preview AST changes without writing to disk', false)
  .option('--auto-pr', 'Automatically create git branch, commit, and open PR', false)
  .option('--max-iter <num>', 'Maximum self-healing iterations', '5')
  .action(async (options) => {
    try {
      const repoPath = path.resolve(options.repo);
      const recipe = SpecIngestor.loadRecipe(options.recipe);
      const sandboxMode = options.sandbox as SandboxMode;
      const maxIterations = parseInt(options.maxIter, 10);

      console.log(pc.bold(pc.cyan(`\nStarting APIShift Migration Engine`)));
      console.log(`Target Repo:   ${pc.bold(repoPath)}`);
      console.log(`Recipe:        ${pc.bold(recipe.name)}`);
      console.log(`Sandbox Mode:  ${sandboxMode}`);
      console.log(`Test Command:  ${options.testCmd}`);
      console.log(`Max Iterations:${maxIterations}\n`);

      const result = await MigrationAgent.run({
        repoPath,
        recipe,
        sandboxMode,
        testCommand: options.testCmd,
        dryRun: options.dryRun,
        maxIterations,
        onEvent: (e) => {
          const iterStr = e.iteration > 0 ? `[iter ${e.iteration}] ` : '';
          const tag = pc.bold(`[${e.step}]`);
          console.log(`${tag} ${iterStr}${e.message}`);
        },
      });

      console.log(pc.bold(pc.cyan('\nMigration Results Summary:')));
      console.log(`  Status:               ${result.success ? pc.green(pc.bold('SUCCESS (100% tests passing)')) : pc.red(pc.bold('FAILED'))}`);
      console.log(`  Iterations used:      ${result.totalIterations}`);
      console.log(`  Files modified:       ${result.patchSummary.totalFilesChanged}`);
      console.log(`  Total additions:      ${pc.green(`+${result.patchSummary.totalAdditions}`)}`);
      console.log(`  Total deletions:      ${pc.red(`-${result.patchSummary.totalDeletions}`)}`);

      if (options.autoPr && result.success && !options.dryRun) {
        console.log(pc.bold(pc.cyan('\nOpening GitHub Pull Request...')));
        const isGit = BranchManager.isGitRepository(repoPath);
        if (!isGit) {
          console.log(pc.yellow('Target folder is not a git repository. Skipping PR.'));
          return;
        }

        const branchName = BranchManager.createMigrationBranch(repoPath, recipe.packageName, recipe.toVersion);
        console.log(`Created branch: ${pc.green(branchName)}`);

        const commitResult = BranchManager.commitChanges(
          repoPath,
          result.mutatedFiles,
          `refactor(api): migrate ${recipe.packageName} to v${recipe.toVersion}`
        );
        console.log(`Committed: ${pc.dim(commitResult.commitHash)}`);

        const prResult = await PrPublisher.createPullRequest({
          repoPath,
          recipe,
          migrationResult: result,
        });

        if (prResult.created) {
          console.log(pc.bold(pc.green(`\nPull Request successfully opened:`)));
          console.log(pc.underline(prResult.url || 'PR Created'));
        } else {
          console.log(pc.yellow(`Could not open PR automatically: ${prResult.error}`));
        }
      }
    } catch (err: any) {
      console.error(pc.red(`Migration failed: ${err.message}`));
      process.exit(1);
    }
  });

// 5. Serve Command (Web Studio)
program
  .command('serve')
  .description('Start the Fastify API server and React 19 Web Studio')
  .option('-p, --port <number>', 'Port to listen on', '9220')
  .option('-h, --host <host>', 'Host address', '0.0.0.0')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const host = options.host;

    const server = new ApiServer({ port, host });
    const address = await server.start();

    console.log(pc.bold(pc.cyan(`\nAPIShift Web Studio & API Server running:`)));
    console.log(`  URL:  ${pc.bold(pc.green(address))}`);
    console.log(`  API:  ${pc.bold(pc.green(`${address}/api/health`))}`);
    console.log(pc.dim(`Press Ctrl+C to stop.\n`));
  });

program.parse();
