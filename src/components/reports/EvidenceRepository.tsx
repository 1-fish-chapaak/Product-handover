import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileSpreadsheet, FileImage, ChevronDown, ExternalLink, Download, FolderOpen, ShieldCheck } from 'lucide-react';
import { EVIDENCE_LIBRARY, type EvidenceItem, type EvidenceType } from '../../data/atrLibrary';
import ListToolbar, { ToolbarViewToggle } from '../shared/ListToolbar';
import ColumnFilter from '../shared/ColumnFilter';
import ReportCard from '../shared/ReportCard';

const TYPE_META: Record<EvidenceType, { icon: React.ElementType; bg: string; fg: string }> = {
  PDF:  { icon: FileText,        bg: 'bg-risk-50',      fg: 'text-risk-700' },
  XLSX: { icon: FileSpreadsheet, bg: 'bg-compliant-50', fg: 'text-compliant-700' },
  CSV:  { icon: FileSpreadsheet, bg: 'bg-compliant-50', fg: 'text-compliant-700' },
  DOCX: { icon: FileText,        bg: 'bg-evidence-50',  fg: 'text-evidence-700' },
  PNG:  { icon: FileImage,       bg: 'bg-mitigated-50', fg: 'text-mitigated-700' },
};

const TYPE_FILTERS: ('All' | EvidenceType)[] = ['All', 'PDF', 'XLSX', 'DOCX', 'PNG', 'CSV'];

function EvidenceRow({ item, onOpenSource }: { item: EvidenceItem; onOpenSource: (atrId: string) => void }) {
  const t = TYPE_META[item.type];
  const Icon = t.icon;
  return (
    <div className="group flex items-center gap-3.5 px-4 py-3 hover:bg-paper-50/70 transition-colors">
      <div className={`w-9 h-9 rounded-md ${t.bg} ${t.fg} flex items-center justify-center shrink-0`}><Icon size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{item.name}</span>
          <span className={`inline-flex items-center h-5 px-1.5 text-[0.625rem] font-bold rounded ${t.bg} ${t.fg}`}>{item.type}</span>
        </div>
        <div className="text-[0.75rem] text-ink-500 mt-0.5 truncate">
          Backs: <span className="text-ink-700">{item.observation}</span>
        </div>
      </div>
      <div className="hidden md:block text-right shrink-0 min-w-0">
        <div className="text-[0.75rem] text-ink-600 truncate max-w-[200px]">{item.atrName}</div>
        <div className="text-[0.6875rem] text-ink-400">{item.uploadedBy} · {item.uploadedAt} · {item.size}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onOpenSource(item.atrId)}
          title="Open the source ATR report"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[0.75rem] font-semibold text-brand-600 bg-white border border-canvas-border rounded-md hover:border-brand-600/30 cursor-pointer transition-colors"
        >
          View source <ExternalLink size={11} />
        </button>
        <button title="Download" className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function AreaGroup({ area, items, onOpenSource }: { area: string; items: EvidenceItem[]; onOpenSource: (atrId: string) => void }) {
  const [open, setOpen] = useState(true);
  const atrName = items[0]?.atrName;
  return (
    <section className="bg-white border border-canvas-border rounded-lg overflow-hidden mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
          <div className="min-w-0">
            <h3 className="text-[0.875rem] font-semibold text-ink-900 truncate">{area}</h3>
            <p className="text-[0.75rem] text-ink-500 truncate">{atrName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-paper-50 text-ink-600 tabular-nums">{items.length}</span>
          <ChevronDown size={16} className={`text-ink-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
            <div className="border-t border-canvas-border divide-y divide-border-light/70">
              {items.map(item => <EvidenceRow key={item.id} item={item} onOpenSource={onOpenSource} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function EvidenceRepository({ onOpenSource, view, onViewChange }: {
  onOpenSource: (atrId: string) => void;
  /** Shared view mode, owned by ReportsView so the toggle is consistent across tabs. */
  view: 'list' | 'grid';
  onViewChange: (mode: 'list' | 'grid') => void;
}) {
  const [q, setQ] = useState('');
  const [types, setTypes] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EVIDENCE_LIBRARY.filter(e =>
      (types.length === 0 || types.includes(e.type)) &&
      (!s || e.name.toLowerCase().includes(s) || e.observation.toLowerCase().includes(s) || e.area.toLowerCase().includes(s) || e.atrName.toLowerCase().includes(s)),
    );
  }, [q, types]);

  // Segregate by audit area.
  const groups = useMemo(() => {
    const map = new Map<string, EvidenceItem[]>();
    filtered.forEach(e => { if (!map.has(e.area)) map.set(e.area, []); map.get(e.area)!.push(e); });
    return [...map.entries()];
  }, [filtered]);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
      <ListToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search evidence…"
        trailing={
          <>
            <ColumnFilter
              variant="button"
              icon
              selectIndicator="checkbox"
              label="Type"
              options={TYPE_FILTERS.filter(t => t !== 'All') as string[]}
              value={types}
              onChange={setTypes}
              align="end"
            />
            <ToolbarViewToggle mode={view} onChange={onViewChange} />
          </>
        }
      />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-12 h-12 rounded-lg bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
          <div className="text-[0.8125rem] font-medium text-ink-700">No evidence matches your filters.</div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
          {filtered.map((item, i) => {
            const t = TYPE_META[item.type];
            return (
              <ReportCard
                key={item.id}
                index={i}
                icon={t.icon}
                iconClass="bg-brand-50/70 text-brand-600"
                eyebrow={item.type}
                title={item.name}
                description={`Backs: ${item.observation}`}
                pills={[item.type, item.size, item.area]}
                footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{item.uploadedAt}</span>}
                onClick={() => onOpenSource(item.atrId)}
                actions={
                  <button title="Download" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer" aria-label="Download"><Download size={14} /></button>
                }
              />
            );
          })}
        </div>
      ) : (
        <div>
          {groups.map(([area, items]) => (
            <AreaGroup key={area} area={area} items={items} onOpenSource={onOpenSource} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
