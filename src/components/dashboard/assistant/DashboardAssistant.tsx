import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sparkles, Plus, Send, PanelRightClose, BarChart3, Eraser, X, SquarePen,
  LineChart, TrendingUp, PieChart, Hash, Table2, SlidersHorizontal, LayoutGrid, ChevronRight,
} from 'lucide-react';
import type { AssistantResult } from './assistantEngine';

const EASE = [0.22, 1, 0.36, 1] as const;

// ── "New widget" menu: chart types → guided field pickers ──
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
interface ChartMenuItem { type: string; Icon: typeof BarChart3; prompts: string[]; }
const CHART_MENU: ChartMenuItem[] = [
  { type: 'Bar Chart', Icon: BarChart3, prompts: ['invoice amount by region', 'amount at risk by department', 'duplicate count by vendor'] },
  { type: 'Line Chart', Icon: LineChart, prompts: ['invoice amount by month', 'amount at risk by month', 'duplicate count by month'] },
  { type: 'Area Chart', Icon: TrendingUp, prompts: ['invoice amount by month', 'amount at risk by quarter'] },
  { type: 'Pie Chart', Icon: PieChart, prompts: ['invoice amount by status', 'invoice amount by region', 'amount at risk by department'] },
  { type: 'KPI', Icon: Hash, prompts: ['total invoice amount', 'total amount at risk', 'average risk score'] },
  { type: 'Table', Icon: Table2, prompts: ['invoice amount by vendor', 'amount at risk by department'] },
  { type: 'Slicer', Icon: SlidersHorizontal, prompts: ['region', 'status', 'department', 'month'] },
];
// Build the guided chips for a chart type: a label + the prompt that creates it.
function guidedChipsFor(item: ChartMenuItem): { label: string; prompt: string }[] {
  if (item.type === 'KPI') return item.prompts.map(p => ({ label: cap(p), prompt: `create a KPI of ${p}` }));
  if (item.type === 'Slicer') return item.prompts.map(p => ({ label: cap(p), prompt: `add a slicer on ${p}` }));
  // Use the full type name ("pie chart") so the engine matches it over stray
  // substrings (e.g. "pie" would lose to "stat" inside "status").
  return item.prompts.map(p => ({ label: cap(p), prompt: `add a ${item.type.toLowerCase()} of ${p}` }));
}

// ── tiny rich-text renderer (handles **bold**, • bullets, newlines) ──
function renderInline(line: string, key: number): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <span key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </span>
  );
}
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = /^\s*[•-]\s+/.test(line);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-0.5">
              <span className="text-brand-500 select-none">•</span>
              <span className="flex-1">{renderInline(line.replace(/^\s*[•-]\s+/, ''), i)}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line, i)}</div>;
      })}
    </div>
  );
}

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  result?: AssistantResult;   // assistant — engine reply
  text?: string;              // user
  guided?: { intro: string; chips: { label: string; prompt: string }[] };  // assistant — guided create
}

// Default prompt pills shown in the empty composer (dashboard-relevant).
const SUGGESTIONS = [
  'Invoice amount by region',
  'Top 3 vendors by amount at risk',
  'Summarise the dashboard',
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 0.15, 0.3].map((d, i) => (
        <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
      ))}
    </div>
  );
}

