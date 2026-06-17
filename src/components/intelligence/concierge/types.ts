import type { ElementType, ReactNode } from 'react';

// ─── AI Concierge — shared job-engine types ──────────────────────────────────
// A prototype-native mock of the production "async job" pattern (irame-mvp).
// Every tool runs the same lifecycle; only inputs/outputs differ.

export type JobStatus = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface Stage {
  id: string;
  label: string;
}

export interface JobState<R> {
  status: JobStatus;
  stageIndex: number;
  progress: number; // 0..100
  message: string;
  activity: string[];
  result: R | null;
  error: string | null;
  startedAt: number | null;
  elapsedMs: number | null;
}

/** A picked file — prototype carries metadata only, never real bytes. */
export interface PickedFile {
  name: string;
  size: number;
  type: string;
}

export type HistoryStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'IN_PROGRESS';

export interface HistoryJob {
  id: string;
  files: string[];
  status: HistoryStatus;
  createdAt: string; // human label, e.g. "2h ago"
  meta?: string; // small right-aligned note (risk level, row count…)
}

export interface ToolTab {
  id: string;
  label: string;
  icon?: ElementType;
}

/** Generic render slot. */
export type Slot = ReactNode;
