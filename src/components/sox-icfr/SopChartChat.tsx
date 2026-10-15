/**
 * THE EDIT BOX BESIDE THE FLOWCHART.
 *
 * The user's ask (29 Sep): "In the flowchart tab, there will be a preview and
 * an edit option. If the user clicks on the edit option, a chat box will appear
 * where the user can enter the prompt."
 *
 * It sits where the extraction prompt sat one step earlier — a column on the
 * left, the drawing on the right — so the two screens read as the same idea
 * twice: you write on the left, and the thing on the right changes. What is
 * different is that this one edits the draft that already exists rather than
 * re-extracting it, so nothing the reviewer has already decided on the Matrix
 * is thrown away.
 *
 * EVERY EDIT PRINTS A RECEIPT, AND EVERY RECEIPT CAN BE UNDONE (29 Sep).
 *
 * Three rounds of a 140-phrase probe against `sopChartEdits` closed 27 defects
 * and introduced 9 while doing it. That is the shape of the problem: a small
 * vocabulary read by hand will keep mistaking sentences, and each fix moves
 * where it goes wrong rather than ending it. Undo is the answer that does not
 * depend on the next round — a misread is one click from gone, whatever it was.
 *
 * It matters most for a RENAME. A wrong removal was always one tick away on the
 * Matrix; a wrong rename had no way back at all, and the reviewer had to
 * remember the title Ira had just overwritten. So the receipt carries the old
 * name in full, and Undo puts it back.
 *
 * NOTHING HERE DELETES. A removal leaves the row OUT of the import; the Matrix
 * still lists it and a tick puts it back. Undo is the same door, nearer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, RotateCcw, Sparkles } from 'lucide-react';
import { readChartEdits, type ChartFacts } from './sopChartEdits';

/** What Undo has to know to put one edit back. */
type UndoSpec =
  | { kind: 'rename'; what: 'risk' | 'control'; ref: string; from: string; to: string }
  | { kind: 'restore'; rowKeys: string[] }
  /** A re-extraction — the parent hands back how to put the rows as they were. */
  | { kind: 'callback'; run: () => void };

interface Receipt {
  id: number;
  text: string;
  /** The name the box carried before a rename — the thing nobody can be asked
   *  to remember, printed so Undo is not the only way back to it. */
  was?: string;
  undo?: UndoSpec;
}

interface Msg {
  id: number;
  who: 'user' | 'ira';
  text: string;
  receipts?: Receipt[];
}

export interface SopChartChatProps {
  facts: ChartFacts;
  onRenameRisk: (key: string, to: string) => void;
  onRenameControl: (sourceId: string, to: string, was: string) => void;
  /** Leaves rows out of the import. Returns WHICH rows actually moved, so the
   *  reply can say 9 → 5 and Undo can put back only what this edit took. */
  onLeaveOut: (rowKeys: string[]) => { moved: string[]; left: number };
  /** Ticks rows back in — the Matrix's own door, reached from here. */
  onRestore: (rowKeys: string[]) => void;
  /** Where the box sits — the Flowchart, or Review's side panel (stage 8). */
  where?: 'chart' | 'review';
  /** "Extract these again" (stage 8): read the rows back from the SOP — its own
   *  words return, the reviewer's filled-in blanks stay. Review only. */
  onReextract?: (rowKeys: string[]) => { count: number; undo: () => void };
}

const OPENING_REVIEW =
  'Tell me what to change in these rows. I can rename, take a row out, narrow the list, or read rows again from the SOP — "extract control 4 again", "manual controls dobara nikaal do", "remove control 2".';

/** "Extract … again" in the words a reviewer uses — English or Hinglish. */
const EXTRACT_VERB = /\b(re-?extract|extract|nikaal|nikal|read)\w*/gi;
const AGAIN = /\b(again|dobara|phir se|once more|fresh)\b|re-?extract/i;

const OPENING =
  'Tell me what to change and I\'ll change it on the chart. I can rename a box, take one out, or narrow the whole thing — "rename the first risk to Vendor fraud", "remove control 4", "only key controls" (Hinglish works too: "Control 4 hata do").';

