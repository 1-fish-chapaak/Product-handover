import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Check, Grid3x3,
  Archive, ArrowLeft, ArrowRight, Shield, Workflow as WorkflowIcon, FileText,
  Search, Trash2, X, ChevronDown, Download, ChevronRight, Plus, Pencil, Star, Link2, Eye,
} from 'lucide-react';
import RacmMappingWorkspace, { CONTROL_LIBRARY, AUTO_CLS, LinkWorkflowToControlDrawer, type MappedControl, type ControlWorkflow } from './RacmMappingWorkspace';
import SopDetailDrawer from './SopDetailDrawer';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { Button } from '../shared/Button';
import ListLoadError from '../shared/ListLoadError';
import ColumnFilter from '../shared/ColumnFilter';
import { Pill, type Tone } from '../shared/StatusBadge';
import { SEED_RISKS, RiskDrawer } from './RiskRegister';
import CreateControlDrawer from '../governance/CreateControlDrawer';
import { BUSINESS_PROCESSES, RISKS, CONTROLS, WORKFLOWS, SOPS } from '../../data/mockData';
import { AR_RACM_ENTRIES, AR_RACM_ID, type ArRacmEntry } from '../../data/arRacm';

// ─── Linkable risks (Link Risk sidesheet) ────────────────────────────────────
// Extra business-process risks that are NOT part of any RACM's seed mapping, so
// they're available to link. Combined with the Risk Register seed risks (minus
// whatever is already mapped) to populate the picker.
type LinkableRisk = { id: string; name: string; description: string; priority: string; bpAbbr: string };
const LINKABLE_RISKS: LinkableRisk[] = [
  { id: 'RSK-021', name: 'Goods received not reconciled to purchase order', description: 'GRN quantities not matched against the PO, allowing over-receipt or payment for undelivered goods', priority: 'High', bpAbbr: 'P2P' },
  { id: 'RSK-022', name: 'Vendor bank details changed without re-verification', description: 'Bank account updates on the vendor master not independently confirmed, enabling payment diversion', priority: 'Critical', bpAbbr: 'P2P' },
  { id: 'RSK-023', name: 'Advance payments released without milestone evidence', description: 'Advances paid to vendors without supporting milestone or delivery confirmation', priority: 'Medium', bpAbbr: 'P2P' },
];

