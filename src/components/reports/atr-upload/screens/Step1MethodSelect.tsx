import { LayoutTemplate, FileUp } from 'lucide-react';
import MethodSelectionCard from '../components/MethodSelectionCard';
import type { UploadMethod } from '../types';

/** Screen 1 — choose how to bring an audit report into the ATR generator. */
export default function Step1MethodSelect({ onPick }: { onPick: (method: UploadMethod) => void }) {
  return (
    <div className="max-w-[680px] mx-auto">
      <h2 className="text-[1rem] font-semibold text-ink-900 mb-1 text-center">How do you want to start?</h2>
      <p className="text-[12.5px] text-ink-500 mb-5 text-center">Bring an audit report you already have, or fill our structured template first.</p>
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
    </div>
  );
}
