#!/usr/bin/env node
/**
 * sync-design.mjs — keep the editorial-grc *skill* in lockstep with the code.
 *
 * The skill's design language must never drift from what actually ships. The
 * single source of truth is `src/index.css` (the @theme tokens + the global
 * base layer). This script makes a *verbatim* copy of it the canonical
 * reproduction artifact inside the skill, and verifies the skill's
 * human-readable token tables still match the code.
 *
 *   node scripts/sync-design.mjs          # sync: copy src/index.css -> skill, report table drift
 *   node scripts/sync-design.mjs --check  # verify only; exit 1 on any drift (use in CI / pre-push)
 *
 * Skill location resolves from $EDITORIAL_GRC_SKILL_DIR, else
 * ~/.claude/skills/editorial-grc. Both repos must be present for --check.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR =
  process.env.EDITORIAL_GRC_SKILL_DIR ||
  join(homedir(), '.claude', 'skills', 'editorial-grc');

const SRC_CSS = join(ROOT, 'src', 'index.css');
const CANON_CSS = join(SKILL_DIR, 'editorial-grc.css'); // verbatim copy of SRC_CSS
const SKILL_MD = join(SKILL_DIR, 'DESIGN.md');

const check = process.argv.includes('--check');
const errs = [];
const warn = [];

if (!existsSync(SRC_CSS)) fail(`source CSS not found: ${SRC_CSS}`);
if (!existsSync(SKILL_DIR)) {
  // The skill may not be installed on every machine/CI. In --check that's a
  // skip (don't block commits); in sync it's an error (you asked to sync).
  if (check) { console.log(`• editorial-grc skill not installed (${rel(SKILL_DIR)}); skipping design drift check`); process.exit(0); }
  fail(`skill dir not found: ${SKILL_DIR} (set EDITORIAL_GRC_SKILL_DIR)`);
}

const srcCss = readFileSync(SRC_CSS, 'utf8');

// ── 1. Canonical CSS copy — must be byte-identical to src/index.css ──────────
if (check) {
  if (!existsSync(CANON_CSS)) {
    errs.push(`missing ${rel(CANON_CSS)} — run \`node scripts/sync-design.mjs\``);
  } else if (readFileSync(CANON_CSS, 'utf8') !== srcCss) {
    errs.push(`${rel(CANON_CSS)} is out of date vs src/index.css — run \`node scripts/sync-design.mjs\``);
  }
} else {
  writeFileSync(CANON_CSS, srcCss);
  console.log(`✓ synced ${rel(CANON_CSS)} (${srcCss.split('\n').length} lines, verbatim)`);
}

// ── 2. Token tables in DESIGN.md must reflect the @theme values ──────────────
// Parse `--name: value;` pairs from the @theme block of src/index.css and assert
// each concrete color/radius/z value still appears in the skill DESIGN.md tables.
const theme = sliceBlock(srcCss, '@theme');
const tokens = [...theme.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => ({
  name: m[1].trim(),
  value: m[2].trim(),
}));

const md = existsSync(SKILL_MD) ? readFileSync(SKILL_MD, 'utf8') : '';
const mdNoSpace = md.toLowerCase().replace(/\s+/g, ''); // whitespace-insensitive compare

const checkable = tokens.filter(t =>
  /^(color|radius|z|text-meta)/.test(t.name) &&
  !t.value.startsWith('var(') &&            // skip legacy aliases
  !/^--font/.test(t.name));

for (const t of checkable) {
  // The token's value must appear somewhere in the doc tables. Compare with all
  // whitespace removed so `rgba(255, 255, 255, .08)` matches `rgba(255,255,255,.08)`.
  const needle = t.value.toLowerCase().replace(/\s+/g, '');
  if (!mdNoSpace.includes(needle)) {
    errs.push(`DESIGN.md is missing the current value of \`--${t.name}\`: \`${t.value}\``);
  }
}

// Reverse check, scoped to the §12 token tables: every hex written there must be
// a live @theme token. Catches a stale value left behind in the build-kit tables.
const liveHexes = new Set(
  tokens.map(t => (t.value.match(/#[0-9a-f]{6}/i) || [''])[0].toLowerCase()).filter(Boolean),
);
const tokenTables = sliceMarkdown(md, '### 12.3', '### 12.4');
for (const hex of new Set((tokenTables.match(/#[0-9a-f]{6}/gi) || []).map(h => h.toLowerCase()))) {
  if (!liveHexes.has(hex)) {
    errs.push(`§12.3 token table lists \`${hex}\` which is not a current @theme value (stale)`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
for (const w of warn) console.warn(`⚠ ${w}`);
if (errs.length) {
  console.error(`\n✗ design drift detected (${errs.length}):`);
  for (const e of errs) console.error(`  - ${e}`);
  console.error(`\nFix: update src/index.css or the skill DESIGN.md token tables, then run \`node scripts/sync-design.mjs\`.`);
  process.exit(1);
}
console.log(check ? '✓ skill is in sync with src/index.css' : `✓ token tables match (${checkable.length} tokens checked)`);

// ── helpers ──────────────────────────────────────────────────────────────────
function sliceBlock(css, marker) {
  const start = css.indexOf(marker);
  if (start === -1) return '';
  let depth = 0, i = css.indexOf('{', start);
  const open = i;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return css.slice(open + 1);
}
function sliceMarkdown(text, startMarker, endMarker) {
  const s = text.indexOf(startMarker);
  if (s === -1) return '';
  const e = text.indexOf(endMarker, s + startMarker.length);
  return text.slice(s, e === -1 ? undefined : e);
}
function rel(p) { return p.replace(homedir(), '~'); }
function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
