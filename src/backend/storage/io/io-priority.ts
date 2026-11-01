export enum IOPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  BACKGROUND = 3,
}

export interface IOJobOptions {
  priority: IOPriority;
  label: string;
  signal?: AbortSignal;
}

export interface IOContext {
  signal?: AbortSignal;
  checkpoint(): Promise<void>;
  yieldIfInteractive(): Promise<void>;
}

export interface IOMetrics {
  activeInteractive: number;
  activeBackground: number;
  queuedCount: number;
  pausedBackgroundCount: number;
  totalCompleted: number;
  totalErrors: number;
  avgWaitTimeMs: number;
}
