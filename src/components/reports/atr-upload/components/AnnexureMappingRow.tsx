import { Eye, Pencil, Unlink, Link as LinkIcon, Check } from 'lucide-react';
import { Pill, type Tone } from '../../../shared/StatusBadge';
import type { ExtractedAnnexure } from '../types';

const STATUS_TONE: Record<ExtractedAnnexure['status'], Tone> = {
  Confirmed: 'compliant', 'Needs Review': 'mitigated', Unlinked: 'draft',
};

/** One annexure row in the Screen 5 mapping table. */
export default function AnnexureMappingRow({
  annex, observationLabel, onConfirm, onEdit, onUnlink, onView,
}: {
  annex: ExtractedAnnexure;
  /** Linked observation's title, or null when orphan/unlinked. */
  observationLabel: string | null;
  onConfirm: () => void;
  onEdit: () => void;
  onUnlink: () => void;
  onView: () => void;
}) {
  const linked = !!annex.observationId;
  return (
    <tr className="border-t border-canvas-border hover:bg-canvas/60">
      <td className="px-4 py-3 align-top">
        {linked ? (
          <span className="text-[12.5px] text-ink-800">{observationLabel}</span>
        ) : (
          <span className="text-[12px] text-mitigated-700">Orphan — link manually or remove</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-[12.5px] font-medium text-ink-800">{annex.filename}</span>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <span className="text-[12.5px] tabular-nums text-ink-700">{annex.rows.length}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <Pill tone={STATUS_TONE[annex.status]}>{annex.status}</Pill>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <IconBtn icon={Eye} label="View annexure" onClick={onView} />
          {linked && annex.status === 'Needs Review' && <IconBtn icon={Check} label="Confirm link" onClick={onConfirm} tone="compliant" />}
          <IconBtn icon={linked ? Pencil : LinkIcon} label={linked ? 'Edit link' : 'Link manually'} onClick={onEdit} />
          {linked && <IconBtn icon={Unlink} label="Unlink" onClick={onUnlink} tone="risk" />}
        </div>
      </td>
    </tr>
  );
}

function IconBtn({ icon: Icon, label, onClick, tone }: { icon: typeof Eye; label: string; onClick: () => void; tone?: 'compliant' | 'risk' }) {
  const color = tone === 'compliant' ? 'hover:text-compliant-700' : tone === 'risk' ? 'hover:text-risk-700' : 'hover:text-brand-700';
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`w-7 h-7 inline-flex items-center justify-center rounded-[6px] text-ink-400 ${color} hover:bg-canvas-border/50 cursor-pointer transition-colors`}>
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}
