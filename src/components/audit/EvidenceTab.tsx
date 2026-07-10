/**
 * Evidence Tab — auditor's per-control evidence workspace, restructured
 * around the audit-correct hierarchy:
 *
 *   Control
 *     ├── 1. Population (control level — one upload)
 *     ├── 2. Sampling   (control level — Random / Statistical / Column-filter / Workflow)
 *     ├── 3. Validation workflows (control level — empty state has CTA to build one in chat)
 *     └── Attributes
 *           ├── SAMPLE_BASED  → loops over the shared sample set
 *           │                   (per-sample evidence + Pass/Fail + retry rounds)
 *           └── GENERIC       → single control-level evidence + Pass/Fail
 *                               (replace-and-retry if it fails)
 *
 * One sample set is shared by every SAMPLE_BASED attribute on the control.
 * Generic attributes do not consume samples.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen, FileText, Upload, Sparkles, CheckCircle2, XCircle,
  Clock, ChevronRight, ChevronDown, X, Plus, AlertTriangle, Filter, Search,
  Eye, Activity, BookText, Download, RefreshCw, Layers, Shield, ListChecks, User,
  Database, Shuffle, Settings2, Workflow as WorkflowIcon, Wand2, RotateCcw,
  Check, Lock, Paperclip, MessageSquare,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { useCan } from '../../context/CurrentUserContext';
import type { Engagement } from '../../data/engagements';
import { racmRowsForProcess, attrCode, type RACMRow, type ControlAttribute } from '../../data/racm';
import { CURRENT_USER } from '../../data/grc-domain';
import { useEngagementWorkspace } from './engagementWorkspace';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  engagement: Engagement;
  /** Hand off a seed prompt to the AI Concierge workflow builder (chat). */
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
  /** When set (from Controls → "Test evidence"), auto-open this control at Attribute Testing. */
  openControlId?: string | null;
  /** Called once the openControlId has been consumed, so the parent can clear it. */
  onOpened?: () => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AiVerdict = 'Pass' | 'Fail' | 'Hold';
type HumanVerdict = 'Pass' | 'Fail' | 'Hold';
type Verdict = AiVerdict | null;
type SampleMethod = 'Random' | 'Statistical' | 'Column-filter' | 'Workflow';
type StatusFilter = 'All' | 'Complete' | 'In progress' | 'Not started';
type GroupBy = 'none' | 'subProcess';
type ControlStatus = 'Not started' | 'In progress' | 'Validated' | 'Working paper ready';
type Operator = '=' | '>' | '<' | 'contains';

