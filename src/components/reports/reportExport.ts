// Export composers for the report download modal — Word, PPT, HTML.
//
// Follows the ATR exporter precedent (atrTemplate.ts): Word and PPT are
// Office-HTML blobs (.doc / .ppt — the HTML-in-Office trick Word and
// PowerPoint both import), and the tab labels name the application rather than
// claiming a .docx / .pptx these are not. PDF lives in reportPdf.ts, which
// writes a real .pdf with pdfmake. No Excel export by design (PRD ruling).

import * as XLSX from 'xlsx';
import type { DownloadPreviewSection } from './ReportDownloadModal';
import { brandGradient, brandAccent, isValidHexColor, type WorkflowResult, type SignatorySlot, type Signoff } from './reportShared';

export type ReportExportContext = {
  reportName: string;
  reportTag?: string;
  reportId?: string;
  templateName?: string;
  generatedBy: string;
  generatedAt: string;
  /** Page numbers on the exported document. Absent = on. */
  pageNumbers?: boolean;
  /** Custom brand colour (hex) — recolours the cover + accents. */
  brandColor?: string;
  /** Sign-off block: signatory slots + their manual sign state. */
  signatories?: SignatorySlot[];
  signoffs?: Record<string, Signoff>;
  /** The closing page, printed word for word at the end. Nothing in it is
   *  generated, so it arrives as lines rather than as a section. */
  closingText?: string[];
  /** Their brand mark (data URL), stamped on the exported letterhead. */
  logoDataUrl?: string;
  sections: DownloadPreviewSection[];
};

