/**
 * The seed has to obey the rules the app enforces.
 *
 * Seeded controls are built as plain objects. They never pass through the store
 * actions, so none of the guards in `concludeOperating` and none of the locks
 * the control page puts on its conclude buttons ever run against them. That is
 * how PX-04 ended up Closed and countersigned while every one of its five
 * attributes still read "Required files 0 of 3 uploaded" — a control the product
 * itself would have refused to conclude, sitting in the demo as a finished one.
 *
 * This is not a UI test and needs no browser: it imports the same seed the app
 * boots from and the same helpers the guards call, then asks of every concluded
 * control the one question the store asks before it lets you conclude. A failure
 * here means the demo is telling a story the product does not allow.
 *
 * Adding a rule: mirror a real guard, cite where it lives, and let the message
 * name the controls. A rule invented here rather than copied would be this file
 * having its own opinion about SOX, which is exactly what it exists to prevent.
 */
import { expect, test } from '@playwright/test';
import { libraryEngagements, type Engagement } from '../src/data/engagements';
import { seedIcfrEngagement, type SeedMeta } from '../src/components/sox-icfr/mockData';
import {
  designCompleteness, inquiryOnlyAttributes, passedWithoutFiles, stepResult, toeRoundFailed,
} from '../src/components/sox-icfr/helpers';
import type { Control, IcfrEngagement } from '../src/components/sox-icfr/types';

/** `seedMetaFor` lives behind racmLibrary's module-private engagement filter, so
 *  it is spelled out here rather than imported — same fields, same order. */
const metaFor = (e: Engagement): SeedMeta => ({
  id: e.id, code: e.code, name: e.name, entity: e.entity, process: e.process,
  processes: e.soxProcesses, seedMode: e.soxSeedMode,
  periodStart: e.periodStart, periodEnd: e.periodEnd, owner: e.owner,
  materiality: e.soxConfig?.overallMateriality, performanceMateriality: e.soxConfig?.performanceMateriality,
  clearlyTrivial: e.soxConfig?.clearlyTrivial, sdBandPct: e.soxConfig?.sdBandPct,
  controls: e.soxControls, sampling: e.soxSampling,
});

/** Every SOX engagement the app can open, seeded the way the app seeds it. */
function seeded(): { eng: Engagement; ws: IcfrEngagement }[] {
  return libraryEngagements()
    .filter(e => e.type === 'SOX / ICFR')
    .map(e => ({ eng: e, ws: seedIcfrEngagement(metaFor(e)) }));
}

/** `ENG-001/C001 — Payment runs approved by two authorisers.` */
const name = (eng: Engagement, c: Control) => `${eng.code}/${c.id} — ${c.title ?? c.wpRef}`;

/** The offenders, one per line, so a failure is a work list rather than a count. */
const report = (rows: string[]) => `\n  ${rows.join('\n  ')}\n`;

/** One rule, run across every seeded control that has concluded the track. */
function forEachConcluded(
  track: 'design' | 'operating',
  conclusion: 'Effective' | 'Ineffective',
  rule: (c: Control) => string | null,
): string[] {
  const bad: string[] = [];
  for (const { eng, ws } of seeded()) {
    for (const c of ws.controls) {
      if (c[track].conclusion !== conclusion) continue;
      const why = rule(c);
      if (why) bad.push(`${name(eng, c)} — ${why}`);
    }
  }
  return bad;
}

test.describe('seeded controls obey the rules the app enforces', () => {
  // ── the TOE guards, in the order store.tsx#concludeOperating applies them ───

  test('a TOE-effective control has no attribute left untested', () => {
    // store.tsx: `if (conclusion === 'Effective' && c.operating.steps.some(s => stepResult(s) === 'Not tested')) return c;`
    const bad = forEachConcluded('operating', 'Effective', c => {
      const open = c.operating.steps.filter(s => stepResult(s) === 'Not tested');
      return open.length ? `${open.length} attribute(s) with no result: ${open.map(s => s.code).join(', ')}` : null;
    });
    expect(bad, `TOE is Effective on controls the store would refuse:${report(bad)}`).toEqual([]);
  });

  test('a TOE-effective control has the files behind every passing attribute', () => {
    // store.tsx: `if (conclusion === 'Effective' && passedWithoutFiles(c).length) return c;`
    const bad = forEachConcluded('operating', 'Effective', c => {
      const unbacked = passedWithoutFiles(c);
      return unbacked.length ? `${unbacked.length} attribute(s) pass without their required files: ${unbacked.map(s => s.code).join(', ')}` : null;
    });
    expect(bad, `A Pass the files do not back:${report(bad)}`).toEqual([]);
  });

  test('a TOE-effective control rests on more than somebody saying so', () => {
    // store.tsx: `if (conclusion === 'Effective' && inquiryOnlyAttributes(c).length) return c;`
    const bad = forEachConcluded('operating', 'Effective', c => {
      const hearsay = inquiryOnlyAttributes(c);
      return hearsay.length ? `${hearsay.length} inquiry-only attribute(s): ${hearsay.map(s => s.code).join(', ')}` : null;
    });
    expect(bad, `Effective on inquiry alone:${report(bad)}`).toEqual([]);
  });

  test('a TOE-effective control carries no failed round and no stale run', () => {
    // store.tsx: `if (conclusion !== 'Not tested' && c.operating.steps.some(s => s.staleRun)) return c;`
    //            `if (conclusion === 'Effective' && toeRoundFailed(c)) return c;`
    const bad = forEachConcluded('operating', 'Effective', c => {
      const stale = c.operating.steps.filter(s => s.staleRun);
      if (stale.length) return `${stale.length} attribute(s) testing a draw that no longer exists: ${stale.map(s => s.code).join(', ')}`;
      return toeRoundFailed(c) ? 'a failed round is open — Effective would contradict its own deficiency' : null;
    });
    expect(bad, `Effective over an open failure:${report(bad)}`).toEqual([]);
  });

  // ── the TOD gate, which lives on the page rather than in the store ──────────

  test('a TOD-effective control has every required element evidenced', () => {
    // ControlDossier: the conclude footer locks on `Locked — N required element
    // still needs evidence`, counted by designCompleteness (gate: true).
    const bad = forEachConcluded('design', 'Effective', c => {
      const { done, total } = designCompleteness(c);
      return done < total ? `${total - done} of ${total} required element(s) still without evidence or a waiver` : null;
    });
    expect(bad, `TOD is Effective with elements outstanding:${report(bad)}`).toEqual([]);
  });

  // ── the draw, which every later step reads off ──────────────────────────────

  test('a control that tested a sample actually drew one', () => {
    // The TOE header counts `sampling.samples`; the Sample step counts what each
    // source drew. When the second is empty the page says "Nothing drawn yet"
    // under a step badged with the item count — the same fact, twice, disagreeing.
    const bad = forEachConcluded('operating', 'Effective', c => {
      const samples = c.operating.sampling?.samples ?? [];
      if (!samples.length) return null;
      const sources = c.operating.sources ?? [];
      if (!sources.length) return null;
      const drawn = sources.reduce((n, s) => n + (s.drawn?.length ?? 0), 0);
      return drawn === 0 ? `${samples.length} sampled items tested, but no source records a draw` : null;
    });
    expect(bad, `Tested a sample nobody drew:${report(bad)}`).toEqual([]);
  });
});