function MiniTable({ table }: { table: NonNullable<AssistantResult['table']> }) {
  return (
    <div className="mt-2 rounded-[9px] border border-canvas-border overflow-hidden">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="bg-brand-50/60">
            {table.columns.map(c => <th key={c} className="text-left font-semibold text-ink-600 px-2.5 py-1.5 whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-canvas-border">
              {r.map((cell, j) => <td key={j} className={`px-2.5 py-1.5 whitespace-nowrap ${j === 0 ? 'text-ink-800 font-medium' : 'text-ink-600 tabular-nums'}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssistantBubble({ result, onSuggest }: { result: AssistantResult; onSuggest: (s: string) => void }) {
  const created = result.action?.kind === 'createWidget';
  return (
    <div className="max-w-[92%] mr-auto">
      <div className="rounded-2xl rounded-bl-md bg-canvas border border-canvas-border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
        <RichText text={result.text} />
        {result.table && <MiniTable table={result.table} />}
        {created && (
          <div className="mt-2.5 flex items-center gap-2 rounded-[9px] bg-brand-50 border border-brand-200 px-2.5 py-2 text-[11.5px] text-brand-700">
            <BarChart3 size={14} className="shrink-0" /> Widget added to the dashboard.
          </div>
        )}
        {result.action?.kind === 'clearFilters' && (
          <div className="mt-2.5 flex items-center gap-2 rounded-[9px] bg-brand-50 border border-brand-200 px-2.5 py-2 text-[11.5px] text-brand-700">
            <Eraser size={13} className="shrink-0" /> Filters cleared.
          </div>
        )}
      </div>
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {result.suggestions.map(s => (
            <button key={s} onClick={() => onSuggest(s)}
              className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11px] font-medium text-ink-600 bg-canvas-elevated border border-canvas-border hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Irame — the dashboard AI assistant. A floating, editorial chat panel docked to
 * the bottom-right. Talks to the pure NL engine via `onSubmit` (which also
 * executes the resulting action) and renders rich replies: prose, mini tables,
 * widget-created / filter confirmations, and follow-up chips.
 */
export default function DashboardAssistant({ onSubmit, focusedWidgetTitle, onClearFocus, onOpenBuilder, seed }: {
  onSubmit: (prompt: string) => AssistantResult;
  focusedWidgetTitle?: string | null;
  onClearFocus?: () => void;
  /** Opens the full Add Widget modal (the drag-and-drop builder). */
  onOpenBuilder?: () => void;
  seed?: { prompt: string; nonce: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [newWidgetOpen, setNewWidgetOpen] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);

  const scrollToEnd = () => requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); });

  const send = useCallback((prompt: string) => {
    const p = prompt.trim();
    if (!p) return;
    setMessages(m => [...m, { id: ++idRef.current, role: 'user', text: p }]);
    setInput('');
    setTyping(true);
    scrollToEnd();
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      const result = onSubmit(p);
      setMessages(m => [...m, { id: ++idRef.current, role: 'assistant', result }]);
      setTyping(false);
      scrollToEnd();
    }, 550 + Math.min(600, p.length * 8));
  }, [onSubmit]);

  const openAndSend = useCallback((prompt: string) => { setOpen(true); send(prompt); }, [send]);
  const lastNonce = useRef<number>(-1);
  useEffect(() => {
    if (seed && seed.nonce !== lastNonce.current) {
      lastNonce.current = seed.nonce;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openAndSend(seed.prompt);
    }
  }, [seed, openAndSend]);

  useEffect(() => () => { if (typingTimer.current) window.clearTimeout(typingTimer.current); }, []);
  useEffect(() => { if (open) scrollToEnd(); }, [open, messages, typing]);

  // "New chat" — reset the conversation to a clean slate.
  const newChat = () => { setMessages([]); onClearFocus?.(); setNewWidgetOpen(false); requestAnimationFrame(() => inputRef.current?.focus()); };
  // Guided create — user picked a chart type; ask what to plot with quick chips.
  const startGuided = (item: ChartMenuItem) => {
    setNewWidgetOpen(false);
    setMessages(m => [...m, { id: ++idRef.current, role: 'assistant', guided: { intro: `A **${item.type}** — what should it show?`, chips: guidedChipsFor(item) } }]);
    scrollToEnd();
  };

  const status = focusedWidgetTitle
    ? `ANALYSING · ${focusedWidgetTitle}`
    : typing ? 'WORKING…' : 'READY · NEW WIDGET';

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[70] inline-flex items-center gap-2 h-12 pl-3.5 pr-4 rounded-full bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-900/25 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
            aria-label="Open Irame, the dashboard assistant"
          >
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Sparkles size={15} /></span>
            <span className="text-[13px] font-semibold">Ask Irame</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="fixed bottom-6 right-6 z-[70] w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-3rem)] flex flex-col rounded-[16px] bg-canvas-elevated border border-canvas-border shadow-2xl shadow-brand-900/15 overflow-hidden"
            role="dialog" aria-label="Irame dashboard assistant"
          >
            {/* Header */}
            <div className="shrink-0 flex items-start justify-between px-4 py-3 border-b border-canvas-border">
              <div className="min-w-0">
                <h2 className="font-display text-[18px] font-semibold text-ink-900 leading-tight">Ask Irame</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-ink-400 truncate">{status}</span>
                  {focusedWidgetTitle && onClearFocus && (
                    <button onClick={onClearFocus} className="text-ink-300 hover:text-ink-600 cursor-pointer shrink-0" aria-label="Stop analysing this widget"><X size={11} /></button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                <button onClick={newChat} title="New chat" className="w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-canvas flex items-center justify-center cursor-pointer" aria-label="New chat">
                  <SquarePen size={16} />
                </button>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-canvas flex items-center justify-center cursor-pointer" aria-label="Collapse assistant">
                  <PanelRightClose size={17} />
                </button>
              </div>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center px-3 pt-8">
                  <h3 className="font-display text-[22px] font-semibold text-ink-900 leading-tight">Ask Irame</h3>
                  <p className="text-[13px] text-ink-500 leading-relaxed mt-2.5">
                    Describe what you want to see — <span className="text-ink-600">"invoice amount by region"</span> — and a chart is added to this dashboard. Click a widget's menu → <span className="text-ink-600">Ask Irame</span> to analyse it in place.
                  </p>
                </div>
              ) : (
                messages.map(m => m.role === 'user' ? (
                  <div key={m.id} className="max-w-[85%] ml-auto">
                    <div className="rounded-2xl rounded-br-md bg-brand-600 text-white px-3.5 py-2 text-[12.5px] leading-relaxed">{m.text}</div>
                  </div>
                ) : m.guided ? (
                  <div key={m.id} className="max-w-[92%] mr-auto">
                    <div className="rounded-2xl rounded-bl-md bg-canvas border border-canvas-border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-700">
                      <RichText text={m.guided.intro} />
                      <div className="mt-2 space-y-1.5">
                        {m.guided.chips.map(c => (
                          <button key={c.prompt} onClick={() => send(c.prompt)}
                            className="w-full text-left rounded-[10px] border border-canvas-border bg-canvas-elevated px-3 py-2 text-[12px] text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors">
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-ink-400">…or just type what you want.</p>
                    </div>
                  </div>
                ) : (
                  <AssistantBubble key={m.id} result={m.result!} onSuggest={send} />
                ))
              )}

              {typing && (
                <div className="max-w-[92%] mr-auto">
                  <div className="rounded-2xl rounded-bl-md bg-canvas border border-canvas-border px-3.5 py-2"><TypingDots /></div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-canvas-border px-3.5 py-3 space-y-2.5">
              <div className="relative inline-block">
                <button onClick={() => setNewWidgetOpen(o => !o)} aria-expanded={newWidgetOpen}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium cursor-pointer transition-colors ${newWidgetOpen ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-300 hover:text-brand-700'}`}>
                  <Plus size={14} /> New widget
                </button>
                {newWidgetOpen && (
                  <>
                    <div className="fixed inset-0 z-[1]" onClick={() => setNewWidgetOpen(false)} />
                    <div className="absolute z-[2] bottom-full left-0 mb-2 w-[260px] rounded-[12px] border border-canvas-border bg-canvas-elevated shadow-xl overflow-hidden">
                      <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-ink-400">Pick a chart type</p>
                      <div className="px-1.5 pb-1.5 grid grid-cols-1">
                        {CHART_MENU.map(item => (
                          <button key={item.type} onClick={() => startGuided(item)}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[12.5px] text-ink-700 hover:bg-brand-50 hover:text-brand-700 cursor-pointer transition-colors text-left">
                            <item.Icon size={15} className="text-brand-600 shrink-0" /> {item.type}
                          </button>
                        ))}
                      </div>
                      {onOpenBuilder && (
                        <>
                          <div className="border-t border-canvas-border" />
                          <button onClick={() => { setNewWidgetOpen(false); onOpenBuilder(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium text-ink-700 hover:bg-canvas cursor-pointer transition-colors text-left">
                            <LayoutGrid size={15} className="text-ink-500 shrink-0" /> Open full builder
                            <ChevronRight size={14} className="ml-auto text-ink-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-[14px] border border-canvas-border bg-canvas px-3 py-2 focus-within:border-brand-400 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    rows={2}
                    placeholder="Ask about your dashboard data, or describe a chart to add…"
                    className="w-full resize-none bg-transparent text-[12.5px] text-ink-800 placeholder:text-ink-400 outline-none max-h-28 leading-relaxed"
                  />
                </div>
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || typing}
                  className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-brand-600 to-brand-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:shadow-md cursor-pointer transition-all"
                  aria-label="Send"
                >
                  <Send size={16} className="-ml-0.5" />
                </button>
              </div>

              {messages.length === 0 && (
                <div className="space-y-1.5 pt-0.5">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="w-full text-left rounded-full border border-canvas-border bg-canvas-elevated px-4 py-2.5 text-[12.5px] text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
