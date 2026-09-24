/** Series palette shared by ModelChart and the compare renderer. */
export const PALETTE = ['#6a12cd', '#8838DE', '#A366F0', '#0d9488', '#C2410C', '#B45309', '#0369A1'];

/** Axis / tooltip number format shared with the compare renderer. */
export const localeFor = (label = ''): string => (label.includes('$') ? 'en-US' : 'en-IN');
export const fmtNumber = (v: number, label = ''): string => (Math.abs(v) >= 1000 ? v.toLocaleString(localeFor(label)) : String(v));

/** Axis ticks: 9,50,000 → 950K, 1,97,91,583 → 19.8M — fits a 48px gutter. */
export const fmtAxis = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  const short = (n: number, unit: string) => `${sign}${(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)}${unit}`;
  if (abs >= 1e9) return short(abs / 1e9, 'B');
  if (abs >= 1e6) return short(abs / 1e6, 'M');
  if (abs >= 1e4) return short(abs / 1e3, 'K');
  return fmtNumber(v);
};
