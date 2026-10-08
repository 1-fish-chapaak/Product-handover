/**
 * ── Ira's work — the top of the audit Dashboard, for the auditor ─────────────
 * What Ira has done across the open audit that is waiting on the auditor, in
 * three groups: results not yet confirmed, checks it couldn't test, and runs in
 * progress. Each row opens the control at the step it is about.
 *
 * It decides nothing new. Sure vs less sure, "unconfirmed", "couldn't test" and
 * the ask to the owner are the control page's own notions (awaitsConfirm,
 * confidenceOf / CONFIDENT_AT, needsYouItems, couldntAskFor), and Confirm N is
 * the page's "Confirm all N" — the same store action on the same SURE rows
 * only. Less-sure results stay for one-by-one review inside the control, and
 * there is no confirm-everything button. Nothing here concludes a track.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only inside functions.
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useIcfr, type FocusStep } from './store';
import { useControlRuns } from './controlChat';
import { needsYouItems } from './NeedsYouPane';
import { InlineNote, useInlineNote } from './InlineNote';
import {
  awaitsConfirm, CONFIDENT_AT, confidenceOf, controlCode, couldntAskFor, dayMonth, designApproved, isControlLockedIn, operatingApplies, rollPending, yearEndPending,
} from './helpers';
import type { Control, DesignPoint, OperatingStep } from './types';

type Track = 'design' | 'operating';
const TRACK_LABEL: Record<Track, string> = { design: 'TOD', operating: 'TOE' };
const TRACK_FOCUS: Record<Track, FocusStep> = { design: 'design', operating: 'toe' };

interface WaitingRow { key: string; control: Control; track: Track; sure: string[]; lessSure: number; canConfirm: boolean; why?: string }
interface CouldntRow { key: string; control: Control; track: Track; checks: number; asked: { first: string; due: string }[]; notAsked: number }
interface RunningRow { key: string; control: Control; label: string }

/** Rows shown per group before "Show N more". */
const CAP = 4;

const rowCls = 'flex-1 min-w-0 flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-lg text-left hover:bg-paper-100 transition-colors cursor-pointer group';

