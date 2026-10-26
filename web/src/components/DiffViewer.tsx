import React, { useState } from 'react';
import { FileCode, Plus, Minus } from 'lucide-react';

export interface FileDiffItem {
  filePath: string;
  patch: string;
  additions: number;
  deletions: number;
  appliedCount: number;
}

interface DiffViewerProps {
  files: FileDiffItem[];
  selectedFilePaths?: Set<string>;
  onToggleFile?: (filePath: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  files,
  selectedFilePaths,
  onToggleFile,
}) => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);

  if (files.length === 0) {
    return (
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '0.5rem',
        border: '1px solid #1f293d',
        padding: '2rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        No file diffs available yet. Run AST Scan or Migration to view code changes.
      </div>
    );
  }

  const activeFile = files[selectedFileIdx] || files[0];
  const patchLines = activeFile.patch ? activeFile.patch.split('\n') : [];

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '520px',
    }}>
      {/* File Tab Bar */}
      <div style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1f293d',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        padding: '0.25rem 0.5rem',
        gap: '0.25rem',
      }}>
        {files.map((f, idx) => {
          const isSelected = idx === selectedFileIdx;
          const fileName = f.filePath.split(/[\\/]/).pop();
          const isIncluded = selectedFilePaths ? selectedFilePaths.has(f.filePath) : true;

          return (
            <div
              key={f.filePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: isSelected ? '#1e293b' : 'transparent',
                border: isSelected ? '1px solid #334155' : '1px solid transparent',
              }}
            >
              {onToggleFile && (
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={() => onToggleFile(f.filePath)}
                  title="Include in migration"
                  style={{ cursor: 'pointer' }}
                />
              )}
              <button
                onClick={() => setSelectedFileIdx(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.2rem 0.4rem',
                  background: 'none',
                  border: 'none',
                  color: isSelected ? '#f8fafc' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileCode size={13} style={{ color: isSelected ? '#60a5fa' : '#64748b' }} />
                <span style={{ opacity: isIncluded ? 1 : 0.5 }}>{fileName}</span>
                <span style={{ display: 'flex', gap: '0.2rem', fontSize: '0.7rem' }}>
                  <span style={{ color: '#34d399' }}>+{f.additions}</span>
                  <span style={{ color: '#f87171' }}>-{f.deletions}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Diff Header */}
      <div style={{
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #1f293d',
        backgroundColor: '#0b0f19',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: '#94a3b8',
      }}>
        <div style={{ fontFamily: 'monospace' }}>{activeFile.filePath}</div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#34d399' }}>
            <Plus size={12} /> {activeFile.additions} lines added
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#f87171' }}>
            <Minus size={12} /> {activeFile.deletions} lines removed
          </span>
        </div>
      </div>

      {/* Diff Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#0b0f19',
        padding: '0.5rem 0',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        lineHeight: 1.5,
      }}>
        {patchLines.map((line, idx) => {
          let lineBg = 'transparent';
          let textColor = '#cbd5e1';

          if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
            textColor = '#60a5fa';
            lineBg = 'rgba(59, 130, 246, 0.05)';
          } else if (line.startsWith('+')) {
            textColor = '#34d399';
            lineBg = 'rgba(16, 185, 129, 0.12)';
          } else if (line.startsWith('-')) {
            textColor = '#f87171';
            lineBg = 'rgba(239, 68, 68, 0.12)';
          }

          return (
            <div
              key={idx}
              style={{
                backgroundColor: lineBg,
                color: textColor,
                padding: '0.1rem 1rem',
                whiteSpace: 'pre',
                display: 'flex',
                gap: '1rem',
              }}
            >
              <span style={{ width: '2.5rem', textAlign: 'right', color: '#475569', userSelect: 'none' }}>
                {idx + 1}
              </span>
              <span>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
