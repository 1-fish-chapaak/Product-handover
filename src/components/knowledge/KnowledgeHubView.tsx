import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Brain, Sparkles, Database, FlaskConical } from 'lucide-react';
import DataSourcesView, { type DataSourcesViewHandle, type HubStats, type DisplayMode } from '../data-sources/DataSourcesView';

type TabId = 'data' | 'learn';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'data',  label: 'Data Sources', icon: Database },
  { id: 'learn', label: 'Smart Learn',  icon: Brain },
];

// ─── Memory pinned card ──────────────────────────────────────────────────────
// Quiet horizontal teaser that sits below the source grid on the Data tab.
// Lives alongside the top-level Memory tab — the tab is the deep view, this
// card is a glanceable reminder that Memory exists and a one-tap waitlist CTA.

function MemoryPinnedCard({ onOpenMemory }: { onOpenMemory: () => void }) {
  // Tab title shown alongside the "Coming next" eyebrow — kept in sync with TABS above.
  const tabLabel = 'Smart Learn';
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1], delay: 0.05 }}
      className="relative overflow-hidden rounded-2xl bg-canvas-elevated border border-canvas-border"
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -80, right: -60, width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(136,56,222,0.12) 0%, transparent 65%)',
          filter: 'blur(36px)',
        }}
      />
      <div className="relative flex items-center gap-5 px-6 py-5">
        <div className="relative w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <motion.span
            animate={prefersReducedMotion ? undefined : { rotate: [0, 5, -5, 0] }}
            transition={prefersReducedMotion ? undefined : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain size={22} className="text-brand-700" />
          </motion.span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-brand-700 font-semibold">
              <Sparkles size={10} className="inline -mt-0.5 mr-1" />
              Coming next
            </span>
            <span className="text-ink-300">·</span>
            <button
              type="button"
              onClick={onOpenMemory}
              className="text-[0.75rem] font-semibold text-ink-700 hover:text-brand-700 hover:underline cursor-pointer"
              title={`Open ${tabLabel} tab`}
            >
              {tabLabel}
            </button>
          </div>
          <p className="text-[0.875rem] text-ink-700 leading-snug">
            IRA learns your output preferences, your team's vocabulary, and corrections from chat — so answers
            sound like <em className="not-italic font-semibold text-ink-900">you</em>, not a generic assistant.
          </p>
        </div>

        {!prefersReducedMotion && (
          <div className="hidden md:flex items-center gap-1 shrink-0" aria-hidden>
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-brand-400"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -1.5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Memory tab: Coming Soon view ────────────────────────────────────────────
// Full-canvas treatment for the Memory tab. Distinct from the compact stats
// row on Data Sources — when this tab is active, IRA's voice carries the page.

// ─── Smart Learn preview — blurred teaser surface ────────────────────────────
// What Smart Learn will look like once it ships. Lives behind the coming-soon
// card with blur + dim applied, so users get a real glimpse of what's coming
// rather than a flat empty canvas. Purely visual — none of these widgets are
// wired up (pointer-events: none on the wrapper).

function SmartLearnPreview() {
  const previewCards = [
    { title: 'Output preferences', desc: 'Tone, structure, severity vocabulary',  stat: '14 learned'  },
    { title: 'Enterprise terms',   desc: 'Your aliases for fields, sources, controls', stat: '42 aliases' },
    { title: 'Chat corrections',   desc: 'Adjustments fed back into future answers',   stat: '9 patterns' },
  ];
  const flow = ['Question', 'Source pick', 'Severity check', 'Format', 'Answer'];
  const usefulness = [
    { label: 'SOX testing',        pct: 85 },
    { label: 'Vendor diligence',   pct: 72 },
    { label: 'Anomaly detection',  pct: 68 },
    { label: 'Control mapping',    pct: 54 },
    { label: 'Risk scoring',       pct: 41 },
    { label: 'Evidence gathering', pct: 33 },
  ];

  return (
    <div className="space-y-8">
      {/* Top row — three preference category cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {previewCards.map(c => (
          <div key={c.title} className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
            <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-400 mb-2">{c.stat}</div>
            <div className="font-display text-[1rem] font-[460] text-ink-900 mb-1">{c.title}</div>
            <div className="text-[0.8125rem] text-ink-500 leading-snug">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Reasoning flow chips */}
      <div>
        <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-400 mb-3">
          Reasoning flow · learned from 24 chats
        </div>
        <div className="font-display text-[1.125rem] font-[420] text-ink-900 mb-4">How IRA thinks about your questions</div>
        <div className="flex items-center gap-2 flex-wrap">
          {flow.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="px-3 h-8 inline-flex items-center rounded-lg bg-brand-50 border border-brand-100 text-[0.8125rem] font-medium text-brand-700">{step}</span>
              {i < flow.length - 1 && <span className="text-ink-300" aria-hidden>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom — horizontal bars: where this is most useful */}
      <div>
        <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-400 mb-3">
          When this is most useful · top use cases
        </div>
        <div className="font-display text-[1.125rem] font-[420] text-ink-900 mb-4">Where the model's voice is most confident</div>
        <div className="space-y-2.5">
          {usefulness.map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-32 text-[0.8125rem] text-ink-700 truncate shrink-0">{row.label}</div>
              <div className="flex-1 h-2.5 rounded-full bg-paper-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <div className="w-10 text-right text-[0.75rem] tabular-nums text-ink-500">{row.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SmartLearnComingSoon() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className="relative min-h-[560px]">
      {/* Background — blurred + dimmed preview of the future Smart Learn UI */}
      <div
        aria-hidden
        className="opacity-60 select-none pointer-events-none"
        style={{ filter: 'blur(6px)' }}
      >
        <SmartLearnPreview />
      </div>

      {/* Foreground — centered coming-soon card */}
      <div className="absolute inset-0 flex items-start justify-center pt-12">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          className="max-w-lg w-full text-center rounded-2xl bg-canvas-elevated border border-canvas-border shadow-md px-8 py-10"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-semibold tracking-wide uppercase mb-5">
            <Sparkles size={11} />
            Coming soon
          </span>

          <div className="relative w-14 h-14 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full bg-brand-50" />
            <motion.div
              animate={prefersReducedMotion ? undefined : { rotate: [0, 6, -6, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <Brain size={26} className="text-brand-700" />
            </motion.div>
          </div>

          <h2 className="font-display text-[1.5rem] font-[420] text-ink-900 leading-tight mb-2">
            IRA is still cooking this one up.
          </h2>

          <p className="text-[0.875rem] text-ink-500 leading-relaxed max-w-md mx-auto">
            Smart Learn will remember your output preferences and your organisation's vocabulary — so IRA writes the way <em className="not-italic font-semibold text-ink-700">you</em> would. We're tasting before we serve.
          </p>

          <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-brand-400"
                animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Demo state switcher ─────────────────────────────────────────────────────
// Floating bottom-right pill that cycles the catalog through its three states
// (Empty · Loading · Populated). Lives at the page level so it's reachable
// from either tab. Persists to localStorage so a refresh keeps the chosen
// state. Default is Populated.

const DEMO_OPTIONS: { id: DisplayMode; label: string }[] = [
  { id: 'empty',   label: 'Empty' },
  { id: 'loading', label: 'Loading' },
  { id: 'loaded',  label: 'Populated' },
];

function DemoStateSwitcher({ value, onChange }: { value: DisplayMode; onChange: (m: DisplayMode) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-canvas-elevated/95 backdrop-blur-sm border border-canvas-border shadow-md">
      <span className="flex items-center gap-1.5 pl-1.5 pr-1 text-[0.6875rem] font-mono uppercase tracking-wider text-ink-500">
        <FlaskConical size={11} />
        Demo
      </span>
      <div className="w-px h-4 bg-canvas-border" aria-hidden />
      {DEMO_OPTIONS.map(o => {
        const isActive = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold transition-colors cursor-pointer ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-800 hover:bg-paper-100'
            }`}
            aria-pressed={isActive}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KnowledgeHubView() {
  const [tab, setTab] = useState<TabId>('data');
  const dataSourcesRef = useRef<DataSourcesViewHandle>(null);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === 'undefined') return 'loaded';
    const stored = window.localStorage.getItem('kh:displayMode');
    if (stored === 'empty' || stored === 'loading' || stored === 'loaded') return stored;
    return 'loaded';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('kh:displayMode', displayMode);
  }, [displayMode]);

  // Keyboard shortcut: 'n' opens the Add-source picker when Data Sources is
  // the active tab AND focus isn't inside an editable element.
  useEffect(() => {
    if (tab !== 'data') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tg = t.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      dataSourcesRef.current?.openPicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  const activeTabLabel = TABS.find(t => t.id === tab)?.label ?? '';

  return (
    <div
      className="h-full overflow-y-auto bg-canvas"
      style={{
        // Soft body wash — kept gentle enough that the header reads as part of
        // the same canvas (no chrome strip / divider above the title).
        backgroundImage: `
          radial-gradient(ellipse 1100px 800px at 0% 0%, rgba(106, 18, 205, 0.06) 0%, transparent 60%),
          radial-gradient(ellipse 900px 700px at 100% 100%, rgba(243, 238, 229, 0.55) 0%, transparent 65%)
        `,
      }}
    >
      {/* ── Header — breadcrumb · title · subtitle · tabs. No chrome strip. ── */}
      <div className="px-10 pt-10">
        <div className="max-w-6xl">
          <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-500">
            Knowledge Hub <span className="text-ink-300 mx-1">·</span> {activeTabLabel}
          </div>
          <h1 className="mt-2 font-display text-[2.25rem] font-[420] tracking-tight text-ink-900 leading-[1.05]">
            Knowledge Hub
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
            Sources IRA can read, and what IRA has learned from working with you.
          </p>

          {/* ── Tabs ── */}
          <div className="mt-7 flex items-center gap-0.5 border-b border-canvas-border -mb-px">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 h-10 text-[0.8125rem] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-brand-700' : 'text-ink-400'} />
                  <span>{t.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="kh-outer-underline"
                      className="absolute -bottom-px left-2 right-2 h-[2px] bg-brand-600 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-10 py-7">
        <div className="max-w-6xl">
          <AnimatePresence mode="wait">
            {tab === 'data' && (
              <motion.div
                key="data"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="space-y-10"
              >
                <DataSourcesView
                  ref={dataSourcesRef}
                  onStatsChange={setStats}
                  displayMode={displayMode}
                />
                {stats && stats.total > 0 && (
                  <MemoryPinnedCard onOpenMemory={() => setTab('learn')} />
                )}
              </motion.div>
            )}

            {tab === 'learn' && (
              <motion.div
                key="learn"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              >
                <SmartLearnComingSoon />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating demo-state switcher — visible on the Data tab only since
          the override doesn't affect Smart Learn (which has its own preview). */}
      {tab === 'data' && (
        <DemoStateSwitcher value={displayMode} onChange={setDisplayMode} />
      )}
    </div>
  );
}