export default function IraWorkSection({ controls }: { controls: Control[] }) {
  const { eng, openAuditId, openControl, confirmIra } = useIcfr();
  const runs = useControlRuns();
  const note = useInlineNote();
  const [more, setMore] = useState<Record<string, boolean>>({});
  const audit = eng.audits.find(a => a.id === openAuditId);

  const waiting: WaitingRow[] = [];
  const couldnt: CouldntRow[] = [];
  const running: RunningRow[] = [];

  for (const c of controls) {
    const run = runs[c.id];
    if (run) running.push({ key: `run:${c.id}`, control: c, label: run.label });
    // A locked (signed-off) control has nothing left for Ira's work to ask of
    // anyone — the control page's Needs you is empty for it too.
    if (isControlLockedIn(eng, c)) continue;
    const tracks: Track[] = operatingApplies(eng, c) ? ['design', 'operating'] : ['design'];
    for (const track of tracks) {
      if (c[track].conclusion !== 'Not tested') continue;
      const rows: (DesignPoint | OperatingStep)[] = (track === 'design' ? c.design.points : c.operating.steps).filter(awaitsConfirm);
      if (!rows.length) continue;
      const sure = rows.filter(r => (confidenceOf(r.validation, `${c.id}:${r.id}`) ?? 0) >= CONFIDENT_AT).map(r => r.id);
      // The same holds the store puts on the step: last round's set-up still
      // waiting on the auditor, and — for TOE — the reviewer's design approval
      // and a year-end control held in an interim. A run in flight hides the
      // button, as the control page hides its own Confirm all while Ira reads.
      // A hidden Confirm says why — the one-line rule for every refusal.
      const why = run ? 'Ira is still reading'
        : (track === 'design' ? rollPending(c, 'design') || rollPending(c, 'checks') : rollPending(c, 'attributes')) ? 'confirm last round’s set-up first'
        : track === 'operating' && !designApproved(c) ? 'waits for the design approval'
        : track === 'operating' && yearEndPending(c, audit) ? 'held for year end'
        : undefined;
      waiting.push({ key: `wait:${c.id}:${track}`, control: c, track, sure, lessSure: rows.length - sure.length, canConfirm: !why && sure.length > 0, ...(why && sure.length ? { why } : {}) });
    }
    // Couldn't test — the control page's own cards, one row per track here.
    const cards = needsYouItems(c, eng, 'auditor', openAuditId).filter(it => it.kind === 'couldnt');
    for (const track of tracks) {
      const mine = cards.filter(it => it.kind === 'couldnt' && it.track === track);
      if (!mine.length) continue;
      const asked: { first: string; due: string }[] = [];
      let notAsked = 0;
      for (const it of mine) {
        if (it.kind !== 'couldnt') continue;
        const t = couldntAskFor(eng, c.id, it.checkId);
        if (t) asked.push({ first: t.assignee.split(/\s+/)[0] || t.assignee, due: t.dueAt ? dayMonth(t.dueAt) : t.dueLabel });
        else notAsked += 1;
      }
      couldnt.push({ key: `couldnt:${c.id}:${track}`, control: c, track, checks: mine.length, asked, notAsked });
    }
  }

  const confirm = (r: WaitingRow) => {
    confirmIra(r.control.id, r.track, r.sure);
    note.show('info', `Confirmed ${r.sure.length} of Ira's sure result${r.sure.length === 1 ? '' : 's'} on ${controlCode(r.control)} ${TRACK_LABEL[r.track]}${r.lessSure ? ` — ${r.lessSure} less sure still to review inside the control` : ''}.`);
  };

  const empty = !waiting.length && !couldnt.length && !running.length;

  const group = <T extends { key: string }>(id: string, title: string, rows: T[], render: (r: T) => ReactNode) => {
    if (!rows.length) return null;
    const shown = more[id] ? rows : rows.slice(0, CAP);
    return (
      <div>
        <div className="text-[0.6875rem] font-semibold text-ink-500 mb-0.5">{title}</div>
        <div className="space-y-0.5">{shown.map(render)}</div>
        {rows.length > CAP && (
          <button type="button" onClick={() => setMore(m => ({ ...m, [id]: !m[id] }))}
            className="mt-0.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">
            {more[id] ? 'Show fewer' : `Show ${rows.length - CAP} more`}
          </button>
        )}
      </div>
    );
  };

  // The code alone told nobody which control it was (click-through, 5 Oct), so
  // the one-line control statement follows it — the first thing to give way
  // when the row is short of room.
  const code = (c: Control) => (
    <>
      <span className="font-mono text-[0.75rem] font-semibold text-ink-900 shrink-0">{controlCode(c)}</span>
      <span className="min-w-0 max-w-[45%] truncate text-[0.8125rem] text-ink-900" title={c.description}>{c.description.replace(/\.$/, '')}</span>
    </>
  );
  const chevron = <ChevronRight size={14} className="ml-auto shrink-0 text-ink-300 group-hover:text-ink-500 transition-colors" />;

  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
      <h2 className="font-display text-[1.0625rem] leading-tight text-ink-900 inline-flex items-center gap-1.5">
        <Sparkles size={14} className="text-brand-500 shrink-0" aria-hidden />
        Ira’s work
      </h2>
      {empty ? (
        <p className="mt-2 text-[0.8125rem] text-ink-500">Nothing from Ira waiting for you.</p>
      ) : (
        <div className="mt-2.5 space-y-3">
          {group('waiting', 'Waiting for you', waiting, r => (
            <div key={r.key} className="flex items-center gap-2">
              <button type="button" onClick={() => openControl(r.control.id, TRACK_FOCUS[r.track])} className={rowCls}
                title={`Open ${controlCode(r.control)} at ${r.track === 'design' ? 'test of design' : 'test of effectiveness'}`}>
                {code(r.control)}
                <span className="text-[0.8125rem] text-ink-700 truncate">
                  {TRACK_LABEL[r.track]} · {[r.sure.length ? `${r.sure.length} sure` : null, r.lessSure ? `${r.lessSure} less sure` : null].filter(Boolean).join(', ')}
                </span>
                {chevron}
              </button>
              {r.canConfirm && (
                <button type="button" onClick={() => confirm(r)}
                  className="h-6 px-2 shrink-0 rounded-md border border-brand-200 bg-brand-50 text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                  Confirm {r.sure.length}
                </button>
              )}
              {r.why && <span className="shrink-0 text-[0.6875rem] text-ink-500">{r.why}</span>}
            </div>
          ))}
          {group('couldnt', 'Couldn’t test', couldnt, r => (
            <button key={r.key} type="button" onClick={() => openControl(r.control.id, TRACK_FOCUS[r.track])} className={rowCls}
              title={`Open ${controlCode(r.control)} at ${r.track === 'design' ? 'test of design' : 'test of effectiveness'}`}>
              {code(r.control)}
              <span className="text-[0.8125rem] text-ink-700 truncate">
                {TRACK_LABEL[r.track]} · {r.checks} {r.track === 'design' ? (r.checks === 1 ? 'check' : 'checks') : (r.checks === 1 ? 'attribute' : 'attributes')}
                <span className="text-ink-500"> — {[
                  ...askedPhrases(r.asked, r.checks),
                  r.notAsked ? (r.notAsked === r.checks ? 'not asked yet' : `${r.notAsked} not asked yet`) : null,
                ].filter(Boolean).join(' · ')}</span>
              </span>
              {chevron}
            </button>
          ))}
          {group('running', 'Running', running, r => (
            <button key={r.key} type="button" onClick={() => openControl(r.control.id)} className={rowCls} title={`Open ${controlCode(r.control)}`}>
              {code(r.control)}
              <span className="text-[0.8125rem] text-ink-700 truncate">{r.label}…</span>
              {chevron}
            </button>
          ))}
        </div>
      )}
      <InlineNote note={note.note} className="mt-2" />
    </section>
  );
}

/** "asked Priya, due 5 Oct" — one phrase per person and day, with a count in
 *  front when the control's checks were not all asked of the same one. */
function askedPhrases(asked: { first: string; due: string }[], total: number): string[] {
  const by = new Map<string, number>();
  for (const a of asked) {
    const k = `asked ${a.first}${a.due ? `, due ${a.due}` : ''}`;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  return Array.from(by, ([k, n]) => (n === total ? k : `${n} ${k}`));
}
