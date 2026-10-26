import { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { RecipeSelector, RecipeMeta } from './components/RecipeSelector.js';
import { MigrationProgress } from './components/MigrationProgress.js';
import { DiffViewer, FileDiffItem } from './components/DiffViewer.js';
import { TestConsole } from './components/TestConsole.js';
import { PrPreviewModal } from './components/PrPreviewModal.js';
import { OpenApiDifferModal } from './components/OpenApiDifferModal.js';
import { RecipeInspector } from './components/RecipeInspector.js';
import { useMigrationStream } from './hooks/useMigrationStream.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'recipes' | 'differ' | 'pr'>('studio');
  const [recipes, setRecipes] = useState<RecipeMeta[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('openai-v0-to-v1');
  const [repoPath, setRepoPath] = useState<string>('B:/workgit/apishift/fixtures/sample_openai_project');
  const [testCommand, setTestCommand] = useState<string>('npm test');
  const [sandboxMode, setSandboxMode] = useState<'auto' | 'docker' | 'local'>('auto');
  const [dryRun, setDryRun] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalCallsites, setTotalCallsites] = useState<number>(0);
  const [affectedFiles, setAffectedFiles] = useState<number>(0);
  const [fileDiffs, setFileDiffs] = useState<FileDiffItem[]>([]);
  const [iteration, setIteration] = useState<number>(0);

  const { events, currentStep, isConnected, clearEvents } = useMigrationStream();

  const loadRecipes = async () => {
    try {
      const res = await fetch('/api/recipes');
      const data = await res.json();
      if (data.recipes) {
        setRecipes(data.recipes);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // Update iteration based on stream events
  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      if (lastEvent.iteration) {
        setIteration(lastEvent.iteration);
      }
    }
  }, [events]);

  const handleScan = async () => {
    setIsLoading(true);
    clearEvents();
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath,
          recipeIdOrPath: selectedRecipeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan repository');
      }

      setTotalCallsites(data.scanSummary.totalCallsitesCount);
      setAffectedFiles(data.scanSummary.affectedFilesCount);
    } catch (err: any) {
      alert(`Scan error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async () => {
    setIsLoading(true);
    clearEvents();
    setFileDiffs([]);
    setIteration(0);

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath,
          recipeIdOrPath: selectedRecipeId,
          testCommand,
          sandboxMode,
          dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      if (data.result) {
        setTotalCallsites(data.result.initialScan.totalCallsitesCount);
        setAffectedFiles(data.result.initialScan.affectedFilesCount);
        setIteration(data.result.totalIterations);

        if (data.result.patchSummary?.files) {
          setFileDiffs(data.result.patchSummary.files);
        }
      }
    } catch (err: any) {
      alert(`Migration error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} isConnected={isConnected} />

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        {activeTab === 'studio' && (
          <div>
            <RecipeSelector
              recipes={recipes}
              selectedRecipeId={selectedRecipeId}
              setSelectedRecipeId={setSelectedRecipeId}
              repoPath={repoPath}
              setRepoPath={setRepoPath}
              testCommand={testCommand}
              setTestCommand={setTestCommand}
              sandboxMode={sandboxMode}
              setSandboxMode={setSandboxMode}
              dryRun={dryRun}
              setDryRun={setDryRun}
              onScan={handleScan}
              onMigrate={handleMigrate}
              isLoading={isLoading}
            />

            <MigrationProgress
              currentStep={currentStep}
              iteration={iteration}
              totalCallsites={totalCallsites}
              affectedFiles={affectedFiles}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.25rem' }}>
              <DiffViewer files={fileDiffs} />
              <TestConsole events={events} onClear={clearEvents} />
            </div>
          </div>
        )}

        {activeTab === 'recipes' && (
          <RecipeInspector
            recipes={recipes}
            selectedRecipeId={selectedRecipeId}
            onRecipeSaved={loadRecipes}
          />
        )}

        {activeTab === 'differ' && <OpenApiDifferModal />}

        {activeTab === 'pr' && (
          <PrPreviewModal repoPath={repoPath} selectedRecipeId={selectedRecipeId} />
        )}
      </main>

      <footer style={{
        borderTop: '1px solid #1f293d',
        padding: '0.75rem 1.5rem',
        fontSize: '0.75rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0f172a',
      }}>
        <div>APIShift v1.0.0 • Autonomous API Migration & AST Refactoring Engine</div>
        <div>Created by Alexandr Motologa • Open Source under MIT License</div>
      </footer>
    </div>
  );
}

export default App;
