import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AtrUploadState, AtrUploadView, WizardStage, UploadMethod, ExtractionSession, AtrVersion,
} from './types';

// localStorage key is domain-prefixed to avoid collisions with the other
// persisted stores (workflow-engine-v2, irame.reports.*). Mirrors the
// load/persist pattern in WorkflowContext.tsx.
const STORAGE_KEY = 'irame.atr-upload.v1';
const AUTOSAVE_MS = 30_000;

const EMPTY_STATE: AtrUploadState = {
  stage: 'method',
  method: null,
  sessions: [],
  activeSessionId: null,
  versions: [],
  lastSavedAt: null,
};

function loadPersisted(): AtrUploadState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AtrUploadState> & { session?: ExtractionSession | null };
    if (!parsed || typeof parsed.stage !== 'string') return null;
    // Migrate the legacy single-`session` shape → the multi-session model.
    if (!Array.isArray(parsed.sessions)) {
      const legacy = parsed.session ?? null;
      return {
        stage: parsed.stage,
        method: parsed.method ?? null,
        sessions: legacy ? [legacy] : [],
        activeSessionId: legacy?.id ?? null,
        versions: parsed.versions ?? [],
        lastSavedAt: parsed.lastSavedAt ?? null,
      };
    }
    return {
      stage: parsed.stage,
      method: parsed.method ?? null,
      sessions: parsed.sessions,
      activeSessionId: parsed.activeSessionId ?? parsed.sessions[parsed.sessions.length - 1]?.id ?? null,
      versions: parsed.versions ?? [],
      lastSavedAt: parsed.lastSavedAt ?? null,
    };
  } catch { /* ignore */ }
  return null;
}

export interface AtrUploadContextValue {
  state: AtrUploadView;
  /** True when a persisted draft was resumed at mount (drives the resume banner). */
  resumed: boolean;
  goTo: (stage: WizardStage) => void;
  setMethod: (method: UploadMethod | null) => void;
  /** Add a freshly-extracted report to the list and make it the active one. */
  addSession: (session: ExtractionSession) => void;
  /** Make an already-extracted report active (clicking a row in Reports Extracted). */
  selectSession: (sessionId: string) => void;
  /** Drop an extracted report from the list; clears `active` if it was active. */
  removeSession: (sessionId: string) => void;
  /** Functional update of the ACTIVE session — the general-purpose mutator the
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
      setState(prev => (prev.sessions.length ? { ...prev, lastSavedAt: new Date().toISOString() } : prev));
    }, AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, []);

  const stamp = () => new Date().toISOString();

  const goTo = useCallback((stage: WizardStage) => {
    setResumed(false);
    setState(prev => ({ ...prev, stage }));
  }, []);

  const setMethod = useCallback((method: UploadMethod | null) => {
    setState(prev => ({ ...prev, method }));
  }, []);

  const addSession = useCallback((session: ExtractionSession) => {
    setState(prev => ({
      ...prev,
      // Replace on id collision (defensive), otherwise append; newest is active.
      sessions: [...prev.sessions.filter(s => s.id !== session.id), session],
      activeSessionId: session.id,
      lastSavedAt: stamp(),
    }));
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setState(prev => (prev.sessions.some(s => s.id === sessionId) ? { ...prev, activeSessionId: sessionId } : prev));
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setState(prev => {
      const sessions = prev.sessions.filter(s => s.id !== sessionId);
      const activeSessionId = prev.activeSessionId === sessionId
        ? (sessions[sessions.length - 1]?.id ?? null)
        : prev.activeSessionId;
      return { ...prev, sessions, activeSessionId, lastSavedAt: stamp() };
    });
  }, []);

  const updateSession = useCallback((updater: (s: ExtractionSession) => ExtractionSession) => {
    setState(prev => {
      if (!prev.activeSessionId) return prev;
      const sessions = prev.sessions.map(s => (s.id === prev.activeSessionId ? updater(s) : s));
      return { ...prev, sessions, lastSavedAt: stamp() };
    });
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

  // Derive the active session so every screen can keep reading `state.session`.
  const view: AtrUploadView = {
    ...state,
    session: state.sessions.find(s => s.id === state.activeSessionId) ?? null,
  };

  const value: AtrUploadContextValue = {
    state: view, resumed, goTo, setMethod, addSession, selectSession, removeSession, updateSession, addVersion, save, reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
