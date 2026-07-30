// Build the SOX/ICFR PRD from its editable source.
//
//   Edit   docs/prd-sox-icfr/body.html   (the content — plain HTML, plain English)
//   Run    node docs/prd-sox-icfr/build.mjs          → dist/prd-sox-icfr.html
//          node docs/prd-sox-icfr/build.mjs --pdf    → also ~/Downloads/PRD-SOX-ICFR-Engagement-Management-v1.1.pdf
//   Then   ask Claude to republish dist/prd-sox-icfr.html to the artifact URL
//          (https://claude.ai/code/artifact/7581a2db-881b-4b9c-88d5-bab402961fcc)
//
// What it does: re-captures the journey flowcharts from the <template class="fc-source">
// blocks in body.html, then inlines every image in shots/ as base64 so the output is a
// single self-contained file. Screenshots: replace the .jpg in shots/ (same name) and rebuild.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
const DIST = join(HERE, 'dist');
mkdirSync(DIST, { recursive: true });

const style = readFileSync(join(HERE, 'style.html'), 'utf8');
const body = readFileSync(join(HERE, 'body.html'), 'utf8');

// 1) re-capture the flowcharts (they live as hidden templates inside body.html)
const fcSources = [...body.matchAll(/<template class="fc-source">([\s\S]*?)<\/template>/g)].map(m => m[1]);
const capture = `<!doctype html><html><head><meta charset="utf-8">${style}
<style>body{background:#FAFAFB;padding:16px} .fc-scroll{overflow:visible!important} .fc{width:max-content}</style>
</head><body>${fcSources.join('\n')}</body></html>`;
const capPath = join(DIST, 'fc-capture.html');
writeFileSync(capPath, capture);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 2 });
await page.goto('file://' + capPath);
await page.waitForTimeout(400);
for (const id of ['fc-aud-nav', 'fc-aud-test', 'fc-owner', 'fc-rev']) {
  const el = page.locator(`#${id}`);
  if (await el.count()) {
    await el.screenshot({ path: join(SHOTS, `${id}.jpg`), type: 'jpeg', quality: 88 });
    console.log('flowchart captured: ' + id);
  } else console.log('MISSING flowchart id: ' + id);
}

// 2) assemble: title + style + body, every @@IMG:name@@ inlined from shots/<name>.jpg
const toDataUri = (name) => {
  const p = join(SHOTS, `${name}.jpg`);
  if (!existsSync(p)) { console.log('MISSING IMAGE: ' + name); return ''; }
  return 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');
};
let html = `<title>PRD — SOX / ICFR Engagement Management (v1.1)</title>\n${style}\n${body}`;
html = html.replace(/@@IMG:([\w-]+)@@/g, (_, name) => toDataUri(name));
const out = join(DIST, 'prd-sox-icfr.html');
writeFileSync(out, html);
console.log(`built ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
const unresolved = html.match(/@@IMG/g)?.length ?? 0;
if (unresolved) console.log(`WARNING: ${unresolved} unresolved image placeholders`);

// 3) optional PDF
if (process.argv.includes('--pdf')) {
  const p2 = await browser.newPage();
  await p2.goto('file://' + out, { waitUntil: 'load' });
  await p2.emulateMedia({ media: 'print' });
  await p2.waitForTimeout(800);
  const pdfPath = join(homedir(), 'Downloads', 'PRD-SOX-ICFR-Engagement-Management-v1.1.pdf');
  await p2.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  console.log('PDF written: ' + pdfPath);
}
await browser.close();
