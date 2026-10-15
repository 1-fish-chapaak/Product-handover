/**
 * One indicator — what it measures, its seven months against amber and red,
 * and its thresholds, which can be tuned here (the register re-rates on save).
 */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { MONTHS, fmtKri, ragOf, type Kri } from '../../data/erm/model';
import { updateKri } from '../../data/erm/store';
import { KriChart, RagChip } from './riskUi';

export default function KriDrawer({ riskId, riskName, kri, onClose, onOpenRisk }: {
  riskId: string; riskName: string; kri: Kri; onClose: () => void; onOpenRisk?: () => void;
}) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [amber, setAmber] = useState(String(kri.amber));
  const [red, setRed] = useState(String(kri.red));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const a = Number(amber), r = Number(red);
  const valid = Number.isFinite(a) && Number.isFinite(r) && (kri.lowerIsWorse ? r < a : r > a);
  const changed = a !== kri.amber || r !== kri.red;
  const preview: Kri = valid ? { ...kri, amber: a, red: r } : kri;
  const now = kri.values[kri.values.length - 1];

  const save = () => {
    updateKri(riskId, kri.id, { amber: a, red: r });
    addToast({ message: `Thresholds updated — ${riskId} re-rated`, type: 'success' });
    logEvent({ action: 'Update', description: `Changed thresholds on "${kri.name}" (${riskId}) to amber ${a}, red ${r}`, module: 'Risk Register', entity: 'Indicator' });
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-ink-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-label={kri.name}
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="absolute right-0 top-0 h-full w-full max-w-[40rem] bg-canvas-elevated border-l border-canvas-border overflow-y-auto"
      >
        <div className="sticky top-0 bg-canvas-elevated border-b border-canvas-border px-6 py-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[0.6875rem] text-ink-400">
              <span className="inline-flex items-center h-5 px-1.5 rounded bg-brand-50 text-brand-700 font-semibold">{kri.type}</span>
              <button onClick={onOpenRisk} disabled={!onOpenRisk} className="font-mono hover:text-brand-700 disabled:hover:text-ink-400 cursor-pointer disabled:cursor-default">{riskId}</button>
              <span>· {riskName}</span>
            </div>
            <h2 className="mt-1 text-[1.125rem] font-semibold text-ink-900 leading-snug">{kri.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 hover:text-ink-700 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{MONTHS[MONTHS.length - 1]} value</div>
              <div className="mt-1 font-mono text-[1.75rem] font-semibold text-ink-900 leading-none tabular-nums">{fmtKri(kri, now)}</div>
            </div>
            <RagChip rag={ragOf(preview, now)} />
            <p className="ml-auto max-w-[18rem] text-right text-[0.75rem] text-ink-500">{kri.source}</p>
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-ink-700">{kri.defn}.</p>

          <KriChart kri={preview} />

          <div className="rounded-xl border border-canvas-border p-4">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Thresholds</div>
            <p className="mt-1 text-[0.75rem] text-ink-500">{kri.lowerIsWorse ? 'Lower is worse.' : 'Higher is worse.'} Saving re-rates the risk.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[0.75rem] text-ink-600">Amber from
                <input value={amber} onChange={e => setAmber(e.target.value)} inputMode="decimal" className="mt-1 block w-28 h-9 px-3 rounded-lg border border-canvas-border font-mono text-[0.8125rem] outline-none focus:border-brand-300" />
              </label>
              <label className="text-[0.75rem] text-ink-600">Red from
                <input value={red} onChange={e => setRed(e.target.value)} inputMode="decimal" className="mt-1 block w-28 h-9 px-3 rounded-lg border border-canvas-border font-mono text-[0.8125rem] outline-none focus:border-brand-300" />
              </label>
              <Button variant="primary" size="sm" disabled={!valid || !changed} onClick={save}>Save thresholds</Button>
              {!valid && <span className="text-[0.75rem] text-risk-700">Red must be {kri.lowerIsWorse ? 'below' : 'above'} amber.</span>}
            </div>
          </div>

          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-2">By month</div>
            <ul className="grid grid-cols-7 gap-1.5">
              {kri.values.map((v, i) => {
                const g = ragOf(preview, v);
                return (
                  <li key={i} className={`rounded-lg border px-2 py-2 text-center ${g === 2 ? 'border-risk-200 bg-risk-50' : g === 1 ? 'border-mitigated-200 bg-mitigated-50' : 'border-canvas-border'}`}>
                    <div className="text-[0.625rem] text-ink-500">{MONTHS[i]}</div>
                    <div className="font-mono text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmtKri(kri, v)}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
