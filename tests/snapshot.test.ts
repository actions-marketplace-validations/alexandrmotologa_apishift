import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SnapshotEngine } from '../src/agent/snapshot.js';

describe('SnapshotEngine', () => {
  it('should capture file snapshot and perform exact rollback', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apishift-snap-'));
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'const original = true;', 'utf8');

    const engine = new SnapshotEngine();
    const snap = engine.createSnapshot(tempDir, [testFile]);

    expect(snap.files.length).toBe(1);
    expect(snap.files[0].originalContent).toBe('const original = true;');

    // Mutate file
    fs.writeFileSync(testFile, 'const modified = true;', 'utf8');
    expect(fs.readFileSync(testFile, 'utf8')).toBe('const modified = true;');

    // Rollback
    const res = engine.rollback(snap.id);
    expect(res.restoredCount).toBe(1);
    expect(fs.readFileSync(testFile, 'utf8')).toBe('const original = true;');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
