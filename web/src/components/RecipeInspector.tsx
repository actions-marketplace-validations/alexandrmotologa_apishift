import React, { useState } from 'react';
import { RecipeMeta } from './RecipeSelector.js';
import { Layers, Save, CheckCircle2 } from 'lucide-react';

interface RecipeInspectorProps {
  recipes: RecipeMeta[];
  selectedRecipeId: string;
  onRecipeSaved: () => void;
}

export const RecipeInspector: React.FC<RecipeInspectorProps> = ({
  recipes,
  selectedRecipeId,
  onRecipeSaved,
}) => {
  const currentRecipe = recipes.find((r) => r.id === selectedRecipeId) || recipes[0];
  const [editedJson, setEditedJson] = useState<string>(
    currentRecipe ? JSON.stringify(currentRecipe, null, 2) : ''
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    if (currentRecipe) {
      setEditedJson(JSON.stringify(currentRecipe, null, 2));
      setSaveSuccess(false);
    }
  }, [selectedRecipeId, currentRecipe]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const parsed = JSON.parse(editedJson);
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save recipe');
      }
      setSaveSuccess(true);
      onRecipeSaved();
    } catch (err: any) {
      alert(`Error saving recipe: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentRecipe) {
    return <div>No recipes available.</div>;
  }

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} style={{ color: '#60a5fa' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Recipe Specification Inspector: {currentRecipe.name}
          </h3>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            backgroundColor: saveSuccess ? '#065f46' : '#2563eb',
            border: `1px solid ${saveSuccess ? '#10b981' : '#3b82f6'}`,
            color: '#ffffff',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          {saveSuccess ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {saveSuccess ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1rem',
        fontSize: '0.8rem',
      }}>
        <div style={{ backgroundColor: '#0b0f19', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #1f293d' }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>PACKAGE</div>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>{currentRecipe.packageName}</div>
        </div>
        <div style={{ backgroundColor: '#0b0f19', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #1f293d' }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>VERSION UPGRADE</div>
          <div style={{ fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>{currentRecipe.fromVersion} → {currentRecipe.toVersion}</div>
        </div>
        <div style={{ backgroundColor: '#0b0f19', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #1f293d' }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>TRANSFORMATIONS</div>
          <div style={{ fontWeight: 600, color: '#34d399' }}>{currentRecipe.transformations.length} rules</div>
        </div>
        <div style={{ backgroundColor: '#0b0f19', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #1f293d' }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>SCHEMA ID</div>
          <div style={{ fontWeight: 600, color: '#c084fc', fontFamily: 'monospace' }}>{currentRecipe.id}</div>
        </div>
      </div>

      <textarea
        value={editedJson}
        onChange={(e) => setEditedJson(e.target.value)}
        rows={18}
        style={{
          width: '100%',
          backgroundColor: '#070b13',
          border: '1px solid #1f293d',
          borderRadius: '0.375rem',
          color: '#cbd5e1',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          padding: '1rem',
          outline: 'none',
          resize: 'vertical',
          lineHeight: 1.5,
        }}
      />
    </div>
  );
};
