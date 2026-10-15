/**
 * Risk register — shared parts. Tiers read as one ink: the deeper the purple,
 * the higher the rating (a single-hue ramp, never a red→green heat strip).
 * Indicator status keeps its own words — Red, Amber, Green — one at a time.
 */
import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, CircleSlash, Clock3, FileSearch, Info, PenLine } from 'lucide-react';
import type { ControlStatus } from '../../data/erm/controls';
import { MONTHS, TIERS_DESC, type Kri, type Rag, type Tier, ragOf } from '../../data/erm/model';
import { RAG_LABEL, TIER_FILL, heatFill } from './riskTheme';

const CONTROL_GLYPH: Record<ControlStatus, { icon: typeof CircleCheck; cls: string; label: string }> = {
  live: { icon: CircleCheck, cls: 'text-compliant-700', label: 'Live' },
  'awaiting-review': { icon: Clock3, cls: 'text-evidence-700', label: 'Awaiting review' },
  'needs-data': { icon: CircleDashed, cls: 'text-mitigated-700', label: 'Needs data' },
  manual: { icon: FileSearch, cls: 'text-ink-500', label: 'Manual test' },
  'no-workflow': { icon: CircleSlash, cls: 'text-high-700', label: 'No workflow' },
  draft: { icon: PenLine, cls: 'text-ink-400', label: 'Draft' },
};

/** A control's status as the Control Library shows it — icon plus word. */
export function ControlGlyph({ status, size = 12 }: { status: ControlStatus; size?: number }) {
  const g = CONTROL_GLYPH[status];
  const Icon = g.icon;
  return <Icon size={size} className={`${g.cls} shrink-0`} aria-label={g.label} />;
}

export function TierChip({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' | 'lg' }) {
  const [bg, fg] = TIER_FILL[tier];
  const cls = size === 'lg' ? 'h-7 px-3 text-[0.8125rem]' : size === 'sm' ? 'h-5 px-1.5 text-[0.6875rem]' : 'h-6 px-2 text-[0.75rem]';
  return (
    <span className={`inline-flex items-center rounded-full font-sans font-semibold whitespace-nowrap ${cls}`} style={{ background: bg, color: fg }}>
      {tier}
    </span>
  );
}

const RAG_CLS = ['bg-compliant-50 text-compliant-700', 'bg-mitigated-50 text-mitigated-700', 'bg-risk-50 text-risk-700'];

export function RagChip({ rag }: { rag: Rag }) {
  return <span className={`inline-flex items-center h-5 px-1.5 rounded text-[0.6875rem] font-semibold ${RAG_CLS[rag]}`}>{RAG_LABEL[rag]}</span>;
}

/** Seven months of an indicator — red solid, amber half, green quiet. */
export function RagStrip({ kri, values }: { kri: Kri; values?: number[] }) {
  const v = values ?? kri.values;
  return (
    <span className="inline-flex items-center gap-[2px]" aria-label={`${kri.name}, ${MONTHS[0]} to ${MONTHS[MONTHS.length - 1]}`}>
      {v.map((x, i) => {
        const r = ragOf(kri, x);
        return (
          <i
            key={i}
            title={`${MONTHS[i]}: ${RAG_LABEL[r]}`}
            className={`block w-2.5 h-3.5 rounded-xs ${r === 2 ? 'bg-risk-600' : r === 1 ? 'bg-mitigated-300' : 'bg-paper-200'}`}
          />
        );
      })}
    </span>
  );
}

export function Delta({ d, digits = 1, invert = false }: { d: number; digits?: number; invert?: boolean }) {
  if (Math.abs(d) < 0.05) return <span className="text-[0.6875rem] text-ink-400 tabular-nums">0.0</span>;
  const worse = invert ? d < 0 : d > 0;
  return (
    <span className={`text-[0.6875rem] font-semibold tabular-nums ${worse ? 'text-risk-700' : 'text-compliant-700'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(digits)}
    </span>
  );
}

export function Spark({ values, width = 84, height = 22, color = '#6A12CD' }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`);
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.25} fill={color} />
    </svg>
  );
}

