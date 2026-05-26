import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Database, Brain, Sparkles, Plus, BellRing } from 'lucide-react';
import DataSourcesView, { type DataSourcesViewHandle } from '../data-sources/DataSourcesView';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';

type TabId = 'data' | 'learn';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'data',  label: 'Data Sources', icon: Database },
  { id: 'learn', label: 'Memory',       icon: Brain },
];

// Smart Learn: Coming Soon card with a quiet floor beneath it. The bullet
// list anchors the card spatially so it doesn't read as orphaned in space.

function SmartLearnComingSoon() {
  const prefersReducedMotion = useReducedMotion();
  const { addToast } = useToast();
  const [notified, setNotified] = useState(false);
  const upcoming = [
    'Output preferences — tone, layout, severity vocabulary',
    'Enterprise terms — your aliases for fields, sources, controls',
    'Behaviour learned in chat — corrections feed straight in',
  ];
  return (
    <div className="flex flex-col items-center pt-12">
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
          Memory will remember your output preferences and your organisation's vocabulary, so IRA writes the way <em className="not-italic font-semibold text-ink-700">you</em> would.
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400"
              animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* Waitlist CTA — turns the tab from informational to actionable. */}
        <div className="mt-6">
          <Button
            variant={notified ? 'outline' : 'primary'}
            size="sm"
            leftIcon={<BellRing size={12} />}
            onClick={() => {
              if (notified) return;
              setNotified(true);
              addToast({ type: 'success', message: 'You\'ll be notified when Memory is ready.' });
            }}
          >
            {notified ? 'You\'re on the list' : 'Notify me when it\'s ready'}
          </Button>
        </div>
      </motion.div>

      {/* Quiet floor — three bullets that anchor the card and tease the surface
          without faking real data the way the old blurred placeholder did. */}
      <div className="mt-8 max-w-lg w-full">
        <div className="font-mono text-[0.75rem] uppercase tracking-wider text-ink-400 mb-3">What's coming</div>
        <ul className="space-y-2">
          {upcoming.map(line => (
            <li key={line} className="flex items-start gap-3 text-[0.875rem] text-ink-700">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function KnowledgeHubView() {
  const [tab, setTab] = useState<TabId>('data');
  const dataSourcesRef = useRef<DataSourcesViewHandle>(null);

  // Keyboard shortcut: 'n' opens the Add-source picker when Data Sources is
  // the active tab AND focus isn't inside an editable element. Linear-style
  // single-key shortcut; avoids stomping on Cmd+N (browser "new window").
  useEffect(() => {
    if (tab !== 'data') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      dataSourcesRef.current?.openPicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  return (
    <div
      className="h-full overflow-y-auto bg-canvas"
      style={{
        // Body tinted mesh per DESIGN.md — committed alpha so the texture
        // actually reads. Cards float on warm, slightly purple canvas.
        backgroundImage: `
          radial-gradient(ellipse 900px 700px at 0% 0%, rgba(106, 18, 205, 0.07) 0%, transparent 60%),
          radial-gradient(ellipse 800px 600px at 100% 100%, rgba(243, 238, 229, 0.85) 0%, transparent 65%),
          radial-gradient(ellipse 700px 500px at 50% 100%, rgba(237, 222, 254, 0.35) 0%, transparent 55%)
        `,
      }}
    >
      {/* Page header */}
      <div className="border-b border-canvas-border bg-canvas-elevated relative overflow-hidden">
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -120, right: -160, width: 720, height: 720,
            background: 'radial-gradient(circle, rgba(136,56,222,0.22) 0%, rgba(136,56,222,0.10) 30%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            bottom: -180, left: -140, width: 520, height: 520,
            background: 'radial-gradient(circle, rgba(136,56,222,0.14) 0%, rgba(136,56,222,0.05) 35%, transparent 65%)',
            filter: 'blur(48px)',
          }}
        />
        <div className="relative px-8 pt-8 pb-6">
          <div className="flex items-center justify-between gap-6">
            <h1 className="font-display text-[2rem] font-[420] tracking-tight text-ink-900 leading-[1.1]">Knowledge Hub</h1>
            {tab === 'data' && (
              <Button
                variant="primary"
                leftIcon={<Plus size={13} />}
                onClick={() => dataSourcesRef.current?.openPicker()}
                title="Add source (N)"
              >
                Add source
              </Button>
            )}
          </div>

          {/* Pill tabs — solid paper-100 backdrop, white active pill pops. */}
          <div className="inline-flex items-center gap-1 bg-paper-100 rounded-xl border border-canvas-border p-1 shadow-sm w-fit mt-5">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700 hover:bg-canvas-elevated/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="kh-tab-bg"
                      className="absolute inset-0 bg-canvas-elevated rounded-lg shadow-sm border border-canvas-border"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={14} className={isActive ? 'text-brand-700' : 'text-ink-400'} />
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8">
        <AnimatePresence mode="wait">
          {tab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              <DataSourcesView ref={dataSourcesRef} />
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
  );
}
