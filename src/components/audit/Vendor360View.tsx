import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Building2, Search, AlertTriangle, CheckCircle2,
  Clock, Workflow, ChevronRight, ExternalLink,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { ENGAGEMENT_EXCEPTIONS, type EngagementException, type Severity } from '../../data/engagement-exceptions';
import { ENGAGEMENTS, PROCESS_COLORS } from '../../data/engagements';
import { VENDORS, type Vendor } from '../../data/grc-domain';

interface Props {
  onBack: () => void;
}

const RISK_CLS: Record<Vendor['risk'], string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-100',
  High: 'bg-high-50 text-high-700 border-high-100',
  Medium: 'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  Low: 'bg-compliant-50 text-compliant-700 border-compliant-100',
};

const SEV_CLS: Record<Severity, string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-100',
  High: 'bg-high-50 text-high-700 border-high-100',
  Medium: 'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  Low: 'bg-compliant-50 text-compliant-700 border-compliant-100',
};

const STATUS_CLS: Record<EngagementException['status'], string> = {
  Open: 'bg-risk-50 text-risk-700',
  Triaging: 'bg-mitigated-50 text-mitigated-700',
  Resolved: 'bg-compliant-50 text-compliant-700',
};

/** Loose match: the exception title or ref mentions the vendor id or name. */
function exceptionsForVendor(vendorId: string): EngagementException[] {
  const idShort = vendorId.toUpperCase();
  return ENGAGEMENT_EXCEPTIONS.filter(e =>
    e.title.toUpperCase().includes(idShort) ||
    e.title.toUpperCase().includes(vendorId.replace(/^v-/, 'V-').toUpperCase())
  );
}

