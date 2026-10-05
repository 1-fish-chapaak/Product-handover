/**
 * Process cards for the Control Library carousel. The carousel renders
 * images, so each card is drawn as an SVG — editorial, not decorative: the
 * process, what it covers, how much of it runs live today, and the control
 * counts behind that number. Fonts fall back to the system stack inside an
 * <img>, which is why the stacks below are explicit.
 */
export interface ProcessCardData {
  code: string;
  name: string;
  blurb: string;
  color: string;
  total: number;
  live: number;
  awaiting: number;
  needs: number;
  manual: number;
  /** Automated controls with a live workflow, 0–100. */
  pct: number;
}

const W = 300;
const H = 380;
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Greedy word wrap by an approximate character budget. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

export function processCardImage(p: ProcessCardData): string {
  const nameLines = wrapLines(p.name, 18, 2);
  const blurbLines = wrapLines(p.blurb, 36, 2);
  const nameY = 92;
  const blurbY = nameY + nameLines.length * 28 + 6;
  const barW = W - 48;
  const fill = Math.round((p.pct / 100) * barW);
  const stats: [string, number, string][] = [
    ['Controls', p.total, '#1B1225'],
    ['Live', p.live, '#15803D'],
    ['Awaiting review', p.awaiting, '#0369A1'],
    ['Need data', p.needs, '#B45309'],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="#FFFFFF" stroke="#E7E2EE"/>
  <rect x="0" y="0" width="${W}" height="6" rx="3" fill="${p.color}"/>
  <text x="24" y="50" font-family="${MONO}" font-size="15" font-weight="700" fill="${p.color}" letter-spacing="0.5">${esc(p.code)}</text>
  <text x="${W - 24}" y="50" text-anchor="end" font-family="${SANS}" font-size="11" fill="#8A8494">${p.total} controls</text>
  ${nameLines.map((l, i) => `<text x="24" y="${nameY + i * 28}" font-family="${SANS}" font-size="23" font-weight="650" fill="#1B1225">${esc(l)}</text>`).join('')}
  ${blurbLines.map((l, i) => `<text x="24" y="${blurbY + i * 17}" font-family="${SANS}" font-size="12.5" fill="#6B6475">${esc(l)}</text>`).join('')}
  <text x="24" y="232" font-family="${SANS}" font-size="11" fill="#8A8494">Live automated coverage</text>
  <text x="24" y="270" font-family="${MONO}" font-size="36" font-weight="700" fill="#1B1225">${p.pct}%</text>
  <rect x="24" y="282" width="${barW}" height="6" rx="3" fill="#F1EEF5"/>
  ${fill > 0 ? `<rect x="24" y="282" width="${fill}" height="6" rx="3" fill="${p.color}"/>` : ''}
  <line x1="24" y1="306" x2="${W - 24}" y2="306" stroke="#EFEBF3"/>
  ${stats.map(([label, value, color], i) => {
    const x = 24 + (i % 2) * ((W - 48) / 2);
    const y = 332 + Math.floor(i / 2) * 26;
    return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="14" font-weight="700" fill="${color}">${value}</text><text x="${x + 26}" y="${y}" font-family="${SANS}" font-size="11.5" fill="#6B6475">${esc(label)}</text>`;
  }).join('')}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const PROCESS_CARD_ASPECT = W / H;
