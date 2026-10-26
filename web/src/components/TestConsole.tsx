import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { StreamEvent } from '../hooks/useMigrationStream.js';

interface TestConsoleProps {
  events: StreamEvent[];
  onClear: () => void;
}

export const TestConsole: React.FC<TestConsoleProps> = ({ events, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      display: 'flex',
      flexDirection: 'column',
      height: '350px',
      overflow: 'hidden',
    }}>
      {/* Console Header */}
      <div style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1f293d',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
          <Terminal size={14} style={{ color: '#3b82f6' }} />
          <span>Execution Console & Self-Healing Stream</span>
        </div>

        <button
          onClick={onClear}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
          }}
          title="Clear console"
        >
          <Trash2 size={13} />
          Clear
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          backgroundColor: '#070b13',
          padding: '0.75rem 1rem',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: '#475569', fontStyle: 'italic' }}>
            Awaiting migration run... logs and test stdout/stderr will stream here.
          </div>
        ) : (
          events.map((e, idx) => {
            let badgeBg = '#1e293b';
            let badgeColor = '#94a3b8';

            if (e.step === 'SCANNING') {
              badgeBg = 'rgba(59, 130, 246, 0.15)';
              badgeColor = '#60a5fa';
            } else if (e.step === 'SYNTHESIZING') {
              badgeBg = 'rgba(168, 85, 247, 0.15)';
              badgeColor = '#c084fc';
            } else if (e.step === 'TESTING') {
              badgeBg = 'rgba(245, 158, 11, 0.15)';
              badgeColor = '#fbbf24';
            } else if (e.step === 'HEALING') {
              badgeBg = 'rgba(239, 68, 68, 0.15)';
              badgeColor = '#f87171';
            } else if (e.step === 'PASSED') {
              badgeBg = 'rgba(16, 185, 129, 0.2)';
              badgeColor = '#34d399';
            }

            return (
              <div key={idx} style={{ marginBottom: '0.25rem', display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: '#475569', userSelect: 'none' }}>[{e.timestamp}]</span>
                <span style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.2rem',
                  backgroundColor: badgeBg,
                  color: badgeColor,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 'fit-content',
                }}>
                  {e.step}
                  {e.iteration > 0 ? `:${e.iteration}` : ''}
                </span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{e.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
