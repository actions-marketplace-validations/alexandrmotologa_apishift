import React, { useState } from 'react';
import { Plus, Trash2, Play, Save, CheckCircle2, Wrench } from 'lucide-react';
import { RecipeMeta } from './RecipeSelector.js';

interface VisualRecipeBuilderProps {
  onRecipeSaved: () => void;
}

export const VisualRecipeBuilder: React.FC<VisualRecipeBuilderProps> = ({ onRecipeSaved }) => {
  const [packageName, setPackageName] = useState<string>('my-sdk');
  const [fromVersion, setFromVersion] = useState<string>('1.0.0');
  const [toVersion, setToVersion] = useState<string>('2.0.0');
  const [recipeName, setRecipeName] = useState<string>('Custom SDK Migration');
  const [description, setDescription] = useState<string>('Automated transformation rules');

  const [methodFrom, setMethodFrom] = useState<string>('client.oldMethod');
  const [methodTo, setMethodTo] = useState<string>('client.v2.newMethod');
  const [paramOld, setParamOld] = useState<string>('old_param');
  const [paramNew, setParamNew] = useState<string>('newParam');

  const [sampleCode, setSampleCode] = useState<string>(
    `// Sample usage code\nconst res = client.oldMethod({\n  old_param: "value",\n  active: true\n});\nconsole.log(res);`
  );
  const [previewCode, setPreviewCode] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleRunPreview = () => {
    let out = sampleCode;
    if (methodFrom && methodTo) {
      out = out.replace(new RegExp(methodFrom.replace(/\./g, '\\.'), 'g'), methodTo);
    }
    if (paramOld && paramNew) {
      out = out.replace(new RegExp(`\\b${paramOld}\\b`, 'g'), paramNew);
    }
    setPreviewCode(out);
  };

  const handleSaveRecipe = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const recipe: RecipeMeta = {
      id: `${packageName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fromVersion}-to-${toVersion}`,
      name: recipeName,
      packageName,
      fromVersion,
      toVersion,
      description,
      transformations: [
        {
          type: 'METHOD_RENAME',
          from: methodFrom,
          to: methodTo,
          description: `Rename ${methodFrom} to ${methodTo}`,
        },
        {
          type: 'PARAM_RENAME',
          method: methodTo,
          paramMap: {
            [paramOld]: paramNew,
          },
          description: `Rename ${paramOld} to ${paramNew}`,
        },
      ],
    };

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe),
      });

      if (res.ok) {
        setSaveSuccess(true);
        onRecipeSaved();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save recipe');
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={18} style={{ color: '#60a5fa' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Visual Migration Recipe Builder & Live Playground
          </h3>
        </div>

        <button
          onClick={handleSaveRecipe}
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
          {saveSuccess ? 'Recipe Saved!' : 'Save Recipe'}
        </button>
      </div>

      {/* Meta Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
            Package Name
          </label>
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0b0f19', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#f8fafc', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
            From Version
          </label>
          <input
            type="text"
            value={fromVersion}
            onChange={(e) => setFromVersion(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0b0f19', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#f8fafc', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
            To Version
          </label>
          <input
            type="text"
            value={toVersion}
            onChange={(e) => setToVersion(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0b0f19', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#f8fafc', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
            Recipe Title
          </label>
          <input
            type="text"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            style={{ width: '100%', backgroundColor: '#0b0f19', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#f8fafc', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Rules Builder */}
      <div style={{ backgroundColor: '#0b0f19', borderRadius: '0.375rem', border: '1px solid #1f293d', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Transformation Rules
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
              Method Rename (From)
            </label>
            <input
              type="text"
              value={methodFrom}
              onChange={(e) => setMethodFrom(e.target.value)}
              placeholder="openai.ChatCompletion.create"
              style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.25rem', color: '#38bdf8', fontFamily: 'monospace', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
              Method Rename (To)
            </label>
            <input
              type="text"
              value={methodTo}
              onChange={(e) => setMethodTo(e.target.value)}
              placeholder="openai.chat.completions.create"
              style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.25rem', color: '#34d399', fontFamily: 'monospace', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
              Parameter Rename (From)
            </label>
            <input
              type="text"
              value={paramOld}
              onChange={(e) => setParamOld(e.target.value)}
              placeholder="model_name"
              style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.25rem', color: '#38bdf8', fontFamily: 'monospace', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
              Parameter Rename (To)
            </label>
            <input
              type="text"
              value={paramNew}
              onChange={(e) => setParamNew(e.target.value)}
              placeholder="model"
              style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.25rem', color: '#34d399', fontFamily: 'monospace', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Live Playground */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
              Live Playground: Sample Input Code
            </label>
            <button
              onClick={handleRunPreview}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#60a5fa',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Play size={11} /> Test Transformation
            </button>
          </div>
          <textarea
            value={sampleCode}
            onChange={(e) => setSampleCode(e.target.value)}
            rows={8}
            style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.75rem', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div>
          <div style={{ marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
              Synthesized Output Preview
            </label>
          </div>
          <textarea
            value={previewCode}
            readOnly
            placeholder="Click 'Test Transformation' to preview synthesized code."
            rows={8}
            style={{ width: '100%', backgroundColor: '#070b13', border: '1px solid #1f293d', borderRadius: '0.375rem', color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.75rem', outline: 'none', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
};
