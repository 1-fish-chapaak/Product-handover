import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Calendar, ClipboardList, ListChecks, Paperclip, FolderOpen, Eye, Download, Share2, User } from 'lucide-react';
import { type AtrLibraryReport, EVIDENCE_LIBRARY } from '../../data/atrLibrary';

const AREA_TONE: Record<string, string> = {
  'Procure-to-Pay':      'bg-brand-50 text-brand-700',
  'IT General Controls': 'bg-evidence-50 text-evidence-700',
  'Order-to-Cash':       'bg-mitigated-50 text-mitigated-700',
};
const STATUS_TONE: Record<string, string> = {
  final: 'bg-compliant-50 text-compliant-700',
  draft: 'bg-[#F4F2F7] text-ink-600',
};

const DATE_RANGES: { key: string; label: string; days: number }[] = [
  { key: 'all', label: 'All time', days: 0 },
  { key: 'd30', label: 'Last 30 days', days: 30 },
  { key: 'd90', label: 'Last 90 days', days: 90 },
  { key: 'y1', label: 'Last year', days: 365 },
];

// "Mar 22, 2026, 16:40" → Date (date part only).
function parseAtrDate(s: string): Date | null {
  const m = s.match(/([A-Za-z]{3,} \d{1,2},? \d{4})/);
  if (!m) return null;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className="text-ink-400 shrink-0" />
      <span className="text-[12.5px] font-semibold text-ink-800 tabular-nums">{value}</span>
      <span className="text-[11.5px] text-ink-500">{label}</span>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-ink-400">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-ink-700 bg-white border border-border-light rounded-[8px] cursor-pointer hover:border-primary/30 focus:outline-none focus:border-primary/40 transition-colors"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ActionIcon({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-[8px] flex items-center justify-center text-ink-500 hover:text-primary hover:bg-primary-xlight cursor-pointer transition-colors"
    >
      <Icon size={15} />
    </button>
  );
}

export default function AtrReportsLibrary({ atrs, onOpen, onShare, onDownload }: {
  atrs: AtrLibraryReport[];
  onOpen: (atr: AtrLibraryReport) => void;
  onShare?: (atr: AtrLibraryReport) => void;
  onDownload?: (atr: AtrLibraryReport) => void;
}) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('All');
  const [status, setStatus] = useState('All');
  const [auditor, setAuditor] = useState('All');
  const [riskOwner, setRiskOwner] = useState('All');
  const [dateRange, setDateRange] = useState('all');
  const [nowMs] = useState(() => Date.now()); // stable "now" for date-range filtering

  const evidenceCount = useMemo(() => {
    const m: Record<string, number> = {};
    EVIDENCE_LIBRARY.forEach(e => { m[e.atrId] = (m[e.atrId] ?? 0) + 1; });
    return m;
  }, []);

  // Filter option lists, derived from the data.
  const uniq = (xs: (string | undefined)[]) => ['All', ...Array.from(new Set(xs.filter(Boolean) as string[]))];
  const areaOpts = useMemo(() => uniq(atrs.map(a => a.area)), [atrs]);
  const auditorOpts = useMemo(() => uniq(atrs.map(a => a.generatedBy)), [atrs]);
  const riskOwnerOpts = useMemo(() => uniq(atrs.map(a => a.riskOwner)), [atrs]);

  // Content index — metadata PLUS the text inside each ATR, for full-text search.
  const blobs = useMemo(() => {
    const m = new Map<string, string>();
    atrs.forEach(a => {
      const parts: string[] = [a.name, a.area, a.generatedBy, a.riskOwner ?? '', a.sourceReport ?? '',
        a.atrData.meta.auditEntity ?? '', a.atrData.meta.auditTitle ?? '', a.atrData.meta.auditPeriod ?? ''];
      a.atrData.observations.forEach(o => {
        parts.push(o.title, o.description ?? '', o.riskSummary ?? '', o.process ?? '');
        o.actionPlans.forEach(p => parts.push(p.text, p.actionTaken ?? '', p.evidence ?? '', p.verification ?? ''));
      });
      a.atrData.insights?.forEach(i => parts.push(i.title, i.body));
      m.set(a.id, parts.join(' · ').toLowerCase());
    });
    return m;
  }, [atrs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const range = DATE_RANGES.find(r => r.key === dateRange);
    return atrs.filter(a => {
      if (area !== 'All' && a.area !== area) return false;
      if (status !== 'All' && a.status !== status) return false;
      if (auditor !== 'All' && a.generatedBy !== auditor) return false;
      if (riskOwner !== 'All' && a.riskOwner !== riskOwner) return false;
      if (range && range.days > 0) {
        const d = parseAtrDate(a.generatedAt);
        if (!d || (nowMs - d.getTime()) / 86400000 > range.days) return false;
      }
      if (s && !(blobs.get(a.id) ?? '').includes(s)) return false;
      return true;
    });
  }, [atrs, q, area, status, auditor, riskOwner, dateRange, blobs, nowMs]);

  const activeFilters = area !== 'All' || status !== 'All' || auditor !== 'All' || riskOwner !== 'All' || dateRange !== 'all' || !!q.trim();
  const clearAll = () => { setQ(''); setArea('All'); setStatus('All'); setAuditor('All'); setRiskOwner('All'); setDateRange('all'); };

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <p className="text-[13px] text-ink-500">{filtered.length} of {atrs.length} Action Taken Reports{activeFilters ? ' (filtered)' : ''}.</p>
        <div className="relative w-[320px] max-w-[44vw]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search ATRs — names, auditors, or text inside…"
            className="w-full h-9 pl-9 pr-3 bg-paper-50 border border-border-light rounded-[8px] text-[13px] text-text placeholder:text-ink-400 outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FilterSelect label="Area" value={area} onChange={setArea} options={areaOpts} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={['All', 'final', 'draft']} />
        <FilterSelect label="Auditor" value={auditor} onChange={setAuditor} options={auditorOpts} />
        <FilterSelect label="Risk owner" value={riskOwner} onChange={setRiskOwner} options={riskOwnerOpts} />
        <label className="inline-flex items-center gap-1.5">
          <span className="text-[11px] text-ink-400">Date</span>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="h-8 pl-2.5 pr-7 text-[12px] font-medium text-ink-700 bg-white border border-border-light rounded-[8px] cursor-pointer hover:border-primary/30 focus:outline-none focus:border-primary/40 transition-colors"
          >
            {DATE_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        {activeFilters && (
          <button onClick={clearAll} className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer">Clear all</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
          <div className="text-[13px] font-medium text-ink-700">No ATRs match your filters.</div>
          {activeFilters && <button onClick={clearAll} className="text-[12px] text-brand-700 font-medium hover:underline cursor-pointer">Clear all filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(atr => {
            const plans = atr.atrData.observations.reduce((n, o) => n + o.actionPlans.length, 0);
            return (
              <div
                key={atr.id}
                onClick={() => onOpen(atr)}
                className="group text-left bg-white border border-border-light rounded-[14px] p-5 flex flex-col gap-3.5 cursor-pointer hover:border-primary/30 hover:shadow-[0_4px_16px_-8px_rgba(106,18,205,0.18)] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-semibold rounded-full ${AREA_TONE[atr.area] ?? 'bg-paper-50 text-ink-600'}`}>{atr.area}</span>
                  <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-semibold rounded-full capitalize ${STATUS_TONE[atr.status]}`}>{atr.status}</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-[9px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={17} /></div>
                  <h3 className="text-[14.5px] font-semibold text-ink-900 leading-snug">{atr.name}</h3>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-500"><Calendar size={12} /> {atr.atrData.meta.auditPeriod}</div>
                  <div className="text-[12px] text-ink-500 truncate">{atr.atrData.meta.auditEntity}</div>
                  {atr.riskOwner && <div className="flex items-center gap-1.5 text-[12px] text-ink-500"><User size={12} /> Risk owner · {atr.riskOwner}</div>}
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-1">
                  <Stat icon={ClipboardList} value={atr.atrData.observations.length} label="observations" />
                  <Stat icon={ListChecks} value={plans} label="action plans" />
                  <Stat icon={Paperclip} value={evidenceCount[atr.id] ?? 0} label="evidence" />
                </div>

                {/* Footer: Generated by + date/time, and per-row actions */}
                <div className="mt-auto pt-3 border-t border-border-light flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11.5px] text-ink-600 truncate">Generated by <span className="font-medium text-ink-700">{atr.generatedBy}</span></div>
                    <div className="text-[11px] text-ink-400 tabular-nums">{atr.generatedAt}</div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <ActionIcon icon={Eye} label="View" onClick={() => onOpen(atr)} />
                    {onDownload && <ActionIcon icon={Download} label="Download" onClick={() => onDownload(atr)} />}
                    {onShare && <ActionIcon icon={Share2} label="Share" onClick={() => onShare(atr)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
