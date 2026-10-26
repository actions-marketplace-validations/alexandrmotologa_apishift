import fs from 'node:fs';
import path from 'node:path';

export interface FileSnapshot {
  filePath: string;
  originalContent: string;
  exists: boolean;
}

export interface SnapshotMeta {
  id: string;
  timestamp: number;
  files: FileSnapshot[];
}

export class SnapshotEngine {
  private snapshots = new Map<string, SnapshotMeta>();

  public createSnapshot(repoPath: string, files: string[]): SnapshotMeta {
    const id = `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileSnapshots: FileSnapshot[] = [];

    for (const f of files) {
      const absPath = path.isAbsolute(f) ? f : path.resolve(repoPath, f);
      const exists = fs.existsSync(absPath);
      fileSnapshots.push({
        filePath: absPath,
        originalContent: exists ? fs.readFileSync(absPath, 'utf8') : '',
        exists,
      });
    }

    const meta: SnapshotMeta = {
      id,
      timestamp: Date.now(),
      files: fileSnapshots,
    };

    this.snapshots.set(id, meta);
    return meta;
  }

  public rollback(snapshotId: string): { restoredCount: number; deletedCount: number } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    let restoredCount = 0;
    let deletedCount = 0;

    for (const item of snapshot.files) {
      if (item.exists) {
        fs.writeFileSync(item.filePath, item.originalContent, 'utf8');
        restoredCount++;
      } else if (fs.existsSync(item.filePath)) {
        fs.unlinkSync(item.filePath);
        deletedCount++;
      }
    }

    return { restoredCount, deletedCount };
  }

  public rollbackLatest(): { restoredCount: number; deletedCount: number } | null {
    const all = Array.from(this.snapshots.values());
    if (all.length === 0) return null;
    const latest = all[all.length - 1];
    return this.rollback(latest.id);
  }

  public getSnapshot(id: string): SnapshotMeta | undefined {
    return this.snapshots.get(id);
  }

  public clear(): void {
    this.snapshots.clear();
  }
}
