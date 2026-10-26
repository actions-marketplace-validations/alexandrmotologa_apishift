import React from 'react';
import { Play, Search, Folder, Sliders, Box } from 'lucide-react';

export interface RecipeMeta {
  id: string;
  name: string;
  packageName: string;
  fromVersion: string;
  toVersion: string;
  description: string;
  transformations: any[];
}

interface RecipeSelectorProps {
  recipes: RecipeMeta[];
  selectedRecipeId: string;
  setSelectedRecipeId: (id: string) => void;
  repoPath: string;
  setRepoPath: (path: string) => void;
  testCommand: string;
  setTestCommand: (cmd: string) => void;
  sandboxMode: 'auto' | 'docker' | 'local';
  setSandboxMode: (mode: 'auto' | 'docker' | 'local') => void;
  dryRun: boolean;
  setDryRun: (dry: boolean) => void;
  autoUpgradeManifest: boolean;
  setAutoUpgradeManifest: (up: boolean) => void;
  rollbackOnFailure: boolean;
  setRollbackOnFailure: (rb: boolean) => void;
  onScan: () => void;
  onMigrate: () => void;
  onRollback: () => void;
  isLoading: boolean;
}

export const RecipeSelector: React.FC<RecipeSelectorProps> = ({
  recipes,
  selectedRecipeId,
  setSelectedRecipeId,
  repoPath,
  setRepoPath,
  testCommand,
  setTestCommand,
  sandboxMode,
  setSandboxMode,
  dryRun,
  setDryRun,
  autoUpgradeManifest,
  setAutoUpgradeManifest,
  rollbackOnFailure,
  setRollbackOnFailure,
  onScan,
  onMigrate,
  onRollback,
  isLoading,
}) => {
  const currentRecipe = recipes.find((r) => r.id === selectedRecipeId);

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div className="recipe-selector-grid">
        {/* Recipe Selection */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
            Migration Recipe
          </label>
          <select
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#0b0f19',
              border: '1px solid #1f293d',
              borderRadius: '0.375rem',
              color: '#f8fafc',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.packageName})
              </option>
            ))}
          </select>
        </div>

        {/* Repository Path */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
            Target Repository Path
          </label>
          <div style={{ position: 'relative' }}>
            <Folder size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="B:/workgit/project"
              disabled={isLoading}
              style={{
                width: '100%',
                backgroundColor: '#0b0f19',
                border: '1px solid #1f293d',
                borderRadius: '0.375rem',
                color: '#f8fafc',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onScan}
            disabled={isLoading || !repoPath}
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#e2e8f0',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: isLoading || !repoPath ? 'not-allowed' : 'pointer',
              opacity: isLoading || !repoPath ? 0.6 : 1,
            }}
          >
            <Search size={14} />
            Scan AST
          </button>

          <button
            onClick={onMigrate}
            disabled={isLoading || !repoPath}
            style={{
              flex: 1.3,
              backgroundColor: '#2563eb',
              border: '1px solid #3b82f6',
              borderRadius: '0.375rem',
              color: '#ffffff',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: isLoading || !repoPath ? 'not-allowed' : 'pointer',
              opacity: isLoading || !repoPath ? 0.6 : 1,
            }}
          >
            <Play size={14} />
            Migrate & Heal
          </button>

          <button
            onClick={onRollback}
            disabled={isLoading}
            title="Rollback latest modified files to pre-migration snapshot"
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.375rem',
              color: '#f87171',
              padding: '0.5rem 0.6rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.2rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Revert
          </button>
        </div>
      </div>

      {/* Advanced Options Drawer */}
      <div className="options-row" style={{
        fontSize: '0.75rem',
        color: '#94a3b8',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sliders size={13} />
            <span>Test Command:</span>
            <input
              type="text"
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              disabled={isLoading}
              style={{
                backgroundColor: '#0b0f19',
                border: '1px solid #1f293d',
                borderRadius: '0.25rem',
                color: '#f8fafc',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Box size={13} />
            <span>Sandbox:</span>
            <select
              value={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.value as any)}
              disabled={isLoading}
              style={{
                backgroundColor: '#0b0f19',
                border: '1px solid #1f293d',
                borderRadius: '0.25rem',
                color: '#f8fafc',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                outline: 'none',
              }}
            >
              <option value="auto">Auto (Docker or Local)</option>
              <option value="docker">Docker Only</option>
              <option value="local">Isolated Process</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoUpgradeManifest}
              onChange={(e) => setAutoUpgradeManifest(e.target.checked)}
              disabled={isLoading}
            />
            <span>Auto-update package.json</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rollbackOnFailure}
              onChange={(e) => setRollbackOnFailure(e.target.checked)}
              disabled={isLoading}
            />
            <span>Rollback on failure</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={isLoading}
            />
            <span>Dry Run</span>
          </label>
        </div>

        {currentRecipe && (
          <div style={{ color: '#64748b' }}>
            Package: <strong style={{ color: '#94a3b8' }}>{currentRecipe.packageName}</strong> ({currentRecipe.fromVersion} → {currentRecipe.toVersion}) | {currentRecipe.transformations.length} transformations
          </div>
        )}
      </div>
    </div>
  );
};
