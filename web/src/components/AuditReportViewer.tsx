import React, { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuditReportViewer: React.FC = () => {
  const [reportData, setReportData] = useState<{ markdown?: string; html?: string; success?: boolean } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/report');
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        setReportData(null);
      }
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const downloadMarkdown = () => {
    if (!reportData?.markdown) return;
    const blob = new Blob([reportData.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'APISHIFT_MIGRATION_REPORT.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading migration audit report...
      </div>
    );
  }

  if (!reportData || !reportData.markdown) {
    return (
      <div style={{
        backgroundColor: '#111827',
        borderRadius: '0.5rem',
        border: '1px solid #1f293d',
        padding: '2.5rem',
        textAlign: 'center',
      }}>
        <FileText size={32} style={{ color: '#475569', marginBottom: '1rem' }} />
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>No Audit Report Available Yet</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Run an AST migration in the Migration Studio tab to generate a full compliance and verification report.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} style={{ color: '#60a5fa' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            APIShift Verification & Compliance Audit Report
          </h3>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: reportData.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: reportData.success ? '#34d399' : '#f87171',
            border: `1px solid ${reportData.success ? '#10b981' : '#ef4444'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}>
            {reportData.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {reportData.success ? 'Verified Passing' : 'Regression Logged'}
          </span>
        </div>

        <button
          onClick={downloadMarkdown}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#ffffff',
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <Download size={13} />
          Export APISHIFT_MIGRATION_REPORT.md
        </button>
      </div>

      <pre style={{
        backgroundColor: '#070b13',
        border: '1px solid #1f293d',
        borderRadius: '0.375rem',
        padding: '1.25rem',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        lineHeight: 1.6,
        overflowX: 'auto',
        maxHeight: '600px',
      }}>
        {reportData.markdown}
      </pre>
    </div>
  );
};
