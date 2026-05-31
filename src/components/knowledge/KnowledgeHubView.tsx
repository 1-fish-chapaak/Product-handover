import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Database, Brain, Sparkles } from 'lucide-react';
import DataSourcesView, {
  type DataSourcesViewHandle,
} from '../data-sources/DataSourcesView';
import FloatingLines from '../shared/FloatingLines';

type TabId = 'data' | 'learn';
const TABS: { id: TabId; label: string; icon: React.ElementType; comingSoon?: boolean }[] = [
  { id: 'data',  label: 'Data Sources', icon: Database },
  { id: 'learn', label: 'Smart Learn',  icon: Brain, comingSoon: true },
];

// ─── Underlined tabs ────────────────────────────────────────────────────────

// Dashboard's tab recipe: pb-3 + font-semibold + motion.div underline with
// layoutId so the active brand bar springs between tabs. Thicker (3px) and
// rounded-full so it reads as an intentional indicator, not a CSS border.
function UnderlinedTabs({
  active, onChange, counts,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}) {
  return (
    <div className="flex gap-6">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        const count = counts?.[tab.id];
        const showCount = typeof count === 'number';
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {tab.label}
              {showCount && (
                <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-brand-100 text-brand-700' : 'bg-paper-50 text-ink-500'
                }`}>
                  {count}
                </span>
              )}
            </span>
            {isActive && (
              <motion.div
                layoutId="kh-main-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Smart Learn coming-soon ────────────────────────────────────────────────

function SmartLearnComingSoon() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-2xl mx-auto"
    >
      <div className="relative overflow-hidden rounded-2xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_4px_24px_rgb(106_18_205_/_0.05)] px-10 py-14 text-center">
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -120, left: '50%', transform: 'translateX(-50%)',
            width: 480, height: 320,
            background: 'radial-gradient(ellipse, rgba(136,56,222,0.12) 0%, transparent 65%)',
            filter: 'blur(28px)',
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[0.6875rem] font-semibold tracking-wider uppercase mb-6">
            <Sparkles size={11} />
            Coming soon
          </span>
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/25" />
            <motion.div
              animate={prefersReducedMotion ? undefined : { rotate: [0, 6, -6, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <Brain size={28} className="text-white" />
            </motion.div>
          </div>
          <h2 className="font-display text-[1.75rem] text-ink-900 leading-tight mb-3">
            Smart Learn is on the way
          </h2>
          <p className="text-[0.9375rem] text-ink-500 leading-relaxed max-w-md mx-auto">
            IRA will remember your output preferences, your team's vocabulary, and the
            corrections you make in chat — so answers sound like
            <em className="not-italic font-semibold text-ink-800"> you</em>, not a generic assistant.
          </p>
          <div className="mt-7 flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-brand-400"
                animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
//
// Plain editorial layout matching Dashboards: breadcrumb eyebrow, serif
// display H1, descriptive subhead, underlined tabs, content. No background
// gradient, no animated overlay — same calm chrome the rest of the platform's
// list pages use.

export default function KnowledgeHubView() {
  const dataSourcesRef = useRef<DataSourcesViewHandle>(null);
  const [tab, setTab] = useState<TabId>('data');
  // When a source detail is open it takes over the page from the top, so the
  // title / subhead / tabs header is hidden (the detail's own breadcrumb leads
  // back).
  const [detailOpen, setDetailOpen] = useState(false);
  // Tab-aware subhead. Data Sources speaks to the live catalog; Smart Learn
  // stays in the future tense so the header never promises a feature that
  // isn't shipped yet (the tab is Coming Soon).
  const subhead = tab === 'learn'
    ? 'What IRA will remember about how you and your team work — coming soon.'
    : 'Files, databases, and cloud sources IRA can read — unified in one catalog.';

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

  // Reports' exact recipe: bg-canvas outer, bg-canvas-elevated header strip
  // extends full-bleed via negative margins, border-b separator, content
  // sits on the canvas below. Side padding (px-[124px]) matches Reports.
  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {!detailOpen && (
      <div className="px-[124px] pt-8 shrink-0">
        {/* Header + tabs share a single full-bleed white strip — bg-canvas-
            elevated extends past the outer px-[124px] / pt-8 insets via
            negative margins. Border-b separates strip from content.
            FloatingLines canvas paints across the strip behind the type so
            the header reads as a brand surface, not a flat panel. */}
        <div className="bg-canvas-elevated -mx-[124px] px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Ambient FloatingLines — confined to top and bottom waves only.
              No middle wave (where the H1 sits). Low opacity keeps the lines
              as texture, never a competing visual element. Content sits in
              normal flow above the absolute canvas. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6"
          >
            {/* Header — title · subhead. Add source CTA lives on the filter
                row inside DataSourcesView (matches reference). */}
            <div className="min-w-0">
              <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">
                Knowledge Hub
              </h1>
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
                {subhead}
              </p>
            </div>
          </motion.div>

          {/* Tabs at the bottom of the strip — strip's border-b serves as
              the underline track for the active brand-600 indicator. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="-mb-px"
          >
            <UnderlinedTabs active={tab} onChange={setTab} />
          </motion.div>
        </div>
      </div>
      )}

      {/* Content area — fills the remaining viewport height. The data tab's
          inner view scrolls within (list) or fills (folder detail split).
          When a detail is open the header is hidden, so it starts from the top
          with the page's standard top inset. */}
      <div className={`px-[124px] ${detailOpen ? 'pt-8' : 'pt-4'} pb-8 flex-1 min-h-0 flex flex-col overflow-hidden`}>
        <AnimatePresence mode="wait">
          {tab === 'data' ? (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <DataSourcesView ref={dataSourcesRef} onDetailChange={setDetailOpen} />
            </motion.div>
          ) : (
            <motion.div
              key="learn"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="flex-1 min-h-0 flex items-center justify-center"
            >
              <SmartLearnComingSoon />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
