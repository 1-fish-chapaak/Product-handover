import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, ClipboardCheck, Plus, X } from 'lucide-react';
import { SAMPLE_SIZES, type ChaseRow, type V2Control, type V2PeopleRow } from './v2Data';

/**
 * The V2-native testing bench — opened from a Ready-to-test chase row.
 *
 * TOD = walkthrough of one sample against the 5W1H attributes (the partner's
 * rule: a control whose description misses an essential attribute fails
 * design). TOE = the auto-selected samples, marked pass/exception, with the
 * call's ladder enforced: 1 exception in the base sample → pull another base
 * sample; 2 exceptions in total → the control fails and remediation stamps a
 * control effective date (the auditor samples the effective window only).
 */

// The six questions now live with the design-track types in the SOX/ICFR module,
// which is where they are also recorded and printed on the working paper. One
// definition, so this bench and that paper can never drift apart.
import { FIVE_W_1H } from '../../../sox-icfr/types';

export interface TestResult {
  tod: 'Pass' | 'Fail';
  toe?: 'Pass' | 'Fail';
  effectiveDate?: string;
  exceptions?: number;
  sampleSize?: number;
}

interface Props {
  control: V2Control;
  chase: ChaseRow;
  owner?: V2PeopleRow;
  defaultEffective: string;
  onClose: () => void;
  onConclude: (result: TestResult) => void;
}

