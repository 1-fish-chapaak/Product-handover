// Convert body.html → Notion-flavored Markdown (dist/notion.md).
// Text-only port: screenshots/flowcharts become linked references to the live
// artifact (Notion needs public URLs for images, which the local JPGs aren't).
//   node docs/prd-sox-icfr/notion-convert.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT = 'https://claude.ai/code/artifact/7581a2db-881b-4b9c-88d5-bab402961fcc';
let html = readFileSync(join(HERE, 'body.html'), 'utf8');

// ---------- helpers ----------
const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// inline rich text: html → notion md (bold/italic, pills → bold, strip other tags)
const inline = (s) => decode(
  s.replace(/<br\s*\/?>/gi, ' ')
   .replace(/<span class="pill[^"]*">([\s\S]*?)<\/span>/gi, '**$1**')
   .replace(/<span class="c-label">([\s\S]*?)<\/span>/gi, '**$1**')
   .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**')
   .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*')
   .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
   .replace(/<[^>]+>/g, '')
   .replace(/\s+/g, ' ')
   .trim()
).replace(/</g, '\\<').replace(/>/g, '\\>');

// ---------- strip what Notion doesn't get ----------
html = html.replace(/<!-- ═+ COVER ═+ -->[\s\S]*?(?=<!-- ═+ OVERVIEW)/, '');
html = html.replace(/<template class="fc-source">[\s\S]*?<\/template>/g, '');
html = html.replace(/<div class="pagefoot">[\s\S]*?<\/div>/g, '');
html = html.replace(/<div class="fc-legend">[\s\S]*?<\/div>/g, '');
html = html.replace(/<nav class="toc">[\s\S]*?<\/nav>/g, '@@TOC@@');
html = html.replace(/<div class="chrome">[\s\S]*?<\/div>/g, '');

// ---------- structural conversions (order matters) ----------
// figures (shot + fc-fig): pair with their caption into one quoted reference line
html = html.replace(/<div class="shot">\s*<img [^>]*alt="([^"]*)"[^>]*>\s*<\/div>\s*<p class="caption">([\s\S]*?)<\/p>/g,
  (_, alt, cap) => `\n@@QUOTE@@🖼 **Screenshot — ${inline(cap)}** ([view with visuals](${ARTIFACT}))\n`);
html = html.replace(/<figure class="fc-fig"><img [^>]*alt="([^"]*)"[^>]*\/?><\/figure>\s*<p class="caption">([\s\S]*?)<\/p>/g,
  (_, alt, cap) => `\n@@QUOTE@@🗺 **Flowchart — ${inline(cap)}** ([view with visuals](${ARTIFACT}))\n`);
// any leftover captions/images
html = html.replace(/<p class="caption">([\s\S]*?)<\/p>/g, (_, c) => `\n@@QUOTE@@${inline(c)}\n`);
html = html.replace(/<img [^>]*>/g, '');

// callouts (delta = amber, rest = purple)
const calloutInner = (body) => {
  let out = [];
  const label = body.match(/<span class="c-label">([\s\S]*?)<\/span>/);
  if (label) out.push(`\t**${inline(label[1])}**`);
  body = body.replace(/<span class="c-label">[\s\S]*?<\/span>/, '');
  const items = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)];
  if (items.length) {
    const ordered = /<ol>/.test(body);
    items.forEach((m, i) => out.push(`\t${ordered ? `${i + 1}.` : '-'} ${inline(m[1])}`));
  } else {
    [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].forEach(m => out.push(`\t${inline(m[1])}`));
    if (out.length === (label ? 1 : 0)) { const t = inline(body); if (t) out.push(`\t${t}`); }
  }
  return out.join('\n');
};
html = html.replace(/<div class="callout delta">([\s\S]*?)<\/div>\s*(?=<|@@)/g,
  (_, b) => `\n<callout icon="🟠" color="orange_bg">\n${calloutInner(b)}\n</callout>\n`);
