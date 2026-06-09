import { useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';

/**
 * Modern launch-in-new-tab CTA for "Manage Exceptions". On click:
 *   1. A brand-tinted ripple radiates from the click point (tactile feedback).
 *   2. A short shimmer sweeps left→right across the button (state change signal).
 *   3. The trailing arrow "ejects" right and fades (directional cue → new tab).
 *   4. A tiny "Opening in new tab…" pill pops above the button (context hint
 *      so the user is never surprised by the new tab).
 *   5. After 340ms, window.open fires with a URL (?view=manage-exceptions)
 *      that the SPA reads on load to land directly on the Manage Exceptions view.
 *   6. Button is locked during the 340ms window to prevent double-fire.
 *
 * The whole interaction lives under 500ms, respects prefers-reduced-motion
 * (the keyframes auto-shorten to 10ms via the global reduced-motion rule in
 * index.css), and has no dependency on external animation libraries.
 *
 * Extracted to its own module so both the report view and the generated-ATR
 * preview render the exact same CTA with identical behavior.
 */
export function ManageExceptionsLaunchButton({ queryId, compact = false }: { queryId: string; compact?: boolean }) {
  const [launching, setLaunching] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (launching) return;
    if (!compact) {
      const rect = e.currentTarget.getBoundingClientRect();
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    }
    setLaunching(true);
    // Kick off a page-level LTR launch pulse so the whole shell nudges right
    // in sync with the button — reinforces the "content is ejecting" metaphor.
    window.dispatchEvent(new CustomEvent('app:launch-pulse'));
    // Fire the new tab just after the user's eye has locked onto the hint.
    window.setTimeout(() => {
      const url = `${window.location.pathname}?view=manage-exceptions&from=${encodeURIComponent(queryId)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 340);
    // Reset state so the button becomes re-usable (same tab stays open).
    window.setTimeout(() => {
      setLaunching(false);
      setRipple(null);
    }, 700);
  };

  // Compact link — lives in the QueryCard meta row alongside the icon buttons.
  // Editorial register: type-only, no fill, no shadow. Hover lifts to brand.
  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={launching}
        title="Review & classify exceptions · opens in a new tab"
        aria-label={`Review & classify exceptions for ${queryId} — opens in a new tab`}
        className={`group inline-flex items-center gap-1.5 h-8 px-2 -mx-2 rounded-[8px] text-[12px] leading-4 font-semibold text-text-secondary hover:text-primary hover:bg-surface-2 cursor-pointer transition-colors ${
          launching ? 'opacity-60' : ''
        }`}
      >
        <span>Manage exceptions</span>
        <ArrowRight
          size={16}
          className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={launching}
      title="Review & classify exceptions · opens in a new tab"
      aria-label={`Review & classify exceptions for ${queryId} — opens in a new tab`}
      className={`group relative overflow-hidden inline-flex items-center gap-1.5 h-8 pl-3 pr-2.5 text-[12px] font-semibold text-white rounded-[8px] cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(106,18,205,0.25)] hover:shadow-[0_4px_14px_rgba(106,18,205,0.35)] ${
        launching ? 'scale-[0.97] shadow-[0_0_0_4px_rgba(106,18,205,0.25),0_4px_14px_rgba(106,18,205,0.35)]' : 'hover:-translate-y-[1px] active:translate-y-0'
      }`}
      style={{ background: 'linear-gradient(135deg, #6A12CD 0%, #A366F0 100%)' }}
    >
      <ShieldAlert size={14} className="shrink-0 relative z-10" />
      <span className="relative z-10">Manage Exceptions</span>
      <ArrowRight
        size={14}
        className={`shrink-0 relative z-10 ${launching ? '' : 'transition-transform duration-200 group-hover:translate-x-0.5'}`}
        style={launching ? { animation: 'launch-arrow-eject 340ms cubic-bezier(0.2, 0, 0, 1) forwards' } : undefined}
      />

      {/* Ripple from click point */}
      {ripple && (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="absolute pointer-events-none rounded-full bg-white/50"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 8,
            height: 8,
            animation: 'launch-ripple 620ms cubic-bezier(0.2, 0, 0, 1) forwards',
          }}
        />
      )}

      {/* Shimmer sweep */}
      {launching && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)',
            animation: 'launch-shimmer 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />
      )}

      {/* Context hint — "Opening in new tab…" */}
      {launching && (
        <span
          aria-hidden="true"
          className="absolute -top-[32px] left-1/2 text-[10px] font-semibold text-primary bg-white border border-primary/25 px-2 h-6 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 pointer-events-none"
          style={{ animation: 'launch-hint-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        >
          <ArrowRight size={12} className="-rotate-45" />
          Opening in new tab…
        </span>
      )}
    </button>
  );
}
