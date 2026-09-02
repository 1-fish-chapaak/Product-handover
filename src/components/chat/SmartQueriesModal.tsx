/**
 * Smart queries — banner + modal for Ask IRA.
 *
 * SmartQueriesBanner replaces the starter chips under the hero composer. Its
 * shell is a BorderGlow card whose glow cone orbits continuously — fast while
 * Ira "profiles" the attached data, slow and dim once ready. The ready state
 * previews the detected business processes as pills; clicking a pill opens
 * the modal on that category, clicking anywhere else opens it on the first.
 *
 * SmartQueriesModal is a white surface with a faint WebGL Scanner field
 * behind it: a category rail of detected business processes, each with
 * ready-to-ask questions. Picking a question pastes it into the composer
 * (it does not auto-send).
 */
import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  X, Sparkles, ArrowRight, Loader2, CornerDownLeft, WandSparkles, Columns3,
  Radar, ShoppingCart, ReceiptText, CreditCard, BookOpenCheck, Building2,
  type LucideIcon,
} from 'lucide-react';
import { useDialogA11y } from './useModalA11y';
import BorderGlow from '../shared/BorderGlow';
import Scanner from '../shared/Scanner';
import {
  SMART_QUERY_CATEGORIES, SMART_QUERY_QUESTION_COUNT, SMART_QUERY_PROCESS_COUNT,
  type SmartQueryTone,
} from './smartQueries';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  anomaly: Radar,
  procurement: ShoppingCart,
  o2c: ReceiptText,
  i2p: CreditCard,
  je: BookOpenCheck,
  vendor: Building2,
};

// Technique-chip accents per category tone. Static class strings so Tailwind
// keeps them (no runtime interpolation).
const TONE_CHIP: Record<SmartQueryTone, string> = {
  brand:   'bg-brand-50 text-brand-700 border-brand-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  slate:   'bg-ink-100 text-ink-600 border-ink-200',
};

const questionCount = (catId: string) => {
  const cat = SMART_QUERY_CATEGORIES.find(c => c.id === catId);
  return cat ? cat.sections.reduce((n, s) => n + s.questions.length, 0) : 0;
};

/* ────────────────────── Banner ────────────────────── */

// Skeleton pill widths (px) while generating — ragged like real labels.
const PILL_SKELETON_WIDTHS = [128, 104, 112, 100, 132, 108];

interface BannerProps {
  /** True while Ira is still profiling the dataset. */
  generating: boolean;
  /** Open the modal, optionally landing on a category. */
  onOpen: (categoryId?: string) => void;
}

