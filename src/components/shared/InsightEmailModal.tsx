// ─── Insight email — share an AI insight with someone outside the room ─────
//
// Journey (value-first, connection-gated-at-send):
//   1. The Mail action on any full insight card opens this modal ALREADY
//      COMPOSED — recipients, subject, and a derived body preview — so the
//      user sees exactly what will leave the workspace before any setup.
//   2. The AI summary is read-only (recipients see it marked as AI-generated);
//      the sender's voice goes in a separate personal note on top. Editing the
//      engine's words would launder them into the sender's.
//   3. First send is gated on connecting an emailer: the footer CTA swaps to
//      "Connect email to send", an inline provider step authorizes (mock) and
//      persists, and the CTA becomes "Send insight". Every later send is two
//      clicks. "Open in your mail app" (mailto:) is the zero-setup fallback.
//   4. Send → receipt + toast + an audit-trail Share entry, so sharing an
//      AI conclusion is as traceable as changing a control.

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, X, AtSign, User, Check, Loader2, ChevronDown, ShieldCheck, Sparkles,
} from 'lucide-react';
import type { LayeredInsight } from '../../data/layeredInsights';
import { useToast } from './Toast';
import { useAuditLog } from '../../context/AdminDataContext';

// ─── Emailer connection (mock OAuth, persisted per browser) ────────────────

const CONNECTOR_KEY = 'ira-email-connector';
const WORKSPACE_USER = 'samarth.chauhan@irame.ai';

type Connector = { provider: string; address: string };

function loadConnector(): Connector | null {
  try {
    const raw = localStorage.getItem(CONNECTOR_KEY);
    return raw ? (JSON.parse(raw) as Connector) : null;
  } catch { return null; }
}

const PROVIDERS = [
  { id: 'google', name: 'Google Workspace', mark: 'G', markCls: 'bg-risk-50 text-risk' },
  { id: 'microsoft', name: 'Microsoft 365', mark: 'M', markCls: 'bg-evidence-50 text-evidence-700' },
  { id: 'smtp', name: 'Other (SMTP)', mark: '@', markCls: 'bg-paper-100 text-ink-600' },
];

// Mock directory — suggestion chips for the To field.
const SUGGESTED = [
  { name: 'Priya Singh', role: 'Engagement owner', email: 'priya.singh@acme.com' },
  { name: 'Karan Mehta', role: 'Reviewer', email: 'karan.mehta@acme.com' },
  { name: 'Sneha Desai', role: 'Control owner', email: 'sneha.desai@acme.com' },
];

// ─── Email framing ─────────────────────────────────────────────────────────

const SEV_LABEL: Record<LayeredInsight['severity'], string> = { high: 'High', med: 'Medium', low: 'Low' };

function insightEmailSubject(insight: LayeredInsight): string {
  return `IRA insight · ${SEV_LABEL[insight.severity]}: ${insight.takeaway}`;
}

function insightEmailBody(insight: LayeredInsight, scopeLabel: string, note?: string): string {
  const found = insight.observations?.length ? insight.observations : [insight.reasoning, insight.atStake].filter(Boolean);
  const stakes = insight.stakes?.length ? insight.stakes : [insight.atStake].filter(Boolean);
  const recs = insight.recommendations?.length
    ? insight.recommendations.map(r => r.title)
    : insight.recommendedActions;
  const signed = insight.verdict.tone === 'positive' ? ' · Signed pass' : '';
  const lines: string[] = [];
  if (note?.trim()) lines.push(note.trim(), '');
  lines.push(
    insight.takeaway,
    '',
    `AI insight from the Insight Memory Engine, anchored at ${scopeLabel}: ${insight.subjectLabel}.`,
    `Severity ${SEV_LABEL[insight.severity]}${signed} · verdict: ${insight.verdict.label}.`,
    '',
    'WHAT WE FOUND',
    ...found.map(o => `• ${o}`),
    '',
    'ROOT CAUSE',
    `• ${insight.likelyCause.label} — ${insight.likelyCause.detail}`,
    '',
    "WHAT'S AT STAKE",
    ...stakes.map(s => `• ${s}`),
  );
  if (recs.length > 0) {
    lines.push('', `RECOMMENDED ACTIONS (${recs.length})`, ...recs.map((r, i) => `${i + 1}. ${r}`));
  }
  lines.push(
    '',
    `Evidence: ${insight.evidence.length} item${insight.evidence.length === 1 ? '' : 's'} in the workspace — open the insight to drill in.`,
    '',
    '——',
    'Sent from IRA · AI-generated summary, heuristic-first and human-gated. The sender signed off on sharing this, not on the findings — review before acting.',
  );
  return lines.join('\n');
}

// ─── The modal ─────────────────────────────────────────────────────────────

