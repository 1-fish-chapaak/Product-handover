import { test, expect } from '@playwright/test';
import {
  gradeException, sizingReady, aggregable, icfrConclusion, mwBasis, mwReason,
  likelihoodForGap, designCloseBlock,
} from '../src/components/sox-icfr/helpers';
import {
  ENTITY_MW_INDICATORS, EXCEPTION_MW_INDICATORS, MW_INDICATOR_BY_ID,
  MW_INDICATOR_CATALOGUE, mwIndicatorIds, mwSourceLabel, sortGapKinds,
} from '../src/components/sox-icfr/types';
import type { Deficiency, IcfrEngagement } from '../src/components/sox-icfr/types';

/**
 * AN EXPOSURE NOBODY ENTERED IS NOT A SMALL EXPOSURE.
 *
 * `Deficiency.magnitude` was a plain `number` starting at 0. `isClearlyTrivial`
 * is `magnitude <= clearlyTrivial`, so every exception graded **Clearly Trivial**
 * the instant it was raised — a design failure that ran the whole period, filed
 * as not worth evaluating, on a number no person ever typed. It reached the user
 * as a finished conclusion, which is the worst way for a blank to arrive.
 *
 * Three states now, and they are three different sentences:
 *   null          — not sized. No grade is produced at all.
 *   0 + a reason  — the auditor concluded there is no exposure. Grades.
 *   a figure      — grades.
 *
 * The carve-out below is the one thing that must NOT change: an MW indicator is
 * a material weakness "whatever the amount", so it still settles an unsized
 * exception. Refusing to grade there would lose a finding the standard says has
 * already been made.
 *
 * No browser and no dev server — the grading engine is pure.
 */

const RULES = { clearlyTrivial: 250_000, sdBandPct: 20, aggregate: false, mwIndicators: [] };

/** The smallest engagement `gradeException` can be asked a question about. */
function eng(defs: Deficiency[] = []): IcfrEngagement {
  return {
    materiality: 12_000_000,
    rules: RULES,
    controls: [],
    deficiencies: defs,
  } as unknown as IcfrEngagement;
}

/** A design exception, sized however the test needs. */
function def(over: Partial<Deficiency> = {}): Deficiency {
  return {
    id: 'DEF-T1', controlId: 'C-1', track: 'design',
    description: 'built wrong', rootCause: 'the threshold is too loose',
    likelihood: 'Probable', magnitude: null, mwIndicators: [],
    status: 'Identified',
    remediation: { action: '', date: null, owner: 'owner', status: 'Open' },
    ...over,
  } as unknown as Deficiency;
}

test.describe('an unsized exposure produces no grade', () => {
  test('null magnitude returns no grade at all', () => {
    // The defect, stated directly. This used to return 'Clearly Trivial'.
    const g = gradeException(def({ magnitude: null }), eng());
    expect(g.grade).toBeNull();
    expect(g.ladderGrade).toBeNull();
  });

  test('the working says WHY it stopped, rather than going quiet', () => {
    const g = gradeException(def({ magnitude: null }), eng());
    const step = g.working.find(w => w.rule === 'Exposure');
    expect(step?.fired).toBe(true);
    expect(step?.detail).toContain('Not sized yet');
  });

  test('a real zero still grades — it is an answer', () => {
    const g = gradeException(def({ magnitude: 0, magnitudeZeroReason: 'the account was never posted to' }), eng());
    expect(g.grade).toBe('Clearly Trivial');
  });

  test('a figure grades off the ladder as before', () => {
    expect(gradeException(def({ magnitude: 13_000_000 }), eng()).grade).toBe('Material Weakness');
    expect(gradeException(def({ magnitude: 3_000_000 }), eng()).grade).toBe('Significant Deficiency');
    expect(gradeException(def({ magnitude: 1_000_000 }), eng()).grade).toBe('Deficiency');
    expect(gradeException(def({ magnitude: 200_000 }), eng()).grade).toBe('Clearly Trivial');
  });
});

test.describe('an MW indicator still settles an unsized exception', () => {
  // The carve-out, and the reason the not-sized gate sits AFTER rule 1 rather
  // than before it. An indicator is a material weakness whatever the amount, so
  // refusing to grade here would lose a finding already made.

  test('indicator + no figure is still a Material Weakness', () => {
    const g = gradeException(def({ magnitude: null, mwIndicators: ['senior-management-fraud'] }), eng());
    expect(g.grade).toBe('Material Weakness');
  });

  test('and rule 1 is what fired, not the exposure rule', () => {
    const g = gradeException(def({ magnitude: null, mwIndicators: ['restatement'] }), eng());
    expect(g.working.find(w => w.n === 1)?.fired).toBe(true);
    expect(g.working.some(w => w.rule === 'Exposure')).toBe(false);
  });
});

