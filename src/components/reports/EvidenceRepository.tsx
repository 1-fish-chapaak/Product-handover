import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileSpreadsheet, FileImage, ChevronDown, ExternalLink, Download, FolderOpen, ShieldCheck } from 'lucide-react';
import { EVIDENCE_LIBRARY, type EvidenceItem, type EvidenceType } from '../../data/atrLibrary';
import ListToolbar, { ToolbarSelect, ToolbarViewToggle } from '../shared/ListToolbar';

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
      <div className={`w-9 h-9 rounded-[9px] ${t.bg} ${t.fg} flex items-center justify-center shrink-0`}><Icon size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-900 truncate">{item.name}</span>
          <span className={`inline-flex items-center h-5 px-1.5 text-[9.5px] font-bold rounded ${t.bg} ${t.fg}`}>{item.type}</span>
        </div>
        <div className="text-[11.5px] text-ink-500 mt-0.5 truncate">
          Backs: <span className="text-ink-700">{item.observation}</span>
        </div>
      </div>
      <div className="hidden md:block text-right shrink-0 min-w-0">
        <div className="text-[11.5px] text-ink-600 truncate max-w-[200px]">{item.atrName}</div>
        <div className="text-[11px] text-ink-400">{item.uploadedBy} · {item.uploadedAt} · {item.size}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onOpenSource(item.atrId)}
          title="Open the source ATR report"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[11.5px] font-semibold text-primary bg-white border border-border-light rounded-[8px] hover:border-primary/30 cursor-pointer transition-colors"
        >
          View source <ExternalLink size={11} />
        </button>
        <button title="Download" className="w-8 h-8 rounded-[8px] flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer">
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
    <section className="bg-white border border-border-light rounded-[12px] overflow-hidden mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[9px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">{area}</h3>
            <p className="text-[11.5px] text-ink-500 truncate">{atrName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-paper-50 text-ink-600 tabular-nums">{items.length}</span>
          <ChevronDown size={16} className={`text-ink-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
            <div className="border-t border-border-light divide-y divide-border-light/70">
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
  const [type, setType] = useState<'All' | EvidenceType>('All');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EVIDENCE_LIBRARY.filter(e =>
      (type === 'All' || e.type === type) &&
      (!s || e.name.toLowerCase().includes(s) || e.observation.toLowerCase().includes(s) || e.area.toLowerCase().includes(s) || e.atrName.toLowerCase().includes(s)),
    );
  }, [q, type]);

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
            <ToolbarSelect
              label="Type"
              value={type}
              onChange={v => setType(v as 'All' | EvidenceType)}
              options={TYPE_FILTERS.map(t => ({ value: t, label: t === 'All' ? 'All types' : t }))}
            />
            <ToolbarViewToggle mode={view} onChange={onViewChange} />
          </>
        }
      />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
          <div className="text-[13px] font-medium text-ink-700">No evidence matches your filters.</div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
          {filtered.map(item => {
            const t = TYPE_META[item.type];
            const Icon = t.icon;
            return (
              <div
                key={item.id}
                onClick={() => onOpenSource(item.atrId)}
                className="group text-left bg-canvas-elevated border border-canvas-border rounded-[14px] p-5 flex flex-col gap-3 cursor-pointer hover:border-brand-300 hover:shadow-[0_4px_16px_-8px_rgba(106,18,205,0.18)] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`w-9 h-9 rounded-[9px] ${t.bg} ${t.fg} flex items-center justify-center shrink-0`}><Icon size={17} /></div>
                  <span className={`inline-flex items-center h-5 px-1.5 text-[9.5px] font-bold rounded ${t.bg} ${t.fg}`}>{item.type}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-ink-900 leading-snug truncate" title={item.name}>{item.name}</h3>
                <div className="text-[11.5px] text-ink-500 line-clamp-2">Backs: <span className="text-ink-700">{item.observation}</span></div>
                <div className="mt-auto pt-3 border-t border-canvas-border">
                  <div className="text-[11.5px] text-ink-600 truncate">{item.area}</div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] text-ink-400 truncate">{item.uploadedAt} · {item.size}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onOpenSource(item.atrId); }} title="Open the source ATR report" className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary-xlight rounded-[8px] cursor-pointer transition-colors">View source <ExternalLink size={10} /></button>
                      <button title="Download" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-[8px] flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer"><Download size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
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
