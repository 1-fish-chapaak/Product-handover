// Typed template blocks inside a generated report — a BYOT section renders its
// blocks in order, each by its own fill case:
//   query  → filled from audit data (cards stamped, linked tables derived)
//   manual → the shape kept, rendered empty, "No data connected" — never AI-invented
//   fixed  → prints word-for-word, the AI is locked out of rewriting it
//   human  → a prompted empty state only a real person may fill
// Legacy single-kind sections (older saved templates) translate to one block.

import { useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { resolveBlock } from './reportShared';
import { resolveBlock as bindBlock, type ReportFacts } from './byot/templateBinding';
import type { TemplateBlock, TemplateSection } from './reportShared';

/** One finding from the report's evidence pool, stamped into a repeating card
 *  or a linked action-plan row.
 *
 *  THE TREE: query → finding → exceptions. One finding is one query card — its
 *  rating, its written finding, its recommendation. The exceptions are the
 *  flagged rows underneath it, which is where its own counts and its evidence
 *  annexure come from. */
export type CardFinding = {
  title: string;
  severity: string;
  /** The written finding itself, as the query card states it. */
  narrative?: string;
  recommendation?: string;
  owner?: string;
  /** This finding's own exception counts — "47 total, 25 open, 22 closed". */
  counts?: { total?: string; open?: string; closed?: string };
  /** The flagged rows behind this finding, which an evidence annexure prints. */
  evidence?: { title: string; columns: string[]; rows: string[][] };
};

// Which card field carries what — matched against the client's own labels.
// Only the condition-like field carries the finding text; criteria/cause/effect
// stay empty ("—") until real audit data fills them.
const FIELD_TEXT_RE = /condition|observation|finding|description|issue/i;
/** A count box ON THE CARD is that finding's own exception counts, not the
 *  report-level rollup: "47 total, 25 open, 22 closed" for this finding. */
const FIELD_COUNT_RE = /\b(total|open|closed|exceptions?|instances?|records?|samples?|count|no\.|number)\b/i;
const FIELD_REC_RE = /recommendation|action|agreed/i;
const FIELD_OWNER_RE = /owner|responsib/i;
const FIELD_DATE_RE = /due|deadline|target date|timeline/i;
const FIELD_RATING_RE = /rating|risk level|severity|priority/i;
const FIELD_REF_RE = /^(ref|id|no\.?|#)/i;
const FIELD_STATUS_RE = /status/i;

/** Say a severity in the template's own rating words (captured at import). */
function rateIn(scale: string[] | undefined, severity: string): string {
  if (!scale || scale.length === 0) return severity;
  const hit = scale.find(s => s.toLowerCase() === severity.toLowerCase());
  if (hit) return hit;
  const s = severity.toLowerCase();
  if (s === 'high' || s === 'critical') return scale[0];
  if (s === 'medium' || s === 'moderate') return scale[Math.floor((scale.length - 1) / 2)];
  return scale[scale.length - 1];
}

function severityTint(severity: string): string {
  const s = severity.toLowerCase();
  if (s === 'medium' || s === 'moderate') return 'bg-mitigated-50 text-mitigated-700';
  if (s === 'low' || s === 'minor') return 'bg-compliant-50 text-compliant-700';
  return 'bg-risk-50 text-risk-700';
}

/** Generate a display ID from the captured shape: "IA-##-H##" → "IA-26-H01".
 *  The last digit run counts the finding; earlier runs read as the year. */
function idFromPattern(pattern: string | undefined, index: number): string {
  if (!pattern) return `F-${String(index + 1).padStart(2, '0')}`;
  const total = (pattern.match(/#+/g) ?? []).length;
  const year = String(new Date().getFullYear());
  let seen = 0;
  return pattern.replace(/#+/g, run => {
    seen++;
    return seen === total ? String(index + 1).padStart(run.length, '0') : year.slice(-run.length);
  });
}

/** The value a card field or table column shows for one finding. Human fields
 *  return null — the caller renders the awaiting slot instead. */
function fieldValue(label: string, f: CardFinding, id: string, ratedAs: string): string | null {
  if (FIELD_REF_RE.test(label)) return id;
  if (FIELD_RATING_RE.test(label)) return ratedAs;
  if (FIELD_REC_RE.test(label)) return f.recommendation ?? '—';
  if (FIELD_OWNER_RE.test(label)) return f.owner ?? '—';
  if (FIELD_DATE_RE.test(label)) return '—';
  if (FIELD_STATUS_RE.test(label)) return 'Open';
  // A count box on the card counts THIS finding's exceptions, from the query
  // that raised it. The report-level rollup is a different block.
  if (FIELD_COUNT_RE.test(label) && f.counts) {
    const c = f.counts;
    if (/\bopen|outstanding|unresolved\b/i.test(label)) return c.open ?? '—';
    if (/\bclosed|resolved|remediated\b/i.test(label)) return c.closed ?? '—';
    if (c.total) return c.total;
  }
  // The written finding, as the query card states it. Its title is the headline
  // above; the narrative is the finding itself.
  if (FIELD_TEXT_RE.test(label)) return f.narrative ?? f.title;
  return null;
}

const AWAITING = (prompt?: string) => (
  <div className="rounded-md border border-dashed border-mitigated-300 bg-mitigated-50/40 px-3 py-2">
    <p className="text-[0.8125rem] text-mitigated-700 font-medium">{prompt || 'Awaiting response'}</p>
    <p className="text-[0.6875rem] text-mitigated-700/70 mt-0.5">Only a real person fills this in, never the AI.</p>
  </div>
);

/** A human-input prompt in the block's own words — ghost text shaped to what
 *  the block is, since these can never be guessed. */
function humanPrompt(label?: string): string {
  const l = (label ?? '').toLowerCase();
  if (/scope/.test(l)) return 'List the areas covered in this audit';
  if (/objective/.test(l)) return 'State what this audit set out to test';
  if (/management|auditee/.test(l)) return 'Awaiting management’s response';
  return 'Awaiting input';
}

/** Translate a legacy single-kind section into one typed block, so old saved
 *  templates render through the same block path. */
function legacyBlocks(tsec: TemplateSection): TemplateBlock[] {
  if (tsec.blocks?.length) return tsec.blocks;
  const kind = tsec.kind ?? 'text';
  if (kind === 'cards') {
    return [{ kind: 'cards', fill: 'query', binding: 'findings', cardFields: tsec.cardFields, humanFields: tsec.humanFields, idPattern: tsec.idPattern, cardCount: tsec.cardCount }];
  }
  if (kind === 'table') return [{ kind: 'table', fill: tsec.linkedTo ? 'query' : 'manual', binding: tsec.linkedTo ? 'actions' : undefined, label: tsec.metric, columns: tsec.columns, linkedTo: tsec.linkedTo, idPattern: tsec.idPattern }];
  if (kind === 'kpi') return [{ kind: 'stat', fill: 'query', binding: 'metrics', label: tsec.metric, slotLabels: tsec.metric ? [tsec.metric] : undefined }];
  if (kind === 'chart') return [{ kind: 'chart', fill: 'query', binding: 'metrics', label: tsec.metric }];
  if (kind === 'human') return [{ kind: 'signoff', fill: 'human' }];
  if (tsec.fixed) return [{ kind: 'narrative', fill: 'fixed', fixedBody: tsec.fixedBody }];
  return [{ kind: 'narrative', fill: tsec.fill === 'mixed' ? 'query' : (tsec.fill ?? 'query') }];
}

/**
 * A fixed FRAME: their wording kept exactly, with the spots that change from
 * report to report filled from this report's details. The template stores
 * "{{entity}}", the page prints the client's name — and a report detail we do
 * not hold prints the blank rather than a wrong value.
 */
const FRAME_BLANK: Record<string, string> = {
  title: '[report title]', entity: '[client]', period: '[period]',
  date: '[date]', reference: '[reference]', preparedBy: '[prepared by]',
};

function fillFrame(line: string, facts?: ReportFacts): string {
  return line.replace(/\{\{(title|entity|period|date|reference|preparedBy)\}\}/g, (_whole, key: string) => {
    const detail = facts?.details ?? {};
    const value = key === 'entity' ? detail.entity : detail[key as keyof typeof detail];
    // A blank we cannot fill yet reads as a blank, never as the token that
    // stores it: "{{date}}" on the page is the template's plumbing showing
    // through, which reads as broken.
    return value ?? FRAME_BLANK[key] ?? '';
  });
}

/** A block bound to data that has none — said plainly, never a grid of dashes. */
function BoundEmpty({ message, shape }: { message: string; shape?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-canvas-border bg-canvas/40 px-4 py-4">
      <p className="text-[0.8125rem] text-ink-500">{message}</p>
      {shape && <p className="mt-1 text-[0.6875rem] text-ink-400">{shape}</p>}
    </div>
  );
}

/** Door 1 for a table with no connected data: the columns hold their place and
 *  the user types rows straight into them. Keyed per block, persisted per report
 *  by the caller. */
export type TableFill = {
  /** Saved rows for this block index (undefined = never edited). */
  rowsFor: (blockIndex: number) => string[][] | undefined;
  /** Persist the block's rows (called on cell blur / row add / row delete). */
  onSave: (blockIndex: number, cols: string[], rows: string[][]) => void;
  readOnly: boolean;
};

/** Per-field overrides for repeating finding cards — the user rewrites a card's
 *  title, severity word, or any field. Keyed per block + card + field. */
export type CardFill = {
  get: (blockIndex: number, cardIndex: number, field: string) => string | undefined;
  onSave: (blockIndex: number, cardIndex: number, field: string, value: string) => void;
};

/** Overrides for a narrative (prose) block inside a typed section — the user
 *  rewrites the composed copy. Keyed per block. */
export type ProseFill = {
  get: (blockIndex: number) => string | undefined;
  onSave: (blockIndex: number, text: string) => void;
};

// A narrative block turned into an autosaving textarea while the section is in
// edit mode. Matches the section's own body type scale.
function EditableNarrative({ blockIndex, value, proseFill, textClassName }: {
  blockIndex: number;
  value: string;
  proseFill: ProseFill;
  textClassName: string;
}) {
  return (
    <div className="max-w-[80ch]">
      <textarea
        defaultValue={value}
        onBlur={e => proseFill.onSave(blockIndex, e.target.value)}
        rows={Math.max(3, Math.ceil((value.length || 1) / 80))}
        placeholder="Type or paste this section's content here."
        aria-label="Section content"
        className={`w-full resize-y rounded-md border border-brand-600/40 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600/15 placeholder:text-ink-400 ${textClassName}`}
      />
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">Edits save as you go. Press Done when finished.</p>
    </div>
  );
}

// An empty template table made fillable — the client's own column names across
// the top, text inputs beneath, add/remove rows. Autosaves on blur so a filled
// table survives a reopen. Mirrors the flat, hairline table aesthetic.
function EditableTable({ cols, initialRows, onSave, note }: {
  cols: string[];
  initialRows: string[][];
  onSave: (rows: string[][]) => void;
  note?: string;
}) {
  const width = cols.length;
  const blank = () => Array.from({ length: width }, () => '');
  const [rows, setRows] = useState<string[][]>(
    initialRows.length ? initialRows.map(r => Array.from({ length: width }, (_, c) => r[c] ?? '')) : [blank()],
  );

  // A row is worth saving only once it carries something.
  const nonEmpty = (rs: string[][]) => rs.filter(r => r.some(c => c.trim().length));
  const commit = (rs: string[][]) => onSave(nonEmpty(rs));

  const setCell = (r: number, c: number, v: string) =>
    setRows(prev => prev.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row));
  const addRow = () => setRows(prev => { const next = [...prev, blank()]; return next; });
  const removeRow = (r: number) => setRows(prev => {
    const next = prev.filter((_, ri) => ri !== r);
    const kept = next.length ? next : [blank()];
    commit(kept);
    return kept;
  });

  return (
    <div className="max-w-full">
      <div className="rounded-md overflow-hidden border border-canvas-border">
        <div className="flex bg-canvas">
          {cols.slice(0, 6).map(c => (
            <div key={c} className="flex-1 min-w-0 truncate border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">{c}</div>
          ))}
          <div className="w-8 shrink-0 border-l border-canvas-border" aria-hidden />
        </div>
        {rows.map((row, r) => (
          <div key={r} className="group/row flex border-t border-canvas-border">
            {cols.slice(0, 6).map((c, ci) => (
              <input
                key={c}
                value={row[ci] ?? ''}
                onChange={e => setCell(r, ci, e.target.value)}
                onBlur={() => commit(rows)}
                aria-label={`${c}, row ${r + 1}`}
                placeholder="—"
                className="flex-1 min-w-0 border-r last:border-r-0 border-canvas-border bg-white px-2.5 py-2 text-[0.75rem] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:bg-brand-50/40 focus:ring-1 focus:ring-inset focus:ring-brand-600/25"
              />
            ))}
            <button
              onClick={() => removeRow(r)}
              aria-label={`Delete row ${r + 1}`}
              className="w-8 shrink-0 flex items-center justify-center border-l border-canvas-border text-ink-300 hover:text-risk-700 hover:bg-risk-50 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.6875rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-md hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer"
        >
          <Plus size={13} /> Add row
        </button>
        <p className="text-[0.6875rem] text-ink-400">{note ?? 'Filled in manually — saved with this report.'}</p>
      </div>
    </div>
  );
}

function BlockBody({ block, blockIndex, editing = false, tableFill, cardFill, proseFill, cards, findingScale, composed, manual, facts }: {
  block: TemplateBlock;
  blockIndex: number;
  /** Whether the section is in edit mode (driven by its header Edit toggle). */
  editing?: boolean;
  tableFill?: TableFill;
  cardFill?: CardFill;
  proseFill?: ProseFill;
  cards: CardFinding[];
  findingScale?: string[];
  /** This report's data, read through the block's own binding. */
  facts?: ReportFacts;
  /** Composed prose for query-filled narrative blocks (the section's data-
   *  driven content). Manual/fixed/human blocks never receive it. */
  composed?: string;
  /** Door 1 of "no data connected": the user types or pastes into the shape.
   *  Present only on the section's primary manual narrative block. */
  manual?: {
    text: string;
    onChange: (text: string) => void;
    onCommit?: () => void;
    /** Door 2 — save the typed content back to the template as a default. */
    onRemember?: () => void;
  };
}) {
  // ── Repeating finding cards — the saved shape, stamped once per finding ──
  if (block.kind === 'cards') {
    const isHuman = (label: string) => (block.humanFields ?? []).some(h => h.toLowerCase() === label.toLowerCase());
    // Source, filter, shape: the binding decides which rows this block takes,
    // and a severity split takes only its own rating, so a finding lands in
    // exactly one section instead of being stamped into every one of them.
    const bound = bindBlock(block, facts);
    if (bound.kind === 'rows') cards = bound.rows;
    // The filling step fills what was kept and bound, and nothing else. A card
    // the template says a person writes stays empty however many findings this
    // report has, so the answer to "why is this not filled?" is in the
    // template, never in the data.
    else if (block.fill !== 'query') cards = [];
    else if (block.severity) {
      const want = block.severity.toLowerCase();
      cards = cards.filter(c => (c.severity ?? '').toLowerCase() === want);
    }
    if (cards.length === 0) {
      return (
        <BoundEmpty
          message={block.fill === 'human'
            ? 'These cards are set for a person to write, so they stay empty until someone does.'
            : block.fill === 'manual'
              ? 'Nothing is connected to these cards in the template, so they stay empty. Connect them to your findings to fill them.'
              : bound.kind === 'rows' && bound.empty
                ? bound.emptyMessage
                : `Finding cards render here, one card per finding, in this template's saved shape${block.idPattern ? ` (${block.idPattern})` : ''}.`}
          shape={block.cardFields?.length ? `Each card: ${block.cardFields.join(', ')}.` : undefined}
        />
      );
    }
    // Every card is the user's to rewrite: overrides win over the stamped data,
    // and the section's Edit toggle swaps the copy for inputs.
    const canEdit = editing && !!cardFill;
    return (
      <div className="space-y-4">
        {cards.map((f, i) => {
          const id = idFromPattern(block.idPattern, i);
          const ratedAs = rateIn(findingScale, f.severity);
          const fields = block.cardFields ?? [];
          const resolve = (field: string, fallback: string) => cardFill?.get(blockIndex, i, field) ?? fallback;
          const title = resolve('title', f.title);
          const sev = resolve('severity', ratedAs);
          return (
            <article key={id} className="rounded-lg border border-canvas-border bg-white shadow-[0_1px_2px_rgba(15,8,30,0.04)] px-5 py-4" style={{ borderLeft: '3px solid var(--rep-accent, #550fa5)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0 font-mono text-[0.8125rem] font-semibold" style={{ color: 'var(--rep-accent, #550fa5)' }}>{id}</span>
                  {canEdit ? (
                    <input
                      defaultValue={title}
                      onBlur={e => cardFill!.onSave(blockIndex, i, 'title', e.target.value)}
                      aria-label={`${id} title`}
                      className="min-w-0 flex-1 rounded-md border border-canvas-border bg-white px-2 py-1 text-[0.9375rem] font-semibold text-ink-900 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                    />
                  ) : (
                    <h4 className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink-900">{title}</h4>
                  )}
                </div>
                {canEdit ? (
                  <input
                    defaultValue={sev}
                    onBlur={e => cardFill!.onSave(blockIndex, i, 'severity', e.target.value)}
                    aria-label={`${id} rating`}
                    className="w-24 shrink-0 rounded-md border border-canvas-border bg-white px-2 py-1 text-[0.6875rem] font-semibold text-ink-700 text-center focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                  />
                ) : (
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${severityTint(f.severity)}`}>{sev}</span>
                )}
              </div>
              {fields.length > 0 && (
                <dl className="mt-3 space-y-2.5">
                  {fields.map(label => {
                    if (FIELD_RATING_RE.test(label)) return null; // shown as the chip above
                    const computed = fieldValue(label, f, id, ratedAs);
                    const val = resolve(label, computed ?? '');
                    return (
                      <div key={label}>
                        <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400">{label}</dt>
                        <dd className="mt-1">
                          {canEdit ? (
                            <textarea
                              defaultValue={val}
                              onBlur={e => cardFill!.onSave(blockIndex, i, label, e.target.value)}
                              rows={2}
                              placeholder={isHuman(label) ? humanPrompt(label) : '—'}
                              aria-label={`${id} ${label}`}
                              className="w-full resize-y rounded-md border border-canvas-border bg-white px-2 py-1.5 text-[0.8125rem] text-ink-700 leading-relaxed placeholder:text-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                            />
                          ) : (isHuman(label) && !val)
                            ? AWAITING(humanPrompt(label))
                            : <p className="text-[0.8125rem] text-ink-700 leading-relaxed">{val || '—'}</p>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  // ── Real table — the client's own column names; rows derive from findings
  //    when linked; otherwise empty, never invented ──
  if (block.kind === 'table') {
    const cols = block.columns ?? [];
    const bound = bindBlock(block, facts);
    // An evidence annexure or a drafted in-scope list arrives as a grid: rows
    // straight out of the query, in the client's own layout.
    if (bound.kind === 'grid') {
      if (bound.rows.length === 0) return <BoundEmpty message={bound.emptyMessage} shape={cols.length ? `Columns: ${cols.join(', ')}.` : undefined} />;
      const gridCols = (cols.length ? cols : bound.columns).slice(0, 6);
      return (
        <div className="max-w-full">
          <div className="rounded-md overflow-hidden border border-canvas-border">
            <div className="flex bg-canvas">
              {gridCols.map(c => (
                <div key={c} className="flex-1 min-w-0 truncate border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">{c}</div>
              ))}
            </div>
            {bound.rows.slice(0, 40).map((row, r) => (
              <div key={r} className="flex border-t border-canvas-border">
                {gridCols.map((c, ci) => (
                  <div key={c} className="flex-1 min-w-0 border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.75rem] text-ink-700 truncate">{row[ci] || '—'}</div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.6875rem] text-ink-400">
            {block.binding === 'scope'
              ? 'Drafted from the categories your queries carry. Edit it before you send.'
              : 'The records behind this finding, straight from the query that raised it.'}
          </p>
        </div>
      );
    }
    // A table bound to the findings builds its own rows; one that is not stays
    // an empty grid of their columns, which is what their format asks for.
    const boundRows = bound.kind === 'rows' ? bound.rows : [];
    // A findings table is the findings written as ONE table: a row per problem,
    // its columns being the fields. Same source as the cards, different shape.
    const linkedRows = block.linkedTo || block.binding === 'actions' || block.binding === 'findings' || block.severity
      ? boundRows
      : (block.linkedTo && cards.length > 0 ? cards : []);
    // A table whose columns map to nothing we hold would otherwise print a grid
    // of dashes — treat it as empty-for-fill, not as data.
    const mappedCols = cols.filter(c => fieldValue(c, { title: '', severity: '' }, '', '') !== null).length;
    const dataRows = mappedCols === 0 ? [] : linkedRows;
    // The report's own data, flattened to string cells so edited and generated
    // rows share one render path.
    const dataAsStrings = dataRows.map((f, i) => {
      const id = idFromPattern(block.idPattern, i);
      const ratedAs = rateIn(findingScale, f.severity);
      return cols.slice(0, 6).map(c => fieldValue(c, f, id, ratedAs) ?? '');
    });
    const savedRows = tableFill?.rowsFor(blockIndex);
    const canEditTable = editing && !!tableFill && !tableFill.readOnly && cols.length > 0;

    // Edit mode: a fillable grid seeded with saved rows, or with the current
    // data so the user can tweak what generated.
    if (canEditTable) {
      const note = savedRows
        ? 'Type into your columns. Saved with this report.'
        : block.linkedTo || block.binding === 'actions'
          ? 'Fills from your audit data at generation, or type rows here to fill it now.'
          : 'No data connected — type rows straight into your columns. Saved with this report.';
      return (
        <EditableTable
          cols={cols}
          initialRows={savedRows ?? dataAsStrings}
          onSave={rows => tableFill!.onSave(blockIndex, cols, rows)}
          note={note}
        />
      );
    }

    // Not editing: prefer hand-filled rows, else the generated data.
    const showRows = savedRows ?? dataAsStrings;
    if (showRows.length > 0 && cols.length > 0) {
      return (
        <div className="max-w-full">
          <div className="rounded-md overflow-hidden border border-canvas-border">
            <div className="flex bg-canvas">
              {cols.slice(0, 6).map(c => (
                <div key={c} className="flex-1 min-w-0 truncate border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">{c}</div>
              ))}
            </div>
            {showRows.map((row, r) => (
              <div key={r} className="flex border-t border-canvas-border">
                {cols.slice(0, 6).map((c, ci) => (
                  <div key={c} className="flex-1 min-w-0 border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.75rem] text-ink-700 truncate">{row[ci] || '—'}</div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.6875rem] text-ink-400">
            {savedRows
              ? 'Filled in manually.'
              : block.linkedTo
                ? <>Built automatically from “{block.linkedTo}”, so the two sections can’t disagree.</>
                : 'Rows fill from your audit data at generation.'}
          </p>
        </div>
      );
    }

    // Empty — say it plainly. When the table can be filled, point at Edit.
    const fillHint = tableFill && !tableFill.readOnly ? ' Use Edit to fill it in.' : '';
    if ((block.linkedTo || block.binding === 'actions') && bound.kind === 'rows' && bound.empty) {
      return (
        <BoundEmpty
          message={bound.emptyMessage + fillHint}
          shape={cols.length ? `Columns kept from your report: ${cols.join(', ')}.` : undefined}
        />
      );
    }
    if (cols.length > 0) {
      return (
        <BoundEmpty
          message={'This table keeps your columns, but they are not ones we hold data for, so it prints empty for you to fill.' + fillHint}
          shape={`Columns kept from your report: ${cols.join(', ')}.`}
        />
      );
    }
    // No columns at all — the generic placeholder grid.
    return (
      <div className="max-w-full">
        <div className="rounded-md overflow-hidden border border-canvas-border">
          <div className="grid grid-cols-4 bg-canvas">
            {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-6 border-r last:border-r-0 border-canvas-border" />)}
          </div>
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="flex border-t border-canvas-border">
              {Array.from({ length: 4 }).map((_, c) => (
                <div key={c} className="flex-1 border-r last:border-r-0 border-canvas-border px-2.5 py-2 text-[0.75rem] text-ink-300">—</div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.6875rem] text-ink-400">
          {block.fill === 'manual' ? 'No data connected — fill in manually. The shape holds its place either way.' : 'Rows fill from your audit data at generation.'}
        </p>
      </div>
    );
  }

  // ── Stat strip — big numbers with captions; values come from data, or stay
  //    honestly empty when none is connected ──
  if (block.kind === 'stat') {
    const bound = bindBlock(block, facts);
    const cells = bound.kind === 'cells'
      ? bound.cells
      : (block.slotLabels?.length ? block.slotLabels : [block.label || 'Metric']).map(label => ({ label, value: undefined as string | undefined }));
    if (bound.kind === 'cells' && bound.empty) {
      return <BoundEmpty message={bound.emptyMessage} shape={`Captions kept from your report: ${cells.map(c => c.label).join(', ')}.`} />;
    }
    return (
      <div>
        <div className="flex flex-wrap gap-6">
          {cells.slice(0, 6).map(c => (
            <div key={c.label} className="shrink-0">
              <div className={`text-[1.75rem] font-bold leading-none tabular-nums ${c.value ? 'text-ink-900' : 'text-ink-300'}`}>{c.value ?? '—'}</div>
              <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-1.5">{c.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.6875rem] text-ink-400">
          {block.fill === 'manual'
            ? 'Nothing connected to this yet, fill it in yourself.'
            : cells.some(c => !c.value)
              ? 'Filled from your audit results. The blank ones are numbers we do not hold.'
              : 'Filled from your audit results.'}
        </p>
      </div>
    );
  }

  // ── Fill-in slots — label + value pairs; labels kept, values from report
  //    details at generation ──
  if (block.kind === 'slot') {
    const bound = bindBlock(block, facts);
    const cells = bound.kind === 'cells'
      ? bound.cells
      : (block.slotLabels ?? []).map(label => ({ label, value: undefined as string | undefined }));
    return (
      <div className="max-w-[80%]">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2.5">
          {cells.slice(0, 8).map(c => (
            <div key={c.label} className="flex items-baseline justify-between gap-3 border-b border-canvas-border pb-1.5">
              <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400">{c.label}</dt>
              <dd className={`text-[0.8125rem] ${c.value ? 'text-ink-800' : 'text-ink-300'}`}>{c.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[0.6875rem] text-ink-400">
          {block.fill === 'human' ? 'Typed once, saved as template defaults.' : 'Filled from the report’s own details at generation.'}
        </p>
      </div>
    );
  }

  // ── Callout — text set apart; fixed callouts print verbatim ──
  if (block.kind === 'callout') {
    return (
      <div className="max-w-[80ch] rounded-md border border-mitigated-200 bg-mitigated-50/50 px-4 py-3">
        {block.fill === 'fixed' && (block.fixedBody ?? []).length > 0 ? (
          <>
            {(block.fixedBody ?? []).map((line, i) => (
              <p key={i} className="text-[0.875rem] text-ink-700 leading-relaxed">{fillFrame(line, facts)}</p>
            ))}
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-400">
              <Lock size={11} /> {block.authored
                ? 'Kept from your old report, still in its author’s words. Edit it once and it locks.'
                : block.frame ? 'Fixed frame with blanks. Your name, period and dates fill in each report.' : 'Fixed wording. Prints exactly as written.'}
            </p>
          </>
        ) : (
          <p className="text-[0.875rem] text-ink-500 leading-relaxed">{block.label || 'Callout'} — {block.fill === 'human' ? humanPrompt(block.label) : 'filled at generation.'}</p>
        )}
      </div>
    );
  }

  // ── Chart placeholder — values from trusted data, or honestly empty ──
  if (block.kind === 'chart') {
    return (
      <div className="max-w-[75%]">
        <div className="flex items-end gap-1.5 h-14">
          {[40, 68, 30, 82, 54, 72].map((h, k) => <div key={k} className="flex-1 rounded-t-xs bg-canvas-border" style={{ height: `${h}%` }} />)}
        </div>
        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-2">
          {block.label || 'Chart'} · {block.fill === 'manual' ? 'no data connected — add manually' : 'filled from query data'}
        </p>
      </div>
    );
  }

  // ── Sign-off — signature slots, real people only ──
  if (block.kind === 'signoff') {
    return (
      <div className="max-w-[80%]">
        {AWAITING('Signatures')}
        {(block.signRoles ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(block.signRoles ?? []).map(r => (
              <span key={r} className="inline-flex items-center rounded-full bg-white border border-mitigated-200 px-2 py-0.5 text-[0.6875rem] font-semibold text-mitigated-700">{r}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Narrative — by fill case ──
  if (block.fill === 'fixed') {
    return (
      <div className="max-w-[80ch]">
        {(block.fixedBody ?? []).map((line, i) => (
          <p key={i} className="text-[0.9375rem] text-ink-700 leading-[1.8]">{fillFrame(line, facts)}</p>
        ))}
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-400">
          <Lock size={11} /> {block.authored
            ? 'Kept from your old report, still in its author’s words. Edit it once and it locks.'
            : block.frame
              ? 'Fixed frame with blanks. Your name, the period and the dates fill in each report, and nothing else changes.'
              : 'Fixed wording. Prints exactly as written, and the AI is never consulted.'}
        </p>
      </div>
    );
  }
  if (block.fill === 'human') {
    return <div className="max-w-[80%]">{AWAITING(humanPrompt(block.label))}</div>;
  }
  if (block.fill === 'manual') {
    // Not a dead end: the shape holds its place and the user types or pastes
    // straight into it (door 1). Static only when no edit handler reached us.
    if (!manual) {
      const manualValue = proseFill?.get(blockIndex) ?? '';
      if (editing && proseFill) {
        return <EditableNarrative blockIndex={blockIndex} value={manualValue} proseFill={proseFill} textClassName="text-[0.9375rem] text-ink-700 leading-[1.8]" />;
      }
      if (manualValue) return <p className="max-w-[80ch] text-[0.9375rem] text-ink-700 leading-[1.8]">{manualValue}</p>;
      return (
        <div className="max-w-[80ch] rounded-lg border border-dashed border-canvas-border bg-canvas/40 px-4 py-3.5">
          <p className="text-[0.8125rem] font-medium text-ink-500">No data connected — fill in manually.{proseFill ? ' Use Edit to fill it in.' : ''}</p>
          <p className="text-[0.6875rem] text-ink-400 mt-1">The heading and shape keep their place in the report. Type or paste the content here; the export checklist flags it until it's filled.</p>
        </div>
      );
    }
    const filled = manual.text.trim().length > 0;
    return (
      <div className="max-w-[80ch]">
        <textarea
          value={manual.text}
          onChange={e => manual.onChange(e.target.value)}
          onBlur={() => manual.onCommit?.()}
          rows={filled ? Math.min(10, Math.max(3, manual.text.split('\n').length + 1)) : 3}
          placeholder="No data connected — type or paste this section's content here."
          aria-label="Section content"
          className={`w-full resize-y rounded-lg px-4 py-3 text-[0.9375rem] text-ink-700 leading-[1.8] transition-colors focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10 placeholder:text-ink-400 ${
            filled ? 'border border-canvas-border bg-white' : 'border border-dashed border-canvas-border bg-canvas/40'
          }`}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[0.6875rem] text-ink-400">
            {filled ? 'Filled in manually — saved with this report.' : 'The heading and shape keep their place either way; the export checklist flags this until it’s filled.'}
          </p>
          {/* Door 2: setup that never changes gets typed once and remembered —
              pre-filled in every future report from this template. */}
          {filled && manual.onRemember && (
            <button
              onClick={manual.onRemember}
              className="shrink-0 text-[0.6875rem] font-semibold text-brand-600 hover:text-brand-700 transition-colors cursor-pointer"
            >
              Remember for future reports
            </button>
          )}
        </div>
      </div>
    );
  }
  // query-filled narrative: the composed, data-driven prose — the user's to
  // rewrite. An override wins over the composed copy; edit mode swaps in a
  // textarea, so a typed template's narrative section is editable like the rest.
  const proseValue = proseFill?.get(blockIndex) ?? composed ?? '';
  if (editing && proseFill) {
    return <EditableNarrative blockIndex={blockIndex} value={proseValue} proseFill={proseFill} textClassName="text-[0.9375rem] text-ink-700 leading-[1.8]" />;
  }
  return <p className="max-w-[80ch] text-[0.9375rem] text-ink-700 leading-[1.8]">{proseValue || '—'}</p>;
}

export default function TemplateBlockBody({ tsec, cards = [], findingScale, composed, manual, blockLibrary, facts, editing = false, tableFill, cardFill, proseFill }: {
  tsec: TemplateSection;
  /** The report's findings pool — stamped into repeating cards and linked tables. */
  cards?: CardFinding[];
  /** The template's own rating words (captured at import). */
  findingScale?: string[];
  /** Composed prose for query-filled narrative blocks. */
  composed?: string;
  /** Manual-fill editing (door 1) — attached to the section's first manual
   *  prose block; the rest of the shape stays as placeholders. */
  manual?: {
    text: string;
    onChange: (text: string) => void;
    onCommit?: () => void;
    onRemember?: () => void;
  };
  /** Every block the template stores by id, so a block printed in two places
   *  (cover and executive summary) resolves back to the one stored shape. */
  blockLibrary?: Record<string, TemplateBlock>;
  /** This report's data. Absent in the template editor, where a block shows its
   *  shape rather than anyone's numbers. */
  facts?: ReportFacts;
  /** Door 1 for empty tables — makes each table's columns fillable in place,
   *  keyed by block index and persisted per report by the caller. */
  tableFill?: TableFill;
  /** Whether this section is in edit mode (its header Edit toggle is on). */
  editing?: boolean;
  /** Per-field overrides for repeating finding cards. */
  cardFill?: CardFill;
  /** Overrides for narrative (prose) blocks inside this section. */
  proseFill?: ProseFill;
}) {
  const blocks = legacyBlocks(tsec).map(b => resolveBlock(b, blockLibrary));
  // A section with a manual fill but no prose block still needs somewhere to
  // type — append a narrative slot so the box exists (never a dead end).
  const hasManualProse = blocks.some(b => (b.kind === 'narrative' || b.kind === 'callout') && b.fill === 'manual');
  const rendered: TemplateBlock[] = manual && !hasManualProse && blocks.every(b => b.fill !== 'query')
    ? [...blocks, { kind: 'narrative', fill: 'manual' }]
    : blocks;
  const manualIdx = rendered.findIndex(b => (b.kind === 'narrative' || b.kind === 'callout') && b.fill === 'manual');
  return (
    <div className="space-y-5">
      {rendered.map((b, i) => (
        <div key={i}>
          {/* A block's own sub-heading — the client's furniture inside the section. */}
          {b.label && b.kind !== 'chart' && b.kind !== 'stat' && b.kind !== 'callout' && (
            <h4 className="mb-2 text-[0.8125rem] font-semibold text-ink-900">{b.label}</h4>
          )}
          <BlockBody block={b} blockIndex={i} editing={editing} tableFill={tableFill} cardFill={cardFill} proseFill={proseFill} cards={cards} findingScale={findingScale} composed={composed} manual={i === manualIdx ? manual : undefined} facts={facts} />
        </div>
      ))}
    </div>
  );
}
