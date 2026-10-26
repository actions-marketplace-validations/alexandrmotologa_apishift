import { ParsedError } from '../sandbox/types.js';

export interface HealingAttempt {
  iteration: number;
  errorsEncountered: ParsedError[];
  actionsTaken: string[];
  timestamp: number;
}

export class AgentMemory {
  private attempts: HealingAttempt[] = [];
  private seenSignatures = new Map<string, number>();

  public recordAttempt(iteration: number, errors: ParsedError[], actions: string[]): void {
    this.attempts.push({
      iteration,
      errorsEncountered: errors,
      actionsTaken: actions,
      timestamp: Date.now(),
    });

    for (const err of errors) {
      const sig = this.computeSignature(err);
      const count = this.seenSignatures.get(sig) || 0;
      this.seenSignatures.set(sig, count + 1);
    }
  }

  public isCyclic(err: ParsedError, threshold: number = 2): boolean {
    const sig = this.computeSignature(err);
    return (this.seenSignatures.get(sig) || 0) >= threshold;
  }

  public getAttempts(): HealingAttempt[] {
    return this.attempts;
  }

  public computeSignature(err: ParsedError): string {
    return `${err.classification}|${err.filePath || ''}|${err.line || ''}|${err.symbolName || ''}|${err.message.slice(0, 50)}`;
  }

  public clear(): void {
    this.attempts = [];
    this.seenSignatures.clear();
  }
}
