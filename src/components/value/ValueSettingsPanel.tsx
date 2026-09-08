/**
 * Settings. Every number the model uses, in one place, editable.
 *
 * There are no multipliers here, because there are no multipliers. What is
 * left is a rate, a working day, a currency conversion, the rules that decide
 * how a job is sized, and the rules that decide when evidence is good enough
 * to use. Nothing on this screen can conjure a value figure out of work that
 * has no document and no timing behind it.
 *
 * Changing one of these changes the page immediately, which is deliberate: a
 * rate you cannot feel the effect of is a rate nobody checks. What it must not
 * do is quietly move a figure somebody has already read, and the note at the
 * bottom says how much of that this build does.
 */

import { fmtInt, type ValueSettings } from '../../data/value/model';
import { BAND_LABEL, GOVT_LOOKUPS } from '../../data/value/settings';
import { Block } from './chrome';

export default function ValueSettingsPanel({
  settings, onSettings,
}: {
  settings: ValueSettings;
  onSettings: (next: ValueSettings) => void;
}) {
  const set = <K extends keyof ValueSettings>(key: K, value: ValueSettings[K]) =>
    onSettings({ ...settings, [key]: value });

  const monthHours = settings.hoursPerDay * settings.daysPerMonth;

  return (
    <div className="space-y-7">
      <Block title="What an hour is worth" hint="The rate everything on the value page is priced at.">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="Auditor hourly rate" suffix="rupees an hour">
            <Num value={settings.hourlyRateInr} onChange={v => set('hourlyRateInr', v)} />
          </Field>
          <Field label="Hours in a working day">
            <Num value={settings.hoursPerDay} onChange={v => set('hoursPerDay', v)} />
          </Field>
          <Field label="Days in a month">
            <Num value={settings.daysPerMonth} onChange={v => set('daysPerMonth', v)} />
          </Field>
          <Field label="Dollars to rupees" suffix="rupees to the dollar">
            <Num value={settings.usdToInr} step={0.5} onChange={v => set('usdToInr', v)} />
          </Field>
        </div>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          One auditor month is {fmtInt(monthHours)} hours, so ₹{fmtInt(monthHours * settings.hourlyRateInr)}.
          Capacity on the value page is quoted against that. The dollar rate is stored for the range
          it was used on, so a later move in the currency does not rewrite an old figure.
        </p>
      </Block>

      <Block
        title="Which manual figure wins"
        hint="A timing is more accurate. Your own signed document is harder to argue with. This is the only place that order can be flipped."
      >
        <div className="space-y-2">
          <Radio
            checked={settings.basisOrder === 'documented-first'}
            onChange={() => set('basisOrder', 'documented-first')}
            label="Your documentation first, then a timing"
            hint="What a matrix or an audit plan says the test takes, with a timing only where there is no document."
          />
          <Radio
            checked={settings.basisOrder === 'measured-first'}
            onChange={() => set('basisOrder', 'measured-first')}
            label="A timing first, then your documentation"
            hint="More accurate and easier to challenge, because a reader can always ask who was timed."
          />
        </div>
      </Block>

      <Block
        title="How a job is sized"
        hint="Bands decide which timing applies. A band never supplies an effort figure of its own, so changing these moves which evidence is used and never invents any."
      >
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="A workflow is high at or above" suffix="documented hours">
            <Num
              value={settings.workflowBands.highHours}
              step={0.25}
              onChange={v => set('workflowBands', { ...settings.workflowBands, highHours: v })}
            />
          </Field>
          <Field label="A workflow is medium at or above" suffix="documented hours">
            <Num
              value={settings.workflowBands.mediumHours}
              step={0.25}
              onChange={v => set('workflowBands', { ...settings.workflowBands, mediumHours: v })}
            />
          </Field>
        </div>

        <p className="mt-4 text-[0.875rem] font-medium text-ink-900">A chat turn, from what it did</p>
        <div className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="High at or above this many sources touched">
            <Num
              value={settings.chatBands.highDatasets}
              onChange={v => set('chatBands', { ...settings.chatBands, highDatasets: v })}
            />
          </Field>
          <Field label="Medium at or above this many sources touched">
            <Num
              value={settings.chatBands.mediumDatasets}
              onChange={v => set('chatBands', { ...settings.chatBands, mediumDatasets: v })}
            />
          </Field>
          <Field label="High at or above this many model calls" suffix="tiebreak only">
            <Num
              value={settings.chatBands.highLlmCalls}
              onChange={v => set('chatBands', { ...settings.chatBands, highLlmCalls: v })}
            />
          </Field>
          <Field label="Medium at or above this many model calls" suffix="tiebreak only">
            <Num
              value={settings.chatBands.mediumLlmCalls}
              onChange={v => set('chatBands', { ...settings.chatBands, mediumLlmCalls: v })}
            />
          </Field>
        </div>
        <div className="mt-2 space-y-2">
          <Check
            checked={settings.chatBands.planIsHigh}
            onChange={v => set('chatBands', { ...settings.chatBands, planIsHigh: v })}
            label="A turn that produced a plan is high"
            hint="Planning is the part of the job a person spends longest on by hand."
          />
          <Check
            checked={settings.chatBands.govtIsMedium}
            onChange={v => set('chatBands', { ...settings.chatBands, govtIsMedium: v })}
            label="A turn that needed a government lookup is at least medium"
            hint="A portal visit is in it somewhere, so it was never a one line answer."
          />
          <Check
            checked={settings.chatBands.validatedAgainstSample}
            onChange={v => set('chatBands', { ...settings.chatBands, validatedAgainstSample: v })}
            label="Somebody has checked these bands against a hand judged sample"
            hint="Until this is ticked, the page says on every scope that the banding is unproven. Tick it only when somebody has actually taken a sample of turns and judged whether the high ones were the hard ones."
          />
        </div>

        <p className="mt-4 text-[0.875rem] font-medium text-ink-900">A file, from how much there was to read</p>
        <div className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="High at or above" suffix="tokens">
            <Num
              value={settings.ingestionBands.highTokens}
              step={1000}
              onChange={v => set('ingestionBands', { ...settings.ingestionBands, highTokens: v })}
            />
          </Field>
          <Field label="Medium at or above" suffix="tokens">
            <Num
              value={settings.ingestionBands.mediumTokens}
              step={1000}
              onChange={v => set('ingestionBands', { ...settings.ingestionBands, mediumTokens: v })}
            />
          </Field>
        </div>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          A band stored on a row when it happened is never recomputed, so moving a threshold here
          changes how new work is sized and leaves last quarter exactly where it was. The three
          bands are {Object.values(BAND_LABEL).join(', ').toLowerCase()}, and keeping it to three is
          what makes the timing exercise one sitting per surface rather than five.
        </p>
      </Block>

      <Block
        title="When evidence is good enough"
        hint="The rules that decide whether a figure is used, shown as in progress, or ignored."
      >
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="Timings before one counts">
            <Num value={settings.minBenchmarkSample} onChange={v => set('minBenchmarkSample', v)} />
          </Field>
          <Field label="Disagreement worth flagging" suffix="per cent">
            <Num value={settings.divergenceThresholdPct} onChange={v => set('divergenceThresholdPct', v)} />
          </Field>
          <Field label="When a figure is called old" suffix="months">
            <Num value={settings.benchmarkStaleMonths} onChange={v => set('benchmarkStaleMonths', v)} />
          </Field>
          <Field label="How far back a middle run is taken from" suffix="days">
            <Num value={settings.referenceWindowDays} onChange={v => set('referenceWindowDays', v)} />
          </Field>
          <Field label="Run volume with evidence before the tab opens" suffix="per cent">
            <Num value={settings.minCoveragePct} onChange={v => set('minCoveragePct', v)} />
          </Field>
        </div>
        <div className="mt-3">
          <Check
            checked={settings.reachBackOverHistory}
            onChange={v => set('reachBackOverHistory', v)}
            label="A figure supplied today values work done before it arrived"
            hint="The runs were recorded long before anybody wrote the effort down, so loading a register makes a year of history valuable at once. Turn it off and only work done after the evidence arrived carries a value. Either way the page says which of its total came from a figure supplied later."
          />
        </div>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          Set the coverage threshold too high and the feature never appears. Set it too low and the
          first thing a finance lead sees is mostly blank. Raise it above where this workspace
          currently sits and the setup screen takes over, which is worth doing once to see what a
          new tenant gets.
        </p>
      </Block>

      <Block title="The monthly note" hint="Sent on the first, for the month before.">
        <Check
          checked={settings.digestEnabled}
          onChange={v => set('digestEnabled', v)}
          label="Send it"
          hint="Anybody can turn their own off. A scope with no activity is not sent an empty one."
        />
      </Block>

      <Block title="What is deliberately missing" hint="Two settings people ask for, and why neither exists.">
        <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-500">
          <li>
            <span className="text-ink-800">No multiplier.</span> There is no box here that turns
            machine time into manual time, because any number in it would be one we invented. Work
            with no document and no timing is counted and left unvalued instead.
          </li>
          <li>
            <span className="text-ink-800">No price on an exception.</span> Pricing a missed
            exception is the first thing an audit committee takes apart, and the count carries the
            argument on its own.
          </li>
          <li>
            <span className="text-ink-800">No government minutes.</span> An earlier draft had six
            minutes a lookup typed in as a default. Nobody had timed it, so it is gone. The five
            lookups that have been timed are valued and the other nine are not.
          </li>
        </ul>
      </Block>

      <details className="border-t border-canvas-border pt-4">
        <summary className="cursor-pointer text-[0.875rem] text-ink-600">
          The fourteen government lookups and what they cost
        </summary>
        <ul className="mt-2 grid gap-x-8 gap-y-1 text-[0.875rem] text-ink-500 sm:grid-cols-2">
          {GOVT_LOOKUPS.map(l => (
            <li key={l.key} className="tabular-nums">
              {l.label} <span className="text-ink-400">₹{l.priceInr} a call</span>
            </li>
          ))}
        </ul>
      </details>

      <p className="border-t border-canvas-border pt-4 text-[0.875rem] leading-relaxed text-ink-500">
        In the real thing every one of these is dated, so changing a rate today leaves last
        quarter's figure exactly where the person who read it left it, and each day is worked out at
        the values in force on that day. In this build a change applies to everything on screen at
        once, so you can see what it does.
      </p>
    </div>
  );
}

function Field({
  label, suffix, children,
}: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-canvas-border/60 pb-2.5">
      <span className="block text-[0.875rem] text-ink-500">{label}</span>
      <span className="mt-1 flex items-baseline gap-2">
        {children}
        {suffix ? <span className="text-[0.75rem] text-ink-400">{suffix}</span> : null}
      </span>
    </label>
  );
}

function Num({
  value, onChange, step = 1,
}: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
      className="w-28 rounded border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.875rem] tabular-nums text-ink-900"
    />
  );
}

function Radio({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[0.875rem] text-ink-800">
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        {label}
        <span className="mt-0.5 block text-ink-500">{hint}</span>
      </span>
    </label>
  );
}

function Check({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[0.875rem] text-ink-800">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1" />
      <span>
        {label}
        <span className="mt-0.5 block text-ink-500">{hint}</span>
      </span>
    </label>
  );
}
