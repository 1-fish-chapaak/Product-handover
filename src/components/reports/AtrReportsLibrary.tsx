import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Calendar, ClipboardList, ListChecks, Paperclip, ArrowRight, FolderOpen } from 'lucide-react';
import { type AtrLibraryReport, EVIDENCE_LIBRARY } from '../../data/atrLibrary';

const AREA_TONE: Record<string, string> = {
  'Procure-to-Pay':     'bg-brand-50 text-brand-700',
  'IT General Controls': 'bg-evidence-50 text-evidence-700',
  'Order-to-Cash':      'bg-mitigated-50 text-mitigated-700',
};

const STATUS_TONE: Record<string, string> = {
  final: 'bg-compliant-50 text-compliant-700',
  draft: 'bg-[#F4F2F7] text-ink-600',
};

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className="text-ink-400 shrink-0" />
      <span className="text-[12.5px] font-semibold text-ink-800 tabular-nums">{value}</span>
      <span className="text-[11.5px] text-ink-500">{label}</span>
    </div>
  );
}

export default function AtrReportsLibrary({ atrs, onOpen }: { atrs: AtrLibraryReport[]; onOpen: (atr: AtrLibraryReport) => void }) {
  const [q, setQ] = useState('');

  const evidenceCount = useMemo(() => {
    const m: Record<string, number> = {};
    EVIDENCE_LIBRARY.forEach(e => { m[e.atrId] = (m[e.atrId] ?? 0) + 1; });
    return m;
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return atrs;
    return atrs.filter(a => a.name.toLowerCase().includes(s) || a.area.toLowerCase().includes(s) || (a.atrData.meta.auditEntity ?? '').toLowerCase().includes(s));
  }, [atrs, q]);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-4 mb-5">
        <p className="text-[13px] text-ink-500">Every Action Taken Report generated across audits — {atrs.length} in total.</p>
        <div className="relative w-[280px] max-w-[40vw]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search ATR reports…"
            className="w-full h-9 pl-9 pr-3 bg-paper-50 border border-border-light rounded-[8px] text-[13px] text-text placeholder:text-ink-400 outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
          <div className="text-[13px] font-medium text-ink-700">No ATR reports match “{q}”.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(atr => {
            const plans = atr.atrData.observations.reduce((n, o) => n + o.actionPlans.length, 0);
            return (
              <button
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
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-1">
                  <Stat icon={ClipboardList} value={atr.atrData.observations.length} label="observations" />
                  <Stat icon={ListChecks} value={plans} label="action plans" />
                  <Stat icon={Paperclip} value={evidenceCount[atr.id] ?? 0} label="evidence" />
                </div>

                <div className="mt-auto pt-3 border-t border-border-light flex items-center justify-between">
                  <span className="text-[11.5px] text-ink-400">{atr.generatedBy} · {atr.generatedAt}</span>
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary group-hover:gap-1.5 transition-all">Open report <ArrowRight size={13} /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