export function SmartQueriesBanner({ generating, onOpen }: BannerProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <BorderGlow
      running={prefersReducedMotion ? false : generating ? 'fast' : 'calm'}
      backgroundColor="#FFFFFF"
      borderRadius={16}
      glowRadius={26}
      glowIntensity={generating ? 1 : 0.6}
      glowColor="272 84 74"
      coneSpread={20}
      fillOpacity={0.35}
      colors={['#A366F0', '#E879F9', '#38BDF8']}
      className="border-glow-light w-full text-left"
    >
      <div className="px-5 pt-4 pb-3.5">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onOpen()}
            aria-label={generating
              ? 'Ira is generating smart queries — click to preview'
              : `Explore ${SMART_QUERY_QUESTION_COUNT} smart queries across ${SMART_QUERY_PROCESS_COUNT} business processes`}
            className="group flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <motion.div
              className="size-11 rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_18px_rgba(163,102,240,0.45)] shrink-0"
              animate={generating && !prefersReducedMotion ? { scale: [1, 1.07, 1] } : undefined}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <WandSparkles size={19} className="text-white" />
            </motion.div>
            <AnimatePresence mode="wait" initial={false}>
              {generating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[0.9375rem] font-semibold text-ink-800">Generating smart queries for you</p>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-ink-500 truncate mt-0.5">
                    Ira is profiling your data — Benford's Law, procurement, O2C, I2P &amp; fraud patterns
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[0.9375rem] font-semibold text-ink-800">Smart queries ready</p>
                    <span className="px-2 h-[18px] inline-flex items-center rounded-full bg-brand-100 text-brand-700 text-[0.5625rem] font-bold uppercase tracking-[0.1em]">
                      {SMART_QUERY_QUESTION_COUNT} questions
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-ink-500 truncate mt-0.5">
                    {SMART_QUERY_PROCESS_COUNT} business processes detected in your data — pick one, or explore the full library
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          {generating ? (
            <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium text-brand-600">
              <Loader2 size={13} className="animate-spin" />
              Analyzing
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpen()}
              className="group shrink-0 flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold rounded-lg transition-colors cursor-pointer shadow-[0_4px_16px_-6px_rgba(85,15,165,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Sparkles size={13} />
              Explore
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Process preview row — the detected categories as pills. While
            generating they render as shimmering placeholders; once ready
            each pill deep-links into its category in the modal. */}
        <div className="mt-3.5 pl-[3.625rem] flex items-center gap-1.5 flex-wrap">
          {generating
            ? PILL_SKELETON_WIDTHS.map((w, i) => (
                <span
                  key={i}
                  className="skeleton-cool h-7 rounded-full"
                  style={{ width: `${w}px`, '--sk-delay': `${i * 110}ms` } as CSSProperties}
                />
              ))
            : SMART_QUERY_CATEGORIES.map(cat => {
                const Icon = CATEGORY_ICON[cat.id] ?? Sparkles;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onOpen(cat.id)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-brand-200/70 bg-brand-50/70 text-[0.6875rem] font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-300 hover:text-brand-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Icon size={12} />
                    {cat.name}
                    <span className="text-brand-400 tabular-nums">{questionCount(cat.id)}</span>
                  </button>
                );
              })}
        </div>
      </div>
    </BorderGlow>
  );
}

/* ────────────────────── Modal ────────────────────── */

interface ModalProps {
  open: boolean;
  /** Mirrors the banner's generating state — shows skeletons until ready. */
  loading: boolean;
  /** "Detected from …" line in the header. */
  datasetLabel: string;
  /** Category to land on when opened from a process pill. */
  initialCategoryId?: string;
  onClose: () => void;
  /** Question text to paste into the composer. Caller closes the modal. */
  onPick: (question: string) => void;
}

export default function SmartQueriesModal({ open, ...rest }: ModalProps) {
  // The dialog is its own component mounted only while open, so its rail
  // state (active category) resets naturally on every open — no reset effect.
  return (
    <AnimatePresence>
      {open && <SmartQueriesDialog {...rest} />}
    </AnimatePresence>
  );
}