interface PopulationState { rows: number; filename: string; uploadedAgo: string }
interface EvidenceFile { filename: string; size: string }
interface ColumnFilter { id: string; column: string; operator: Operator; value: string }
interface SamplingConfig {
  method: SampleMethod;
  sampleSize: number;
  filterDescription?: string;
  filters?: ColumnFilter[];
  /** When method = Workflow, the user-built workflow handle. */
  workflowName?: string;
}
interface ValidationWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'ERROR';
}
interface AttrVerdict {
  aiVerdict: AiVerdict | null;
  aiConfidence: number;
  aiRationale: string;
  useAi: boolean;
  humanVerdict: HumanVerdict;
  humanRemark: string;
}
interface GeneratedSample {
  id: string;
  description: string;
  /** evidence[attrId][evidenceType] = file or null */
  evidence: Record<string, Record<string, EvidenceFile | null>>;
  /** verdict per attribute */
  verdicts: Record<string, AttrVerdict>;
}
interface GenericResult {
  evidence: Record<string, EvidenceFile | null>;
  aiVerdict: AiVerdict | null;
  aiConfidence: number;
  aiRationale: string;
  useAi: boolean;
  humanVerdict: HumanVerdict;
  humanRemark: string;
}
interface DistinctControl {
  controlId: string;
  description: string;
  subProcess: string;
  isKey: boolean;
  attributes: ControlAttribute[];
}
interface AttributeRound {
  roundNumber: number;
  sampleIds: string[];
  startedAt: number;
  closedAt: number | null;
  passCount: number;
  failCount: number;
}
interface AuditEvent {
  id: string; timestamp: number; relTime: string;
  actor: 'human' | 'ai' | 'system'; actorName: string;
  icon: 'upload' | 'sparkles' | 'check' | 'override' | 'download' | 'gear';
  type: string; text: string;
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function attrScope(attr: ControlAttribute): 'SAMPLE_BASED' | 'GENERIC' {
  return attr.scope ?? 'SAMPLE_BASED';
}
function mockFilename(et: string, sampleId: string): string {
  const slug = et.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  const num = (hash(`${et}|${sampleId}`) % 9000) + 1000;
  const ext = slug.includes('email') ? 'eml'
    : slug.includes('log') || slug.includes('export') || slug.includes('sheet') ? 'xlsx'
      : slug.includes('photo') || slug.includes('screenshot') ? 'png' : 'pdf';
  return `${slug}_${num}.${ext}`;
}
function mockFileSize(seed: string): string {
  const kb = Math.floor(rng(`size-${seed}`)() * 1800) + 80;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diff / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

const PASS_RATIONALES = ['All evidence files present and consistent with policy', 'Approval trail intact', 'Match within tolerance', 'Dual sign-off captured'];
const FAIL_RATIONALES = ['Sample missing approval signature', 'Amount exceeds tolerance vs PO', 'Vendor mismatch vs master', 'Approval timestamp out of sequence'];
const HOLD_RATIONALES = ['Evidence legibility low — manual confirmation needed', 'Filename suggests duplicate'];

/**
 * Pre-built validation workflows available in the demo library. In production
 * these would be drawn from the org's workflow registry; here we hard-code
 * a small representative set so the per-attribute picker has options.
 */
const AVAILABLE_VALIDATION_WORKFLOWS: ValidationWorkflow[] = [
  { id: 'vw-ocr-signature',     name: 'OCR + Signature Detect',        description: 'Detects handwritten or digital signatures on uploaded PDFs and verifies presence against a reference.', status: 'ACTIVE' },
  { id: 'vw-amount-tolerance',  name: 'Amount Tolerance Check',        description: 'Validates invoice amount matches PO within configured tolerance band.', status: 'ACTIVE' },
  { id: 'vw-kyc-cross-ref',     name: 'KYC Cross-Reference',           description: 'Extracts PAN/GST from uploaded docs and cross-references against ERP vendor master.', status: 'ACTIVE' },
  { id: 'vw-erp-log-parse',     name: 'ERP Audit Log Parser',          description: 'Parses ERP audit-log screenshots; extracts approver IDs, timestamps, and segregation-of-duties checks.', status: 'ACTIVE' },
  { id: 'vw-sanctions-screen',  name: 'Sanctions Screening Validator', description: 'Verifies a fresh sanctions screening was run within the required window before vendor activation.', status: 'ACTIVE' },
  { id: 'vw-three-way-match',   name: 'Three-Way Match Validator',     description: 'Cross-references PO, GRN, and invoice line items; flags mismatches and tolerances.', status: 'ACTIVE' },
  { id: 'vw-policy-attest',     name: 'Policy Attestation Validator',  description: 'Checks signature, date, and signatory role on policy attestation cover sheets.', status: 'ACTIVE' },
];

function deterministicAiVerdict(seed: string): { v: AiVerdict; confidence: number; rationale: string } {
  const r = rng(`ai-${seed}`);
  const roll = r();
  let v: AiVerdict; let pool: string[];
  if (roll < 0.75) { v = 'Pass'; pool = PASS_RATIONALES; }
  else if (roll < 0.95) { v = 'Fail'; pool = FAIL_RATIONALES; }
  else { v = 'Hold'; pool = HOLD_RATIONALES; }
  return { v, confidence: 65 + Math.floor(r() * 33), rationale: pool[Math.floor(r() * pool.length)] ?? pool[0]! };
}

function buildControlGroups(rows: RACMRow[]): Map<string, DistinctControl[]> {
  const byProcess = new Map<string, Map<string, DistinctControl>>();
  rows.forEach(r => {
    if (!byProcess.has(r.subProcess)) byProcess.set(r.subProcess, new Map());
    const ctrlMap = byProcess.get(r.subProcess)!;
    const existing = ctrlMap.get(r.controlId);
    if (!existing) {
      ctrlMap.set(r.controlId, {
        controlId: r.controlId, description: r.controlDescription, subProcess: r.subProcess,
        isKey: r.isKey, attributes: [...r.attributes],
      });
    } else {
      r.attributes.forEach(a => { if (!existing.attributes.some(x => x.id === a.id)) existing.attributes.push(a); });
    }
  });
  const out = new Map<string, DistinctControl[]>();
  byProcess.forEach((m, sp) => out.set(sp, Array.from(m.values())));
  return out;
}

function buildBlankAttrVerdict(): AttrVerdict {
  return { aiVerdict: null, aiConfidence: 0, aiRationale: '', useAi: true, humanVerdict: 'Pass', humanRemark: '' };
}

// ─── Deterministic demo seed (control-level) ─────────────────────────────────

interface SeedBundle {
  populations: Record<string, PopulationState>;
  samples: Record<string, GeneratedSample[]>;
  sampling: Record<string, SamplingConfig>;
  trails: Record<string, AuditEvent[]>;
  genericResults: Record<string, Record<string, GenericResult>>;
}

function seedFor(controls: DistinctControl[]): SeedBundle {
  const populations: Record<string, PopulationState> = {};
  const samples: Record<string, GeneratedSample[]> = {};
  const sampling: Record<string, SamplingConfig> = {};
  const trails: Record<string, AuditEvent[]> = {};
  const genericResults: Record<string, Record<string, GenericResult>> = {};

  controls.forEach(ctrl => {
    const r = rng(`ctrl-${ctrl.controlId}`);
    const roll = r();
    const bucket = roll < 0.30 ? 'done' : roll < 0.70 ? 'partial' : roll < 0.85 ? 'pop' : 'empty';
    const trail: AuditEvent[] = [];
    let t = Date.now() - Math.floor(r() * 4 + 1) * 86_400_000;
    const push = (e: Omit<AuditEvent, 'timestamp' | 'relTime'>) => {
      t += Math.floor(rng(`t-${e.id}`)() * 1800_000) + 60_000;
      trail.push({ ...e, timestamp: t, relTime: relTime(t) });
    };
    if (bucket === 'empty') { trails[ctrl.controlId] = trail; return; }

    // Step 1: control-level population
    const sampleBased = ctrl.attributes.filter(a => attrScope(a) === 'SAMPLE_BASED');
    const popSize = sampleBased.reduce((max, a) => Math.max(max, a.populationSize), 487);
    populations[ctrl.controlId] = {
      rows: popSize,
      filename: `population_${ctrl.controlId.toLowerCase()}_FY26.xlsx`,
      uploadedAgo: '2d ago',
    };
    push({ id: `${ctrl.controlId}-pop`, actor: 'human', actorName: CURRENT_USER.name, icon: 'upload',
      type: 'population_uploaded',
      text: `Population uploaded · ${populations[ctrl.controlId]!.filename} · ${popSize.toLocaleString()} rows` });

    if (bucket === 'pop') { trails[ctrl.controlId] = trail; return; }

    // Step 2: control-level sampling — one config, one shared sample set
    const method: SampleMethod = (['Random', 'Statistical', 'Column-filter'] as SampleMethod[])[Math.floor(rng(`m-${ctrl.controlId}`)() * 3)]!;
    const sampleSize = sampleBased[0]?.defaultSampleSize ?? 25;
    sampling[ctrl.controlId] = { method, sampleSize };
    push({ id: `${ctrl.controlId}-gen`, actor: 'system', actorName: 'System', icon: 'gear',
      type: 'samples_generated', text: `Generated ${sampleSize} samples (method: ${method})` });

    // Build shared sample set
    const list: GeneratedSample[] = Array.from({ length: sampleSize }).map((_, i) => {
      const sid = `S${String(i + 1).padStart(3, '0')}`;
      const sample: GeneratedSample = { id: sid, description: `Sample ${sid}`, evidence: {}, verdicts: {} };
      sampleBased.forEach(attr => {
        sample.evidence[attr.id] = {};
        const evRate = bucket === 'done' ? 1 : 0.55 + rng(`ev-${ctrl.controlId}-${sid}-${attr.id}`)() * 0.2;
        attr.requiredEvidence.forEach(et => {
          const has = bucket === 'done' ? true : rng(`evf-${ctrl.controlId}-${sid}-${attr.id}-${et}`)() < evRate;
          sample.evidence[attr.id]![et] = has ? { filename: mockFilename(et, sid), size: mockFileSize(`${sid}-${et}`) } : null;
        });
        sample.verdicts[attr.id] = buildBlankAttrVerdict();
        if (bucket === 'done') {
          const ai = deterministicAiVerdict(`${ctrl.controlId}-${attr.id}-${sid}`);
          sample.verdicts[attr.id] = { ...sample.verdicts[attr.id]!, aiVerdict: ai.v, aiConfidence: ai.confidence, aiRationale: ai.rationale };
        }
      });
      return sample;
    });
    samples[ctrl.controlId] = list;

    // Generic attribute one-shot results
    const gens = ctrl.attributes.filter(a => attrScope(a) === 'GENERIC');
    const ctrlGen: Record<string, GenericResult> = {};
    gens.forEach(attr => {
      const ev: Record<string, EvidenceFile | null> = {};
      attr.requiredEvidence.forEach(et => {
        const has = bucket === 'done';
        ev[et] = has ? { filename: mockFilename(et, ctrl.controlId), size: mockFileSize(`${ctrl.controlId}-${et}`) } : null;
      });
      const ai = bucket === 'done' ? deterministicAiVerdict(`${ctrl.controlId}-${attr.id}-gen`) : null;
      ctrlGen[attr.id] = {
        evidence: ev,
        aiVerdict: ai?.v ?? null,
        aiConfidence: ai?.confidence ?? 0,
        aiRationale: ai?.rationale ?? '',
        useAi: true,
        humanVerdict: 'Pass',
        humanRemark: '',
      };
    });
    if (Object.keys(ctrlGen).length > 0) genericResults[ctrl.controlId] = ctrlGen;

    if (bucket === 'done') {
      push({ id: `${ctrl.controlId}-ai`, actor: 'ai', actorName: 'Ira AI', icon: 'sparkles',
        type: 'ai_validated', text: `AI validated samples for all attributes` });
      push({ id: `${ctrl.controlId}-wp`, actor: 'human', actorName: CURRENT_USER.name, icon: 'download',
        type: 'working_paper_exported', text: 'Working paper exported as PDF' });
    }
    trails[ctrl.controlId] = trail;
  });
  return { populations, samples, sampling, trails, genericResults };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvidenceTab({ engagement, onLaunchWorkflowBuilder, openControlId, onOpened }: Props): JSX.Element {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { can } = useCan();
  const ws = useEngagementWorkspace();
  const allRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);
  const groupsBySub = useMemo(() => buildControlGroups(allRows), [allRows]);
  const subProcessNames = useMemo(() => Array.from(groupsBySub.keys()), [groupsBySub]);
  const allControls = useMemo(() => {
    const out: DistinctControl[] = [];
    groupsBySub.forEach(list => list.forEach(c => out.push(c)));
    return out;
  }, [groupsBySub]);
  const seeded = useMemo(() => seedFor(allControls), [allControls]);

  // ─── State (control-level) ─────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [subProcessFilter, setSubProcessFilter] = useState<string>('All');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [search, setSearch] = useState<string>('');
  const [expandedSub, setExpandedSub] = useState<Set<string>>(() => new Set(subProcessNames.slice(0, 1)));
  /** When set, the tab switches from list mode to focused detail mode for that control. */
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  /** Which checkpoint the auditor is currently viewing in detail mode. */
  const [activeCheckpoint, setActiveCheckpoint] = useState<1 | 2 | 3 | 4>(1);

  const [populationsByCtrl, setPopulationsByCtrl] = useState<Record<string, PopulationState>>(seeded.populations);
  const [samplingByCtrl, setSamplingByCtrl] = useState<Record<string, SamplingConfig>>(seeded.sampling);
  const [samplesByCtrl, setSamplesByCtrl] = useState<Record<string, GeneratedSample[]>>(seeded.samples);
  const [genericByCtrl, setGenericByCtrl] = useState<Record<string, Record<string, GenericResult>>>(seeded.genericResults);
  /** Validation workflow attached to each attribute. Key: `${controlId}::${attrId}`. */
  const [validationWorkflowByAttr, setValidationWorkflowByAttr] = useState<Record<string, ValidationWorkflow>>({});
  const [workflowPickerOpenFor, setWorkflowPickerOpenFor] = useState<string | null>(null);
  const [aiRunningByCtrl, setAiRunningByCtrl] = useState<Record<string, boolean>>({});
  const [roundsByCtrlAttr, setRoundsByCtrlAttr] = useState<Record<string, AttributeRound[]>>({}); // key: `${controlId}::${attrId}`
  const [expandedAttrByCtrl, setExpandedAttrByCtrl] = useState<Record<string, string | null>>({});
  const [auditTrails, setAuditTrails] = useState<Record<string, AuditEvent[]>>(seeded.trails);
  const [trailToastFired, setTrailToastFired] = useState<boolean>(false);

  const pushEvent = useCallback((controlId: string, event: Omit<AuditEvent, 'id' | 'timestamp' | 'relTime'>) => {
    const ts = Date.now();
    const built: AuditEvent = { id: `${controlId}-${event.type}-${ts}-${Math.floor(Math.random() * 10_000)}`, timestamp: ts, relTime: 'just now', ...event };
    setAuditTrails(prev => ({ ...prev, [controlId]: [built, ...(prev[controlId] ?? [])] }));
    if (!trailToastFired) {
      setTrailToastFired(true);
      addToast({ type: 'info', message: 'Logged to audit trail · also captured in Action Trail tab' });
    }
  }, [addToast, trailToastFired]);

  // ─── Per-control derived state ────────────────────────────────────────────
  const ctrlHasPop = (controlId: string) => !!populationsByCtrl[controlId];
  const ctrlHasSampling = (controlId: string) => !!samplingByCtrl[controlId] && (samplesByCtrl[controlId]?.length || 0) > 0;
  const sampleBasedAttrs = (ctrl: DistinctControl) => ctrl.attributes.filter(a => attrScope(a) === 'SAMPLE_BASED');
  const genericAttrs = (ctrl: DistinctControl) => ctrl.attributes.filter(a => attrScope(a) === 'GENERIC');
  const attrSamplesFor = (ctrl: DistinctControl) => samplesByCtrl[ctrl.controlId] || [];

  // Has every required-evidence file on every sample for this attribute?
  const sampleAttrEvidenceReady = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const samps = attrSamplesFor(ctrl);
    if (samps.length === 0) return false;
    return samps.every(s => attr.requiredEvidence.every(et => !!s.evidence[attr.id]?.[et]));
  };
  const sampleAttrAllTested = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const samps = attrSamplesFor(ctrl);
    if (samps.length === 0) return false;
    return samps.every(s => {
      const v = s.verdicts[attr.id];
      return v && (v.aiVerdict !== null || v.useAi === false);
    });
  };
  const sampleAttrFails = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const samps = attrSamplesFor(ctrl);
    return samps.filter(s => {
      const v = s.verdicts[attr.id];
      if (!v) return false;
      const effective = v.useAi ? v.aiVerdict : v.humanVerdict;
      return effective === 'Fail';
    });
  };
  const sampleAttrPasses = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const samps = attrSamplesFor(ctrl);
    return samps.filter(s => {
      const v = s.verdicts[attr.id];
      if (!v) return false;
      const effective = v.useAi ? v.aiVerdict : v.humanVerdict;
      return effective === 'Pass';
    });
  };

  const genericAttrResult = (ctrl: DistinctControl, attr: ControlAttribute): GenericResult | undefined =>
    genericByCtrl[ctrl.controlId]?.[attr.id];

  const attrDone = (ctrl: DistinctControl, attr: ControlAttribute): boolean => {
    if (attrScope(attr) === 'GENERIC') {
      const g = genericAttrResult(ctrl, attr);
      const v = g?.useAi ? g?.aiVerdict : g?.humanVerdict;
      return v === 'Pass' || v === 'Fail';
    }
    return sampleAttrAllTested(ctrl, attr);
  };

  const controlStepDone = (ctrl: DistinctControl, step: 1 | 2 | 3): boolean => {
    if (step === 1) return ctrlHasPop(ctrl.controlId);
    if (step === 2) return ctrlHasSampling(ctrl.controlId);
    return ctrl.attributes.every(a => attrDone(ctrl, a));
  };
  const controlStatus = (ctrl: DistinctControl): ControlStatus => {
    const s1 = controlStepDone(ctrl, 1), s2 = controlStepDone(ctrl, 2), s3 = controlStepDone(ctrl, 3);
    if (s1 && s2 && s3) return 'Working paper ready';
    if (s1 && s2) return 'Validated';
    if (s1) return 'In progress';
    return 'Not started';
  };
  const controlBucket = (ctrl: DistinctControl): Exclude<StatusFilter, 'All'> => {
    const st = controlStatus(ctrl);
    if (st === 'Working paper ready') return 'Complete';
    if (st === 'Not started') return 'Not started';
    return 'In progress';
  };

  // Workflow-link readiness carried over from the Controls tab (shared workspace store):
  // the distinct workflow codes linked to any of this control's attributes.
  const workflowCodesForControl = useCallback((ctrl: DistinctControl): string[] => {
    const ids = new Set<string>();
    ctrl.attributes.forEach(a => ws.workflowIdsForAttribute(a.id).forEach(id => ids.add(id)));
    return Array.from(ids)
      .map(id => ws.workflows.find(w => w.id === id)?.code)
      .filter((c): c is string => !!c);
  }, [ws]);

  // Per-row derived props, shared by the flat and grouped renderers.
  const rowPropsFor = (ctrl: DistinctControl) => {
    const attrsTotal = ctrl.attributes.length;
    const aDone = ctrl.attributes.filter(a => attrDone(ctrl, a)).length;
    const pct = attrsTotal === 0 ? 0 : Math.round((aDone / attrsTotal) * 100);
    const stepCompletion: [boolean, boolean, boolean] = [controlStepDone(ctrl, 1), controlStepDone(ctrl, 2), controlStepDone(ctrl, 3)];
    return { attrsTotal, pct, stepCompletion, status: controlStatus(ctrl), codes: workflowCodesForControl(ctrl) };
  };

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalAttrs = 0, withPopulation = 0, samplesGenerated = 0, validated = 0, passes = 0, fails = 0;
    let evReq = 0, evUp = 0, completionSum = 0;
    allControls.forEach(ctrl => {
      totalAttrs += ctrl.attributes.length;
      if (ctrlHasPop(ctrl.controlId)) withPopulation += ctrl.attributes.length;
      const samps = samplesByCtrl[ctrl.controlId] || [];
      samplesGenerated += samps.length * sampleBasedAttrs(ctrl).length;
      sampleBasedAttrs(ctrl).forEach(attr => {
        samps.forEach(s => {
          const v = s.verdicts[attr.id];
          if (v && v.aiVerdict !== null) validated += 1;
          const eff = v?.useAi ? v?.aiVerdict : v?.humanVerdict;
          if (eff === 'Pass') passes += 1; else if (eff === 'Fail') fails += 1;
          attr.requiredEvidence.forEach(et => {
            evReq += 1;
            if (s.evidence[attr.id]?.[et]) evUp += 1;
          });
        });
      });
      genericAttrs(ctrl).forEach(attr => {
        const g = genericAttrResult(ctrl, attr);
        if (g?.aiVerdict !== null && g?.aiVerdict !== undefined) validated += 1;
        const eff = g?.useAi ? g?.aiVerdict : g?.humanVerdict;
        if (eff === 'Pass') passes += 1; else if (eff === 'Fail') fails += 1;
        attr.requiredEvidence.forEach(et => {
          evReq += 1;
          if (g?.evidence[et]) evUp += 1;
        });
      });
      // completion contribution
      const a = ctrl.attributes.length;
      const done = ctrl.attributes.filter(at => attrDone(ctrl, at)).length;
      completionSum += a > 0 ? done / a : 0;
    });
    const passRate = validated === 0 ? 0 : Math.round((passes / validated) * 100);
    const overall = allControls.length === 0 ? 0 : Math.round((completionSum / allControls.length) * 100);
    return { totalAttrs, withPopulation, samplesGenerated, validated, passes, fails, evUp, evPending: Math.max(0, evReq - evUp), passRate, overall };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allControls, populationsByCtrl, samplingByCtrl, samplesByCtrl, genericByCtrl]);

  // ─── Visible groups (search/filter) ───────────────────────────────────────
  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: { subProcess: string; controls: DistinctControl[] }[] = [];
    groupsBySub.forEach((ctrls, sp) => {
      if (subProcessFilter !== 'All' && sp !== subProcessFilter) return;
      const filtered = ctrls.filter(c => {
        if (statusFilter !== 'All' && controlBucket(c) !== statusFilter) return false;
        if (q.length > 0) {
          const inC = c.controlId.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
          const inA = c.attributes.some(a => a.id.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
          const inE = c.attributes.some(a => a.requiredEvidence.some(e => e.toLowerCase().includes(q)));
          if (!inC && !inA && !inE) return false;
        }
        return true;
      });
      if (filtered.length > 0) out.push({ subProcess: sp, controls: filtered });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsBySub, statusFilter, subProcessFilter, search, populationsByCtrl, samplingByCtrl, samplesByCtrl, genericByCtrl]);

  // Flat (ungrouped) control list — the default view; grouping is opt-in via the Group-by control.
  const flatControls = useMemo(() => visibleGroups.flatMap(g => g.controls), [visibleGroups]);

  const toggleSub = (key: string) => setExpandedSub(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const openControl = (controlId: string) => {
    setSelectedControlId(controlId);
    // Default the workspace to the first incomplete checkpoint.
    const ctrl = allControls.find(c => c.controlId === controlId);
    if (!ctrl) return;
    if (!controlStepDone(ctrl, 1)) setActiveCheckpoint(1);
    else if (!controlStepDone(ctrl, 2)) setActiveCheckpoint(2);
    else if (!ctrl.attributes.every(a => attrDone(ctrl, a))) setActiveCheckpoint(3);
    else setActiveCheckpoint(4);
    // Pre-select first attribute for checkpoint 3
    if (ctrl.attributes.length > 0) setExpandedAttrByCtrl(prev => ({ ...prev, [controlId]: ctrl.attributes[0]!.id }));
  };
  const setSelectedAttr = (controlId: string, attrId: string) => setExpandedAttrByCtrl(prev => ({ ...prev, [controlId]: attrId }));

  // Consume an external "open this control at Attribute Testing" request (Controls → Test evidence).
  useEffect(() => {
    if (!openControlId) return;
    const ctrl = allControls.find(c => c.controlId === openControlId);
    if (ctrl) {
      setSelectedControlId(openControlId);
      setActiveCheckpoint(3);
      if (ctrl.attributes.length > 0) setExpandedAttrByCtrl(prev => ({ ...prev, [openControlId]: ctrl.attributes[0]!.id }));
    }
    onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openControlId]);

  const allAttrsBulkRef = useRef<HTMLInputElement | null>(null);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const onUploadPopulation = (ctrl: DistinctControl) => {
    if (!can('ds_upload')) return;
    const popSize = sampleBasedAttrs(ctrl).reduce((max, a) => Math.max(max, a.populationSize), 100);
    const filename = `population_${ctrl.controlId.toLowerCase()}_FY26.xlsx`;
    setPopulationsByCtrl(prev => ({ ...prev, [ctrl.controlId]: { rows: popSize, filename, uploadedAgo: 'just now' } }));
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload', type: 'population_uploaded', text: `Population uploaded · ${filename} · ${popSize.toLocaleString()} rows` });
    addToast({ type: 'success', message: `Population uploaded · ${popSize.toLocaleString()} rows` });
    logEvent({ action: 'Upload', description: `Uploaded population file "${filename}" (${popSize.toLocaleString()} rows) for control ${ctrl.controlId}`, module: 'Engagements', entity: 'Evidence' });
  };
  const onReplacePopulation = (ctrl: DistinctControl) => {
    setPopulationsByCtrl(prev => { const n = { ...prev }; delete n[ctrl.controlId]; return n; });
    setSamplingByCtrl(prev => { const n = { ...prev }; delete n[ctrl.controlId]; return n; });
    setSamplesByCtrl(prev => { const n = { ...prev }; delete n[ctrl.controlId]; return n; });
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'override', type: 'population_replaced', text: 'Population cleared — awaiting new upload' });
  };

  const onSetSampling = (ctrl: DistinctControl, patch: Partial<SamplingConfig>) => {
    setSamplingByCtrl(prev => ({ ...prev, [ctrl.controlId]: { ...(prev[ctrl.controlId] || { method: 'Random', sampleSize: 25 }), ...patch } }));
  };
  const onGenerateSamples = (ctrl: DistinctControl) => {
    const sb = sampleBasedAttrs(ctrl);
    if (sb.length === 0) {
      addToast({ type: 'info', message: 'No sample-based attributes on this control — nothing to sample.' });
      return;
    }
    const cfg = samplingByCtrl[ctrl.controlId] || { method: 'Random' as const, sampleSize: sb[0]!.defaultSampleSize };
    const pop = populationsByCtrl[ctrl.controlId];
    const size = Math.min(cfg.sampleSize, pop?.rows || cfg.sampleSize);
    const samples: GeneratedSample[] = Array.from({ length: size }).map((_, i) => {
      const sid = `S${String(i + 1).padStart(3, '0')}`;
      const sample: GeneratedSample = { id: sid, description: `Sample ${sid}`, evidence: {}, verdicts: {} };
      sb.forEach(attr => {
        sample.evidence[attr.id] = {};
        attr.requiredEvidence.forEach(et => { sample.evidence[attr.id]![et] = null; });
        sample.verdicts[attr.id] = buildBlankAttrVerdict();
      });
      return sample;
    });
    setSamplingByCtrl(prev => ({ ...prev, [ctrl.controlId]: { ...cfg, sampleSize: size } }));
    setSamplesByCtrl(prev => ({ ...prev, [ctrl.controlId]: samples }));
    pushEvent(ctrl.controlId, { actor: 'system', actorName: 'System', icon: 'gear', type: 'samples_generated', text: `Generated ${size} samples (method: ${cfg.method})` });
    addToast({ type: 'success', message: `Generated ${size} ${cfg.method.toLowerCase()} samples — shared across ${sb.length} sample-based attribute${sb.length !== 1 ? 's' : ''}` });
    logEvent({ action: 'Create', description: `Generated ${size} ${cfg.method.toLowerCase()} samples for control ${ctrl.controlId}`, module: 'Engagements', entity: 'Sample' });
  };

  const onUploadSampleEvidence = (ctrl: DistinctControl, attr: ControlAttribute, sampleId: string, evidenceType: string) => {
    if (!can('ds_upload')) return;
    const filename = mockFilename(evidenceType, sampleId);
    setSamplesByCtrl(prev => ({
      ...prev,
      [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => {
        if (s.id !== sampleId) return s;
        const next = { ...s, evidence: { ...s.evidence, [attr.id]: { ...(s.evidence[attr.id] || {}), [evidenceType]: { filename, size: mockFileSize(`${sampleId}-${evidenceType}`) } } } };
        return next;
      }),
    }));
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload', type: 'evidence_uploaded', text: `Evidence '${filename}' uploaded for ${sampleId} · ${evidenceType}` });
  };
  const onRemoveSampleEvidence = (ctrl: DistinctControl, attr: ControlAttribute, sampleId: string, evidenceType: string) => {
    setSamplesByCtrl(prev => ({
      ...prev,
      [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => s.id !== sampleId ? s : { ...s, evidence: { ...s.evidence, [attr.id]: { ...(s.evidence[attr.id] || {}), [evidenceType]: null } } }),
    }));
  };
  /** Bulk-attach evidence for every in-scope sample at once (fills only the gaps). */
  const onBulkUploadSampleEvidence = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const round = roundsByCtrlAttr[`${ctrl.controlId}::${attr.id}`] || [];
    const active = round[round.length - 1];
    let filled = 0;
    setSamplesByCtrl(prev => ({
      ...prev,
      [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => {
        const inScope = !active || active.sampleIds.includes(s.id) || round.length <= 1;
        if (!inScope) return s;
        const ev = { ...(s.evidence[attr.id] || {}) };
        attr.requiredEvidence.forEach(et => {
          if (!ev[et]) { ev[et] = { filename: mockFilename(et, s.id), size: mockFileSize(`${s.id}-${et}`) }; filled += 1; }
        });
        return { ...s, evidence: { ...s.evidence, [attr.id]: ev } };
      }),
    }));
    const sampleCount = (samplesByCtrl[ctrl.controlId] || []).length;
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload', type: 'evidence_bulk_uploaded', text: `Bulk-uploaded ${filled} evidence file${filled === 1 ? '' : 's'} for ${attr.id} across ${sampleCount} samples` });
    addToast({ type: filled > 0 ? 'success' : 'info', message: filled > 0 ? `Uploaded ${filled} evidence file${filled === 1 ? '' : 's'} across ${sampleCount} samples` : 'All samples already have their evidence.' });
    if (filled > 0) logEvent({ action: 'Upload', description: `Uploaded ${filled} evidence file${filled === 1 ? '' : 's'} for attribute ${attr.id} across ${sampleCount} samples on control ${ctrl.controlId}`, module: 'Engagements', entity: 'Evidence' });
  };
  /** Control-level bulk: attach required evidence across every attribute (all samples + generic) at once. */
  const onBulkUploadAllAttrs = (ctrl: DistinctControl) => {
    const sb = sampleBasedAttrs(ctrl);
    const gens = genericAttrs(ctrl);
    let filled = 0;
    if (sb.length > 0) {
      setSamplesByCtrl(prev => ({
        ...prev,
        [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => {
          const byAttr = { ...s.evidence };
          sb.forEach(attr => {
            const ev = { ...(byAttr[attr.id] || {}) };
            attr.requiredEvidence.forEach(et => { if (!ev[et]) { ev[et] = { filename: mockFilename(et, s.id), size: mockFileSize(`${s.id}-${et}`) }; filled += 1; } });
            byAttr[attr.id] = ev;
          });
          return { ...s, evidence: byAttr };
        }),
      }));
    }
    if (gens.length > 0) {
      setGenericByCtrl(prev => {
        const map = { ...(prev[ctrl.controlId] || {}) };
        gens.forEach(attr => {
          const cur = map[attr.id] || { evidence: {}, useAi: true, humanVerdict: 'Pass' as HumanVerdict, humanRemark: '', aiVerdict: null, aiConfidence: 0, aiRationale: '' };
          const ev = { ...cur.evidence };
          attr.requiredEvidence.forEach(et => { if (!ev[et]) { ev[et] = { filename: mockFilename(et, `${ctrl.controlId}-${attr.id}`), size: mockFileSize(`${ctrl.controlId}-${attr.id}-${et}`) }; filled += 1; } });
          map[attr.id] = { ...cur, evidence: ev };
        });
        return { ...prev, [ctrl.controlId]: map };
      });
    }
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload', type: 'evidence_bulk_uploaded', text: `Bulk-uploaded ${filled} evidence file${filled === 1 ? '' : 's'} across all attributes` });
    addToast({ type: filled > 0 ? 'success' : 'info', message: filled > 0 ? `Uploaded ${filled} evidence file${filled === 1 ? '' : 's'} across all attributes` : 'All attributes already have their evidence.' });
    if (filled > 0) logEvent({ action: 'Upload', description: `Uploaded ${filled} evidence file${filled === 1 ? '' : 's'} across all attributes of control ${ctrl.controlId}`, module: 'Engagements', entity: 'Evidence' });
  };

  const onRunAttrAi = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const key = `${ctrl.controlId}::${attr.id}`;
    setAiRunningByCtrl(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      if (attrScope(attr) === 'GENERIC') {
        const ai = deterministicAiVerdict(`${ctrl.controlId}-${attr.id}-gen`);
        setGenericByCtrl(prev => ({
          ...prev,
          [ctrl.controlId]: { ...(prev[ctrl.controlId] || {}), [attr.id]: { ...(prev[ctrl.controlId]?.[attr.id] || { evidence: {}, useAi: true, humanVerdict: 'Pass', humanRemark: '', aiVerdict: null, aiConfidence: 0, aiRationale: '' }), aiVerdict: ai.v, aiConfidence: ai.confidence, aiRationale: ai.rationale } },
        }));
      } else {
        setSamplesByCtrl(prev => ({
          ...prev,
          [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => {
            const ai = deterministicAiVerdict(`${ctrl.controlId}-${attr.id}-${s.id}`);
            const cur = s.verdicts[attr.id] || buildBlankAttrVerdict();
            return { ...s, verdicts: { ...s.verdicts, [attr.id]: { ...cur, aiVerdict: ai.v, aiConfidence: ai.confidence, aiRationale: ai.rationale } } };
          }),
        }));
      }
      setAiRunningByCtrl(prev => ({ ...prev, [key]: false }));
      pushEvent(ctrl.controlId, { actor: 'ai', actorName: 'Ira AI', icon: 'sparkles', type: 'ai_validated', text: `AI validated ${attrScope(attr) === 'GENERIC' ? '1 control-level' : (samplesByCtrl[ctrl.controlId]?.length || 0) + ' samples'} for ${attr.id}` });
    }, 700);
  };

  const onOverrideSample = (ctrl: DistinctControl, attr: ControlAttribute, sampleId: string, patch: Partial<AttrVerdict>) => {
    setSamplesByCtrl(prev => ({
      ...prev,
      [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => s.id !== sampleId ? s : { ...s, verdicts: { ...s.verdicts, [attr.id]: { ...(s.verdicts[attr.id] || buildBlankAttrVerdict()), ...patch } } }),
    }));
  };

  const onUploadGenericEvidence = (ctrl: DistinctControl, attr: ControlAttribute, evidenceType: string) => {
    if (!can('ds_upload')) return;
    const filename = mockFilename(evidenceType, `${ctrl.controlId}-${attr.id}`);
    setGenericByCtrl(prev => {
      const ctrlMap = { ...(prev[ctrl.controlId] || {}) };
      const cur = ctrlMap[attr.id] || { evidence: {}, useAi: true, humanVerdict: 'Pass' as HumanVerdict, humanRemark: '', aiVerdict: null, aiConfidence: 0, aiRationale: '' };
      ctrlMap[attr.id] = { ...cur, evidence: { ...cur.evidence, [evidenceType]: { filename, size: mockFileSize(`${ctrl.controlId}-${attr.id}-${evidenceType}`) } } };
      return { ...prev, [ctrl.controlId]: ctrlMap };
    });
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload', type: 'evidence_uploaded', text: `Evidence '${filename}' uploaded for ${attr.id} (control-level)` });
  };
  const onReplaceGenericEvidence = (ctrl: DistinctControl, attr: ControlAttribute) => {
    setGenericByCtrl(prev => {
      const ctrlMap = { ...(prev[ctrl.controlId] || {}) };
      ctrlMap[attr.id] = { evidence: {}, useAi: true, humanVerdict: 'Pass', humanRemark: '', aiVerdict: null, aiConfidence: 0, aiRationale: '' };
      return { ...prev, [ctrl.controlId]: ctrlMap };
    });
  };

  const onSelectAttrWorkflow = (ctrl: DistinctControl, attr: ControlAttribute, wf: ValidationWorkflow) => {
    setValidationWorkflowByAttr(prev => ({ ...prev, [`${ctrl.controlId}::${attr.id}`]: wf }));
    setWorkflowPickerOpenFor(null);
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'gear', type: 'workflow_attached', text: `Validation workflow '${wf.name}' attached to ${attr.id}` });
  };
  const onClearAttrWorkflow = (ctrl: DistinctControl, attr: ControlAttribute) => {
    setValidationWorkflowByAttr(prev => { const n = { ...prev }; delete n[`${ctrl.controlId}::${attr.id}`]; return n; });
  };
  const onBuildAttrWorkflow = (ctrl: DistinctControl, attr: ControlAttribute) => {
    setWorkflowPickerOpenFor(null);
    if (onLaunchWorkflowBuilder) {
      onLaunchWorkflowBuilder(`Build a validation workflow for attribute ${attr.id} of control ${ctrl.controlId} (${ctrl.description}). Attribute: ${attr.description}. Required evidence: ${attr.requiredEvidence.join(', ')}. The workflow should take uploaded files for this attribute, extract relevant fields, run the test procedure (${attr.testProcedure}), and emit Pass/Fail with a short reason.`);
    } else {
      addToast({ type: 'info', message: 'Workflow builder is not available in this context.' });
    }
  };
  const onAddSamplingWorkflow = (ctrl: DistinctControl) => {
    if (onLaunchWorkflowBuilder) {
      onLaunchWorkflowBuilder(`Build a sampling workflow for control ${ctrl.controlId} (${ctrl.description}). The workflow should select a deterministic sample list from the uploaded population (${populationsByCtrl[ctrl.controlId]?.rows || '?'} rows). Define the rules in plain English.`);
    } else {
      addToast({ type: 'info', message: 'Workflow builder is not available in this context.' });
    }
  };

  const onStartRound = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const fails = sampleAttrFails(ctrl, attr).map(s => s.id);
    if (fails.length === 0) return;
    const key = `${ctrl.controlId}::${attr.id}`;
    const existing = roundsByCtrlAttr[key] || [];
    const nextRoundNumber = existing.length + 1;
    setRoundsByCtrlAttr(prev => ({ ...prev, [key]: [...(prev[key] || []), { roundNumber: nextRoundNumber, sampleIds: fails, startedAt: Date.now(), closedAt: null, passCount: 0, failCount: 0 }] }));
    // Reset evidence + verdicts for those samples × this attribute
    setSamplesByCtrl(prev => ({
      ...prev,
      [ctrl.controlId]: (prev[ctrl.controlId] || []).map(s => {
        if (!fails.includes(s.id)) return s;
        const clearedEv: Record<string, EvidenceFile | null> = {};
        attr.requiredEvidence.forEach(et => { clearedEv[et] = null; });
        return { ...s, evidence: { ...s.evidence, [attr.id]: clearedEv }, verdicts: { ...s.verdicts, [attr.id]: buildBlankAttrVerdict() } };
      }),
    }));
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'override', type: 'retest_started', text: `Round ${nextRoundNumber} started for ${attr.id} — ${fails.length} failed sample${fails.length !== 1 ? 's' : ''}` });
  };

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (allRows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 flex flex-col items-center text-center">
        <div className="p-3 rounded-2xl bg-brand-50 mb-4"><FolderOpen size={28} className="text-brand-600" /></div>
        <h3 className="text-[15px] font-semibold text-text mb-1.5">No controls in scope — upload a RACM first</h3>
        <p className="text-[12.5px] text-text-muted max-w-md mb-5 leading-relaxed">
          Once the RACM is uploaded, every control appears here with its population, sampling, validation workflows, and per-attribute test cards.
        </p>
      </div>
    );
  }

  // ─── DETAIL MODE (focused control workspace) ─────────────────────────────
  if (selectedControlId) {
    const ctrl = allControls.find(c => c.controlId === selectedControlId);
    if (!ctrl) { setSelectedControlId(null); return <></>; }

    const phaseDone = (n: 1 | 2 | 3 | 4) => n === 4 ? false : controlStepDone(ctrl, n);
    const sbAttrs = sampleBasedAttrs(ctrl);
    const genAttrs = genericAttrs(ctrl);
    const samps = samplesByCtrl[ctrl.controlId] || [];
    const validatedCount = sbAttrs.reduce((acc, a) => acc + samps.filter(s => s.verdicts[a.id]?.aiVerdict !== null).length, 0);
    const totalChecks = sbAttrs.length * samps.length;
    const passedCount = sbAttrs.reduce((acc, a) => acc + sampleAttrPasses(ctrl, a).length, 0);
    const failedCount = sbAttrs.reduce((acc, a) => acc + sampleAttrFails(ctrl, a).length, 0);
    const attrsDone = ctrl.attributes.filter(a => attrDone(ctrl, a)).length;
    const checkpoint3Done = attrsDone === ctrl.attributes.length;

    const checkpoints: { num: 1 | 2 | 3 | 4; label: string; sub: string; done: boolean }[] = [
      { num: 1, label: 'Population',       sub: populationsByCtrl[ctrl.controlId] ? `${populationsByCtrl[ctrl.controlId]!.rows.toLocaleString()} rows` : 'Upload required', done: phaseDone(1) },
      { num: 2, label: 'Sampling',         sub: ctrlHasSampling(ctrl.controlId) ? `${samps.length} samples · ${samplingByCtrl[ctrl.controlId]!.method}` : 'Not configured', done: phaseDone(2) },
      { num: 3, label: 'Attribute Testing', sub: `${attrsDone}/${ctrl.attributes.length} attributes`, done: checkpoint3Done },
      { num: 4, label: 'Working Paper',    sub: checkpoint3Done ? 'Ready to generate' : 'Awaiting attributes', done: phaseDone(4) },
    ];

    const selectedAttrId = expandedAttrByCtrl[ctrl.controlId];
    const selectedAttr = ctrl.attributes.find(a => a.id === selectedAttrId) || ctrl.attributes[0];

    return (
      <div className="space-y-5">
        {/* Detail header — back + control identity */}
        <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4">
          <button onClick={() => setSelectedControlId(null)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted hover:text-brand-700 cursor-pointer transition-colors">
            <ChevronRight size={14} className="rotate-180" />Back to controls
          </button>
          <div className="h-6 w-px bg-canvas-border" />
          <Shield size={14} className="text-brand-600 shrink-0" />
          <span className="font-mono text-[12.5px] font-semibold text-brand-700 shrink-0">{ctrl.controlId}</span>
          {ctrl.isKey && <span className="px-1.5 h-5 inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-100 shrink-0">Key</span>}
          <span className="text-[12.5px] text-text truncate flex-1 min-w-0">{ctrl.description}</span>
          <span className="text-[10.5px] text-text-muted shrink-0">{ctrl.subProcess}</span>
          <ControlStatusPill status={controlStatus(ctrl)} />
        </div>

        {/* Compact journey stepper on top — frees the full width for the testing content */}
        <JourneyStepper
          phases={checkpoints}
          active={activeCheckpoint}
          onJump={(n) => setActiveCheckpoint(n)}
          xp={{ samples: samps.length, validated: validatedCount, total: totalChecks, passed: passedCount, failed: failedCount }}
        />

        {/* ── Active checkpoint content (full width) ── */}
        <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeCheckpoint} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-5">

                {activeCheckpoint === 1 && (
                  <PopulationSection ctrl={ctrl} population={populationsByCtrl[ctrl.controlId]}
                    onUpload={() => onUploadPopulation(ctrl)} onReplace={() => onReplacePopulation(ctrl)} />
                )}

                {activeCheckpoint === 2 && (
                  <SamplingSection ctrl={ctrl} disabled={!ctrlHasPop(ctrl.controlId)}
                    config={samplingByCtrl[ctrl.controlId]} samples={samps}
                    sampleBasedCount={sbAttrs.length}
                    onSet={(patch) => onSetSampling(ctrl, patch)}
                    onGenerate={() => onGenerateSamples(ctrl)}
                    onBuildWorkflow={() => onAddSamplingWorkflow(ctrl)} />
                )}

                {activeCheckpoint === 3 && (
                  <div className="rounded-2xl border border-canvas-border bg-white">
                    <div className="px-6 py-4 border-b border-canvas-border flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h5 className="text-[14px] font-bold text-text">Attribute Testing</h5>
                        <p className="text-[11px] text-text-muted mt-0.5">Pick an attribute on the left, or upload evidence for every attribute at once.</p>
                      </div>
                      {ctrl.attributes.length > 0 && (
                        <>
                          <input
                            ref={allAttrsBulkRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => { if (e.target.files && e.target.files.length > 0) onBulkUploadAllAttrs(ctrl); e.target.value = ''; }}
                          />
                          <button
                            onClick={() => allAttrsBulkRef.current?.click()}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[11.5px] font-semibold cursor-pointer transition-colors"
                            title="Upload evidence and apply it across every attribute and sample on this control"
                          >
                            <Upload size={12} /> Upload evidence for all attributes
                          </button>
                        </>
                      )}
                    </div>
                    {ctrl.attributes.length === 0 ? (
                      <div className="px-6 py-12 text-center">
                        <AlertTriangle size={20} className="text-text-muted mx-auto mb-2" />
                        <p className="text-[12px] text-text-muted">No attributes defined for this control.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[240px_minmax(0,1fr)]">
                        <AttributeRail
                          ctrl={ctrl}
                          sbAttrs={sbAttrs}
                          genAttrs={genAttrs}
                          selectedAttrId={selectedAttr?.id || null}
                          onSelect={(attrId) => setSelectedAttr(ctrl.controlId, attrId)}
                          attrDone={attrDone}
                          sampleAttrPasses={(a) => sampleAttrPasses(ctrl, a).length}
                          sampleAttrFails={(a) => sampleAttrFails(ctrl, a).length}
                          totalSamples={samps.length}
                          genericResult={(a) => genericAttrResult(ctrl, a)}
                          validationWorkflows={validationWorkflowByAttr}
                          samplingReady={ctrlHasSampling(ctrl.controlId)}
                        />
                        <div className="p-6 min-h-[420px]">
                          {selectedAttr ? (() => {
                            const wfKey = `${ctrl.controlId}::${selectedAttr.id}`;
                            const wf = validationWorkflowByAttr[wfKey];
                            const pickerOpen = workflowPickerOpenFor === wfKey;
                            return attrScope(selectedAttr) === 'GENERIC' ? (
                              <GenericAttrSection ctrl={ctrl} attr={selectedAttr}
                                expanded={true} onToggle={() => {}}
                                result={genericAttrResult(ctrl, selectedAttr)}
                                running={!!aiRunningByCtrl[wfKey]}
                                validationWorkflow={wf}
                                pickerOpen={pickerOpen}
                                onTogglePicker={() => setWorkflowPickerOpenFor(pickerOpen ? null : wfKey)}
                                onSelectWorkflow={(picked) => onSelectAttrWorkflow(ctrl, selectedAttr, picked)}
                                onClearWorkflow={() => onClearAttrWorkflow(ctrl, selectedAttr)}
                                onBuildWorkflow={() => onBuildAttrWorkflow(ctrl, selectedAttr)}
                                onUploadEvidence={(et) => onUploadGenericEvidence(ctrl, selectedAttr, et)}
                                onReplaceEvidence={() => onReplaceGenericEvidence(ctrl, selectedAttr)}
                                onRunAi={() => onRunAttrAi(ctrl, selectedAttr)}
                                onSetHumanVerdict={(v) => setGenericByCtrl(prev => { const m = { ...(prev[ctrl.controlId] || {}) }; const cur = m[selectedAttr.id] || { evidence: {}, useAi: true, humanVerdict: 'Pass' as HumanVerdict, humanRemark: '', aiVerdict: null, aiConfidence: 0, aiRationale: '' }; m[selectedAttr.id] = { ...cur, useAi: false, humanVerdict: v }; return { ...prev, [ctrl.controlId]: m }; })}
                              />
                            ) : (
                              <SampleBasedAttrSection ctrl={ctrl} attr={selectedAttr}
                                expanded={true} onToggle={() => {}}
                                samples={samps}
                                rounds={roundsByCtrlAttr[wfKey] || []}
                                disabled={!ctrlHasSampling(ctrl.controlId)}
                                running={!!aiRunningByCtrl[wfKey]}
                                evidenceReady={sampleAttrEvidenceReady(ctrl, selectedAttr)}
                                allTested={sampleAttrAllTested(ctrl, selectedAttr)}
                                passCount={sampleAttrPasses(ctrl, selectedAttr).length}
                                failCount={sampleAttrFails(ctrl, selectedAttr).length}
                                validationWorkflow={wf}
                                pickerOpen={pickerOpen}
                                onTogglePicker={() => setWorkflowPickerOpenFor(pickerOpen ? null : wfKey)}
                                onSelectWorkflow={(picked) => onSelectAttrWorkflow(ctrl, selectedAttr, picked)}
                                onClearWorkflow={() => onClearAttrWorkflow(ctrl, selectedAttr)}
                                onBuildWorkflow={() => onBuildAttrWorkflow(ctrl, selectedAttr)}
                                onUploadEvidence={(sid, et) => onUploadSampleEvidence(ctrl, selectedAttr, sid, et)}
                                onRemoveEvidence={(sid, et) => onRemoveSampleEvidence(ctrl, selectedAttr, sid, et)}
                                onBulkUpload={() => onBulkUploadSampleEvidence(ctrl, selectedAttr)}
                                onRunAi={() => onRunAttrAi(ctrl, selectedAttr)}
                                onOverride={(sid, patch) => onOverrideSample(ctrl, selectedAttr, sid, patch)}
                                onStartRound={() => onStartRound(ctrl, selectedAttr)}
                              />
                            );
                          })() : <p className="text-[11px] text-text-muted">Select an attribute on the left.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeCheckpoint === 4 && (
                  <WorkingPaperCheckpoint ctrl={ctrl}
                    attrsDone={attrsDone}
                    attrsTotal={ctrl.attributes.length}
                    failedSampleAttrs={ctrl.attributes.filter(a => attrScope(a) === 'SAMPLE_BASED' && sampleAttrFails(ctrl, a).length > 0).length}
                    onGenerate={() => { addToast({ type: 'success', message: `Generating ${ctrl.controlId}-Working-Paper.pdf …` }); logEvent({ action: 'Export', description: `Generated working paper ${ctrl.controlId}-Working-Paper.pdf`, module: 'Engagements', entity: 'Working Paper' }); }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Audit trail (compact, always-on at bottom of detail) */}
            {(auditTrails[ctrl.controlId]?.length || 0) > 0 && (
              <details className="mt-5 rounded-xl border border-canvas-border bg-white">
                <summary className="px-4 py-3 cursor-pointer text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                  <Activity size={11} />Audit trail · {auditTrails[ctrl.controlId]!.length} event{auditTrails[ctrl.controlId]!.length !== 1 ? 's' : ''}
                </summary>
                <div className="px-4 py-3 border-t border-canvas-border space-y-1.5 max-h-[240px] overflow-y-auto">
                  {auditTrails[ctrl.controlId]!.map(e => (
                    <div key={e.id} className="flex items-start gap-2 text-[10.5px]">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${e.actor === 'human' ? 'bg-brand-500' : e.actor === 'ai' ? 'bg-evidence-500' : 'bg-text-muted'}`} />
                      <span className="text-text-muted shrink-0 tabular-nums w-12">{e.relTime}</span>
                      <span className="font-semibold text-text shrink-0">{e.actorName}</span>
                      <span className="text-text-secondary truncate">{e.text}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
        </div>
      </div>
    );
  }

  // ─── LIST MODE ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* KPI row — borderless inline stats (out of the box), trimmed to the essentials */}
      <div className="flex flex-wrap items-center gap-y-3 px-1">
        {([
          { label: 'Controls', value: allControls.length, sub: 'in scope', tone: 'text-text' },
          { label: 'Attributes', value: kpis.totalAttrs, sub: 'across controls', tone: 'text-text' },
          { label: 'Validated', value: kpis.validated, sub: `${kpis.passes}P · ${kpis.fails}F`, tone: kpis.fails > 0 ? 'text-risk-700' : 'text-text' },
          { label: 'Pass rate', value: `${kpis.passRate}%`, sub: kpis.validated === 0 ? '—' : `of ${kpis.validated}`, tone: kpis.passRate >= 90 ? 'text-compliant-700' : kpis.passRate >= 70 ? 'text-mitigated-700' : 'text-risk-700' },
          { label: 'Pending', value: kpis.evPending, sub: 'evidence gaps', tone: kpis.evPending > 0 ? 'text-mitigated-700' : 'text-text' },
          { label: 'Completion', value: `${kpis.overall}%`, sub: 'overall', tone: kpis.overall >= 80 ? 'text-compliant-700' : kpis.overall >= 50 ? 'text-mitigated-700' : 'text-text' },
        ] as { label: string; value: string | number; sub: string; tone: string }[]).map(s => (
          <div key={s.label} className="pl-5 ml-5 border-l border-canvas-border first:pl-0 first:ml-0 first:border-l-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted">{s.label}</div>
            <div className={`text-[19px] font-bold tabular-nums leading-tight ${s.tone}`}>{s.value}</div>
            <div className="text-[10.5px] text-text-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex items-center gap-1">
            {(['All', 'Complete', 'In progress', 'Not started'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${statusFilter === s
                  ? 'bg-brand-50 text-brand-700 border border-brand-100'
                  : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Sub-process</span>
            {['All', ...subProcessNames].map(sp => (
              <button key={sp} onClick={() => setSubProcessFilter(sp)}
                className={`px-2.5 h-7 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${subProcessFilter === sp
                  ? 'bg-ink-800 text-white border border-ink-800'
                  : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{sp}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">Group by</span>
            <div className="inline-flex rounded-md border border-canvas-border overflow-hidden">
              {([['none', 'None'], ['subProcess', 'Sub-process']] as [GroupBy, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setGroupBy(val)}
                  className={`px-2.5 h-7 text-[11.5px] font-medium transition-colors cursor-pointer ${groupBy === val
                    ? 'bg-ink-800 text-white'
                    : 'bg-white text-ink-600 hover:bg-canvas'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="relative w-[320px] max-w-full">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search control id, attribute, or evidence type…"
              className="w-full pl-7 pr-2.5 h-7 border border-canvas-border rounded-md text-[12px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 placeholder:text-ink-400" />
          </div>
        </div>
      </div>

      {/* Control list — flat by default; grouped by sub-process only when opted in. */}
      {flatControls.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="text-[13px] font-semibold text-text mb-1">No controls match these filters</p>
          <p className="text-[12px] text-text-muted">Try clearing a filter or broadening your search.</p>
        </div>
      ) : groupBy === 'none' ? (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-canvas-border flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Controls</span>
            <span className="text-[11px] text-text-muted tabular-nums">{flatControls.length} total</span>
          </div>
          <div className="py-1">
            {flatControls.map(ctrl => (
              <ControlRow key={ctrl.controlId} ctrl={ctrl} {...rowPropsFor(ctrl)} onOpen={() => openControl(ctrl.controlId)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map(group => {
            const isOpen = expandedSub.has(group.subProcess);
            const counts = subProcessCounts(group.controls, controlStatus);
            return (
              <div key={group.subProcess} className="glass-card rounded-xl overflow-hidden">
                <button onClick={() => toggleSub(group.subProcess)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors cursor-pointer text-left">
                  <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><Layers size={13} className="text-brand-600" /></div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-text">{group.subProcess}</span>
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {group.controls.length} control{group.controls.length === 1 ? '' : 's'}
                      <span className="text-border mx-1.5">·</span>
                      <span className="text-compliant-700 font-semibold">{counts.complete} ready</span>
                      <span className="text-border mx-1.5">·</span>
                      <span className="text-evidence-700 font-semibold">{counts.inProgress} in progress</span>
                    </span>
                  </div>
                  <ChevronRight size={14} className={`text-text-muted transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden border-t border-canvas-border">
                      <div className="py-1 bg-canvas/30">
                        {group.controls.map(ctrl => (
                          <ControlRow key={ctrl.controlId} ctrl={ctrl} {...rowPropsFor(ctrl)} onOpen={() => openControl(ctrl.controlId)} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Control list row (shared by flat + grouped renderers) ────────────────────

function ControlRow({ ctrl, status, stepCompletion, attrsTotal, pct, codes, onOpen }: {
  ctrl: DistinctControl;
  status: ControlStatus;
  stepCompletion: [boolean, boolean, boolean];
  attrsTotal: number;
  pct: number;
  codes: string[];
  onOpen: () => void;
}): JSX.Element {
  return (
    <button onClick={onOpen}
      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white transition-colors cursor-pointer text-left border-l-2 border-transparent hover:border-brand-300">
      <Shield size={12} className="text-brand-600 shrink-0" />
      <span className="font-mono text-[11.5px] font-semibold text-brand-700 shrink-0 w-[80px]">{ctrl.controlId}</span>
      {ctrl.isKey && <span className="px-1 h-4 inline-flex items-center rounded text-[8.5px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-100 shrink-0">Key</span>}
      <span className="text-[12px] text-text truncate flex-1 min-w-0">{ctrl.description}</span>
      <WorkflowReadiness codes={codes} />
      <span className="text-[10.5px] text-text-muted shrink-0 tabular-nums w-[52px] text-right">{attrsTotal} attr</span>
      <div className="shrink-0 w-[72px]">
        <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-compliant-500' : pct > 0 ? 'bg-brand-500' : 'bg-canvas-border'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[8.5px] text-text-muted tabular-nums mt-0.5 block">{pct}%</span>
      </div>
      <MiniStepIndicator stepCompletion={stepCompletion} />
      <ControlStatusPill status={status} />
      <ChevronRight size={12} className="text-text-muted shrink-0" />
    </button>
  );
}

/** Validation-readiness badge — carries the attribute→workflow links mapped on the Controls tab. */
function WorkflowReadiness({ codes }: { codes: string[] }): JSX.Element {
  if (codes.length === 0) {
    return (
      <span title="No validation workflow linked — tested manually"
        className="inline-flex items-center px-1.5 h-5 rounded-full text-[9.5px] font-semibold border bg-canvas text-text-muted border-canvas-border shrink-0">
        Manual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span title={codes.join(', ')}
        className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md bg-brand-50 border border-brand-100 text-[9.5px] font-mono font-semibold text-brand-700">
        <WorkflowIcon size={9} />{codes[0]}{codes.length > 1 ? ` +${codes.length - 1}` : ''}
      </span>
      <span title="Validation workflow linked in Controls"
        className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full text-[9.5px] font-semibold bg-compliant-50 text-compliant-700 border border-compliant-50">
        <CheckCircle2 size={9} />Validation ready
      </span>
    </span>
  );
}

// ─── Outer helpers ───────────────────────────────────────────────────────────

function subProcessCounts(controls: DistinctControl[], statusFn: (c: DistinctControl) => ControlStatus) {
  let complete = 0, inProgress = 0;
  controls.forEach(c => {
    const s = statusFn(c);
    if (s === 'Working paper ready') complete += 1;
    else if (s !== 'Not started') inProgress += 1;
  });
  return { complete, inProgress };
}

function MiniStepIndicator({ stepCompletion }: { stepCompletion: [boolean, boolean, boolean] }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-0 shrink-0" aria-label="step progress">
      {[0, 1, 2].map(i => (
        <span key={i} className="inline-flex items-center">
          <span className={`w-2.5 h-2.5 rounded-full border ${stepCompletion[i] ? 'bg-compliant border-compliant' : 'bg-white border-border'}`} />
          {i < 2 && <span className={`w-3 h-px ${stepCompletion[i] && stepCompletion[i + 1] ? 'bg-compliant' : 'bg-border'}`} />}
        </span>
      ))}
    </span>
  );
}

function ControlStatusPill({ status }: { status: ControlStatus }): JSX.Element {
  const cls = status === 'Working paper ready' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : status === 'Validated' ? 'bg-evidence-50 text-evidence-700 border-evidence-100'
      : status === 'In progress' ? 'bg-mitigated-50 text-mitigated-700 border-mitigated-50'
        : 'bg-draft-50 text-draft-700 border-canvas-border';
  return <span className={`inline-flex items-center px-2 h-6 rounded-full text-[10.5px] font-semibold border shrink-0 ${cls}`}>{status}</span>;
}

// ─── Section: Population ─────────────────────────────────────────────────────

function PopulationSection({ ctrl, population, onUpload, onReplace }: {
  ctrl: DistinctControl; population: PopulationState | undefined; onUpload: () => void; onReplace: () => void;
}): JSX.Element {
  return (
    <SectionShell num={1} title="Define population" sub="Upload the control's dataset. One file covers the whole control." done={!!population}>
      {population ? (
        <div className="rounded-lg border border-compliant-100 bg-compliant-50/30 px-4 py-3 flex items-center gap-3">
          <Database size={14} className="text-compliant-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-text font-medium truncate">{population.filename}</div>
            <div className="text-[10px] text-text-muted">{population.rows.toLocaleString()} rows · uploaded {population.uploadedAgo}</div>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-compliant-50 text-compliant-700 border border-compliant-100">Locked</span>
          <button onClick={onReplace} className="text-[10px] text-text-muted hover:text-brand-600 cursor-pointer">Replace</button>
        </div>
      ) : (
        <button onClick={onUpload}
          className="w-full rounded-lg border-2 border-dashed border-brand-200 bg-brand-50/30 hover:bg-brand-50/60 py-6 px-4 cursor-pointer transition-colors flex flex-col items-center gap-2">
          <Upload size={16} className="text-brand-600" />
          <span className="text-[12px] font-semibold text-brand-700">Upload population (.xlsx / .csv)</span>
          <span className="text-[10px] text-text-muted">For demo this generates a synthetic dataset based on the control's seed.</span>
        </button>
      )}
    </SectionShell>
  );
}

// ─── Section: Sampling ───────────────────────────────────────────────────────

function SamplingSection({ ctrl, disabled, config, samples, sampleBasedCount, onSet, onGenerate, onBuildWorkflow }: {
  ctrl: DistinctControl; disabled: boolean;
  config: SamplingConfig | undefined; samples: GeneratedSample[]; sampleBasedCount: number;
  onSet: (patch: Partial<SamplingConfig>) => void;
  onGenerate: () => void;
  onBuildWorkflow: () => void;
}): JSX.Element {
  const method = config?.method ?? 'Random';
  const size = config?.sampleSize ?? 25;
  const done = (samples?.length || 0) > 0;
  void ctrl;
  return (
    <SectionShell num={2} title="Configure sampling" sub={`One sample set shared across ${sampleBasedCount} sample-based attribute${sampleBasedCount !== 1 ? 's' : ''}.`} done={done} disabled={disabled}>
      {disabled ? (
        <p className="text-[11px] text-text-muted flex items-center gap-1.5"><Lock size={11} />Upload the population first.</p>
      ) : (
        <div className="space-y-3">
          {/* Method picker */}
          <div>
            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Method</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { m: 'Random' as SampleMethod, icon: Shuffle, desc: 'Uniform random draw' },
                { m: 'Statistical' as SampleMethod, icon: Sparkles, desc: 'Stratified / confidence-based' },
                { m: 'Column-filter' as SampleMethod, icon: Settings2, desc: 'WHERE col = …' },
                { m: 'Workflow' as SampleMethod, icon: WorkflowIcon, desc: 'Custom workflow' },
              ]).map(o => {
                const Icon = o.icon;
                const active = method === o.m;
                return (
                  <button key={o.m} onClick={() => onSet({ method: o.m })}
                    className={`px-2 py-2 rounded-lg border text-left cursor-pointer transition-colors ${active ? 'border-brand-500 bg-brand-50/30 ring-1 ring-brand-200' : 'border-canvas-border hover:border-brand-200'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon size={11} className={active ? 'text-brand-700' : 'text-text-muted'} />
                      <span className={`text-[11px] font-bold ${active ? 'text-brand-700' : 'text-text'}`}>{o.m}</span>
                    </div>
                    <p className="text-[9px] text-text-muted leading-tight">{o.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Config row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Sample size</label>
              <input type="number" min={1} max={5000} value={size} onChange={e => onSet({ sampleSize: Math.max(1, Math.min(5000, Number(e.target.value) || 1)) })}
                disabled={method === 'Workflow'}
                className="w-full px-2.5 py-1.5 border border-canvas-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-brand-400 transition-all disabled:bg-canvas disabled:text-text-muted" />
            </div>
            {method === 'Column-filter' && (
              <div>
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Filter</label>
                <input value={config?.filterDescription || ''} onChange={e => onSet({ filterDescription: e.target.value })}
                  placeholder="e.g. amount > 100000 AND status = 'OPEN'"
                  className="w-full px-2.5 py-1.5 border border-canvas-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-brand-400 transition-all" />
              </div>
            )}
            {method === 'Workflow' && (
              <div className="flex items-end">
                <button onClick={onBuildWorkflow}
                  className="w-full px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50/30 text-brand-700 text-[11px] font-semibold cursor-pointer hover:bg-brand-50 transition-colors flex items-center justify-center gap-1.5">
                  <Wand2 size={11} />Build sampling workflow
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onGenerate} disabled={method === 'Workflow'}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Shuffle size={11} />{done ? 'Regenerate samples' : 'Generate samples'}
            </button>
            {done && <span className="text-[10px] text-text-muted">{samples!.length} sample{samples!.length !== 1 ? 's' : ''} ready</span>}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Validation workflows ───────────────────────────────────────────

function ValidationWorkflowsSection({ ctrl, workflows, onAdd, onRemove }: {
  ctrl: DistinctControl; workflows: ValidationWorkflow[]; onAdd: () => void; onRemove: (wfId: string) => void;
}): JSX.Element {
  const empty = workflows.length === 0;
  void ctrl;
  return (
    <SectionShell num={3} title="Evidence validation workflows" sub="Auto-validate uploaded evidence with workflows (OCR, signature check, amount tolerance, …)." done={!empty} optional>
      {empty ? (
        <div className="rounded-xl border-2 border-dashed border-evidence-200/60 bg-evidence-50/20 px-4 py-5 flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-evidence-100 flex items-center justify-center"><WorkflowIcon size={16} className="text-evidence-700" /></div>
          <div className="flex-1 min-w-0">
            <h6 className="text-[12px] font-bold text-evidence-800">No workflows configured</h6>
            <p className="text-[10.5px] text-evidence-700 mt-0.5">Auto-validation reduces manual P/F. Build a workflow with IRA — describe the check in plain English and the agent scaffolds it.</p>
          </div>
          <button onClick={onAdd}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-evidence-600 hover:bg-evidence-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <Sparkles size={11} />Build with IRA
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-end -mt-1">
            <button onClick={onAdd} className="text-[11px] text-brand-700 hover:underline cursor-pointer flex items-center gap-0.5"><Plus size={10} />Add workflow</button>
          </div>
          {workflows.map(wf => (
            <div key={wf.id} className="rounded-lg border border-canvas-border bg-white px-3 py-2 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-evidence-50 flex items-center justify-center"><WorkflowIcon size={12} className="text-evidence-700" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-text truncate">{wf.name}</div>
                <div className="text-[10px] text-text-muted truncate">{wf.description}</div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${wf.status === 'ACTIVE' ? 'bg-compliant-50 text-compliant-700' : wf.status === 'ERROR' ? 'bg-risk-50 text-risk-700' : 'bg-canvas text-text-muted'}`}>{wf.status}</span>
              <button onClick={() => onRemove(wf.id)} className="text-[10px] text-text-muted hover:text-risk-600 cursor-pointer"><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Sample-based attribute ─────────────────────────────────────────

function SampleBasedAttrSection({ ctrl, attr, expanded, onToggle, samples, rounds, disabled, running, evidenceReady, allTested, passCount, failCount, validationWorkflow, pickerOpen, onTogglePicker, onSelectWorkflow, onClearWorkflow, onBuildWorkflow, onUploadEvidence, onRemoveEvidence, onBulkUpload, onRunAi, onOverride, onStartRound }: {
  ctrl: DistinctControl; attr: ControlAttribute;
  expanded: boolean; onToggle: () => void;
  samples: GeneratedSample[]; rounds: AttributeRound[];
  disabled: boolean; running: boolean;
  evidenceReady: boolean; allTested: boolean;
  passCount: number; failCount: number;
  validationWorkflow: ValidationWorkflow | undefined;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onSelectWorkflow: (wf: ValidationWorkflow) => void;
  onClearWorkflow: () => void;
  onBuildWorkflow: () => void;
  onUploadEvidence: (sid: string, et: string) => void;
  onRemoveEvidence: (sid: string, et: string) => void;
  onBulkUpload: () => void;
  onRunAi: () => void;
  onOverride: (sid: string, patch: Partial<AttrVerdict>) => void;
  onStartRound: () => void;
}): JSX.Element {
  const activeRound = rounds[rounds.length - 1];
  void ctrl;
  const bulkRef = useRef<HTMLInputElement | null>(null);
  const samplesWithEvidence = samples.filter(s => attr.requiredEvidence.every(et => !!s.evidence[attr.id]?.[et])).length;
  // Fail → Pass overrides require a justification comment.
  const [passOverride, setPassOverride] = useState<{ sampleId: string } | null>(null);
  const [overrideComment, setOverrideComment] = useState('');

  return (
    <div className={`rounded-xl border ${expanded ? 'border-brand-200 bg-white' : 'border-canvas-border bg-white'} overflow-hidden`}>
      <button onClick={onToggle} disabled={disabled}
        className={`w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors ${expanded ? 'bg-brand-50/40' : 'hover:bg-canvas/40'} disabled:cursor-not-allowed disabled:opacity-60`}>
        <div className="flex items-center gap-3 min-w-0">
          {disabled ? <Lock size={11} className="text-text-muted" /> : <ChevronDown size={12} className={`text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-text-muted">{attrCode(attr.id)}</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-50 text-brand-700 border border-brand-100">SAMPLE-BASED</span>
              {rounds.length > 1 && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-mitigated-50 text-mitigated-700">R{activeRound!.roundNumber}</span>}
            </div>
            <div className="text-[12px] font-semibold text-text truncate">{attr.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {failCount > 0 && <span className="text-[10px] font-bold text-risk-700 tabular-nums">{failCount} fail</span>}
          {passCount > 0 && <span className="text-[10px] font-bold text-compliant-700 tabular-nums">{passCount} pass</span>}
          {!allTested && samples.length > 0 && <span className="text-[10px] text-text-muted tabular-nums">{samples.length - passCount - failCount} pending</span>}
        </div>
      </button>

      {expanded && !disabled && (
        <div className="border-t border-canvas-border px-5 py-5 space-y-4">
          {/* Description + required evidence */}
          <DescriptionBlock attr={attr} />

          {/* Test procedure */}
          <div className="rounded-lg bg-canvas/30 border border-canvas-border px-3 py-2.5">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">Test procedure</span>
            <p className="text-[11px] text-text-secondary leading-relaxed">{attr.testProcedure}</p>
          </div>

          {/* Validation workflow selector */}
          <WorkflowPicker workflow={validationWorkflow} open={pickerOpen} onToggle={onTogglePicker}
            onSelect={onSelectWorkflow} onClear={onClearWorkflow} onBuild={onBuildWorkflow} />

          {/* Bulk evidence upload — attach the required evidence to every sample at once */}
          {samples.length > 0 && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/30 px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-brand-50 shrink-0"><Upload size={13} className="text-brand-600" /></div>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-semibold text-text">Bulk evidence upload</div>
                  <div className="text-[10px] text-text-muted">Attach the required evidence to every sample in one go · <span className="tabular-nums font-medium">{samplesWithEvidence}/{samples.length}</span> samples have all evidence</div>
                </div>
              </div>
              <input
                ref={bulkRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files && e.target.files.length > 0) onBulkUpload(); e.target.value = ''; }}
              />
              <button
                onClick={() => bulkRef.current?.click()}
                disabled={evidenceReady}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-ink-300 disabled:cursor-not-allowed text-white text-[11.5px] font-semibold cursor-pointer transition-colors"
                title="Upload evidence files and apply them across all samples"
              >
                <Upload size={12} /> {evidenceReady ? 'All evidence uploaded' : 'Bulk upload for all samples'}
              </button>
            </div>
          )}

          {/* Per-sample table */}
          <div className="rounded-lg border border-canvas-border overflow-hidden">
            <table className="w-full text-[11.5px]">
              <thead className="bg-canvas/40 border-b border-canvas-border">
                <tr>
                  <th className="px-3 py-1.5 text-left text-[9px] font-bold text-text-muted uppercase">#</th>
                  <th className="px-3 py-1.5 text-left text-[9px] font-bold text-text-muted uppercase">Sample</th>
                  {attr.requiredEvidence.map(et => (
                    <th key={et} className="px-3 py-1.5 text-left text-[9px] font-bold text-text-muted uppercase">{et}</th>
                  ))}
                  <th className="px-3 py-1.5 text-left text-[9px] font-bold text-text-muted uppercase">Result</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s, idx) => {
                  const inScope = !activeRound || activeRound.sampleIds.includes(s.id) || rounds.length <= 1;
                  const v = s.verdicts[attr.id];
                  const effective = v?.useAi ? v?.aiVerdict : v?.humanVerdict;
                  return (
                    <tr key={s.id} className={`border-b border-canvas-border/60 last:border-b-0 ${inScope ? '' : 'opacity-40'}`}>
                      <td className="px-3 py-2.5 text-text-muted tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-text">{s.id}</td>
                      {attr.requiredEvidence.map(et => {
                        const file = s.evidence[attr.id]?.[et];
                        return (
                          <td key={et} className="px-3 py-2.5">
                            {file ? (
                              <span className="inline-flex items-center gap-1 text-compliant-700">
                                <Paperclip size={9} /><span className="truncate max-w-[140px]">{file.filename}</span>
                                <button onClick={() => onRemoveEvidence(s.id, et)} className="ml-1 text-text-muted hover:text-risk-600"><X size={9} /></button>
                              </span>
                            ) : (
                              <button onClick={() => onUploadEvidence(s.id, et)} disabled={!inScope}
                                className="inline-flex items-center gap-0.5 text-brand-700 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                                <Upload size={9} />Upload
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ResultPill effective={effective ?? null} overridden={!!v && !v.useAi} />
                          {effective && (
                            <div className="flex items-center gap-1">
                              {effective !== 'Pass' && (
                                <button onClick={() => { setPassOverride({ sampleId: s.id }); setOverrideComment(''); }}
                                  title="Override to Pass (requires a comment)"
                                  className="px-1.5 h-5 inline-flex items-center rounded text-[9.5px] font-semibold text-compliant-700 border border-compliant-100 hover:bg-compliant-50 cursor-pointer transition-colors">Pass</button>
                              )}
                              {effective !== 'Fail' && (
                                <button onClick={() => onOverride(s.id, { useAi: false, humanVerdict: 'Fail' })}
                                  title="Override to Fail"
                                  className="px-1.5 h-5 inline-flex items-center rounded text-[9.5px] font-semibold text-risk-700 border border-risk-100 hover:bg-risk-50 cursor-pointer transition-colors">Fail</button>
                              )}
                            </div>
                          )}
                        </div>
                        {v?.humanRemark && (
                          <div className="flex items-start gap-1 mt-1 text-[9.5px] text-text-muted max-w-[260px]">
                            <MessageSquare size={9} className="mt-0.5 shrink-0 text-mitigated-600" />
                            <span className="line-clamp-2 italic">“{v.humanRemark}”</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <RunValidationBar
            running={running}
            evidenceReady={evidenceReady}
            allTested={allTested}
            validationWorkflow={validationWorkflow}
            onRunAi={onRunAi}
            onBuildWorkflow={onBuildWorkflow}
            onPickWorkflow={onTogglePicker}
          />

          {/* Round trigger */}
          {allTested && failCount > 0 && (
            <button onClick={onStartRound}
              className="w-full rounded-lg border-2 border-dashed border-mitigated-200 bg-mitigated-50/30 hover:bg-mitigated-50/60 py-2.5 px-3 cursor-pointer transition-colors flex items-center justify-center gap-2">
              <RotateCcw size={11} className="text-mitigated-700" />
              <span className="text-[11px] font-semibold text-mitigated-700">Start Round {(activeRound?.roundNumber || 1) + 1} for {failCount} failed sample{failCount !== 1 ? 's' : ''} — fresh evidence required</span>
            </button>
          )}

          {/* All-pass ribbon */}
          {allTested && failCount === 0 && (
            <div className="rounded-lg border border-compliant-100 bg-compliant-50/40 px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={12} className="text-compliant-700" />
              <span className="text-[11px] text-compliant-700 font-medium">All samples passed across {rounds.length || 1} round{(rounds.length || 1) !== 1 ? 's' : ''}.</span>
            </div>
          )}
        </div>
      )}

      {/* Override-to-Pass justification (required) */}
      {passOverride && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={() => setPassOverride(null)} />
          <div className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-compliant-50 shrink-0"><CheckCircle2 size={18} className="text-compliant-700" /></div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-text">Override to Pass</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Sample <span className="font-mono font-semibold text-text">{passOverride.sampleId}</span> failed validation. A justification is required to override it to Pass.</p>
              </div>
            </div>
            <textarea
              autoFocus
              value={overrideComment}
              onChange={e => setOverrideComment(e.target.value)}
              rows={3}
              placeholder="Why does this sample pass despite the failure? (required)"
              className="w-full px-3 py-2.5 text-[12.5px] border border-canvas-border rounded-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 resize-none placeholder:text-text-muted leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setPassOverride(null)} className="px-3.5 py-2 rounded-lg border border-canvas-border text-[12.5px] font-medium text-ink-600 hover:bg-canvas cursor-pointer transition-colors">Cancel</button>
              <button
                onClick={() => { onOverride(passOverride.sampleId, { useAi: false, humanVerdict: 'Pass', humanRemark: overrideComment.trim() }); setPassOverride(null); }}
                disabled={!overrideComment.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-compliant-500 hover:opacity-90 disabled:bg-ink-300 disabled:cursor-not-allowed text-white text-[12.5px] font-semibold cursor-pointer transition-opacity"
              >
                <CheckCircle2 size={14} /> Override to Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result pill (sample verdict) ────────────────────────────────────────────

function ResultPill({ effective, overridden }: { effective: 'Pass' | 'Fail' | 'Hold' | null; overridden: boolean }): JSX.Element {
  if (!effective) return <span className="text-text-muted text-[13px]">—</span>;
  const map = {
    Pass: { cls: 'bg-compliant-50 text-compliant-700 border-compliant-100', Icon: CheckCircle2 },
    Fail: { cls: 'bg-risk-50 text-risk-700 border-risk-100', Icon: XCircle },
    Hold: { cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated-100', Icon: Clock },
  } as const;
  const { cls, Icon } = map[effective];
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11.5px] font-bold border ${cls}`}>
      <Icon size={13} />{effective}
      {overridden && <span className="text-[8.5px] font-semibold uppercase tracking-wide opacity-70 ml-0.5">· you</span>}
    </span>
  );
}

// ─── Section: Generic attribute ──────────────────────────────────────────────

function GenericAttrSection({ ctrl, attr, expanded, onToggle, result, running, validationWorkflow, pickerOpen, onTogglePicker, onSelectWorkflow, onClearWorkflow, onBuildWorkflow, onUploadEvidence, onReplaceEvidence, onRunAi, onSetHumanVerdict }: {
  ctrl: DistinctControl; attr: ControlAttribute;
  expanded: boolean; onToggle: () => void;
  result: GenericResult | undefined; running: boolean;
  validationWorkflow: ValidationWorkflow | undefined;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onSelectWorkflow: (wf: ValidationWorkflow) => void;
  onClearWorkflow: () => void;
  onBuildWorkflow: () => void;
  onUploadEvidence: (et: string) => void;
  onReplaceEvidence: () => void;
  onRunAi: () => void;
  onSetHumanVerdict: (v: HumanVerdict) => void;
}): JSX.Element {
  void ctrl;
  const effective = result?.useAi ? result?.aiVerdict : result?.humanVerdict;
  const evCount = attr.requiredEvidence.filter(et => !!result?.evidence[et]).length;
  const evComplete = evCount === attr.requiredEvidence.length;

  return (
    <div className={`rounded-xl border ${expanded ? 'border-mitigated-200 bg-white' : 'border-canvas-border bg-white'} overflow-hidden`}>
      <button onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors ${expanded ? 'bg-mitigated-50/30' : 'hover:bg-canvas/40'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown size={12} className={`text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-text-muted">{attrCode(attr.id)}</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-mitigated-50 text-mitigated-700 border border-mitigated-100">GENERIC</span>
            </div>
            <div className="text-[12px] font-semibold text-text truncate">{attr.description}</div>
            <div className="text-[10px] text-text-muted truncate">Control-level check · no sample loop</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {effective === 'Pass' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-compliant-50 text-compliant-700">Pass</span>}
          {effective === 'Fail' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-risk-50 text-risk-700">Fail</span>}
          {!effective && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-canvas text-text-muted">Pending</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-canvas-border px-5 py-5 space-y-4">
          <DescriptionBlock attr={attr} />
          <div className="rounded-lg bg-canvas/30 border border-canvas-border px-3 py-2.5">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block mb-1">Test procedure</span>
            <p className="text-[11px] text-text-secondary leading-relaxed">{attr.testProcedure}</p>
          </div>

          {/* Validation workflow selector */}
          <WorkflowPicker workflow={validationWorkflow} open={pickerOpen} onToggle={onTogglePicker}
            onSelect={onSelectWorkflow} onClear={onClearWorkflow} onBuild={onBuildWorkflow} />

          {/* Evidence uploads (one per required evidence type) */}
          <div className="rounded-lg border border-canvas-border overflow-hidden">
            <div className="px-3 py-2 bg-canvas/40 border-b border-canvas-border flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Evidence</span>
              <span className="text-[9px] text-text-muted tabular-nums">{evCount}/{attr.requiredEvidence.length}</span>
            </div>
            <div className="divide-y divide-canvas-border">
              {attr.requiredEvidence.map(et => {
                const file = result?.evidence[et];
                return (
                  <div key={et} className="px-3 py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-text truncate">{et}</div>
                    </div>
                    {file ? (
                      <span className="text-[10px] text-compliant-700 inline-flex items-center gap-1"><Paperclip size={9} />{file.filename}</span>
                    ) : (
                      <button onClick={() => onUploadEvidence(et)}
                        className="text-[10px] text-brand-700 hover:underline cursor-pointer inline-flex items-center gap-0.5"><Upload size={9} />Upload</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <RunValidationBar
            running={running}
            evidenceReady={evComplete}
            allTested={!!effective}
            validationWorkflow={validationWorkflow}
            onRunAi={onRunAi}
            onBuildWorkflow={onBuildWorkflow}
            onPickWorkflow={onTogglePicker}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted mr-1">Manual override:</span>
            <button onClick={() => onSetHumanVerdict('Pass')} disabled={!evComplete}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-compliant-50 text-compliant-700 hover:bg-compliant-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Pass</button>
            <button onClick={() => onSetHumanVerdict('Fail')} disabled={!evComplete}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-risk-50 text-risk-700 hover:bg-risk-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Fail</button>
            {effective === 'Fail' && (
              <button onClick={onReplaceEvidence} className="ml-auto text-[10px] text-mitigated-700 hover:underline cursor-pointer inline-flex items-center gap-0.5"><RotateCcw size={9} />Replace evidence and retry</button>
            )}
          </div>

          {result?.aiRationale && (
            <div className="rounded-lg border border-evidence-100 bg-evidence-50/30 px-3 py-2 text-[10.5px]">
              <span className="text-evidence-700 font-semibold">AI rationale ({result.aiConfidence}% confidence):</span>
              <span className="text-text-secondary ml-1">{result.aiRationale}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section shell ───────────────────────────────────────────────────────────

function SectionShell({ num, title, sub, done, disabled, optional, children }: {
  num: number; title: string; sub?: string; done?: boolean; disabled?: boolean; optional?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-canvas-border bg-white">
      <div className="px-6 py-4 border-b border-canvas-border flex items-center gap-3">
        <StepBadge num={num} done={done} disabled={disabled} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-[14px] font-bold text-text">{title}</h5>
            {optional && <span className="text-[10px] text-text-muted font-medium">(optional)</span>}
          </div>
          {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function StepBadge({ num, done, disabled }: { num: number; done?: boolean; disabled?: boolean }): JSX.Element {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
      disabled ? 'bg-canvas text-text-muted'
        : done ? 'bg-compliant-500 text-white'
        : 'bg-brand-600 text-white'
    }`}>{done ? <Check size={11} /> : num}</div>
  );
}

function DescriptionBlock({ attr }: { attr: ControlAttribute }): JSX.Element {
  return (
    <div className="rounded-lg bg-brand-50/20 border border-brand-100/60 px-3 py-2.5">
      {attr.requiredEvidence.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Required evidence</span>
          {attr.requiredEvidence.map((et, i) => (
            <div key={et} className="flex items-start gap-2">
              <Paperclip size={9} className="text-text-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-text">{et}</span>
                {attr.evidenceDescriptions?.[i] && (
                  <p className="text-[10px] text-text-muted leading-snug">{attr.evidenceDescriptions[i]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Checkpoint header (horizontal strip with 4 phases) ──────────────────────

function CheckpointHeader({ phases }: { phases: { label: string; done: boolean }[] }): JSX.Element {
  return (
    <div className="rounded-2xl border border-canvas-border bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        {phases.map((p, i) => {
          const active = !p.done && (i === 0 || phases[i - 1]!.done);
          return (
            <div key={p.label} className="flex items-center gap-2 flex-1">
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                p.done ? 'bg-compliant-500 border-compliant-500 text-white'
                  : active ? 'bg-brand-50 border-brand-500 text-brand-700'
                  : 'bg-canvas border-canvas-border text-text-muted'
              }`}>{p.done ? <Check size={12} /> : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-bold tracking-wide ${
                  p.done ? 'text-compliant-700' : active ? 'text-brand-700' : 'text-text-muted'
                }`}>
                  {p.label}
                </div>
                <div className="text-[9px] text-text-muted uppercase tracking-wider">
                  {p.done ? 'Complete' : active ? 'In progress' : 'Locked'}
                </div>
              </div>
              {i < phases.length - 1 && (
                <div className={`hidden sm:block flex-shrink-0 w-8 h-px ${phases[i + 1]!.done || (active && p.done) ? 'bg-compliant-300' : 'bg-canvas-border'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Working Paper checkpoint ────────────────────────────────────────────────

function WorkingPaperCheckpoint({ ctrl, attrsDone, attrsTotal, failedSampleAttrs, onGenerate }: {
  ctrl: DistinctControl;
  attrsDone: number;
  attrsTotal: number;
  failedSampleAttrs: number;
  onGenerate: () => void;
}): JSX.Element {
  void ctrl;
  const ready = attrsDone === attrsTotal && attrsTotal > 0;
  return (
    <SectionShell num={4} title="Working Paper" sub="The auditable record. Generated when every attribute has a result.">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="Attributes complete" value={`${attrsDone}/${attrsTotal}`} tone={ready ? 'text-compliant-700' : 'text-text-muted'} />
          <SummaryTile label="Failures" value={failedSampleAttrs} tone={failedSampleAttrs > 0 ? 'text-risk-700' : 'text-compliant-700'} />
          <SummaryTile label="Status" value={ready ? 'Ready' : 'Pending'} tone={ready ? 'text-compliant-700' : 'text-mitigated-700'} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onGenerate} disabled={!ready}
            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={11} />Generate working paper (PDF)
          </button>
          {!ready && <span className="text-[10px] text-text-muted">Finish testing all {attrsTotal} attribute{attrsTotal !== 1 ? 's' : ''} to enable.</span>}
        </div>
      </div>
    </SectionShell>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number | string; tone: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider font-bold text-text-muted mb-0.5">{label}</div>
      <div className={`text-[16px] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
    </div>
  );
}

// ─── Per-attribute validation workflow picker ────────────────────────────────

function WorkflowPicker({ workflow, open, onToggle, onSelect, onClear, onBuild }: {
  workflow: ValidationWorkflow | undefined;
  open: boolean;
  onToggle: () => void;
  onSelect: (wf: ValidationWorkflow) => void;
  onClear: () => void;
  onBuild: () => void;
}): JSX.Element {
  return (
    <div className="relative">
      <div className={`rounded-lg border ${workflow ? 'border-evidence-100 bg-evidence-50/20' : 'border-mitigated-100 bg-mitigated-50/20'} px-3 py-2.5 flex items-center gap-3`}>
        <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${workflow ? 'bg-evidence-100' : 'bg-mitigated-100'}`}>
          <WorkflowIcon size={12} className={workflow ? 'text-evidence-700' : 'text-mitigated-700'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Validation workflow</div>
          {workflow ? (
            <>
              <div className="text-[12px] font-semibold text-text truncate">{workflow.name}</div>
              <div className="text-[10px] text-text-muted truncate">{workflow.description}</div>
            </>
          ) : (
            <>
              <div className="text-[12px] font-semibold text-mitigated-700">Not configured</div>
              <div className="text-[10px] text-text-muted">Pick a prebuilt validator or build one in chat — optional but improves auto-validation.</div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {workflow && (
            <button onClick={onClear} className="text-[10px] text-text-muted hover:text-risk-600 cursor-pointer px-1.5 py-1">Clear</button>
          )}
          <button onClick={onToggle}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              workflow ? 'border border-canvas-border text-text-secondary hover:bg-white'
                : 'bg-mitigated-600 hover:bg-mitigated-700 text-white'
            }`}>
            {workflow ? 'Change' : 'Select'}<ChevronDown size={9} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-30 top-full mt-1 right-0 left-0 max-h-[280px] overflow-y-auto rounded-xl border border-canvas-border bg-white shadow-xl">
          <div className="px-3 py-2 border-b border-canvas-border bg-canvas/40">
            <h6 className="text-[10px] font-bold text-text uppercase tracking-wider">Pick a validation workflow</h6>
            <p className="text-[9px] text-text-muted mt-0.5">Picks a prebuilt validator for this attribute. The selected workflow runs whenever you click <em>Run validation</em>.</p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {AVAILABLE_VALIDATION_WORKFLOWS.map(wf => (
              <button key={wf.id} onClick={() => onSelect(wf)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-canvas/60 transition-colors cursor-pointer">
                <div className="flex items-start gap-2">
                  <WorkflowIcon size={11} className="text-evidence-700 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-semibold text-text">{wf.name}</div>
                    <div className="text-[10px] text-text-muted leading-snug">{wf.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="px-2 py-2 border-t border-canvas-border bg-canvas/40">
            <button onClick={onBuild}
              className="w-full px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5">
              <Wand2 size={11} />Build a new workflow with IRA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vertical gamified checkpoint rail ───────────────────────────────────────

function JourneyStepper({ phases, active, onJump, xp }: {
  phases: { num: 1 | 2 | 3 | 4; label: string; sub: string; done: boolean }[];
  active: 1 | 2 | 3 | 4;
  onJump: (n: 1 | 2 | 3 | 4) => void;
  xp: { samples: number; validated: number; total: number; passed: number; failed: number };
}): JSX.Element {
  const stat = (Icon: React.ElementType, value: number | string, label: string, tone: string) => (
    <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
      <Icon size={12} className={tone} />
      <span className={`font-bold tabular-nums ${tone}`}>{value}</span>
      <span className="text-text-muted">{label}</span>
    </div>
  );

  return (
    <div className="glass-card rounded-2xl px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Horizontal stepper */}
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
          {phases.map((p, i) => {
            const isActive = active === p.num;
            const prev = i === 0 ? { done: true } : phases[i - 1]!;
            const canJump = p.done || prev.done || isActive;
            return (
              <Fragment key={p.num}>
                <button onClick={() => canJump && onJump(p.num)} disabled={!canJump}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl shrink-0 transition-colors ${
                    isActive ? 'bg-brand-50/70' : canJump ? 'hover:bg-canvas/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-all ${
                    p.done ? 'bg-compliant-500 border-compliant-500 text-white'
                      : isActive ? 'bg-white border-brand-500 text-brand-700 ring-4 ring-brand-100'
                      : !canJump ? 'bg-canvas border-canvas-border text-text-muted'
                      : 'bg-white border-canvas-border text-text-muted'
                  }`}>
                    {p.done ? <Check size={14} /> : !canJump ? <Lock size={11} /> : p.num}
                  </div>
                  <div className="text-left min-w-0">
                    <div className={`text-[12px] font-bold leading-tight ${p.done ? 'text-compliant-700' : isActive ? 'text-brand-700' : 'text-text'}`}>{p.label}</div>
                    <div className="text-[9.5px] text-text-muted leading-tight truncate max-w-[150px]">{p.sub}</div>
                  </div>
                </button>
                {i < phases.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[14px] mx-1.5 rounded-full ${p.done ? 'bg-compliant-300' : 'bg-canvas-border'}`} />
                )}
              </Fragment>
            );
          })}
        </div>
        {/* Compact progress stats */}
        <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-canvas-border">
          {stat(Database, xp.samples, 'samples', 'text-text-secondary')}
          {stat(Sparkles, xp.total === 0 ? '—' : `${xp.validated}/${xp.total}`, 'validated', 'text-evidence-700')}
          {stat(CheckCircle2, xp.passed, 'passed', 'text-compliant-700')}
          {xp.failed > 0 && stat(XCircle, xp.failed, 'failed', 'text-risk-700')}
        </div>
      </div>
    </div>
  );
}

// ─── Attribute rail (inside Attribute Testing checkpoint) ───────────────────

function AttributeRail({ ctrl, sbAttrs, genAttrs, selectedAttrId, onSelect, attrDone, sampleAttrPasses, sampleAttrFails, totalSamples, genericResult, validationWorkflows, samplingReady }: {
  ctrl: DistinctControl;
  sbAttrs: ControlAttribute[];
  genAttrs: ControlAttribute[];
  selectedAttrId: string | null;
  onSelect: (attrId: string) => void;
  attrDone: (ctrl: DistinctControl, attr: ControlAttribute) => boolean;
  sampleAttrPasses: (a: ControlAttribute) => number;
  sampleAttrFails: (a: ControlAttribute) => number;
  totalSamples: number;
  genericResult: (a: ControlAttribute) => GenericResult | undefined;
  validationWorkflows: Record<string, ValidationWorkflow>;
  samplingReady: boolean;
}): JSX.Element {
  return (
    <div className="border-r border-canvas-border bg-canvas/30 max-h-[640px] overflow-y-auto">
      <RailGroup label="Sample-based" tone="bg-brand-50 text-brand-700" count={sbAttrs.length}>
        {sbAttrs.map(attr => {
          const passes = sampleAttrPasses(attr);
          const fails = sampleAttrFails(attr);
          const done = attrDone(ctrl, attr);
          const wf = validationWorkflows[`${ctrl.controlId}::${attr.id}`];
          const isSelected = selectedAttrId === attr.id;
          const locked = !samplingReady;
          return (
            <button key={attr.id} onClick={() => !locked && onSelect(attr.id)} disabled={locked}
              className={`w-full text-left px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
                isSelected ? 'border-brand-500 bg-white'
                  : 'border-transparent hover:bg-white'
              } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className="flex items-start gap-2">
                <div className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  done ? 'bg-compliant-500 text-white' : isSelected ? 'bg-brand-500 text-white' : 'bg-canvas-border text-text-muted'
                }`}>
                  {done ? <Check size={8} /> : ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10.5px] font-mono ${isSelected ? 'text-brand-700' : 'text-text-muted'}`}>{attrCode(attr.id)}</div>
                  <div className="text-[11.5px] font-semibold text-text truncate leading-tight">{attr.description}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                    {passes > 0 && <span className="text-compliant-700 font-semibold tabular-nums">{passes}P</span>}
                    {fails > 0 && <span className="text-risk-700 font-semibold tabular-nums">{fails}F</span>}
                    {totalSamples > passes + fails && <span className="text-text-muted tabular-nums">{totalSamples - passes - fails} pending</span>}
                    {wf && <span className="ml-auto text-evidence-700 inline-flex items-center gap-0.5"><WorkflowIcon size={7} /></span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </RailGroup>
      {genAttrs.length > 0 && (
        <RailGroup label="Generic" tone="bg-mitigated-50 text-mitigated-700" count={genAttrs.length}>
          {genAttrs.map(attr => {
            const r = genericResult(attr);
            const eff = r?.useAi ? r?.aiVerdict : r?.humanVerdict;
            const wf = validationWorkflows[`${ctrl.controlId}::${attr.id}`];
            const isSelected = selectedAttrId === attr.id;
            const done = eff === 'Pass' || eff === 'Fail';
            return (
              <button key={attr.id} onClick={() => onSelect(attr.id)}
                className={`w-full text-left px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
                  isSelected ? 'border-mitigated-500 bg-white' : 'border-transparent hover:bg-white'
                }`}>
                <div className="flex items-start gap-2">
                  <div className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    done ? (eff === 'Pass' ? 'bg-compliant-500 text-white' : 'bg-risk-500 text-white')
                      : isSelected ? 'bg-mitigated-500 text-white'
                      : 'bg-canvas-border text-text-muted'
                  }`}>{done ? <Check size={8} /> : ''}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10.5px] font-mono ${isSelected ? 'text-mitigated-700' : 'text-text-muted'}`}>{attrCode(attr.id)}</div>
                    <div className="text-[11.5px] font-semibold text-text truncate leading-tight">{attr.description}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                      {eff === 'Pass' && <span className="text-compliant-700 font-semibold">Pass</span>}
                      {eff === 'Fail' && <span className="text-risk-700 font-semibold">Fail</span>}
                      {!eff && <span className="text-text-muted">Pending</span>}
                      {wf && <span className="ml-auto text-evidence-700 inline-flex items-center gap-0.5"><WorkflowIcon size={7} /></span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </RailGroup>
      )}
    </div>
  );
}

function RailGroup({ label, tone, count, children }: { label: string; tone: string; count: number; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="px-3 pt-3 pb-1 flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${tone}`}>{label}</span>
        <span className="text-[10px] text-text-muted tabular-nums">{count}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Run-validation bar (handles configured vs unconfigured cases) ──────────

function RunValidationBar({ running, evidenceReady, allTested, validationWorkflow, onRunAi, onBuildWorkflow, onPickWorkflow }: {
  running: boolean;
  evidenceReady: boolean;
  allTested: boolean;
  validationWorkflow: ValidationWorkflow | undefined;
  onRunAi: () => void;
  onBuildWorkflow: () => void;
  onPickWorkflow: () => void;
}): JSX.Element {
  // Banner row + button row, so the auditor always sees which validator will run.
  const validatorName = validationWorkflow ? validationWorkflow.name : 'Generic AI validation';
  const validatorBlurb = validationWorkflow
    ? validationWorkflow.description
    : 'A built-in lightweight LLM checker that scans each uploaded file and returns a Pass/Fail. Lower precision than a custom workflow.';

  return (
    <div className="rounded-xl border border-evidence-100 bg-evidence-50/20 px-3 py-2.5 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-evidence-100 flex items-center justify-center"><Sparkles size={12} className="text-evidence-700" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Will run on click</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-text truncate">{validatorName}</span>
            {!validationWorkflow && <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-mitigated-50 text-mitigated-700 border border-mitigated-100">Fallback</span>}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5 leading-snug">{validatorBlurb}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {running ? (
          <span className="px-3 py-1.5 rounded-lg bg-evidence-100 text-evidence-700 text-[11px] font-semibold inline-flex items-center gap-1.5">
            <Sparkles size={11} className="animate-pulse" />Running {validatorName}…
          </span>
        ) : (
          <button onClick={onRunAi} disabled={!evidenceReady}
            className="px-3 py-1.5 rounded-lg bg-evidence-600 hover:bg-evidence-700 text-white text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
            <Sparkles size={11} />{allTested ? 'Re-run' : 'Run'} {validatorName}
          </button>
        )}

        {!validationWorkflow && !running && (
          <>
            <span className="text-text-muted text-[10px]">or</span>
            <button onClick={onPickWorkflow}
              className="px-2.5 py-1 rounded-lg border border-evidence-200 bg-white text-evidence-700 text-[10.5px] font-semibold cursor-pointer hover:bg-evidence-50 transition-colors flex items-center gap-1">
              Pick a workflow
            </button>
            <button onClick={onBuildWorkflow}
              className="px-2.5 py-1 rounded-lg border border-brand-200 bg-white text-brand-700 text-[10.5px] font-semibold cursor-pointer hover:bg-brand-50 transition-colors flex items-center gap-1">
              <Wand2 size={10} />Build new with IRA
            </button>
          </>
        )}

        {!evidenceReady && !running && <span className="text-[10px] text-text-muted ml-auto">Upload all required evidence to enable.</span>}
      </div>
    </div>
  );
}