const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Strip the markdown the rich query answers carry — exports want plain prose.
const plain = (s?: string) =>
  (s ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const INK = '#0F0720';
const MUTED = '#6B5D82';
const BRAND = '#6A12CD';
const BRAND_DARK = '#550FA5';   // brand-700 — number-chip text
const BRAND_WASH = '#F7F0FF';   // brand-50 — number chips, table heads
const HAIRLINE = '#E5E7EB';     // canvas-border
// Purple banner palette — matches the on-screen CoverBanner gradient.
const BANNER_FROM = '#3B0B72';
const BANNER_TO = '#6A12CD';
const BANNER_BYLINE = '#E3D3F7';   // byline on purple
// Inter-led sans for document + section titles — mirrors the on-screen report
// pages (now all Inter). Segoe UI / Calibri / Arial are the safe Office fallbacks.
const TITLE_FONT = "Inter,'Segoe UI',Calibri,Arial,sans-serif";

const sevColor = (sev: string) =>
  sev === 'High' ? '#B42318' : sev === 'Medium' ? '#B54708' : '#067647';

// Report palette derived from the template's brand colour. Falls back to the
// default purple constants when no (valid) brand colour is set.
function palette(ctx: ReportExportContext) {
  if (!isValidHexColor(ctx.brandColor)) {
    return { from: BANNER_FROM, to: BANNER_TO, accent: BRAND_DARK, byline: BANNER_BYLINE };
  }
  const [from, to] = brandGradient(ctx.brandColor);
  return { from, to, accent: brandAccent(ctx.brandColor), byline: 'rgba(255,255,255,0.85)' };
}
// Recolour the body defaults (the purple constants used in metadata / sections /
// KPI accents) to the brand accent, so a custom-branded report is coherent. The
// banner is built from the palette directly, so it never contains these literals
// and is untouched. No-op when no custom brand colour is set.
function recolorBody(html: string, ctx: ReportExportContext): string {
  if (!isValidHexColor(ctx.brandColor)) return html;
  const accent = brandAccent(ctx.brandColor);
  return html
    .replace(/#6A12CD/gi, accent)   // BRAND — KPI/meta accents
    .replace(/#550FA5/gi, accent)   // BRAND_DARK — number-chip text
    .replace(/#F7F0FF/gi, '#F4F2FA'); // BRAND_WASH — chip / table-head wash
}

// The closing page for Word/PDF/HTML — their own last page, exactly as
// written. Empty when the template has none.
function closingBlockHtml(ctx: ReportExportContext): string {
  const lines = (ctx.closingText ?? []).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const accent = isValidHexColor(ctx.brandColor) ? brandAccent(ctx.brandColor) : BRAND_DARK;
  const rest = lines.slice(1)
    .map(l => `<p style="font-size:10.5pt;color:${MUTED};margin:6px 0 0;">${esc(l)}</p>`).join('');
  return `<div style="text-align:center;padding:44px 0 8px;">
    <div style="width:56px;height:2px;background:${accent};margin:0 auto 22px;"></div>
    <p style="font-family:${TITLE_FONT};font-weight:bold;font-size:19pt;color:${accent};margin:0;">${esc(lines[0])}</p>
    ${rest}
  </div>`;
}

// Approvals & sign-off block for Word/PDF/HTML. Renders each signatory as a
// bordered card with role, name (or signed-by), and a signed date or signature
// line. Empty when the report carries no signatories.
function signoffBlockHtml(ctx: ReportExportContext): string {
  const sigs = ctx.signatories ?? [];
  if (!sigs.length) return '';
  const accent = isValidHexColor(ctx.brandColor) ? brandAccent(ctx.brandColor) : BRAND_DARK;
  const cells = sigs.map(s => {
    const signed = ctx.signoffs?.[s.id];
    const name = signed?.signedBy || s.name || '';
    const foot = signed
      ? `<div style="border-top:1px solid #CFE8D6;padding-top:7px;color:#067647;font-weight:bold;font-size:9pt;">Signed &middot; ${esc(signed.signedAt)}</div>`
      : `<div style="border-top:1px dashed ${HAIRLINE};padding-top:7px;color:${MUTED};font-size:8.5pt;font-style:italic;text-align:center;">Signature / Approval</div>`;
    return `<td width="33%" style="padding:0 10px 0 0;vertical-align:top;">
      <div style="border:1px solid ${HAIRLINE};border-radius:8px;padding:14px 16px;">
        <div style="font-size:7.5pt;font-weight:bold;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:6px;">${esc(s.role)}</div>
        <div style="font-size:10pt;font-weight:bold;color:${INK};margin-bottom:16px;min-height:13px;">${esc(name)}</div>
        ${foot}
      </div>
    </td>`;
  }).join('');
  return `<div style="margin-top:24px;page-break-inside:avoid;">
    <div style="font-family:${TITLE_FONT};font-size:14pt;font-weight:bold;color:${accent};margin:0 0 12px;">Approvals &amp; Sign-Off</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
  </div>`;
}

// ─── ATR-document building blocks (mirrors AtrDocument.tsx proportions) ───

// Purple gradient letterhead — mirrors the on-screen report cover / ATR banner:
// white title + light byline over a brand gradient. A solid bgcolor backs the
// CSS gradient so Word (which ignores gradients) still fills purple; PDF/HTML
// render the gradient.
function brandBanner(ctx: ReportExportContext): string {
  const p = palette(ctx);
  const byline = [ctx.reportTag, `Generated by ${ctx.generatedBy}`, ctx.generatedAt].filter(Boolean).map(esc).join(' · ');
  // Their mark sits above the title, on a light chip so a dark logo stays
  // legible on the gradient — the same placement as the on-screen letterhead.
  const logo = ctx.logoDataUrl
    ? `<div style="display:inline-block;background:#FFFFFF;padding:6px 9px;border-radius:5px;margin-bottom:14px;"><img src="${ctx.logoDataUrl}" alt="" style="height:26px;max-width:170px;" /></div>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr><td bgcolor="${p.from}" style="background:${p.from};background:linear-gradient(135deg, ${p.from}, ${p.to});padding:34px 36px;">
      ${logo}
      <h1 style="font-family:${TITLE_FONT};color:#FFFFFF;font-size:23pt;font-weight:bold;margin:0;line-height:1.15;">${esc(ctx.reportName)}</h1>
      ${byline ? `<p style="color:${p.byline};font-size:10pt;margin:8px 0 0;">${byline}</p>` : ''}
    </td></tr>
  </table>`;
}

// Metadata grid — 3-up label/value cells with the brand left-accent bar.
function metaCell(label: string, value?: string): string {
  if (!value) return '<td></td>';
  return `<td width="33%" style="padding:14px 18px 14px 0;vertical-align:top;">
    <div style="font-size:7.5pt;font-weight:bold;letter-spacing:1.5px;color:${MUTED};text-transform:uppercase;margin-bottom:5px;">${esc(label)}</div>
    <div style="border-left:3px solid ${BRAND};padding-left:10px;font-size:10pt;font-weight:bold;color:${INK};">${esc(value)}</div>
  </td>`;
}

function metaGrid(ctx: ReportExportContext): string {
  const queries = ctx.sections.filter(s => s.kind === 'query').length;
  const workflows = ctx.sections.filter(s => s.kind === 'workflow').length;
  const scope = workflows > 0
    ? `${workflows} ${workflows === 1 ? 'workflow' : 'workflows'}`
    : queries > 0 ? `${queries} ${queries === 1 ? 'query' : 'queries'}` : undefined;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${HAIRLINE};margin:0 0 8px;">
    <tr>${metaCell('Report ID', ctx.reportId)}${metaCell('Report Type', ctx.reportTag)}${metaCell('Scope', scope)}</tr>
    <tr>${metaCell('Prepared By', ctx.generatedBy)}${metaCell('Generated On', ctx.generatedAt)}${metaCell('Template', ctx.templateName)}</tr>
  </table>`;
}

// Numbered section heading — brand-washed number chip + bold title.
function numberedHeading(n: number, title: string, sub?: string): string {
  return `<p style="margin:22px 0 ${sub ? '2px' : '10px'};">
    <span style="background:${BRAND_WASH};color:${BRAND_DARK};font-weight:bold;font-size:10pt;padding:3px 9px;">${n}</span>
    <span style="font-family:${TITLE_FONT};font-size:13.5pt;font-weight:bold;color:${INK};">&nbsp; ${esc(title)}</span>
  </p>${sub ? `<p style="margin:0 0 10px;color:${MUTED};font-size:9pt;">${esc(sub)}</p>` : ''}`;
}

// KPI tile grid — bordered tiles with the tone-coloured left accent, 4 per row.
function kpiTileGrid(stats: { label: string; value: string; accent?: string }[]): string {
  if (stats.length === 0) return '';
  const rows: string[] = [];
  for (let i = 0; i < stats.length; i += 4) {
    const cells = stats.slice(i, i + 4).map(st => `
      <td width="25%" style="border:1px solid ${HAIRLINE};border-left:3px solid ${st.accent ?? BRAND};padding:10px 14px;vertical-align:top;">
        <div style="font-size:15pt;font-weight:bold;color:${st.accent ?? BRAND};">${esc(st.value)}</div>
        <div style="font-size:7.5pt;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">${esc(st.label)}</div>
      </td>`).join('');
    rows.push(`<tr>${cells}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="6" style="margin:0 0 8px;">${rows.join('')}</table>`;
}

// ─── Table embedding (Word / HTML / PDF / PPT) ───
// Inline-styled to survive Office-HTML import. Mirrors the dashboard table:
// brand-700 first column, Severity → coloured pill, Status → muted, Expected → bold.
const SEV_HEX: Record<string, { bg: string; fg: string; bd: string }> = {
  Critical: { bg: '#FEF2F2', fg: '#B91C1C', bd: '#FECACA' },
  High: { bg: '#FFF7ED', fg: '#C2410C', bd: '#FED7AA' },
  Medium: { bg: '#FFFBEB', fg: '#B45309', bd: '#FDE68A' },
  Low: { bg: '#F0FDF4', fg: '#15803D', bd: '#BBF7D0' },
};

function exportCell(value: string, header: string, first: boolean): string {
  if (/severit|^risk/i.test(header)) {
    const c = SEV_HEX[value] ?? { bg: '#F9FAFB', fg: '#4B5563', bd: '#E5E7EB' };
    return `<span style="display:inline-block;font-size:8.5pt;font-weight:600;padding:1px 7px;border-radius:999px;background:${c.bg};color:${c.fg};border:1px solid ${c.bd};">${esc(value)}</span>`;
  }
  const style = first
    ? `color:${BRAND};font-weight:600;`
    : /status/i.test(header) ? `color:${MUTED};`
    : /expected/i.test(header) ? `color:${INK};font-weight:600;`
    : `color:${INK};`;
  return `<span style="${style}">${esc(value)}</span>`;
}

function tableBlock(t: { title: string; columns: string[]; rows: string[][] }): string {
  const head = t.columns.map(c =>
    `<th style="text-align:left;padding:5px 8px;font-size:8pt;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${HAIRLINE};background:#FAFAFB;white-space:nowrap;">${esc(c)}</th>`).join('');
  const body = t.rows.slice(0, 10).map(row =>
    `<tr>${row.map((cell, ci) => `<td style="padding:5px 8px;font-size:9pt;border-bottom:1px solid #F1F1F4;white-space:nowrap;">${exportCell(cell, t.columns[ci] || '', ci === 0)}</td>`).join('')}</tr>`).join('');
  return `<p style="margin:10px 0 3px;font-size:8.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;color:${MUTED};">${esc(t.title)}</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid ${HAIRLINE};margin:0 0 8px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ─── Shared document body (Word + PDF) ───
function composeDocumentBody(ctx: ReportExportContext): string {
  let n = 0;
  return ctx.sections.map(s => {
    if (s.kind === 'cover') return '';
    n += 1;
    if (s.kind === 'summary') {
      return `${numberedHeading(n, s.title, 'Overall rollup from this report’s queries')}
        ${kpiTileGrid(s.stats ?? [])}
        <p style="margin:6px 0 8px;line-height:1.55;">${esc(s.content)}</p>`;
    }
    if (s.kind === 'stats') {
      return kpiTileGrid(s.stats ?? []);
    }
    if (s.kind === 'query') {
      const kpis = (s.kpis ?? []).map(k => `<b>${esc(k.label)}:</b> ${esc(k.value)}`).join(' &nbsp;·&nbsp; ');
      const findings = s.findings.map(f => `<li style="margin:0 0 3px;">${esc(f)}</li>`).join('');
      const observations = s.observations.map(o => `<li style="margin:0 0 3px;">${esc(o)}</li>`).join('');
      const tables = (s.tables ?? []).filter(t => t.rows.length > 0).map(tableBlock).join('');
      return `${numberedHeading(n, `${s.queryId} — ${s.queryTitle}`)}
        <p style="margin:0 0 6px;color:${MUTED};font-size:10pt;">${esc(s.risk)} · <span style="color:${sevColor(s.severity)};font-weight:bold;">${esc(s.severity)} severity</span></p>
        ${kpis ? `<p style="margin:0 0 6px;font-size:10pt;">${kpis}</p>` : ''}
        <p style="margin:0 0 6px;line-height:1.55;">${esc(plain(s.summary))}</p>
        ${findings ? `<p style="margin:8px 0 2px;"><b>Key findings</b></p><ul style="margin:0 0 6px;">${findings}</ul>` : ''}
        ${observations ? `<p style="margin:8px 0 2px;"><b>Observations</b></p><ul style="margin:0 0 6px;">${observations}</ul>` : ''}
        ${tables}`;
    }
    if (s.kind === 'workflow') {
      const findings = s.findings.map(f => `<li style="margin:0 0 3px;">${esc(f)}</li>`).join('');
      return `${numberedHeading(n, `${s.workflowId} — ${s.workflowName}`)}
        <p style="margin:0 0 6px;color:${MUTED};font-size:10pt;"><span style="color:${sevColor(s.severity)};font-weight:bold;">${esc(s.severity)} severity</span></p>
        <p style="margin:0 0 6px;line-height:1.55;">${esc(plain(s.summary))}</p>
        ${findings ? `<ul style="margin:0 0 6px;">${findings}</ul>` : ''}`;
    }
    if (s.kind === 'note') {
      return `${numberedHeading(n, s.title)}<p style="margin:0 0 6px;line-height:1.5;">${esc(s.content)}</p>`;
    }
    if (s.kind === 'observation') {
      return `${numberedHeading(n, `${s.obsId} — ${s.title}`)}<p style="margin:0 0 6px;line-height:1.5;">${esc(s.description)}</p>`;
    }
    return '';
  }).join('');
}

// `wordFooter` injects a real Office page-number footer (PAGE / NUMPAGES fields)
// that Word renders on every page — only when page numbers are on. Plain HTML
// export leaves it off (browsers would render the mso markup as visible text).
function documentHtml(ctx: ReportExportContext, opts: { wordFooter?: boolean } = {}): string {
  const paginate = !!opts.wordFooter && ctx.pageNumbers !== false;
  const pageStyle = paginate
    ? `<style>@page Section1 { mso-footer: f1; } div.Section1 { page: Section1; } p.MsoFooter { margin:0; font-size:9pt; color:${MUTED}; }</style>`
    : '';
  const footer = paginate
    ? `<div style='mso-element:footer' id="f1"><p class=MsoFooter style='text-align:right;'>Page <span style='mso-field-code:" PAGE "'></span> of <span style='mso-field-code:" NUMPAGES "'></span></p></div>`
    : '';
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(ctx.reportName)}</title>${pageStyle}</head>
  <body style="font-family:Calibri,Arial,sans-serif;color:${INK};margin:0;">
    ${paginate ? '<div class="Section1">' : ''}
    ${brandBanner(ctx)}
    ${recolorBody(metaGrid(ctx), ctx)}
    ${recolorBody(composeDocumentBody(ctx), ctx)}
    ${signoffBlockHtml(ctx)}
    ${closingBlockHtml(ctx)}
    <hr style="border:none;border-top:1px solid ${HAIRLINE};margin:18px 0 8px;"/>
    <p style="color:${MUTED};font-size:9pt;">Generated by Auditify Copilot</p>
    ${paginate ? footer + '</div>' : ''}
  </body></html>`;
}

// ─── Word (.doc) ───
export function exportReportWord(ctx: ReportExportContext) {
  triggerDownload(
    new Blob(['﻿', documentHtml(ctx, { wordFooter: true })], { type: 'application/msword' }),
    `${ctx.reportName}.doc`,
  );
}

// ─── HTML (.html) — the composed document as a standalone web page ───
export function exportReportHtml(ctx: ReportExportContext) {
  triggerDownload(
    new Blob([documentHtml(ctx)], { type: 'text/html;charset=utf-8' }),
    `${ctx.reportName}.html`,
  );
}

// ─── PPT (.ppt) — title slide + one slide per section (PRD: exec summary + slide per query group) ───
// Slides keep the standard 16:9 deck ratio (960×540).
// position:relative so a slide number can be pinned bottom-right (added at join
// time when page numbers are on — see exportReportPpt).
function slideShell(inner: string, background?: string): string {
  return `<div style="position:relative;page-break-after:always;width:960px;height:540px;box-sizing:border-box;padding:48px 56px;font-family:Calibri,Arial,sans-serif;color:${INK};background:${background ?? '#FFFFFF'};border-bottom:1px solid #eee;">${inner}</div>`;
}

export function exportReportPpt(ctx: ReportExportContext) {
  const p = palette(ctx);
  const slides: string[] = [];
  // Title slide — brand gradient letterhead, matching the on-screen report
  // cover: white title + light byline, no eyebrow lockup.
  slides.push(slideShell(`
    ${ctx.logoDataUrl ? `<div style="display:inline-block;background:#FFFFFF;padding:8px 12px;border-radius:6px;margin:110px 0 0;"><img src="${ctx.logoDataUrl}" alt="" style="height:34px;max-width:220px;" /></div>` : ''}
    <h1 style="font-family:${TITLE_FONT};font-weight:bold;font-size:32pt;margin:${ctx.logoDataUrl ? '18px' : '150px'} 0 14px;color:#FFFFFF;">${esc(ctx.reportName)}</h1>
    <p style="font-size:13pt;color:${p.byline};margin:0;">${[ctx.reportTag, `Generated by ${ctx.generatedBy}`, ctx.generatedAt].filter(Boolean).map(esc).join(' · ')}</p>`, p.from));

  for (const s of ctx.sections) {
    if (s.kind === 'summary') {
      const tiles = (s.stats ?? []).slice(0, 4).map(st =>
        `<td style="padding:12px 20px;border:1px solid ${HAIRLINE};border-left:3px solid ${st.accent ?? BRAND};"><div style="font-size:18pt;font-weight:bold;color:${st.accent ?? BRAND};">${esc(st.value)}</div><div style="font-size:8pt;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">${esc(st.label)}</div></td>`).join('');
      slides.push(slideShell(`
        <h2 style="font-family:${TITLE_FONT};font-weight:bold;font-size:22pt;color:${INK};margin:0 0 16px;">${esc(s.title)}</h2>
        ${tiles ? `<table style="border-collapse:separate;border-spacing:8px 0;margin:0 0 18px -8px;"><tr>${tiles}</tr></table>` : ''}
        <p style="font-size:14pt;line-height:1.6;">${esc(s.content)}</p>`));
    } else if (s.kind === 'query') {
      const bullets = s.findings.slice(0, 4).map(f => `<li style="margin:0 0 8px;">${esc(f)}</li>`).join('');
      const kpis = (s.kpis ?? []).slice(0, 4).map(k =>
        `<td style="padding:10px 18px;border:1px solid ${HAIRLINE};border-left:3px solid ${BRAND};"><div style="font-size:16pt;font-weight:bold;color:${BRAND};">${esc(k.value)}</div><div style="font-size:9pt;color:${MUTED};">${esc(k.label)}</div></td>`).join('');
      slides.push(slideShell(`
        <p style="font-size:10pt;color:${MUTED};margin:0 0 4px;">${esc(s.queryId)} · ${esc(s.risk)} · <span style="color:${sevColor(s.severity)};font-weight:bold;">${esc(s.severity)}</span></p>
        <h2 style="font-family:${TITLE_FONT};font-weight:bold;font-size:18pt;color:${INK};margin:0 0 14px;">${esc(s.queryTitle)}</h2>
        ${kpis ? `<table style="border-collapse:collapse;margin:0 0 16px;"><tr>${kpis}</tr></table>` : ''}
        ${bullets ? `<ul style="font-size:12.5pt;line-height:1.5;margin:0;">${bullets}</ul>` : `<p style="font-size:12.5pt;">${esc(plain(s.summary))}</p>`}`));
      // One slide per attached table so the deck carries the full data.
      for (const t of (s.tables ?? []).filter(t => t.rows.length > 0)) {
        slides.push(slideShell(`
          <p style="font-size:10pt;color:${MUTED};margin:0 0 4px;">${esc(s.queryId)} · ${esc(s.queryTitle)}</p>
          ${tableBlock(t)}`));
      }
    } else if (s.kind === 'workflow') {
      const bullets = s.findings.slice(0, 4).map(f => `<li style="margin:0 0 8px;">${esc(f)}</li>`).join('');
      slides.push(slideShell(`
        <p style="font-size:10pt;color:${MUTED};margin:0 0 4px;">${esc(s.workflowId)} · <span style="color:${sevColor(s.severity)};font-weight:bold;">${esc(s.severity)}</span></p>
        <h2 style="font-family:${TITLE_FONT};font-weight:bold;font-size:18pt;color:${INK};margin:0 0 14px;">${esc(s.workflowName)}</h2>
        ${bullets ? `<ul style="font-size:12.5pt;line-height:1.5;margin:0;">${bullets}</ul>` : `<p style="font-size:12.5pt;">${esc(plain(s.summary))}</p>`}`));
    } else if (s.kind === 'observation') {
      slides.push(slideShell(`
        <p style="font-size:10pt;color:${MUTED};margin:0 0 4px;">${esc(s.obsId)}</p>
        <h2 style="font-family:${TITLE_FONT};font-weight:bold;font-size:18pt;color:${INK};margin:0 0 14px;">${esc(s.title)}</h2>
        <p style="font-size:12.5pt;line-height:1.6;">${esc(s.description)}</p>`));
    }
  }

  // Approvals & sign-off — a closing slide when the report carries signatories.
  if ((ctx.signatories?.length ?? 0) > 0) {
    const accent = isValidHexColor(ctx.brandColor) ? brandAccent(ctx.brandColor) : BRAND_DARK;
    const cards = ctx.signatories!.map(s => {
      const signed = ctx.signoffs?.[s.id];
      const name = signed?.signedBy || s.name || '';
      const foot = signed
        ? `<div style="color:#067647;font-weight:bold;font-size:11pt;">Signed &middot; ${esc(signed.signedAt)}</div>`
        : `<div style="border-top:1px dashed #CCC;padding-top:8px;color:${MUTED};font-style:italic;font-size:10pt;">Signature / Approval</div>`;
      return `<td style="padding:0 12px 0 0;vertical-align:top;"><div style="border:1px solid ${HAIRLINE};border-radius:10px;padding:18px 20px;"><div style="font-size:9pt;font-weight:bold;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:8px;">${esc(s.role)}</div><div style="font-size:13pt;font-weight:bold;color:${INK};margin-bottom:22px;min-height:16px;">${esc(name)}</div>${foot}</div></td>`;
    }).join('');
    slides.push(slideShell(`<h2 style="font-family:${TITLE_FONT};font-weight:bold;font-size:22pt;color:${accent};margin:60px 0 22px;">Approvals &amp; Sign-Off</h2><table style="width:100%;border-collapse:separate;"><tr>${cards}</tr></table>`));
  }

  // Their own closing slide, printed word for word — the last thing in the deck
  // the same way it was the last thing in theirs.
  const closing = (ctx.closingText ?? []).map(l => l.trim()).filter(Boolean);
  if (closing.length) {
    const accent = isValidHexColor(ctx.brandColor) ? brandAccent(ctx.brandColor) : BRAND_DARK;
    const rest = closing.slice(1)
      .map(l => `<p style="font-size:12pt;color:${MUTED};margin:8px 0 0;">${esc(l)}</p>`).join('');
    slides.push(slideShell(`<div style="text-align:center;margin-top:150px;"><p style="font-family:${TITLE_FONT};font-weight:bold;font-size:30pt;color:${accent};margin:0;">${esc(closing[0])}</p>${rest}</div>`));
  }

  // Slide numbers bottom-right when page numbers are on. The title slide (index
  // 0, dark) gets a light number; the rest muted grey. Injected before each
  // slide's closing </div> so no call site needs to know its index.
  const numbered = ctx.pageNumbers === false ? slides : slides.map((s, i) =>
    s.replace(/<\/div>\s*$/, `<div style="position:absolute;right:28px;bottom:20px;font-size:10pt;color:${i === 0 ? 'rgba(255,255,255,0.72)' : '#9AA0A6'};">${i + 1}</div></div>`));
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(ctx.reportName)}</title></head><body style="margin:0;">${recolorBody(numbered.join(''), ctx)}</body></html>`;
  triggerDownload(
    new Blob(['﻿', html], { type: 'application/vnd.ms-powerpoint' }),
    `${ctx.reportName}.ppt`,
  );
}

// ─── Excel (.xlsx) — bulk-audit workbook, same pattern as the ATR exporter ───
// Sheet 1 summarises every workflow run; each workflow with flagged records
// gets its own sheet carrying the full output table.
export function exportBulkAuditExcel(reportName: string, workflows: WorkflowResult[]) {
  const wb = XLSX.utils.book_new();

  const summaryRows = workflows.map(w => ({
    'Workflow ID': w.workflowId,
    'Workflow Name': w.name,
    'Business Process': w.businessProcess ?? '',
    'Severity': w.severity,
    'Records Flagged': w.outputTable?.rows.length ?? 0,
    'Run Status': w.runStatus === 'failed' ? `failed (${w.failureReason ?? 'errored'})` : 'completed',
    'Findings': w.findings.length,
  }));
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  summaryWs['!cols'] = Object.keys(summaryRows[0] ?? { a: 1 }).map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Workflows');

  workflows.forEach(w => {
    if (!w.outputTable || w.outputTable.rows.length === 0) return;
    const ws = XLSX.utils.aoa_to_sheet([w.outputTable.columns, ...w.outputTable.rows]);
    ws['!cols'] = w.outputTable.columns.map(() => ({ wch: 24 }));
    // Sheet names cap at 31 chars and reject \ / ? * [ ] :
    XLSX.utils.book_append_sheet(wb, ws, w.workflowId.replace(/[\\/?*[\]:]/g, '-').slice(0, 31));
  });

  XLSX.writeFile(wb, `${reportName}.xlsx`);
}

// ─── Print view — the composed document in a window, ready for Ctrl+P ───
// Not the PDF export: reportPdf.ts writes a real .pdf file. This stays for the
// browser-print route, which is still the way to print on paper.
export function exportReportPrintView(ctx: ReportExportContext): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false; // popup blocked — caller surfaces the message
  w.document.write(`${documentHtml(ctx)}
    <script>window.onload = function () { window.focus(); window.print(); };</script>`);
  w.document.close();
  return true;
}
