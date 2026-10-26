import React, { useState } from 'react';
import { GitPullRequest, CheckCircle2, ExternalLink, GitBranch, AlertCircle } from 'lucide-react';

interface PrPreviewModalProps {
  repoPath: string;
  selectedRecipeId: string;
  onClose?: () => void;
}

export const PrPreviewModal: React.FC<PrPreviewModalProps> = ({ repoPath, selectedRecipeId }) => {
  const [token, setToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [prResult, setPrResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePr = async () => {
    setIsSubmitting(true);
    setError(null);
    setPrResult(null);

    try {
      const res = await fetch('/api/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath,
          recipeIdOrPath: selectedRecipeId,
          token: token || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create PR');
      }

      setPrResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
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
        <GitPullRequest size={18} style={{ color: '#60a5fa' }} />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
          GitHub Pull Request Generator
        </h3>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
        Once migration is verified green by the sandboxed test healer, APIShift creates an atomic migration branch, commits the AST transformations, and opens a verified Pull Request on GitHub.
      </p>

      <div style={{
        backgroundColor: '#0b0f19',
        border: '1px solid #1f293d',
        borderRadius: '0.375rem',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Target Repository & Recipe
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
          <GitBranch size={14} style={{ color: '#38bdf8' }} />
          <span>{repoPath || 'No repository selected'}</span>
          <span style={{ color: '#64748b' }}>•</span>
          <span style={{ color: '#a78bfa' }}>{selectedRecipeId}</span>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>
          GitHub Personal Access Token (Optional if 'gh' CLI is authenticated)
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style={{
            width: '100%',
            backgroundColor: '#0b0f19',
            border: '1px solid #1f293d',
            borderRadius: '0.375rem',
            color: '#f8fafc',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
      </div>

      <button
        onClick={handleCreatePr}
        disabled={isSubmitting || !repoPath}
        style={{
          backgroundColor: '#2563eb',
          border: '1px solid #3b82f6',
          borderRadius: '0.375rem',
          color: '#ffffff',
          padding: '0.6rem 1.25rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: isSubmitting || !repoPath ? 'not-allowed' : 'pointer',
          opacity: isSubmitting || !repoPath ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <GitPullRequest size={15} />
        {isSubmitting ? 'Opening Pull Request...' : 'Create Branch & Open Pull Request'}
      </button>

      {error && (
        <div style={{
          marginTop: '1.25rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {prResult && (
        <div style={{
          marginTop: '1.25rem',
          padding: '1rem',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 600, marginBottom: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>Pull Request Successfully Created!</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Branch: <strong style={{ color: '#38bdf8' }}>{prResult.branchResult?.branchName}</strong>
          </div>
          {prResult.prResult?.url && (
            <a
              href={prResult.prResult.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                color: '#60a5fa',
                fontSize: '0.85rem',
                textDecoration: 'underline',
              }}
            >
              <span>{prResult.prResult.url}</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
