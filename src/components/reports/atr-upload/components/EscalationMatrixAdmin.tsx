import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarClock, Mail, BellRing, TriangleAlert, RefreshCw, Flag, ChevronDown, ChevronUp,
  RotateCcw, Copy, Check, Layers, SlidersHorizontal, ArrowRight, Users, CircleDot,
} from 'lucide-react';
import { Button } from '../../../shared/Button';
import { EscalationCadenceEditor } from './EscalationMatrixEditor';
import {
  type EscalationMatrixSet,
  type EscalationSeverity,
  type EscalationMatrixConfig,
  ESCALATION_SEVERITIES,
  cloneDefaultMatrixSet,
  defaultMatrixForSeverity,
  computeEscalationSchedule,
  summarizeMatrix,
  ccNames,
  fmtDate,
  addDays,
} from '../escalationMatrix';

// ─── severity tokens ───
const SEVERITY_TONE: Record<EscalationSeverity, { pill: string; dot: string; ring: string }> = {
  Critical: { pill: 'bg-risk-50 text-risk-700 border-risk-200', dot: 'bg-risk-600', ring: 'border-risk-400' },
  High:     { pill: 'bg-high-50 text-high-700 border-high-200', dot: 'bg-high-600', ring: 'border-high-400' },
  Medium:   { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-600', ring: 'border-mitigated-400' },
  Low:      { pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant-600', ring: 'border-compliant-400' },
};

const EXPLAINER_KEY = 'irame.atr.escalation.explainer-collapsed';
const readCollapsed = () => { try { return localStorage.getItem(EXPLAINER_KEY) === '1'; } catch { return false; } };
const writeCollapsed = (v: boolean) => { try { localStorage.setItem(EXPLAINER_KEY, v ? '1' : '0'); } catch { /* ignore */ } };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * "How the triggers work" — the matrix as a left-to-right journey anchored on
 * the exception's due date, with the live numbers from the cadence being
 * configured. Each stage says what fires it and who receives the mail, so the
 * user reads the mechanism before touching a control.
 */
function HowItWorks({ cfg, severityLabel }: { cfg: EscalationMatrixConfig; severityLabel: string }) {
  // A worked example off a sample due date 10 days out — real dates make the
  // cadence concrete ("Esc-1 lands on 14 Oct").
  const example = useMemo(() => {
    const due = addDays(new Date(), 10);
    due.setHours(0, 0, 0, 0);
    return { due, events: computeEscalationSchedule(due, cfg, { recurringCount: 2 }) };
  }, [cfg]);
  const byKind = (k: string) => example.events.filter(e => e.kind === k);
  const first = (k: string) => byKind(k)[0];
  const last = (k: string) => byKind(k).slice(-1)[0];

  const stages: { icon: typeof Mail; tint: string; rail: string; title: string; when: string; who: string; example?: string }[] = [
    {
      icon: Mail, tint: 'bg-brand-50 text-brand-700', rail: 'bg-brand-400',
      title: 'Heads-up',
      when: cfg.initialTriggers.length === 0
        ? 'No advance notice — the first mail is the first reminder.'
        : `${plural(cfg.initialTriggers.length, 'mail')} before the due date (${[...cfg.initialTriggers].sort((a, b) => b - a).map(t => (t === 0 ? 'on the day' : `${t}d before`)).join(', ')}).`,
      who: 'The assignee (risk owner) only.',
      example: first('initial') ? `${first('initial').code} · ${fmtDate(first('initial').date)}` : undefined,
    },
    {
      icon: Flag, tint: 'bg-ink-100 text-ink-700', rail: 'bg-ink-400',
      title: 'Due date',
      when: 'The date agreed in the action plan. Everything after this is a chase.',
      who: 'Nothing is sent on its own — the clock starts here.',
      example: fmtDate(example.due),
    },
    {
      icon: BellRing, tint: 'bg-mitigated-50 text-mitigated-700', rail: 'bg-mitigated-400',
      title: 'Reminders',
      when: cfg.reminderDaily
        ? `Every ${cfg.weekdaysOnly ? 'weekday' : 'day'} after the due date, until the exception is handled.`
        : cfg.reminders.length === 0
          ? 'No reminders — an overdue item goes straight to escalation.'
          : `${plural(cfg.reminders.length, 'reminder')}: R1 at Due + ${cfg.reminders[0]}d${cfg.reminders.slice(1).map((r, i) => `, R${i + 2} at R${i + 1} + ${r}d`).join('')}.`,
      who: 'Still the assignee only — no one else is copied yet.',
      example: first('reminder') ? `${first('reminder').code} · ${fmtDate(first('reminder').date)}${last('reminder') && last('reminder') !== first('reminder') ? ` → ${last('reminder').code} · ${fmtDate(last('reminder').date)}` : ''}` : undefined,
    },
    {
      icon: TriangleAlert, tint: 'bg-risk-50 text-risk-700', rail: 'bg-risk-400',
      title: 'Escalations',
      when: cfg.escalations.length === 0
        ? 'No escalations configured.'
        : `${plural(cfg.escalations.length, 'rung')}: Esc-1 at last reminder + ${cfg.escalations[0].offsetDays}d${cfg.escalations.slice(1).map((e, i) => `, Esc-${i + 2} at Esc-${i + 1} + ${e.offsetDays}d`).join('')}.`,
      who: cfg.escalations.length === 0 ? '—' : `Each rung copies named people up the line — ${cfg.escalations.map((e, i) => `Esc-${i + 1}: ${ccNames(e.cc)}`).join(' · ')}.`,
      example: first('escalation') ? `${first('escalation').code} · ${fmtDate(first('escalation').date)}${last('escalation') && last('escalation') !== first('escalation') ? ` → ${last('escalation').code} · ${fmtDate(last('escalation').date)}` : ''}` : undefined,
    },
    {
      icon: RefreshCw, tint: 'bg-risk-50 text-risk-700', rail: 'bg-risk-500',
      title: 'Keeps chasing',
      when: cfg.recurring.enabled
        ? `After the last rung, a further escalation every ${cfg.recurring.everyDays}d — numbering continues (Esc-${cfg.escalations.length + 1}, Esc-${cfg.escalations.length + 2}…) until the status is updated.`
        : 'Off — the schedule ends at the last escalation rung.',
      who: cfg.recurring.enabled ? `Copies ${ccNames(cfg.recurring.cc)} every time.` : '—',
      example: first('recurring') ? `${first('recurring').code} · ${fmtDate(first('recurring').date)}, then every ${cfg.recurring.everyDays}d` : undefined,
    },
  ];

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[0.875rem] font-semibold text-ink-900">How the triggers work</h3>
          <p className="text-[0.75rem] text-ink-500 mt-0.5 max-w-[720px]">
            Every open exception is chased on its own clock, anchored on its due date. Mail moves left to right through five stages —
            gentle first, then copying people further up the line the longer it stays open. The numbers below are live from the
            <span className="font-semibold text-ink-700"> {severityLabel}</span> cadence you are editing.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2.5 h-7 text-[0.6875rem] font-semibold text-ink-600">
          <CalendarClock size={12} className="text-brand-700" aria-hidden="true" /> Example: due {fmtDate(example.due)}
        </span>
      </div>

      {/* The journey — five stage cards on a rail, with arrows between them. */}
      <ol className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {stages.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="relative flex flex-col rounded-lg border border-canvas-border bg-canvas-elevated p-3.5 min-h-[168px]">
              {i < stages.length - 1 && (
                <span className="hidden md:flex absolute -right-[13px] top-[30px] z-10 w-6 h-6 items-center justify-center rounded-full bg-canvas-elevated border border-canvas-border text-ink-400" aria-hidden="true">
                  <ArrowRight size={12} />
                </span>
              )}
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${s.tint}`}><Icon size={15} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Stage {i + 1}</div>
                  <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">{s.title}</div>
                </div>
              </div>
              <span className={`h-[3px] rounded-full mb-2.5 ${s.rail}`} aria-hidden="true" />
              <p className="text-[0.71875rem] text-ink-700 leading-snug">{s.when}</p>
              <p className="mt-1.5 text-[0.6875rem] text-ink-500 leading-snug flex items-start gap-1"><Users size={11} className="mt-[2px] shrink-0 text-ink-400" aria-hidden="true" /><span>{s.who}</span></p>
              {s.example && <p className="mt-auto pt-2.5 text-[0.6875rem] font-semibold text-brand-700 tabular-nums">{s.example}</p>}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-ink-500">
        <span className="inline-flex items-center gap-1.5"><CircleDot size={11} className="text-brand-600" aria-hidden="true" /> Each item's schedule stops the moment its status is updated.</span>
        {cfg.weekdaysOnly && <span className="inline-flex items-center gap-1.5"><CircleDot size={11} className="text-brand-600" aria-hidden="true" /> Weekend dates roll forward to Monday.</span>}
        <span className="inline-flex items-center gap-1.5"><CircleDot size={11} className="text-brand-600" aria-hidden="true" /> The schedule preview on the right lists every mail with its date.</span>
      </div>
    </div>
  );
}

/**
 * Admin → Escalation Matrix. The cadence is configured per observation severity
 * — Critical · High · Medium · Low — either one shared cadence for all four, or a
 * different one for each. A collapsible explainer shows how the triggers work
 * before the user configures anything.
 */
export default function EscalationMatrixAdmin({ value, onSave }: {
  value: EscalationMatrixSet;
  onSave: (next: EscalationMatrixSet) => void;
}) {
  const [draft, setDraft] = useState<EscalationMatrixSet>(() => JSON.parse(JSON.stringify(value)));
  const [severity, setSeverity] = useState<EscalationSeverity>('Critical');
  const [explainerOpen, setExplainerOpen] = useState(() => !readCollapsed());
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState<EscalationSeverity[] | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  const perSeverity = draft.mode === 'per-severity';
  const active = perSeverity ? draft.bySeverity[severity] : draft.all;
  const activeLabel = perSeverity ? severity : 'shared';

  const setActive = (next: EscalationMatrixConfig) => setDraft(d => perSeverity
    ? { ...d, bySeverity: { ...d.bySeverity, [severity]: next } }
    : { ...d, all: next });

  const toggleExplainer = () => { setExplainerOpen(o => { writeCollapsed(o); return !o; }); };

  // Copy the cadence being edited onto other severities (per-severity mode).
  const copyTo = (targets: EscalationSeverity[]) => {
    setDraft(d => {
      const src = JSON.parse(JSON.stringify(d.bySeverity[severity])) as EscalationMatrixConfig;
      const bySeverity = { ...d.bySeverity };
      targets.forEach(t => { bySeverity[t] = JSON.parse(JSON.stringify(src)); });
      return { ...d, bySeverity };
    });
    setCopied(targets); setCopyOpen(false);
    window.setTimeout(() => setCopied(null), 1800);
  };

  // Switching to per-severity for the first time seeds every severity from the
  // shared cadence's on/off state so nothing silently turns on.
  const setMode = (mode: EscalationMatrixSet['mode']) => setDraft(d => {
    if (mode === d.mode) return d;
    if (mode === 'per-severity') {
      const bySeverity = { ...d.bySeverity };
      ESCALATION_SEVERITIES.forEach(s => { bySeverity[s] = { ...bySeverity[s], enabled: d.all.enabled }; });
      return { ...d, mode, bySeverity };
    }
    return { ...d, mode };
  });

  const resetActive = () => setActive(perSeverity ? defaultMatrixForSeverity(severity, active.enabled) : cloneDefaultMatrixSet().all);

  return (
    <div className="flex flex-col h-full min-h-0 bg-canvas-elevated">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-6 pt-4 pb-3 border-b border-canvas-border">
        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><CalendarClock size={16} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Escalation Matrix</h2>
          <p className="text-[0.75rem] text-ink-500 leading-snug">The reminder &amp; escalation cadence that chases every open exception — set per observation severity.</p>
        </div>
        <button type="button" onClick={toggleExplainer} aria-expanded={explainerOpen} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer">
          {explainerOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {explainerOpen ? 'Hide how it works' : 'Show how it works'}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {explainerOpen && (
            <motion.div key="explainer" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
              <HowItWorks cfg={active} severityLabel={activeLabel} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode + severity selector */}
        <div className="rounded-lg border border-canvas-border bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.8125rem] font-semibold text-ink-900">Configure by severity</h3>
              <p className="text-[0.71875rem] text-ink-500 mt-0.5">One cadence can chase every observation, or each severity can run its own — Critical tighter, Low lighter.</p>
            </div>
            <div role="radiogroup" aria-label="Cadence mode" className="inline-flex rounded-md border border-canvas-border bg-canvas-elevated p-0.5">
              {([
                { id: 'same', label: 'Same for all severities', icon: Layers },
                { id: 'per-severity', label: 'Different per severity', icon: SlidersHorizontal },
              ] as const).map(m => {
                const on = draft.mode === m.id; const Icon = m.icon;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(m.id)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-[0.75rem] font-semibold transition-colors cursor-pointer ${on ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:text-ink-900 hover:bg-canvas'}`}>
                    <Icon size={13} aria-hidden="true" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity tabs — each shows its own on/off + recap so the whole
              matrix is readable at a glance. */}
          <div className="mt-3.5 grid grid-cols-2 lg:grid-cols-4 gap-2.5" role="tablist" aria-label="Severity">
            {ESCALATION_SEVERITIES.map(s => {
              const cfg = draft.bySeverity[s];
              const tone = SEVERITY_TONE[s];
              const on = perSeverity && severity === s;
              const shown = perSeverity ? cfg : draft.all;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  disabled={!perSeverity}
                  onClick={() => setSeverity(s)}
                  className={`text-left rounded-lg border p-3 transition-colors ${perSeverity ? 'cursor-pointer' : 'cursor-default'} ${on ? `${tone.ring} bg-canvas-elevated shadow-sm` : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'} ${!perSeverity ? 'opacity-90' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[0.6875rem] font-semibold ${tone.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />{s}</span>
                    <span className={`text-[0.625rem] font-semibold uppercase tracking-wide ${shown.enabled ? 'text-compliant-700' : 'text-ink-400'}`}>{shown.enabled ? 'On' : 'Off'}</span>
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-ink-500 leading-snug line-clamp-2">{perSeverity ? summarizeMatrix(cfg) : 'Follows the shared cadence'}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* The cadence editor for what is selected */}
        <div className="rounded-lg border border-canvas-border bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <h3 className="text-[0.8125rem] font-semibold text-ink-900">
                {perSeverity ? <>Cadence for <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[0.6875rem] font-semibold align-middle ${SEVERITY_TONE[severity].pill}`}><span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_TONE[severity].dot}`} aria-hidden="true" />{severity}</span> observations</> : 'Shared cadence — all severities'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {perSeverity && (
                <div className="relative">
                  <button type="button" onClick={() => setCopyOpen(o => !o)} aria-haspopup="menu" aria-expanded={copyOpen} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium border border-canvas-border bg-canvas-elevated text-ink-600 hover:border-brand-200 hover:text-brand-700 transition-colors cursor-pointer">
                    {copied ? <Check size={13} className="text-compliant-700" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copied ? `Copied to ${copied.join(', ')}` : 'Copy this cadence to…'}
                  </button>
                  {copyOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCopyOpen(false)} />
                      <div role="menu" className="absolute right-0 top-full mt-1.5 w-[240px] z-20 rounded-lg bg-canvas-elevated border border-canvas-border shadow-xl overflow-hidden py-1">
                        {ESCALATION_SEVERITIES.filter(s => s !== severity).map(s => (
                          <button key={s} type="button" role="menuitem" onClick={() => copyTo([s])} className="w-full flex items-center gap-2 px-3 h-8 text-[0.75rem] text-left text-ink-700 hover:bg-canvas cursor-pointer">
                            <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_TONE[s].dot}`} aria-hidden="true" /> {s}
                          </button>
                        ))}
                        <div className="my-1 border-t border-canvas-border" />
                        <button type="button" role="menuitem" onClick={() => copyTo(ESCALATION_SEVERITIES.filter(s => s !== severity))} className="w-full flex items-center gap-2 px-3 h-8 text-[0.75rem] text-left font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer">
                          <Layers size={13} aria-hidden="true" /> All other severities
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button type="button" onClick={resetActive} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer">
                <RotateCcw size={13} aria-hidden="true" /> Reset {perSeverity ? `${severity} preset` : 'to default'}
              </button>
            </div>
          </div>
          {/* The form owns its own scroll on the left and the preview on the right;
              give it a fixed working height inside this scrolling page. */}
          <div className="h-[640px] min-h-0">
            <EscalationCadenceEditor key={activeLabel} value={active} onChange={setActive} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 flex items-center gap-3 border-t border-canvas-border px-6 py-3">
        <p className="text-[0.75rem] text-ink-500">
          {perSeverity
            ? `Per severity · on for ${ESCALATION_SEVERITIES.filter(s => draft.bySeverity[s].enabled).join(', ') || 'none'}`
            : `Same for all severities · ${summarizeMatrix(draft.all)}`}
        </p>
        <div className="flex-1" />
        <Button variant="outline" size="md" disabled={!dirty} onClick={() => setDraft(JSON.parse(JSON.stringify(value)))}>Discard changes</Button>
        <Button variant="primary" size="md" disabled={!dirty} onClick={() => onSave(draft)}>Save escalation matrix</Button>
      </footer>
    </div>
  );
}
