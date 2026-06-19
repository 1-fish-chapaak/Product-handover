import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { FileText, FolderOpen, Download, Share2, CloudUpload, Sparkles } from 'lucide-react';
import { type AtrLibraryReport, EVIDENCE_LIBRARY } from '../../data/atrLibrary';
import ListToolbar, { ToolbarSelect, ToolbarFilterMenu, ToolbarViewToggle } from '../shared/ListToolbar';
import SmartTable from '../shared/SmartTable';
import ReportCard from '../shared/ReportCard';
import { type Tone } from '../shared/StatusBadge';
import { ReportPill } from './ReportPill';
import { reportDisplayName } from './reportName';

// Audit-area → design-system tone (StatusBadge §7.10.4). Used by both the grid
// card eyebrow tint and the list Type chips so the colour vocabulary matches.
const AREA_TONE_MAP: Record<string, Tone> = {
  'Procure-to-Pay':      'info',
  'IT General Controls': 'evidence',
  'Order-to-Cash':       'mitigated',
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

// Upload-generated ATRs are saved by the Generate-by-upload wizard under a
// `gr-atr-upload-` id prefix; everything else is system-generated.
const isUploadAtr = (a: AtrLibraryReport) => a.id.startsWith('gr-atr-upload-');

/** Origin tag shown under each report name — system vs uploaded. */
function OriginBadge({ upload }: { upload: boolean }) {
  return upload ? (
    <span className="inline-flex items-center gap-1 h-[18px] px-2 rounded-full bg-brand-50 text-brand-700 text-[10.5px] font-semibold whitespace-nowrap">
      <CloudUpload size={11} aria-hidden="true" /> Generated from upload
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 h-[18px] px-2 rounded-full bg-info-50 text-info-700 text-[10.5px] font-semibold whitespace-nowrap">
      <Sparkles size={11} aria-hidden="true" /> System generated
    </span>
  );
}


export default function AtrReportsLibrary({ atrs, onOpen, onShare, onDownload, view, onViewChange, trailingAction }: {
  atrs: AtrLibraryReport[];
  onOpen: (atr: AtrLibraryReport) => void;
  onShare?: (atr: AtrLibraryReport) => void;
  onDownload?: (atr: AtrLibraryReport) => void;
  /** Shared view mode, owned by ReportsView so the toggle is consistent across tabs. */
  view: 'list' | 'grid';
  onViewChange: (mode: 'list' | 'grid') => void;
  /** Optional CTA rendered at the right end of the toolbar, after the view toggle. */
  trailingAction?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('All');
  const [origin, setOrigin] = useState('All'); // All | System generated | Generated from upload
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
      if (origin === 'System generated' && isUploadAtr(a)) return false;
      if (origin === 'Generated from upload' && !isUploadAtr(a)) return false;
      if (auditor !== 'All' && a.generatedBy !== auditor) return false;
      if (riskOwner !== 'All' && a.riskOwner !== riskOwner) return false;
      if (range && range.days > 0) {
        const d = parseAtrDate(a.generatedAt);
        if (!d || (nowMs - d.getTime()) / 86400000 > range.days) return false;
      }
      if (s && !(blobs.get(a.id) ?? '').includes(s)) return false;
      return true;
    });
  }, [atrs, q, area, origin, auditor, riskOwner, dateRange, blobs, nowMs]);

  const activeFilters = area !== 'All' || origin !== 'All' || auditor !== 'All' || riskOwner !== 'All' || dateRange !== 'all' || !!q.trim();
  // Count only the dropdown filters (not the search) for the Filters badge.
  const activeFilterCount =
    (area !== 'All' ? 1 : 0) + (origin !== 'All' ? 1 : 0) + (auditor !== 'All' ? 1 : 0) +
    (riskOwner !== 'All' ? 1 : 0) + (dateRange !== 'all' ? 1 : 0);
  const clearFilters = () => { setArea('All'); setOrigin('All'); setAuditor('All'); setRiskOwner('All'); setDateRange('all'); };
  const clearAll = () => { setQ(''); clearFilters(); };

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
      <ListToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search ATRs…"
        compactSearch
        trailing={
          <>
            <ToolbarFilterMenu activeCount={activeFilterCount} onClear={clearFilters}>
              <ToolbarSelect block label="Area" value={area} onChange={setArea} options={areaOpts} />
              <ToolbarSelect block label="Origin" value={origin} onChange={setOrigin} options={['All', 'System generated', 'Generated from upload']} />
              <ToolbarSelect block label="Auditor" value={auditor} onChange={setAuditor} options={auditorOpts} />
              <ToolbarSelect block label="Risk owner" value={riskOwner} onChange={setRiskOwner} options={riskOwnerOpts} />
              <ToolbarSelect block label="Date" value={dateRange} onChange={setDateRange} options={DATE_RANGES.map(r => ({ value: r.key, label: r.label }))} />
            </ToolbarFilterMenu>
            <ToolbarViewToggle mode={view} onChange={onViewChange} />
            {trailingAction}
          </>
        }
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
          <div className="text-[0.8125rem] font-medium text-ink-700">No ATRs match your filters.</div>
          {activeFilters && <button onClick={clearAll} className="text-[0.75rem] text-brand-700 font-medium hover:underline cursor-pointer">Clear all filters</button>}
        </div>
      ) : view === 'list' ? (
        <div className="flex-1 rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-hidden">
        <SmartTable
          className=""
          variant="modern"
          dense
          searchable={false}
          showSortHint
          data={filtered as unknown as Record<string, unknown>[]}
          keyField="id"
          paginated
          pageSize={20}
          fixedLayout
          hideResultCount
          columns={[
            { key: 'name', label: 'Report', render: (item) => {
              const atr = item as unknown as AtrLibraryReport;
              const plans = atr.atrData.observations.reduce((n, o) => n + o.actionPlans.length, 0);
              return (
                <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => onOpen(atr)}>
                  <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-brand-50 text-brand-700">
                    <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[0.90625rem] font-semibold tracking-[-0.006em] text-ink-900 truncate group-hover:text-brand-600 transition-colors" title={reportDisplayName(atr.name)}>{reportDisplayName(atr.name)}</div>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <OriginBadge upload={isUploadAtr(atr)} />
                      <span className="text-[0.71875rem] text-ink-400 truncate">{atr.atrData.observations.length} obs · {plans} plans · {evidenceCount[atr.id] ?? 0} evidence</span>
                    </div>
                  </div>
                </div>
              );
            }},
            { key: 'area', label: 'Area', width: '180px', render: (item) => {
              const atr = item as unknown as AtrLibraryReport;
              return <ReportPill tone={AREA_TONE_MAP[atr.area] ?? 'draft'}>{atr.area}</ReportPill>;
            }},
            { key: 'generatedAt', label: 'Generated', width: '150px', render: (item) => (
              <span className="text-[0.75rem] tabular-nums text-ink-500 whitespace-nowrap">{String((item as unknown as AtrLibraryReport).generatedAt)}</span>
            )},
            { key: 'actions', label: '', width: '120px', sortable: false, align: 'right', render: (item) => {
              const atr = item as unknown as AtrLibraryReport;
              return (
                <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  {onDownload && <button title="Download" onClick={(e) => { e.stopPropagation(); onDownload(atr); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button>}
                  {onShare && <button title="Share" onClick={(e) => { e.stopPropagation(); onShare(atr); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button>}
                </div>
              );
            }},
          ]}
        />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
          {filtered.map((atr, i) => {
            const plans = atr.atrData.observations.reduce((n, o) => n + o.actionPlans.length, 0);
            const ev = evidenceCount[atr.id] ?? 0;
            return (
              <ReportCard
                key={atr.id}
                index={i}
                icon={FileText}
                iconClass="bg-info-50 text-info-700"
                eyebrow="ATR"
                title={reportDisplayName(atr.name)}
                subtitle={<OriginBadge upload={isUploadAtr(atr)} />}
                description={`${atr.atrData.meta.auditEntity} — ${atr.atrData.meta.auditPeriod}`}
                pills={[`${atr.atrData.observations.length} observations`, `${plans} action plans`, `${ev} evidence`]}
                footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{atr.generatedAt}</span>}
                onClick={() => onOpen(atr)}
                actions={<>
                  {onDownload && <button title="Download" onClick={(e) => { e.stopPropagation(); onDownload(atr); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button>}
                  {onShare && <button title="Share" onClick={(e) => { e.stopPropagation(); onShare(atr); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button>}
                </>}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
