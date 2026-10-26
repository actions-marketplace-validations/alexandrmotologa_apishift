import React from 'react';
import { Search, FileCode, Play, Cpu, CheckCircle2, XCircle } from 'lucide-react';

interface MigrationProgressProps {
  currentStep: string;
  iteration: number;
  totalCallsites: number;
  affectedFiles: number;
}

export const MigrationProgress: React.FC<MigrationProgressProps> = ({
  currentStep,
  iteration,
  totalCallsites,
  affectedFiles,
}) => {
  const steps = [
    { id: 'SCANNING', label: 'AST Scan', icon: Search },
    { id: 'SYNTHESIZING', label: 'Semantic Patch', icon: FileCode },
    { id: 'TESTING', label: 'Sandbox Execution', icon: Play },
    { id: 'HEALING', label: 'Error Repair', icon: Cpu },
  ];

  const getStepState = (stepId: string) => {
    if (currentStep === 'PASSED') return 'completed';
    if (currentStep === 'FAILED') {
      if (stepId === 'HEALING') return 'failed';
      return 'completed';
    }

    const order = ['INITIALIZING', 'SCANNING', 'SYNTHESIZING', 'TESTING', 'HEALING'];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepId);

    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div style={{
      backgroundColor: '#111827',
      borderRadius: '0.5rem',
      border: '1px solid #1f293d',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
            Autonomous Migration Pipeline
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            AST Codebase Scanner & Sandboxed Test-Driven Healing Loop
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {iteration > 0 && (
            <div style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.25rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              fontWeight: 600,
            }}>
              Iteration {iteration}
            </div>
          )}

          {totalCallsites > 0 && (
            <div style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.25rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
            }}>
              {totalCallsites} callsites in {affectedFiles} files
            </div>
          )}

          {currentStep === 'PASSED' && (
            <div style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.25rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#34d399',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <CheckCircle2 size={13} />
              100% Tests Green
            </div>
          )}

          {currentStep === 'FAILED' && (
            <div style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <XCircle size={13} />
              Healing Failed
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        position: 'relative',
      }}>
        {steps.map((s, idx) => {
          const state = getStepState(s.id);
          const Icon = s.icon;

          let borderColor = '#1f293d';
          let bgColor = '#0b0f19';
          let textColor = '#64748b';
          let iconColor = '#64748b';

          if (state === 'active') {
            borderColor = '#3b82f6';
            bgColor = 'rgba(59, 130, 246, 0.08)';
            textColor = '#93c5fd';
            iconColor = '#60a5fa';
          } else if (state === 'completed') {
            borderColor = '#059669';
            bgColor = 'rgba(16, 185, 129, 0.05)';
            textColor = '#a7f3d0';
            iconColor = '#34d399';
          } else if (state === 'failed') {
            borderColor = '#dc2626';
            bgColor = 'rgba(239, 68, 68, 0.05)';
            textColor = '#fca5a5';
            iconColor = '#f87171';
          }

          return (
            <div
              key={s.id}
              style={{
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                borderRadius: '0.375rem',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.25rem',
                backgroundColor: state === 'active' ? '#1d4ed8' : state === 'completed' ? '#065f46' : '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: iconColor,
              }}>
                <Icon size={14} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step {idx + 1}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: textColor }}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
