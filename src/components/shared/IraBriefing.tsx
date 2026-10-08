import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronRight, CheckCircle2, Check, Loader2, Sparkles, ArrowUp } from 'lucide-react';

/**
 * Ira's opening message — the first thing on an Overview (user ask, 8 Oct:
 * "pull in agentic approach from the beginning"; Option A, chat-like, no box).
 * Ira speaks first: one lead line, what it will do now, what needs you. Every
 * number comes from the page that renders it.
 *
 * Stage 2: Go ahead runs the ticked tasks; Change the plan untick any. Once
 * started, the list reads as progress — working, done (with where to look), or
 * left to you.
 */
export interface BriefingNeed { key: string; icon: ReactNode; label: ReactNode; onClick: () => void }

export type TaskState = 'todo' | 'working' | 'done' | 'skipped';
export interface BriefingTask {
  key: string;
  text: ReactNode;
  state: TaskState;
  /** Said once it is done or under way, in place of `text`. */
  progress?: ReactNode;
  onOpen?: () => void;
}

const rowCls = 'w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg text-left hover:bg-paper-100 transition-colors cursor-pointer group';
const labelCls = 'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-2';

/** One answerable topic for the Ask box: the words that point at it, and the
 *  answer, built from the page's own numbers. */
export interface BriefingTopic { match: RegExp; answer: () => ReactNode }

