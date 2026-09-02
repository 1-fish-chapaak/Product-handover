import { LayoutTemplate, FileUp, Check } from 'lucide-react';
import MethodSelectionCard from '../components/MethodSelectionCard';
import type { UploadMethod } from '../types';

// What the generated ATR will contain — shown beneath the method cards so the
// step reads top-to-bottom and the modal isn't mostly empty space.
const ATR_INCLUDES = [
  'Observation title & description',
  'Risk significance rating',
  'Classification & status',
  'Action plan',
  'Action owner & target date',
  'Linked annexures (exception rows)',
  'Executive summary & KPIs',
  'Auditee responses',
];

// The steps that follow this one. These are the stepper's own stages, in the
// stepper's own words — the panel used to describe a four-step flow with
// different names next to a five-step bar, so the screen gave two accounts of
// the same wizard. Keep in step with WIZARD_STEPS in AtrUploadTab.
const FLOW_STEPS = [
  { label: 'Upload', detail: 'Add the report and any annexure workbooks.' },
  { label: 'Extraction', detail: 'Check the observations we read out of it.' },
  { label: 'Annexures', detail: 'Match each exception sheet to its observation.' },
  { label: 'ATR Preview', detail: 'Read the finished ATR, then save or download.' },
];

/** Screen 1 — choose how to bring an audit report into the ATR generator. */
export default function Step1MethodSelect({ onPick }: { onPick: (method: UploadMethod) => void }) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-1">How do you want to start?</h2>
      <p className="text-[0.8125rem] text-ink-500 mb-5">Bring an audit report you already have, or fill our structured template first.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <MethodSelectionCard
          index={0}
          icon={LayoutTemplate}
          title="Use IRAME Template"
          description="Download our structured template, fill it offline, and upload it back. Best for clean, predictable extraction."
          ctaLabel="Get started"
          onClick={() => onPick('template')}
        />
        <MethodSelectionCard
          index={1}
          icon={FileUp}
          title="Upload Existing Report"
          description="Already have an audit report? Upload it and we read out the observations, action plans and annexures. You confirm the cover details and check what we found."
          ctaLabel="Get started"
          onClick={() => onPick('report')}
        />
      </div>

      {/* Supporting context — fills the remaining height so the step reads
          top-to-bottom with no dead space in the middle. */}
      <div className="mt-5 flex-1 min-h-0 grid lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* What the finished ATR contains */}
        <div className="rounded-lg border border-canvas-border bg-brand-50/30 p-5">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brand-700/80 mb-3">What every ATR includes</div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2">
            {ATR_INCLUDES.map(item => (
              <li key={item} className="flex items-start gap-2 text-[0.78125rem] text-ink-700 leading-snug">
                <Check size={13} className="text-brand-600 mt-0.5 shrink-0" aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </div>

        {/* How the rest of the flow runs — a clean connected timeline. */}
        <div className="rounded-lg border border-canvas-border bg-canvas p-5">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-4">The four steps after this one</div>
          <ol className="relative">
            {FLOW_STEPS.map((step, i) => (
              <li key={step.label} className="relative flex items-start gap-3 pb-5 last:pb-0">
                {/* Connector line to the next step */}
                {i < FLOW_STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-1 w-px bg-canvas-border" />
                )}
                {/* Numbered from 2 so the badge matches the stage's own number
                    in the stepper above. */}
                <span className="relative z-10 w-7 h-7 rounded-full bg-brand-600 text-white text-[0.75rem] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                  {i + 2}
                </span>
                <div className="pt-1 min-w-0">
                  <div className="text-[0.78125rem] font-semibold text-ink-800 leading-snug">{step.label}</div>
                  <div className="text-[0.75rem] text-ink-500 leading-snug">{step.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
