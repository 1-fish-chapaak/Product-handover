import { useEffect, useRef, useState } from 'react';
import { useIcfr } from './store';
import { controlConclusion } from './helpers';
import type { Attribute, Control, TestResult } from './types';

const RM = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, RM ? 0 : ms));

const COVER: Record<string, string> = { 'FR-REV': 'bk-rev', 'P2P-C-03': 'bk-rev', 'P2P-C-05': 'bk-rev', 'IT-AP': 'bk-ap', 'P2P-C-01': 'bk-ap', 'P2P-C-02': 'bk-ap', 'P2P-C-04': 'bk-c4', 'P2P-C-07': 'bk-c3', 'R2R-C-01': 'bk-c5' };
export function coverClass(id: string) { return COVER[id] ?? (id.startsWith('R2R') ? 'bk-c5' : id.includes('C-0') ? 'bk-c3' : 'bk-c4'); }

function todLines(a: Attribute, pass: boolean): string[] {
  return [
    `Walkthrough — tracing one example for ${a.code}…`,
    `Precision: ${a.precision}`,
    pass ? `<span class="ok">Designed to address ${a.assertion} ✓</span>` : `<span class="no">Design gap — ${a.tod.note || 'control not designed to address the risk'}</span>`,
  ];
}
function toeLines(c: Control, a: Attribute, pass: boolean, size: number, fails: number): string[] {
  if (c.nature === 'Automated') {
    return [
      `Reading linked workflow ${c.workflowName ?? 'CCM'} (full population)…`,
      a.toe.workflowRunRef ? `Run ${a.toe.workflowRunRef} · ${(size || 41208).toLocaleString('en-IN')} items` : `Processed full population`,
      pass ? `<span class="ok">0 exceptions → operating effective</span>` : `<span class="no">${fails} exception(s) found</span>`,
    ];
  }
  return [
    `Population → ${size} ${(c.sampling?.method ?? 'Random').toLowerCase()} samples`,
    `Reperforming · ${a.toe.procedures.join(' · ') || 'Inspection · Reperformance'}…`,
    pass ? `<span class="ok">${size}/${size} tie · 0 exceptions</span>` : `<span class="no">${fails} exception(s) over the criterion</span>`,
  ];
}