export function HeatCell({ v, title, onClick, wide, display }: { v: number | null; title?: string; onClick?: () => void; wide?: boolean; /** Shown instead of the value (colour still follows the value). */ display?: string }) {
  if (v == null) return <span className={`inline-flex items-center justify-center h-7 ${wide ? 'w-16' : 'w-12'} rounded-md text-[0.75rem] text-ink-300`}>—</span>;
  const [bg, fg] = heatFill(v);
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={title}
      className={`inline-flex items-center justify-center h-7 ${wide ? 'w-16' : 'w-12'} rounded-md font-mono text-[0.75rem] font-semibold tabular-nums ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-brand-300' : ''}`}
      style={{ background: bg, color: fg }}
    >
      {display ?? v.toFixed(0)}
    </Tag>
  );
}

/** Stacked tier mix, highest first. */
export function MixBar({ counts, total, height = 8 }: { counts: Record<Tier, number>; total: number; height?: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-paper-100" style={{ height }}>
      {TIERS_DESC.map(t => counts[t] ? (
        <span key={t} title={`${t}: ${counts[t]}`} style={{ width: `${(100 * counts[t]) / Math.max(1, total)}%`, background: TIER_FILL[t][0] }} />
      ) : null)}
    </div>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} className="inline-flex text-ink-300 hover:text-ink-500 cursor-help align-middle">
      <Info size={13} />
    </span>
  );
}

