import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, { interopDefault: true, fsCache: false });
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const m = await jiti.import('/Users/nileshanand/Desktop/Product-handover/src/data/platform-usage-metrics.ts');
const d = await jiti.import('/Users/nileshanand/Desktop/Product-handover/src/data/platform-usage.ts');
const scope = { persona: 'cfo', label: 'the whole company' };
let s = m.loadSettings();
console.log('calibration', JSON.stringify(m.calibrate(), null, 1).slice(0, 400));
s = m.applyCalibration(s);
console.log('settings', s.manualReviewRate, s.manualReviewRateSource, s.manualControlTestHours, s.manualControlTestSource);
for (const id of ['this-quarter', 'this-year', 'since-start']) {
  const p = m.period(id);
  const v = m.valueOf(m.runsIn(p, scope), s, p);
  console.log(id, '|', p.label, '| days', p.days, '| runs', m.runsIn(p, scope).filter(r=>r.status==='complete').length,
    '| hours', v.hours.toFixed(0), '| money', m.fmtMoney(v.money), '| people', v.people.toFixed(1), '| rows', v.rows, '| machine h', v.machineHours.toFixed(1));
}
const p = m.period('this-quarter');
console.log('total runs seeded', d.RUNS.length, 'bulk', d.BULK_RUNS.length, 'chat', d.CHAT_QUESTIONS.length, 'concierge', d.CONCIERGE_JOBS.length, 'lookups', d.LOOKUP_CALLS.length);
console.log('coverage', JSON.stringify(m.controlCoverage(p, scope)).slice(0,200));
console.log('never', m.neverExercised(scope).controls.length, m.neverExercised(scope).workflows);
console.log('stuck', m.stuckRuns(p, scope).length, m.stuckRuns(p, scope).slice(0,3).map(x=>[x.workflow,x.status,x.repeats]));
console.log('reliability', m.reliability(p, scope).slice(0,4).map(r=>[r.workflow, r.failurePct.toFixed(1), r.total]));
console.log('exceptions', JSON.stringify(m.exceptionsCaught(p, scope).bySeverity), 'untraced', m.exceptionsCaught(p,scope).untraced);
console.log('volume', JSON.stringify(m.workVolume(p, scope)));
console.log('risks', JSON.stringify(m.riskPicture(p, scope)).slice(0,300));
console.log('portfolio', JSON.stringify(m.portfolio(p, scope).byStatus), 'strip', m.portfolio(p,scope).strip.length, 'slipping', m.portfolio(p,scope).slipping.length, 'changes', m.portfolio(p,scope).changes);
console.log('ccm', JSON.stringify(m.ccm(p, scope)).slice(0,300));
console.log('created', JSON.stringify(m.createdThisPeriod(p, scope).map(c=>[c.label,c.count])));
console.log('product', JSON.stringify(m.productActivity(p, scope)).slice(0,200));
console.log('reports', JSON.stringify(m.reportsActivity(p, scope)).slice(0,260));
console.log('sampling', JSON.stringify(m.sampling(p, scope)).slice(0,200));
console.log('insights', JSON.stringify(m.insightSummary(p, scope)).slice(0,200));
console.log('cost', JSON.stringify(m.costToRun(p)).slice(0,400));
console.log('lookups', JSON.stringify(m.lookupVolume(p).rows.slice(0,4)), m.lookupVolume(p).calls);
console.log('learn', JSON.stringify(m.smartLearn(scope)).slice(0,200));
console.log('overTime', m.valueOverTime(p, scope, s).map(b=>[b.label, b.hours.toFixed(0)]));
