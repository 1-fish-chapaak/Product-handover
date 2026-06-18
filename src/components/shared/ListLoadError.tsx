import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';

interface ListLoadErrorProps {
  /** What failed to load, e.g. "risks", "controls". Used in the message. */
  label?: string;
  onRetry: () => void;
}

// Generic "couldn't load, retry" state for data lists. Calm and editorial — a
// neutral icon chip, not a red alarm (no RAG). Mirrors the empty-state layout so
// the surfaces read as a family. Dormant until a real remote source can fail.
export default function ListLoadError({ label = 'this', onRetry }: ListLoadErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-lg bg-paper-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-ink-500" aria-hidden="true" />
      </div>
      <h3 className="text-[0.9375rem] text-ink-800 mb-1">Couldn&apos;t load {label}</h3>
      <p className="text-[0.8125rem] text-ink-600 mb-5 max-w-[320px]">Something went wrong fetching this list. Check your connection, then try again.</p>
      <Button variant="outline" size="sm" leftIcon={<RotateCw size={13} />} onClick={onRetry}>Retry</Button>
    </div>
  );
}
