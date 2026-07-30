import { useState } from 'react';
import { Link2, Plus, X, Check, CheckCircle2, AlertCircle, Unlink, FileSpreadsheet } from 'lucide-react';
import { type AtrWorkObs, type LinkState, type AtrAnnexure } from './atrBuilder';

const STATE_META: Record<LinkState, { label: string; cls: string; icon: typeof CheckCircle2; hint: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-compliant-50 text-compliant-700 border-compliant/30', icon: CheckCircle2, hint: 'Mapping confirmed.' },
  review: { label: 'Needs review', cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated/30', icon: AlertCircle, hint: 'AI-suggested link — confirm it’s correct or adjust it before continuing.' },
  unlinked: { label: 'Unlinked', cls: 'bg-risk-50 text-risk-700 border-risk/30', icon: Unlink, hint: 'No annexure linked — this observation won’t create exception cases in Manage Exceptions.' },
};

/**
 * Stage 3 — Annexure Linking. AI-suggested observation → annexure mapping that
 * the user confirms or adjusts. Each row is editable; rows carry a confidence
 * state (confirmed / needs review / unlinked).
 */
export default function AtrAnnexureStep({ observations, pool, onChange }: {
  observations: AtrWorkObs[];
  /** Available annexures to link — the uploaded files (or the demo fallback). */
  pool: AtrAnnexure[];
  onChange: (next: AtrWorkObs[]) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null); // observation _id with open picker
  const selected = observations.filter(o => o.selected);

  const patch = (id: string, fn: (o: AtrWorkObs) => AtrWorkObs) =>
    onChange(observations.map(o => (o._id === id ? fn(o) : o)));

  const addAnnexure = (id: string, anxId: string) => {
    const anx = pool.find(a => a.id === anxId);
    if (!anx) return;
    patch(id, o => o.annexures.some(a => a.id === anxId)
      ? o
      : { ...o, annexures: [...o.annexures, anx], linkState: 'review' });
    setPicker(null);
  };
  const removeAnnexure = (id: string, anxId: string) =>
    patch(id, o => {
      const annexures = o.annexures.filter(a => a.id !== anxId);
      return { ...o, annexures, linkState: annexures.length === 0 ? 'unlinked' : 'review' };
    });
  const confirmRow = (id: string) =>
    patch(id, o => ({ ...o, linkState: o.annexures.length ? 'confirmed' : 'unlinked' }));

  return (
    <div className="p-6">
      <div className="flex items-start gap-2 border border-brand-200 bg-brand-50/50 rounded-md px-3 py-2 mb-4 text-xs text-brand-700">
        <Link2 size={14} className="mt-0.5 shrink-0" />
        <span><span className="font-semibold">We've linked annexures to observations based on the report.</span> Confirm or adjust each mapping — an observation can link to several annexures, and any left <span className="font-semibold">Unlinked</span> won't create exception cases in Manage Exceptions.</span>
      </div>

      <div className="rounded-lg border border-canvas-border overflow-visible">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1.3fr_88px_120px] gap-3 px-3 py-2 bg-paper-50 border-b border-canvas-border text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
          <span>Observation</span>
          <span>Linked annexure(s)</span>
          <span className="text-right">Rows</span>
          <span className="text-right">Status</span>
        </div>

        <div className="divide-y divide-canvas-border">
          {selected.length === 0 && (
            <div className="px-3 py-10 text-center">
              <Unlink size={20} className="mx-auto text-ink-300 mb-2" />
              <div className="text-sm font-medium text-ink-700">No observations to link</div>
              <div className="text-xs text-ink-500 mt-0.5">Select observations on the previous step to map annexures here.</div>
            </div>
          )}
          {selected.map(o => {
            const meta = STATE_META[o.linkState];
            const rows = o.annexures.reduce((n, a) => n + a.rows, 0);
            const available = pool.filter(a => !o.annexures.some(x => x.id === a.id));
            return (
              <div key={o._id} className="grid grid-cols-[1fr_1.3fr_88px_120px] gap-3 px-3 py-2.5 items-start bg-canvas-elevated">
                <div className="min-w-0">
                  <div className="text-[0.75rem] font-semibold text-ink-900 truncate" title={o.title}>{o.title || 'Untitled Observation'}</div>
                  {o.process && <div className="text-[0.625rem] text-ink-500 truncate">{o.process}</div>}
                </div>

                <div className="min-w-0 relative">
                  <div className="flex flex-wrap gap-1">
                    {o.annexures.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-1 rounded-sm bg-paper-50 border border-canvas-border text-[0.625rem] text-ink-700 max-w-full">
                        <FileSpreadsheet size={10} className="text-compliant-700 shrink-0" />
                        <span className="truncate max-w-[150px]" title={a.name}>{a.name}</span>
                        <button onClick={() => removeAnnexure(o._id, a.id)} className="w-4 h-4 rounded-full hover:bg-risk-50 text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer shrink-0" aria-label="Unlink"><X size={9} /></button>
                      </span>
                    ))}
                    <button onClick={() => setPicker(picker === o._id ? null : o._id)} className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-dashed border-canvas-border text-[0.625rem] font-semibold text-brand-700 hover:border-brand-300 cursor-pointer">
                      <Plus size={10} /> Link annexure
                    </button>
                  </div>
                  {picker === o._id && (
                    <>
                      <div className="fixed inset-0 z-[65]" onClick={() => setPicker(null)} />
                      <div className="absolute left-0 top-full mt-1 z-[70] w-72 max-h-56 overflow-y-auto bg-white border border-canvas-border shadow-xl rounded-lg p-1">
                        {available.length === 0 ? (
                          <div className="px-3 py-3 text-[0.6875rem] text-ink-500 text-center">All annexures linked.</div>
                        ) : available.map(a => (
                          <button key={a.id} onClick={() => addAnnexure(o._id, a.id)} title={a.name} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-sm hover:bg-brand-50 text-left cursor-pointer">
                            <FileSpreadsheet size={13} className="text-compliant-700 shrink-0" />
                            <span className="min-w-0 flex-1"><span className="block text-[0.6875rem] font-medium text-ink-800 truncate">{a.name}</span><span className="block text-[0.5625rem] text-ink-400">{a.rows} exception rows</span></span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="text-right text-[0.75rem] font-semibold text-ink-700 tabular-nums pt-1">{rows || '—'}</div>

                <div className="flex flex-col items-end gap-1.5">
                  <span title={meta.hint} className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[0.625rem] font-semibold cursor-help ${meta.cls}`}>
                    <meta.icon size={10} /> {meta.label}
                  </span>
                  {o.linkState !== 'confirmed' && o.annexures.length > 0 && (
                    <button onClick={() => confirmRow(o._id)} title="Mark this mapping as confirmed" className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-brand-200 bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer"><Check size={11} /> Confirm</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
