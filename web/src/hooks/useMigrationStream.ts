import { useState, useEffect } from 'react';

export interface StreamEvent {
  step: 'INITIALIZING' | 'SCANNING' | 'SYNTHESIZING' | 'TESTING' | 'HEALING' | 'PASSED' | 'FAILED';
  iteration: number;
  message: string;
  data?: any;
  timestamp: string;
}

export function useMigrationStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('IDLE');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('open', () => {
      setIsConnected(true);
    });

    es.addEventListener('migration-event', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventWithTs: StreamEvent = {
          ...parsed,
          timestamp: new Date().toLocaleTimeString(),
        };
        setEvents((prev) => [...prev, eventWithTs]);
        setCurrentStep(parsed.step);
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener('error', () => {
      setIsConnected(false);
    });

    return () => {
      es.close();
    };
  }, []);

  const clearEvents = () => {
    setEvents([]);
    setCurrentStep('IDLE');
  };

  return { events, currentStep, isConnected, clearEvents };
}
