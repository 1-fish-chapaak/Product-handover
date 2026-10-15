/**
 * Risk Register — an enterprise risk register in the shape of an offsite risk
 * assessment: every risk rated 0–100 from inherent exposure, the Control
 * Library controls that mitigate it, its key risk indicators and recent loss
 * events, with the action each rating sets in motion.
 *
 *  Overview   where the risk sits, the rating mix, appetite, what moved
 *  Register   every risk as an entry, grouped and filtered
 *  Heat map   likelihood × impact, risk profiles, process × category
 *  Indicators every KRI against its thresholds, and the hotspots
 *  Risk 360   one risk: why this rating, controls, indicators, what-if,
 *             treatment and the action plan
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Download, Gauge, Plus, Search } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { useRiskRatings } from '../../data/erm/store';
import { AS_OF, MONTHS, TIER_ACTION, fmtKri, type Tier } from '../../data/erm/model';
import type { FileSourceChoice } from '../../data/auditPlan';
import type { RiskCategory } from '../../data/riskRegister';
import RiskList, { type ListFilter } from './RiskList';
import RiskHeatMap from './RiskHeatMap';
import RiskIndicators from './RiskIndicators';
import Risk360 from './Risk360';
import RiskEditorDrawer from './RiskEditorDrawer';
import LinkControlDrawer from './LinkControlDrawer';
import AdaptDataModal from '../audit-plan/AdaptDataModal';

type Tab = 'register' | 'heatmap' | 'indicators';
const TABS: [Tab, string][] = [['register', 'Register'], ['heatmap', 'Heat map'], ['indicators', 'Indicators']];
const FILTER_KEY = 'risk-register.list-filter';
const TAB_KEY = 'risk-register.tab';

/** A hand-off from the Risk Dashboard: which tab, which filter. */
function readHandoff<T>(key: string): T | null {
  try { const raw = window.sessionStorage.getItem(key); return raw ? (key === TAB_KEY ? (raw as T) : JSON.parse(raw) as T) : null; } catch { return null; }
}

export const OPEN_RISK_KEY = 'risk-register.open-risk';

interface Props {
  /** Defaults to the app-wide navigate event (for embedded use). */
  onNavigate?: (view: string) => void;
  onAdapt?: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
  /** Process Hub's risk tab: the register scoped to one process. */
  processFilter?: string;
  /** Inside Process Hub: the scoped list only; a risk opens in the Risk Register. */
  embedded?: boolean;
}

const navigateApp = (view: string) => window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view } }));

export interface RiskNav {
  openRisk: (id: string) => void;
  openControl: (rowId: string) => void;
  showList: (f: ListFilter) => void;
  goTo: (view: string) => void;
  /** Adapt standard controls with the client's data (the upload modal). */
  adapt: (keys: string[]) => void;
  /** Link Control Library controls to a risk (the picker). */
  linkControls: (riskId: string) => void;
}