test.describe('sizingReady — what step 2 will and will not send on', () => {
  test('unsized is not ready', () => {
    expect(sizingReady({ magnitude: null })).toBe(false);
  });

  test('zero without a reason is not ready', () => {
    // Zero is the value a blank used to pass itself off as, so if it is going to
    // clear an exception somebody says why.
    expect(sizingReady({ magnitude: 0 })).toBe(false);
    expect(sizingReady({ magnitude: 0, magnitudeZeroReason: '   ' })).toBe(false);
  });

  test('zero WITH a reason is ready', () => {
    expect(sizingReady({ magnitude: 0, magnitudeZeroReason: 'no balance maps to this process' })).toBe(true);
  });

  test('any figure is ready, and needs no reason', () => {
    expect(sizingReady({ magnitude: 1 })).toBe(true);
    expect(sizingReady({ magnitude: 40_000_000 })).toBe(true);
  });
});

test.describe('an unsized member stays in its group', () => {
  // It is not trivial — nobody has said what it is — and dropping it would hide
  // it from the group that should be asking about it. It contributes no figure,
  // which makes the total provisional rather than smaller.

  test('unsized is aggregable', () => {
    expect(aggregable(def({ magnitude: null }), eng())).toBe(true);
  });

  test('clearly trivial is not', () => {
    expect(aggregable(def({ magnitude: 100_000 }), eng())).toBe(false);
  });

  test('a closed exception is not, whatever its figure', () => {
    expect(aggregable(def({ magnitude: null, status: 'Closed' }), eng())).toBe(false);
  });
});

/* ── MW indicators: two scopes, six rows, and the welded one split ──────────── */

test.describe('the indicator catalogue', () => {
  // Three of the old five were facts about the COMPANY, asked on every
  // exception's panel. They are entity-scoped now; the panel asks the two a
  // reader of one control can actually answer.

  test('only two are asked on an exception', () => {
    expect(EXCEPTION_MW_INDICATORS.map(i => i.id)).toEqual(['auditor-found-misstatement', 'senior-management-fraud']);
  });

  test('the other four are the engagement’s to conclude', () => {
    expect(ENTITY_MW_INDICATORS.map(i => i.id))
      .toEqual(['restatement', 'audit-committee-oversight', 'control-environment', 'period-end-reporting']);
  });

  test('the welded row is now two, and they are attributed differently', () => {
    // "Ineffective control environment / oversight" covered AS 2201 .69's
    // audit-committee bullet AND a house rule. One tick could not say which.
    expect(MW_INDICATOR_BY_ID['audit-committee-oversight'].source).toEqual({ kind: 'standard', standard: 'PCAOB AS 2201', paragraph: '.69' });
    expect(MW_INDICATOR_BY_ID['control-environment'].source).toEqual({ kind: 'house' });
  });

  test('every row says where it comes from', () => {
    for (const i of MW_INDICATOR_CATALOGUE) {
      expect(mwSourceLabel(i.source)).toMatch(/^(PCAOB AS 2201 \.\d+|House rule)$/);
    }
    // Four of the six are the standard's; two are this firm's own.
    expect(MW_INDICATOR_CATALOGUE.filter(i => i.source.kind === 'house')).toHaveLength(2);
  });
});

test.describe('stored labels still read', () => {
  // The stored value USED to be the sentence itself, and the exports write these
  // into deliverables — a kept .xlsx is where an old string comes back.

  test('every old label maps to an id', () => {
    expect(mwIndicatorIds([
      'Restatement of previously issued financial statements',
      'Material misstatement identified by audit, not the control',
      'Fraud of any magnitude by senior management',
      'Ineffective period-end financial reporting process',
    ])).toEqual(['restatement', 'auditor-found-misstatement', 'senior-management-fraud', 'period-end-reporting']);
  });

  test('the welded label reads as the control environment, not the audit committee', () => {
    // A judgement, not a lookup: the old tick covered both halves, so either
    // mapping asserts something nobody separately concluded. This is the
    // conservative half — it puts no AS 2201 finding against a named committee
    // into an auditor's mouth.
    expect(mwIndicatorIds(['Ineffective control environment / oversight'])).toEqual(['control-environment']);
  });

  test('new ids pass through unchanged, and nonsense is dropped', () => {
    expect(mwIndicatorIds(['senior-management-fraud'])).toEqual(['senior-management-fraud']);
    expect(mwIndicatorIds(['something nobody ever wrote'])).toEqual([]);
  });
});

