import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, Send, ShieldCheck, ChevronRight, CheckCircle2,
  XCircle, AlertTriangle, Clock, User, X, BookText,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import Gated from '../shared/Gated';
import type { Engagement } from '../../data/engagements';
import { racmRowsForProcess, type RACMRow } from '../../data/racm';
import { CURRENT_USER, PEOPLE } from '../../data/grc-domain';

interface Props {
  engagement: Engagement;
}

type PaperConclusion = 'Effective' | 'Deficient' | 'Inconclusive' | 'Not yet tested';
type PaperStatus = 'Draft' | 'In Review' | 'Signed-off';

interface ControlPaper {
  row: RACMRow;
  scope: string;
  samplesSelected: number;
  samplesTested: number;
  exceptionsFound: number;
  testProcedure: string;
  results: string;
  conclusion: PaperConclusion;
  status: PaperStatus;
}

const CONCLUSION_CLS: Record<PaperConclusion, string> = {
  Effective:        'bg-compliant-50 text-compliant-700 border-compliant-100',
  Deficient:        'bg-risk-50 text-risk-700 border-risk-100',
  Inconclusive:     'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  'Not yet tested': 'bg-surface-2 text-text-muted border-border-light',
};

const STATUS_CLS: Record<PaperStatus, string> = {
  Draft:        'bg-draft-50 text-draft-700',
  'In Review':  'bg-evidence-50 text-evidence-700',
  'Signed-off': 'bg-compliant-50 text-compliant-700',
};

const CONCLUSION_ICON: Record<PaperConclusion, React.ElementType> = {
  Effective: CheckCircle2,
  Deficient: XCircle,
  Inconclusive: AlertTriangle,
  'Not yet tested': Clock,
};

/** Derive a stable working-paper from a RACM row using engagement.health.
 *  Demo-only — in production this would be authored data. */
function deriveControlPaper(row: RACMRow, engagement: Engagement, idx: number): ControlPaper {
  const health = engagement.health / 100;
  const baseTested = Math.random() > 0.5; // not needed — make deterministic
  // Deterministic seed from controlId
  const h = Array.from(row.controlId).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const sampled = 5 + (h % 20);                                      // 5–24 samples
  const tested = Math.min(sampled, Math.round(sampled * (health > 0 ? Math.min(1, health + 0.05) : 0)));
  const failureRate = 1 - health;
  const exceptions = Math.max(0, Math.round(tested * failureRate * 0.4));
  const conclusion: PaperConclusion =
    tested === 0 ? 'Not yet tested'
    : exceptions === 0 ? 'Effective'
    : exceptions > tested * 0.2 ? 'Deficient'
    : 'Inconclusive';
  const status: PaperStatus =
    engagement.status === 'Closed' ? 'Signed-off'
    : engagement.status === 'Review' ? 'In Review'
    : 'Draft';
  void idx; void baseTested;
  return {
    row,
    scope: `Test ${row.controlDescription.toLowerCase()} for the engagement period ${engagement.periodStart} – ${engagement.periodEnd}.`,
    samplesSelected: sampled,
    samplesTested: tested,
    exceptionsFound: exceptions,
    testProcedure: row.attributes.map(a => `• ${a.testProcedure}`).join('\n'),
    results: exceptions === 0
      ? `All ${tested} sample${tested === 1 ? '' : 's'} passed. Control operating as designed.`
      : `${exceptions} of ${tested} samples failed. Exceptions investigated and documented in case management.`,
    conclusion,
    status,
  };
}

