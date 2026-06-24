import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AtrUploadState, WizardStage, UploadMethod, ExtractionSession, AtrVersion,
} from './types';

// localStorage key is domain-prefixed to avoid collisions with the other
// persisted stores (workflow-engine-v2, irame.reports.*). Mirrors the
// load/persist pattern in WorkflowContext.tsx.
const STORAGE_KEY = 'irame.atr-upload.v1';
const AUTOSAVE_MS = 30_000;

const EMPTY_STATE: AtrUploadState = {
  stage: 'method',
  method: null,
  session: null,
  versions: [],
  lastSavedAt: null,
};

function loadPersisted(): AtrUploadState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AtrUploadState;
    if (parsed && typeof parsed.stage === 'string') return parsed;
  } catch { /* ignore */ }
  return null;
}

export interface AtrUploadContextValue {
  state: AtrUploadState;
  /** True when a persisted draft was resumed at mount (drives the resume banner). */
  resumed: boolean;
  goTo: (stage: WizardStage) => void;
  setMethod: (method: UploadMethod) => void;
  /** Replace the live extraction session (after processing completes). */
  setSession: (session: ExtractionSession) => void;
  /** Functional update of the live session — the general-purpose mutator the
   *  screens use (toggle selection, resolve missing fields, relink annexures…). */
  updateSession: (updater: (s: ExtractionSession) => ExtractionSession) => void;
  addVersion: (version: AtrVersion) => void;
  /** Force a persist + refresh the "Saved" timestamp. */
  save: () => void;
  /** Clear everything and return to Screen 1 (Start Over). */
  reset: () => void;
}

const Ctx = createContext<AtrUploadContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAtrUpload = (): AtrUploadContextValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAtrUpload must be used within AtrUploadProvider');
  return v;
};

export function AtrUploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AtrUploadState>(() => loadPersisted() ?? EMPTY_STATE);
  // A draft is "resumed" only if it had progressed past the first screen. A
  // non-'method' stage can only come from a restored draft (EMPTY_STATE = method).
  const [resumed, setResumed] = useState<boolean>(() => state.stage !== 'method');

  // Persist on every state change (covers "auto-save on every user action").
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // Plus a 30s heartbeat that refreshes the "Saved" indicator timestamp.
  useEffect(() => {
    const id = window.setInterval(() => {
      setState(prev => (prev.session ? { ...prev, lastSavedAt: new Date().toISOString() } : prev));
    }, AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, []);

  const stamp = () => new Date().toISOString();

  const goTo = useCallback((stage: WizardStage) => {
    setResumed(false);
    setState(prev => ({ ...prev, stage }));
  }, []);

  const setMethod = useCallback((method: UploadMethod) => {
    setState(prev => ({ ...prev, method }));
  }, []);

  const setSession = useCallback((session: ExtractionSession) => {
    setState(prev => ({ ...prev, session, lastSavedAt: stamp() }));
  }, []);

  const updateSession = useCallback((updater: (s: ExtractionSession) => ExtractionSession) => {
    setState(prev => (prev.session ? { ...prev, session: updater(prev.session), lastSavedAt: stamp() } : prev));
  }, []);

  const addVersion = useCallback((version: AtrVersion) => {
    setState(prev => ({ ...prev, versions: [version, ...prev.versions], lastSavedAt: stamp() }));
  }, []);

  const save = useCallback(() => {
    setState(prev => ({ ...prev, lastSavedAt: stamp() }));
  }, []);

  const reset = useCallback(() => {
    setResumed(false);
    setState(EMPTY_STATE);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const value: AtrUploadContextValue = {
    state, resumed, goTo, setMethod, setSession, updateSession, addVersion, save, reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