export function Panel({ title, tip, right, children, flush, className = '' }: { title: ReactNode; tip?: string; right?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`rounded-xl border border-canvas-border bg-canvas-elevated ${className}`}>
      <header className="flex items-center gap-2 px-5 h-12 border-b border-canvas-border">
        <h3 className="text-[0.875rem] font-semibold text-ink-900">{title}</h3>
        {tip && <Tip text={tip} />}
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, swatch, onClick, active }: { label: ReactNode; value: ReactNode; sub?: ReactNode; swatch?: string; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`text-left rounded-xl border bg-canvas-elevated px-4 py-3.5 transition-colors ${active ? 'border-brand-300' : 'border-canvas-border'} ${onClick ? 'cursor-pointer hover:border-brand-200' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
        {swatch && <span className="size-2.5 rounded-sm" style={{ background: swatch }} aria-hidden />}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[1.625rem] font-semibold leading-none text-ink-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-[0.75rem] leading-snug text-ink-500">{sub}</div>}
    </Tag>
  );
}

/** Residual score over the window, against the tier bands it moves through. */
export function ScoreChart({ history, tiers, events = [], width = 560, height = 200 }: {
  history: number[]; tiers: Tier[]; events?: { m: number; text: string }[]; width?: number; height?: number;
}) {
  const padL = 30, padR = 64, padT = 14, padB = 24;
  const w = width - padL - padR, h = height - padT - padB;
  const top = Math.max(75, Math.ceil(Math.max(...history) / 15) * 15 + 5);
  const y = (v: number) => padT + h - (Math.min(v, top) / top) * h;
  const x = (i: number) => padL + (i / (history.length - 1)) * w;
  const bands: [Tier, number, number][] = [['Low', 0, 15], ['Medium', 15, 30], ['High', 30, 45], ['Very High', 45, 60], ['Critical', 60, top]];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Residual score, April to October">
      {bands.map(([t, a, b]) => (
        <g key={t}>
          <rect x={padL} y={y(b)} width={w} height={y(a) - y(b)} fill={TIER_FILL[t][0]} opacity={t === 'Low' ? 0.5 : 0.16} />
          <text x={padL + w + 6} y={(y(a) + y(b)) / 2 + 3} fontSize="10" fill="#9A8FAE">{t}</text>
        </g>
      ))}
      {[0, 15, 30, 45, 60].map(v => <text key={v} x={padL - 6} y={y(v) + 3} fontSize="10" fill="#9A8FAE" textAnchor="end">{v}</text>)}
      {events.map((e, i) => (
        <line key={i} x1={x(e.m)} x2={x(e.m)} y1={padT} y2={padT + h} stroke="#B42318" strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />
      ))}
      <polyline points={history.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#3B0764" strokeWidth={2} strokeLinejoin="round" />
      {history.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={4} fill={TIER_FILL[tiers[i]][0]} stroke="#3B0764" strokeWidth={1.25} />
          <text x={x(i)} y={y(v) - 8} fontSize="10" fontWeight="600" fill="#1F1433" textAnchor="middle">{v.toFixed(0)}</text>
          <text x={x(i)} y={height - 6} fontSize="10" fill="#9A8FAE" textAnchor="middle">{MONTHS[i]}</text>
        </g>
      ))}
    </svg>
  );
}

/** An indicator against its amber and red thresholds. */
export function KriChart({ kri, width = 520, height = 180 }: { kri: Kri; width?: number; height?: number }) {
  const padL = 40, padR = 54, padT = 16, padB = 24;
  const w = width - padL - padR, h = height - padT - padB;
  const vals = kri.values;
  const hi = Math.max(...vals, kri.red, kri.amber) * 1.15 || 1;
  const lo = Math.min(0, ...vals);
  const y = (v: number) => padT + h - ((v - lo) / (hi - lo)) * h;
  const x = (i: number) => padL + (i / (vals.length - 1)) * w;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`${kri.name} by month`}>
      {[['Red', kri.red, '#B42318'], ['Amber', kri.amber, '#B45309']].map(([l, v, c]) => (
        <g key={l as string}>
          <line x1={padL} x2={padL + w} y1={y(v as number)} y2={y(v as number)} stroke={c as string} strokeDasharray="4 3" strokeWidth={1} />
          <text x={padL + w + 6} y={y(v as number) + 3} fontSize="10" fill={c as string}>{l} {v}</text>
        </g>
      ))}
      <polyline points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#3B0764" strokeWidth={2} />
      {vals.map((v, i) => {
        const r = ragOf(kri, v);
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={4} fill={r === 2 ? '#B42318' : r === 1 ? '#F59E0B' : '#FFFFFF'} stroke="#3B0764" strokeWidth={1.25} />
            <text x={x(i)} y={y(v) - 8} fontSize="10" fontWeight="600" fill="#1F1433" textAnchor="middle">{Number.isInteger(v) ? v : v.toFixed(1)}</text>
            <text x={x(i)} y={height - 6} fontSize="10" fill="#9A8FAE" textAnchor="middle">{MONTHS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Treemap (squarified) ───────────────────────────────────────────────────

export interface TreeItem { id: string; label: string; sub: string; value: number; fill: string; ink: string; title?: string }
interface Rect { x: number; y: number; w: number; h: number }

function squarify(items: TreeItem[], rect: Rect): (TreeItem & Rect)[] {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const area = rect.w * rect.h;
  const nodes = items.map(i => ({ ...i, area: (i.value / total) * area })).sort((a, b) => b.area - a.area);
  const out: (TreeItem & Rect)[] = [];
  let { x, y, w, h } = rect;
  let row: typeof nodes = [];
  const worst = (r: typeof nodes, side: number) => {
    const s = r.reduce((a, n) => a + n.area, 0);
    const mx = Math.max(...r.map(n => n.area)), mn = Math.min(...r.map(n => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layout = (r: typeof nodes) => {
    const s = r.reduce((a, n) => a + n.area, 0);
    if (w >= h) {
      const cw = s / h; let cy = y;
      r.forEach(n => { const ch = n.area / cw; out.push({ ...n, x, y: cy, w: cw, h: ch }); cy += ch; });
      x += cw; w -= cw;
    } else {
      const ch = s / w; let cx = x;
      r.forEach(n => { const cw = n.area / ch; out.push({ ...n, x: cx, y, w: cw, h: ch }); cx += cw; });
      y += ch; h -= ch;
    }
  };
  for (const n of nodes) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layout(row); row = [n]; }
  }
  if (row.length) layout(row);
  return out;
}

export function Treemap({ items, onPick, height = 300 }: { items: TreeItem[]; onPick: (id: string) => void; height?: number }) {
  const W = 1000;
  const cells = squarify(items.filter(i => i.value > 0), { x: 0, y: 0, w: W, h: height });
  return (
    <div className="relative w-full" style={{ height }}>
      {cells.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          title={c.title ?? c.label}
          className="absolute text-left overflow-hidden border-[1.5px] border-white rounded-md p-2.5 cursor-pointer transition-[filter] hover:brightness-[0.96] focus-visible:z-10"
          style={{ left: `${(c.x / W) * 100}%`, top: c.y, width: `${(c.w / W) * 100}%`, height: c.h, background: c.fill, color: c.ink }}
        >
          <span className="block text-[0.8125rem] font-semibold leading-tight truncate">{c.label}</span>
          <span className="block text-[0.6875rem] leading-snug opacity-80 truncate">{c.sub}</span>
        </button>
      ))}
    </div>
  );
}
