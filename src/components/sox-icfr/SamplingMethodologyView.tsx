import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarRange, Check, History, Info, Layers, Lock, ShieldCheck, Shuffle, Table2 } from 'lucide-react';
import { useIcfr } from './store';
import { cn } from '../../lib/cn';
import { isEngagementLocked, samePerson, samplingOf, samplingOverrides } from './helpers';
import {
  DEFAULT_SAMPLE_SIZES, ROUND_BASIS_EFFECT, SAMPLING_METHODS, SAMPLING_SPREADS, samplingAgreed, spreadLabel,
  type Frequency, type SampleSizeRow, type SamplingMethod, type SamplingMethodology, type SamplingRoundBasis, type SamplingSpread,
} from './types';

/**
 * The engagement's sampling methodology — agreed once, read by every control (#22).
 *
 * The client's words: sizing decided control by control is "124 separate
 * decisions, not a methodology". So the table, the selection method, what every
 * draw has to be spread across and the round basis live here, on the engagement,
 * and a control's sample step reads off them rather than asking the auditor to
 * choose again.
 *
 * Three acts, kept apart deliberately (the store enforces all three): the lead
 * PROPOSES, the reviewer SIGNS, and a change to something already signed is a
 * REVISION — a new version, with a reason, back to unsigned. This screen's whole
 * job is to make which of the three you are doing obvious before you do it.
 *
 * Shaped on MaterialityGroundRules in extraViews.tsx: the same draft-then-apply
 * pattern, the same guard, the same change-log at the foot. Both screens answer
 * the same question — "was this always the number?" — so they answer it the same
 * way.
 */

const RATINGS = ['low', 'medium', 'high'] as const;
type Rating = (typeof RATINGS)[number];

/** The seven, in the order the product's own default table lists them. */
const FREQUENCIES = Object.keys(DEFAULT_SAMPLE_SIZES) as Frequency[];

const METHOD_NOTE: Record<SamplingMethod, string> = {
  Random: 'Every item in the population has the same chance of being drawn.',
  Systematic: 'Every nth item from a random start, n being the population divided by the sample size.',
  'Full population': 'Nothing is sampled — every item in the population is tested.',
};

const SPREAD_NOTE: Record<SamplingSpread, string> = {
  quarter: 'Every quarter of the audit window takes items, so no stretch of the year goes untested.',
  country: 'Every country the control answers for takes items of its own.',
  entity: 'Every company the control answers for takes items of its own.',
};

const BASIS_LABEL: Record<SamplingRoundBasis, string> = { 'per-round': 'Per round', 'whole-period': 'Whole period' };
const BASIS_NOTE: Record<SamplingRoundBasis, string> = {
  'per-round': 'Interim and roll-forward each draw their own sample, from their own window.',
  'whole-period': 'One draw at year end, covering the full year in a single sample.',
};

interface Draft { sizes: Record<Frequency, SampleSizeRow>; method: SamplingMethod; spread: SamplingSpread[]; roundBasis: SamplingRoundBasis }

/** A private copy of the agreed record, so typing in the table edits the draft
 *  rather than the thing the reviewer signed. */
const snapshot = (m: SamplingMethodology): Draft => ({
  sizes: Object.fromEntries(
    FREQUENCIES.map(f => [f, { ...(m.sizes[f] ?? DEFAULT_SAMPLE_SIZES[f]) }]),
  ) as Record<Frequency, SampleSizeRow>,
  method: m.method,
  spread: [...(m.spread ?? [])],
  roundBasis: m.roundBasis,
});

const sizesDiffer = (a: Record<Frequency, SampleSizeRow>, b: Record<Frequency, SampleSizeRow>): boolean =>
  FREQUENCIES.some(f => RATINGS.some(r => (a[f]?.[r] ?? 0) !== (b[f]?.[r] ?? 0)));

/**
 * What a save would move, in the words the auditor reads off the table.
 *
 * The store writes the same list into the log, but only once the change has
 * happened — and the point of the revision modal is to show the change BEFORE
 * it exists. Hence a second, read-only copy here rather than a call into the
 * store's.
 */
