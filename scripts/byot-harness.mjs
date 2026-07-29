// The BYOT harness. Six real reports through the reader in one run, so "it
// works" is something we can repeat rather than something we remember.
//
//   npm run dev                    # the engine needs a browser
//   node scripts/byot-harness.mjs  # add file paths to run just those
//
// It prints what each fixture kept, what it left out and why, and one number
// per run: THE CATCH-ALL COUNT. That is the bug meter. A catch-all reason is
// almost never a drop that wants a better name; it is a drop that should not be
// a drop, so the count should collapse as rules land, and whatever survives
// genuinely needs a genre name or a keep rule.
//
// Two invariants it checks on every run, because both have been broken before:
//   · a section is never dropped while its own blocks say keep (the verdict
//     flows up from the blocks, never down over their heads) — the audit plan
//     and last audit's actions are the two deliberate exceptions
//   · our own generated report round-trips with nothing dropped at all

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { chromium } from 'playwright';

const PORT = process.env.PORT || '5173';
const FIXTURES = 'fixtures/byot';
/** The wording the engine falls back to when it cannot place a part at all. */
const CATCH_ALL = 'nothing here comes from audit results';
/** The two reasons that outrank a kept block, by design. */
const VETOES = /audit plan|last audit’s actions|last audit's actions/i;

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : existsSync(FIXTURES)
    ? readdirSync(FIXTURES).filter(f => /\.(pdf|pptx)$/i.test(f)).sort().map(f => join(FIXTURES, f))
    : [];

if (files.length === 0) {
  console.error(`No fixtures. Put the six reports in ${FIXTURES}/ (see its README) or pass paths.`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
} catch {
  console.error(`Nothing is serving on ${PORT}. Run "npm run dev" first.`);
  await browser.close();
  process.exit(1);
}

let catchAlls = 0;
let overRuled = 0;
let failures = 0;

for (const path of files) {
  const name = basename(path);
  const b64 = readFileSync(path).toString('base64');
  const read = await page.evaluate(async ({ b64, name }) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = name.toLowerCase().endsWith('.pptx')
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf';
    // Import through byotRead, never byotEngine: a second import path gives a
    // second module instance and an empty lastRead.
    const engine = await import('/src/components/reports/byot/byotRead.ts');
    const outcome = await engine.readTemplateFromReport(new File([bytes], name, { type }));
    if (!outcome.ok) return { failed: outcome.reason ?? 'declined' };
    const result = outcome.result;
    return {
      sections: result.sections.map(s => ({
        name: s.name, fill: s.fill, binding: s.binding, flag: s.flag, blocks: s.blocks.length,
      })),
      dropped: result.dropped.map(d => {
        // What did this section's own blocks say? A drop over the heads of
        // blocks that said keep is the failure this harness exists to catch.
        const seen = engine.lastRead.find(r => r.section === d.name)
          ?? engine.lastRead.find(r => r.section.startsWith(d.name.slice(0, 24)));
        const verdicts = seen?.verdicts ?? [];
        return {
          name: d.name,
          why: d.why,
          captured: !!d.captured,
          blocks: verdicts.length,
          keptBlocks: verdicts.filter(v => !v.startsWith('out')).length,
        };
      }),
      scale: result.findingScale,
      pageCount: result.pageCount,
    };
  }, { b64, name });

  console.log(`\n── ${name}`);
  if (read.failed) {
    console.log(`   declined: ${read.failed}`);
    failures++;
    continue;
  }
  console.log(`   ${read.sections.length} kept · ${read.dropped.length} left out · ${read.pageCount} pages · scale ${(read.scale ?? []).join('/') || 'none'}`);
  for (const s of read.sections) {
    console.log(`   KEEP  ${s.name.slice(0, 58).padEnd(58)} ${s.fill}${s.binding ? '/' + s.binding : ''}${s.flag ? ' · ' + s.flag : ''}`);
  }
  for (const d of read.dropped) {
    const generic = !d.captured && d.why.includes(CATCH_ALL);
    if (generic) catchAlls++;
    // The verdict flows one way. A drop while its own blocks said keep is a bug
    // unless it is one of the two reasons that outrank blocks by design.
    const overRule = !d.captured && d.keptBlocks > 0 && !VETOES.test(d.why);
    if (overRule) overRuled++;
    const mark = d.captured ? 'SETTING' : generic ? 'CATCHALL' : 'DROP';
    console.log(`   ${mark.padEnd(8)} ${d.name.slice(0, 46).padEnd(46)} ${d.keptBlocks}/${d.blocks} blocks kept${overRule ? '  ← OVER-RULED' : ''}`);
    console.log(`            ${d.why}`);
  }
  if (/our_own/i.test(name) && read.dropped.some(d => !d.captured)) {
    console.log('   ROUND TRIP FAILED: we wrote every word of this report, so any drop is a detector bug.');
    failures++;
  }
}

console.log(`\n${'─'.repeat(64)}`);
console.log(`catch-all drop reasons: ${catchAlls}   ← the bug meter`);
console.log(`drops over-ruling their own blocks: ${overRuled}`);
if (failures) console.log(`fixtures that failed outright: ${failures}`);
await browser.close();
process.exit(overRuled > 0 || failures > 0 ? 1 : 0);
