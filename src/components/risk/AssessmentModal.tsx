/** Record an assessment — re-rate likelihood and impact, see the result first. */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { NOW, TIER_ACTION, type ErmRisk } from '../../data/erm/model';
import { scoreRisk, type ScoreContext } from '../../data/erm/score';
import { recordAssessment } from '../../data/erm/store';
import { TierChip } from './riskUi';
import { Scale } from './RiskEditorDrawer';

const L_LABEL = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const I_LABEL = ['Minor', 'Moderate', 'Significant', 'Major', 'Severe'];

export default function AssessmentModal({ risk, ctx, by, onClose }: { risk: ErmRisk; ctx: ScoreContext; by: string; onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [l, setL] = useState(risk.likelihood);
  const [i, setI] = useState(risk.impact);
  const [note, setNote] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const before = scoreRisk(risk, ctx, NOW);
  const after = scoreRisk({ ...risk, likelihood: l, impact: i }, ctx, NOW);
  const save = () => {
    recordAssessment(risk.id, { likelihood: l, impact: i, note: note.trim() || 'Reassessed', by });
    addToast({ message: `${risk.id} reassessed — now ${after.tier}`, type: 'success' });
    logEvent({ action: 'Update', description: `Reassessed ${risk.id}: L${risk.likelihood}×I${risk.impact} → L${l}×I${i}`, module: 'Risk Register', entity: 'Risk' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-ink-900/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog" aria-label={`Assess ${risk.id}`}
        initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="relative w-full max-w-[32rem] rounded-2xl border border-canvas-border bg-canvas-elevated"
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <div className="font-mono text-[0.6875rem] text-ink-400">{risk.id}</div>
            <h2 className="text-[1.125rem] font-semibold text-ink-900 leading-snug">Record assessment</h2>
            <p className="text-[0.8125rem] text-ink-500 truncate">{risk.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 pb-5 space-y-4">
          <Scale label="Likelihood" value={l} onChange={setL} names={L_LABEL} />
          <Scale label="Impact" value={i} onChange={setI} names={I_LABEL} />
          <label className="block text-[0.75rem] font-medium text-ink-700">Why
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What changed — a new incident, a control going live, the business changing" className="mt-1 w-full px-3 py-2 rounded-lg border border-canvas-border text-[0.8125rem] outline-none focus:border-brand-300 resize-none" />
          </label>
          <div className="rounded-xl bg-canvas border border-canvas-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
              <span className="text-ink-500">Residual</span>
              <span className="font-mono font-semibold tabular-nums">{before.score.toFixed(1)}</span>
              <ArrowRight size={12} className="text-ink-400" aria-hidden />
              <span className="font-mono font-semibold tabular-nums text-ink-900">{after.score.toFixed(1)}</span>
              <TierChip tier={before.tier} size="sm" />
              <ArrowRight size={12} className="text-ink-400" aria-hidden />
              <TierChip tier={after.tier} size="sm" />
            </div>
            <p className="mt-1 text-[0.75rem] text-ink-500">{TIER_ACTION[after.tier]}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-canvas-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Record assessment</Button>
        </div>
      </motion.div>
    </div>
  );
}