function SmartQueriesDialog({ loading, datasetLabel, initialCategoryId, onClose, onPick }: Omit<ModalProps, 'open'>) {
  const prefersReducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(
    () => SMART_QUERY_CATEGORIES.find(c => c.id === initialCategoryId)?.id ?? SMART_QUERY_CATEGORIES[0].id,
  );
  const dialogRef = useDialogA11y(true, onClose);
  const active = SMART_QUERY_CATEGORIES.find(c => c.id === activeId) ?? SMART_QUERY_CATEGORIES[0];

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sq-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="relative w-[1000px] h-[620px] max-w-[94vw] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-border-light overflow-hidden"
          >
            {/* Scanner field — a faint animated texture behind the white
                surface. Pastel peaks + no scanline/grain keep it a light
                watermark, not a dark field. Skipped for reduced motion. */}
            {!prefersReducedMotion && (
              <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
                <Scanner
                  color1="#5227FF"
                  color2="#FF9FFC"
                  color3="#C9ABFF"
                  speed={0.35}
                  sweepSpeed={0.18}
                  bandDensity={9}
                  glow={0.18}
                  vignette={0.5}
                  scanline={false}
                  grain={false}
                  opacity={0.5}
                  mouseInteraction={false}
                />
              </div>
            )}

            <div className="relative z-10 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-paper-200 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_14px_rgba(163,102,240,0.4)] shrink-0">
                    <WandSparkles size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 id="sq-title" className="text-[0.9375rem] font-semibold text-ink-800 leading-tight">Smart queries</h2>
                    <p className="text-[0.6875rem] text-ink-500 truncate">
                      {loading ? 'Profiling your dataset…' : <>Detected from <span className="font-medium text-ink-700">{datasetLabel}</span></>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-brand-50 transition-colors cursor-pointer shrink-0"
                  aria-label="Close smart queries"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Category chips — one horizontal row (like One-Click Audit's
                  header pills) so the Scanner field stays visible across the
                  modal's full width. */}
              <div className="shrink-0 px-5 pt-3.5 pb-1 flex items-center gap-1.5 flex-wrap">
                {SMART_QUERY_CATEGORIES.map(cat => {
                  const Icon = CATEGORY_ICON[cat.id] ?? Sparkles;
                  const isActive = cat.id === activeId;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveId(cat.id)}
                      aria-pressed={isActive}
                      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[0.75rem] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isActive
                          ? 'bg-brand-600 border-brand-600 text-white shadow-[0_4px_14px_-6px_rgba(85,15,165,0.55)]'
                          : 'bg-white/70 backdrop-blur-[2px] border-paper-200 text-ink-600 hover:border-brand-300 hover:text-brand-700'
                      }`}
                    >
                      <Icon size={13} />
                      {cat.name}
                      <span className={`tabular-nums text-[0.6875rem] font-medium ${isActive ? 'text-white/75' : 'text-ink-400'}`}>
                        {loading ? '·' : questionCount(cat.id)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Question pane — full width beneath the chips */}
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 py-4">
                  {loading ? (
                    <div className="space-y-2.5" aria-label="Generating questions">
                      <div className="flex items-center gap-2 text-[0.8125rem] text-ink-500 mb-4">
                        <Loader2 size={14} className="animate-spin text-brand-500" />
                        Ira is drafting questions for {active.name.toLowerCase()}…
                      </div>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="skeleton-cool h-[46px] rounded-xl"
                          style={{ '--sk-delay': `${i * 120}ms` } as CSSProperties}
                        />
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      key={active.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Pane header — blurb + evidence line for the category
                          (the old rail carried the blurb; it lives here now) */}
                      <div className="mb-4">
                        <h3 className="text-[0.9375rem] font-semibold text-ink-800">
                          {active.name}
                          <span className="ml-2 text-[0.75rem] font-normal text-ink-500">{active.blurb}</span>
                        </h3>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[0.6875rem] text-ink-400">
                            <Columns3 size={11} />
                            Matched columns:
                          </span>
                          {active.signals.map(sig => (
                            <span key={sig} className="px-1.5 py-0.5 rounded border border-paper-200 bg-white/80 text-[0.6875rem] text-ink-600 font-medium">
                              {sig}
                            </span>
                          ))}
                        </div>
                      </div>

                      {active.sections.map((section, si) => (
                        <div key={section.name ?? si} className={si > 0 ? 'mt-5' : ''}>
                          {section.name && (
                            <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-400">
                              {section.name}
                            </p>
                          )}
                          <div className="space-y-2">
                            {section.questions.map(q => (
                              <button
                                key={q.id}
                                onClick={() => onPick(q.text)}
                                className="group w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-paper-200 bg-white/85 backdrop-blur-[2px] hover:border-brand-300 hover:bg-brand-50/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              >
                                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[0.625rem] font-bold uppercase tracking-[0.04em] ${TONE_CHIP[active.tone]}`}>
                                  {q.tag}
                                </span>
                                <span className="flex-1 text-[0.8125rem] text-ink-700 group-hover:text-ink-900 leading-snug">
                                  {q.text}
                                </span>
                                <span className="shrink-0 flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CornerDownLeft size={12} />
                                  Use
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-paper-200 bg-paper-50/80 shrink-0">
                <p className="text-[0.6875rem] text-ink-500">
                  Clicking a question drops it into the composer — edit it before you send.
                </p>
                <p className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">
                  {SMART_QUERY_QUESTION_COUNT} questions · {SMART_QUERY_PROCESS_COUNT} processes
                </p>
              </div>
            </div>
          </motion.div>
        </div>
  );
}
