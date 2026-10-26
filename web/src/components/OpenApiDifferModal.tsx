import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

export const OpenApiDifferModal: React.FC = () => {
  const [oldSpec, setOldSpec] = useState<string>(`{
  "openapi": "3.0.0",
  "info": { "title": "PaymentAPI", "version": "1.0.0" },
  "paths": {
    "/v1/charges": {
      "post": {
        "operationId": "createCharge",
        "parameters": [
          { "name": "amount", "in": "query", "schema": { "type": "integer" } },
          { "name": "currency", "in": "query", "schema": { "type": "string" } },
          { "name": "destination", "in": "query", "schema": { "type": "string" } }
        ]
      }
    }
  }
}`);

  const [newSpec, setNewSpec] = useState<string>(`{
  "openapi": "3.0.0",
  "info": { "title": "PaymentAPI", "version": "2.0.0" },
  "paths": {
    "/v2/payment_intents": {
      "post": {
        "operationId": "createPaymentIntent",
        "parameters": [
          { "name": "amount", "in": "query", "schema": { "type": "integer" } },
          { "name": "currency", "in": "query", "schema": { "type": "string" } },
          { "name": "on_behalf_of", "in": "query", "schema": { "type": "string" } }
        ]
      }
    }
  }
}`);

  const [diffResult, setDiffResult] = useState<any>(null);
  const [isDiffing, setIsDiffing] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleRunDiff = async () => {
    setIsDiffing(true);
    setDiffResult(null);
    setSavedSuccess(false);

    try {
      const parsedOld = JSON.parse(oldSpec);
      const parsedNew = JSON.parse(newSpec);

      const res = await fetch('/api/diff-openapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSpec: parsedOld, newSpec: parsedNew }),
      });

      const data = await res.json();
      setDiffResult(data);
    } catch (err: any) {
      alert(`Invalid JSON or diff error: ${err.message}`);
    } finally {
      setIsDiffing(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!diffResult || !diffResult.generatedRecipe) return;

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diffResult.generatedRecipe),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedSuccess(true);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <RefreshCw size={18} style={{ color: '#60a5fa' }} />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
          OpenAPI Specification Differ
        </h3>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
        Compare two versions of an OpenAPI / Swagger document to automatically synthesize breaking change migration recipes with method and parameter transformations.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
            Source OpenAPI Spec (v1 / Legacy)
          </label>
          <textarea
            value={oldSpec}
            onChange={(e) => setOldSpec(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              backgroundColor: '#0b0f19',
              border: '1px solid #1f293d',
              borderRadius: '0.375rem',
              color: '#cbd5e1',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '0.75rem',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
            Target OpenAPI Spec (v2 / Upgraded)
          </label>
          <textarea
            value={newSpec}
            onChange={(e) => setNewSpec(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              backgroundColor: '#0b0f19',
              border: '1px solid #1f293d',
              borderRadius: '0.375rem',
              color: '#cbd5e1',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '0.75rem',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      <button
        onClick={handleRunDiff}
        disabled={isDiffing}
        style={{
          backgroundColor: '#2563eb',
          border: '1px solid #3b82f6',
          borderRadius: '0.375rem',
          color: '#ffffff',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: isDiffing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <RefreshCw size={14} />
        {isDiffing ? 'Diffing Specs...' : 'Compute OpenAPI Diff & Synthesize Recipe'}
      </button>

      {diffResult && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #1f293d', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>
              Detected Changes ({diffResult.endpointChanges?.length || 0})
            </h4>

            <button
              onClick={handleSaveRecipe}
              disabled={savedSuccess}
              style={{
                backgroundColor: savedSuccess ? '#065f46' : '#1e293b',
                border: `1px solid ${savedSuccess ? '#10b981' : '#334155'}`,
                color: savedSuccess ? '#34d399' : '#e2e8f0',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: savedSuccess ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {savedSuccess ? <CheckCircle2 size={13} /> : <ArrowRight size={13} />}
              {savedSuccess ? 'Recipe Saved!' : 'Save as Active Recipe'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {diffResult.endpointChanges?.map((ch: any, idx: number) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#0b0f19',
                  border: '1px solid #1f293d',
                  borderRadius: '0.375rem',
                  padding: '0.6rem 0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    borderRadius: '0.2rem',
                    backgroundColor: ch.type === 'ADDED' ? 'rgba(16, 185, 129, 0.2)' : ch.type === 'REMOVED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: ch.type === 'ADDED' ? '#34d399' : ch.type === 'REMOVED' ? '#f87171' : '#fbbf24',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}>
                    {ch.type}
                  </span>
                  <span style={{ fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {ch.method} {ch.path}
                  </span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{ch.details}</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: '#070b13', borderRadius: '0.375rem', padding: '1rem', border: '1px solid #1f293d' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Synthesized Recipe JSON
            </div>
            <pre style={{ margin: 0, color: '#38bdf8', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(diffResult.generatedRecipe, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
