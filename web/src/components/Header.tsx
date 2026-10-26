import React from 'react';
import { RefreshCw, Terminal, GitPullRequest, Layers, CheckCircle2, AlertCircle, Wrench, FileText } from 'lucide-react';

interface HeaderProps {
  activeTab: 'studio' | 'recipes' | 'builder' | 'differ' | 'report' | 'pr';
  setActiveTab: (tab: 'studio' | 'recipes' | 'builder' | 'differ' | 'report' | 'pr') => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isConnected }) => {
  return (
    <header style={{
      borderBottom: '1px solid #1f293d',
      backgroundColor: '#0f172a',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.5rem',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.1rem'
          }}>
            AS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
              APIShift
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              API-to-Codebase Auto-Migrator
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
          <button
            onClick={() => setActiveTab('studio')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'studio' ? '#1e293b' : 'transparent',
              color: activeTab === 'studio' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'studio' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Terminal size={15} />
            Migration Studio
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'builder' ? '#1e293b' : 'transparent',
              color: activeTab === 'builder' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'builder' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Wrench size={15} />
            Recipe Builder
          </button>

          <button
            onClick={() => setActiveTab('recipes')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'recipes' ? '#1e293b' : 'transparent',
              color: activeTab === 'recipes' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'recipes' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Layers size={15} />
            Recipes
          </button>

          <button
            onClick={() => setActiveTab('differ')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'differ' ? '#1e293b' : 'transparent',
              color: activeTab === 'differ' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'differ' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <RefreshCw size={15} />
            OpenAPI Differ
          </button>

          <button
            onClick={() => setActiveTab('report')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'report' ? '#1e293b' : 'transparent',
              color: activeTab === 'report' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'report' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <FileText size={15} />
            Audit Report
          </button>

          <button
            onClick={() => setActiveTab('pr')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: activeTab === 'pr' ? '#1e293b' : 'transparent',
              color: activeTab === 'pr' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'pr' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <GitPullRequest size={15} />
            PR Publisher
          </button>
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: isConnected ? '#34d399' : '#f87171',
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        }}>
          {isConnected ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          <span>{isConnected ? 'Engine Connected' : 'Engine Disconnected'}</span>
        </div>

        <a
          href="https://github.com/alexandrmotologa/apishift"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          GitHub
        </a>
      </div>
    </header>
  );
};