export default function ControlBook({ controlId, onClose }: { controlId: string; onClose: () => void }) {
  const { eng, recordTod, recordToe, setStage } = useIcfr();
  const control = eng.controls.find(c => c.id === controlId);
  const [opened, setOpened] = useState(false);
  const [stamp, setStamp] = useState<null | 'eff' | 'ineff'>(null);
  const closing = useRef(false);

  useEffect(() => { const t = setTimeout(() => setOpened(true), 160); return () => clearTimeout(t); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  if (!control) return null;
  const c = control;
  const concl = controlConclusion(c);
  const passed = c.attributes.filter(a => a.tod.result === 'Pass' && a.toe.result === 'Pass').length;
  const allDone = c.attributes.every(a => a.tod.result === 'Fail' || a.toe.result !== 'Not tested');

  const conclude = async () => {
    if (closing.current) return; closing.current = true;
    const eff = concl === 'Effective';
    setStage(c.id, eff ? 'in-review' : 'concluded');
    setOpened(false);
    await sleep(900);
    setStamp(eff ? 'eff' : 'ineff');
    await sleep(1600);
    onClose();
  };

  const verdict = concl === 'Effective' ? 'eff' : concl === 'Ineffective' ? 'ineff' : '';

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={`Control ${c.id}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`book${opened ? ' opened' : ''}`}>
        <div className="book-inner">
          <div className="spread">
            {/* LEFT — profile */}
            <div className="page left">
              <button className="closebtn" aria-label="Close" onClick={onClose}>✕</button>
              <div className="ph-kick">Control profile</div>
              <h3>{c.id}</h3>
              <div className="profile">
                {[['Nature', c.nature], ['Type', c.type], ['Frequency', c.frequency], ['Key control', c.isKey ? 'Yes' : 'No'], ['Owner', c.owner]].map(([k, v]) => (
                  <div className="prow" key={k}><span className="pk">{k}</span><span className="pv">{v}</span></div>
                ))}
                <div className="prow"><span className="pk">TOE path</span><span className="pv mono">{c.nature === 'Automated' ? 'Automated · workflow' : 'Manual · sample'}</span></div>
              </div>
              <div className="objective">
                <div className="ol">Precision · “would” objective</div>
                <div className="ot">Would this control, as designed and operating, detect a misstatement ≥ materiality in {c.assertions.join(' / ')}? — {c.precision}</div>
              </div>
              {c.nature === 'Automated' && c.workflowName && (
                <div className="linked">⛓ Automated TOE sourced from <span className="lk-id">{c.workflowId} · {c.workflowName}</span></div>
              )}
              <div className="rollup">
                <div className="ru-head"><span className="t">Roll-up</span><span className="n">{c.attributes.filter(a => a.tod.result === 'Fail' || a.toe.result !== 'Not tested').length} / {c.attributes.length} attributes</span></div>
                <div className={`ru-meter${verdict === 'ineff' ? ' fail' : ''}`}><i style={{ width: `${(passed / Math.max(1, c.attributes.length)) * 100 || (allDone ? 100 : 0)}%` }} /></div>
                <div className={`ru-verdict ${verdict}`}>
                  {concl === 'Effective' ? 'Effective' : concl === 'Ineffective' ? 'Ineffective' : 'In progress'}
                  <span className="as">{concl === 'Effective' ? 'all attributes pass TOD + TOE' : concl === 'Ineffective' ? 'an attribute failed → deficiency' : 'every attribute must pass TOD + TOE'}</span>
                </div>
              </div>
            </div>

            {/* RIGHT — attributes */}
            <div className="page right">
              <div className="ph-kick">Attributes — test each to seal</div>
              <h3>Reperformable procedures</h3>
              <div className="attrs">
                {c.attributes.map(a => <AttrCard key={a.id} control={c} attr={a} onTod={(r, n) => recordTod(c.id, a.id, r, n)} onToe={(r, n) => recordToe(c.id, a.id, r, n)} />)}
              </div>
              <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="sbtn sbtn-primary lg" disabled={!allDone || closing.current} onClick={conclude}>
                  {!allDone ? 'Test all attributes to conclude' : concl === 'Effective' ? 'Conclude · close as Effective' : 'Conclude · close with deficiency'}
                </button>
              </div>
            </div>
          </div>

          {/* COVER */}
          <div className={`cover ${coverClass(c.id)}`}>
            <div>
              <div className="c-id">{c.id}</div>
              <div className="c-title">{c.description}</div>
            </div>
            <div className="c-emboss">Test of<br />Design &amp;<br />Operating<br />Effectiveness</div>
            <div className="c-meta">
              <span className="pill pill-info">{c.nature}</span>
              <span className="pill pill-draft">{c.type}</span>
              <span className="pill pill-ev">{c.frequency}</span>
              {c.isKey && <span className="pill pill-high">Key control</span>}
            </div>
            {stamp && (
              <div className={`stamp ${stamp} show`}>
                <div className="ring"><div><div className="big">{stamp === 'eff' ? 'Effective' : 'Ineffective'}</div><div className="sm">{c.id} · {eng.period}</div></div></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── one attribute — TOD then TOE, with the seal ─────────────────────────────────

function AttrCard({ control, attr, onTod, onToe }: { control: Control; attr: Attribute; onTod: (r: TestResult, n: string) => void; onToe: (r: TestResult, n: string) => void }) {
  const done = attr.tod.result === 'Fail' || (attr.tod.result === 'Pass' && attr.toe.result !== 'Not tested');
  const [running, setRunning] = useState(false);
  const [todPhase, setTodPhase] = useState<'idle' | 'run' | 'pass' | 'fail'>(attr.tod.result === 'Pass' ? 'pass' : attr.tod.result === 'Fail' ? 'fail' : 'idle');
  const [toePhase, setToePhase] = useState<'idle' | 'run' | 'pass' | 'fail' | 'gate'>(attr.toe.result === 'Pass' ? 'pass' : attr.toe.result === 'Fail' ? 'fail' : attr.tod.result === 'Fail' ? 'gate' : 'idle');
  const [lines, setLines] = useState<string[]>([]);
  const [shown, setShown] = useState(0);
  const [samples, setSamples] = useState<TestResult[]>([]);
  const [seal, setSeal] = useState<null | 'ok' | 'ko'>(done ? (attr.tod.result === 'Fail' || attr.toe.result === 'Fail' ? 'ko' : 'ok') : null);
  // deficiency severity calc
  const failed = attr.toe.result === 'Fail' || toePhase === 'fail';
  const [lik, setLik] = useState<'remote' | 'rp' | 'probable'>('rp');
  const [mag, setMag] = useState<'inconseq' | 'pm' | 'mat'>('pm');
  const [mw, setMw] = useState(false);

  const reveal = async (ls: string[]) => { setLines(ls); setShown(0); for (let i = 0; i < ls.length; i++) { await sleep(120); setShown(i + 1); await sleep(560); } };

  const test = async () => {
    if (running || done) return;
    setRunning(true);
    // TOD
    setTodPhase('run');
    const todPass = attr.tod.result !== 'Fail'; // seed Fail → fail; else pass
    await reveal(todLines(attr, todPass));
    await sleep(150);
    if (!todPass) {
      setTodPhase('fail'); setToePhase('gate'); setSeal('ko');
      onTod('Fail', attr.tod.note || 'Design gap');
      setRunning(false); return;
    }
    setTodPhase('pass'); onTod('Pass', 'Walkthrough confirms design.');
    // TOE
    setToePhase('run');
    const toePass = attr.toe.result !== 'Fail';
    const size = control.nature === 'Manual' ? (control.sampling?.size ?? attr.toe.sampleResults.length ?? 25) : (control.population?.count ?? 0);
    const fails = control.nature === 'Manual' ? (attr.toe.sampleResults.filter(s => s.result === 'Fail').length || (toePass ? 0 : 2)) : (toePass ? 0 : 6);
    if (control.nature === 'Manual') {
      const n = Math.min(size || 25, 25);
      const koStart = n - fails;
      for (let i = 0; i < n; i++) { await sleep(26); setSamples(prev => [...prev, i >= koStart && !toePass ? 'Fail' : 'Pass']); }
    }
    await reveal(toeLines(control, attr, toePass, size, fails));
    await sleep(120);
    setToePhase(toePass ? 'pass' : 'fail'); setSeal(toePass ? 'ok' : 'ko');
    onToe(toePass ? 'Pass' : 'Fail', toePass ? `${control.nature === 'Manual' ? size + ' samples' : 'full population'} · 0 exceptions` : `${fails} exception(s)`);
    setRunning(false);
  };

  const sev = severity(lik, mag, mw);
  const toeLabel = control.nature === 'Automated' ? 'TOE · automated' : 'TOE · manual';

  return (
    <div className={`attr${toePhase === 'pass' ? ' passed' : ''}${todPhase === 'fail' || toePhase === 'fail' ? ' failed' : ''}`}>
      {seal && <div className={`seal ${seal} show`}><div className="ring">{seal === 'ok' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>}</div></div>}
      <div className="a-top">
        <span className="a-no">{attr.code.split('.').pop()}</span>
        <div style={{ flex: 1 }}>
          <div className="a-proc">{attr.description}</div>
          <div className="a-asrt">Assertion · {attr.assertion}</div>
          <div className="a-crit"><b>Criteria for investigation:</b> {attr.precision}</div>
        </div>
      </div>
      <div className="testline">
        <span className={`test-stage ${todPhase === 'run' ? 'running' : todPhase === 'pass' ? 'pass' : todPhase === 'fail' ? 'fail' : ''}`}><span className="ts-dot" />TOD{todPhase === 'pass' ? ' · designed' : todPhase === 'fail' ? ' · No' : ''}</span>
        <span className={`test-stage ${toePhase === 'run' ? 'running' : toePhase === 'pass' ? 'pass' : toePhase === 'fail' ? 'fail' : toePhase === 'gate' ? 'gate' : ''}`}><span className="ts-dot" />{toePhase === 'gate' ? 'TOE · gated' : toeLabel}</span>
        {!done && <button className="sbtn sbtn-primary" disabled={running} onClick={test}>{running ? 'Testing…' : 'Test attribute'}</button>}
      </div>
      {lines.length > 0 && (
        <div className="reason show">
          {lines.slice(0, shown).map((l, i) => <div key={i} className="rl in" dangerouslySetInnerHTML={{ __html: l }} />)}
        </div>
      )}
      {samples.length > 0 && (
        <div className="samples">{samples.map((s, i) => <div key={i} className={`samp in ${s === 'Fail' ? 'ko' : 'ok'}`}>{i + 1}</div>)}</div>
      )}
      {failed && (
        <div className="defi show">
          <div className="dinner">
            <div className="dh"><span className="dt">Deficiency — severity computed</span><span className="pill pill-mit">computed</span></div>
            <div className="sev-calc">
              <div className="sev-field"><label>Likelihood</label><div className="seg">
                {([['remote', 'Remote'], ['rp', 'Reasonably possible'], ['probable', 'Probable']] as const).map(([v, t]) => <button key={v} aria-pressed={lik === v} onClick={() => setLik(v)}>{t}</button>)}
              </div></div>
              <div className="sev-field"><label>Magnitude vs materiality</label><div className="seg">
                {([['inconseq', 'Inconsequential'], ['pm', '> PM, < mat'], ['mat', '≥ materiality']] as const).map(([v, t]) => <button key={v} aria-pressed={mag === v} onClick={() => setMag(v)}>{t}</button>)}
              </div></div>
            </div>
            <label className="mw-toggle"><input type="checkbox" checked={mw} onChange={e => setMw(e.target.checked)} /> Material-weakness indicator present (restatement, ineffective control environment…)</label>
            <div className="sev-out"><span className="sv-lbl">Computed severity</span><span className={`sev-badge ${sev.cls}`}>{sev.label}</span></div>
            <div className="sev-note" dangerouslySetInnerHTML={{ __html: sev.note + ' Compensating controls may <b>cap</b> but never clear. Remediation after the assessment date does not reduce this.' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function severity(lik: string, mag: string, mw: boolean): { cls: string; label: string; note: string } {
  if (mw) return { cls: 'material', label: 'Material weakness', note: '<code>MW indicator present</code> forces a material weakness.' };
  if (lik === 'remote') return { cls: 'deficiency', label: 'Deficiency only', note: '<code>likelihood = remote</code> → a control deficiency, not significant.' };
  if (mag === 'inconseq') return { cls: 'deficiency', label: 'Deficiency only', note: '<code>magnitude inconsequential</code> → deficiency.' };
  if (mag === 'mat') return { cls: 'material', label: 'Material weakness', note: '<code>≥ materiality</code> × <code>reasonably possible</code> → material weakness.' };
  return { cls: 'significant', label: 'Significant deficiency', note: '<code>likelihood &gt; remote</code> × <code>magnitude &gt; PM</code> → significant deficiency.' };
}
