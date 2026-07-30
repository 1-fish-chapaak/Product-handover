import { LayoutTemplate, FileUp, Check } from 'lucide-react';
import MethodSelectionCard from '../components/MethodSelectionCard';
import type { UploadMethod } from '../types';

// What the generated ATR will contain — shown beneath the method cards so the
// step reads top-to-bottom and the modal isn't mostly empty space.
const ATR_INCLUDES = [
  'Observation title & description',
  'Risk significance rating',
  'Classification & status',
  'Management action plan',
  'Action owner & target date',
  'Linked annexures (exception rows)',
  'Executive summary & KPIs',
  'Auditee responses',
];

// How the flow runs after this step — a quick orientation strip.
const FLOW_STEPS = [
  'Add report or template',
  'Review extracted observations',
  'Map annexures to cases',
  'Generate the ATR',
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
          description="Already have an audit report? Upload it and we'll extract everything automatically — observations, action plans and annexures."
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
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-4">After you start</div>
          <ol className="relative">
            {FLOW_STEPS.map((label, i) => (
              <li key={label} className="relative flex items-start gap-3 pb-5 last:pb-0">
                {/* Connector line to the next step */}
                {i < FLOW_STEPS.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-1 w-px bg-canvas-border" />
                )}
                <span className="relative z-10 w-7 h-7 rounded-full bg-brand-600 text-white text-[0.75rem] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-1 text-[0.78125rem] text-ink-700 leading-snug">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
