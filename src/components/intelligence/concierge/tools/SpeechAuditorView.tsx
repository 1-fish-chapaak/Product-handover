import { useState, type ReactNode } from 'react';
import {
  AudioLines, Mic, FileCheck2, FileText, Activity, Download, FileDown,
  CheckCircle2, XCircle, MinusCircle, Quote, TrendingUp,
  History, Search, ChevronDown, Trash2, FileAudio, FileVideo,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';
import ListPlaceholder from '../../../shared/ListPlaceholder';
import { Pill, type Tone } from '../../../shared/StatusBadge';
import { DateFilterPicker, dateInFilter, DEFAULT_DATE_FILTER, type DateFilter } from '../../../shared/DateFilterPicker';
import ConfirmationModal from '../../../shared/ConfirmationModal';
import { useAuditLog, type LogInput } from '../../../../context/AdminDataContext';

// ─── Result type ─────────────────────────────────────────────────────────────

type ControlStatus = 'Pass' | 'Fail' | 'Partial';
type RiskLevel = 'Low' | 'Medium' | 'High';
type SentimentLabel = 'Positive' | 'Neutral' | 'Negative';

interface ControlRow {
  control: string;
  status: ControlStatus;
  risk: RiskLevel;
}

interface Finding {
  observation: string;
  criteria: string;
  implication: string;
  recommendation: string;
}

interface Segment {
  timestamp: string;
  speaker: string;
  text: string;
  sentiment_label: SentimentLabel;
  sentiment_score: number; // -1..1
}

interface SpeechAuditResult {
  report: {
    executive_summary: string;
    controls_summary: ControlRow[];
    findings: Finding[];
    conclusion: string;
  };
  transcript: {
    overall_sentiment: number; // -1..1
    segments: Segment[];
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE: SpeechAuditResult = {
  report: {
    executive_summary:
      'This assessment reviews a recorded booking-verification call between a customer-service agent and a returning customer. The agent followed the opening script and resolved the request within target handle time, but two control breakdowns were observed: identity verification was completed using a single factor, and the mandatory call-recording disclosure was delivered late. Overall conduct was professional and customer sentiment trended positive after an early dip. Three findings are raised below, one of which carries high residual risk.',
    controls_summary: [
      { control: 'Caller identity verification', status: 'Partial', risk: 'High' },
      { control: 'Call-recording disclosure', status: 'Fail', risk: 'Medium' },
      { control: 'Mandatory script adherence', status: 'Pass', risk: 'Low' },
      { control: 'Data-handling & PII protection', status: 'Pass', risk: 'Low' },
      { control: 'Complaint / escalation handling', status: 'Partial', risk: 'Medium' },
      { control: 'Resolution & confirmation', status: 'Pass', risk: 'Low' },
    ],
    findings: [
      {
        observation:
          'The agent confirmed the caller’s identity using only the booking reference and did not request a second identifier (date of birth or registered email) before disclosing reservation details.',
        criteria:
          'Customer Authentication Policy CA-2.1 requires two independent identifiers before any account-specific information is shared.',
        implication:
          'Single-factor verification exposes the organisation to social-engineering and unauthorised-disclosure risk, with potential GDPR / data-protection consequences.',
        recommendation:
          'Reinforce two-factor caller verification in coaching and add a system prompt that blocks account look-up until a second identifier is captured.',
      },
      {
        observation:
          'The call-recording disclosure was read approximately 40 seconds into the call, after personal details had already been exchanged.',
        criteria:
          'Consent & Recording Standard CR-1.0 requires the recording notice to be given before any personal data is collected.',
        implication:
          'Late disclosure may invalidate recording consent and weakens the evidentiary value of the call.',
        recommendation:
          'Move the recording disclosure to the scripted greeting and validate placement during QA sampling.',
      },
      {
        observation:
          'When the customer raised a billing concern, the agent resolved it directly but did not log it as a complaint or offer the formal escalation path.',
        criteria:
          'Complaints Handling Procedure CH-3.4 requires every expression of dissatisfaction to be logged and the escalation route offered.',
        implication:
          'Unlogged complaints distort root-cause reporting and may breach regulatory complaint-handling obligations.',
        recommendation:
          'Add a soft system reminder to log dissatisfaction signals and refresh agents on complaint-classification criteria.',
      },
    ],
    conclusion:
      'The agent delivered a courteous, efficient interaction and met service-level expectations, but the call did not fully satisfy authentication and consent controls. The high-risk single-factor verification finding should be remediated as a priority, with the recording-disclosure and complaint-logging gaps addressed through coaching and a script update. Re-sampling is recommended after corrective actions are deployed.',
  },
  transcript: {
    overall_sentiment: 0.34,
    segments: [
      {
        timestamp: '00:00',
        speaker: 'Agent',
        text: 'Thank you for calling Irame Travel, my name is Priya. How can I help you today?',
        sentiment_label: 'Positive',
        sentiment_score: 0.55,
      },
      {
        timestamp: '00:18',
        speaker: 'Customer',
        text: 'Hi, I’ve been trying to change my booking online for an hour and it just keeps failing. It’s really frustrating.',
        sentiment_label: 'Negative',
        sentiment_score: -0.62,
      },
      {
        timestamp: '00:34',
        speaker: 'Agent',
        text: 'I’m sorry to hear that — I can definitely sort this out for you. Could I take your booking reference?',
        sentiment_label: 'Positive',
        sentiment_score: 0.4,
      },
      {
        timestamp: '00:52',
        speaker: 'Customer',
        text: 'Sure, it’s BR-4 4 2 9 1 8. The flight is for next Thursday.',
        sentiment_label: 'Neutral',
        sentiment_score: 0.05,
      },
      {
        timestamp: '01:15',
        speaker: 'Agent',
        text: 'Got it, thank you. I can see the reservation here. Just to confirm, please note this call is recorded for quality and training.',
        sentiment_label: 'Neutral',
        sentiment_score: 0.1,
      },
      {
        timestamp: '01:40',
        speaker: 'Customer',
        text: 'Okay. I’d also like to ask why I was charged a change fee last time — that didn’t seem right.',
        sentiment_label: 'Negative',
        sentiment_score: -0.35,
      },
      {
        timestamp: '02:10',
        speaker: 'Agent',
        text: 'Let me check that for you. I’ve moved your flight to Thursday at no charge, and I’ve waived the previous fee as a goodwill gesture.',
        sentiment_label: 'Positive',
        sentiment_score: 0.68,
      },
      {
        timestamp: '02:38',
        speaker: 'Customer',
        text: 'Oh, that’s great — thank you so much, that’s a real relief. You’ve been very helpful.',
        sentiment_label: 'Positive',
        sentiment_score: 0.82,
      },
    ],
  },
};

function buildResult(_files: PickedFile[], _options: Record<string, unknown>): SpeechAuditResult {
  return FIXTURE;
}

// ─── Export helpers (no libs) ────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTranscriptTxt(r: SpeechAuditResult) {
  const lines = r.transcript.segments.map(
    (s) => `[${s.timestamp}] ${s.speaker} (${s.sentiment_label}): ${s.text}`,
  );
  const header = `Speech Auditor — Call Transcript\nOverall sentiment: ${overallLabel(r.transcript.overall_sentiment)} (${r.transcript.overall_sentiment.toFixed(2)})\n\n`;
  downloadBlob(header + lines.join('\n\n') + '\n', 'transcript.txt', 'text/plain;charset=utf-8');
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportTranscriptCsv(r: SpeechAuditResult) {
  const rows = [
    ['Timestamp', 'Speaker', 'Sentiment', 'Score', 'Text'],
    ...r.transcript.segments.map((s) => [
      s.timestamp, s.speaker, s.sentiment_label, s.sentiment_score, s.text,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  downloadBlob('﻿' + csv, 'transcript.csv', 'text/csv;charset=utf-8');
}

// ─── Small presentation helpers ──────────────────────────────────────────────

function overallLabel(score: number): SentimentLabel {
  if (score > 0.2) return 'Positive';
  if (score < -0.2) return 'Negative';
  return 'Neutral';
}

const STATUS_STYLE: Record<ControlStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
  Pass: { cls: 'bg-compliant-50 text-compliant-700 border-compliant-700/20', Icon: CheckCircle2 },
  Fail: { cls: 'bg-risk-50 text-risk-700 border-risk-700/20', Icon: XCircle },
  Partial: { cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated-700/20', Icon: MinusCircle },
};

const RISK_TEXT: Record<RiskLevel, string> = {
  Low: 'text-compliant-700',
  Medium: 'text-mitigated-700',
  High: 'text-risk-700',
};

const RISK_DOT: Record<RiskLevel, string> = {
  Low: 'bg-compliant',
  Medium: 'bg-mitigated',
  High: 'bg-risk',
};

function StatusPill({ status }: { status: ControlStatus }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${cls}`}>
      <Icon size={11} /> {status}
    </span>
  );
}

const SENT_PILL: Record<SentimentLabel, string> = {
  Positive: 'bg-compliant-50 text-compliant-700',
  Neutral: 'bg-paper-100 text-ink-500',
  Negative: 'bg-risk-50 text-risk-700',
};

function SentimentPill({ label }: { label: SentimentLabel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold ${SENT_PILL[label]}`}>
      {label}
    </span>
  );
}

// ─── History helpers ─────────────────────────────────────────────────────────
// The history model stores no absolute time, but the live job id encodes the
// creation epoch (`job-<ms>-<seq>`), which we decode so each row reads like an
// audit record — exact timestamp, day grouping, and date filtering.

function jobEpoch(id: string): number | null {
  const m = id.match(/^job-(\d+)-/);
  return m ? Number(m[1]) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${mm} ${ampm}`;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const STATUS_PILL: Record<string, { label: string; tone: Tone }> = {
  COMPLETED: { label: 'Completed', tone: 'compliant' },
  IN_PROGRESS: { label: 'In progress', tone: 'evidence' },
  FAILED: { label: 'Failed', tone: 'risk' },
  CANCELLED: { label: 'Cancelled', tone: 'draft' },
};

// File glyph — audio by default, video for recorded video calls.
function fileGlyph(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov') return FileVideo;
  return FileAudio;
}

// ─── Result views ────────────────────────────────────────────────────────────

function ReportView({ report }: { report: SpeechAuditResult['report'] }) {
  const counts = report.controls_summary.reduce(
    (acc, c) => { acc[c.status] += 1; return acc; },
    { Pass: 0, Fail: 0, Partial: 0 } as Record<ControlStatus, number>,
  );
  return (
    <div className="space-y-6">
      {/* Executive summary */}
      <section className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-5">
        <h3 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">
          Executive summary
        </h3>
        <p className="text-[0.875rem] text-ink-700 leading-relaxed">{report.executive_summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 px-2.5 py-1 text-[0.75rem] font-semibold text-compliant-700">
            <CheckCircle2 size={12} /> {counts.Pass} passed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-mitigated-50 px-2.5 py-1 text-[0.75rem] font-semibold text-mitigated-700">
            <MinusCircle size={12} /> {counts.Partial} partial
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 px-2.5 py-1 text-[0.75rem] font-semibold text-risk-700">
            <XCircle size={12} /> {counts.Fail} failed
          </span>
        </div>
      </section>

      {/* Controls scorecard */}
      <section>
        <h3 className="text-[0.9375rem] font-semibold text-ink-900 mb-3">Controls scorecard</h3>
        <div className="rounded-[14px] border border-canvas-border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-paper-50/70">
              <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Control area</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Residual risk</th>
              </tr>
            </thead>
            <tbody>
              {report.controls_summary.map((c) => (
                <tr key={c.control} className="border-t border-canvas-border hover:bg-paper-50/40">
                  <td className="px-4 py-2.5 text-[0.8125rem] text-ink-800">{c.control}</td>
                  <td className="px-4 py-2.5"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold ${RISK_TEXT[c.risk]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[c.risk]}`} />
                      {c.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Findings */}
      <section>
        <h3 className="text-[0.9375rem] font-semibold text-ink-900 mb-3">
          Detailed findings <span className="text-ink-400 font-normal">({report.findings.length})</span>
        </h3>
        <div className="space-y-3">
          {report.findings.map((f, i) => (
            <div key={i} className="rounded-[14px] border border-canvas-border bg-canvas-elevated overflow-hidden">
              <div className="flex items-center gap-2 border-b border-canvas-border bg-paper-50/50 px-4 py-2.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 text-[0.6875rem] font-bold text-brand-700">
                  {i + 1}
                </span>
                <h4 className="text-[0.8125rem] font-semibold text-ink-800">Finding {i + 1}</h4>
              </div>
              <dl className="divide-y divide-canvas-border">
                {([
                  ['Observation', f.observation],
                  ['Audit criteria', f.criteria],
                  ['Risk / implication', f.implication],
                  ['Recommendation', f.recommendation],
                ] as const).map(([label, value]) => (
                  <div key={label} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-0.5 px-4 py-3">
                    <dt className="text-[0.75rem] font-semibold text-ink-500">{label}</dt>
                    <dd className="text-[0.8125rem] text-ink-700 leading-relaxed">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* Conclusion */}
      <section className="rounded-[14px] border border-brand-100 bg-brand-50/40 p-5">
        <h3 className="text-[0.75rem] font-semibold uppercase tracking-wide text-brand-700 mb-2">
          Auditor&apos;s conclusion
        </h3>
        <p className="text-[0.875rem] text-ink-700 leading-relaxed">{report.conclusion}</p>
      </section>
    </div>
  );
}

function TranscriptView({ transcript }: { transcript: SpeechAuditResult['transcript'] }) {
  return (
    <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated">
      <div className="flex items-center justify-between border-b border-canvas-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Quote size={15} className="text-ink-400" />
          <h3 className="text-[0.9375rem] font-semibold text-ink-900">Call transcript</h3>
        </div>
        <span className="text-[0.75rem] text-ink-500">
          Overall sentiment{' '}
          <span className="font-semibold text-ink-800">{overallLabel(transcript.overall_sentiment)}</span>
        </span>
      </div>
      <div className="divide-y divide-canvas-border">
        {transcript.segments.map((s, i) => (
          <div key={i} className="flex gap-3 px-5 py-3.5">
            <span className="w-12 shrink-0 pt-0.5 text-[0.6875rem] font-mono tabular-nums text-ink-400">
              {s.timestamp}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.8125rem] font-semibold text-ink-800">{s.speaker}</span>
                <SentimentPill label={s.sentiment_label} />
              </div>
              <p className="text-[0.875rem] text-ink-700 leading-relaxed">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentView({ transcript }: { transcript: SpeechAuditResult['transcript'] }) {
  const data = transcript.segments.map((s) => ({
    time: s.timestamp,
    score: s.sentiment_score,
    speaker: s.speaker,
    label: s.sentiment_label,
  }));
  const overall = overallLabel(transcript.overall_sentiment);
  const lowest = transcript.segments.reduce((m, s) => (s.sentiment_score < m.sentiment_score ? s : m));
  const highest = transcript.segments.reduce((m, s) => (s.sentiment_score > m.sentiment_score ? s : m));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Overall</p>
          <p className={`mt-1 text-[1.25rem] font-semibold ${SENT_PILL[overall].split(' ').find((c) => c.startsWith('text-')) ?? 'text-ink-900'}`}>
            {overall}
          </p>
          <p className="text-[0.75rem] text-ink-400 tabular-nums">score {transcript.overall_sentiment.toFixed(2)}</p>
        </div>
        <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Lowest point</p>
          <p className="mt-1 text-[0.875rem] font-semibold text-risk-700">{lowest.speaker} · {lowest.timestamp}</p>
          <p className="text-[0.75rem] text-ink-400 tabular-nums">score {lowest.sentiment_score.toFixed(2)}</p>
        </div>
        <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Highest point</p>
          <p className="mt-1 text-[0.875rem] font-semibold text-compliant-700">{highest.speaker} · {highest.timestamp}</p>
          <p className="text-[0.75rem] text-ink-400 tabular-nums">score {highest.sentiment_score.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-brand-600" />
          <h3 className="text-[0.9375rem] font-semibold text-ink-900">Sentiment over the call</h3>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 16, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDE7F4" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#9A8FAE' }}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tick={{ fontSize: 11, fill: '#9A8FAE' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#DCBBFD', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 shadow-lg">
                        <p className="text-[0.625rem] text-ink-400">{d.time}</p>
                        <p className="text-[0.75rem] font-semibold text-ink-800">{d.speaker}</p>
                        <p className="text-[0.75rem] text-ink-600">
                          {d.label} · <span className="tabular-nums">{d.score.toFixed(2)}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="#C2B9CB" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6A12CD"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#6A12CD', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, fill: '#6A12CD', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[0.75rem] text-ink-400">
          Scores range from −1 (negative) to +1 (positive). The early dip reflects the customer&apos;s
          opening frustration, recovering once the request was resolved.
        </p>
      </div>
    </div>
  );
}

// ─── renderResult: segmented toggle ──────────────────────────────────────────

type ResultView = 'report' | 'transcript' | 'sentiment';

const VIEW_TABS: { key: ResultView; label: string; Icon: typeof FileCheck2 }[] = [
  { key: 'report', label: 'Audit Report', Icon: FileCheck2 },
  { key: 'transcript', label: 'Transcript', Icon: FileText },
  { key: 'sentiment', label: 'Sentiment', Icon: Activity },
];

function ResultBody({ result }: { result: SpeechAuditResult }) {
  const [view, setView] = useState<ResultView>('report');
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-lg border border-canvas-border bg-canvas-elevated p-1">
        {VIEW_TABS.map(({ key, label, Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {view === 'report' && <ReportView report={result.report} />}
      {view === 'transcript' && <TranscriptView transcript={result.transcript} />}
      {view === 'sentiment' && <SentimentView transcript={result.transcript} />}
    </div>
  );
}

// ─── Stage / copy config ─────────────────────────────────────────────────────

const STAGES = [
  { id: 'upload', label: 'Upload' },
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'diarize', label: 'Diarize' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'report', label: 'Report' },
];

const MESSAGES = [
  'Securing and decoding the audio stream…',
  'Transcribing speech to text…',
  'Separating speakers and aligning turns…',
  'Scoring sentiment across the conversation…',
  'Testing the call against your control library…',
  'Drafting the audit report and findings…',
];

const CHECKING = [
  'Caller identity verification steps',
  'Mandatory disclosures and consent',
  'Script adherence and tone',
  'Complaint and escalation handling',
];

const TIPS = [
  'Speaker diarization labels who said what, so findings can be attributed to the agent or the customer.',
  'Sentiment is scored per turn from −1 to +1, which surfaces the moments a call went sideways.',
  'Clear, low-background-noise recordings produce noticeably more accurate transcripts.',
  'Findings map each observation to an audit criterion, an implication, and a concrete recommendation.',
];

const SEED_NOW = Date.now();
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const HISTORY_SEED: HistoryJob[] = [
  // Today
  { id: `job-${SEED_NOW - 9 * 60_000}-7`, files: ['escalation-call-live.mp3'], status: 'IN_PROGRESS', createdAt: '9m ago' },
  { id: `job-${SEED_NOW - 2 * HOUR}-6`, files: ['retention-call-0412.mp3'], status: 'COMPLETED', createdAt: '2h ago', meta: 'Positive · 2 findings' },
  { id: `job-${SEED_NOW - 5 * HOUR}-5`, files: ['billing-dispute-2271.m4a'], status: 'COMPLETED', createdAt: '5h ago', meta: 'Negative · 4 findings' },
  // Yesterday
  { id: `job-${SEED_NOW - 27 * HOUR}-4`, files: ['complaint-escalation.m4a'], status: 'COMPLETED', createdAt: 'Yesterday', meta: 'Negative · 4 findings' },
  { id: `job-${SEED_NOW - 31 * HOUR}-3`, files: ['onboarding-verify-118.wav'], status: 'FAILED', createdAt: 'Yesterday' },
  // Earlier
  { id: `job-${SEED_NOW - 3 * DAY}-2`, files: ['qa-sample-call.mp4'], status: 'COMPLETED', createdAt: '3d ago', meta: 'Positive · 3 findings' },
  { id: `job-${SEED_NOW - 6 * DAY}-1`, files: ['cancellation-call-994.ogg'], status: 'COMPLETED', createdAt: '6d ago', meta: 'Negative · 5 findings' },
];

// ─── extraControls: custom instructions ──────────────────────────────────────

function ExtraControls(
  options: Record<string, unknown>,
  set: (patch: Record<string, unknown>) => void,
): ReactNode {
  const value = (options.instructions as string) ?? '';
  return (
    <div className="mt-4">
      <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink-700">
        Custom instructions <span className="font-normal text-ink-400">(optional)</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => set({ instructions: e.target.value })}
        rows={3}
        placeholder="e.g. Focus on PCI-DSS disclosures and flag any sharing of card details over the phone."
        className="w-full resize-y rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <p className="mt-1 text-[0.6875rem] text-ink-400">
        Steer the audit toward specific controls, regulations, or risk areas.
      </p>
    </div>
  );
}

// ─── Result actions: exports ─────────────────────────────────────────────────

function ResultActions(result: SpeechAuditResult, logEvent?: (e: LogInput) => void): ReactNode {
  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[0.8125rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer';
  return (
    <>
      <button
        onClick={() => {
          exportTranscriptTxt(result);
          logEvent?.({
            action: 'Export',
            description: 'Exported Speech Auditor transcript as TXT',
            module: 'AI Concierge',
            entity: 'Speech Auditor',
          });
        }}
        className={btn}
      >
        <Download size={14} /> Transcript (.txt)
      </button>
      <button
        onClick={() => {
          exportTranscriptCsv(result);
          logEvent?.({
            action: 'Export',
            description: 'Exported Speech Auditor transcript as CSV',
            module: 'AI Concierge',
            entity: 'Speech Auditor',
          });
        }}
        className={btn}
      >
        <FileDown size={14} /> Export CSV
      </button>
    </>
  );
}

// ─── Generation history — drawer-friendly stacked list (mirrors RACM) ─────────
// Replaces the shared JobHistory table for the Speech Auditor side sheet (via
// renderHistory). Search + date filter + Today/Earlier collapsible groups; each
// row is a file glyph + name, exact timestamp + sentiment·findings note, status
// pill, whole row opens the result, delete-with-confirm on the right.

function SpeechHistoryList({ jobs, onOpen, onDelete }: {
  jobs: HistoryJob[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <ListPlaceholder
        icon={History}
        title="No audits yet"
        body="Your audited calls will appear here — open one to revisit the report."
      />
    );
  }

  const nowDate = new Date();
  const today0 = startOfDay(nowDate.getTime());
  const q = search.trim().toLowerCase();

  // Newest first, then filter by the date range and the search term (which
  // matches the file name, the status, or the sentiment·findings note).
  const visible = [...jobs]
    .sort((a, b) => (jobEpoch(b.id) ?? 0) - (jobEpoch(a.id) ?? 0))
    .filter((j) => {
      const ep = jobEpoch(j.id);
      const iso = (ep == null ? nowDate : new Date(ep)).toISOString();
      if (!dateInFilter(iso, dateFilter, nowDate)) return false;
      if (!q) return true;
      const hay = [...j.files, j.meta ?? '', STATUS_PILL[j.status]?.label ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });

  // Two buckets only: anything created today vs. everything older.
  const groups: { key: 'Today' | 'Earlier'; jobs: HistoryJob[] }[] = [
    { key: 'Today', jobs: [] }, { key: 'Earlier', jobs: [] },
  ];
  for (const j of visible) {
    const ep = jobEpoch(j.id);
    const isToday = ep != null && startOfDay(ep) === today0;
    groups.find((g) => g.key === (isToday ? 'Today' : 'Earlier'))!.jobs.push(j);
  }

  const deletingJob = jobs.find((j) => j.id === confirmDeleteId);
  const deletingName = deletingJob ? (deletingJob.files[0] ?? 'this audit') : '';

  return (
    <>
    <div>
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by file, status…"
            aria-label="Search audits"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
          />
        </div>
        <DateFilterPicker
          filter={dateFilter}
          open={dateOpen}
          onToggle={() => setDateOpen((p) => !p)}
          onClose={() => setDateOpen(false)}
          onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
          today={nowDate}
          rangeStacked
        />
      </div>

      {visible.length === 0 ? (
        <ListPlaceholder
          icon={Search}
          title="No matches"
          body="No audits match your search or date range."
        />
      ) : (
        <div className="space-y-6">
          {groups.filter((g) => g.jobs.length > 0).map((group) => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                  aria-expanded={!isCollapsed}
                  className="group/sec w-full flex items-center justify-between gap-3 mb-2.5 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400">
                    {group.key}<span className="ml-1.5 font-mono tabular-nums text-ink-300">{group.jobs.length}</span>
                  </h3>
                  <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform group-hover/sec:text-ink-600 ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {group.jobs.map((j) => {
                      const Glyph = fileGlyph(j.files[0] ?? '');
                      const ep = jobEpoch(j.id);
                      const when = ep == null ? j.createdAt : formatDateTime(ep);
                      const completed = j.status === 'COMPLETED';
                      const status = STATUS_PILL[j.status] ?? STATUS_PILL.COMPLETED;
                      const name = j.files[0] ?? '—';
                      return (
                        <div
                          key={j.id}
                          onClick={completed ? () => onOpen(j.id) : undefined}
                          role={completed ? 'button' : undefined}
                          tabIndex={completed ? 0 : undefined}
                          onKeyDown={completed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(j.id); } } : undefined}
                          className={`group flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3 transition-colors ${completed ? 'cursor-pointer hover:border-brand-200 hover:bg-brand-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30' : ''}`}
                        >
                          <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 bg-brand-50">
                            <Glyph size={15} className="text-brand-600" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.84375rem] text-ink-800 truncate">{name}</p>
                            <p className="text-[0.6875rem] text-ink-400 mt-0.5">
                              <span className="font-mono tabular-nums">{when}</span>
                              {j.meta && <span> · {j.meta}</span>}
                            </p>
                          </div>
                          <Pill tone={status.tone}>{status.label}</Pill>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(j.id); }}
                            aria-label={`Delete ${name}`}
                            title="Delete audit"
                            className="shrink-0 p-1 rounded-md text-ink-300 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    <ConfirmationModal
      open={confirmDeleteId !== null}
      title="Delete this audit?"
      description={<>This permanently removes <span className="font-semibold text-ink-700">{deletingName}</span> from your history. This can't be undone.</>}
      confirmLabel="Delete"
      tone="destructive"
      onConfirm={() => { if (confirmDeleteId) onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
      onClose={() => setConfirmDeleteId(null)}
    />
    </>
  );
}

// ─── View ────────────────────────────────────────────────────────────────────

export default function SpeechAuditorView({ onBack }: { onBack: () => void }) {
  const logEvent = useAuditLog();
  return (
    <ConciergeFlow<SpeechAuditResult>
      title="Speech Auditor"
      subtitle="Transcribe a call recording, separate speakers, score sentiment, and audit it against your controls — with a findings report you can export."
      icon={Mic}
      onBack={onBack}
      accept="audio/*,video/mp4,video/webm"
      multiple={false}
      maxSizeMb={300}
      uploadHint="Audio (mp3, wav, m4a, ogg, flac, aac) or video (mp4, webm) — up to 300 MB"
      uploadCtaLabel="Run audit"
      stages={STAGES}
      messages={MESSAGES}
      totalMs={9000}
      checking={CHECKING}
      tips={TIPS}
      buildResult={buildResult}
      renderResult={(result) => <ResultBody result={result} />}
      resultActions={(result) => ResultActions(result, logEvent)}
      historyMeta={(r) =>
        `${overallLabel(r.transcript.overall_sentiment)} · ${r.report.findings.length} finding${r.report.findings.length === 1 ? '' : 's'}`
      }
      extraControls={ExtraControls}
      canRun={(files) => files.length > 0}
      historySeed={HISTORY_SEED}
      historyAsDrawer
      renderHistory={(api) => <SpeechHistoryList {...api} />}
    />
  );
}