// All BP risks that could be linked: the Risk Register seed risks for the process
// plus the extra linkable samples, de-duplicated by id (extras win).
function getLinkableRisks(bpAbbr: string): { id: string; name: string; description: string; priority: string }[] {
  const extra = LINKABLE_RISKS.filter(r => r.bpAbbr === bpAbbr)
    .map(r => ({ id: r.id, name: r.name, description: r.description, priority: r.priority }));
  const seed = SEED_RISKS.filter(r => r.businessProcess === bpAbbr)
    .map(r => ({ id: r.id, name: r.name, description: r.description, priority: r.priority }));
  const seen = new Set<string>();
  return [...extra, ...seed].filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

// ─── AR RACM column model ────────────────────────────────────────────────────
// The rich RACM renders the full SOP-extract schema — every field of ArRacmEntry —
// as a wide, horizontally-scrollable matrix that mirrors the source export format.
// Config-driven so headers, widths and cell styling all live in one place; any RACM
// routed through the rich path renders this same full format.
type ArCol = {
  key: keyof ArRacmEntry;
  label: string;
  kind?: 'mono' | 'rating' | 'conf' | 'long';
  minW?: number;
  nowrap?: boolean;
};

const AR_RACM_COLUMNS: ArCol[] = [
  { key: 'riskId', label: 'Risk ID', kind: 'mono' },
  { key: 'controlId', label: 'Control ID', kind: 'mono' },
  { key: 'processArea', label: 'Process Area', nowrap: true },
  { key: 'subProcess', label: 'Sub-Process', minW: 150 },
  { key: 'riskCategory', label: 'Risk Category', nowrap: true },
  { key: 'riskDescription', label: 'Risk Description', kind: 'long', minW: 300 },
  { key: 'riskRating', label: 'Risk Rating', kind: 'rating' },
  { key: 'riskLikelihood', label: 'Likelihood', nowrap: true },
  { key: 'riskImpact', label: 'Impact', nowrap: true },
  { key: 'controlObjective', label: 'Control Objective', kind: 'long', minW: 280 },
  { key: 'controlActivity', label: 'Control Activity', kind: 'long', minW: 360 },
  { key: 'controlType', label: 'Control Type', nowrap: true },
  { key: 'controlNature', label: 'Control Nature', nowrap: true },
  { key: 'controlFrequency', label: 'Frequency', nowrap: true },
  { key: 'controlOwner', label: 'Control Owner', minW: 160 },
  { key: 'controlEvidence', label: 'Control Evidence', kind: 'long', minW: 220 },
  { key: 'assertionsCoveredCEAVOP', label: 'Assertions (CEAVOP)', minW: 180 },
  { key: 'financialStatementLineItem', label: 'FS Line Item', minW: 150 },
  { key: 'regulatoryReference', label: 'Regulatory Reference', minW: 190 },
  { key: 'segregationOfDuties', label: 'Segregation of Duties', minW: 130 },
  { key: 'extractionConfidence', label: 'Extraction Confidence', kind: 'conf' },
  { key: 'sopSectionReference', label: 'SOP Reference', minW: 180 },
  { key: 'gapsIdentified', label: 'Gaps Identified', kind: 'long', minW: 300 },
  { key: 'itApplication', label: 'IT Application', nowrap: true },
  { key: 'todDataValidated', label: 'ToD — Data Validated', kind: 'long', minW: 280 },
  { key: 'todChecksPerformed', label: 'ToD — Checks Performed', kind: 'long', minW: 280 },
  { key: 'todResults', label: 'ToD — Results', kind: 'long', minW: 180 },
  { key: 'remediationActionPlan', label: 'Remediation Action Plan', kind: 'long', minW: 240 },
  { key: 'timelines', label: 'Timelines', nowrap: true },
  { key: 'processOwnerName', label: 'Process Owner', nowrap: true },
  { key: 'remarks', label: 'Remarks', kind: 'long', minW: 200 },
  { key: 'reviewerApprover', label: 'Reviewer / Approver', minW: 190 },
];

// Render one cell by column kind. Empty values become a muted em-dash so blank
// RACM fields (ToD results, remediation, etc.) read as "not yet filled", not missing.
function renderArCell(e: ArRacmEntry, col: ArCol) {
  const val = String(e[col.key] ?? '').trim();
  if (!val) return <span className="text-ink-300">—</span>;
  switch (col.kind) {
    case 'mono':
      return <span className="font-mono text-[11px] text-ink-600 tabular-nums whitespace-nowrap">{val}</span>;
    case 'rating':
      return (
        <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center whitespace-nowrap ${
          val === 'Critical' ? 'bg-risk-50 text-risk-700' :
          val === 'High'     ? 'bg-high-50 text-high-700' :
          val === 'Medium'   ? 'bg-mitigated-50 text-mitigated-700' :
                               'bg-compliant-50 text-compliant-700'
        }`}>{val}</span>
      );
    case 'conf':
      return (
        <span className={`font-mono text-[10px] font-semibold whitespace-nowrap ${
          val === 'EXTRACTED' ? 'text-compliant-700' :
          val === 'INFERRED'  ? 'text-mitigated-700' :
                                'text-high-700'
        }`}>{val}</span>
      );
    case 'long':
      return <span className="block text-ink-800 leading-snug">{val}</span>;
    default:
      return <span className={`text-ink-700 ${col.nowrap ? 'whitespace-nowrap' : ''}`}>{val}</span>;
  }
}

// ─── Frozen anchors + column show/hide ───────────────────────────────────────
// Risk ID + Control ID are the two pinned anchor columns: always visible (never in
// the show/hide menu) and frozen left during horizontal scroll. Every other column
// is toggleable. A fixed lane width keeps the second column's sticky offset reliable.
const AR_FROZEN_KEYS: ReadonlySet<string> = new Set(['riskId', 'controlId']);
const AR_ANCHOR_W = 140; // px width of each frozen anchor column (drives the sticky offset)
const AR_TOGGLE_COLUMNS = AR_RACM_COLUMNS.filter(c => !AR_FROZEN_KEYS.has(c.key as string));
const AR_ALL_KEYS = AR_RACM_COLUMNS.map(c => c.key as string);

// Inline sticky style for a cell at column `index`. Only the first two (frozen)
// columns get pinned; everything else returns undefined. Header cells sit above body
// cells so rows scroll cleanly underneath. Backgrounds are applied via Tailwind on
// the cell (bg-white) since sticky cells need an opaque fill.
function arStickyStyle(index: number, isHeader: boolean): React.CSSProperties | undefined {
  if (index > 1) return undefined;
  return {
    position: 'sticky',
    left: index === 0 ? 0 : AR_ANCHOR_W,
    zIndex: isHeader ? 3 : 1,
  };
}

// Small "Columns" show/hide dropdown — mirrors the Download menu's popover styling
// and closes on outside click. The frozen anchors are listed checked + disabled so
// it's clear they can't be hidden; all other columns toggle membership in `visible`.
function ColumnsMenu({ visible, onToggle }: {
  visible: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const shownCount = AR_TOGGLE_COLUMNS.filter(c => visible.has(c.key as string)).length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-[6px] border border-canvas-border bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:bg-paper-50 cursor-pointer transition-colors"
      >
        Columns <span className="font-mono tabular-nums text-ink-500">· {shownCount + AR_FROZEN_KEYS.size}/{AR_ALL_KEYS.length}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-[230px] max-h-[320px] overflow-y-auto bg-white border border-border-light rounded-[8px] shadow-lg z-50 py-1">
          {/* Frozen anchors — always on, can't be hidden. */}
          {AR_RACM_COLUMNS.filter(c => AR_FROZEN_KEYS.has(c.key as string)).map(col => (
            <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink-400 cursor-not-allowed">
              <input type="checkbox" checked disabled className="w-3.5 h-3.5 rounded-[4px] accent-brand-600 cursor-not-allowed" />
              <span className="truncate">{col.label}</span>
              <span className="ml-auto text-[0.625rem] uppercase tracking-wide text-ink-300">Pinned</span>
            </label>
          ))}
          <div className="my-1 border-t border-canvas-border/60" />
          {AR_TOGGLE_COLUMNS.map(col => {
            const key = col.key as string;
            const checked = visible.has(key);
            return (
              <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink-700 hover:bg-paper-50 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => onToggle(key)} className="w-3.5 h-3.5 rounded-[4px] accent-brand-600 cursor-pointer" />
                <span className="truncate">{col.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared RACM header ──────────────────────────────────────────────────────
// One header card used by BOTH the RACM detail page and the AR "Open mapping" view,
// so the two read as the same RACM. Only the action button differs: the detail page
// opens mapping; the mapping view returns to the summary.
function RacmDetailHeader({ racm, action }: { racm: RacmEntry; action: React.ReactNode }) {
  const rawStatus = getRacmTableStatus(racm);
  const readiness = getRacmTableReadiness(racm);
  const fields = [
    { label: 'Version', value: racm.version, mono: true },
    { label: 'Process', value: racm.process },
    { label: 'Framework', value: racm.framework },
    { label: 'Risks', value: String(racm.risks), mono: true },
    { label: 'Controls', value: String(racm.controls), mono: true },
    { label: 'Key Controls', value: String(racm.keyControls), mono: true },
    { label: 'Workflow Coverage', value: `${racm.workflowCoverage}%`, mono: true },
    { label: 'Attributes Coverage', value: `${racm.attributesCoverage}%`, mono: true },
  ];
  return (
    <div className="bg-white border border-canvas-border rounded-[12px] p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Pill tone={STATUS_TONE[rawStatus]}>{rawStatus}</Pill>
            <Pill tone={READINESS_TONE[readiness]}>{readiness}</Pill>
            <span className="font-mono text-[11px] text-ink-500">{racm.id}</span>
          </div>
          <h1 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-[1.2]">{racm.name}</h1>
        </div>
        {action}
      </div>
      <div className="grid grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
        {fields.map(f => (
          <div key={f.label}>
            <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
            <span className={`text-[13px] block ${f.mono ? 'font-mono text-ink-700 tabular-nums' : 'text-text'}`}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Page (Step 4) ──────────────────────────────────────────────────
// Synthesise full-schema RACM rows for a SEED racm — deterministic per risk/control,
// matching AR_RACM_COLUMNS. Shared by the RACM detail summary and the read-only
// mapping view so both render the same rows.
function synthSeedEntries(racm: RacmEntry): Record<string, string>[] {
  const bp = BUSINESS_PROCESSES.find(b => b.abbr === racm.process) ?? null;
  const scopedRisks = bp ? RISKS.filter(r => r.bpId === bp.id) : [];
  const scopedRiskIds = new Set(scopedRisks.map(r => r.id));
  const scopedControls = CONTROLS.filter(c => scopedRiskIds.has(c.riskId));
  const SUB_PROCESS_POOL: Record<string, string[]> = {
    P2P: ['Vendor Management', 'Purchase Orders', 'Invoice Processing', 'Payment Execution', 'Goods Receipt'],
    O2C: ['Order Entry', 'Credit Management', 'Billing & Invoicing', 'Revenue Recognition', 'Collections'],
    R2R: ['Journal Entries', 'GL Reconciliation', 'Financial Close', 'Intercompany', 'Fixed Assets'],
    ITGC: ['Access Management', 'Change Management', 'Operations', 'Data Backup', 'Incident Response'],
    S2C: ['Supplier Selection', 'Contract Negotiation', 'Contract Compliance', 'Supplier Performance', 'Contract Renewal'],
  };
  const CATEGORY_POOL = ['Financial', 'Operational', 'Compliance', 'IT', 'Fraud'];
  const OWNER_POOL = ['Rajiv Sharma', 'Deepak Bansal', 'Meera Patel', 'Neha Joshi', 'Karan Mehta'];
  const ASSERTION_POOL = ['C, A, V', 'E, A', 'C, E, A, V', 'A, O', 'C, A'];
  const FS_POOL = ['Accounts Payable', 'Revenue', 'Cash & Bank', 'Inventory', 'Accruals'];
  const APP_POOL = ['SAP', 'Oracle ERP', 'NetSuite', 'Manual'];
  const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  return scopedControls.map(c => {
    const risk = scopedRisks.find(r => r.id === c.riskId);
    const h = hashStr(c.id + ':' + c.riskId);
    const subs = SUB_PROCESS_POOL[racm.process] ?? ['General Operations'];
    const rating = risk ? risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1) : 'Medium';
    const likelihood = rating === 'Critical' || rating === 'High' ? 'High' : rating === 'Medium' ? 'Medium' : 'Low';
    const impact = rating === 'Critical' || rating === 'High' ? 'High' : rating === 'Medium' ? 'Medium' : 'Low';
    const owner = OWNER_POOL[h % OWNER_POOL.length];
    const reviewer = OWNER_POOL[(h + 2) % OWNER_POOL.length];
    const exception = h % 6 === 0;
    return {
      riskId: c.riskId,
      controlId: c.id,
      processArea: bp?.name ?? racm.process,
      subProcess: subs[h % subs.length],
      riskCategory: CATEGORY_POOL[h % CATEGORY_POOL.length],
      riskDescription: risk?.name ?? c.name,
      riskRating: rating,
      riskLikelihood: likelihood,
      riskImpact: impact,
      controlObjective: `Ensure ${(risk?.name ?? c.name).toLowerCase()} is mitigated through timely control execution.`,
      controlActivity: c.desc ?? c.name,
      controlType: c.isKey ? 'Key' : 'Non-Key',
      controlNature: h % 2 === 0 ? 'Preventive' : 'Detective',
      controlFrequency: ['Per transaction', 'Daily', 'Monthly', 'Quarterly'][h % 4],
      controlOwner: owner,
      controlEvidence: 'System logs, approval records, reconciliation reports',
      assertionsCoveredCEAVOP: ASSERTION_POOL[h % ASSERTION_POOL.length],
      financialStatementLineItem: FS_POOL[h % FS_POOL.length],
      regulatoryReference: 'SOX 404 / IFC',
      segregationOfDuties: h % 3 === 0 ? 'Enforced' : 'Partial',
      extractionConfidence: (h % 10) < 7 ? 'EXTRACTED' : (h % 10) < 9 ? 'INFERRED' : 'RECOMMENDED',
      sopSectionReference: `Section ${(h % 6) + 1}`,
      gapsIdentified: exception ? 'Approval evidence not consistently retained.' : 'No gaps identified.',
      itApplication: APP_POOL[h % APP_POOL.length],
      todDataValidated: 'Sample population reconciled to source documents.',
      todChecksPerformed: 'Verified authorization, recomputation and completeness.',
      todResults: exception ? 'Exceptions noted' : 'No exceptions',
      remediationActionPlan: exception ? 'Strengthen approval workflow and re-test next quarter.' : 'Not applicable',
      timelines: exception ? 'Q3 FY26' : '—',
      processOwnerName: reviewer,
      remarks: '—',
      reviewerApprover: reviewer,
    };
  });
}

function RacmDetailPage({ racm, onOpenMapping }: { racm: RacmEntry; onBack: () => void; onOpenMapping: () => void }) {
  // The AR RACM is wired to a real RACM extract (123 risk/control rows) loaded from
  // `arRacm.ts`. The remaining seed RACMs derive a slimmer view from mockData by
  // matching `racm.process` against BUSINESS_PROCESSES — both paths feed the same
  // section layout below.
  const isRichRacm = racm.id === AR_RACM_ID;
  const arEntries: ArRacmEntry[] = isRichRacm ? AR_RACM_ENTRIES : [];

  const bp = BUSINESS_PROCESSES.find(b => b.abbr === racm.process) ?? null;
  const sop = isRichRacm ? null : (SOPS.find(s => s.bpId === bp?.id) ?? null);
  const scopedRisks = isRichRacm ? [] : (bp ? RISKS.filter(r => r.bpId === bp.id) : []);
  const scopedRiskIds = new Set(scopedRisks.map(r => r.id));
  const scopedControls = isRichRacm ? [] : CONTROLS.filter(c => scopedRiskIds.has(c.riskId));
  const scopedWorkflows = isRichRacm ? [] : (bp ? WORKFLOWS.filter(w => w.bpId === bp.id) : []);
  const rels = { sop, risks: scopedRisks, controls: scopedControls, workflows: scopedWorkflows };

  // Full-schema rows for the SEED entries table — synthesised to match AR's columns
  // (see synthSeedEntries above). Empty for the rich AR RACM, which uses arEntries.
  const seedEntryRows: Record<string, string>[] = isRichRacm ? [] : synthSeedEntries(racm);
  // Gap-analysis aggregates derived from the synthesised seed entries.
  const seedSodEnforced = seedEntryRows.filter(r => r.segregationOfDuties === 'Enforced').length;
  const seedGapCount = seedEntryRows.filter(r => r.gapsIdentified !== 'No gaps identified.').length;
  const seedKeyCount = seedEntryRows.filter(r => r.controlType === 'Key').length;
  const seedTotal = seedEntryRows.length;
  const seedKpiPct = seedTotal ? Math.round((seedKeyCount / seedTotal) * 100) : 0;

  // ── Aggregations ─────────────────────────────────────────────────────────
  // Severity distribution. The AR data uses capitalised ratings ("Critical");
  // the legacy seed data uses lowercase ("critical"). Normalise to capitalised.
  const severityRows: Array<{ label: 'Critical' | 'High' | 'Medium' | 'Low'; tone: string }> = [
    { label: 'Critical', tone: 'bg-risk-700' },
    { label: 'High',     tone: 'bg-high-700' },
    { label: 'Medium',   tone: 'bg-mitigated-700' },
    { label: 'Low',      tone: 'bg-compliant-700' },
  ];
  const severityCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  if (isRichRacm) {
    arEntries.forEach(e => { severityCounts[e.riskRating] = (severityCounts[e.riskRating] ?? 0) + 1; });
  } else {
    scopedRisks.forEach(r => {
      const cap = r.severity.charAt(0).toUpperCase() + r.severity.slice(1);
      severityCounts[cap] = (severityCounts[cap] ?? 0) + 1;
    });
  }
  const totalRisks = isRichRacm ? arEntries.length : scopedRisks.length;
  const uniqueControlIds = isRichRacm
    ? new Set(arEntries.map(e => e.controlId))
    : new Set(scopedControls.map(c => c.id));
  const processAreaSet = isRichRacm
    ? new Set(arEntries.map(e => e.processArea))
    : (bp ? new Set([bp.name]) : new Set<string>());

  // Process area breakdown — group rich entries by processArea, fall back to the
  // single-BP row for seed RACMs.
  const processAreaRows: Array<{ area: string; risks: number; controls: number }> = isRichRacm
    ? Array.from(processAreaSet).map(area => {
        const inArea = arEntries.filter(e => e.processArea === area);
        return {
          area,
          risks: inArea.length,
          controls: new Set(inArea.map(e => e.controlId)).size,
        };
      })
    : (bp ? [{ area: bp.name, risks: scopedRisks.length, controls: scopedControls.length }] : []);

  // Control type distribution — only meaningful for rich data (mockData CONTROLS
  // lacks a Preventive/Detective field).
  const controlTypeCounts: Record<string, number> = { Preventive: 0, Detective: 0 };
  if (isRichRacm) {
    arEntries.forEach(e => { controlTypeCounts[e.controlType] = (controlTypeCounts[e.controlType] ?? 0) + 1; });
  } else {
    seedEntryRows.forEach(r => { controlTypeCounts[r.controlNature] = (controlTypeCounts[r.controlNature] ?? 0) + 1; });
  }

  // Extraction confidence — also rich-only. EXTRACTED dominates; INFERRED and
  // RECOMMENDED flag entries that the user should review.
  const confidenceRows: Array<{ label: 'EXTRACTED' | 'INFERRED' | 'RECOMMENDED'; tone: string }> = [
    { label: 'EXTRACTED',   tone: 'text-compliant-700' },
    { label: 'INFERRED',    tone: 'text-mitigated-700' },
    { label: 'RECOMMENDED', tone: 'text-high-700' },
  ];
  const confidenceCounts: Record<string, number> = { EXTRACTED: 0, INFERRED: 0, RECOMMENDED: 0 };
  if (isRichRacm) {
    arEntries.forEach(e => { confidenceCounts[e.extractionConfidence] = (confidenceCounts[e.extractionConfidence] ?? 0) + 1; });
  } else {
    seedEntryRows.forEach(r => { confidenceCounts[r.extractionConfidence] = (confidenceCounts[r.extractionConfidence] ?? 0) + 1; });
  }
  const confidenceTotal = confidenceRows.reduce((sum, c) => sum + (confidenceCounts[c.label] ?? 0), 0);

  // Gap analysis — three fixed checks matching the Irame screenshot layout.
  const sodCoverage = isRichRacm
    ? (arEntries.every(e => e.segregationOfDuties === 'N/A') ? 'Complete'
       : arEntries.some(e => /sod|segregation/i.test(e.segregationOfDuties)) ? 'Partial'
       : 'Documented')
    : '';
  const hasDoaSignal = isRichRacm && arEntries.some(e => /\bdoa\b|delegation of authority/i.test(`${e.controlActivity} ${e.controlObjective} ${e.regulatoryReference}`));
  const doaMatrix = isRichRacm ? (hasDoaSignal ? 'Present' : 'Absent') : '';
  const hasKpiSignal = isRichRacm && arEntries.some(e => /\bkpi\b|key performance/i.test(`${e.controlActivity} ${e.controlObjective}`));
  const kpiCoverage = isRichRacm ? (hasKpiSignal ? 'Sufficient' : 'Insufficient') : '';
  const entriesWithGaps = isRichRacm ? arEntries.filter(e => e.gapsIdentified && e.gapsIdentified.trim().length > 0).length : 0;

  // Templated Executive Summary — built from the actual numbers so it reads
  // like a generated narrative (mirrors the Irame "Executive Summary" paragraph).
  const execPctMedium = isRichRacm && totalRisks > 0 ? ((severityCounts.Medium / totalRisks) * 100).toFixed(1) : '0';
  const execPctHigh = isRichRacm && totalRisks > 0 ? ((severityCounts.High / totalRisks) * 100).toFixed(1) : '0';
  const execPreventive = controlTypeCounts.Preventive ?? 0;
  const execDetective = controlTypeCounts.Detective ?? 0;
  const execTopArea = isRichRacm
    ? (Array.from(processAreaSet).sort((a, b) => arEntries.filter(e => e.processArea === b).length - arEntries.filter(e => e.processArea === a).length)[0] ?? '')
    : '';
  // Seed executive-summary inputs — derived from the synthesised seed entries.
  const seedHiPct = !isRichRacm && totalRisks > 0 ? Math.round(((severityCounts.High + severityCounts.Critical) / totalRisks) * 100) : 0;
  const seedLean = execPreventive >= execDetective ? 'preventive' : 'detective';
  const seedGapClause = seedGapCount === 0
    ? 'No remediation gaps were flagged across the mapped controls.'
    : `${seedGapCount} ${seedGapCount === 1 ? 'entry has' : 'entries have'} documented gaps requiring remediation.`;
  const executiveSummary = isRichRacm
    ? `The recent RACM analysis, encompassing ${uniqueControlIds.size} unique controls predominantly within the ${execTopArea} process, indicates that most identified risks are medium (${execPctMedium}%), with a notable ${execPctHigh}% classified as high. Control coverage leans slightly towards ${execDetective > execPreventive ? 'detective' : 'preventive'} measures, with ${execDetective} detective controls compared to ${execPreventive} preventive. While Segregation of Duties and Delegation of Authority are ${sodCoverage === 'Complete' ? 'adequately addressed' : 'partially addressed'}, a significant gap was identified in Key Performance Indicator (KPI) coverage, as ${hasKpiSignal ? 'few' : 'no'} controls for KPI reporting were present.`
    : `This RACM maps ${totalRisks} risk${totalRisks !== 1 ? 's' : ''} to ${uniqueControlIds.size} control${uniqueControlIds.size !== 1 ? 's' : ''} across the ${bp?.name ?? racm.process} process. ${seedHiPct}% of risks are rated high or critical, and control coverage leans ${seedLean} (${execPreventive} preventive, ${execDetective} detective). Segregation of duties is enforced on ${seedSodEnforced} of ${seedTotal} control${seedTotal !== 1 ? 's' : ''}, with ${seedKeyCount} key control${seedKeyCount !== 1 ? 's' : ''} identified. ${seedGapClause}`;

  // Header controls — collapse the long SOP summary, and a Download menu.
  const [showSummary, setShowSummary] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  // Close the Download menu on any outside click.
  useEffect(() => {
    if (!downloadOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(ev.target as Node)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [downloadOpen]);

  // Trigger a real browser download from the on-screen rows. Rich RACMs export the
  // full AR entries; seed RACMs export the synthesised full-schema rows. XLSX is a
  // pragmatic CSV-with-.xlsx-extension stub (opens cleanly in Excel) — enough to be
  // functional without pulling in a spreadsheet library.
  const triggerDownload = (format: 'xlsx' | 'csv' | 'json') => {
    const rows: Record<string, unknown>[] = isRichRacm
      ? (arEntries as unknown as Record<string, unknown>[])
      : seedEntryRows;
    const base = (racm.name || racm.id).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'racm';
    let content: string;
    let mime: string;
    let ext: string;
    if (format === 'json') {
      content = JSON.stringify(rows, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = AR_RACM_COLUMNS.map(col => esc(col.label)).join(',');
      const body = rows.map(r => AR_RACM_COLUMNS.map(col => esc(r[col.key as string])).join(',')).join('\n');
      content = `${header}\n${body}`;
      mime = format === 'xlsx' ? 'application/vnd.ms-excel' : 'text/csv';
      ext = format;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
  };

  // Entries-table search — functional filter on risk id / control id / description / sub-process.
  const [entriesQuery, setEntriesQuery] = useState('');

  // Column show/hide for the Entries table — Risk ID + Control ID are the frozen
  // anchors (always on, never in the menu). `shownEntryColumns` drives both the rich
  // (AR) and seed Entries tables so the two stay in sync.
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(AR_ALL_KEYS));
  const toggleColumn = (key: string) => setVisibleColumns(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const shownEntryColumns = AR_RACM_COLUMNS.filter(c => visibleColumns.has(c.key as string));
  const filteredEntries = isRichRacm && entriesQuery.trim()
    ? (() => {
        const q = entriesQuery.toLowerCase();
        // Search the whole row now that every field is on screen.
        return arEntries.filter(e => Object.values(e).some(v => String(v).toLowerCase().includes(q)));
      })()
    : arEntries;

  // ── Pagination over filteredEntries ────────────────────────────────────────
  const ENTRIES_PER_PAGE = 25;
  const [entriesPage, setEntriesPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE));
  // Clamp the page back to 1 whenever the search shrinks the result set below the
  // current page (otherwise the user would land on an empty page).
  useEffect(() => { setEntriesPage(1); }, [entriesQuery]);
  const safePage = Math.min(entriesPage, totalPages);
  const pageStart = (safePage - 1) * ENTRIES_PER_PAGE;
  const pageEnd = Math.min(pageStart + ENTRIES_PER_PAGE, filteredEntries.length);
  const pagedEntries = filteredEntries.slice(pageStart, pageEnd);

  return (
    <div className="space-y-5">
      <RacmDetailHeader
        racm={racm}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSummary(v => !v)}
              className="text-[12px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
            >
              {showSummary ? 'Hide Summary' : 'Show Summary'}
            </button>
            <div ref={downloadRef} className="relative">
              <Button
                variant="outline"
                size="md"
                rightIcon={<ChevronDown size={13} />}
                onClick={() => setDownloadOpen(v => !v)}
              >
                Download
              </Button>
              {downloadOpen && (
                <div className="absolute right-0 mt-1.5 w-[200px] bg-white border border-border-light rounded-[8px] shadow-lg z-50">
                  <button type="button" onClick={() => triggerDownload('xlsx')} className="block w-full text-left px-3 py-2 text-[12px] text-ink-700 hover:bg-paper-50 cursor-pointer">Download as XLSX</button>
                  <button type="button" onClick={() => triggerDownload('csv')} className="block w-full text-left px-3 py-2 text-[12px] text-ink-700 hover:bg-paper-50 cursor-pointer">Download as CSV</button>
                  <button type="button" onClick={() => triggerDownload('json')} className="block w-full text-left px-3 py-2 text-[12px] text-ink-700 hover:bg-paper-50 cursor-pointer">Download as JSON</button>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              className="shrink-0"
              rightIcon={<ArrowRight size={13} />}
              onClick={onOpenMapping}
            >
              Open mapping
            </Button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          Rich (AR RACM) layout — mirrors the Irame.ai RACM Generator screenshot.
          For seed RACMs we keep the simpler layout below (after this block).
          ═══════════════════════════════════════════════════════════════════ */}
      {isRichRacm ? (
        <>
          {/* ─── 3 metric cards ─── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Risks',     value: totalRisks,             tone: 'text-brand-700' },
              { label: 'Unique Controls', value: uniqueControlIds.size,  tone: 'text-compliant-700' },
              { label: 'Process Areas',   value: processAreaSet.size,    tone: 'text-mitigated-700' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-canvas-border rounded-[12px] p-6 text-center">
                <div className={`text-[40px] font-bold tabular-nums leading-none ${card.tone}`}>{card.value}</div>
                <div className="text-[12px] text-ink-500 mt-2">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ─── Top dashboard: chart on the left, breakdown table on the right ─── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-canvas-border rounded-[12px] p-5">
              <h2 className="text-[13px] font-bold text-ink-900 mb-4">Risk Rating Distribution</h2>
              <div className="space-y-2.5">
                {severityRows.map(s => {
                  const count = severityCounts[s.label] ?? 0;
                  const pct = totalRisks > 0 ? (count / totalRisks) * 100 : 0;
                  return (
                    <div key={s.label} className="flex items-center gap-3 text-[12px]">
                      <span className="w-16 shrink-0 text-ink-700">{s.label}</span>
                      <div className="flex-1 h-3 bg-paper-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.tone}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right tabular-nums text-ink-700 font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-canvas-border rounded-[12px] p-5">
              <h2 className="text-[13px] font-bold text-ink-900 mb-3">Process Area Breakdown</h2>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                    <th className="py-2 font-semibold">Process Area</th>
                    <th className="py-2 font-semibold text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {processAreaRows.map(row => (
                    <tr key={row.area} className="border-b border-canvas-border/40 last:border-0">
                      <td className="py-2.5 text-ink-800">{row.area}</td>
                      <td className="py-2.5 text-right tabular-nums text-ink-700">{row.risks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── SOP Analysis Summary — long-form narrative + tables ─── */}
          {showSummary && (
          <div className="bg-white border border-canvas-border rounded-[12px] p-6 space-y-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-400 mb-1">SOP Analysis Summary</div>
              <h2 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-tight">RACM Generation Summary</h2>
            </div>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-2">Executive Summary</h3>
              <p className="text-[13px] text-ink-700 leading-relaxed max-w-[80ch]">{executiveSummary}</p>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-2">Overview</h3>
              <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
                <li><span className="font-semibold">Total Risk-Control Entries:</span> {totalRisks}</li>
                <li><span className="font-semibold">Unique Controls:</span> {uniqueControlIds.size}</li>
                <li><span className="font-semibold">Process Areas:</span> {processAreaSet.size}</li>
              </ul>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-3">Extraction Confidence</h3>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Count</th>
                    <th className="py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {confidenceRows.map(c => {
                    const count = confidenceCounts[c.label] ?? 0;
                    const pct = totalRisks > 0 ? (count / totalRisks) * 100 : 0;
                    return (
                      <tr key={c.label} className="border-b border-canvas-border/40 last:border-0">
                        <td className={`py-2.5 font-semibold ${c.tone}`}>{c.label}</td>
                        <td className="py-2.5 tabular-nums text-ink-800">{count}</td>
                        <td className="py-2.5 tabular-nums text-ink-700">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-3">Risk Rating Distribution</h3>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                    <th className="py-2 pr-3">Rating</th>
                    <th className="py-2 pr-3">Count</th>
                    <th className="py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {severityRows.map(s => {
                    const count = severityCounts[s.label] ?? 0;
                    const pct = totalRisks > 0 ? (count / totalRisks) * 100 : 0;
                    return (
                      <tr key={s.label} className="border-b border-canvas-border/40 last:border-0">
                        <td className="py-2.5 text-ink-800">{s.label}</td>
                        <td className="py-2.5 tabular-nums text-ink-800">{count}</td>
                        <td className="py-2.5 tabular-nums text-ink-700">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-3">Control Type Distribution</h3>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Preventive', 'Detective'] as const).map(type => (
                    <tr key={type} className="border-b border-canvas-border/40 last:border-0">
                      <td className="py-2.5 text-ink-800">{type}</td>
                      <td className="py-2.5 tabular-nums text-ink-800">{controlTypeCounts[type] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-3">Process Area Breakdown</h3>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                    <th className="py-2 pr-3">Process Area</th>
                    <th className="py-2 pr-3">Risks</th>
                    <th className="py-2">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {processAreaRows.map(row => (
                    <tr key={row.area} className="border-b border-canvas-border/40 last:border-0">
                      <td className="py-2.5 text-ink-800">{row.area}</td>
                      <td className="py-2.5 tabular-nums text-ink-800">{row.risks}</td>
                      <td className="py-2.5 tabular-nums text-ink-800">{row.controls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-2">Gap Analysis</h3>
              <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
                <li><span className="font-semibold">SoD Coverage:</span> {sodCoverage}</li>
                <li><span className="font-semibold">DOA Matrix:</span> {doaMatrix}</li>
                <li><span className="font-semibold">KPI Coverage:</span> {kpiCoverage}</li>
              </ul>
            </section>

            <section>
              <h3 className="text-[14px] font-bold text-ink-900 mb-2">Notes</h3>
              <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
                {!hasKpiSignal && <li>No Key Performance Indicator (KPI) reporting controls identified</li>}
                {!hasDoaSignal && <li>Delegation of Authority (DOA) matrix not surfaced in any control activity</li>}
                <li>{entriesWithGaps} of {arEntries.length} entries have documented gaps to remediate</li>
              </ul>
            </section>
          </div>
          )}

          {/* ─── Entries table — full Irame columns + search + scroll hint ─── */}
          <div className="bg-white border border-canvas-border rounded-[12px] p-5">
            <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
              <div className="relative shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={entriesQuery}
                  onChange={e => setEntriesQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="pl-9 pr-3 py-2 rounded-[8px] border border-border bg-white text-[12px] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <ColumnsMenu visible={visibleColumns} onToggle={toggleColumn} />
                <span className="text-ink-400">Risk ID &amp; Control ID stay pinned →</span>
                <span className="text-ink-500 tabular-nums">{filteredEntries.length} entries</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full text-[12px]">
                {/* Fix the two frozen anchor lanes to a known width so the 2nd column's
                    sticky offset lines up; the rest stay content-sized. */}
                <colgroup>
                  {shownEntryColumns.map((col, idx) => (
                    <col key={col.key} style={idx < 2 ? { width: AR_ANCHOR_W } : undefined} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                    {shownEntryColumns.map((col, idx) => (
                      <th
                        key={col.key}
                        className={`py-2 font-semibold pr-4 whitespace-nowrap align-bottom ${idx < 2 ? 'bg-white' : ''}`}
                        style={{ ...(col.minW ? { minWidth: col.minW } : {}), ...arStickyStyle(idx, true) }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr><td colSpan={shownEntryColumns.length} className="py-6 text-center text-ink-400 italic">No entries match "{entriesQuery}".</td></tr>
                  ) : pagedEntries.map(e => (
                    <tr key={`${e.riskId}-${e.controlId}`} className="border-b border-canvas-border/40 last:border-0 align-top">
                      {shownEntryColumns.map((col, idx) => (
                        <td
                          key={col.key}
                          className={`py-2.5 pr-4 align-top ${idx < 2 ? 'bg-white' : ''}`}
                          style={{ ...(col.minW ? { minWidth: col.minW } : {}), ...arStickyStyle(idx, false) }}
                        >
                          {renderArCell(e, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination — only shown when there's more than one page worth of entries. */}
            {filteredEntries.length > ENTRIES_PER_PAGE && (
              <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-canvas-border text-[12px]">
                <span className="text-ink-500 tabular-nums">
                  Showing {pageStart + 1}–{pageEnd} of {filteredEntries.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEntriesPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-3 py-1.5 rounded-[6px] border border-canvas-border text-[12px] text-ink-700 hover:bg-paper-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const n = i + 1;
                    // Show first, last, and a 2-page window around the current page.
                    const showAlways = n === 1 || n === totalPages || Math.abs(n - safePage) <= 1;
                    const isEllipsisLeft = n === safePage - 2 && safePage - 2 > 1;
                    const isEllipsisRight = n === safePage + 2 && safePage + 2 < totalPages;
                    if (isEllipsisLeft || isEllipsisRight) {
                      return <span key={`e-${n}`} className="px-1.5 text-ink-400">…</span>;
                    }
                    if (!showAlways) return null;
                    const isActive = n === safePage;
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setEntriesPage(n)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`min-w-[28px] px-2 py-1.5 rounded-[6px] text-[12px] tabular-nums cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-brand-600 text-paper-0'
                            : 'border border-canvas-border text-ink-700 hover:bg-paper-50'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setEntriesPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="px-3 py-1.5 rounded-[6px] border border-canvas-border text-[12px] text-ink-700 hover:bg-paper-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
      <>
      {/* ═══════════════ Simple layout for seed (non-AR) RACMs ═══════════════ */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Risks',     value: totalRisks,             tone: 'text-brand-700' },
          { label: 'Unique Controls', value: uniqueControlIds.size,  tone: 'text-compliant-700' },
          { label: 'Process Areas',   value: processAreaSet.size,    tone: 'text-mitigated-700' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-canvas-border rounded-[12px] p-5 text-center">
            <div className={`text-[34px] font-bold tabular-nums leading-none ${card.tone}`}>{card.value}</div>
            <div className="text-[12px] text-ink-500 mt-1.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Top dashboard: chart left, breakdown table right (mirrors rich) ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <h2 className="text-[13px] font-bold text-ink-900 mb-4">Risk Rating Distribution</h2>
          {totalRisks === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks captured.</p>
          ) : (
            <div className="space-y-2.5">
              {severityRows.map(s => {
                const count = severityCounts[s.label] ?? 0;
                const pct = totalRisks > 0 ? (count / totalRisks) * 100 : 0;
                return (
                  <div key={s.label} className="flex items-center gap-3 text-[12px]">
                    <span className="w-16 shrink-0 text-ink-700">{s.label}</span>
                    <div className="flex-1 h-3 bg-paper-100 rounded-full overflow-hidden">
                      <div className={`h-full ${s.tone}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-ink-700 font-semibold">{count}</span>
                    <span className="w-12 text-right tabular-nums text-ink-500">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <h2 className="text-[13px] font-bold text-ink-900 mb-3">Process Area Breakdown</h2>
          {processAreaRows.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No process area mapped.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                  <th className="py-2 font-semibold">Process Area</th>
                  <th className="py-2 font-semibold text-right">Risks</th>
                  <th className="py-2 font-semibold text-right">Controls</th>
                </tr>
              </thead>
              <tbody>
                {processAreaRows.map(row => (
                  <tr key={row.area} className="border-b border-canvas-border/40 last:border-0">
                    <td className="py-2.5 text-ink-800">{row.area}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-700">{row.risks}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-700">{row.controls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── SOP Analysis Summary — same structure as rich. Every section is now
          derived from the synthesised seed entries (exec summary, confidence,
          control-type, gap analysis, notes). ─── */}
      {showSummary && (
      <div className="bg-white border border-canvas-border rounded-[12px] p-6 space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-400 mb-1">SOP Analysis Summary</div>
          <h2 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-tight">RACM Generation Summary</h2>
        </div>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-2">Executive Summary</h3>
          <p className="text-[13px] leading-relaxed max-w-[80ch] text-ink-700">{executiveSummary}</p>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-2">Overview</h3>
          <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
            <li><span className="font-semibold">Total Risk-Control Entries:</span> {totalRisks}</li>
            <li><span className="font-semibold">Unique Controls:</span> {uniqueControlIds.size}</li>
            <li><span className="font-semibold">Process Areas:</span> {processAreaSet.size}</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-3">Extraction Confidence</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2 pr-3">Count</th>
                <th className="py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {confidenceRows.map(c => {
                const count = confidenceCounts[c.label] ?? 0;
                const pct = confidenceTotal > 0 ? (count / confidenceTotal) * 100 : 0;
                return (
                  <tr key={c.label} className="border-b border-canvas-border/40 last:border-0">
                    <td className={`py-2.5 font-semibold ${c.tone}`}>{c.label}</td>
                    <td className="py-2.5 tabular-nums text-ink-800">{count}</td>
                    <td className="py-2.5 tabular-nums text-ink-700">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-3">Risk Rating Distribution</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                <th className="py-2 pr-3">Rating</th>
                <th className="py-2 pr-3">Count</th>
                <th className="py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {severityRows.map(s => {
                const count = severityCounts[s.label] ?? 0;
                const pct = totalRisks > 0 ? (count / totalRisks) * 100 : 0;
                return (
                  <tr key={s.label} className="border-b border-canvas-border/40 last:border-0">
                    <td className="py-2.5 text-ink-800">{s.label}</td>
                    <td className="py-2.5 tabular-nums text-ink-800">{count}</td>
                    <td className="py-2.5 tabular-nums text-ink-700">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-3">Control Type Distribution</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {(['Preventive', 'Detective'] as const).map(type => (
                <tr key={type} className="border-b border-canvas-border/40 last:border-0">
                  <td className="py-2.5 text-ink-800">{type}</td>
                  <td className="py-2.5 tabular-nums text-ink-800">{controlTypeCounts[type] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-3">Process Area Breakdown</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 font-semibold border-b border-canvas-border">
                <th className="py-2 pr-3">Process Area</th>
                <th className="py-2 pr-3">Risks</th>
                <th className="py-2">Controls</th>
              </tr>
            </thead>
            <tbody>
              {processAreaRows.map(row => (
                <tr key={row.area} className="border-b border-canvas-border/40 last:border-0">
                  <td className="py-2.5 text-ink-800">{row.area}</td>
                  <td className="py-2.5 tabular-nums text-ink-800">{row.risks}</td>
                  <td className="py-2.5 tabular-nums text-ink-800">{row.controls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-2">Gap Analysis</h3>
          <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
            <li><span className="font-semibold">SoD Coverage:</span> {seedSodEnforced} of {seedTotal} controls enforce segregation of duties</li>
            <li><span className="font-semibold">DOA Matrix:</span> Delegation of Authority thresholds mapped for {seedKeyCount} key control{seedKeyCount !== 1 ? 's' : ''}</li>
            <li><span className="font-semibold">KPI Coverage:</span> Monitoring KPIs defined for {seedKpiPct}% of controls</li>
          </ul>
        </section>

        <section>
          <h3 className="text-[14px] font-bold text-ink-900 mb-2">Notes</h3>
          <ul className="text-[13px] text-ink-700 leading-relaxed space-y-1 list-disc pl-5">
            <li>{seedGapCount} of {seedTotal} entries have documented gaps to remediate</li>
            <li>{seedKeyCount} key control{seedKeyCount !== 1 ? 's' : ''} identified across the process</li>
            <li>Test of Design completed for all mapped controls; results recorded per entry</li>
          </ul>
        </section>
      </div>
      )}

      {/* ─── Entries table — full RACM schema (reuses AR_RACM_COLUMNS); every field
          is synthesised for seed RACMs. ─── */}
      <div className="bg-white border border-canvas-border rounded-[12px] p-5">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h2 className="text-[13px] font-bold text-ink-900">Entries</h2>
          <div className="flex items-center gap-3 text-[11px]">
            <ColumnsMenu visible={visibleColumns} onToggle={toggleColumn} />
            <span className="text-ink-500 tabular-nums">{scopedControls.length} entries</span>
          </div>
        </div>
        {scopedControls.length === 0 ? (
          <p className="text-[12px] text-ink-400 italic">No risk–control pairs in this RACM yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-[12px]">
              {/* Fix the two frozen anchor lanes so the 2nd column's sticky offset
                  lines up; the rest stay content-sized. */}
              <colgroup>
                {shownEntryColumns.map((col, idx) => (
                  <col key={col.key} style={idx < 2 ? { width: AR_ANCHOR_W } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                  {shownEntryColumns.map((col, idx) => (
                    <th
                      key={col.key}
                      className={`py-2 font-semibold pr-4 whitespace-nowrap align-bottom ${idx < 2 ? 'bg-white' : ''}`}
                      style={{ ...(col.minW ? { minWidth: col.minW } : {}), ...arStickyStyle(idx, true) }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seedEntryRows.map((row, i) => (
                  <tr key={`${row.riskId}-${row.controlId}-${i}`} className="border-b border-canvas-border/40 last:border-0 align-top">
                    {shownEntryColumns.map((col, idx) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 pr-4 align-top ${idx < 2 ? 'bg-white' : ''}`}
                          style={{ ...(col.minW ? { minWidth: col.minW } : {}), ...arStickyStyle(idx, false) }}
                        >
                          {val === '[NA]' ? (
                            <span className="text-ink-400">[NA]</span>
                          ) : col.kind === 'mono' ? (
                            <span className="font-mono text-[11px] text-ink-600 tabular-nums whitespace-nowrap">{val}</span>
                          ) : col.kind === 'rating' ? (
                            <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center whitespace-nowrap ${
                              val === 'Critical' ? 'bg-risk-50 text-risk-700' :
                              val === 'High'     ? 'bg-high-50 text-high-700' :
                              val === 'Medium'   ? 'bg-mitigated-50 text-mitigated-700' :
                                                   'bg-compliant-50 text-compliant-700'
                            }`}>{val}</span>
                          ) : (
                            <span className="text-ink-700">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <FileText size={13} className="text-ink-500" />
              Source SOP
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.sop ? 1 : 0}</span>
          </div>
          {!rels.sop ? (
            <p className="text-[12px] text-ink-400 italic">Built without an SOP (manual import).</p>
          ) : (
            <div className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug truncate flex-1">{rels.sop.name}</span>
                <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{rels.sop.version}</span>
              </div>
              <span className="text-[11px] text-ink-500 leading-snug">Uploaded by {rels.sop.by} · {rels.sop.at}</span>
            </div>
          )}
        </div>

        {/* Risks / Controls / Workflows cards — commented out. The risk + control
            detail now lives in the full-schema Entries table above (every
            AR_RACM_COLUMNS field, "[NA]" where the SOP extract has no value).
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Risks in this RACM
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.risks.length}</span>
          </div>
          {rels.risks.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks captured.</p>
          ) : (
            <ul className="space-y-2">
              {rels.risks.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[11px] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Shield size={13} className="text-ink-500" />
              Controls in this RACM
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.controls.length}</span>
          </div>
          {rels.controls.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No controls mapped.</p>
          ) : (
            <ul className="space-y-2">
              {rels.controls.map(c => (
                <li key={c.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.isKey && <span className="px-1.5 h-4 rounded-[4px] text-[0.625rem] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
                      </div>
                      <span className="text-[11px] text-ink-500 leading-snug">{c.desc}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <WorkflowIcon size={13} className="text-ink-500" />
              Workflows linked via controls
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.workflows.length}</span>
          </div>
          {rels.workflows.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No workflows linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.workflows.map(w => (
                <li key={w.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[0.8125rem] text-ink-800 font-medium leading-snug truncate flex-1">{w.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{w.runs} runs</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">{w.desc}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        */}
      </div>
      </>
      )}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RacmEntry {
  id: string; name: string; version: string; process: string; framework: string;
  risks: number; controls: number; mappedRisks: number; unmappedRisks: number;
  keyControls: number; workflowCoverage: number; attributesCoverage: number;
  isValidated: boolean; linkedToEngagement: boolean;
  /** false = still in draft review (editable Excel grid); true | undefined = frozen / active */
  isFrozen?: boolean;
  /** Original uploaded file name — used when re-opening the review editor */
  sourceFileName?: string;
}

// ─── RACM Status (lifecycle only) ───────────────────────────────────────────

type RacmTableStatus = 'Draft' | 'In Progress' | 'Active' | 'Locked';

function getRacmTableStatus(racm: RacmEntry): RacmTableStatus {
  if (racm.isFrozen === false) return 'Draft';
  if (racm.linkedToEngagement) return 'Locked';
  if (racm.risks > 0 && racm.unmappedRisks === 0 && racm.mappedRisks >= racm.risks) return 'Active';
  if (racm.risks > 0) return 'In Progress';
  return 'Draft';
}

const STATUS_TONE: Record<RacmTableStatus, Tone> = {
  'Draft':       'draft',
  'In Progress': 'evidence',
  'Active':      'compliant',
  'Locked':      'mitigated',
};

// ─── RACM Readiness (computed, never stored) ────────────────────────────────

type RacmTableReadiness = 'Mapping Incomplete' | 'Workflow Missing' | 'Configuration Pending' | 'Ready';

function getRacmTableReadiness(racm: RacmEntry): RacmTableReadiness {
  if (racm.risks === 0 || racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Mapping Incomplete';
  if (racm.workflowCoverage < 100) return 'Workflow Missing';
  if (racm.attributesCoverage < 100) return 'Configuration Pending';
  return 'Ready';
}

const READINESS_TONE: Record<RacmTableReadiness, Tone> = {
  'Mapping Incomplete':     'high',
  'Workflow Missing':       'mitigated',
  'Configuration Pending':  'evidence',
  'Ready':                  'compliant',
};

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const RACM_SEED_DATA: RacmEntry[] = [
  { id: AR_RACM_ID, name: 'FY26 AR — Accounts Receivable RACM', version: 'v1.0', process: 'O2C', framework: 'IFC/ICOFR, COSO 2013', risks: AR_RACM_ENTRIES.length, controls: new Set(AR_RACM_ENTRIES.map(e => e.controlId)).size, mappedRisks: AR_RACM_ENTRIES.length, unmappedRisks: 0, keyControls: AR_RACM_ENTRIES.filter(e => e.riskRating === 'Critical' || e.riskRating === 'High').length, workflowCoverage: 0, attributesCoverage: 100, isValidated: true, linkedToEngagement: false, sourceFileName: 'SOP_Accounts Receivable.pptx' },
  { id: 'racm-001', name: 'FY26 P2P — Vendor Payment', version: 'v2.1', process: 'P2P', framework: 'SOX ICFR', risks: 9, controls: 24, mappedRisks: 9, unmappedRisks: 0, keyControls: 6, workflowCoverage: 92, attributesCoverage: 88, isValidated: true, linkedToEngagement: true },
  { id: 'racm-002', name: 'FY26 O2C — Revenue & AR', version: 'v2.1', process: 'O2C', framework: 'SOX ICFR', risks: 7, controls: 18, mappedRisks: 6, unmappedRisks: 1, keyControls: 4, workflowCoverage: 78, attributesCoverage: 65, isValidated: false, linkedToEngagement: false },
  { id: 'racm-003', name: 'FY26 R2R — Financial Close', version: 'v2.1', process: 'R2R', framework: 'SOX ICFR', risks: 11, controls: 31, mappedRisks: 10, unmappedRisks: 1, keyControls: 8, workflowCoverage: 85, attributesCoverage: 80, isValidated: true, linkedToEngagement: true },
  { id: 'racm-004', name: 'FY26 S2C — Contract Review', version: 'v1.8', process: 'S2C', framework: 'Internal Policy', risks: 5, controls: 14, mappedRisks: 3, unmappedRisks: 2, keyControls: 2, workflowCoverage: 60, attributesCoverage: 45, isValidated: false, linkedToEngagement: false },
  { id: 'racm-005', name: 'FY26 ITGC — Access & Change', version: 'v2.1', process: 'ITGC', framework: 'ISO 27001', risks: 6, controls: 15, mappedRisks: 6, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: true },
];

// ─── RACM mapping view ───────────────────────────────────────────────────────
// "Open mapping" for any RACM: the full detail matrix (AR_RACM_COLUMNS) with the
// mapping-status columns (Control / Workflow / Mapping) appended on the right,
// wrapped in the mapping chrome (mapped progress, search, filters, readiness).
// Read-only — every risk is shown paired with its control. The rich AR RACM passes
// AR_RACM_ENTRIES; seed RACMs pass their synthesised rows (see synthSeedEntries).
function ArRacmMappingView({ racm, entries, onBack }: { racm: RacmEntry; entries: ArRacmEntry[]; onBack: () => void }) {
  const isMapped = (e: ArRacmEntry) => Boolean(e.controlId && e.controlId.trim());
  const mappedCount = entries.filter(isMapped).length;
  const pct = entries.length ? Math.round((mappedCount / entries.length) * 100) : 0;
  const keyControls = entries.filter(e => e.riskRating === 'Critical' || e.riskRating === 'High').length;
  const todDefined = entries.filter(e => e.todChecksPerformed?.trim()).length;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const filtered = entries.filter(e => {
    if (filter === 'mapped' && !isMapped(e)) return false;
    if (filter === 'unmapped' && isMapped(e)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return Object.values(e).some(v => String(v).toLowerCase().includes(q));
  });

  // Rows-per-page is user-adjustable (default 10); the dropdown lives in the table
  // toolbar so it stays reachable even when a larger page size hides the pager below.
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => { setPage(1); }, [query, filter, perPage]);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const end = Math.min(start + perPage, filtered.length);
  const paged = filtered.slice(start, end);

  // Column show/hide — every key visible by default; Risk ID + Control ID are the
  // frozen anchors and stay always-on (ColumnsMenu never offers them). The displayed
  // AR columns + the fixed-width calc both derive from this set.
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(AR_ALL_KEYS));
  const toggleColumn = (key: string) => setVisibleColumns(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const shownColumns = AR_RACM_COLUMNS.filter(c => visibleColumns.has(c.key as string));
  // Fixed 200px lanes for every shown column, plus the 3 appended mapping columns;
  // the two frozen anchors use the narrower anchor width so their sticky offset lines up.
  const matrixWidth = shownColumns.reduce((w, c) => w + (AR_FROZEN_KEYS.has(c.key as string) ? AR_ANCHOR_W : 200), 0) + 3 * 200;

  const FILTERS = [
    { key: 'all' as const, label: 'All', count: entries.length },
    { key: 'mapped' as const, label: 'Mapped', count: mappedCount },
    { key: 'unmapped' as const, label: 'Unmapped', count: entries.length - mappedCount },
  ];
  // Inline workflow linking from the matrix's Workflow Status cell. Local to this
  // read-only view; keyed by control so a linked workflow shows on every row for it.
  const [linkedWf, setLinkedWf] = useState<Record<string, ControlWorkflow>>({});
  const [linkWfEntry, setLinkWfEntry] = useState<ArRacmEntry | null>(null);
  const linkedWfCount = Object.keys(linkedWf).length;
  const uniqueControlCount = new Set(entries.map(e => e.controlId)).size;

  const readiness: Array<{ ok: boolean; label: string }> = [
    { ok: true, label: `Risks added (${entries.length})` },
    { ok: mappedCount === entries.length, label: `All risks mapped to controls (${mappedCount}/${entries.length})` },
    { ok: keyControls > 0, label: `Key controls identified (${keyControls})` },
    { ok: todDefined === entries.length, label: `Test of Design defined (${todDefined}/${entries.length})` },
    { ok: linkedWfCount > 0, label: `Workflows linked to controls (${linkedWfCount}/${uniqueControlCount})` },
  ];

  return (
    <div className="space-y-5">
      {/* Constant RACM header — identical to the detail page; the button returns to
          the summary instead of opening mapping. */}
      <RacmDetailHeader
        racm={racm}
        action={
          <Button
            variant="primary"
            size="md"
            className="shrink-0"
            leftIcon={<FileText size={13} />}
            onClick={onBack}
          >
            RACM Summary
          </Button>
        }
      />

      {/* View label so it's clear this is the mapping view, not the summary. */}
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[20px] font-[420] tracking-tight text-ink-900">Risk-Control Mapping</h2>
        <span className="text-[12px] text-ink-500">every risk paired with its control, in full RACM detail</span>
      </div>

      {/* Mapped progress */}
      <div className="bg-white border border-canvas-border rounded-[12px] p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[12px] font-semibold text-ink-800"><span className="font-mono tabular-nums">{mappedCount}</span> of <span className="font-mono tabular-nums">{entries.length}</span> risks mapped</span>
          <span className="text-[12px] font-mono tabular-nums text-compliant-700">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-paper-100 overflow-hidden">
          <div className="h-full rounded-full bg-compliant-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Toolbar — search + mapping filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search risks..."
            className="pl-9 pr-3 py-2 rounded-[8px] border border-border bg-white text-[12px] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all" />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                filter === f.key ? 'bg-brand-600 text-paper-0' : 'bg-white border border-canvas-border text-ink-600 hover:bg-paper-50'
              }`}>
              {f.label} <span className="font-mono tabular-nums">· {f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Matrix — the detail table (AR_RACM_COLUMNS) + appended mapping columns */}
      <div className="bg-white border border-canvas-border rounded-[12px] p-5">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <span className="text-[11px] text-ink-400">Risk ID &amp; Control ID stay pinned · scroll right for mapping status →</span>
          <div className="flex items-center gap-3 text-[11px]">
            <ColumnsMenu visible={visibleColumns} onToggle={toggleColumn} />
            <label className="flex items-center gap-1.5 text-ink-500">
              Rows per page
              <select
                value={perPage}
                onChange={e => setPerPage(Number(e.target.value))}
                className="rounded-[6px] border border-canvas-border bg-white pl-2 pr-1 py-1 text-[11px] font-mono tabular-nums text-ink-700 outline-none focus:border-brand-500/50 cursor-pointer transition-colors"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="text-ink-500 tabular-nums">{filtered.length} entries</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {/* Fixed-width columns so every field reads in a uniform lane; the matrix
              stays horizontally scrollable. Risk ID + Control ID are frozen left. Width
              and colgroup track the currently-visible columns + 3 mapping columns. */}
          <table className="text-[12px]" style={{ tableLayout: 'fixed', width: matrixWidth }}>
            <colgroup>
              {shownColumns.map(col => <col key={col.key} style={{ width: AR_FROZEN_KEYS.has(col.key as string) ? AR_ANCHOR_W : 200 }} />)}
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
            </colgroup>
            <thead>
              <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                {shownColumns.map((col, idx) => (
                  <th
                    key={col.key}
                    className={`py-2 font-semibold pr-4 align-bottom ${idx < 2 ? 'bg-white' : ''}`}
                    style={arStickyStyle(idx, true)}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="py-2 font-semibold pr-4 align-bottom border-l border-canvas-border pl-4">Control(s)</th>
                <th className="py-2 font-semibold pr-4 align-bottom">Workflow Status</th>
                <th className="py-2 font-semibold pr-2 align-bottom">Mapping</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={shownColumns.length + 3} className="py-6 text-center text-ink-400 italic">No risks match "{query}".</td></tr>
              ) : paged.map(e => (
                <tr key={`${e.riskId}-${e.controlId}`} className="border-b border-canvas-border/40 last:border-0 align-top">
                  {shownColumns.map((col, idx) => (
                    <td
                      key={col.key}
                      className={`py-2.5 pr-4 align-top overflow-hidden ${idx < 2 ? 'bg-white' : ''}`}
                      style={arStickyStyle(idx, false)}
                    >
                      {renderArCell(e, col)}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 align-top border-l border-canvas-border pl-4">
                    <span className="inline-flex items-center px-2 h-5 rounded bg-paper-100 text-ink-700 text-[10px] font-mono tabular-nums whitespace-nowrap">{e.controlId}</span>
                  </td>
                  <td className="py-2.5 pr-4 align-top whitespace-nowrap">
                    {linkedWf[e.controlId] ? (
                      <button type="button" onClick={() => setLinkWfEntry(e)} title="Change workflow"
                        className="inline-flex items-center gap-1.5 max-w-full group cursor-pointer">
                        <span className="truncate min-w-0 text-[0.6875rem] font-medium text-ink-700 group-hover:text-brand-700">{linkedWf[e.controlId].name}</span>
                        <span className="shrink-0 px-1.5 h-4 rounded-full text-[0.625rem] font-semibold inline-flex items-center bg-compliant-50 text-compliant-700">{linkedWf[e.controlId].status}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => setLinkWfEntry(e)}
                        className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-brand-700 hover:text-brand-500 cursor-pointer">
                        <Link2 size={11} />Link workflow
                      </button>
                    )}
                  </td>
                  <td className="py-2.5 pr-2 align-top">
                    {isMapped(e)
                      ? <span className="px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center bg-compliant-50 text-compliant-700 whitespace-nowrap">Mapped</span>
                      : <span className="px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center bg-high-50 text-high-700 whitespace-nowrap">Unmapped</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > perPage && (
          <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-canvas-border text-[12px]">
            <span className="text-ink-500 tabular-nums">Showing {start + 1}–{end} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-3 py-1.5 rounded-[6px] border border-canvas-border text-[12px] text-ink-700 hover:bg-paper-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Prev</button>
              <span className="tabular-nums text-ink-600">Page {safePage} / {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-[6px] border border-canvas-border text-[12px] text-ink-700 hover:bg-paper-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* RACM Readiness */}
      <div className="bg-white border border-canvas-border rounded-[12px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[13px] font-bold text-ink-900">RACM Readiness</h2>
          {linkedWfCount === 0 && <span className="px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center bg-mitigated-50 text-mitigated-700">Workflow Missing</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {readiness.map(r => (
            <div key={r.label} className="flex items-center gap-2 text-[12px]">
              {r.ok
                ? <Check size={13} className="text-compliant-700 shrink-0" />
                : <AlertTriangle size={13} className="text-mitigated-700 shrink-0" />}
              <span className={r.ok ? 'text-ink-700' : 'text-ink-500'}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inline "Link workflow" drawer, opened from a Workflow Status cell. */}
      <AnimatePresence>
        {linkWfEntry && (() => {
          const lwe = linkWfEntry;
          return (
            <LinkWorkflowToControlDrawer
              control={{
                name: lwe.controlId,
                description: lwe.controlActivity || lwe.controlObjective || '',
                isKey: String(lwe.controlType) === 'Key',
                workflows: linkedWf[lwe.controlId] ? [linkedWf[lwe.controlId]] : [],
              }}
              onClose={() => setLinkWfEntry(null)}
              onLink={(wf) => { setLinkedWf(prev => ({ ...prev, [lwe.controlId]: wf })); setLinkWfEntry(null); }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  processFilter?: string;
  initialMappingRacm?: { id: string; name: string; process: string } | null;
  onMappingOpened?: () => void;
  extraRacms?: RacmEntry[];
  /** Called when user clicks Edit Draft on a draft RACM — opens the Excel editing page */
  onEditDraft?: (racm: RacmEntry) => void;
  /** Called when user clicks "Open in editor" on any RACM — opens the full-page editor route */
  onOpenInEditor?: (racm: RacmEntry) => void;
  /** Optional CTA (e.g. New RACM button) rendered in the same row as the attention banner */
  headerAction?: React.ReactNode;
  /** Called when the user clicks the "New RACM" CTA on the empty state. If omitted, the empty state falls back to the inline "No RACMs found" row. */
  onCreate?: () => void;
  /** Fired with true while a RACM detail/mapping takeover is on screen, so the parent can hide its section-pills chrome and let the RACM header own the top. */
  onTakeoverChange?: (mode: 'detail' | 'mapping' | null) => void;
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms, onEditDraft, onOpenInEditor, headerAction, onCreate, onTakeoverChange }: Props) {
  const { addToast } = useToast();
  const { can } = useCan();
  const logEvent = useAuditLog();
  // Inline RACM rename (pencil action) — renamed names overlay the source data.
  const [editingRacmNameId, setEditingRacmNameId] = useState<string | null>(null);
  const [editingRacmName, setEditingRacmName] = useState('');
  const [renamedNames, setRenamedNames] = useState<Record<string, string>>({});
  const saveRacmName = (id: string, current: string) => {
    const name = editingRacmName.trim();
    if (name && name !== current) {
      setRenamedNames(prev => ({ ...prev, [id]: name }));
      addToast({ message: `RACM renamed to "${name}".`, type: 'success' });
    }
    setEditingRacmNameId(null);
  };
  // Source-SOP preview drawer (opened from a RACM extracted from a SOP).
  const [viewSop, setViewSop] = useState<{
    subProcess: string; title: string; version: string; uploadedAgo: string;
    summary: { controls: number; risks: number; attributes: number; racmName: string };
    controls: { id: string; description: string }[];
  } | null>(null);
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  const allRacms = (() => {
    if (!extraRacms || extraRacms.length === 0) return racmList;
    const extraIds = new Set(extraRacms.map(r => r.id));
    return [...racmList.filter(r => !extraIds.has(r.id)), ...extraRacms];
  })();
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);
  // Local data is ready immediately; only reveal a skeleton if loading genuinely
  // exceeds ~150ms (e.g. a future remote source). For today's local data it never shows.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unfrozenIds, setUnfrozenIds] = useState<string[]>([]);
  // Inline card expansion (risk–control mapping preview) + locally-unmapped pairs.
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [unmappedPairs, setUnmappedPairs] = useState<Set<string>>(new Set());
  // Per-card expanded-panel search query + locally-deleted risk rows.
  const [expandSearch, setExpandSearch] = useState<Record<string, string>>({});
  const [deletedRows, setDeletedRows] = useState<Set<string>>(new Set());
  // Link Risk sidesheet — opened from a RACM's expanded-panel row action. Holds the
  // target RACM + its business-process abbr (scopes the selectable risks). When the
  // user hits "Create Risk", createRiskFromLink swaps in the existing Create Risk drawer.
  const [linkRiskTarget, setLinkRiskTarget] = useState<{ racmId: string; bpAbbr: string } | null>(null);
  const [createRiskFromLink, setCreateRiskFromLink] = useState(false);
  // Risks/controls added locally via the Link sidesheets. Risks are keyed by RACM
  // id (they become new mapping rows); controls are keyed by risk id (they become
  // extra chips on that risk's row).
  const [linkedRisks, setLinkedRisks] = useState<Record<string, { id: string; name: string }[]>>({});
  const [linkedControls, setLinkedControls] = useState<Record<string, { id: string; name: string; isKey: boolean }[]>>({});
  // Link Control sidesheet target (which risk row opened it) + remove-mapping confirm.
  // createControlFromLink swaps in the shared Create Control wizard over the picker.
  const [linkControlTarget, setLinkControlTarget] = useState<{ riskId: string; riskName: string; bpAbbr: string } | null>(null);
  const [createControlFromLink, setCreateControlFromLink] = useState(false);
  const [confirmUnmap, setConfirmUnmap] = useState<{ riskId: string; ctlId: string } | null>(null);
  // Delete-risk confirm (removes the whole risk row from the expanded mapping).
  const [confirmDeleteRisk, setConfirmDeleteRisk] = useState<{ racmId: string; riskId: string; riskName: string } | null>(null);
  // Link Workflow flow: pick a control on the risk (skipped if it has exactly one),
  // then the workflow picker. linkedWorkflows records the result keyed by riskId:ctlId.
  const [linkWfTarget, setLinkWfTarget] = useState<{ riskId: string; riskName: string; controls: { id: string; name: string; isKey: boolean }[] } | null>(null);
  const [linkWfControl, setLinkWfControl] = useState<{ id: string; name: string; isKey: boolean } | null>(null);
  const [linkedWorkflows, setLinkedWorkflows] = useState<Record<string, { id: string; name: string; version: string }>>({});

  const addLinkedWorkflow = (riskId: string, ctlId: string, wf: { id: string; name: string; version: string }) =>
    setLinkedWorkflows(prev => ({ ...prev, [`${riskId}:${ctlId}`]: { id: wf.id, name: wf.name, version: wf.version } }));
  // Description lookup for a control id (Control Library first, then the seed controls).
  const controlDescription = (id: string) => {
    const lib = CONTROL_LIBRARY.find(c => c.id.toUpperCase() === id.toUpperCase());
    if (lib) return lib.description;
    return CONTROLS.find(c => c.id === id)?.desc ?? '';
  };

  const addLinkedRisks = (racmId: string, risks: { id: string; name: string }[]) =>
    setLinkedRisks(prev => {
      const have = new Set((prev[racmId] ?? []).map(r => r.id));
      const added = risks.filter(r => !have.has(r.id));
      return added.length ? { ...prev, [racmId]: [...(prev[racmId] ?? []), ...added] } : prev;
    });
  const addLinkedControls = (riskId: string, controls: { id: string; name: string; isKey: boolean }[]) =>
    setLinkedControls(prev => {
      const have = new Set((prev[riskId] ?? []).map(c => c.id));
      const added = controls.filter(c => !have.has(c.id));
      return added.length ? { ...prev, [riskId]: [...(prev[riskId] ?? []), ...added] } : prev;
    });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [readinessFilter, setReadinessFilter] = useState<string[]>([]);
  const [processColFilter, setProcessColFilter] = useState<string[]>([]);
  const [frameworkFilter, setFrameworkFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailRacmId, setDetailRacmId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('racm');
  });
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // URL sync — ?racm=RACM-001
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('racm');
    if (detailRacmId && current !== detailRacmId) {
      params.set('racm', detailRacmId);
      window.history.pushState({ ...window.history.state, racm: detailRacmId }, '', `?${params.toString()}`);
      // Fire synthetic popstate so the BP-level listener hides the tab pills and
      // extends the breadcrumb with the RACM name.
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (!detailRacmId && current) {
      params.delete('racm');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, racm: null }, '', qs ? `?${qs}` : window.location.pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [detailRacmId]);

  // Tell the parent (BusinessProcesses) when a RACM detail or mapping takeover is on
  // screen, so it can hide its section-pills row and let the RACM header own the top.
  useEffect(() => {
    onTakeoverChange?.(detailRacmId ? 'detail' : (showMappingWorkspace && mappingRacm ? 'mapping' : null));
  }, [detailRacmId, showMappingWorkspace, mappingRacm, onTakeoverChange]);

  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('racm') : null;
      setDetailRacmId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const armSkeleton = setTimeout(() => setShowSkeleton(true), 150);
    setIsLoading(false); // synchronous local data — ready right away
    return () => clearTimeout(armSkeleton);
  }, []);

  useEffect(() => {
    if (initialMappingRacm && !showMappingWorkspace) {
      const found = allRacms.find(r => r.id === initialMappingRacm.id);
      if (found) setMappingRacm(found);
      else setMappingRacm({ id: initialMappingRacm.id, name: initialMappingRacm.name, version: 'v1.0', process: initialMappingRacm.process, framework: 'SOX ICFR', risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0, workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false });
      setShowMappingWorkspace(true);
      onMappingOpened?.();
    }
  }, [initialMappingRacm]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseFiltered = processFilter ? allRacms.filter(r => r.process === processFilter) : allRacms;
  const preColFiltered = baseFiltered.filter(r => !archivedIds.includes(r.id));
  const filtered = preColFiltered
    .filter(r => {
      if (statusFilter.length === 0) return true;
      const s = getRacmTableStatus(r);
      const resolved = s === 'Locked' && unfrozenIds.includes(r.id) ? 'Active' : s;
      return statusFilter.includes(resolved);
    })
    .filter(r => readinessFilter.length === 0 || readinessFilter.includes(getRacmTableReadiness(r)))
    .filter(r => processColFilter.length === 0 || processColFilter.includes(r.process))
    .filter(r => frameworkFilter.length === 0 || frameworkFilter.includes(r.framework))
    .filter(r => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.process.toLowerCase().includes(q) ||
        r.framework.toLowerCase().includes(q)
      );
    });

  const statusOptions = Array.from(new Set(baseFiltered.map(r => {
    const s = getRacmTableStatus(r);
    return s === 'Locked' && unfrozenIds.includes(r.id) ? 'Active' : s;
  }))).sort();
  const readinessOptions = Array.from(new Set(baseFiltered.map(getRacmTableReadiness))).sort();
  const processOptions = Array.from(new Set(baseFiltered.map(r => r.process))).sort();
  const frameworkOptions = Array.from(new Set(baseFiltered.map(r => r.framework))).sort();

  // Keep selected list scoped to currently visible rows
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filtered.some(r => r.id === id)));
  }, [archivedIds, processFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const allVisibleIds = filtered.map(r => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(allVisibleIds);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleCardExpand = (id: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const unmapPair = (riskId: string, controlId: string) => {
    setUnmappedPairs(prev => new Set(prev).add(`${riskId}:${controlId}`));
    logEvent({ action: 'Update', description: `Unmapped control ${controlId} from risk ${riskId}`, module: 'Governance', entity: 'RACM' });
  };
  const deleteRow = (racmId: string, riskId: string) => {
    setDeletedRows(prev => new Set(prev).add(`${racmId}:${riskId}`));
    logEvent({ action: 'Delete', description: `Removed risk ${riskId} from RACM ${racmId}`, module: 'Governance', entity: 'RACM' });
  };
  const handleBulkArchive = () => {
    setArchivedIds(prev => [...prev, ...selectedIds]);
    logEvent({ action: 'Update', description: `Archived ${selectedIds.length} RACM${selectedIds.length === 1 ? '' : 's'}`, module: 'Governance', entity: 'RACM' });
    setSelectedIds([]);
  };
  const handleReopen = (racmId: string) => {
    setUnfrozenIds(prev => prev.includes(racmId) ? prev : [...prev, racmId]);
  };

  // Full workspace redirect (for "Open Full RACM")
  if (showMappingWorkspace && mappingRacm) {
    // Both the rich (AR) RACM and seed RACMs open the same read-only matrix + mapping
    // columns, in full RACM detail. Seed rows are synthesised to match AR's columns.
    // Back returns to the RACM detail it was opened from. Only a genuinely empty RACM
    // (no risk/control pairs) falls back to the interactive start-mapping grid.
    const mr = mappingRacm;
    const mappingEntries: ArRacmEntry[] = mr.id === AR_RACM_ID
      ? AR_RACM_ENTRIES
      : (synthSeedEntries(mr) as unknown as ArRacmEntry[]);
    if (mappingEntries.length > 0) {
      return (
        <ArRacmMappingView
          racm={mr}
          entries={mappingEntries}
          onBack={() => { setShowMappingWorkspace(false); setMappingRacm(null); setDetailRacmId(mr.id); }}
        />
      );
    }
    return (
      <RacmMappingWorkspace
        racmId={mr.id} racmName={mr.name} racmProcess={mr.process}
        isEmpty={mr.risks === 0}
        onBack={() => { setShowMappingWorkspace(false); setMappingRacm(null); }}
      />
    );
  }

  // Detail page takeover when ?racm= is in URL
  const detailRacmFromUrl = detailRacmId ? allRacms.find(r => r.id === detailRacmId) : null;
  if (detailRacmFromUrl) {
    return (
      <RacmDetailPage
        racm={detailRacmFromUrl}
        onBack={() => setDetailRacmId(null)}
        onOpenMapping={() => {
          setMappingRacm(detailRacmFromUrl);
          setShowMappingWorkspace(true);
          setDetailRacmId(null);
        }}
      />
    );
  }

  // List-load error takeover — sits after the detail/mapping takeovers so it only
  // governs the list view. Dormant with local data (loadError never flips true here).
  if (!isLoading && loadError) {
    return <ListLoadError label="RACMs" onRetry={() => setLoadError(false)} />;
  }

  // Archive / cancel a single card.
  const handleArchiveOne = (id: string) => {
    setArchivedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedIds(prev => prev.filter(s => s !== id));
    logEvent({ action: 'Update', description: `Archived RACM ${id}`, module: 'Governance', entity: 'RACM' });
  };
  const handleCancelOne = (id: string) => {
    setSelectedIds(prev => prev.filter(s => s !== id));
  };

  const hasAnyFilter =
    statusFilter.length > 0 ||
    readinessFilter.length > 0 ||
    processColFilter.length > 0 ||
    frameworkFilter.length > 0 ||
    searchQuery.trim().length > 0;

  const clearAll = () => {
    setStatusFilter([]);
    setReadinessFilter([]);
    setProcessColFilter([]);
    setFrameworkFilter([]);
    setSearchQuery('');
  };

  return (
    <div className="space-y-3">
      {/* Toolbar — primary CTA only. */}
      {headerAction && (
        <div className="flex items-center justify-end gap-3 mb-3">
          {headerAction}
        </div>
      )}

      {!isLoading && preColFiltered.length === 0 && onCreate ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
            <Grid3x3 className="w-6 h-6 text-ink-500" />
          </div>
          <h3 className="text-[15px] font-display text-ink-800 mb-1">No RACMs yet</h3>
          <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Build a Risk &amp; Controls Matrix from the SOP or from scratch.</p>
          <Button variant="primary" size="md" onClick={onCreate}>Create RACM</Button>
        </div>
      ) : (
      <div className="space-y-5">
        {/* Filter row — search on the left, dropdown filters + clear on the right. */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search RACMs..."
              className="pl-9 pr-3 py-2 rounded-[8px] border border-border bg-white text-[12px] w-[260px] placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="mr-1 text-[12px] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
            <ColumnFilter variant="button" label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} align="end" />
            <ColumnFilter variant="button" label="Readiness" options={readinessOptions} value={readinessFilter} onChange={setReadinessFilter} align="end" />
            <ColumnFilter variant="button" label="Process" options={processOptions} value={processColFilter} onChange={setProcessColFilter} align="end" />
            <ColumnFilter variant="button" label="Framework" options={frameworkOptions} value={frameworkFilter} onChange={setFrameworkFilter} align="end" />
            {onCreate && (
              <Button
                variant="primary"
                size="md"
                className="shrink-0"
                leftIcon={<Plus size={13} />}
                onClick={onCreate}
              >
                Create new RACM
              </Button>
            )}
          </div>
        </div>

        {/* Bulk-select strip — appears only once the user has selected at least one card. */}
        {!isLoading && selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="Select all visible RACMs"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 cursor-pointer accent-brand-600"
            />
            <span>
              {selectedIds.filter(id => allVisibleIds.includes(id)).length} of {allVisibleIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-2 text-brand-700 hover:text-brand-600 font-medium cursor-pointer"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* RACM Cards — engagement-style list, one card per RACM. Click anywhere to open detail. */}
        <div className="space-y-2 min-h-[calc(100vh-280px)]">
          {isLoading && showSkeleton ? (
            [...Array(5)].map((_, i) => (
              <div key={`skel-${i}`} className="px-6 py-5 rounded-xl border border-border-light bg-white">
                <div className="h-3 bg-paper-100 rounded-[4px] animate-pulse w-2/3 mb-2.5" />
                <div className="h-3 bg-paper-100 rounded-[4px] animate-pulse w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-[12px] text-text-muted rounded-xl border border-border-light bg-white">
              No RACMs match your search or filters.
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-2 text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : filtered.map((racm, i) => {
            const rawStatus = getRacmTableStatus(racm);
            const status: RacmTableStatus = rawStatus === 'Locked' && unfrozenIds.includes(racm.id) ? 'Active' : rawStatus;
            const readiness = getRacmTableReadiness(racm);
            const isSelected = selectedIds.includes(racm.id);
            const versionLabel = racm.version.replace(/^v/i, '');
            const descLine = `${racm.risks} risks · ${racm.controls} controls · v${versionLabel}`;
            // Inline risk–control mapping rows for the expand panel — derived from the
            // process's risks/controls (locally-unmapped pairs removed).
            const cardExpanded = expandedCardIds.has(racm.id);
            const displayName = renamedNames[racm.id] ?? racm.name;
            const isRenaming = editingRacmNameId === racm.id;
            const cardBp = BUSINESS_PROCESSES.find(b => b.abbr === racm.process);
            const cardRiskList = cardBp ? RISKS.filter(r => r.bpId === cardBp.id) : [];
            const cardRiskIds = new Set(cardRiskList.map(r => r.id));
            const cardControlList = CONTROLS.filter(c => cardRiskIds.has(c.riskId));
            // Source SOP this RACM was extracted from (if any) — drives the "View SOP" action.
            const cardSourceSop = SOPS.find(s => s.racmId === racm.id);
            const openSourceSop = () => {
              if (!cardSourceSop) return;
              setViewSop({
                subProcess: racm.process,
                title: cardSourceSop.name,
                version: cardSourceSop.version,
                uploadedAgo: cardSourceSop.at,
                summary: {
                  controls: cardSourceSop.controls,
                  risks: cardSourceSop.risks,
                  attributes: cardSourceSop.controls * 3,
                  racmName: racm.name,
                },
                controls: cardControlList.map(c => ({ id: c.id, description: c.name })),
              });
            };
            // Unified risk rows: this process's seed risks + risks linked via the Link Risk sheet.
            const rowRisks: { id: string; name: string }[] = [
              ...cardRiskList.map(r => ({ id: r.id, name: r.name })),
              ...(linkedRisks[racm.id] ?? []),
            ];
            // Controls per risk: seed controls + controls linked via the Link Control sheet,
            // with any locally-removed (unmapped) pairs filtered out.
            const controlsForRisk = (riskId: string) =>
              [
                ...cardControlList.filter(c => c.riskId === riskId).map(c => ({ id: c.id, name: c.name, isKey: c.isKey })),
                ...(linkedControls[riskId] ?? []),
              ].filter(c => !unmappedPairs.has(`${riskId}:${c.id}`));
            const mappingRows = rowRisks.map(risk => ({ risk, controls: controlsForRisk(risk.id) }));
            const cardSearch = (expandSearch[racm.id] ?? '').trim().toLowerCase();
            const visibleMappingRows = mappingRows.filter(({ risk, controls }) => {
              if (deletedRows.has(`${racm.id}:${risk.id}`)) return false;
              if (!cardSearch) return true;
              return (
                risk.id.toLowerCase().includes(cardSearch) ||
                risk.name.toLowerCase().includes(cardSearch) ||
                controls.some(c => c.id.toLowerCase().includes(cardSearch) || c.name.toLowerCase().includes(cardSearch))
              );
            });

            return (
              <motion.div
                key={racm.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`group rounded-xl border bg-white hover:border-primary/50 hover:shadow-sm transition-all ${
                  isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border-light'
                }`}
              >
                <div
                  className="grid grid-cols-[44px_2.6fr_1fr_1.7fr_104px] gap-5 px-6 py-5 items-start"
                >
                {/* Leading control — the chevron is the ONLY expand trigger (the rest
                    of the card no longer toggles). */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => toggleCardExpand(racm.id)}
                    aria-label={cardExpanded ? `Collapse ${racm.id}` : `Expand ${racm.id}`}
                    aria-expanded={cardExpanded}
                    className="p-0.5 rounded text-ink-400 hover:text-brand-600 cursor-pointer transition-colors"
                  >
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 transition-transform duration-200 ${cardExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>
                </div>

                {/* RACM column — title + status pill + description + meta + tag pills */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={editingRacmName}
                        onChange={e => setEditingRacmName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRacmName(racm.id, displayName); }
                          else if (e.key === 'Escape') { setEditingRacmNameId(null); }
                        }}
                        onBlur={() => saveRacmName(racm.id, displayName)}
                        className="text-[0.9375rem] font-semibold text-ink-900 leading-snug border border-primary/40 rounded-[6px] px-2 py-0.5 outline-none focus:border-primary min-w-[220px]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetailRacmId(racm.id)}
                        className="text-[0.9375rem] font-semibold text-text leading-snug hover:text-brand-700 hover:underline cursor-pointer text-left"
                      >
                        {displayName}
                      </button>
                    )}
                    <Pill tone={STATUS_TONE[status]}>{status}</Pill>
                  </div>
                  <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">
                    {descLine}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                    <span className="font-mono tracking-tight">{racm.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                      {racm.process}
                    </span>
                    <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-medium bg-white text-text-muted border border-border-light">
                      {racm.framework}
                    </span>
                  </div>
                </div>

                {/* Readiness column */}
                <div className="flex flex-col items-start gap-1.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-paper-100 text-ink-700 border border-border-light">
                    {readiness}
                  </span>
                </div>

                {/* Mapping coverage column */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  {racm.mappedRisks === 0 ? (
                    <div className="text-[11px] text-high-700 italic inline-flex items-center gap-1">
                      <AlertTriangle size={11} className="text-high-700" /> Not mapped
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[15px] font-bold tabular-nums leading-none text-text">{racm.mappedRisks}/{racm.risks}</span>
                        <span className="text-[11px] text-text-secondary">risks mapped</span>
                      </div>
                      <div className="text-[11px] text-text-muted">
                        <span className="font-semibold text-text">{racm.keyControls}</span> key controls
                      </div>
                    </>
                  )}
                </div>

                {/* Actions column */}
                <div onClick={e => e.stopPropagation()} className="flex items-start justify-end gap-1">
                  {isSelected ? (
                    <>
                      {can('racm_archive') && (
                      <div className="relative group/archive">
                        <button
                          type="button"
                          onClick={() => handleArchiveOne(racm.id)}
                          aria-label="Archive"
                          className="p-1.5 rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer"
                        >
                          <Archive size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/archive:opacity-100 pointer-events-none transition-opacity z-50">Archive</span>
                      </div>
                      )}
                      <div className="relative group/cancel">
                        <button
                          type="button"
                          onClick={() => handleCancelOne(racm.id)}
                          aria-label="Cancel selection"
                          className="p-1.5 rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/cancel:opacity-100 pointer-events-none transition-opacity z-50">Cancel selection</span>
                      </div>
                    </>
                  ) : isRenaming ? (
                    <>
                      {/* onMouseDown preventDefault keeps the input focused so its onBlur
                          doesn't commit before these click handlers run. */}
                      <div className="relative group/cancel">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => setEditingRacmNameId(null)}
                          aria-label="Cancel rename"
                          className="p-1.5 rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/cancel:opacity-100 pointer-events-none transition-opacity z-50">Cancel</span>
                      </div>
                      <div className="relative group/save">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => saveRacmName(racm.id, displayName)}
                          aria-label="Save name"
                          className="p-1.5 rounded-md bg-brand-600 text-paper-0 hover:bg-brand-500 transition-colors cursor-pointer"
                        >
                          <Check size={14} strokeWidth={2.5} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/save:opacity-100 pointer-events-none transition-opacity z-50">Save</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {cardSourceSop && (
                        <div className="relative group/vsop">
                          <button
                            type="button"
                            onClick={openSourceSop}
                            aria-label="View SOP"
                            className="p-1.5 rounded-md text-text-muted hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/vsop:opacity-100 pointer-events-none transition-opacity z-50">View SOP</span>
                        </div>
                      )}
                      {can('racm_link_risk') && (
                      <div className="relative group/lrisk">
                        <button
                          type="button"
                          onClick={() => setLinkRiskTarget({ racmId: racm.id, bpAbbr: racm.process })}
                          aria-label="Link risk"
                          className="p-1.5 rounded-md text-text-muted hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                        >
                          <AlertTriangle size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/lrisk:opacity-100 pointer-events-none transition-opacity z-50">Link risk</span>
                      </div>
                      )}
                      {can('racm_edit') && (
                      <div className="relative group/edit">
                        <button
                          type="button"
                          onClick={() => { setEditingRacmNameId(racm.id); setEditingRacmName(displayName); }}
                          aria-label="Rename"
                          className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/edit:opacity-100 pointer-events-none transition-opacity z-50">Rename</span>
                      </div>
                      )}
                      {can('racm_archive') && (
                      <div className="relative group/archive">
                        <button
                          type="button"
                          onClick={() => handleArchiveOne(racm.id)}
                          aria-label="Archive"
                          className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/archive:opacity-100 pointer-events-none transition-opacity z-50">Archive</span>
                      </div>
                      )}
                    </>
                  )}
                </div>
                </div>
                <AnimatePresence initial={false}>
                  {cardExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden border-t border-canvas-border bg-canvas/40"
                    >
                      <div className="p-4 space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-[12px] font-bold uppercase tracking-wider text-ink-600">Risk &amp; Control Mapping</h4>
                          <div className="relative w-[260px] shrink-0">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                            <input
                              value={expandSearch[racm.id] ?? ''}
                              onChange={e => setExpandSearch(prev => ({ ...prev, [racm.id]: e.target.value }))}
                              placeholder="Search risks & controls..."
                              className="pl-9 pr-3 py-1.5 rounded-[8px] border border-border bg-white text-[12px] w-full placeholder:text-ink-400 outline-none focus:border-primary/40 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {visibleMappingRows.length === 0 ? (
                            <p className="text-[12px] text-ink-400 italic">{cardSearch ? 'No risks or controls match your search.' : 'No risk–control mappings for this RACM.'}</p>
                          ) : visibleMappingRows.map(({ risk, controls }) => {
                            const mapped = controls.length > 0;
                            return (
                            <div key={risk.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-canvas-border bg-white hover:bg-canvas/50 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" aria-hidden="true" />
                              <span className="font-mono text-[0.6875rem] font-semibold text-brand-700 shrink-0">{risk.id}</span>
                              <span className="text-[0.8125rem] text-ink-800 leading-snug flex-1 min-w-0 truncate">{risk.name}</span>
                              {/* Risk Status */}
                              <span className={`shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${mapped ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{mapped ? 'Mapped' : 'Unmapped'}</span>
                              {/* Control(s) */}
                              <div className="shrink-0 flex items-center gap-1 flex-wrap justify-end max-w-[220px]">
                                {controls.length === 0 ? (
                                  <span className="text-[11px] text-ink-400">—</span>
                                ) : controls.map(ctl => (
                                  <span key={ctl.id} title={ctl.isKey ? `${ctl.name} · Key control` : ctl.name} className="inline-flex items-center gap-1 pl-1.5 pr-0.5 h-[22px] rounded-md bg-brand-50 border border-brand-100 text-[0.6875rem] font-semibold text-brand-700">
                                    <Star size={10} className={`shrink-0 ${ctl.isKey ? 'fill-amber-400 text-amber-500' : 'fill-none text-ink-400'}`} aria-label={ctl.isKey ? 'Key control' : 'Control'} />
                                    <span className="font-mono">{ctl.id}</span>
                                    {can('racm_unmap') && (
                                    <button type="button" onClick={() => setConfirmUnmap({ riskId: risk.id, ctlId: ctl.id })} className="p-0.5 rounded hover:bg-brand-100 text-brand-600 hover:text-brand-800 cursor-pointer transition-colors" aria-label={`Remove ${ctl.id}`}>
                                      <X size={10} />
                                    </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                              {/* Workflow Status */}
                              {(() => {
                                const wf = controls.map(c => linkedWorkflows[`${risk.id}:${c.id}`]).find(Boolean);
                                return wf
                                  ? <span className="shrink-0 w-10 flex justify-center" title={`Workflow: ${wf.name} ${wf.version}`}><Check size={13} className="text-compliant-700" /></span>
                                  : <span className="shrink-0 w-10 text-center text-[11px] text-ink-400" title="Workflow status">—</span>;
                              })()}
                              {/* Mapping */}
                              <span className={`shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${mapped ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{mapped ? 'Mapped' : 'Unmapped'}</span>
                              {/* Row actions — Link Control / Link Workflow / Delete (tooltips on hover).
                                  Link Risk lives on the RACM card's action row (it maps risks to the
                                  whole RACM), not per risk. */}
                              <div className="shrink-0 flex items-center gap-0.5">
                                {can('racm_link_control') && (
                                <div className="relative group/lctrl">
                                  <button type="button" aria-label="Link Control" onClick={() => setLinkControlTarget({ riskId: risk.id, riskName: risk.name, bpAbbr: racm.process })} className="p-1 rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">
                                    <Shield size={13} />
                                  </button>
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/lctrl:opacity-100 pointer-events-none transition-opacity z-50">Link Control</span>
                                </div>
                                )}
                                {/* Link Workflow moved to the Control Library (one per control row).
                                    Commented out here per request — restore this block to bring it back.
                                <div className="relative group/lwf">
                                  <button type="button" aria-label="Link Workflow" onClick={() => { const ctrls = controlsForRisk(risk.id); setLinkWfTarget({ riskId: risk.id, riskName: risk.name, controls: ctrls }); setLinkWfControl(ctrls.length === 1 ? ctrls[0] : null); }} className="p-1 rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">
                                    <WorkflowIcon size={13} />
                                  </button>
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/lwf:opacity-100 pointer-events-none transition-opacity z-50">Link Workflow</span>
                                </div>
                                */}
                                {can('racm_archive') && (
                                <div className="relative group/del">
                                  <button type="button" aria-label="Delete" onClick={() => setConfirmDeleteRisk({ racmId: racm.id, riskId: risk.id, riskName: risk.name })} className="p-1 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-[6px] bg-ink-800 text-paper-0 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/del:opacity-100 pointer-events-none transition-opacity z-50">Delete</span>
                                </div>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Link Risk to RACM sidesheet (opened from an expanded-row action) ── */}
      <AnimatePresence>
        {linkRiskTarget && !createRiskFromLink && (() => {
          const lrt = linkRiskTarget;
          const bpId = BUSINESS_PROCESSES.find(b => b.abbr === lrt.bpAbbr)?.id;
          const alreadyLinkedIds = [
            ...RISKS.filter(r => r.bpId === bpId).map(r => r.id),
            ...(linkedRisks[lrt.racmId] ?? []).map(r => r.id),
          ];
          return (
            <LinkRiskDrawer
              bpAbbr={lrt.bpAbbr}
              alreadyLinkedIds={alreadyLinkedIds}
              onClose={() => setLinkRiskTarget(null)}
              onCreateRisk={() => setCreateRiskFromLink(true)}
              onLink={risks => { addLinkedRisks(lrt.racmId, risks); setLinkRiskTarget(null); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Create Risk drawer — swaps in over the Link Risk sheet, swaps back on close ── */}
      <AnimatePresence>
        {linkRiskTarget && createRiskFromLink && (
          <RiskDrawer
            risk={null}
            defaultProcess={linkRiskTarget.bpAbbr}
            onClose={() => setCreateRiskFromLink(false)}
            onSave={() => setCreateRiskFromLink(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Link Control sidesheet (opened from a risk row's Link Control action) ── */}
      <AnimatePresence>
        {linkControlTarget && !createControlFromLink && (() => {
          const lct = linkControlTarget;
          const alreadyLinkedIds = (linkedControls[lct.riskId] ?? []).map(c => c.id);
          return (
            <LinkControlPickerDrawer
              riskName={lct.riskName}
              alreadyLinkedIds={alreadyLinkedIds}
              onClose={() => setLinkControlTarget(null)}
              onCreateControl={() => setCreateControlFromLink(true)}
              onApply={controls => { addLinkedControls(lct.riskId, controls); setLinkControlTarget(null); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Create Control wizard — swaps in over the Link Control picker. Cancel/X
            returns to the picker; saving links the new control to this risk + closes. ── */}
      <AnimatePresence>
        {linkControlTarget && createControlFromLink && (() => {
          const lct = linkControlTarget;
          return (
            <CreateControlDrawer
              defaultProcess={lct.bpAbbr}
              defaultRiskIds={[lct.riskId]}
              defaultRisk={lct.riskName}
              onClose={() => setCreateControlFromLink(false)}
              onSave={data => {
                const newId = `CTL-${String(Date.now()).slice(-4)}`;
                addLinkedControls(lct.riskId, [{ id: newId, name: data.name, isKey: data.classification === 'Key' }]);
                setCreateControlFromLink(false);
                setLinkControlTarget(null);
              }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Remove-mapping confirmation (unlink a control from a risk) ── */}
      <AnimatePresence>
        {confirmUnmap && (() => {
          const cu = confirmUnmap;
          return (
            <ConfirmUnmapModal
              ctlId={cu.ctlId}
              onCancel={() => setConfirmUnmap(null)}
              onConfirm={() => { unmapPair(cu.riskId, cu.ctlId); setConfirmUnmap(null); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Delete-risk confirmation (remove a risk row from the expanded mapping) ── */}
      <AnimatePresence>
        {confirmDeleteRisk && (() => {
          const dr = confirmDeleteRisk;
          return (
            <ConfirmDeleteRiskModal
              riskId={dr.riskId}
              riskName={dr.riskName}
              onCancel={() => setConfirmDeleteRisk(null)}
              onConfirm={() => { deleteRow(dr.racmId, dr.riskId); setConfirmDeleteRisk(null); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Source SOP preview (opened from a RACM extracted from a SOP) ── */}
      <AnimatePresence>
        {viewSop && (
          <SopDetailDrawer
            subProcess={viewSop.subProcess}
            title={viewSop.title}
            version={viewSop.version}
            uploadedAgo={viewSop.uploadedAgo}
            summary={viewSop.summary}
            controls={viewSop.controls}
            onDownload={() => addToast({ message: `Downloading ${viewSop.title}…`, type: 'info' })}
            onClose={() => setViewSop(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Link Workflow — step 1: choose which control (only when the risk has >1) ── */}
      <AnimatePresence>
        {linkWfTarget && !linkWfControl && (() => {
          const lwt = linkWfTarget;
          return (
            <WorkflowControlChooserDrawer
              riskName={lwt.riskName}
              controls={lwt.controls}
              onPick={ctl => setLinkWfControl(ctl)}
              onClose={() => setLinkWfTarget(null)}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Link Workflow — step 2: the workflow picker for the chosen control ── */}
      <AnimatePresence>
        {linkWfTarget && linkWfControl && (() => {
          const lwt = linkWfTarget;
          const lwc = linkWfControl;
          return (
            <LinkWorkflowToControlDrawer
              control={{ name: lwc.name, description: controlDescription(lwc.id), isKey: lwc.isKey, workflows: [] }}
              onClose={() => { if (lwt.controls.length > 1) setLinkWfControl(null); else { setLinkWfControl(null); setLinkWfTarget(null); } }}
              onLink={(wf: ControlWorkflow) => { addLinkedWorkflow(lwt.riskId, lwc.id, wf); setLinkWfControl(null); setLinkWfTarget(null); }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Link Risk to RACM sidesheet ─────────────────────────────────────────────
// Multi-select picker of the business-process's risks to map onto a RACM. The
// "Create Risk" button beside the search swaps in the shared Create Risk drawer
// (RiskDrawer) — the parent toggles createRiskFromLink to perform the swap.
function LinkRiskDrawer({ bpAbbr, alreadyLinkedIds, onClose, onCreateRisk, onLink }: {
  bpAbbr: string;
  alreadyLinkedIds: string[];
  onClose: () => void;
  onCreateRisk: () => void;
  onLink: (risks: { id: string; name: string }[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // This process's linkable risks, minus whatever is already mapped to the RACM.
  const pool = getLinkableRisks(bpAbbr).filter(r => !alreadyLinkedIds.includes(r.id));
  const q = search.trim().toLowerCase();
  const filtered = q
    ? pool.filter(r => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    : pool;

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const PRIORITY_BADGE: Record<string, string> = {
    Critical: 'bg-risk-50 text-risk-700',
    High: 'bg-high-50 text-high-700',
    Medium: 'bg-amber-50 text-amber-700',
    Low: 'bg-paper-100 text-ink-500',
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col"
        role="dialog" aria-label="Link Risk to RACM">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">Link Risk to RACM</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">Select risks from this business process to map to the RACM.</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        {/* Search + Create Risk */}
        <div className="px-6 py-3 border-b border-canvas-border flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search risks by ID or name..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-canvas-border bg-white text-[13px] placeholder:text-ink-400 outline-none focus:border-brand-500/60 transition-all" />
          </div>
          <Button variant="primary" size="md" className="shrink-0" leftIcon={<Plus size={13} />} onClick={onCreateRisk}>
            Create Risk
          </Button>
        </div>

        {/* Risk list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-ink-400">{q ? 'No risks match your search.' : 'No risks in this business process yet.'}</div>
          ) : filtered.map(r => {
            const checked = selected.has(r.id);
            return (
              <label key={r.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-brand-400 bg-brand-50/40' : 'border-canvas-border bg-white hover:border-brand-200 hover:bg-canvas/50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(r.id)}
                  className="mt-0.5 w-[18px] h-[18px] rounded-[6px] border-canvas-border accent-brand-600 cursor-pointer shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-ink-500">{r.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold uppercase tracking-wide ${PRIORITY_BADGE[r.priority] ?? 'bg-paper-100 text-ink-500'}`}>{r.priority}</span>
                  </div>
                  <div className="text-[0.875rem] font-semibold text-ink-900 leading-snug truncate">{r.name}</div>
                  {r.description && <div className="text-[0.75rem] text-ink-400 leading-snug truncate mt-0.5">{r.description}</div>}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            disabled={selected.size === 0}
            onClick={() => onLink(pool.filter(r => selected.has(r.id)).map(r => ({ id: r.id, name: r.name })))}
          >
            Link Risks{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Link Existing Control sidesheet ─────────────────────────────────────────
// Multi-select picker over the Control Library, scoped to one risk row. "Apply
// Changes" hands the chosen controls back to the parent, which adds them as chips
// on that risk's mapping row.
export function LinkControlPickerDrawer({ riskName, alreadyLinkedIds, onClose, onCreateControl, onApply }: {
  riskName: string;
  alreadyLinkedIds: string[];
  onClose: () => void;
  onCreateControl: () => void;
  onApply: (controls: { id: string; name: string; isKey: boolean }[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [keyFilter, setKeyFilter] = useState<'all' | 'key' | 'non-key'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = CONTROL_LIBRARY.filter(c => !alreadyLinkedIds.includes(c.id.toUpperCase()));
  const q = search.trim().toLowerCase();
  const filtered = available.filter(c => {
    if (keyFilter === 'key' && !c.isKey) return false;
    if (keyFilter === 'non-key' && c.isKey) return false;
    if (q) return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    return true;
  });

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const apply = () =>
    onApply(
      (CONTROL_LIBRARY as MappedControl[])
        .filter(c => selected.has(c.id))
        .map(c => ({ id: c.id.toUpperCase(), name: c.name, isKey: c.isKey })),
    );

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col"
        role="dialog" aria-label="Link Existing Control">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Link2 size={18} className="text-brand-600 shrink-0" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Link Existing Control</h2></div>
            <p className="text-[12px] text-ink-500 mt-0.5">Search the Control Library to map a control to <span className="font-semibold text-ink-700">{riskName}</span>.</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
        </div>

        {/* Search + Create Control + Key filter + selected count */}
        <div className="px-6 py-3 border-b border-canvas-border space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search controls..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-canvas-border bg-white text-[13px] placeholder:text-ink-400 outline-none focus:border-brand-500/60 transition-all" />
            </div>
            <Button variant="primary" size="md" className="shrink-0" leftIcon={<Plus size={13} />} onClick={onCreateControl}>
              Create Control
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-ink-500">Key:</span>
              {(['all', 'key', 'non-key'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKeyFilter(k)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${keyFilter === k ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-500 hover:bg-brand-50'}`}>
                  {k === 'all' ? 'All' : k === 'key' ? 'Key' : 'Non-Key'}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-ink-400">{selected.size} selected</span>
          </div>
        </div>

        {/* Control list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-ink-400">{available.length === 0 ? 'All controls are already linked.' : 'No controls match your search.'}</div>
          ) : filtered.map(c => {
            const checked = selected.has(c.id);
            return (
              <label key={c.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-brand-400 bg-brand-50/40' : 'border-canvas-border bg-white hover:border-brand-200 hover:bg-canvas/50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(c.id)}
                  className="mt-0.5 w-[18px] h-[18px] rounded-[6px] border-canvas-border accent-brand-600 cursor-pointer shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-[13px] font-semibold text-ink-900 leading-snug line-clamp-2">{c.name}</div>
                  {c.isKey && <Star size={11} className="fill-amber-400 text-amber-500" aria-label="Key control" />}
                  <p className="text-[11px] text-ink-400 leading-snug line-clamp-2">{c.description}</p>
                  <div className="flex items-center gap-2.5 text-[10px]">
                    <span className={`px-1.5 h-4 rounded font-bold inline-flex items-center ${AUTO_CLS[c.automation] ?? 'bg-gray-100 text-gray-700'}`}>{c.automation}</span>
                    <span className="text-ink-400">{c.workflowLinked ? c.workflowName : 'No workflow'}</span>
                    <span className="font-mono text-ink-400">{c.id.toUpperCase()}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" disabled={selected.size === 0} onClick={apply}>
            Apply Changes{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Remove-mapping confirmation ─────────────────────────────────────────────
// Guards unlinking a control from a risk in the expanded mapping.
function ConfirmUnmapModal({ ctlId, onCancel, onConfirm }: {
  ctlId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={onCancel}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[400px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-risk-50"><AlertTriangle size={18} className="text-risk-700" /></div>
          <h2 className="text-[17px] font-bold text-ink-900">Remove control mapping?</h2>
        </div>
        <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-5">
          This unlinks <span className="font-mono font-semibold text-ink-700">{ctlId}</span> from this risk. It stays in the Control Library, so you can re-link it anytime from <span className="font-medium text-ink-700">Link Control</span>.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="md" onClick={onConfirm}>Remove</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete-risk confirmation ────────────────────────────────────────────────
// Guards removing a whole risk row from the expanded RACM mapping.
function ConfirmDeleteRiskModal({ riskId, riskName, onCancel, onConfirm }: {
  riskId: string;
  riskName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={onCancel}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.18 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[400px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-risk-50"><AlertTriangle size={18} className="text-risk-700" /></div>
          <h2 className="text-[17px] font-bold text-ink-900">Delete this risk?</h2>
        </div>
        <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-5">
          This removes <span className="font-mono font-semibold text-ink-700">{riskId}</span> <span className="text-ink-700">{riskName}</span> and its control mappings from this RACM. This can't be undone here.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="md" onClick={onConfirm}>Delete</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Link Workflow — control chooser ─────────────────────────────────────────
// Workflows attach to a control, but the Link Workflow action sits on a risk row.
// When the risk has more than one control, this step asks which one; it's skipped
// upstream when there's exactly one control, and shows an empty state when none.
function WorkflowControlChooserDrawer({ riskName, controls, onPick, onClose }: {
  riskName: string;
  controls: { id: string; name: string; isKey: boolean }[];
  onPick: (ctl: { id: string; name: string; isKey: boolean }) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col"
        role="dialog" aria-label="Choose a control">

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><WorkflowIcon size={18} className="text-brand-600 shrink-0" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Link Workflow</h2></div>
            <p className="text-[12px] text-ink-500 mt-0.5">Choose which control on <span className="font-semibold text-ink-700">{riskName}</span> to link a workflow to.</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {controls.length === 0 ? (
            <div className="text-center py-10">
              <Shield size={26} className="mx-auto text-ink-300 mb-2" />
              <p className="text-[13px] font-semibold text-ink-600 mb-1">No controls on this risk yet</p>
              <p className="text-[11px] text-ink-400">Link a control first, then attach a workflow to it.</p>
            </div>
          ) : controls.map(ctl => (
            <button key={ctl.id} type="button" onClick={() => onPick(ctl)}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-canvas-border bg-white hover:border-brand-200 hover:bg-canvas/50 transition-all cursor-pointer text-left">
              <Star size={12} className={`shrink-0 ${ctl.isKey ? 'fill-amber-400 text-amber-500' : 'fill-none text-ink-400'}`} aria-label={ctl.isKey ? 'Key control' : 'Control'} />
              <span className="font-mono text-[11px] text-brand-700 font-semibold shrink-0">{ctl.id}</span>
              <span className="text-[0.8125rem] text-ink-800 leading-snug flex-1 min-w-0 truncate">{ctl.name}</span>
              <ChevronRight size={14} className="shrink-0 text-ink-400" />
            </button>
          ))}
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
          <button type="button" onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-paper-50 transition-colors cursor-pointer">Cancel</button>
        </footer>
      </motion.aside>
    </>
  );
}