export default function TestBench({ control, chase, owner, defaultEffective, onClose, onConclude }: Props) {
  const base = SAMPLE_SIZES[control.frequency];
  const todPrePassed = control.tod === 'Pass';

  // TOD state — attribute checks default to pass; failing any kills design.
  const [attrs, setAttrs] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FIVE_W_1H.map(a => [a.k, true])));
  const [todConcluded, setTodConcluded] = useState(todPrePassed);
  const attrsFailed = FIVE_W_1H.filter(a => !attrs[a.k]);

  // TOE state — sample chips; click marks an exception.
  const [sampleCount, setSampleCount] = useState(base);
  const [exceptions, setExceptions] = useState<Set<number>>(new Set());
  const extended = sampleCount > base;
  const exc = exceptions.size;
  // The ladder: 1 exception in the base sample forces a second pull; 2 → fail.
  const mustExtend = exc === 1 && !extended;
  const toeFails = exc >= 2;
  const [effectiveDate, setEffectiveDate] = useState(defaultEffective);

  const toggleException = (i: number) => {
    setExceptions(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const concludeDesign = () => {
    if (attrsFailed.length > 0) {
      onConclude({ tod: 'Fail' });
    } else {
      setTodConcluded(true);
    }
  };

  const concludeToe = () => {
    onConclude({
      tod: 'Pass',
      toe: toeFails ? 'Fail' : 'Pass',
      exceptions: exc,
      sampleSize: sampleCount,
      ...(toeFails ? { effectiveDate } : {}),
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}
          role="dialog" aria-modal="true" aria-label="Test bench"
          className="pointer-events-auto relative w-[760px] max-w-full max-h-full bg-canvas rounded-[1.25rem] border border-border-light shadow-[0_24px_64px_-16px_rgba(15,8,30,0.28)] overflow-y-auto p-6"
        >
          <button onClick={onClose} aria-label="Close" className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer">
            <X size={16} />
          </button>

          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Test bench</div>
          <h3 className="text-[17px] font-bold text-text leading-snug pr-8">{control.name}</h3>
          <div className="flex items-center gap-3 mt-1 mb-5 text-[11.5px] text-text-secondary flex-wrap">
            <span>{control.area}</span>
            <span className="text-border">·</span>
            <span>{control.frequency} → {base} sample{base === 1 ? '' : 's'}{chase.split ? ` (${chase.split})` : ''}</span>
            <span className="text-border">·</span>
            <span>evidence from {owner?.processOwner.split('—')[0].trim() ?? 'process owner'}</span>
            {chase.popFile && (<>
              <span className="text-border">·</span>
              <span className="font-mono text-[10.5px]">{chase.popFile}</span>
            </>)}
          </div>

          {/* ── TOD — 5W1H walkthrough ── */}
          <div className="border border-border-light rounded-xl bg-white p-4 mb-4">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Test of design — 5W1H walkthrough</div>
            {todConcluded && attrsFailed.length === 0 ? (
              <p className="text-[12px] text-compliant-700 flex items-center gap-1.5 mt-1.5">
                <Check size={13} /> Design passed — walkthrough of 1 sample, all six attributes present.
              </p>
            ) : (
              <>
                <p className="text-[11.5px] text-text-muted mb-3 leading-relaxed">
                  One sample, six attributes. A control whose description — or practice — misses an
                  essential attribute fails design, whatever the evidence says.
                </p>
                <div className="space-y-1">
                  {FIVE_W_1H.map(a => {
                    const ok = attrs[a.k];
                    return (
                      <div key={a.k} className="flex items-center gap-2.5 py-1">
                        <span className="w-12 text-[10.5px] font-bold uppercase tracking-wide text-brand-700 shrink-0">{a.k}</span>
                        <span className="text-[12px] text-text-secondary flex-1">{a.q}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setAttrs(prev => ({ ...prev, [a.k]: true }))}
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${ok ? 'bg-compliant-50 text-compliant-700' : 'bg-white border border-border text-text-muted hover:text-text'}`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => setAttrs(prev => ({ ...prev, [a.k]: false }))}
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer ${!ok ? 'bg-risk-50 text-risk-700' : 'bg-white border border-border text-text-muted hover:text-text'}`}
                          >
                            Missing
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {attrsFailed.length > 0 && (
                  <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-risk-50 text-risk-700">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <p className="text-[11.5px] leading-relaxed">
                      {attrsFailed.map(a => a.k).join(', ')} missing — the design fails. The control
                      goes to remediation; management fixes it and a fresh walkthrough retests it.
                    </p>
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={concludeDesign}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                      attrsFailed.length > 0 ? 'bg-risk-600 hover:bg-risk-700 text-white' : 'bg-primary hover:bg-primary-hover text-white'
                    }`}
                  >
                    <ClipboardCheck size={12} /> {attrsFailed.length > 0 ? 'Conclude — design fails' : 'Conclude design — pass'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── TOE — sample testing with the ladder enforced ── */}
          <div className={`border border-border-light rounded-xl bg-white p-4 ${todConcluded ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Test of effectiveness</div>
            <p className="text-[11.5px] text-text-muted mb-3 leading-relaxed">
              {sampleCount} sample{sampleCount === 1 ? '' : 's'} — click one to mark an exception.
              The ladder: 1 of {base} fails → pull another {base}; 2 in total → the control fails.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from({ length: sampleCount }, (_, i) => {
                const bad = exceptions.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleException(i)}
                    title={bad ? 'Marked as exception — click to clear' : 'Mark as exception'}
                    className={`px-2 h-6 rounded-md text-[10.5px] font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
                      bad ? 'bg-risk-600 text-white' : i >= base ? 'bg-evidence-50 text-evidence-700 hover:bg-evidence-100' : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                    }`}
                  >
                    S{String(i + 1).padStart(2, '0')}
                  </button>
                );
              })}
            </div>

            {mustExtend && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-mitigated-50 text-mitigated-700 mb-3 flex-wrap">
                <p className="text-[11.5px] leading-relaxed flex items-center gap-1.5">
                  <AlertTriangle size={13} /> 1 exception in {base} — a second sample of {base} is required before concluding.
                </p>
                <button
                  onClick={() => setSampleCount(base * 2)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-mitigated-200 text-mitigated-700 hover:bg-mitigated-50 transition-colors cursor-pointer"
                >
                  <Plus size={11} /> Pull {base} more
                </button>
              </div>
            )}
            {extended && exc === 1 && (
              <p className="text-[11.5px] text-compliant-700 mb-3">
                1 exception in {sampleCount} — accepted as a one-off; the control can conclude effective.
              </p>
            )}
            {toeFails && (
              <div className="p-2.5 rounded-lg bg-risk-50 text-risk-700 mb-3">
                <p className="text-[11.5px] leading-relaxed flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {exc} exceptions — the control fails effectiveness. Management remediates;
                  the fresh sample comes from the effective window only.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] font-semibold">Control effective from</span>
                  <input
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-32 px-2 py-1 text-[11.5px] tabular-nums border border-risk-200 rounded-md bg-white text-text outline-none focus:border-risk-400"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-text-muted tabular-nums">
                {exc} exception{exc === 1 ? '' : 's'} in {sampleCount}
              </span>
              <button
                onClick={concludeToe}
                disabled={mustExtend}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  toeFails ? 'bg-risk-600 hover:bg-risk-700 text-white' : 'bg-primary hover:bg-primary-hover text-white'
                }`}
              >
                <Check size={12} /> {toeFails ? 'Conclude — fails, remediate' : 'Conclude — effective'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
