import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';

// ─── Canonical report/grid card ──────────────────────────────────────────────
//
// One card for every Reports grid (All · IA · ATR · SOX · Evidence · Shared),
// mirroring the Templates-tab card exactly: a type-tinted icon tile + uppercase
// category eyebrow that swaps to a hover arrow, title, a description line, and a
// footer of bordered chips (left) with the date / hover-actions (right). Every
// tab maps its own data into the same slots so the cards are identical.

export interface ReportCardProps {
  icon: React.ElementType;
  /** Tailwind classes for the icon tile + eyebrow — must include a `bg-*` and a
   *  `text-*`, e.g. "bg-brand-50 text-brand-700". */
  iconClass?: string;
  /** Short uppercase category label (type, status, file type…). */
  eyebrow?: string;
  title: string;
  /** Secondary line under the title — the row's meta (e.g. "7 queries · SOX"). */
  subtitle?: ReactNode;
  description?: ReactNode;
  /** Footer chips (entity-style bordered pills). Shows up to `maxPills`, rest as +N. */
  pills?: string[];
  maxPills?: number;
  /** Right of the footer at rest (usually the date). */
  footerRight?: ReactNode;
  /** Hover-revealed action icons, overlaid on the footer-right. */
  actions?: ReactNode;
  onClick?: () => void;
  index?: number;
  /** Multi-select — checkbox overlays the icon tile; selected = brand border. */
  selectable?: boolean;
  selected?: boolean;
  isSelecting?: boolean;
  onToggleSelect?: () => void;
}

export default function ReportCard({
  icon: Icon, iconClass = 'bg-brand-50 text-brand-700', eyebrow,
  title, subtitle, description, pills = [], maxPills = 3, footerRight, actions, onClick, index = 0,
  selectable, selected, isSelecting, onToggleSelect,
}: ReportCardProps) {
  const iconBg = iconClass.split(' ').find(c => c.startsWith('bg-')) ?? 'bg-brand-50';
  const tone = iconClass.split(' ').find(c => c.startsWith('text-')) ?? 'text-brand-700';
  // Show as many chips as fit a single row (character budget), rest as +N — the
  // Templates-card behaviour. Never wrap to a second line.
  const PILL_BUDGET = 26;
  let count = 0, used = 0;
  for (let k = 0; k < pills.length && k < maxPills; k++) {
    const next = used + pills[k].length;
    if (k > 0 && next > PILL_BUDGET) break;
    used = next; count = k + 1;
  }
  const shown = pills.slice(0, count);
  const overflow = pills.length - count;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      onClick={() => { if (selectable && isSelecting) onToggleSelect?.(); else onClick?.(); }}
      aria-pressed={selectable ? (selected || undefined) : undefined}
      className={`bg-canvas-elevated border rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:shadow-[0_12px_32px_rgba(15,8,30,0.08)] transition-[box-shadow,border-color] duration-200 group cursor-pointer flex flex-col min-h-[176px] ${selected ? 'border-brand-400' : 'border-canvas-border hover:border-brand-300'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
          {/* Type tile — present at rest, fades out so the checkbox sits cleanly on the card. */}
          <span aria-hidden="true" className={`absolute inset-0 rounded-[10px] flex items-center justify-center ${iconBg} transition-[opacity,transform] duration-200 group-hover:scale-[1.06] ${selectable ? (selected || isSelecting ? 'opacity-0' : 'opacity-100 group-hover:opacity-0') : 'opacity-100'}`}>
            <Icon size={16} className={tone} strokeWidth={1.75} />
          </span>
          {selectable && (
            <span
              role="checkbox"
              aria-checked={selected}
              aria-label={selected ? 'Deselect report' : 'Select report'}
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleSelect?.(); } }}
              className={`relative w-4 h-4 rounded-[5px] border flex items-center justify-center transition-opacity duration-150 cursor-pointer ${
                selected
                  ? 'bg-brand-600 border-brand-600 text-white opacity-100'
                  : isSelecting
                    ? 'bg-paper-0 border-ink-300 opacity-100 hover:border-brand-500'
                    : 'bg-paper-0 border-ink-300 opacity-0 group-hover:opacity-100 hover:border-brand-500'
              }`}
            >
              {selected && <Check size={11} strokeWidth={3} />}
            </span>
          )}
        </div>
        {eyebrow && (
          <div className="relative flex items-center h-7">
            <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] transition-opacity duration-200 group-hover:opacity-0 ${tone}`}>
              {eyebrow}
            </span>
            <span aria-hidden className="absolute right-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/[0.07] text-primary opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-out">
              <ArrowRight size={14} />
            </span>
          </div>
        )}
      </div>

      <h3 className="text-[15px] leading-[1.35] font-semibold text-text group-hover:text-primary transition-colors mb-1.5 truncate" title={title}>{title}</h3>
      {subtitle && <p className="text-[12px] text-text-secondary leading-[1.55] line-clamp-1">{subtitle}</p>}
      {description && <p className="text-[12px] text-text-secondary leading-[1.55] line-clamp-2" title={typeof description === 'string' ? description : undefined}>{description}</p>}

      <div className="mt-auto pt-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {shown.map(p => (
            p === 'Bulk Audit' ? (
              // Indigo bordered chip — the distinct engagement-type tag,
              // matching the table's BULK_PILL.
              <span key={p} className="inline-flex items-center h-6 px-2.5 rounded-full border border-mitigated/30 bg-mitigated-50 text-mitigated-700 text-[11px] font-semibold whitespace-nowrap shrink-0">{p}</span>
            ) : (
              <span key={p} className="inline-flex items-center h-6 px-2.5 rounded-full border border-canvas-border bg-paper-50/70 text-[11px] font-medium text-ink-600 whitespace-nowrap shrink-0">{p}</span>
            )
          ))}
          {overflow > 0 && (
            <span className="inline-flex items-center h-6 px-2 rounded-full border border-canvas-border bg-canvas-elevated text-[11px] font-medium text-ink-500 tabular-nums shrink-0">+{overflow}</span>
          )}
        </div>
        {(footerRight || actions) && (
          <div className="relative shrink-0 flex items-center">
            {footerRight && <span className={actions ? 'group-hover:opacity-0 transition-opacity' : ''}>{footerRight}</span>}
            {actions && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
