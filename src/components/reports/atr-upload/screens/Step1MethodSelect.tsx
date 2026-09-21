import { LayoutTemplate, FileUp } from 'lucide-react';
import MethodSelectionCard from '../components/MethodSelectionCard';
import type { UploadMethod } from '../types';

/** Upload · step one — choose how to bring an audit report into the ATR
 *  generator. Picking a card reveals that method's upload form directly
 *  below, on the same tab. `compact` (a method is chosen) tightens the heading
 *  so the cards read as a switch rather than the question. */
export default function Step1MethodSelect({ onPick, selected, compact }: { onPick: (method: UploadMethod) => void; selected?: UploadMethod | null; compact?: boolean }) {
  return (
    <div>
      {compact ? (
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <h2 className="text-[0.8125rem] font-semibold text-ink-900">Source</h2>
          <p className="text-[0.75rem] text-ink-500">Pick the other card to switch.</p>
        </div>
      ) : (
        <>
          <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-1">How do you want to start?</h2>
          <p className="text-[0.8125rem] text-ink-500 mb-5">Bring an audit report you already have, or fill our structured template first. Pick one — the upload form appears below.</p>
        </>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <MethodSelectionCard
          index={0}
          icon={LayoutTemplate}
          title="Use IRAME Template"
          description="Download our structured template, fill it offline, and upload it back. Best for clean, predictable extraction."
          ctaLabel="Start with the template"
          selected={selected === 'template'}
          onClick={() => onPick('template')}
        />
        <MethodSelectionCard
          index={1}
          icon={FileUp}
          title="Upload Existing Report"
          description="Already have an audit report? Upload it and we read out the observations, action plans and annexures, then you check what we found."
          ctaLabel="Upload a report"
          selected={selected === 'report'}
          onClick={() => onPick('report')}
        />
      </div>
    </div>
  );
}