export default function InsightEmailModal({ insight, scopeLabel, open, onClose }: {
  insight: LayeredInsight;
  /** The anchor noun for the provenance line, e.g. "this control" / "this workflow". */
  scopeLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  // The composer mounts fresh per open, so every draft starts clean — no
  // stale-state resets, no effects.
  return (
    <AnimatePresence>
      {open && <EmailComposer insight={insight} scopeLabel={scopeLabel} onClose={onClose} />}
    </AnimatePresence>
  );
}

function EmailComposer({ insight, scopeLabel, onClose }: {
  insight: LayeredInsight;
  scopeLabel: string;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const [connector, setConnector] = useState<Connector | null>(() => loadConnector());
  const [connectStep, setConnectStep] = useState<'closed' | 'choose' | 'authorizing'>('closed');
  const [authProvider, setAuthProvider] = useState<string>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [subject, setSubject] = useState(() => insightEmailSubject(insight));
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'compose' | 'sending' | 'sent'>('compose');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = useMemo(() => insightEmailBody(insight, scopeLabel, note), [insight, scopeLabel, note]);

  const addRecipient = (email: string) => {
    const v = email.trim().replace(/,$/, '');
    if (!v) return;
    setRecipients(prev => (prev.includes(v) ? prev : [...prev, v]));
    setToInput('');
  };

  const connect = (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId)!;
    setAuthProvider(provider.name);
    setConnectStep('authorizing');
    window.setTimeout(() => {
      const c = { provider: provider.name, address: WORKSPACE_USER };
      localStorage.setItem(CONNECTOR_KEY, JSON.stringify(c));
      setConnector(c);
      setConnectStep('closed');
      addToast({ type: 'success', message: `Email connected — sending as ${c.address}` });
    }, 1400);
  };

  const send = () => {
    setPhase('sending');
    window.setTimeout(() => {
      setPhase('sent');
      addToast({ type: 'success', message: `Insight emailed to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}` });
      logEvent({
        action: 'Share',
        description: `Emailed AI insight "${insight.takeaway}" (${insight.subjectLabel}) to ${recipients.join(', ')}`,
        module: 'Insights',
        entity: 'Insight',
      });
    }, 900);
  };

  const mailtoHref = `mailto:${encodeURIComponent(recipients.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const canSend = recipients.length > 0 && phase === 'compose';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog" aria-label="Email this insight"
    >
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="relative glass-card-strong rounded-2xl shadow-2xl w-[620px] max-w-full max-h-[86vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-light flex items-center gap-2.5 shrink-0">
              <div className="p-2 bg-brand-50 text-brand-700 rounded-xl"><Mail size={15} aria-hidden="true" /></div>
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-text">Email this insight</h3>
                <p className="text-[0.71875rem] text-text-muted truncate">{insight.subjectLabel}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer">
                <X size={15} className="text-text-muted" />
              </button>
            </div>

            {phase === 'sent' ? (
              /* ── Receipt ── */
              <div className="px-6 py-10 flex flex-col items-center text-center">
                <span className="size-10 rounded-full bg-compliant-50 text-compliant-700 flex items-center justify-center mb-3">
                  <Check size={18} aria-hidden="true" />
                </span>
                <p className="text-[0.875rem] font-semibold text-text">Sent to {recipients.length} recipient{recipients.length === 1 ? '' : 's'}.</p>
                <p className="text-[0.75rem] text-text-muted mt-1 max-w-[380px]">{recipients.join(' · ')}</p>
                <p className="text-[0.6875rem] text-text-muted mt-3">A Share entry was written to the action trail.</p>
                <button onClick={onClose} className="mt-5 px-4 h-9 bg-primary text-white rounded-lg text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* ── Compose ── */}
                <div className="flex-1 overflow-y-auto">
                  {/* To */}
                  <div className="px-5 pt-4 pb-3 border-b border-border-light">
                    <div className="flex items-start gap-2">
                      <User size={12} className="text-text-muted shrink-0 mt-2" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[0.75rem] text-text-muted">To:</span>
                          {recipients.map(r => (
                            <span key={r} className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 pl-2 pr-1 h-6 text-[0.71875rem] font-medium">
                              {r}
                              <button onClick={() => setRecipients(prev => prev.filter(x => x !== r))} aria-label={`Remove ${r}`} className="p-0.5 rounded-full hover:bg-brand-100 cursor-pointer"><X size={10} /></button>
                            </span>
                          ))}
                          <input
                            value={toInput}
                            onChange={e => setToInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addRecipient(toInput); } }}
                            onBlur={() => addRecipient(toInput)}
                            placeholder={recipients.length === 0 ? 'name@company.com' : 'Add another…'}
                            className="flex-1 min-w-[140px] h-7 text-[0.75rem] text-text bg-transparent outline-none placeholder:text-text-muted/60"
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {SUGGESTED.filter(s => !recipients.includes(s.email)).map(s => (
                            <button
                              key={s.email} onClick={() => addRecipient(s.email)}
                              title={s.email}
                              className="inline-flex items-center gap-1 rounded-full border border-border-light bg-white px-2 h-6 text-[0.65625rem] font-medium text-text-secondary hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                            >
                              + {s.name} <span className="text-text-muted">· {s.role}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="px-5 py-2.5 border-b border-border-light flex items-center gap-2">
                    <Mail size={12} className="text-text-muted shrink-0" aria-hidden="true" />
                    <span className="text-[0.75rem] text-text-muted shrink-0">Subject:</span>
                    <input
                      value={subject} onChange={e => setSubject(e.target.value)}
                      className="flex-1 min-w-0 h-7 text-[0.75rem] font-semibold text-text bg-transparent outline-none"
                      aria-label="Email subject"
                    />
                  </div>

                  {/* Personal note — the sender's voice, kept apart from the AI summary. */}
                  <div className="px-5 py-3 border-b border-border-light">
                    <textarea
                      value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Add a note (optional) — it appears above the AI summary."
                      rows={2}
                      className="w-full text-[0.75rem] text-text bg-white border border-border-light rounded-lg px-3 py-2 outline-none focus:border-primary/40 resize-none placeholder:text-text-muted/60"
                    />
                  </div>

                  {/* Derived body — read-only, marked as AI-generated. */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles size={11} className="text-brand-600" aria-hidden="true" />
                      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-text-muted">AI summary · sent as written</span>
                    </div>
                    <pre className="text-[0.75rem] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans rounded-lg border border-border-light bg-surface-1/60 px-4 py-3 max-h-[240px] overflow-y-auto">
                      {body}
                    </pre>
                  </div>
                </div>

                {/* ── Footer: connect state + send ── */}
                <div className="border-t border-border-light shrink-0">
                  <AnimatePresence initial={false}>
                    {connectStep !== 'closed' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-b border-border-light"
                      >
                        {connectStep === 'choose' ? (
                          <div className="px-5 py-3">
                            <p className="text-[0.71875rem] text-text-muted mb-2">Connect the account IRA sends from. One-time — this stays connected for future sends.</p>
                            <div className="grid grid-cols-3 gap-2">
                              {PROVIDERS.map(p => (
                                <button
                                  key={p.id} onClick={() => connect(p.id)}
                                  className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-2.5 py-2 text-left hover:border-primary/40 hover:bg-primary-xlight/30 transition-colors cursor-pointer"
                                >
                                  <span className={`size-6 rounded-md flex items-center justify-center text-[0.71875rem] font-bold shrink-0 ${p.markCls}`}>{p.mark}</span>
                                  <span className="text-[0.71875rem] font-semibold text-text leading-tight">{p.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="px-5 py-4 flex items-center gap-2.5">
                            <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" aria-hidden="true" />
                            <span className="text-[0.75rem] text-text">Authorizing with {authProvider}… approve the request in the pop-up.</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="px-5 py-3.5 flex items-center gap-3">
                    {connector ? (
                      <span className="inline-flex items-center gap-1.5 text-[0.65625rem] text-text-muted min-w-0">
                        <AtSign size={10} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">Sending as {connector.address}</span>
                        <button
                          onClick={() => { localStorage.removeItem(CONNECTOR_KEY); setConnector(null); }}
                          className="font-semibold text-text-secondary hover:text-primary cursor-pointer shrink-0"
                        >
                          Change
                        </button>
                      </span>
                    ) : (
                      <a href={mailtoHref} onClick={onClose} className="text-[0.65625rem] font-medium text-text-secondary hover:text-primary cursor-pointer">
                        Open in your mail app instead
                      </a>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {connector && (
                        <a href={mailtoHref} onClick={onClose} title="Compose this in your own mail client instead" className="text-[0.65625rem] font-medium text-text-muted hover:text-primary cursor-pointer">
                          Use mail app
                        </a>
                      )}
                      {connector ? (
                        <button
                          onClick={send} disabled={!canSend}
                          className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[0.75rem] font-semibold transition-colors ${
                            canSend ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer' : 'bg-surface-2 text-text-muted cursor-not-allowed'
                          }`}
                          title={recipients.length === 0 ? 'Add at least one recipient' : undefined}
                        >
                          {phase === 'sending' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Mail size={13} aria-hidden="true" />}
                          {phase === 'sending' ? 'Sending…' : 'Send insight'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConnectStep(s => (s === 'closed' ? 'choose' : 'closed'))}
                          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-white text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                          aria-expanded={connectStep !== 'closed'}
                        >
                          <ShieldCheck size={13} aria-hidden="true" /> Connect email to send
                          <ChevronDown size={12} className={`transition-transform ${connectStep !== 'closed' ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
        )}
      </motion.div>
    </motion.div>
  );
}