export default function IraBriefing({ context, lead, tasks = [], onGoAhead, needs, extra, nothingNeeded, ask }: {
  /** Where Ira is speaking from — "CY 2026 Interim", "Your portfolio". */
  context: string;
  lead: ReactNode;
  /** Leave out for a briefing with no plan (the Engagement Library, 8 Oct). */
  tasks?: BriefingTask[];
  /** Run these tasks; the rest are left to the user. */
  onGoAhead?: (run: string[], skip: string[]) => void;
  needs: BriefingNeed[];
  /** More rows under "What needs you first" (e.g. Ira's own results to confirm). */
  extra?: ReactNode;
  nothingNeeded?: string;
  /** Stage 3: the Ask box — a fixed set of topics, offered as chips. */
  ask?: { placeholder: string; suggestions: string[]; topics: BriefingTopic[]; fallback: string };
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ q: string; a: ReactNode }[]>([]);
  const send = (text: string) => {
    const t = text.trim();
    if (!t || !ask) return;
    const hit = ask.topics.find(x => x.match.test(t));
    setThread(th => [...th, { q: t, a: hit ? hit.answer() : ask.fallback }].slice(-3));
    setQ('');
  };
  const [off, setOff] = useState<string[]>([]);
  const todo = tasks.filter(t => t.state === 'todo');
  const started = tasks.length > 0 && todo.length === 0;
  const ticked = todo.filter(t => !off.includes(t.key));
  const done = tasks.filter(t => t.state === 'done').length;
  const live = tasks.filter(t => t.state !== 'skipped').length;

  const go = () => {
    onGoAhead?.(ticked.map(t => t.key), todo.filter(t => off.includes(t.key)).map(t => t.key));
    setEditing(false);
  };

  return (
    <section aria-label="Ira's briefing">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-brand-600" aria-hidden />
        </span>
        <span className="text-[0.8125rem] font-semibold text-ink-800">Ira</span>
        <span className="text-[0.75rem] text-ink-400">· {context} · just now</span>
      </div>
      <div className="mt-3 ml-8 space-y-5">
        <p className="text-[1.0625rem] leading-relaxed text-ink-800">{lead}</p>

        {onGoAhead && <div>
          <p className={labelCls}>
            {started ? <>What I’m doing <span className="normal-case tracking-normal font-normal text-ink-500">· {done} of {live} done</span></> : 'Here’s what I’ll do now'}
          </p>
          {tasks.length === 0 ? <p className="text-[0.875rem] text-ink-500">Nothing for me to run right now.</p> : (
            <ol className="space-y-1.5" aria-live="polite">
              {tasks.map((t, i) => {
                const unticked = editing && t.state === 'todo' && off.includes(t.key);
                return (
                  <li key={t.key} className={`flex items-center gap-3 text-[0.875rem] ${t.state === 'skipped' || unticked ? 'text-ink-400' : 'text-ink-700'}`}>
                    {editing && t.state === 'todo' ? (
                      <input type="checkbox" checked={!off.includes(t.key)} aria-label="Ira does this"
                        onChange={() => setOff(o => (o.includes(t.key) ? o.filter(k => k !== t.key) : [...o, t.key]))}
                        className="w-3.5 h-3.5 shrink-0 cursor-pointer accent-brand-600" />
                    ) : (
                      <span className="w-4 shrink-0 flex justify-center">
                        {t.state === 'done' ? <Check size={14} className="text-compliant-600" aria-label="Done" />
                          : t.state === 'working' ? <Loader2 size={13} className="text-brand-600 animate-spin motion-reduce:animate-none" aria-label="Working" />
                          : <span className="font-mono text-[0.75rem] font-bold text-brand-600">{i + 1}</span>}
                      </span>
                    )}
                    <span className={`min-w-0 ${t.state === 'skipped' || unticked ? 'line-through decoration-ink-300' : ''}`}>
                      {(t.state === 'working' || t.state === 'done') && t.progress ? t.progress : t.text}
                    </span>
                    {t.state === 'skipped' && <span className="shrink-0 text-[0.75rem]">— you’ll do it</span>}
                    {unticked && <span className="shrink-0 text-[0.75rem]">— you’ll do it</span>}
                    {t.state === 'done' && t.onOpen && (
                      <button type="button" onClick={t.onOpen}
                        className="shrink-0 inline-flex items-center gap-0.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                        Open <ChevronRight size={12} aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {todo.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={go} disabled={ticked.length === 0}
                title={ticked.length === 0 ? 'Tick at least one thing for me' : undefined}
                className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                Go ahead{editing && ticked.length < todo.length ? ` with ${ticked.length}` : ''}
              </button>
              <button type="button" onClick={() => setEditing(e => !e)} aria-pressed={editing}
                className="h-8 px-3.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-medium text-ink-700 hover:border-brand-200 hover:text-brand-700 transition-colors cursor-pointer">
                {editing ? 'Done changing' : 'Change the plan'}
              </button>
            </div>
          )}
        </div>}

        <div>
          <p className={labelCls}>What needs you first</p>
          <div className="space-y-0.5">
            {needs.map(n => (
              <button key={n.key} type="button" onClick={n.onClick} className={rowCls}>
                <span className="w-4 flex justify-center shrink-0">{n.icon}</span>
                <span className="text-[0.8125rem] text-ink-700">{n.label}</span>
                <ChevronRight size={14} className="ml-auto shrink-0 text-ink-300 group-hover:text-ink-500 transition-colors" />
              </button>
            ))}
            {needs.length === 0 && !extra && (
              <div className="flex items-center gap-2.5 py-1.5">
                <span className="w-4 flex justify-center shrink-0"><CheckCircle2 size={14} className="text-compliant-600" /></span>
                <span className="text-[0.8125rem] text-ink-600">{nothingNeeded ?? 'Nothing needs you right now'}</span>
              </div>
            )}
          </div>
          {extra}
        </div>

        {ask && (
          <div>
            {thread.length > 0 && (
              <div className="space-y-4 mb-4" aria-live="polite">
                {thread.map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-end">
                      <p className="max-w-[80%] rounded-2xl rounded-br-md bg-paper-100 px-3.5 py-2 text-[0.8125rem] text-ink-800">{m.q}</p>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <Sparkles size={12} className="mt-1 shrink-0 text-brand-500" aria-hidden />
                      <div className="min-w-0 text-[0.8125rem] leading-relaxed text-ink-700">{m.a}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); send(q); }}
              className="flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated pl-3.5 pr-1.5 h-11 focus-within:border-brand-300 transition-colors">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={ask.placeholder} aria-label={ask.placeholder}
                className="flex-1 min-w-0 bg-transparent outline-none text-[0.8125rem] text-ink-900 placeholder:text-ink-400" />
              <button type="submit" disabled={!q.trim()} aria-label="Ask"
                className="size-8 rounded-lg bg-brand-600 text-white flex items-center justify-center enabled:hover:bg-brand-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
                <ArrowUp size={15} />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ask.suggestions.map(sg => (
                <button key={sg} type="button" onClick={() => send(sg)}
                  className="h-7 px-2.5 rounded-full border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-600 hover:border-brand-200 hover:text-brand-700 transition-colors cursor-pointer">
                  {sg}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Session memory of a briefing's tasks ─────────────────────────────────────
 * What was started from a briefing, per scope (an audit, the portfolio), kept
 * for the session so the progress is still there on the way back. */
type Kept = Record<string, { state: Exclude<TaskState, 'todo'>; ids?: string[] }>;
const kept = new Map<string, Kept>();
const listeners = new Set<() => void>();
const EMPTY: Kept = {};

export function useBriefingTasks(scope: string) {
  const state = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => kept.get(scope) ?? EMPTY,
  );
  const set = (key: string, v: Kept[string]) => {
    kept.set(scope, { ...(kept.get(scope) ?? {}), [key]: v });
    listeners.forEach(l => l());
  };
  /** Mark working now, done after `ms` — for the tasks the prototype acts out. */
  const actOut = (key: string, ms: number) => {
    set(key, { state: 'working' });
    window.setTimeout(() => set(key, { state: 'done' }), ms);
  };
  return { state, set, actOut };
}
