import { LayoutTemplate, FileUp } from 'lucide-react';
import MethodSelectionCard from '../components/MethodSelectionCard';
import type { UploadMethod } from '../types';

/** Step 1 · Select — choose how to bring an audit report into the ATR
 *  generator. Picking a card moves on to the Upload tab. */
export default function Step1MethodSelect({ onPick, selected }: { onPick: (method: UploadMethod) => void; selected?: UploadMethod | null }) {
  return (
    <div>
      <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-1">How do you want to start?</h2>
      <p className="text-[0.8125rem] text-ink-500 mb-5">Bring an audit report you already have, or fill our structured template first. Pick one to continue to Upload.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <MethodSelectionCard
          index={0}
          icon={LayoutTemplate}
          title="Use IRAME Template"
          description="Download our structured template, fill it offline, and upload it back. Best for clean, predictable extraction."
          ctaLabel="Continue to Upload"
          selected={selected === 'template'}
          onClick={() => onPick('template')}
        />
        <MethodSelectionCard
          index={1}
          icon={FileUp}
          title="Upload Existing Report"
          description="Already have an audit report? Upload it and we read out the observations, action plans and annexures. You confirm the cover details and check what we found."
          ctaLabel="Continue to Upload"
          selected={selected === 'report'}
          onClick={() => onPick('report')}
        />
      </div>
    </div>
  );
}
