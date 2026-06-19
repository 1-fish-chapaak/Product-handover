import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileSpreadsheet, FileImage, ChevronDown, ExternalLink, Download, FolderOpen, ShieldCheck, Eye, X } from 'lucide-react';
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

function EvidenceRow({ item, onOpenSource, onPreview }: { item: EvidenceItem; onOpenSource: (atrId: string) => void; onPreview: (item: EvidenceItem) => void }) {
  const t = TYPE_META[item.type];
  const Icon = t.icon;
  return (
    <div className="group flex items-center gap-3.5 px-4 py-3 hover:bg-paper-50/70 transition-colors">
      <button onClick={() => onPreview(item)} title="Preview" className={`w-9 h-9 rounded-[9px] ${t.bg} ${t.fg} flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-brand-600/20`}><Icon size={16} /></button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button onClick={() => onPreview(item)} className="text-[0.8125rem] font-semibold text-ink-900 truncate hover:text-brand-700 cursor-pointer">{item.name}</button>
          <span className={`inline-flex items-center h-5 px-1.5 text-[0.59375rem] font-bold rounded ${t.bg} ${t.fg}`}>{item.type}</span>
        </div>
        <div className="text-[0.71875rem] text-ink-500 mt-0.5 truncate">
          Backs: <span className="text-ink-700">{item.observation}</span>
        </div>
      </div>
      <div className="hidden md:block text-right shrink-0 min-w-0">
        <div className="text-[0.71875rem] text-ink-600 truncate max-w-[200px]">{item.atrName}</div>
        <div className="text-[0.6875rem] text-ink-400">{item.uploadedBy} · {item.uploadedAt} · {item.size}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onPreview(item)} title="Preview file" className="inline-flex items-center gap-1 h-8 px-2.5 text-[0.71875rem] font-semibold text-ink-700 bg-white border border-canvas-border rounded-[8px] hover:border-brand-600/30 cursor-pointer transition-colors">
          <Eye size={12} /> Preview
        </button>
        <button
          onClick={() => onOpenSource(item.atrId)}
          title="Open the source ATR report"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[0.71875rem] font-semibold text-brand-600 bg-white border border-canvas-border rounded-[8px] hover:border-brand-600/30 cursor-pointer transition-colors"
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

/** Inline evidence preview — a credible mock viewer keyed to the file type. */
function EvidencePreviewModal({ item, onClose, onOpenSource }: { item: EvidenceItem; onClose: () => void; onOpenSource: (atrId: string) => void }) {
  const t = TYPE_META[item.type];
  const Icon = t.icon;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[60]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] max-w-[94vw] h-[78vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[65] flex flex-col" role="dialog" aria-label={`Preview ${item.name}`}
      >
        <header className="shrink-0 px-5 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-[9px] ${t.bg} ${t.fg} flex items-center justify-center shrink-0`}><Icon size={16} /></div>
            <div className="min-w-0">
              <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{item.name}</div>
              <div className="text-[0.6875rem] text-ink-500 truncate">{item.type} · {item.size} · {item.uploadedBy} · {item.uploadedAt}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
        </header>

        <div className="px-5 py-2 border-b border-canvas-border text-[0.6875rem] text-ink-500 shrink-0">Backs observation: <span className="font-medium text-ink-700">{item.observation}</span> · <span className="text-ink-600">{item.area}</span></div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-[#F4F2F7] p-6 flex items-start justify-center">
          {item.type === 'PNG' ? (
            <div className="w-full max-w-[520px] aspect-[4/3] rounded-[10px] border border-canvas-border bg-white flex flex-col items-center justify-center gap-2 text-ink-400">
              <FileImage size={40} /><span className="text-[0.75rem] font-medium">{item.name}</span><span className="text-[0.6875rem]">Image preview</span>
            </div>
          ) : (item.type === 'XLSX' || item.type === 'CSV') ? (
            <div className="w-full max-w-[640px] rounded-[10px] border border-canvas-border bg-white overflow-hidden">
              <div className="grid grid-cols-4 bg-paper-50 border-b border-canvas-border text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500">
                {['Ref', 'Field', 'Value', 'Status'].map(h => <div key={h} className="px-3 py-2 border-r border-canvas-border last:border-0">{h}</div>)}
              </div>
              {Array.from({ length: 8 }).map((_, r) => (
                <div key={r} className="grid grid-cols-4 border-b border-canvas-border last:border-0 text-[0.6875rem] text-ink-600">
                  {['EX-' + (101 + r), ['Vendor', 'Invoice', 'GRN', 'Amount'][r % 4], ['Pass', 'Exception', 'Pass', '₹' + (12 + r) + 'L'][r % 4], r % 3 === 0 ? 'Flagged' : 'OK'].map((c, ci) => <div key={ci} className="px-3 py-2 border-r border-canvas-border last:border-0 truncate">{c}</div>)}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full max-w-[560px] rounded-[10px] border border-canvas-border bg-white p-8 shadow-sm">
              <div className="h-5 w-2/3 rounded bg-ink-200 mb-4" />
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className={`h-2.5 rounded bg-paper-100 mb-2.5 ${i % 4 === 3 ? 'w-1/2' : 'w-full'}`} />)}
              <div className="h-2.5" />
              <div className="h-5 w-1/3 rounded bg-ink-200 mb-3 mt-4" />
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`h-2.5 rounded bg-paper-100 mb-2.5 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />)}
            </div>
          )}
        </div>

        <footer className="shrink-0 px-5 py-3 border-t border-canvas-border flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] text-ink-400">Prototype preview · the real file renders in the deployed app.</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onOpenSource(item.atrId)} className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer">View source <ExternalLink size={12} /></button>
            <button className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-500 cursor-pointer"><Download size={13} /> Download</button>
          </div>
        </footer>
      </motion.div>
    </>
  );
}

function AreaGroup({ area, items, onOpenSource, onPreview }: { area: string; items: EvidenceItem[]; onOpenSource: (atrId: string) => void; onPreview: (item: EvidenceItem) => void }) {
  const [open, setOpen] = useState(true);
  const atrName = items[0]?.atrName;
  return (
    <section className="bg-white border border-canvas-border rounded-[12px] overflow-hidden mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[9px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
          <div className="min-w-0">
            <h3 className="text-[0.84375rem] font-semibold text-ink-900 truncate">{area}</h3>
            <p className="text-[0.71875rem] text-ink-500 truncate">{atrName}</p>
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
              {items.map(item => <EvidenceRow key={item.id} item={item} onOpenSource={onOpenSource} onPreview={onPreview} />)}
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
  const [preview, setPreview] = useState<EvidenceItem | null>(null);

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
          <div className="w-12 h-12 rounded-[10px] bg-paper-50 flex items-center justify-center"><FolderOpen size={22} className="text-ink-400" /></div>
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
                onClick={() => setPreview(item)}
                actions={
                  <button title="Download" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-[8px] flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer" aria-label="Download"><Download size={14} /></button>
                }
              />
            );
          })}
        </div>
      ) : (
        <div>
          {groups.map(([area, items]) => (
            <AreaGroup key={area} area={area} items={items} onOpenSource={onOpenSource} onPreview={setPreview} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {preview && <EvidencePreviewModal item={preview} onClose={() => setPreview(null)} onOpenSource={(id) => { setPreview(null); onOpenSource(id); }} />}
      </AnimatePresence>
    </motion.div>
  );
}