html = html.replace(/<div class="callout">([\s\S]*?)<\/div>\s*(?=<|@@)/g,
  (_, b) => `\n<callout icon="📋" color="purple_bg">\n${calloutInner(b)}\n</callout>\n`);

// persona/stage cards → bullets (per-card; the grid wrappers fall to the generic strip)
html = html.replace(/<div class="card[^"]*">([\s\S]*?)<\/div>/g, (_, b) => `\n- ${inline(b)}\n`);
html = html.replace(/<div class="stage">([\s\S]*?)<\/div>/g, (_, b) => `\n- ${inline(b)}\n`);

// tables → Notion table XML (cells = rich text only; rowspan flattened)
html = html.replace(/<div class="table-scroll"><table>([\s\S]*?)<\/table><\/div>/g, (_, b) => {
  const rows = [...b.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  // detect max columns (rowspan rows have fewer cells)
  let maxCols = 0;
  const parsed = rows.map(r => {
    const cells = [...r[1].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/g)].map(c => ({
      text: inline(c[2]),
      rowspan: /rowspan="(\d+)"/.exec(r[1])?.[1],
    }));
    maxCols = Math.max(maxCols, cells.length);
    return cells;
  });
  const lines = ['<table fit-page-width="true" header-row="true">'];
  parsed.forEach(cells => {
    const texts = cells.map(c => c.text);
    while (texts.length < maxCols) texts.push('');
    lines.push('\t<tr>');
    texts.forEach(t => lines.push(`\t\t<td>${t}</td>`));
    lines.push('\t</tr>');
  });
  lines.push('</table>');
  return '\n' + lines.join('\n') + '\n';
});

// headings, eyebrows, paragraphs
html = html.replace(/<p class="eyebrow">([\s\S]*?)<\/p>/g, '');
html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, t) => `\n# ${inline(t)}\n`);
html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, t) => `\n## ${inline(t)}\n`);
html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '');
html = html.replace(/<p class="footnote">([\s\S]*?)<\/p>/g, (_, t) => `\n---\n${inline(t).replace(/\*/g, '')} {color="gray"}\n`);
html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, t) => { const s = inline(t); return s ? `\n${s}\n` : ''; });

// cover badges → drop (title/intro handled outside); scrub remaining wrappers
html = html.replace(/<div class="badges">[\s\S]*?<\/div>/g, '');
html = html.replace(/<\/?(div|section|nav|span|figure|ol|ul)[^>]*>/g, '\n');
html = html.replace(/<li>([\s\S]*?)<\/li>/g, (_, t) => `- ${inline(t)}\n`);

// quotes + toc markers, then drop every remaining html comment
html = html.replace(/@@QUOTE@@(.*)/g, '> $1');
html = html.replace(/@@TOC@@/g, '<table_of_contents/>');
html = html.replace(/<!--[\s\S]*?-->/g, '');
html = html.replace(/^\s+(<table_of_contents\/>)/m, '$1');

// tidy blank lines
html = html.split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

// ---------- page intro ----------
const intro = `<callout icon="📘" color="blue_bg">
\t**PRD v1.1 · Basis: BRD v1.0 · from-scratch build.** This is the text edition for reading and commenting. The **screenshots and journey flowcharts live in the [live document](${ARTIFACT})** (also exported as the PDF in ~/Downloads). Source of truth: \`docs/prd-sox-icfr/body.html\` in the Product-handover repo. Amber callouts mark everything the prototype adds **beyond the BRD**.
</callout>

`;
const out = intro + html;
mkdirSync(join(HERE, 'dist'), { recursive: true });
writeFileSync(join(HERE, 'dist', 'notion.md'), out);
console.log(`dist/notion.md written — ${(out.length / 1024).toFixed(0)} KB, ${out.split('\n').length} lines`);
console.log('leftover html tags:', (out.match(/<(?!callout|\/callout|table|\/table|tr|\/tr|td|\/td|col|table_of_contents|mention|br)[a-z]/g) || []).length);
