import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle, Check, Grid3x3,
  Archive, ArrowLeft, ArrowRight, Shield, Workflow as WorkflowIcon, FileText,
  Search, Play, Trash2, X,
} from 'lucide-react';
import RacmMappingWorkspace from './RacmMappingWorkspace';
import ColumnFilter from '../shared/ColumnFilter';
import { BUSINESS_PROCESSES, RISKS, CONTROLS, WORKFLOWS, SOPS } from '../../data/mockData';
import { AR_RACM_ENTRIES, AR_RACM_ID, type ArRacmEntry } from '../../data/arRacm';

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
            <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${STATUS_BADGE[rawStatus]}`}>{rawStatus}</span>
            <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${READINESS_BADGE[readiness]}`}>{readiness}</span>
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
  }

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
  const executiveSummary = isRichRacm
    ? `The recent RACM analysis, encompassing ${uniqueControlIds.size} unique controls predominantly within the ${execTopArea} process, indicates that most identified risks are medium (${execPctMedium}%), with a notable ${execPctHigh}% classified as high. Control coverage leans slightly towards ${execDetective > execPreventive ? 'detective' : 'preventive'} measures, with ${execDetective} detective controls compared to ${execPreventive} preventive. While Segregation of Duties and Delegation of Authority are ${sodCoverage === 'Complete' ? 'adequately addressed' : 'partially addressed'}, a significant gap was identified in Key Performance Indicator (KPI) coverage, as ${hasKpiSignal ? 'few' : 'no'} controls for KPI reporting were present.`
    : '';

  // Entries-table search — functional filter on risk id / control id / description / sub-process.
  const [entriesQuery, setEntriesQuery] = useState('');
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
          <button
            type="button"
            onClick={onOpenMapping}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
          >
            Open mapping<ArrowRight size={13} />
          </button>
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
                <span className="text-ink-400">Scroll right for more columns →</span>
                <span className="text-ink-500 tabular-nums">{filteredEntries.length} entries</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                    {AR_RACM_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="py-2 font-semibold pr-4 whitespace-nowrap align-bottom"
                        style={col.minW ? { minWidth: col.minW } : undefined}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr><td colSpan={AR_RACM_COLUMNS.length} className="py-6 text-center text-ink-400 italic">No entries match "{entriesQuery}".</td></tr>
                  ) : pagedEntries.map(e => (
                    <tr key={`${e.riskId}-${e.controlId}`} className="border-b border-canvas-border/40 last:border-0 align-top">
                      {AR_RACM_COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className="py-2.5 pr-4 align-top"
                          style={col.minW ? { minWidth: col.minW } : undefined}
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

      <div className="bg-white border border-canvas-border rounded-[12px] p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[13px] font-bold text-ink-900">Entries</h2>
          <span className="text-[11px] text-ink-500 tabular-nums">
            {scopedControls.length} entries
          </span>
        </div>
        {scopedControls.length === 0 ? (
          <p className="text-[12px] text-ink-400 italic">No risk–control pairs in this RACM yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                  <th className="py-2 font-semibold pr-3">Risk ID</th>
                  <th className="py-2 font-semibold pr-3">Control ID</th>
                  <th className="py-2 font-semibold pr-3">Process Area</th>
                  <th className="py-2 font-semibold pr-3">Risk Description</th>
                  <th className="py-2 font-semibold pr-3">Rating</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {scopedControls.map(c => {
                  const risk = scopedRisks.find(r => r.id === c.riskId);
                  return (
                    <tr key={c.id} className="border-b border-canvas-border/40 last:border-0 align-top">
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-ink-600 tabular-nums">{c.riskId}</td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-ink-600 tabular-nums">{c.id}</td>
                      <td className="py-2.5 pr-3 text-ink-700">{bp?.name ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-ink-800 max-w-[360px]">{risk?.name ?? '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center capitalize ${
                          risk?.severity === 'critical' ? 'bg-risk-50 text-risk-700' :
                          risk?.severity === 'high'     ? 'bg-high-50 text-high-700' :
                          risk?.severity === 'medium'   ? 'bg-mitigated-50 text-mitigated-700' :
                          risk?.severity === 'low'      ? 'bg-compliant-50 text-compliant-700' :
                                                          'bg-paper-100 text-ink-600'
                        }`}>{risk?.severity ?? '—'}</span>
                      </td>
                      <td className="py-2.5 text-ink-700 capitalize">{risk?.status ?? '—'}</td>
                    </tr>
                  );
                })}
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
                <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{rels.sop.name}</span>
                <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{rels.sop.version}</span>
              </div>
              <span className="text-[11px] text-ink-500 leading-snug">Uploaded by {rels.sop.by} · {rels.sop.at}</span>
            </div>
          )}
        </div>

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
                      <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{r.name}</span>
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
                        <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.isKey && <span className="px-1.5 h-4 rounded-[4px] text-[9px] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
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
                    <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{w.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{w.runs} runs</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">{w.desc}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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

const STATUS_BADGE: Record<RacmTableStatus, string> = {
  'Draft':       'bg-paper-100 text-ink-600 border-paper-200/50',
  'In Progress': 'bg-evidence-50 text-evidence-700 border-evidence-200/50',
  'Active':      'bg-compliant-50 text-compliant-700 border-compliant-700/20',
  'Locked':      'bg-mitigated-50 text-mitigated-700 border-mitigated-700/20',
};

// ─── RACM Readiness (computed, never stored) ────────────────────────────────

type RacmTableReadiness = 'Mapping Incomplete' | 'Workflow Missing' | 'Configuration Pending' | 'Ready';

function getRacmTableReadiness(racm: RacmEntry): RacmTableReadiness {
  if (racm.risks === 0 || racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Mapping Incomplete';
  if (racm.workflowCoverage < 100) return 'Workflow Missing';
  if (racm.attributesCoverage < 100) return 'Configuration Pending';
  return 'Ready';
}

const READINESS_BADGE: Record<RacmTableReadiness, string> = {
  'Mapping Incomplete':     'bg-high-50 text-high-700',
  'Workflow Missing':       'bg-mitigated-50 text-mitigated-700',
  'Configuration Pending':  'bg-evidence-50 text-evidence-700',
  'Ready':                  'bg-compliant-50 text-compliant-700',
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

// ─── AR RACM mapping view ────────────────────────────────────────────────────
// "Open mapping" for the rich RACM: the full detail matrix (AR_RACM_COLUMNS) with
// the mapping-status columns (Control / Workflow / Mapping) appended on the right,
// wrapped in the mapping chrome (mapped progress, search, filters, readiness).
// Read-only — every AR risk is already paired with its control in the extract, so
// there's nothing to link. Seed RACMs keep the interactive RacmMappingWorkspace.
function ArRacmMappingView({ racm, onBack }: { racm: RacmEntry; onBack: () => void }) {
  const entries = AR_RACM_ENTRIES;
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

  const FILTERS = [
    { key: 'all' as const, label: 'All', count: entries.length },
    { key: 'mapped' as const, label: 'Mapped', count: mappedCount },
    { key: 'unmapped' as const, label: 'Unmapped', count: entries.length - mappedCount },
  ];
  const readiness: Array<{ ok: boolean; label: string }> = [
    { ok: true, label: `Risks added (${entries.length})` },
    { ok: mappedCount === entries.length, label: `All risks mapped to controls (${mappedCount}/${entries.length})` },
    { ok: keyControls > 0, label: `Key controls identified (${keyControls})` },
    { ok: todDefined === entries.length, label: `Test of Design defined (${todDefined}/${entries.length})` },
    { ok: false, label: 'Workflows linked to controls' },
  ];

  return (
    <div className="space-y-5">
      {/* Constant RACM header — identical to the detail page; the button returns to
          the summary instead of opening mapping. */}
      <RacmDetailHeader
        racm={racm}
        action={
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <FileText size={13} />RACM Summary
          </button>
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
          <span className="text-[11px] text-ink-400">Full RACM detail · scroll right for mapping status →</span>
          <div className="flex items-center gap-3 text-[11px]">
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
          {/* Fixed 200px columns so every field reads in a uniform lane; the matrix
              stays horizontally scrollable. */}
          <table className="text-[12px]" style={{ tableLayout: 'fixed', width: (AR_RACM_COLUMNS.length + 3) * 200 }}>
            <colgroup>
              {AR_RACM_COLUMNS.map(col => <col key={col.key} style={{ width: 200 }} />)}
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
            </colgroup>
            <thead>
              <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wider border-b border-canvas-border">
                {AR_RACM_COLUMNS.map(col => (
                  <th key={col.key} className="py-2 font-semibold pr-4 align-bottom">{col.label}</th>
                ))}
                <th className="py-2 font-semibold pr-4 align-bottom border-l border-canvas-border pl-4">Control(s)</th>
                <th className="py-2 font-semibold pr-4 align-bottom">Workflow Status</th>
                <th className="py-2 font-semibold pr-2 align-bottom">Mapping</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={AR_RACM_COLUMNS.length + 3} className="py-6 text-center text-ink-400 italic">No risks match "{query}".</td></tr>
              ) : paged.map(e => (
                <tr key={`${e.riskId}-${e.controlId}`} className="border-b border-canvas-border/40 last:border-0 align-top">
                  {AR_RACM_COLUMNS.map(col => (
                    <td key={col.key} className="py-2.5 pr-4 align-top overflow-hidden">{renderArCell(e, col)}</td>
                  ))}
                  <td className="py-2.5 pr-4 align-top border-l border-canvas-border pl-4">
                    <span className="inline-flex items-center px-2 h-5 rounded bg-paper-100 text-ink-700 text-[10px] font-mono tabular-nums whitespace-nowrap">{e.controlId}</span>
                  </td>
                  <td className="py-2.5 pr-4 align-top whitespace-nowrap"><span className="text-ink-300">— not linked</span></td>
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
          <span className="px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center bg-mitigated-50 text-mitigated-700">Workflow Missing</span>
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
  onTakeoverChange?: (active: boolean) => void;
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms, onEditDraft, onOpenInEditor, headerAction, onCreate, onTakeoverChange }: Props) {
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  const allRacms = (() => {
    if (!extraRacms || extraRacms.length === 0) return racmList;
    const extraIds = new Set(extraRacms.map(r => r.id));
    return [...racmList.filter(r => !extraIds.has(r.id)), ...extraRacms];
  })();
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unfrozenIds, setUnfrozenIds] = useState<string[]>([]);
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
    onTakeoverChange?.(!!detailRacmId || (showMappingWorkspace && !!mappingRacm));
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
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
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
  const handleBulkArchive = () => {
    setArchivedIds(prev => [...prev, ...selectedIds]);
    setSelectedIds([]);
  };
  const handleReopen = (racmId: string) => {
    setUnfrozenIds(prev => prev.includes(racmId) ? prev : [...prev, racmId]);
  };

  // Full workspace redirect (for "Open Full RACM")
  if (showMappingWorkspace && mappingRacm) {
    // The rich (AR) RACM opens the full matrix + mapping columns; seed RACMs keep the
    // interactive mapping grid. Back returns to the RACM detail it was opened from.
    if (mappingRacm.id === AR_RACM_ID) {
      const arRacm = mappingRacm;
      return (
        <ArRacmMappingView
          racm={arRacm}
          onBack={() => { setShowMappingWorkspace(false); setMappingRacm(null); setDetailRacmId(arRacm.id); }}
        />
      );
    }
    return (
      <RacmMappingWorkspace
        racmId={mappingRacm.id} racmName={mappingRacm.name} racmProcess={mappingRacm.process}
        isEmpty={mappingRacm.risks === 0}
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

  // Archive / cancel a single card.
  const handleArchiveOne = (id: string) => {
    setArchivedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedIds(prev => prev.filter(s => s !== id));
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
          <button type="button" onClick={onCreate} className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">New RACM</button>
        </div>
      ) : (
      <div className="space-y-3">
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
          {isLoading ? (
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
            const descLine = `${racm.risks} risks · ${racm.controls} controls · v${versionLabel} · framework ${racm.framework}`;

            return (
              <motion.div
                key={racm.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setDetailRacmId(racm.id)}
                className={`grid grid-cols-[28px_2.6fr_1fr_1.7fr_80px] gap-5 px-6 py-5 rounded-xl border bg-white hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer items-start ${
                  isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border-light'
                }`}
              >
                {/* Select column */}
                <div onClick={e => e.stopPropagation()} className="pt-0.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${racm.id}`}
                    checked={isSelected}
                    onChange={() => toggleSelectOne(racm.id)}
                    className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 cursor-pointer accent-brand-600"
                  />
                </div>

                {/* RACM column — title + status pill + description + meta + tag pills */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14.5px] font-semibold text-text leading-snug">{racm.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[status]}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                      {status}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">
                    {descLine}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                    <span className="font-mono tracking-tight">{racm.id}</span>
                    <span className="text-border">·</span>
                    <span>{racm.process}</span>
                    <span className="text-border">·</span>
                    <span>{racm.framework}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                      {racm.process}
                    </span>
                    <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-medium bg-white text-text-muted border border-border-light">
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
                      <button
                        type="button"
                        onClick={() => handleArchiveOne(racm.id)}
                        title="Archive"
                        className="p-1.5 rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelOne(racm.id)}
                        title="Cancel selection"
                        className="p-1.5 rounded-md text-text-muted hover:text-ink-800 hover:bg-paper-100 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDetailRacmId(racm.id)}
                        title="Open RACM"
                        className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveOne(racm.id)}
                        title="Archive"
                        className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