/** Offered until the reviewer has said something of their own. */
const OPENERS = ['sirf key controls rakho', 'manual controls hata do', 'at most 6 controls'];
const OPENERS_REVIEW = ['extract control 1 again', 'manual controls dobara nikaal do', 'remove control 2'];

export default function SopChartChat({ facts, onRenameRisk, onRenameControl, onLeaveOut, onRestore, where = 'chart', onReextract }: SopChartChatProps) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'ira', text: where === 'review' ? OPENING_REVIEW : OPENING }]);
  const [draft, setDraft] = useState('');
  const [undone, setUndone] = useState<Set<number>>(new Set());
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    // "Extract … again" (stage 8). Which rows it means is read by the same
    // reader as a removal — the extract verb is swapped for "remove" so
    // "control 4", "manual controls", "risk 2" all resolve the way they do
    // everywhere else. Nothing named means every row on the list.
    if (onReextract && AGAIN.test(text) && new RegExp(EXTRACT_VERB.source, 'i').test(text)) {
      const asRemoval = text.replace(EXTRACT_VERB, 'remove').replace(/\b(again|dobara|phir se|once more|fresh)\b/gi, ' ');
      const named = readChartEdits(asRemoval, facts).flatMap(e => (e.kind === 'leave-out' ? e.rowKeys : []));
      const keys = named.length ? Array.from(new Set(named)) : facts.rows.map(r => r.key);
      const { count, undo } = onReextract(keys);
      setMsgs(prev => [...prev, { id: nextId.current++, who: 'user', text }, {
        id: nextId.current++, who: 'ira',
        text: count ? `Read ${count === 1 ? 'that control' : `${count} controls`} again from the SOP — the SOP’s own words are back; what you filled in stays.` : 'Nothing to read again — those rows already say what the SOP says.',
        ...(count ? { receipts: [{ id: nextId.current++, text: `${count} ${count === 1 ? 'row' : 'rows'} read again from the SOP`, undo: { kind: 'callback' as const, run: undo } }] } : {}),
      }]);
      setDraft('');
      return;
    }
    // One message can ask for two things. `readChartEdits` has already refused
    // the whole message if either half was unreadable.
    const edits = readChartEdits(text, facts);
    const said: Msg[] = [{ id: nextId.current++, who: 'user', text }];
    const receipts: Receipt[] = [];
    let renamed = false;

    for (const edit of edits) {
      if (edit.kind === 'rename') {
        if (edit.what === 'risk') onRenameRisk(edit.ref, edit.to);
        else onRenameControl(edit.ref, edit.to, edit.from);
        receipts.push({
          id: nextId.current++, text: edit.said[0]!, was: edit.from,
          undo: { kind: 'rename', what: edit.what, ref: edit.ref, from: edit.from, to: edit.to },
        });
        renamed = true;
      } else if (edit.kind !== 'leave-out') {
        said.push({ id: nextId.current++, who: 'ira', text: edit.text });
      }
    }

    // Every row goes out in ONE call: the handler reads this render's state, so
    // a second call in the same tick would count against a list that had not
    // caught up and report the wrong number left.
    const asked = edits.flatMap(e => (e.kind === 'leave-out' ? e.rowKeys : []));
    const { moved, left } = asked.length ? onLeaveOut(asked) : { moved: [], left: -1 };
    for (const edit of edits) {
      if (edit.kind !== 'leave-out') continue;
      // Undo puts back only what THIS edit moved — never a row the reviewer had
      // already ticked out before they typed anything.
      const mine = edit.rowKeys.filter(k => moved.includes(k));
      receipts.push({
        id: nextId.current++,
        text: edit.said.join(' · '),
        ...(mine.length ? { undo: { kind: 'restore' as const, rowKeys: mine } } : {}),
      });
    }

    if (receipts.length) {
      said.push({
        id: nextId.current++,
        who: 'ira',
        text: moved.length === 0 && !renamed
          ? 'Nothing moved — everything you asked for is already left out.'
          : left >= 0 ? `Done — ${left} ${left === 1 ? 'control' : 'controls'} left ${where === 'review' ? 'in the list' : 'on the chart'}.` : 'Done.',
        receipts,
      });
    }

    setMsgs(prev => [...prev, ...said]);
    setDraft('');
  }, [facts, onRenameRisk, onRenameControl, onLeaveOut, onReextract, where]);

  const runUndo = useCallback((r: Receipt) => {
    if (!r.undo) return;
    if (r.undo.kind === 'rename') {
      // `was` on the way back is the name we put ON, so the stage grouping still
      // reads the title it was first filed under.
      if (r.undo.what === 'risk') onRenameRisk(r.undo.ref, r.undo.from);
      else onRenameControl(r.undo.ref, r.undo.from, r.undo.to);
    } else if (r.undo.kind === 'callback') {
      r.undo.run();
    } else {
      onRestore(r.undo.rowKeys);
    }
    setUndone(prev => new Set(prev).add(r.id));
  }, [onRenameRisk, onRenameControl, onRestore]);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-canvas-border shrink-0">
        <Sparkles size={13} className="text-brand-600 shrink-0" aria-hidden />
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Edit with Ira</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col">
        <div className="mt-auto space-y-4">
          {msgs.map(m => (m.who === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-brand-50 border border-brand-200 text-[0.8125rem] leading-relaxed text-ink-800 break-words whitespace-pre-wrap">
                {m.text}
              </p>
            </div>
          ) : (
            /* Ira gets no bubble — the house rule everywhere in this product.
               Only the person who typed gets one, so a thread reads as prose
               with the reader's own words set into it. */
            <div key={m.id}>
              <p className="mb-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">Ira</p>
              <p className="text-[0.8125rem] leading-[1.65] text-ink-800 break-words">{m.text}</p>
              {m.receipts && (
                <ul className="mt-2 space-y-1">
                  {m.receipts.map(r => {
                    const gone = undone.has(r.id);
                    return (
                      <li key={r.id}
                        className={`rounded-lg border px-2.5 py-1.5 text-[0.75rem] leading-snug ${gone
                          ? 'border-canvas-border bg-canvas text-ink-400'
                          : 'border-brand-200 bg-brand-50 text-brand-700'}`}>
                        <div className="flex items-start gap-1.5">
                          {gone
                            ? <RotateCcw size={12} className="mt-0.5 shrink-0" aria-hidden />
                            : <Check size={12} className="mt-0.5 shrink-0" aria-hidden />}
                          <span className={`min-w-0 flex-1 ${gone ? 'line-through' : ''}`}>{r.text}</span>
                          {r.undo && !gone && (
                            <button type="button" onClick={() => runUndo(r)}
                              aria-label={`Undo — ${r.text}`}
                              className="shrink-0 -my-0.5 px-1.5 py-0.5 rounded font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                              Undo
                            </button>
                          )}
                        </div>
                        {/* The one fact nobody can be expected to remember. */}
                        {r.was && !gone && (
                          <p className="mt-0.5 pl-4.5 text-[0.6875rem] text-ink-500 break-words">was: {r.was}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )))}
          {msgs.length === 1 && (
            <div className="flex flex-wrap gap-1.5">
              {(where === 'review' ? OPENERS_REVIEW : OPENERS).map(o => (
                <button key={o} type="button" onClick={() => send(o)}
                  className="inline-flex items-center h-7 px-2.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-medium text-ink-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer">
                  {o}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-2.5 border-t border-canvas-border shrink-0">
        <div className="ai-border">
          <textarea rows={2} value={draft} aria-label={where === 'review' ? 'Tell Ira what to change in the rows' : 'Tell Ira what to change on the chart'}
            placeholder="What should change?"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
              // Escape leaves the box, not the import wizard around it.
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); }
            }}
            className="no-focus-ring w-full bg-transparent border-none outline-none resize-none px-3 pt-2.5 pb-1 text-[0.8125rem] leading-[1.5] text-ink-800 placeholder:text-ink-400" />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <span className="text-[0.6875rem] text-ink-400 select-none">Enter to send</span>
            {/* Mounted only when there is something to send — the house rule. */}
            {draft.trim() && (
              <button type="button" onClick={() => send(draft)} aria-label="Send"
                className="size-7 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors cursor-pointer">
                <ArrowUp size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
