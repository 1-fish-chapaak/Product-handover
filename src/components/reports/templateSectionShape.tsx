// The shape a template section shows on the report page — the body placeholder
// that stands in for the content this section will hold at generation.
//
// Shared by the two surfaces that print a template as a document: the editor's
// live preview (where the heading and description are editable around it) and
// the read-only full-page Template preview. One renderer means the preview a
// user opens from the Templates list is literally the page the editor builds.

import type { ReactNode } from 'react';
import TemplateBlockBody from './TemplateBlockBody';
import { FILL_META, fillTag } from './sectionReviewShared';
import type { TemplateSection, TemplateBlock, ScaleMap } from './reportShared';
import type { ReportFacts } from './byot/templateBinding';
import type { CardFinding } from './TemplateBlockBody';

/** Data to draw the shape WITH, where a surface has some. The template
 *  surfaces pass nothing and get the empty shape; the preview before saving
 *  passes made-up findings, which is the point of that step. */
export type ShapeFill = {
  facts?: ReportFacts;
  cards?: CardFinding[];
  findingScale?: string[];
  scaleMap?: ScaleMap;
};

/** The small chip beside the heading — where this section's content comes from. */
export function sectionTypeLabel(section: TemplateSection): string | null {
  const kind = section.kind ?? 'text';
  const blocks = section.blocks ?? [];
  const onlyProse = blocks.length > 0 && blocks.every(b => (b.kind === 'narrative' || b.kind === 'callout') && b.fill === 'query');
  const showBlocks = blocks.length > 0 && !onlyProse;
  // The tag the review screen agreed on, printed on the page it produced, so
  // one part carries one tag wherever it is shown.
  if (showBlocks || section.fill) {
    const frame = blocks.length > 0 && blocks.every(b => b.fill !== 'fixed' || b.frame);
    return fillTag(section.fill ?? 'query', frame).label;
  }
  return kind === 'kpi' ? 'KPI'
    : kind === 'table' ? 'Table'
    : kind === 'chart' ? 'Chart'
    : kind === 'cards' ? `Card × ${section.cardCount ?? 'N'}`
    : kind === 'human' ? 'Human input'
    : section.fixed ? FILL_META.fixed.label
    : null;
}

/** The section body. Returns null for a plain prose section — the caller decides
 *  what to render there (an editable description, or the description as text). */
export function renderSectionShape(
  section: TemplateSection,
  blockLibrary: Record<string, TemplateBlock> | undefined,
  shownDesc: string,
  fill?: ShapeFill,
): ReactNode | null {
  const kind = section.kind ?? 'text';
  const metric = section.metric?.trim();
  const blocks = section.blocks ?? [];
  const onlyProse = blocks.length > 0 && blocks.every(b => (b.kind === 'narrative' || b.kind === 'callout') && b.fill === 'query');
  const showBlocks = blocks.length > 0 && !onlyProse;

  if (showBlocks) {
    return (
      <div className="space-y-3">
        <p className="max-w-[80ch] text-[0.875rem] leading-relaxed text-ink-600">{shownDesc}</p>
        <TemplateBlockBody
          tsec={section}
          blockLibrary={blockLibrary}
          facts={fill?.facts}
          cards={fill?.cards}
          findingScale={fill?.findingScale}
          scaleMap={fill?.scaleMap}
        />
      </div>
    );
  }
  if (kind === 'kpi') {
    return (
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <div className="text-[1.75rem] font-bold text-ink-300 leading-none tabular-nums">—</div>
          <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-1.5">{metric || 'Metric'}</div>
        </div>
        <p className="text-[0.75rem] text-ink-400 leading-relaxed">KPI filled from query data at generation.</p>
      </div>
    );
  }
  if (kind === 'chart') {
    return (
      <div className="max-w-[75%]">
        <div className="flex items-end gap-1.5 h-14">
          {(section.chartType ?? 'bar') === 'bar'
            ? [40, 68, 30, 82, 54, 72].map((h, k) => <div key={k} className="flex-1 rounded-t-xs bg-canvas-border" style={{ height: `${h}%` }} />)
            : <svg viewBox="0 0 120 40" className="w-full h-full text-canvas-border" preserveAspectRatio="none"><polyline points="0,32 24,20 48,26 72,10 96,16 120,6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
        </div>
        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-2">{metric || 'Metric'} · {(section.chartType ?? 'bar')} chart</p>
      </div>
    );
  }
  if (kind === 'table') {
    return (
      <div className="max-w-[90%]">
        <div className="rounded-sm overflow-hidden border border-canvas-border">
          {section.columns?.length ? (
            <div className="flex bg-canvas">
              {section.columns.slice(0, 6).map(c => (
                <div key={c} className="flex-1 min-w-0 truncate border-r last:border-r-0 border-canvas-border px-2 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500">{c}</div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 bg-canvas">
              {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-4 border-r last:border-r-0 border-canvas-border" />)}
            </div>
          )}
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex border-t border-canvas-border">
              {Array.from({ length: section.columns?.length ? Math.min(section.columns.length, 6) : 4 }).map((_, c) => <div key={c} className="h-4 flex-1 border-r last:border-r-0 border-canvas-border" />)}
            </div>
          ))}
        </div>
        {section.linkedTo && (
          <p className="mt-1.5 text-[0.6875rem] text-ink-400">Built automatically from “{section.linkedTo}”, so the two sections can’t disagree.</p>
        )}
      </div>
    );
  }
  if (kind === 'cards') {
    return (
      <div className="max-w-[90%]">
        <div className="relative">
          <div className="absolute inset-x-2 -bottom-1.5 h-full rounded-md border border-canvas-border bg-canvas/60" aria-hidden="true" />
          <div className="relative rounded-md border border-canvas-border bg-white px-3.5 py-3" style={{ borderLeft: '3px solid var(--rep-accent, #550fa5)' }}>
            <div className="flex items-center gap-2">
              {section.idPattern && <span className="font-mono text-[0.75rem] font-semibold" style={{ color: 'var(--rep-accent, #550fa5)' }}>{section.idPattern}</span>}
              <span className="h-2 w-32 rounded-full bg-canvas-border" />
            </div>
            {(section.cardFields ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(section.cardFields ?? []).map(f => {
                  const human = (section.humanFields ?? []).some(h => h.toLowerCase() === f.toLowerCase());
                  return (
                    <span key={f} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${human ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-500'}`}>
                      {f}{human && <span className="font-normal">· a person fills this</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <p className="mt-2.5 text-[0.6875rem] text-ink-400">This card repeats once per finding{section.cardCount ? `. Your report carried ${section.cardCount}` : ''}.</p>
      </div>
    );
  }
  if (kind === 'human') {
    return (
      <div className="max-w-[80%] rounded-md border border-dashed border-mitigated-300 bg-mitigated-50/40 px-3.5 py-3">
        <p className="text-[0.8125rem] font-medium text-mitigated-700">Awaiting response. Only a real person fills this in.</p>
      </div>
    );
  }
  if (section.fixed) {
    return (
      <div className="max-w-[80ch] rounded-md border border-canvas-border bg-canvas/40 px-3.5 py-3">
        <p className="text-[0.8125rem] text-ink-600 leading-relaxed line-clamp-3">{(section.fixedBody ?? []).join(' ') || shownDesc}</p>
        <p className="mt-1.5 text-[0.6875rem] text-ink-400">Prints exactly as written, every time. Never rewritten at generation.</p>
      </div>
    );
  }
  return null;
}
