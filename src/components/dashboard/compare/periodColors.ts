// ─── The colour of a period ───
// Series mode draws one series per period, so the palette has to carry time,
// not category: a single-hue ramp from pale (oldest) to full brand (newest).
// It reads in order at any length, survives greyscale, and never implies that
// two periods are different *kinds* of thing.

const STOPS = ['#E0D0F8', '#B387F3', '#8838DE', '#6A12CD'] as const;

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `n` colours along the ramp, oldest first, newest always the brand. */
export function periodColors(n: number): string[] {
  if (n <= 1) return [STOPS[STOPS.length - 1]];
  return Array.from({ length: n }, (_, i) => {
    const p = (i / (n - 1)) * (STOPS.length - 1);
    const lo = Math.floor(p), hi = Math.min(STOPS.length - 1, lo + 1), f = p - lo;
    const a = hex(STOPS[lo]), b = hex(STOPS[hi]);
    return toHex(a.map((v, k) => v + (b[k] - v) * f));
  });
}