export default function WorkingPaperTab({ engagement }: Props) {
  const { addToast } = useToast();
  const isIA = engagement.type === 'Internal Audit';
  const title = isIA ? 'Audit Report' : 'Working Paper';
  const titleShort = isIA ? 'Report' : 'Paper';

  const racmRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);
  const papers = useMemo(() => racmRows.map((r, i) => deriveControlPaper(r, engagement, i)), [racmRows, engagement]);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Summary stats
  const totals = useMemo(() => {
    const t = { effective: 0, deficient: 0, inconclusive: 0, notTested: 0, totalSamples: 0, totalExceptions: 0 };
    papers.forEach(p => {
      if (p.conclusion === 'Effective')        t.effective++;
      else if (p.conclusion === 'Deficient')   t.deficient++;
      else if (p.conclusion === 'Inconclusive') t.inconclusive++;
      else                                       t.notTested++;
      t.totalSamples    += p.samplesTested;
      t.totalExceptions += p.exceptionsFound;
    });
    return t;
  }, [papers]);

  const overallConclusion: PaperConclusion =
    totals.deficient > 0 ? 'Deficient'
    : totals.inconclusive > 0 ? 'Inconclusive'
    : totals.effective > 0 ? 'Effective'
    : 'Not yet tested';

  // Sign-off chain — derived from engagement.status
  const signOffChain = useMemo(() => {
    const preparer = PEOPLE.find(p => p.role === 'Auditor' || p.role === 'Manager') ?? PEOPLE[0];
    const reviewer = PEOPLE.find(p => p.role === 'Reviewer') ?? PEOPLE[7];
    const owner = PEOPLE.find(p => p.role === 'Manager') ?? PEOPLE[2];
    const closed = engagement.status === 'Closed';
    const inReview = engagement.status === 'Review' || closed;
    const prepDone = inReview || closed;
    return [
      { who: preparer, role: 'Preparer',         done: prepDone,        date: prepDone ? 'May 12, 2026' : null },
      { who: reviewer, role: 'Reviewer',         done: inReview,        date: inReview ? 'May 14, 2026' : null },
      { who: owner,    role: 'Engagement Owner', done: closed,          date: closed   ? 'May 15, 2026' : null },
    ];
  }, [engagement]);

  const allTested = totals.notTested === 0;
  const reviewSubmitted = engagement.status === 'Review' || engagement.status === 'Closed';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-[1.375rem] font-bold text-text leading-tight flex items-center gap-2">
            <BookText size={22} className="text-primary" />
            {title}
          </h2>
          <p className="text-[0.75rem] text-text-secondary mt-1">
            {isIA
              ? 'Final internal audit report — engagement summary, per-control working papers, sign-off chain.'
              : 'SOX testing deliverable — engagement summary, per-control working papers, sign-off chain.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <Download size={13} />
            Export as PDF
          </button>
          {!reviewSubmitted && (
            <Gated permission="eng_edit" mode="disable" title="You don't have permission to submit for review">
            <button
              onClick={() => addToast({ message: allTested ? 'Engagement submitted for review' : 'Cannot submit — some controls not tested', type: allTested ? 'success' : 'error' })}
              disabled={!allTested}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[0.75rem] font-semibold transition-colors ${
                allTested
                  ? 'bg-primary hover:bg-primary-hover text-white cursor-pointer'
                  : 'bg-surface-2 text-text-muted cursor-not-allowed'
              }`}
              title={!allTested ? `${totals.notTested} control${totals.notTested === 1 ? '' : 's'} not yet tested` : undefined}
            >
              <Send size={13} />
              Submit for review
            </button>
            </Gated>
          )}
          {reviewSubmitted && engagement.status !== 'Closed' && (
            <Gated permission="eng_close" mode="disable" title="You don't have permission to sign off">
            <button
              onClick={() => addToast({ message: 'Engagement signed off', type: 'success' })}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-compliant hover:bg-compliant-700 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
            >
              <ShieldCheck size={13} />
              Sign off
            </button>
            </Gated>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 mb-5">
          <div className="flex-1">
            <div className="text-[0.75rem] uppercase tracking-wider font-semibold text-text-muted mb-1">
              {titleShort} · {engagement.code}
            </div>
            <h3 className="font-display text-[1.25rem] font-bold text-text leading-snug">{engagement.name}</h3>
            <p className="text-[0.75rem] text-text-secondary mt-1.5">{engagement.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[0.75rem] uppercase tracking-wider font-semibold text-text-muted mb-1">Overall conclusion</div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[0.8125rem] font-bold border ${CONCLUSION_CLS[overallConclusion]}`}>
              {(() => { const Ic = CONCLUSION_ICON[overallConclusion]; return <Ic size={14} />; })()}
              {overallConclusion}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-3 text-[0.75rem]">
          <SumTile label="Scope" value={`${racmRows.length} controls`} />
          <SumTile label="Framework" value={engagement.framework} />
          <SumTile label="Period" value={`${engagement.periodStart} – ${engagement.periodEnd}`} />
          <SumTile label="Materiality" value="₹50K" />
        </dl>
        {/* Conclusion breakdown */}
        <div className="mt-5 grid grid-cols-4 gap-3 text-[0.75rem]">
          <BreakdownTile label="Effective"        value={totals.effective}    tone="text-compliant-700" />
          <BreakdownTile label="Deficient"        value={totals.deficient}    tone="text-risk-700" />
          <BreakdownTile label="Inconclusive"     value={totals.inconclusive} tone="text-mitigated-700" />
          <BreakdownTile label="Not yet tested"   value={totals.notTested}    tone="text-text-muted" />
        </div>
        <div className="mt-3 text-[0.75rem] text-text-secondary">
          {totals.totalSamples} samples tested · {totals.totalExceptions} exceptions captured · linked to case management
        </div>
      </div>

      {/* Per-control working papers */}
      <div className="space-y-2.5">
        <h3 className="text-[0.75rem] font-semibold text-text">
          Per-control {titleShort.toLowerCase()}s <span className="text-text-muted font-normal">({papers.length})</span>
        </h3>
        {papers.length === 0 ? (
          <div className="border border-border-light rounded-xl p-12 text-center bg-white">
            <FileText size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-text mb-1">No controls in scope</p>
            <p className="text-[0.75rem] text-text-muted">Upload a RACM or add controls in the Controls tab.</p>
          </div>
        ) : (
          papers.map(paper => {
            const isOpen = openIds.has(paper.row.controlId);
            const Ic = CONCLUSION_ICON[paper.conclusion];
            return (
              <div key={paper.row.controlId} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => toggle(paper.row.controlId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer text-left"
                >
                  <div className="p-2 rounded-lg bg-brand-50 shrink-0"><FileText size={14} className="text-brand-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[0.75rem] text-text-secondary">{paper.row.controlId}</span>
                      <span className="text-[0.8125rem] font-semibold text-text">{paper.row.controlDescription}</span>
                      {paper.row.isKey && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.5625rem] font-bold">K</span>}
                    </div>
                    <div className="text-[0.6875rem] text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{paper.row.subProcess}</span>
                      <span className="text-border">·</span>
                      <span>{paper.samplesTested} / {paper.samplesSelected} samples tested</span>
                      <span className="text-border">·</span>
                      <span className={paper.exceptionsFound > 0 ? 'text-risk-700 font-semibold' : ''}>
                        {paper.exceptionsFound} exception{paper.exceptionsFound === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-md text-[0.625rem] font-bold border ${CONCLUSION_CLS[paper.conclusion]} shrink-0`}>
                    <Ic size={10} />
                    {paper.conclusion}
                  </span>
                  <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center shrink-0 ${STATUS_CLS[paper.status]}`}>{paper.status}</span>
                  <ChevronRight size={14} className={`text-text-muted transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden border-t border-border-light"
                    >
                      <div className="px-4 py-4 space-y-4 bg-surface-2/20">
                        <Field label="Risk addressed">
                          <div className="text-[0.75rem] text-text"><span className="font-mono text-text-muted">{paper.row.riskId}</span> · {paper.row.riskDescription}</div>
                        </Field>
                        <Field label="Scope">
                          <div className="text-[0.75rem] text-text">{paper.scope}</div>
                        </Field>
                        <Field label="Test procedure">
                          <pre className="whitespace-pre-wrap font-sans text-[0.75rem] text-text-secondary leading-relaxed">{paper.testProcedure}</pre>
                        </Field>
                        <div className="grid grid-cols-3 gap-3">
                          <DataTile label="Samples selected" value={paper.samplesSelected} />
                          <DataTile label="Samples tested"   value={paper.samplesTested} />
                          <DataTile label="Exceptions"        value={paper.exceptionsFound} tone={paper.exceptionsFound > 0 ? 'text-risk-700' : 'text-compliant-700'} />
                        </div>
                        <Field label="Results">
                          <div className="text-[0.75rem] text-text-secondary">{paper.results}</div>
                        </Field>
                        <Field label="Conclusion">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-md text-[0.75rem] font-bold border ${CONCLUSION_CLS[paper.conclusion]}`}>
                              <Ic size={11} />
                              {paper.conclusion}
                            </span>
                            <span className="text-[0.75rem] text-text-muted">— recorded by {signOffChain[0].who.name}</span>
                          </div>
                        </Field>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Sign-off chain */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-4">Sign-off chain</h3>
        <div className="grid grid-cols-3 gap-4">
          {signOffChain.map((step, i) => (
            <div key={step.role} className="relative">
              <div className={`rounded-xl border p-4 transition-colors ${
                step.done
                  ? 'border-compliant/30 bg-compliant-50/30'
                  : 'border-border-light bg-white'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    step.done ? 'bg-compliant text-white' : 'bg-surface-2 text-text-muted'
                  }`}>
                    {step.done ? <CheckCircle2 size={14} /> : <span className="text-[0.75rem] font-bold">{i + 1}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">{step.role}</div>
                    <div className="text-[0.75rem] font-semibold text-text truncate">{step.who.name}</div>
                  </div>
                </div>
                <div className="text-[0.6875rem] text-text-muted">
                  {step.done ? (
                    <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-compliant-700" />Signed {step.date}</span>
                  ) : (
                    <span className="italic">Pending</span>
                  )}
                </div>
              </div>
              {i < signOffChain.length - 1 && (
                <div className="absolute top-1/2 -right-2 -translate-y-1/2 hidden md:flex items-center justify-center">
                  <ChevronRight size={14} className="text-text-muted" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 text-[0.75rem] text-text-muted">
          Current user · <span className="font-medium text-text-secondary">{CURRENT_USER.name}</span>
        </div>
      </div>

      {/* Export modal */}
      <AnimatePresence>
        {showExportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
              onClick={() => setShowExportModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] max-h-[80vh] z-50 bg-canvas-elevated rounded-2xl shadow-xl border border-canvas-border overflow-hidden flex flex-col"
            >
              <header className="shrink-0 px-6 py-4 border-b border-canvas-border flex items-center justify-between">
                <div>
                  <h2 className="text-[0.9375rem] font-bold text-text">Export {title} · Preview</h2>
                  <p className="text-[0.75rem] text-text-muted mt-0.5">Formatted output sent to your downloads folder.</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="w-8 h-8 rounded-full text-ink-500 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer">
                  <X size={16} />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
                <div className="font-display text-[1.25rem] font-bold text-text mb-1">{title} · {engagement.name}</div>
                <div className="text-[0.6875rem] text-text-muted mb-5">{engagement.code} · {engagement.framework} · {engagement.periodStart} – {engagement.periodEnd}</div>
                <h4 className="text-[0.75rem] font-bold text-text mt-4 mb-2 uppercase tracking-wide">1. Engagement summary</h4>
                <p className="text-[0.75rem] text-text-secondary mb-4">{engagement.description}</p>
                <h4 className="text-[0.75rem] font-bold text-text mb-2 uppercase tracking-wide">2. Overall conclusion</h4>
                <p className="text-[0.75rem] text-text-secondary mb-4">
                  <span className="font-semibold text-text">{overallConclusion}.</span> {totals.effective} of {papers.length} controls operating effectively. {totals.deficient} deficient. {totals.inconclusive} inconclusive. {totals.notTested} not yet tested.
                </p>
                <h4 className="text-[0.75rem] font-bold text-text mb-2 uppercase tracking-wide">3. Per-control conclusions</h4>
                <table className="w-full text-[0.75rem] border border-border-light mb-4">
                  <thead className="bg-surface-2/40">
                    <tr>
                      <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[0.75rem] uppercase tracking-wide text-text-muted">Control</th>
                      <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[0.75rem] uppercase tracking-wide text-text-muted">Tested</th>
                      <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[0.75rem] uppercase tracking-wide text-text-muted">Excs</th>
                      <th className="px-2 py-1.5 text-left text-[0.75rem] uppercase tracking-wide text-text-muted">Conclusion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map(p => (
                      <tr key={p.row.controlId} className="border-t border-border-light">
                        <td className="px-2 py-1.5 border-r border-border-light/60 font-mono text-text">{p.row.controlId}</td>
                        <td className="px-2 py-1.5 border-r border-border-light/60 tabular-nums">{p.samplesTested}/{p.samplesSelected}</td>
                        <td className="px-2 py-1.5 border-r border-border-light/60 tabular-nums">{p.exceptionsFound}</td>
                        <td className="px-2 py-1.5">{p.conclusion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h4 className="text-[0.75rem] font-bold text-text mb-2 uppercase tracking-wide">4. Sign-off</h4>
                {signOffChain.map(step => (
                  <div key={step.role} className="text-[0.75rem] text-text-secondary">
                    <span className="font-semibold">{step.role}:</span> {step.who.name} {step.done ? `(signed ${step.date})` : '(pending)'}
                  </div>
                ))}
              </div>
              <footer className="shrink-0 px-6 py-3 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    addToast({ message: `Generating ${engagement.code}-${titleShort}.pdf …`, type: 'success' });
                  }}
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Download PDF
                </button>
              </footer>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SumTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">{label}</div>
      <div className="text-[0.8125rem] font-bold text-text mt-1">{value}</div>
    </div>
  );
}

function BreakdownTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-white p-3">
      <div className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">{label}</div>
      <div className={`text-[1.125rem] font-bold tabular-nums leading-none mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function DataTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-white px-3 py-2">
      <div className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">{label}</div>
      <div className={`text-[1rem] font-bold tabular-nums leading-none mt-0.5 ${tone ?? 'text-text'}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <User size={10} className="text-text-muted" />
        <span className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}
