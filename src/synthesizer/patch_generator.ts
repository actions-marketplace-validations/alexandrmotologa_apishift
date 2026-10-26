import { createTwoFilesPatch } from 'diff';
import { MutateFileResult } from './ast_mutator.js';

export interface FileDiffSummary {
  filePath: string;
  patch: string;
  additions: number;
  deletions: number;
  appliedCount: number;
  appliedTransformations: string[];
}

export interface RepositoryPatchSummary {
  files: FileDiffSummary[];
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  unifiedPatch: string;
}

export class PatchGenerator {
  public static generateFileDiff(mutation: MutateFileResult): FileDiffSummary {
    if (!mutation.hasChanges) {
      return {
        filePath: mutation.filePath,
        patch: '',
        additions: 0,
        deletions: 0,
        appliedCount: 0,
        appliedTransformations: [],
      };
    }

    const patch = createTwoFilesPatch(
      mutation.filePath,
      mutation.filePath,
      mutation.originalCode,
      mutation.modifiedCode,
      'original',
      'migrated'
    );

    let additions = 0;
    let deletions = 0;

    const lines = patch.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      filePath: mutation.filePath,
      patch,
      additions,
      deletions,
      appliedCount: mutation.appliedCount,
      appliedTransformations: mutation.appliedTransformations,
    };
  }

  public static generateRepositoryPatch(mutations: MutateFileResult[]): RepositoryPatchSummary {
    const files: FileDiffSummary[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    const patchParts: string[] = [];

    for (const mutation of mutations) {
      if (mutation.hasChanges) {
        const fileDiff = this.generateFileDiff(mutation);
        files.push(fileDiff);
        totalAdditions += fileDiff.additions;
        totalDeletions += fileDiff.deletions;
        patchParts.push(fileDiff.patch);
      }
    }

    return {
      files,
      totalAdditions,
      totalDeletions,
      totalFilesChanged: files.length,
      unifiedPatch: patchParts.join('\n\n'),
    };
  }
}
