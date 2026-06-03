/**
 * Editorial GRC pills — flat, no border, no icon.
 * Severity labels are always spelled out (Critical / High / Medium / Low).
 */

type Tone = 'risk' | 'high' | 'mitigated' | 'compliant' | 'evidence' | 'info' | 'draft';

const TONE_CLASS: Record<Tone, string> = {
  risk:      'bg-risk-50 text-risk-700',
  high:      'bg-high-50 text-high-700',
  mitigated: 'bg-mitigated-50 text-mitigated-700',
  compliant: 'bg-compliant-50 text-compliant-700',
  evidence:  'bg-evidence-50 text-evidence-700',
  info:      'bg-brand-50 text-brand-700',
  draft:     'bg-draft-50 text-draft-700',
};

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] leading-[16px] font-medium whitespace-nowrap tabular-nums ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, { tone: Tone; label: string }> = {
  active:         { tone: 'compliant', label: 'Active' },
  draft:          { tone: 'draft',     label: 'Draft' },
  complete:       { tone: 'evidence',  label: 'Complete' },
  processed:      { tone: 'compliant', label: 'Processed' },
  open:           { tone: 'risk',      label: 'Open' },
  'in-progress':  { tone: 'evidence',  label: 'In Progress' },
  resolved:       { tone: 'compliant', label: 'Resolved' },
  mitigated:      { tone: 'compliant', label: 'Mitigated' },
  connected:      { tone: 'compliant', label: 'Connected' },
  disconnected:   { tone: 'risk',      label: 'Disconnected' },
  effective:      { tone: 'compliant', label: 'Effective' },
  ineffective:    { tone: 'risk',      label: 'Ineffective' },
  'not-tested':   { tone: 'draft',     label: 'Not Tested' },
  'not-started':  { tone: 'draft',     label: 'Not Started' },
  final:          { tone: 'compliant', label: 'Final' },
  invited:        { tone: 'info',      label: 'Invited' },
  suspended:      { tone: 'high',      label: 'Suspended' },
  locked:         { tone: 'risk',      label: 'Locked' },
  inactive:       { tone: 'draft',     label: 'Inactive' },
  pending:        { tone: 'mitigated', label: 'Pending' },
  expired:        { tone: 'high',      label: 'Expired' },
  blocked:        { tone: 'risk',      label: 'Blocked' },
};

const SEVERITY_TONE: Record<string, { tone: Tone; label: string }> = {
  critical: { tone: 'risk',      label: 'Critical' },
  high:     { tone: 'high',      label: 'High' },
  medium:   { tone: 'mitigated', label: 'Medium' },
  low:      { tone: 'compliant', label: 'Low' },
  MW:       { tone: 'risk',      label: 'Material Weakness' },
  SD:       { tone: 'high',      label: 'Significant Deficiency' },
  CD:       { tone: 'evidence',  label: 'Control Deficiency' },
};

const FW_TONE: Record<string, Tone> = {
  SOX:           'evidence',
  ITGC:          'compliant',
  Internal:      'info',
  'Key Control': 'high',
  IFC:           'info',
};

const TYPE_TONE: Record<string, Tone> = {
  Detection:      'risk',
  Monitoring:     'evidence',
  Compliance:     'info',
  Reconciliation: 'compliant',
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_TONE[status] || STATUS_TONE.draft;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_TONE[severity] || SEVERITY_TONE.low;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function FrameworkBadge({ fw }: { fw: string }) {
  return <Pill tone={FW_TONE[fw] || 'draft'}>{fw}</Pill>;
}

export function TypeBadge({ type }: { type: string }) {
  return <Pill tone={TYPE_TONE[type] || 'draft'}>{type}</Pill>;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  // Editorial: avatar tone derived from brand scale; deterministic per name.
  const tones = ['#6A12CD', '#0369A1', '#15803D', '#B45309', '#B42318', '#3B0B72', '#0891B2'];
  const color = tones[name.charCodeAt(0) % tones.length];
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}