function pendingChanges(cur: SamplingMethodology, draft: Draft): { field: string; from: string; to: string }[] {
  const out: { field: string; from: string; to: string }[] = [];
  if (draft.method !== cur.method) out.push({ field: 'Selection method', from: cur.method, to: draft.method });
  if (spreadLabel(draft.spread) !== spreadLabel(cur.spread)) out.push({ field: 'Spread across', from: spreadLabel(cur.spread), to: spreadLabel(draft.spread) });
  if (draft.roundBasis !== cur.roundBasis) out.push({ field: 'Across rounds', from: BASIS_LABEL[cur.roundBasis], to: BASIS_LABEL[draft.roundBasis] });
  FREQUENCIES.forEach(f => RATINGS.forEach(r => {
    const from = cur.sizes[f]?.[r] ?? DEFAULT_SAMPLE_SIZES[f][r];
    const to = draft.sizes[f][r];
    if (from !== to) out.push({ field: `${f} · ${r[0]!.toUpperCase()}${r.slice(1)} risk`, from: String(from), to: String(to) });
  }));
  return out;
}

/** Store timestamps are prose, not dates — "3 Apr" wants an "on", "just now"
 *  does not. */
const when = (at: string) => (at === 'just now' ? 'just now' : `on ${at}`);

export default function SamplingMethodologyView() {
  const { eng, role, me, proposeSampling, signSampling, reviseSampling } = useIcfr();
  const m = samplingOf(eng);
  const agreed = samplingAgreed(m);
  const locked = isEngagementLocked(eng);
  /* An AGREED methodology is a record, not a form (user ask, 23 Sep). Until
   * somebody says out loud that they are revising it, every field below reads
   * rather than edits — the reviewer signed a table, and a table that can be
   * retyped under their signature is not one they signed.
   *
   * Revising is the way through, and it is deliberately a decision: it creates
   * a new version, returns the record to unsigned and blocks testing until it
   * is signed again. That belongs behind a button somebody pressed on purpose,
   * not behind an input box nobody noticed was live. */
  const [revisingDraft, setRevisingDraft] = useState(false);
  const canEdit = role === 'auditor' && !locked && (!agreed || revisingDraft);
  const log = eng.samplingLog ?? [];
  // How far the agreed table is actually being followed, counted across the
  // whole register rather than per control — the point of agreeing it once.
  const overrides = useMemo(() => samplingOverrides(eng.controls), [eng.controls]);

  const [draft, setDraft] = useState<Draft>(() => snapshot(m));
  const [revising, setRevising] = useState(false);
  /* Rebased on the VERSION rather than on the record's identity: `samplingOf`
     mints a fresh default object when nothing is stored, so an identity test
     would reset the draft on every render. A version bump is the one event that
     genuinely strands a draft — somebody else revised the methodology under it. */
  const [seenVersion, setSeenVersion] = useState(m.version);
  if (seenVersion !== m.version) { setSeenVersion(m.version); setDraft(snapshot(m)); }

  const dirty = draft.method !== m.method || spreadLabel(draft.spread) !== spreadLabel(m.spread)
    || draft.roundBasis !== m.roundBasis || sizesDiffer(draft.sizes, m.sizes);
  const changes = pendingChanges(m, draft);

  const setSize = (f: Frequency, r: Rating, raw: string) => {
    // Minimum one: a sample of nothing is not a sample, and an empty field on
    // the way to typing a number must not write a zero anybody can save.
    const n = Math.max(1, Math.floor(Number(raw)) || 1);
    setDraft(d => ({ ...d, sizes: { ...d.sizes, [f]: { ...d.sizes[f], [r]: n } } }));
  };

  const iProposed = samePerson(m.proposedBy, me);
  const canSign = role === 'reviewer' && !agreed && !iProposed && !locked;

  const headline = agreed
    ? `Agreed · v${m.version} — signed by ${m.reviewer!.by} ${when(m.reviewer!.at)}`
    : m.proposedBy
      ? `Proposed by ${m.proposedBy.by} ${when(m.proposedBy.at)} · v${m.version} — awaiting reviewer`
      : `Not proposed yet · v${m.version} — the product default, unchanged`;

  return (
    <div className="w-full space-y-4 pb-8">
      <p className="text-[0.78125rem] text-ink-500 leading-relaxed max-w-[52rem]">
        How this engagement samples — agreed once, for every control. A control's sample step reads its number off
        the table below instead of asking the auditor to decide again, so there is one answer when a reviewer or an
        external auditor asks what the sampling approach is.
      </p>

      {/* ── where the methodology stands ─────────────────────────────────────────
          First thing on the page because it changes what every control below can
          do: until a reviewer has signed, nothing can be tested against it. */}
      <section className={cn('rounded-xl border p-5', agreed ? 'border-compliant-200 bg-compliant-50/40' : 'border-mitigated-200 bg-mitigated-50/40')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {agreed
              ? <BadgeCheck size={16} className="text-compliant-700 shrink-0 mt-0.5" />
              : <AlertTriangle size={16} className="text-mitigated-700 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className={cn('text-[0.8125rem] font-bold', agreed ? 'text-compliant-800' : 'text-mitigated-800')}>{headline}</p>
              <p className="text-[0.75rem] text-ink-600 leading-relaxed mt-1 max-w-[42rem]">
                {agreed
                  ? 'Every control on this engagement is sized from this table, and its working paper names the version it was tested under.'
                  : 'Testing is blocked until a reviewer signs. A size nobody has agreed is a number the auditor picked, which is the one thing this record exists to stop.'}
              </p>
              {locked && (
                <p className="text-[0.71875rem] text-ink-500 mt-2 inline-flex items-center gap-1.5">
                  <Lock size={11} /> The engagement is signed off — the methodology it was tested under is frozen.
                </p>
              )}
            </div>
          </div>

          {/* The signature, and — when it is not on offer — why it is not.
              A dead button teaches nobody the four-eyes rule; a sentence does. */}
          {role === 'reviewer' && !agreed && (
            canSign ? (
              <button
                onClick={signSampling}
                className="h-9 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
              >
                <ShieldCheck size={14} /> Sign the methodology
              </button>
            ) : (
              <p className="text-[0.71875rem] text-ink-600 leading-relaxed shrink-0 max-w-[18rem] rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
                {iProposed
                  ? <>You proposed this {when(m.proposedBy!.at)}, so you cannot be the one to sign it — four eyes means two people.</>
                  : <>The engagement is locked, so nothing more can be signed on it.</>}
              </p>
            )
          )}
          {role !== 'reviewer' && !agreed && (
            <p className="text-[0.71875rem] text-ink-500 shrink-0">Waiting on a reviewer.</p>
          )}
          {/* The one way back into the fields once it is agreed, and it says
              what it costs before it is pressed rather than after. */}
          {agreed && role === 'auditor' && !locked && (
            revisingDraft ? (
              <button
                onClick={() => { setDraft(snapshot(m)); setRevisingDraft(false); }}
                className="h-9 px-4 shrink-0 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] font-semibold text-ink-600 hover:border-ink-300 transition-colors cursor-pointer"
              >
                Stop revising
              </button>
            ) : (
              <button
                onClick={() => setRevisingDraft(true)}
                title={`Creates v${m.version + 1} and returns the methodology to unsigned`}
                className="h-9 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
              >
                <History size={14} /> Revise the methodology
              </button>
            )
          )}
        </div>
      </section>

      {/* ── nothing has moved yet ───────────────────────────────────────────────
          Same reasoning as the ground rules' draft bar: the fields above look
          committed the moment you stop typing in them, so the page has to say
          that they are not. Which button appears is the whole edit-versus-revise
          distinction — a proposal saves, an agreement has to be revised. */}
      {dirty && (
        <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[0.75rem] text-mitigated-800 leading-relaxed min-w-0 inline-flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-bold">Not saved yet.</span>{' '}
              {agreed
                ? <>This methodology is agreed, so it is not edited in place. Saving creates <b>v{m.version + 1}</b>, returns it to unsigned and needs the reviewer's signature again — so it asks for a reason first.</>
                : <>{changes.length} change{changes.length === 1 ? '' : 's'} to the proposal. It still has to be signed by a reviewer before anything can be tested against it.</>}
            </span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { setDraft(snapshot(m)); setRevisingDraft(false); }} className="h-9 px-3.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] font-semibold text-ink-600 hover:border-ink-300 transition-colors cursor-pointer">Discard</button>
            {agreed ? (
              <button onClick={() => setRevising(true)} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
                <History size={14} /> Review &amp; revise
              </button>
            ) : (
              <button onClick={() => proposeSampling({ sizes: draft.sizes, method: draft.method, spread: draft.spread, roundBasis: draft.roundBasis })} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
                Save the proposal
              </button>
            )}
          </div>
        </div>
      )}
      {revising && (
        <ReviseModal
          changes={changes}
          nextVersion={m.version + 1}
          runningAudits={eng.audits.filter(a => !a.archive).map(a => `${a.period} · v${a.samplingVersion ?? m.version}`)}
          onClose={() => setRevising(false)}
          onRevise={reason => { reviseSampling({ sizes: draft.sizes, method: draft.method, spread: draft.spread, roundBasis: draft.roundBasis }, reason); setRevising(false); setRevisingDraft(false); }}
        />
      )}

      {/* ── is it actually being followed? ──────────────────────────────────────
          Surfaced, never enforced (the user's instruction). A methodology
          departed from on a third of the register has stopped being a
          methodology and become a suggestion — and the only way anyone notices
          is if the number is on the same screen as the table it departs from. */}
      {overrides.sized > 0 && (
        <section className="rounded-xl border border-canvas-border bg-canvas-elevated px-5 py-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[0.9375rem] font-bold text-ink-900">
              {overrides.overridden} of {overrides.sized}
            </span>
            <span className="text-[0.78125rem] text-ink-600">
              {overrides.overridden === 1 ? 'control has been sized' : 'controls have been sized'} against something other than this table
            </span>
          </div>
          <p className="text-[0.71875rem] text-ink-500 mt-1 leading-relaxed max-w-[42rem]">
            {overrides.overridden === 0
              ? 'Every size drawn so far was read off the agreed table.'
              : 'A departure is always allowed and is never blocked — each one carries the auditor’s reason and prints on the working paper. But if this number keeps climbing, the table is not the methodology the engagement is really using.'}
          </p>
        </section>
      )}

      {/* ── the table ───────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Table2 size={15} className="text-brand-600" /> Sample sizes</h2>
        <p className="text-[0.71875rem] text-ink-500 mt-0.5 mb-3">How many items to test, by how often the control runs and how it is rated. A control with no rating yet is sized at Medium.</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-canvas-border">
              <th className="text-left text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 pb-2">Frequency</th>
              {RATINGS.map(r => (
                <th key={r} className="text-center text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 pb-2 w-[7rem]">{r[0]!.toUpperCase()}{r.slice(1)} risk</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FREQUENCIES.map(f => (
              <tr key={f} className="border-b border-canvas-border last:border-b-0 align-top">
                <td className="py-2.5 pr-4">
                  <span className="text-[0.78125rem] font-semibold text-ink-800">{f}</span>
                  {/* The one row that cannot be sized off a rhythm, so the
                      judgment it needs is stated beside it rather than left to
                      whoever opens the control. */}
                  {f === 'Ad-hoc' && (
                    <p className="text-[0.6875rem] text-ink-500 leading-relaxed mt-0.5 max-w-[26rem]">
                      Judgment — there is no fixed rhythm to size against. Size by how often the control actually ran in
                      the period, and record that count on the paper.
                    </p>
                  )}
                </td>
                {RATINGS.map(r => (
                  <td key={r} className="py-2.5 text-center">
                    {canEdit ? (
                      <input
                        type="number" min={1} value={draft.sizes[f][r]}
                        aria-label={`${f}, ${r} risk — sample size`}
                        onChange={e => setSize(f, r, e.target.value)}
                        className="h-8 w-16 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    ) : (
                      <span className="text-[0.78125rem] font-semibold text-ink-800 tabular-nums">{m.sizes[f]?.[r] ?? DEFAULT_SAMPLE_SIZES[f][r]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[0.6875rem] text-ink-400 mt-3 leading-relaxed">
          Automated controls do not read this table — one instance proves the rule while their ITGCs hold. An ITGC
          failure puts them back on it, at their own frequency and rating.
        </p>
      </section>

      {/* ── how the items are picked ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Shuffle size={15} className="text-brand-600" /> Selection method</h2>
        <p className="text-[0.71875rem] text-ink-500 mt-0.5 mb-3">How the items are picked out of the population, on every control.</p>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Selection method">
          {SAMPLING_METHODS.map(opt => (
            <OptionCard
              key={opt} title={opt} note={METHOD_NOTE[opt]}
              selected={draft.method === opt} canEdit={canEdit}
              onPick={() => setDraft(d => ({ ...d, method: opt }))}
            />
          ))}
        </div>
        <p className="text-[0.6875rem] text-ink-400 mt-3 leading-relaxed">
          The seed behind every draw is stored with the sample, so the selection can be reperformed by somebody who was
          not there — a reviewer running it again lands on the same items.
        </p>
      </section>

      {/* ── what every draw has to reach ─────────────────────────────────────────
          Any, all or none — a tick group, not a choice of one, which is why it is
          its own section rather than three more cards under the method. */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Layers size={15} className="text-brand-600" /> Spread across</h2>
        <p className="text-[0.71875rem] text-ink-500 mt-0.5 mb-3">Each group ticked gets items of its own in every control's draw, so a sample cannot land entirely in one quarter or one company.</p>
        <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Spread across">
          {SAMPLING_SPREADS.map(opt => (
            <OptionCard
              key={opt.id} title={opt.label} note={SPREAD_NOTE[opt.id]} multi
              selected={draft.spread.includes(opt.id)} canEdit={canEdit}
              onPick={() => setDraft(d => ({ ...d, spread: d.spread.includes(opt.id) ? d.spread.filter(x => x !== opt.id) : [...d.spread, opt.id] }))}
            />
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/60 px-3.5 py-2.5 flex items-start gap-2">
          <Info size={13} className="text-ink-500 shrink-0 mt-0.5" />
          <p className="text-[0.75rem] text-ink-600 leading-relaxed">
            {draft.spread.length
              ? <>Every control's draw is split across <span className="font-semibold text-ink-900">{spreadLabel(draft.spread).toLowerCase()}</span>, with at least one item in each — and the Sample step reads the draw back group by group, so a group that got none is visible.</>
              : <><span className="font-semibold text-ink-900">Not spread</span> — items fall wherever the selection puts them. Tick anything every draw has to reach.</>}
          </p>
        </div>
      </section>

      {/* ── one year, two rounds ──────────────────────────────────────────────────
          The consequence sentence is on screen for whatever is currently chosen
          (user ask): this is a choice people make by its effect, not by its name. */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><CalendarRange size={15} className="text-brand-600" /> Across rounds</h2>
        <p className="text-[0.71875rem] text-ink-500 mt-0.5 mb-3">A year is tested in rounds — interim first, then roll-forward. This says whether each round draws its own sample or the year is drawn once.</p>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Across rounds">
          {(Object.keys(BASIS_LABEL) as SamplingRoundBasis[]).map(opt => (
            <OptionCard
              key={opt} title={BASIS_LABEL[opt]} note={BASIS_NOTE[opt]}
              selected={draft.roundBasis === opt} canEdit={canEdit}
              onPick={() => setDraft(d => ({ ...d, roundBasis: opt }))}
            />
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/60 px-3.5 py-2.5 flex items-start gap-2">
          <Info size={13} className="text-ink-500 shrink-0 mt-0.5" />
          <p className="text-[0.75rem] text-ink-600 leading-relaxed">
            <span className="font-semibold text-ink-900">{BASIS_LABEL[draft.roundBasis]} means</span> — {ROUND_BASIS_EFFECT[draft.roundBasis]}
          </p>
        </div>
      </section>

      {/* ── what the methodology used to be ──────────────────────────────────────
          On this page rather than in the audit trail for the same reason the
          ground rules' log is on theirs: the question it answers — "were these
          always the numbers?" — is asked here, looking at them. */}
      {log.length > 0 && (
        <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><History size={15} className="text-brand-600" /> Changes to the methodology</h2>
          <p className="text-[0.71875rem] text-ink-500 mt-0.5 mb-3">Every revision since the engagement opened, newest first. An audit stays on the version it was created under.</p>
          <div className="space-y-2.5">
            {log.map(entry => (
              <div key={entry.id} className="rounded-xl border border-canvas-border bg-paper-50/50 px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-[0.78125rem] font-bold text-ink-800">v{entry.version}</span>
                  <span className="text-[0.6875rem] text-ink-400 shrink-0">{entry.by} · {entry.at}</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {entry.changes.map(c => (
                    <div key={c.field} className="flex items-center justify-between gap-3 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-1.5">
                      <span className="text-[0.71875rem] text-ink-700 min-w-0 truncate">{c.field}</span>
                      <span className="text-[0.71875rem] tabular-nums shrink-0">
                        <span className="text-ink-400">{c.from}</span>
                        <ArrowRight size={10} className="inline mx-1 -mt-0.5 text-ink-300" />
                        <span className="font-bold text-ink-900">{c.to}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[0.71875rem] text-ink-600 leading-relaxed mt-1.5"><span className="text-ink-400">Why</span> · {entry.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** One choice in a group — a button when the reader may change it, a plain card
 *  when they may not. Absent rather than disabled, the rule the rest of the
 *  module follows: what a hat cannot do, it is not offered.
 *
 *  `multi` is the spread group, where any number may be on at once: same card,
 *  but a tick, because a group of radios that does not behave like radios is the
 *  worse of the two mistakes. */
function OptionCard({ title, note, selected, canEdit, multi, onPick }: {
  title: string; note: string; selected: boolean; canEdit: boolean; multi?: boolean; onPick: () => void;
}) {
  const shell = cn('rounded-xl border px-3.5 py-3 text-left', selected ? 'border-brand-300 bg-brand-50/40' : 'border-canvas-border');
  const body = (
    <>
      <span className={cn('flex items-center gap-1.5 text-[0.78125rem] font-bold', selected ? 'text-brand-700' : 'text-ink-800')}>
        {multi && selected && <Check size={12} className="shrink-0" />}{title}
      </span>
      <span className="block text-[0.6875rem] text-ink-500 leading-relaxed mt-0.5">{note}</span>
    </>
  );
  return canEdit ? (
    <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={selected} onClick={onPick}
      className={cn(shell, 'transition-colors cursor-pointer', !selected && 'hover:border-ink-300')}>{body}</button>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * The gate in front of a change to something already agreed.
 *
 * It shows what moves, who is still mid-audit on the old version, and asks for
 * the reason the log will carry. The reason is mandatory because a revision is
 * the one thing here that can make an already-tested control's size look wrong
 * in hindsight — "why" is the only defence against that.
 */
function ReviseModal({ changes, nextVersion, runningAudits, onClose, onRevise }: {
  changes: { field: string; from: string; to: string }[];
  nextVersion: number;
  runningAudits: string[];
  onClose: () => void;
  onRevise: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-canvas-border">
          <h3 className="text-[0.875rem] font-bold text-ink-900 inline-flex items-center gap-2"><History size={16} className="text-brand-600" /> Revise the methodology</h3>
          <p className="text-[0.75rem] text-ink-500 mt-1">Nothing has changed yet. This is what revising would do.</p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What changes — {changes.length}</span>
            <div className="space-y-1">
              {changes.map(c => (
                <div key={c.field} className="flex items-center justify-between gap-3 rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2">
                  <span className="text-[0.75rem] text-ink-700 min-w-0 truncate">{c.field}</span>
                  <span className="text-[0.75rem] tabular-nums shrink-0">
                    <span className="text-ink-400">{c.from}</span>
                    <ArrowRight size={10} className="inline mx-1 -mt-0.5 text-ink-300" />
                    <span className="font-bold text-ink-900">{c.to}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What it costs</span>
            <p className="text-[0.75rem] text-ink-600 leading-relaxed rounded-lg border border-mitigated-200 bg-mitigated-50/40 px-3 py-2.5 inline-flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-mitigated-700" />
              <span>
                This becomes <b>v{nextVersion}</b> and goes back to unsigned, so no control can be tested against it until
                the reviewer signs again.
                {runningAudits.length > 0 && <> Audits already open stay on the version they were created under — {runningAudits.join(', ')} — so nothing half-tested is re-sized underneath it.</>}
              </span>
            </p>
          </div>

          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Why this is changing</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="e.g. the monthly population came in far larger than planned, so the monthly sizes are re-cut on the actual volumes"
              className="w-full px-3 py-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
            <p className="text-[0.625rem] text-ink-400 mt-1">Recorded against the version, with your name and everything it moved.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <button onClick={onClose} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
          <button disabled={!reason.trim()} title={reason.trim() ? undefined : 'A change to an agreed methodology needs a reason on the record.'}
            onClick={() => onRevise(reason.trim())}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Create v{nextVersion}</button>
        </div>
      </div>
    </div>,
    document.body);
}