export default function RiskRegisterPage({ onNavigate = navigateApp, onAdapt, processFilter, embedded }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { ratings, ctx } = useRiskRatings();
  const [tab, setTab] = useState<Tab>(() => (!embedded && readHandoff<Tab>(TAB_KEY)) || 'register');
  // A risk handed over from elsewhere (Control Library, Process Hub) opens here.
  const [openId, setOpenId] = useState<string | null>(() => {
    if (embedded) return null;
    try { return window.sessionStorage.getItem(OPEN_RISK_KEY); } catch { return null; }
  });
  useEffect(() => {
    if (embedded) return;
    try { [OPEN_RISK_KEY, FILTER_KEY, TAB_KEY].forEach(k => window.sessionStorage.removeItem(k)); } catch { /* ignore */ }
  }, [embedded]);
  const [filter, setFilter] = useState<ListFilter>(() => (processFilter ? { process: processFilter } : (!embedded && readHandoff<ListFilter>(FILTER_KEY)) || {}));
  const [creating, setCreating] = useState(false);
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const scoped = processFilter ? ratings.filter(r => r.risk.businessProcess === processFilter) : ratings;

  // The sidebar's Risk Register, clicked while a risk is open, returns here.
  useEffect(() => {
    if (embedded) return;
    const onReselect = (e: Event) => { if ((e as CustomEvent<{ view: string }>).detail?.view === 'audit-risk-register') setOpenId(null); };
    window.addEventListener('app:view-reselect', onReselect);
    return () => window.removeEventListener('app:view-reselect', onReselect);
  }, [embedded]);

  // Process Hub's "Create Risk" opens this register's editor.
  useEffect(() => {
    if (!embedded) return;
    const onCreate = (e: Event) => { if ((e as CustomEvent<{ section: string }>).detail?.section === 'risks') setCreating(true); };
    window.addEventListener('process-hub-create', onCreate);
    return () => window.removeEventListener('process-hub-create', onCreate);
  }, [embedded]);

  const nav: RiskNav = {
    openRisk: id => {
      if (embedded) {
        try { window.sessionStorage.setItem(OPEN_RISK_KEY, id); } catch { /* ignore */ }
        onNavigate('audit-risk-register');
        return;
      }
      setOpenId(id); setSearchOpen(false); setQuery('');
    },
    openControl: rowId => {
      try { window.sessionStorage.setItem('control-library.open-control-id', rowId); } catch { /* ignore */ }
      onNavigate('governance-controls');
    },
    showList: f => { setFilter(f); setTab('register'); setOpenId(null); },
    goTo: onNavigate,
    adapt: keys => setAdaptKeys(keys),
    linkControls: id => setLinkingId(id),
  };

  // Search — risks by name, ID or owner; indicators by name.
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!q) return { risks: [], kris: [] };
    return {
      risks: scoped.filter(r => [r.risk.id, r.risk.name, r.risk.owner, r.risk.subProcess].some(v => v.toLowerCase().includes(q))).slice(0, 6),
      kris: scoped.flatMap(r => r.kris.filter(k => k.kri.name.toLowerCase().includes(q)).map(k => ({ r, k }))).slice(0, 5),
    };
  }, [q, scoped]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const exportCsv = () => {
    const head = ['ID', 'Risk', 'Process', 'Sub-process', 'Category', 'Owner', 'Likelihood', 'Impact', 'Inherent', 'Controls effective', 'Red KRIs', 'Amber KRIs', 'Residual score', 'Rating', 'Action', 'Outside appetite', ...MONTHS.map(m => `${m} score`)];
    const rows = scoped.map(r => [
      r.risk.id, r.risk.name, r.risk.businessProcess, r.risk.subProcess, r.risk.category, r.risk.owner,
      String(r.risk.likelihood), String(r.risk.impact), String(r.inherent),
      `${r.effectiveControls} of ${r.controls.length}`,
      String(r.kris.filter(k => k.rag === 2).length), String(r.kris.filter(k => k.rag === 1).length),
      r.score.toFixed(1), r.tier, TIER_ACTION[r.tier], r.outsideAppetite ? 'Yes' : 'No',
      ...r.history.map(h => h.toFixed(1)),
    ]);
    const csv = [head, ...rows].map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `risk-register-${AS_OF.replace(/ /g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
    addToast({ message: `Exported ${scoped.length} risks`, type: 'success' });
    logEvent({ action: 'Export', description: `Exported the risk register (${scoped.length} risks) as CSV`, module: 'Risk Register', entity: 'Risk' });
  };

  const open = openId ? ratings.find(r => r.risk.id === openId) : undefined;
  if (open) {
    return <Risk360 rating={open} ctx={ctx} nav={nav} onBack={() => setOpenId(null)} onAdapt={onAdapt} />;
  }

  const modals = (
    <AnimatePresence>
      {adaptKeys && onAdapt && (
        <AdaptDataModal keys={adaptKeys} onClose={() => setAdaptKeys(null)} onContinue={choices => { const k = adaptKeys; setAdaptKeys(null); onAdapt(k, choices); }} />
      )}
      {linkingId && (() => {
        const lr = ratings.find(x => x.risk.id === linkingId);
        return lr ? <LinkControlDrawer risk={lr.risk} ctx={ctx} onClose={() => setLinkingId(null)} /> : null;
      })()}
    </AnimatePresence>
  );

  const counts = (t: Tier) => scoped.filter(r => r.tier === t).length;

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-[0.8125rem] text-ink-500 tabular-nums">
          {scoped.length} risks · {counts('Critical')} Critical · {counts('Very High')} Very High · {counts('High')} High
          <button onClick={() => onNavigate('audit-risk-register')} className="ml-2 font-medium text-brand-700 hover:underline cursor-pointer">Open the Risk Register</button>
        </p>
        <RiskList ratings={scoped} nav={nav} filter={filter} onFilter={setFilter} lockedProcess={processFilter} />
        <AnimatePresence>
          {creating && (
            <RiskEditorDrawer defaultProcess={processFilter} onClose={() => setCreating(false)} onSaved={id => { setCreating(false); nav.openRisk(id); }} />
          )}
        </AnimatePresence>
        {modals}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[96rem] mx-auto px-8 pt-7 pb-24">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Risk and controls</div>
            <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight text-ink-900 leading-tight">
              Risk Register{processFilter ? <span className="text-ink-400 font-normal"> · {processFilter}</span> : null}
            </h1>
            <p className="mt-1 text-[0.8125rem] text-ink-500">
              {scoped.length} risks rated on likelihood, impact, the controls that mitigate them and the indicators that watch them
              <span className="text-ink-400"> · assessed {AS_OF} · trend {MONTHS[0]}–{MONTHS[MONTHS.length - 1]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div ref={searchRef} className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search risks, owners or indicators"
                aria-label="Search risks and indicators"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] outline-none focus:border-brand-300"
              />
              {searchOpen && q && (
                <div className="absolute z-20 mt-1 w-[26rem] right-0 rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_8px_24px_rgba(15,8,30,0.08)] py-1.5">
                  {hits.risks.length === 0 && hits.kris.length === 0 && <p className="px-3 py-2 text-[0.8125rem] text-ink-500">Nothing matches “{query.trim()}”.</p>}
                  {hits.risks.length > 0 && <div className="px-3 pt-1 pb-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">Risks</div>}
                  {hits.risks.map(r => (
                    <button key={r.risk.id} onClick={() => nav.openRisk(r.risk.id)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-paper-50 cursor-pointer">
                      <span className="font-mono text-[0.6875rem] text-ink-400 w-14 shrink-0">{r.risk.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-900">{r.risk.name}</span>
                      <TierBadge tier={r.tier} />
                    </button>
                  ))}
                  {hits.kris.length > 0 && <div className="px-3 pt-2 pb-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">Indicators</div>}
                  {hits.kris.map(({ r, k }) => (
                    <button key={k.kri.id} onClick={() => nav.openRisk(r.risk.id)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-paper-50 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] text-ink-900">{k.kri.name}</span>
                        <span className="block truncate text-[0.6875rem] text-ink-500">{r.risk.id} · {r.risk.name}</span>
                      </span>
                      <span className="font-mono text-[0.75rem] text-ink-700 tabular-nums">{fmtKri(k.kri, k.value)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" leftIcon={<Gauge size={14} />} onClick={() => onNavigate('risk-dashboard')}>Risk dashboard</Button>
            <Button variant="outline" leftIcon={<Download size={14} />} onClick={exportCsv}>Export</Button>
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setCreating(true)}>New risk</Button>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Risk register views" className="mt-6 mb-6 flex items-center gap-6 border-b border-canvas-border">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative -mb-px h-10 text-[0.875rem] cursor-pointer transition-colors ${tab === id ? 'text-ink-900 font-semibold' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {label}
              {id === 'register' && <span className="ml-1.5 font-mono text-[0.75rem] text-ink-400 tabular-nums">{scoped.length}</span>}
              {id === 'indicators' && <span className="ml-1.5 font-mono text-[0.75rem] text-ink-400 tabular-nums">{scoped.reduce((a, r) => a + r.kris.length, 0)}</span>}
              {tab === id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
            </button>
          ))}
          <span className="ml-auto pb-2 text-[0.75rem] text-ink-500 tabular-nums">
            {counts('Critical')} Critical · {counts('Very High')} Very High · {counts('High')} High
          </span>
        </div>

        {tab === 'register' && <RiskList ratings={scoped} nav={nav} filter={filter} onFilter={setFilter} lockedProcess={processFilter} />}
        {tab === 'heatmap' && <RiskHeatMap ratings={scoped} nav={nav} />}
        {tab === 'indicators' && <RiskIndicators ratings={scoped} nav={nav} />}
      </div>

      <AnimatePresence>
        {creating && (
          <RiskEditorDrawer
            defaultProcess={processFilter}
            onClose={() => setCreating(false)}
            onSaved={id => { setCreating(false); setOpenId(id); }}
          />
        )}
      </AnimatePresence>
      {modals}
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  return <span className="text-[0.6875rem] font-semibold text-ink-600 whitespace-nowrap">{tier}</span>;
}

export type { RiskCategory };