test.describe('a company-level indicator makes ICFR not effective on its own', () => {
  // The road that did not exist. Counting only material weaknesses ON CONTROLS
  // meant a company with a restatement and nothing but small findings signed
  // off clean — the exact false comfort this change removes.

  const engWith = (over: Partial<IcfrEngagement>): IcfrEngagement =>
    ({ ...eng(), audits: [], ...over } as IcfrEngagement);

  test('no findings and no indicators is Effective', () => {
    expect(icfrConclusion(engWith({ deficiencies: [] }))).toBe('Effective');
  });

  test('a present indicator alone flips it, with no material weakness anywhere', () => {
    const e = engWith({
      deficiencies: [def({ magnitude: 100_000 })],   // clearly trivial
      entityMwConclusions: [{ id: 'restatement', present: true, basis: 'FY25 restated', by: 'A', at: 'x' }],
    });
    expect(icfrConclusion(e)).toBe('Not effective');
    expect(mwBasis(e).openMw).toHaveLength(0);
    expect(mwBasis(e).entity.map(c => c.id)).toEqual(['restatement']);
  });

  test('an indicator concluded NOT present does not flip it', () => {
    expect(icfrConclusion(engWith({
      deficiencies: [],
      entityMwConclusions: [{ id: 'restatement', present: false, basis: '', by: 'A', at: 'x' }],
    }))).toBe('Effective');
  });

  test('the reason names both roads, so a verdict never arrives bare', () => {
    expect(mwReason(2, [{ id: 'restatement', present: true, basis: '', by: 'A', at: 'x' }]))
      .toBe('2 material weaknesses open · 1 company-level indicator present');
    expect(mwReason(0, [])).toBe('');
  });
});

test.describe('a design gap can be more than one thing', () => {
  test('the likeliest of the selected kinds carries the suggestion', () => {
    // Two flaws do not make a failure rarer, and taking the gentlest would let
    // ADDING a finding argue the suggestion down.
    expect(likelihoodForGap(['precision']).likelihood).toBe('Reasonably possible');
    expect(likelihoodForGap(['sod']).likelihood).toBe('Probable');
    expect(likelihoodForGap(['precision', 'sod']).likelihood).toBe('Probable');
  });

  test('every kind argues its own reason, not one blanket sentence', () => {
    // 'Probable — built wrong, so it fails every time' was stamped on all six.
    // It is true of two: a control nobody segregated, and a control that is not
    // there. The other four fail on a subset of what passes through them.
    expect(likelihoodForGap(['frequency']).likelihood).toBe('Reasonably possible');
    expect(likelihoodForGap(['frequency']).reason).toContain('between two runs');
    expect(likelihoodForGap(['no-control']).likelihood).toBe('Probable');
  });

  test('no kind named makes no every-run claim', () => {
    expect(likelihoodForGap(undefined).likelihood).toBe('Reasonably possible');
    expect(likelihoodForGap([]).reason).toContain('no gap named');
  });

  test('selections are stored in register order, not click order', () => {
    // Two auditors doing identical work must produce identical paper.
    expect(sortGapKinds(['placement', 'sod'])).toEqual(['sod', 'placement']);
    expect(sortGapKinds(['sod', 'placement'])).toEqual(['sod', 'placement']);
  });

  test('"no control at all" is exclusive', () => {
    // "There is nothing here" and "its threshold is too loose" cannot both be
    // true of one control — the paper, the scan and the owner's prompt would
    // all read as nonsense.
    expect(sortGapKinds(['precision', 'no-control'])).toEqual(['no-control']);
  });
});

test.describe('a design exception does not close on a re-read alone', () => {
  test('a workaround closes, but is named for what it is', () => {
    const d = def({ planReview: { decision: 'Accepted', fix: 'workaround', by: 'A', at: 'x' } } as Partial<Deficiency>);
    const b = designCloseBlock(d, undefined, eng());
    expect(b?.blocks).toBe(false);
    expect(b?.reason).toContain('not rebuilt');
  });

  test('an operating exception is not this rule’s business', () => {
    expect(designCloseBlock(def({ track: 'operating' }), undefined, eng())).toBeNull();
  });
});