export default function Vendor360View({ onBack }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(VENDORS[0]?.id ?? '');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return VENDORS;
    return VENDORS.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.pan.toLowerCase().includes(q)
    );
  }, [search]);

  const selected = VENDORS.find(v => v.id === selectedId);
  const vendorExceptions = useMemo(() => selected ? exceptionsForVendor(selected.id) : [], [selected]);
  const totalOpen = vendorExceptions.filter(e => e.status !== 'Resolved').length;
  const totalClosed = vendorExceptions.length - totalOpen;
  const engagementsWith = useMemo(() => {
    const ids = new Set(vendorExceptions.map(e => e.engagementId));
    return ENGAGEMENTS.filter(e => ids.has(e.id));
  }, [vendorExceptions]);
  const workflowsCount = new Set(vendorExceptions.map(e => e.workflowId)).size;
  const sevCounts: Record<Severity, number> = useMemo(() => {
    const c: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    vendorExceptions.forEach(e => { if (e.status !== 'Resolved') c[e.severity] += 1; });
    return c;
  }, [vendorExceptions]);

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">Vendor 360</div>
          <h1 className="font-display text-[2rem] font-bold text-text leading-tight">Vendor Risk Profile</h1>
          <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-2xl">
            Click any vendor to see every exception they appear in, across every engagement and workflow.
          </p>
        </div>

        <div className="grid grid-cols-[320px_1fr] gap-6">
          {/* Vendor list */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search vendor, ID, or PAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-[0.8125rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              {filtered.map(v => {
                const isSelected = v.id === selectedId;
                const count = exceptionsForVendor(v.id).filter(e => e.status !== 'Resolved').length;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary/40 bg-primary-xlight/40 ring-2 ring-primary/15'
                        : 'border-border-light hover:border-primary/20 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={13} className="text-text-muted shrink-0" />
                      <span className="text-[0.8125rem] font-semibold text-text truncate">{v.name}</span>
                      {count > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[0.625rem] font-bold text-risk-700 bg-risk-50 px-1.5 h-4 rounded shrink-0">
                          {count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[0.75rem] text-text-muted">
                      <span className="font-mono">{v.id.toUpperCase()}</span>
                      <span className="text-border">·</span>
                      <span>{v.category}</span>
                      <span className={`ml-auto px-1.5 h-4 rounded text-[0.75rem] font-bold uppercase tracking-wide border ${RISK_CLS[v.risk]}`}>{v.risk}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-[0.75rem] text-text-muted text-center py-4">No vendors match.</div>
              )}
            </div>
          </div>

          {/* Selected vendor detail */}
          {selected && (
            <div className="space-y-5">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h2 className="font-display text-[1.375rem] font-bold text-text">{selected.name}</h2>
                      <span className={`inline-flex items-center px-2 h-5 rounded text-[0.625rem] font-bold uppercase tracking-wide border ${RISK_CLS[selected.risk]}`}>{selected.risk} Risk</span>
                    </div>
                    <dl className="flex items-center gap-4 text-[0.75rem] text-text-muted flex-wrap">
                      <div className="flex items-center gap-1.5"><dt>ID:</dt><dd className="font-mono text-text-secondary">{selected.id.toUpperCase()}</dd></div>
                      <div className="flex items-center gap-1.5"><dt>PAN:</dt><dd className="font-mono text-text-secondary">{selected.pan}</dd></div>
                      <div className="flex items-center gap-1.5"><dt>Category:</dt><dd className="text-text-secondary">{selected.category}</dd></div>
                      <div className="flex items-center gap-1.5"><dt>Onboarded:</dt><dd className="text-text-secondary">{selected.onboarded}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <KpiTile label="Open exceptions" value={totalOpen} icon={AlertTriangle} tone="text-risk-700" />
                  <KpiTile label="Resolved" value={totalClosed} icon={CheckCircle2} tone="text-compliant-700" />
                  <KpiTile label="Engagements" value={engagementsWith.length} icon={Building2} tone="text-text" />
                  <KpiTile label="Workflows triggering" value={workflowsCount} icon={Workflow} tone="text-text" />
                </div>
                {totalOpen > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map(sev => sevCounts[sev] > 0 && (
                      <span key={sev} className={`inline-flex items-center px-1.5 h-4 rounded text-[0.625rem] font-bold uppercase tracking-wide border ${SEV_CLS[sev]}`}>
                        {sevCounts[sev]} {sev}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Engagements where this vendor appears */}
              {engagementsWith.length > 0 && (
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Appears in these engagements</h3>
                  <div className="space-y-2">
                    {engagementsWith.map(eng => {
                      const cnt = vendorExceptions.filter(e => e.engagementId === eng.id).length;
                      return (
                        <div key={eng.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-light hover:border-primary/20 transition-colors">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[0.6875rem] font-bold shrink-0"
                            style={{ background: PROCESS_COLORS[eng.process] }}
                          >
                            {eng.process}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.8125rem] font-medium text-text truncate">{eng.name}</div>
                            <div className="text-[0.6875rem] text-text-muted">{eng.framework} · Owner {eng.owner}</div>
                          </div>
                          <span className="text-[0.75rem] font-bold text-risk-700 tabular-nums">{cnt}</span>
                          <ChevronRight size={14} className="text-text-muted" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exception list for this vendor */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
                  <h3 className="text-[0.8125rem] font-semibold text-text">All exceptions <span className="text-text-muted font-normal">({vendorExceptions.length})</span></h3>
                  <button className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                    Bulk-classify <ExternalLink size={10} />
                  </button>
                </div>
                {vendorExceptions.length === 0 ? (
                  <div className="p-10 text-center">
                    <CheckCircle2 size={28} className="text-compliant mx-auto mb-3" />
                    <p className="text-[0.8125rem] font-semibold text-text mb-1">No exceptions on file for this vendor</p>
                    <p className="text-[0.75rem] text-text-muted">Clean record across all monitored workflows.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-light/60">
                    {vendorExceptions.map((ex, i) => (
                      <motion.div
                        key={ex.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2/40 cursor-pointer transition-colors"
                      >
                        <span className={`inline-flex items-center px-1.5 h-5 rounded text-[0.625rem] font-bold uppercase tracking-wide border ${SEV_CLS[ex.severity]} shrink-0`}>{ex.severity}</span>
                        <span className="font-mono text-[0.75rem] text-text-secondary tabular-nums shrink-0 w-20">{ex.ref}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.8125rem] text-text truncate">{ex.title}</div>
                          <div className="text-[0.6875rem] text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Workflow size={10} />{ex.workflowName}</span>
                            <span className="text-border">·</span>
                            <span>{ex.assignee}</span>
                            <span className="text-border">·</span>
                            <span><Clock size={9} className="inline mr-0.5" />{ex.opened}</span>
                            {ex.amount && <><span className="text-border">·</span><span className="font-medium text-text-secondary">{ex.amount}</span></>}
                          </div>
                        </div>
                        <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center shrink-0 ${STATUS_CLS[ex.status]}`}>{ex.status}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.625rem] uppercase tracking-wide font-semibold text-text-muted">{label}</span>
        <Icon size={12} className="text-text-muted" />
      </div>
      <div className={`text-[1.375rem] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
    </div>
  );
}
