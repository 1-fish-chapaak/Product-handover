import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2, Landmark, Upload, FileText, Check, Circle, Plus, Trash2, X,
  ArrowRight, ArrowLeft, Loader2, Info, Sparkles,
  ShieldCheck, ClipboardList, Zap, AlertCircle, AlertTriangle,
  FileSpreadsheet, Grid3x3, Paperclip, Pencil, Minus, ChevronDown,
} from 'lucide-react';
import { SourceChips } from './ProgrammeView';
import { FormSelect } from '../../shared/FilterSelect';
import { OWNER_NAMES } from '../../../data/grc-domain';
import { registerEngagement, uniqueEngagementName, type EngType, type ProcessCode } from '../../../data/engagements';
import { useAuditLog } from '../../../context/AdminDataContext';
import type { FileOrigin, Frequency, SampleSizeRow, SamplingMethodology } from '../../sox-icfr/types';
import { defaultSamplingMethodology, FREQUENCY_ORDER, FREQUENCY_SAYS, ROUND_BASIS_EFFECT, SAMPLING_METHODS, SAMPLING_SPREADS, spreadLabel } from '../../sox-icfr/types';
import { cn } from '../../../lib/cn';
import {
  BASIS_OPTIONS, BEYOND_TB, ENTITY_TYPES, QUAL_REASONS, SEED_ENTITIES,
  SEED_GROUP_NAME, SEED_QUAL_PICKS, SEED_TB_FILES, captionsForEntities,
  currentFyEnd, cycleYears, deriveRacms, entityShort, fmtCr, genCode,
  type DerivedRacm, type GroupEntity, type MaterialityBasis, type ProcessName, type QualPick,
  type SoxProgramme, type TbCaption,
} from './soxTestingData';
import {
  chainDepth, COVERAGE_TARGET, type DerivedScopeRow, deriveEntityScope, entityTotalsOf,
  materialAccountsOf, normaliseProcess, type ProcessScopeRow, recommendProcesses,
  sameCompany, type ScopeEntityRow, SOX_MAPPING_PROCESSES,
} from '../../sox-icfr/auditScope';
import {
  clashSummary, controlIdClashes, copyRacmControls, isRowPublished, markRacmsUsed, racmStatus, useRacmLibrary, type LibraryRacm,
} from '../../sox-icfr/racmLibrary';
import CreateRacmFlow from '../../sox-icfr/CreateRacmFlow';
import { parseOrgChartFile } from './orgChartImport';
import LedgerExplorer from './LedgerExplorer';
import { parseTrialBalanceFile, parseGeneralLedgerFile, isReadableLedger, captionKey, type TbParseOk, type GlParseOk, type GlLine } from './ledgerImport';
// Upload RACM opens the RACM tab's own dialog, which is styled by the SOX
// register sheet (.modal-backdrop / .modal). Imported here as well so the
// dialog is dressed whichever screen opened this sheet.
import '../../sox-icfr/register.css';

/** Scoping step — PARKED (user ask). SOX creation is now identity + entities +
 *  a RACM attached to each entity; the trial balance and general ledger are
 *  asked for on Basics instead — the group TB / GL beside the group name, the
 *  RACM per entity in the table. Everything the step
 *  rendered is still below, behind this flag: set it back to true and 'Scoping'
 *  returns to STEPS at index 2, the `step === 2` block renders again, its gate
 *  re-enters `canContinue`, and the Skip-for-now footer button comes back with
 *  it. Entity RACMs register as `racm` attachments precisely so the step would
 *  return already satisfied instead of asking for the same file twice.
 *
 *  PARKED for good since S11: New engagement scopes on its own two steps now
 *  (Materiality & TB, then Scope — below), and they occupy the indices this
 *  step used to. Flipping the flag alone no longer restores it: STEPS, its
 *  `step === 2` checks and its canContinue gate
 *  (`entities named && allReqsSatisfied && inScope.length > 0`) would all need
 *  re-keying first. */
const SCOPING_STEP = false;

/** S11 — materiality, the trial balance and process scope moved here from New
 *  audit's first pass at it: the engagement is scoped once, when it is created,
 *  and picks its RACMs from the RACM tab on the Engagements page. */
const STEPS: readonly string[] = ['Type', 'Basics', 'Materiality', 'Scope', 'Sampling', 'Review'];
const MAT_TB_STEP = 2;
const SCOPE_STEP = 3;
/** #22 — the sampling methodology is agreed here, once materiality and scope are
 *  settled: the size a control is tested at depends on both, so it cannot be
 *  agreed before them. The lead proposes it; the reviewer signs it afterwards on
 *  the engagement's Configuration tab, and testing waits for that signature. */
const SAMPLING_STEP = 4;
/** Review is always last. */
const REVIEW_STEP = STEPS.length - 1;

/** The Review content from before S11 — PARKED. It described an engagement
 *  created with no RACM and no scope (a "no RACM yet" banner, a Documents card,
 *  a RACMs grid derived from captions). Kept behind this flag rather than
 *  deleted; Review now shows what Materiality & TB and Scope decided. */
const PRE_S11_REVIEW = false;

/** Where a significant deficiency starts, as a share of overall materiality.
 *  Not asked at creation — it is the engagement's ground rule, set on
 *  Materiality & scope afterwards — so the ladder on Materiality & TB shows the
 *  band the engagement is created with (soxConfig.sdBandPct below). */
const SD_BAND_PCT = 20;

/** ₹ Cr in, readable money out — under a crore reads as lakhs. The New audit
 *  wizard's formatter, so the two scoping screens write money the same way. */
const money = (cr: number) => (cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${(cr * 100).toFixed(1)} L`);

/** "A, B and C" — for the footer lines that name what Continue waits on. */
const andList = (names: string[]) => names.join(', ').replace(/, ([^,]*)$/, ' and $1');

/** Single entity standing in for the company itself (the "no separate
 *  entities" checkbox). Kept off `ent-new-` so it never reads as hand-added. */
const SOLO_ENTITY_ID = 'ent-self';

/* ── Step 1 = the classic wizard's "Type & basics" screen, as-is ─────────── */
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
/** Compact FormSelect for a table row — the sheet's dropdown look at row scale,
 *  so the entity type matches Owner instead of falling back to a raw <select>. */
const rowSelectCls = 'w-full text-[12px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none hover:border-primary/40 transition-colors';
const basicsLabelCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block';
/** The same label without its own spacing — for a header row that carries the
 *  margin itself, so the label and the control beside it sit on one baseline. */
const basicsLabelInlineCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider';
/** The New audit wizard's field, for the Materiality & TB step brought over
 *  from it — the two scoping screens set the same rule with the same fields. */
const matInputCls = 'w-full px-3 py-2 text-[0.8125rem] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

/** ── The groups the sample org charts describe ─────────────────────────────
 *  One per document in docs/samples/. Upload a chart and its rows are what
 *  land, so the document on the table and the table on screen agree.
 *
 *  Both are shaped like real registrants rather than tidy lists: ONE listed
 *  parent (only the parent carries the listing — subsidiaries sit under it
 *  unlisted), wholly-owned subsidiaries, at least one majority-owned with a
 *  non-controlling interest, and a company held through another subsidiary
 *  rather than directly. Depth and partial ownership are the two things an org
 *  chart tells you that a list of names cannot, so each sample carries both.
 *
 *  Entities are authored in the order the chart reads — parent, then everything
 *  held beneath it — because the table indents rather than sorts.
 *
 *  Country is the jurisdiction the document gives each company, so it lands
 *  with the row instead of being typed again. */
interface SampleChart {
  /** Recognised off the uploaded file's NAME. A prototype stand-in for reading
   *  the document: uploads here carry no bytes, so the filename is the only
   *  thing that distinguishes one client's chart from another's. */
  match: RegExp;
  groupName: string;
  entities: GroupEntity[];
}

/** docs/samples/meridian-global-holdings-org-chart.* — a US SEC registrant. */
const MERIDIAN_CHART: SampleChart = {
  match: /meridian/i,
  groupName: 'Meridian Global Holdings, Inc. (NYSE: MGH)',
  entities: [
    { id: 'ent-mgh', name: 'Meridian Global Holdings, Inc.', type: 'Holding', ownership: 100, country: 'United States' },
    { id: 'ent-mfs', name: 'Meridian Freight Systems LLC', type: 'Subsidiary', ownership: 100, parentId: 'ent-mgh', country: 'United States' },
    { id: 'ent-mtm', name: 'Meridian Trucking Midwest LLC', type: 'Subsidiary', ownership: 100, parentId: 'ent-mfs', country: 'United States' },
    { id: 'ent-mlm', name: 'Meridian Last Mile LLC', type: 'Subsidiary', ownership: 80, parentId: 'ent-mfs', country: 'United States' },
    { id: 'ent-mac', name: 'Meridian Air Cargo, Inc.', type: 'Subsidiary', ownership: 100, parentId: 'ent-mgh', country: 'United States' },
    { id: 'ent-macc', name: 'Meridian Air Cargo Canada ULC', type: 'Subsidiary', ownership: 100, parentId: 'ent-mac', country: 'Canada' },
    { id: 'ent-mcs', name: 'Meridian Charter Services LLC', type: 'Subsidiary', ownership: 100, parentId: 'ent-mac', country: 'United States' },
    { id: 'ent-mle', name: 'Meridian Logistics Europe B.V.', type: 'Subsidiary', ownership: 100, parentId: 'ent-mgh', country: 'Netherlands' },
    { id: 'ent-mld', name: 'Meridian Logistics Deutschland GmbH', type: 'Subsidiary', ownership: 100, parentId: 'ent-mle', country: 'Germany' },
    { id: 'ent-mlf', name: 'Meridian Logistics France SAS', type: 'Subsidiary', ownership: 95, parentId: 'ent-mle', country: 'France' },
    { id: 'ent-mps', name: 'Meridian Port Services LLC', type: 'Subsidiary', ownership: 74, parentId: 'ent-mgh', country: 'United States' },
    // Not the Gulf states the name suggests — the chart puts it in Texas, USA,
    // beside the port operation that holds it.
    { id: 'ent-gto', name: 'Gulf Terminal Operations LLC', type: 'Subsidiary', ownership: 100, parentId: 'ent-mps', country: 'United States' },
  ],
};

/** docs/samples/altura-infra-holdings-org-chart.* — the group the SOX workspace
 *  is already seeded with, so a chart-led creation and the seeded FY26 audit
 *  name the same eight companies. Two of the six branches are joint ventures
 *  (a state transmission utility holds 26%, a municipal corporation 49%), and
 *  Smart Metering is held through Transmission — 100% of it, 74% reaching the
 *  group. Green Hydrogen is deliberately ABSENT: the chart is dated before it
 *  was incorporated, which is what leaves it for the trial balance to find. */
const ALTURA_CHART: SampleChart = {
  match: /altura/i,
  groupName: 'Altura Infra Holdings Ltd (Listed)',
  entities: [
    { id: 'ent-aih', name: 'Altura Infra Holdings Limited', type: 'Holding', ownership: 100, country: 'India' },
    { id: 'ent-aso', name: 'Altura Solar One Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'ent-aih', country: 'India' },
    { id: 'ent-awt', name: 'Altura Wind Two Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'ent-aih', country: 'India' },
    { id: 'ent-aro', name: 'Altura Roadways Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'ent-aih', country: 'India' },
    { id: 'ent-atr', name: 'Altura Transmission Pvt Ltd', type: 'Subsidiary', ownership: 74, parentId: 'ent-aih', country: 'India' },
    { id: 'ent-asm', name: 'Altura Smart Metering Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'ent-atr', country: 'India' },
    { id: 'ent-awu', name: 'Altura Water Utilities Pvt Ltd', type: 'Subsidiary', ownership: 51, parentId: 'ent-aih', country: 'India' },
    { id: 'ent-alp', name: 'Altura Logistics Parks Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'ent-aih', country: 'India' },
  ],
};

const SAMPLE_CHARTS: SampleChart[] = [MERIDIAN_CHART, ALTURA_CHART];

/** A row and everything held beneath it, however deep. Deleting one company
 *  has to take its whole family: a subsidiary only reaches the group THROUGH
 *  its parent, so leaving the children behind would claim the group still owns
 *  them after the chain to them was cut. */
const familyOf = (entId: string, all: GroupEntity[]): Set<string> => {
  const family = new Set([entId]);
  // Repeat until nothing new falls in: children, then their children.
  for (let pass = 0; pass < 8; pass++) {
    const before = family.size;
    all.forEach(e => { if (e.parentId && family.has(e.parentId)) family.add(e.id); });
    if (family.size === before) break;
  }
  return family;
};

/** How deep a row sits in the ownership chain. A row with no parent is either
 *  the top company (0) or a hand-added subsidiary, which is a peer of the
 *  chart's first level (1) — so a typed row lines up with the extracted ones
 *  instead of climbing to the holding's indent. */
const entityDepth = (ent: GroupEntity, all: GroupEntity[]): number => {
  // No parent means top level, full stop. It used to read the Type dropdown,
  // which meant retyping the first row to Subsidiary shunted it in to the same
  // indent as the companies it owns — the table then showed a group with no top
  // company. Position in the chain is a fact; Type is a field someone can edit.
  if (!ent.parentId) return 0;
  let depth = 0;
  let cur: GroupEntity | undefined = ent;
  while (cur?.parentId && depth < 8) {
    cur = all.find(x => x.id === cur!.parentId);
    depth++;
  }
  return depth;
};

/** What actually reaches the listed parent through the chain. Wholly owning a
 *  74%-held company gets the group 74%, not 100% — and that is the number
 *  scoping has to weigh, not the direct holding printed on the chart. */
const effectiveOwnership = (ent: GroupEntity, all: GroupEntity[]): number => {
  let pct = ent.ownership;
  let cur: GroupEntity | undefined = ent;
  let hops = 0;
  while (cur?.parentId && hops < 8) {
    const parent: GroupEntity | undefined = all.find(x => x.id === cur!.parentId);
    if (!parent) break;
    pct = (pct * parent.ownership) / 100;
    cur = parent;
    hops++;
  }
  return Math.round(pct * 10) / 10;
};

/** Rows an org chart put in the table. The chart names companies, not
 *  processes, so these rows keep the hand-added treatment in the process
 *  column — until a RACM or trial balance parse has something to extract.
 *  Every sample's ids, not just the uploaded one's: the question this answers is
 *  "did a chart put this row here", and the answer cannot depend on which chart
 *  is on screen now. */
const ORG_CHART_ENTITY_IDS = new Set(SAMPLE_CHARTS.flatMap(c => c.entities.map(e => e.id)));

/** Did an org chart put this row in the table? Rows parsed out of an uploaded
 *  document carry an `oc-` id minted from the file, so the question can no
 *  longer be answered by a fixed list of ids — the sample ids stay in it only
 *  for a table filled before the reader was real (24 Sep). */
const isChartRow = (id: string) => id.startsWith('oc-') || ORG_CHART_ENTITY_IDS.has(id);

/** The listing parenthetical belongs to the group field, not to a name people
 *  will read on a card: "Meridian Global Holdings, Inc. (NYSE: MGH)" is how the
 *  registrant is identified, "Meridian Global Holdings, Inc." is what the
 *  engagement is called. */
const groupShort = (g: string) => g.replace(/\s*\((listed|nyse|nasdaq|bse|nse)[^)]*\)\s*$/i, '').trim();

/** House convention for a SOX engagement name — the year it covers, what kind
 *  of work it is, and who it runs for, in the order an auditor scans them.
 *  Suggested rather than imposed: it fills the field so nobody starts on a
 *  required error, and the moment the user types, it stops following. */
const suggestEngagementName = (group: string, fyLbl: string) =>
  `${fyLbl.replace(/\s+/, ' ')} ICFR — ${groupShort(group) || 'Group'}`;

/** Year label, as the Basics dropdown shows it. Shared so the suggested name
 *  can be built before that state exists. */
const yearLabel = (basis: 'fy' | 'cy', end: number) =>
  basis === 'fy' ? `FY ${end - 1}-${String(end).slice(-2)}` : `CY ${end}`;

/** Formats an org chart is realistically kept in. Deliberately wide: whatever
 *  the client has is what we take — a spreadsheet of companies (Excel / CSV)
 *  as much as a drawn chart (image, Visio, PDF, PowerPoint, draw.io). */
const ORG_CHART_ACCEPT = '.xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.vsd,.vsdx,.vsdm,.ppt,.pptx,.drawio,image/*,application/pdf,text/csv';

const TYPE_TILES: { type: EngType; icon: JSX.Element; tagline: string; tint: string; ring: string; iconWrap: string }[] = [
  { type: 'SOX / ICFR',     icon: <ShieldCheck size={22} />,    tagline: 'SOX 404 / ICFR — scoping, materiality rules, design + operating effectiveness, deficiency evaluation', tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-200',          ring: 'ring-brand-600 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-600 text-white' },
  { type: 'Compliance',     icon: <ShieldCheck size={22} />,    tagline: 'Framework-driven control testing',                              tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-100',           ring: 'ring-brand-500 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-100 text-brand-700' },
  { type: 'Internal Audit', icon: <ClipboardList size={22} />,  tagline: 'Process audit aligned to RACM + SOPs',                          tint: 'bg-evidence-50/70 hover:bg-evidence-50 text-evidence-700 border-evidence-100', ring: 'ring-evidence-500 ring-offset-2 ring-offset-canvas-elevated',  iconWrap: 'bg-evidence-100 text-evidence-700' },
  { type: 'Automation',     icon: <Zap size={22} />,             tagline: 'Continuous monitoring / reconciliation / MIS / forensic',      tint: 'bg-compliant-50/70 hover:bg-compliant-50 text-compliant-700 border-compliant-100', ring: 'ring-compliant-500 ring-offset-2 ring-offset-canvas-elevated', iconWrap: 'bg-compliant-100 text-compliant-700' },
];

/** The "Beyond the trial balance" workstream card is parked (user ask) — flip
 *  to true to bring it back. The beyond ids still store on the programme with
 *  their seeded defaults (all on), so the summary's workstreams strip keeps
 *  working. */
const BEYOND_TB_CARD = false;

/** The Qualitative overlay step is parked (user ask). To restore: flip this,
 *  add 'Qualitative' back after 'Materiality' in STEPS, give the step its
 *  canContinue entry back (inScope.length > 0) and re-key the step checks
 *  (qual block → step === 3, review → step === 4). The seeded qualitative
 *  picks still scope in silently, so the derivation numbers stay unchanged.
 *
 *  S11: qualitative picks are made per PROCESS now, on the Scope step's
 *  Processes panel (reason from QUAL_REASONS + a note). This caption-level
 *  overlay stays parked and feeds nothing the engagement is created with. */
const QUAL_STEP = false;

/** Trial-balance upload on the Scoping step — was briefly parked, then the
 *  user reverted. Set false to park it again (button, chips, gate and hint
 *  all follow this flag). */
const TB_UPLOAD = true;

/** The Materiality step is parked (user ask). To restore: flip this, add
 *  'Materiality' back after 'Scoping' in STEPS, re-key its block to
 *  step === 3 and the review block to step === 4, and move the
 *  benchmark/pct + empty-scope gate back to its own canContinue entry.
 *  The seeded basis defaults (PBT, 75/5) still set the thresholds, so the
 *  derivation and the created programme's materiality are unchanged — the
 *  review step keeps showing the resulting ladder.
 *
 *  S11: superseded rather than restored — the rule is asked again on the
 *  Materiality & TB step, in New audit's layout, and reads the same state
 *  (basis / benchmark / pct / pmPct / cttPct). */
const MATERIALITY_STEP = false;

/** Year type (Financial / Calendar) picker — PARKED from the creation flow.
 *  Every programme is created on the financial-year basis (Apr–Mar); the
 *  yearBasis state below stays, pinned to 'fy', so the period fields on the
 *  created programme are unchanged. Flip this back to true to let the user
 *  choose, and the Audit period options re-label to CY on selection. */
const YEAR_TYPE_PICKER = false;

/** Audit period select — PARKED from the Basics step (user ask). The cycle
 *  stays pinned to the fyEnd default (FY 2026-27); fy/asOf still compute and
 *  store on the programme, and Review keeps showing the cycle. Flip to bring
 *  the field (and its annual-cycle explainer) back. */
const AUDIT_PERIOD_FIELD = false;

/** "Map material accounts to processes" table on Materiality & TB — PARKED
 *  (user ask, 17 Sep: scoping happens on the Scope step, by entity and by
 *  process). The mapping still runs on Ira's suggestion from each account's
 *  caption, so the Scope step's process recommendation and the saved
 *  accountProcesses are unchanged. Flip to bring the table back; the Scope
 *  step's "you mapped" wording follows this flag. */
const ACCOUNT_MAPPING = false;

const yeSegActive = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const yeSegIdle = 'border-border bg-white text-text-secondary hover:bg-surface-2';
/** Required documents for scoping (user ask): listed in a "Required files"
 *  card under the group name, fed by ONE bulk upload button (native picker,
 *  multi-select). Files classify to a requirement by filename keywords, then
 *  fall back to whichever requirement still has nothing. The TB row rides the
 *  TB_UPLOAD park flag like the old dedicated button did. */
type ReqDocId = 'racm' | 'tb' | 'gl';
type AttachedDoc = { id: string; name: string; req: ReqDocId };
const REQUIRED_DOCS: { id: ReqDocId; name: string; formats: string }[] = [
  { id: 'racm', name: 'RACM / SOP', formats: 'XLSX' },
  ...(TB_UPLOAD ? [{ id: 'tb' as ReqDocId, name: 'Trial balance (TB)', formats: 'XLSX' }] : []),
  { id: 'gl', name: 'General ledger (GL)', formats: 'CSV' },
];
const REQ_TAG: Record<ReqDocId, string> = { racm: 'RACM / SOP', tb: 'Trial balance', gl: 'General ledger' };

/** Group-level documents (user ask): the trial balance and general ledger are
 *  consolidated — one file each, for the group as a whole — so they're asked
 *  for on Basics next to the group name. The RACM is NOT here: it differs per
 *  entity and is attached row by row in the entity table below. */
const GROUP_DOCS = REQUIRED_DOCS.filter(d => d.id !== 'racm');

const PROCESS_NAMES: ProcessName[] = [
  'Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax',
];

/** Longest engagement name Basics accepts (trimmed). Checked, never cut — a
 *  maxLength would silently clip a pasted name and the user would never see why. */
const NAME_MAX = 200;

interface Props {
  onCancel: () => void;
  onCreated: (p: SoxProgramme) => void;
  /** Entered from the Engagements page, where SOX / ICFR was already picked —
   *  the Type step is dropped and Back on Basics returns to that page, so the
   *  type isn't asked for twice. */
  typePreselected?: boolean;
  /** With `typePreselected`, Back on the first reachable step (Basics) goes to
   *  the immediate last step the user saw — the classic wizard's Type step —
   *  instead of just closing. X / Escape still close outright. */
  onBackToType?: () => void;
}

export default function ScopingWizard({ onCancel, onCreated, typePreselected, onBackToType }: Props) {
  const logEvent = useAuditLog();
  // the first step the user can actually reach — Type is skipped on handoff
  const firstStep = typePreselected ? 1 : 0;
  const [step, setStep] = useState(firstStep);

  // Step 1 — type & basics. Only identity lives here: entity/company and
  // processes are NOT asked — the scoping steps collect and derive them.
  const [type, setType] = useState<EngType | null>('SOX / ICFR');
  const [name, setName] = useState(() => suggestEngagementName(SEED_GROUP_NAME, yearLabel('fy', currentFyEnd())));
  /** Once the user types their own name, the suggestion stops following the
   *  group and the year. A name someone wrote is an answer, and nothing
   *  downstream gets to overwrite an answer. */
  const [nameTouched, setNameTouched] = useState(false);
  const [code, setCode] = useState(genCode());
  const [description, setDescription] = useState('');
  // SOX is an annual recurring cycle, not a dated project — so no start/end
  // dates. The cycle is named by the year the group reports on: a financial
  // year (Apr–Mar) or a calendar year (Jan–Dec).
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy'>('fy');
  /** End-year of the audit period — 2027 ⇒ FY 2026-27 (financial) / CY 2027
   *  (calendar). Derived from today rather than fixed: the audit-period field
   *  is parked (AUDIT_PERIOD_FIELD), so this default is the ONLY thing naming
   *  the cycle, and a hard-coded year would keep creating stale programmes
   *  once the financial year turned over. */
  const [fyEnd, setFyEnd] = useState(currentFyEnd);
  const [owner, setOwner] = useState(OWNER_NAMES[0]);

  const YEAR_OPTIONS = cycleYears(yearBasis).map(y => (yearBasis === 'fy'
    ? { value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }
    : { value: y, label: `CY ${y}` }));
  const fyLabel = YEAR_OPTIONS.find(o => o.value === fyEnd)?.label ?? `FY ${fyEnd}`;
  const fy = `FY${String(fyEnd).slice(-2)}`;
  const asOf = yearBasis === 'fy' ? `31 Mar ${fyEnd}` : `31 Dec ${fyEnd}`;

  // Step 2 — group & entities. The table starts empty: entities are mapped
  // from the uploaded RACM / trial balances, with manual add as the fallback.
  const [groupName, setGroupName] = useState(SEED_GROUP_NAME);
  const [entities, setEntities] = useState<GroupEntity[]>([]);

  /** The suggested name keeps following the group and the year while it is
   *  still ours: read an org chart and the engagement renames itself to the
   *  group it just found; switch FY to CY and it re-dates. Stops dead the
   *  moment the user types. */
  useEffect(() => {
    if (nameTouched) return;
    setName(suggestEngagementName(groupName, fyLabel));
  }, [groupName, fyLabel, nameTouched]);
  const [racmUpload, setRacmUpload] = useState<'idle' | 'parsing' | 'done'>('idle');
  const [tbUpload, setTbUpload] = useState<'idle' | 'parsing' | 'done'>('idle');

  /** A RACM attached to one entity, keyed by entity id. Optional — an entity
   *  can be listed before its matrix exists. */
  const [entityRacm, setEntityRacm] = useState<Record<string, { attId: string; name: string; state: 'parsing' | 'done' }>>({});

  /** "No separate entities" — the company itself is the single entity in scope.
   *  The list the user had before ticking is held so unticking restores it
   *  rather than silently binning their typing. */
  const [soloEntity, setSoloEntity] = useState(false);
  const preSoloEntities = useRef<GroupEntity[]>([]);
  /** Readable from inside the org-chart parse timeout, which was captured
   *  before the user could have ticked the box. */
  const soloEntityRef = useRef(false);

  // Required-files card: the attached list is the source of truth for the
  // step gate; RACM / TB attachments also trigger the simulated parses that
  // fill the entity table (GL just satisfies its requirement — nothing
  // downstream reads it in the prototype).
  const [attached, setAttached] = useState<AttachedDoc[]>([]);
  const reqSatisfied = REQUIRED_DOCS.filter(d => attached.some(a => a.req === d.id)).length;
  const allReqsSatisfied = reqSatisfied === REQUIRED_DOCS.length;

  // Scoping can be skipped (user ask): the programme is created without RACMs
  // and the workspace Overview flags that until one is added on the RACM tab.
  // The GL / TBs are no longer asked for here — they arrive on the audit that
  // tests them, captured by the New audit wizard (the audit's Configuration tab
  // is parked; see SOX_TABS in SoxIcfrApp).
  // PARKED since S11: nothing sets this — Materiality & TB and Scope have no
  // skip, and create() records scopingSkipped as undefined. Kept for the parked
  // Scoping step's "Skip for now" button.
  const [scopingSkipped, setScopingSkipped] = useState(false);

  // ── The sampling methodology, proposed here (#22) ────────────────────────────
  // It opens on the product's table rather than on empty boxes: the lead is
  // agreeing a method, not inventing one, and a blank table would invite a
  // number typed to get past the step.
  const [sampling, setSampling] = useState<SamplingMethodology>(() => defaultSamplingMethodology());
  const setSize = (f: Frequency, rating: keyof SampleSizeRow, n: number) =>
    setSampling(m => ({ ...m, sizes: { ...m.sizes, [f]: { ...m.sizes[f], [rating]: n } } }));
  const skipScoping = () => { setScopingSkipped(true); setStep(3); };

  // Step 2 — materiality
  const [basis, setBasis] = useState<MaterialityBasis>('pbt');
  const basisOpt = BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const [pmPct, setPmPct] = useState(75);
  const [cttPct, setCttPct] = useState(5);
  const overallCr = basis === 'custom' ? benchmark : Math.round(benchmark * pct * 100) / 10000;

  // Per-entity TB parse results — filled wholesale when the bulk trial-balance
  // upload lands on the group step (simulated parse).
  const [uploads, setUploads] = useState<Record<string, 'parsing' | { file: string; lines: number }>>({});

  // Step 4 — qualitative overlay
  const [qual, setQual] = useState<Record<string, QualPick & { on: boolean }>>(() => {
    const init: Record<string, QualPick & { on: boolean }> = {};
    for (const p of SEED_QUAL_PICKS) init[p.captionId] = { ...p, on: true };
    return init;
  });

  // Step 5 — process mapping + beyond-TB scope
  const [mapping, setMapping] = useState<Record<string, ProcessName>>({});
  const [beyond, setBeyond] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BEYOND_TB.map(b => [b.id, true])));

  /** ── What the trial balance actually said ────────────────────────────────
   *  Held from the moment the file is read, because everything downstream —
   *  captions, materiality, which processes each company runs — is derived
   *  from it rather than from the seed. */
  const [tbParse, setTbParse] = useState<TbParseOk | null>(null);
  const [glParse, setGlParse] = useState<GlParseOk | null>(null);
  /** A ledger we could not read, named so the user knows which file to fix. */
  const [ledgerError, setLedgerError] = useState<{ kind: 'tb' | 'gl'; name: string; reason: string } | null>(null);
  /** Rows the trial balance put in the table itself, so the explorer can mark
   *  them: nobody drew them on the chart and nobody typed them. */
  const [tbAddedIds, setTbAddedIds] = useState<Set<string>>(new Set());

  /** All captions for the current entity set. The uploaded trial balance wins
   *  wherever it has something to say: before it existed every company the
   *  seed did not know got the same four invented captions, which made one
   *  company indistinguishable from the next and left materiality deciding
   *  nothing (24 Sep). The seed still answers for rows the file never
   *  mentioned, so a hand-typed company is not left blank. */
  const captions = useMemo<TbCaption[]>(() => {
    if (!tbParse) return captionsForEntities(entities);
    const spoken = new Set(tbParse.captions.map(c => c.entityId));
    const silent = entities.filter(e => !spoken.has(e.id));
    return [...tbParse.captions.filter(c => entities.some(e => e.id === c.entityId)), ...captionsForEntities(silent)];
  }, [entities, tbParse]);

  const captionProcess = (c: TbCaption): ProcessName => mapping[c.id] ?? c.process;
  /** Distinct processes extracted for one entity — shown on its Scoping row. */
  const entityProcesses = (entId: string): ProcessName[] =>
    [...new Set(captions.filter(c => c.entityId === entId).map(c => captionProcess(c)))];
  const quantScope = captions.filter(c => c.balance >= overallCr);
  const belowThreshold = captions.filter(c => c.balance < overallCr);
  const qualScope = belowThreshold.filter(c => qual[c.id]?.on);
  const inScope = useMemo(
    () => [...quantScope, ...qualScope].map(c => ({ ...c, process: captionProcess(c) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [captions, overallCr, qual, mapping],
  );
  const qualIds = new Set(qualScope.map(c => c.id));
  const derived = useMemo(() => deriveRacms(inScope, qualIds, entities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope]);

  // ══ S11 · Materiality & TB ═══════════════════════════════════════════════
  // New audit's "Materiality & files" step, adapted to creation. There is no
  // engagement yet, so nothing can be looked up by id: the companies are the
  // Basics table, and their trial-balance captions are `captions` above.

  /** Picking a basis restarts its benchmark and % from that basis's defaults. */
  const changeBasis = (id: MaterialityBasis) => {
    const opt = BASIS_OPTIONS.find(b => b.id === id)!;
    setBasis(id);
    setBenchmark(opt.defaultBenchmark);
    setPct(opt.defaultPct);
  };
  /** Performance materiality — what material accounts are listed against, and
   *  what the company derivation on Scope weighs every company against. */
  const perf = overallCr * pmPct / 100;
  const trivial = overallCr * cttPct / 100;
  const sd = overallCr * SD_BAND_PCT / 100;
  const LADDER = [
    { label: 'Clearly trivial', band: `≤ ${money(trivial)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${money(trivial)} and < ${money(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${money(sd)} · ${SD_BAND_PCT}% of overall`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${money(overallCr)} or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  /** Files attached on Materiality & TB. Kept apart from the parked Basics
   *  `attached` list on purpose: that list drives the Basics table's "No TB"
   *  flags and the seeded-company merge, and neither belongs to this upload —
   *  the companies are the ones the user put on Basics.
   *
   *  Each file's source is asked as it lands (user ask, 15 Sep) — System
   *  generated or Client prepared — and Continue waits on every answer. It is
   *  saved on the programme's scoping record, which is where the engagement's
   *  file list reads it back (useAuditFiles), so no control asks it again. */
  const [scopeFiles, setScopeFiles] = useState<{ name: string; kind: 'tb' | 'gl'; origin?: FileOrigin }[]>([]);
  /** Files still waiting on their source. */
  const unsourcedFiles = scopeFiles.filter(f => !f.origin).length;
  /** Required before Materiality & TB will pass — the account mapping and Ira's
   *  process recommendation both read it. The general ledger never is. */
  const hasTb = scopeFiles.some(f => f.kind === 'tb');
  const addScopeFile = (kind: 'tb' | 'gl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    // A group can file one trial balance per company, so several at once is
    // normal — same as New audit.
    input.multiple = true;
    input.onchange = () => {
      const picked = Array.from(input.files ?? []);
      if (picked.length) setScopeFiles(prev => [...prev, ...picked.map(f => ({ name: f.name, kind }))]);
    };
    input.click();
  };

  // ── Material accounts → processes ────────────────────────────────────────
  // Only the accounts at or above performance materiality, so the list redraws
  // as the rule changes. Ira pre-fills each with the process its caption
  // suggests; the user corrects any that landed wrong.
  /** The user's picks, by caption id. Absent means "Ira's suggestion". Kept for
   *  an account that drops below the threshold, so it comes back as left. */
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const materialRows = useMemo(() => (hasTb ? materialAccountsOf(captions, perf) : []), [captions, perf, hasTb]);
  const processOf = useCallback(
    (c: TbCaption) => accountMap[c.id] ?? normaliseProcess(c.process),
    [accountMap],
  );
  /** Every RACM on the Engagements page's RACM tab. The engagement copies from
   *  here, so this is also the list the Scope step picks from. */
  const libraryRacms = useRacmLibrary();
  /** Every process the RACM tab holds a RACM for, by its normalised name. */
  // Published only: a process whose only matrix is still a draft has nothing
  // this engagement can test, and saying it has a RACM would be a promise the
  // Scope step then breaks.
  const racmProcessNames = useMemo(
    () => Array.from(new Set(libraryRacms.filter(r => racmStatus(r).status !== 'Draft').map(r => normaliseProcess(r.process)))),
    [libraryRacms],
  );
  /** The standard SOX list, then any other process the tab keeps a RACM for.
   *  One with no RACM on the tab says so — mapping there is allowed, but the
   *  Scope step will need one uploaded before it can be tested. */
  const mappingOptions = useMemo(() => {
    const names = [...SOX_MAPPING_PROCESSES, ...racmProcessNames.filter(p => !(SOX_MAPPING_PROCESSES as readonly string[]).includes(p))];
    return names.map(p => ({ value: p, label: racmProcessNames.includes(p) ? p : `${p} · no RACM yet` }));
  }, [racmProcessNames]);

  // ══ S11 · Scope ══════════════════════════════════════════════════════════
  // New audit's Scope step without its entity / RACM either-or: processes at
  // the top (Ira's call, overruled with a note), the companies beneath (the
  // numbers' call, overruled with a note), and then — the part only creation
  // has — the RACMs each in-scope process is tested with, picked off the tab.

  // ── Processes ────────────────────────────────────────────────────────────
  const processRows = useMemo(
    () => recommendProcesses(materialRows.map(c => ({ balance: c.balance, process: processOf(c) })), racmProcessNames),
    [materialRows, processOf, racmProcessNames],
  );
  /** Where the user overruled Ira, by process. Absent means "as recommended" —
   *  `true` is a qualitative pick, `false` a recommended process taken out. */
  const [procOverrides, setProcOverrides] = useState<Record<string, boolean>>({});
  /** Saved reasons and the ones being typed — only a SAVED note releases
   *  Continue, which is what gives Save and Cancel their meaning. */
  const [procNotes, setProcNotes] = useState<Record<string, string>>({});
  const [procNoteDrafts, setProcNoteDrafts] = useState<Record<string, string>>({});
  /** The qualitative reason, saved and draft. '' in a draft = not picked yet. */
  const [procReasons, setProcReasons] = useState<Record<string, string>>({});
  const [procReasonDrafts, setProcReasonDrafts] = useState<Record<string, string>>({});
  /** The one process whose RACM list is open (user ask, 17 Sep: RACMs are
   *  picked inside the process row). One at a time keeps the step short.
   *  `undefined` until Scope first shows — then it opens the first in-scope
   *  process still waiting on a RACM, and the user drives it from there. */
  const [openProc, setOpenProc] = useState<string | null | undefined>(undefined);
  /** Processes with no material accounts sit behind "Show more" unless one is
   *  in scope or was moved — they are the long, quiet tail of the list. */
  const [showAllProcs, setShowAllProcs] = useState(false);
  /** Each Scope section folds from its header (user ask, 17 Sep). Open on
   *  arrival; the header's count still reads while folded. */
  const [entitiesOpen, setEntitiesOpen] = useState(true);
  const [processesOpen, setProcessesOpen] = useState(true);
  const procInScope = (r: ProcessScopeRow) => procOverrides[r.process] ?? r.recommended;

  /** Drop every trace of a move — the process is back where Ira had it. */
  const clearProcMove = (process: string) => {
    const strip = <T,>(prev: Record<string, T>): Record<string, T> => {
      if (!(process in prev)) return prev;
      const out = { ...prev }; delete out[process]; return out;
    };
    setProcOverrides(strip);
    setProcNotes(strip);
    setProcNoteDrafts(strip);
    setProcReasons(strip);
    setProcReasonDrafts(strip);
  };
  /** Flip one process and open its note box. Landing back on Ira's call clears
   *  the move and its note — there is nothing left to explain. */
  const flipProcess = (r: ProcessScopeRow) => {
    const next = !procInScope(r);
    // Switching a process in opens its RACM list — picking them comes next.
    if (next) setOpenProc(r.process);
    if (next === r.recommended) { clearProcMove(r.process); return; }
    setProcOverrides(prev => ({ ...prev, [r.process]: next }));
    setProcNoteDrafts(prev => ({ ...prev, [r.process]: procNotes[r.process] ?? '' }));
    if (next) setProcReasonDrafts(prev => ({ ...prev, [r.process]: procReasons[r.process] ?? '' }));
  };
  const saveProcNote = (process: string) => {
    const text = (procNoteDrafts[process] ?? '').trim();
    const qualitative = procOverrides[process] === true;
    const reason = procReasonDrafts[process] ?? '';
    if (!text || (qualitative && !reason)) return;
    setProcNotes(prev => ({ ...prev, [process]: text }));
    if (qualitative) setProcReasons(prev => ({ ...prev, [process]: reason }));
    setProcNoteDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
    setProcReasonDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
  };
  /** Re-editing a saved note: throw the edit away. Backing out of a fresh flip:
   *  no move without a reason, so the process goes back where Ira had it. */
  const cancelProcNote = (process: string) => {
    if (!procNotes[process]) { clearProcMove(process); return; }
    setProcNoteDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
    setProcReasonDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
  };
  // Remapping an account, moving the rule or changing the companies on Basics
  // re-draws the rows. A move that no longer argues with anything goes, with its
  // note — or it would hold Continue for a decision nobody is making.
  useEffect(() => {
    const rec = new Map(processRows.map(r => [r.process, r.recommended]));
    Object.entries(procOverrides).forEach(([p, v]) => {
      if (!rec.has(p) || rec.get(p) === v) clearProcMove(p);
    });
    // Keyed on the rows alone — a flip never changes the rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processRows]);

  /** Every process the user moved, with its reason — the note gate, Review and
   *  the programme record. */
  const procChanges = processRows
    .filter(r => procOverrides[r.process] !== undefined)
    .map(r => ({
      ...r,
      inScope: procOverrides[r.process]!,
      qualitative: procOverrides[r.process] === true,
      reason: procReasons[r.process] ?? '',
      note: (procNotes[r.process] ?? '').trim(),
    }));
  const procNotesOutstanding = procChanges.filter(c => !c.note || (c.qualitative && !c.reason)).length;
  const scopedProcesses = processRows.filter(procInScope);
  const recommendedCount = processRows.filter(r => r.recommended).length;
  /** Never recommended, not in scope, not moved — shown only on "Show more". */
  const isQuietProc = (r: ProcessScopeRow) => !r.recommended && !procInScope(r) && procOverrides[r.process] === undefined;
  const quietProcCount = processRows.filter(isQuietProc).length;
  const visibleProcs = showAllProcs ? processRows : processRows.filter(r => !isQuietProc(r));

  // ── Companies ────────────────────────────────────────────────────────────
  // The Basics table, weighed against performance materiality. Built straight
  // off the table rather than through mergeScopeEntities: that merges by NAME,
  // and two rows typed with one name would collapse into one company here.
  // `inData` asks the captions — a company the trial balance has nothing for
  // can't be weighed, so it is shown excluded rather than judged too small.
  const entityRows = useMemo<ScopeEntityRow[]>(
    () => entities.map(e => ({
      id: e.id, name: e.name, type: e.type, parentId: e.parentId,
      inRegister: true, inData: captions.some(c => c.entityId === e.id),
    })),
    [entities, captions],
  );
  const totals = useMemo(() => entityTotalsOf(captions), [captions]);
  const scope = useMemo(
    () => deriveEntityScope(entityRows, totals, perf, money, hasTb),
    [entityRows, totals, perf, hasTb],
  );
  /** Where the user overruled the derivation, by entity id. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  /** Why, by entity id — required before Continue. Saved vs being typed, with
   *  the same Save / Cancel meaning as the process notes. */
  const [scopeNotes, setScopeNotes] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  /** In scope after the user has had their say. A company the trial balance
   *  never mentioned can't be overruled in — there is nothing to test it on. */
  const companyInScope = (r: DerivedScopeRow) =>
    r.status === 'absent' ? false : overrides[r.id] ?? (r.status === 'tb' || r.status === 'coverage');
  const scopedEntities = scope.rows.filter(companyInScope);
  /** What the numbers said before anyone touched it. */
  const derivedIn = (r: DerivedScopeRow) => r.status === 'tb' || r.status === 'coverage';

  /** Companies left out while the company holding them is in — from the third
   *  level down, where it is news rather than ordinary scoping (see New audit). */
  const splitFromParent = useMemo(
    () => scope.rows.filter(r => {
      if (companyInScope(r) || r.status === 'absent' || !r.parentId) return false;
      if (chainDepth(r, scope.rows) < 2) return false;
      const parent = scope.rows.find(x => x.id === r.parentId);
      return !!parent && companyInScope(parent);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.rows, overrides],
  );

  /** Flip one company and open its note box. Back on the derivation drops the
   *  override and its note. */
  const flipEntity = (r: DerivedScopeRow) => {
    const next = !companyInScope(r);
    const backToDerived = next === derivedIn(r);
    setOverrides(prev => {
      const out = { ...prev };
      if (backToDerived) delete out[r.id]; else out[r.id] = next;
      return out;
    });
    if (backToDerived) {
      setScopeNotes(prev => { const out = { ...prev }; delete out[r.id]; return out; });
      setNoteDrafts(prev => { const out = { ...prev }; delete out[r.id]; return out; });
    } else {
      setNoteDrafts(prev => ({ ...prev, [r.id]: scopeNotes[r.id] ?? '' }));
    }
  };
  const saveNote = (id: string) => {
    const text = (noteDrafts[id] ?? '').trim();
    if (!text) return;
    setScopeNotes(prev => ({ ...prev, [id]: text }));
    setNoteDrafts(prev => { const out = { ...prev }; delete out[id]; return out; });
  };
  /** Re-editing: drop the edit. Backing out of a fresh flip: no change without
   *  a reason, so the company goes back where the trial balance had it. */
  const cancelNote = (r: DerivedScopeRow) => {
    setNoteDrafts(prev => { const out = { ...prev }; delete out[r.id]; return out; });
    if (scopeNotes[r.id]) return;
    setOverrides(prev => { const out = { ...prev }; delete out[r.id]; return out; });
  };
  const scopeChanges = useMemo(
    () => scope.rows
      .filter(r => r.status !== 'absent' && overrides[r.id] !== undefined)
      .map(r => ({ entityId: r.id, name: r.name, inScope: !!overrides[r.id], note: (scopeNotes[r.id] ?? '').trim() })),
    [scope.rows, overrides, scopeNotes],
  );
  const notesOutstanding = scopeChanges.filter(c => !c.note).length;
  /** Coverage after overrides — the bar follows what is actually in. */
  const coveragePct = scope.groupTotal
    ? Math.round((scopedEntities.reduce((s, r) => s + r.total, 0) / scope.groupTotal) * 1000) / 10
    : 0;
  const coverageMet = coveragePct >= COVERAGE_TARGET;
  // A company deleted on Basics takes its override and note with it — a reason
  // for a row that no longer exists would hold Continue hostage.
  useEffect(() => {
    const live = new Set(entityRows.map(r => r.id));
    const keep = <T,>(prev: Record<string, T>): Record<string, T> => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => live.has(id)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    };
    setOverrides(keep);
    setScopeNotes(keep);
    setNoteDrafts(keep);
  }, [entityRows]);

  // ── RACMs per in-scope process ───────────────────────────────────────────
  // Picked from the RACM tab — any number, any mix of companies (S11 decision
  // 7). A ticked RACM brings every control in; since 22 Sep the user can take
  // single controls out here, each with a note (this revises decision 13, which
  // left all narrowing to New audit). Only what is left in is copied.
  // Only what has been published (17 Sep). A draft matrix is still being
  // written; scoping an engagement from it would commit the audit to rows
  // nobody has agreed yet. A matrix with published rows AND later additions
  // still appears — its published half is scopable, and `copyRacmControls`
  // takes only that half.
  const racmsFor = useCallback(
    (process: string) => libraryRacms.filter(r => normaliseProcess(r.process) === process && racmStatus(r).status !== 'Draft'),
    [libraryRacms],
  );
  /** Drafts for a process, named as the reason this list looks emptier than the
   *  RACM tab does — hiding them silently would read as a RACM gone missing. */
  const draftRacmsFor = useCallback(
    (process: string) => libraryRacms.filter(r => normaliseProcess(r.process) === process && racmStatus(r).status === 'Draft'),
    [libraryRacms],
  );
  /** The user's ticks, by process. Absent means "the default": every RACM
   *  written for a company in scope. Once a process's list is touched it is the
   *  user's, and moving a company in or out no longer re-ticks it. */
  const [racmPicks, setRacmPicks] = useState<Record<string, string[]>>({});
  const defaultPicksFor = (process: string) =>
    racmsFor(process).filter(r => scopedEntities.some(e => sameCompany(e.name, r.entity))).map(r => r.id);
  /** Ticked ids for one process, minus any RACM since deleted off the tab. */
  const picksFor = (process: string) => {
    const ids = racmPicks[process] ?? defaultPicksFor(process);
    return racmsFor(process).filter(r => ids.includes(r.id)).map(r => r.id);
  };
  // ── Why a RACM that started ticked was taken out (user ask, 22 Sep) ──────
  // The RACMs written for a company in scope start ticked. Unticking one asks
  // why — as for a company, a process or a single control — and ticking it back
  // drops the note. Ticking a RACM that didn't start ticked needs none.
  const [racmNotes, setRacmNotes] = useState<Record<string, string>>({});
  const [racmNoteDrafts, setRacmNoteDrafts] = useState<Record<string, string>>({});
  const dropRacmNotes = (ids: string[]) => {
    const drop = (prev: Record<string, string>) => {
      if (!ids.some(id => id in prev)) return prev;
      const out = { ...prev }; ids.forEach(id => delete out[id]); return out;
    };
    setRacmNotes(drop);
    setRacmNoteDrafts(drop);
  };
  const saveRacmNote = (id: string) => {
    const text = (racmNoteDrafts[id] ?? '').trim();
    if (!text) return;
    setRacmNotes(prev => ({ ...prev, [id]: text }));
    setRacmNoteDrafts(prev => { const out = { ...prev }; delete out[id]; return out; });
  };
  const toggleRacm = (process: string, id: string) => {
    resetControls([id]);
    if (!picksFor(process).includes(id)) dropRacmNotes([id]);
    setRacmPicks(prev => {
      const cur = prev[process] ?? defaultPicksFor(process);
      return { ...prev, [process]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  };
  /** The process's own tick (user ask, 15 Sep): every RACM the tab holds for
   *  it, or none. Ticks all even where two share control IDs — the clash note
   *  shows and Continue holds, as for ticks made one by one. */
  const setAllRacms = (process: string, on: boolean) => {
    resetControls(racmsFor(process).map(r => r.id));
    if (on) dropRacmNotes(racmsFor(process).map(r => r.id));
    setRacmPicks(prev => ({ ...prev, [process]: on ? racmsFor(process).map(r => r.id) : [] }));
  };
  /** Backing out of a fresh untick ticks the RACM back — no move without a
   *  reason. Re-editing a saved note just throws the edit away. */
  const cancelRacmNote = (process: string, id: string) => {
    if (!racmNotes[id]) { toggleRacm(process, id); return; }
    setRacmNoteDrafts(prev => { const out = { ...prev }; delete out[id]; return out; });
  };

  // ── Controls inside a ticked RACM (user ask, 22 Sep) ─────────────────────
  // Every control of a ticked RACM is in by default. Taking one out asks why —
  // the same rule as a company or a process moved on this step — and only a
  // SAVED note releases Continue. Only published rows are offered, because
  // only those are copied (`copyRacmControls`).
  /** Controls taken out, by RACM id. Absent = every control in. */
  const [ctlOuts, setCtlOuts] = useState<Record<string, string[]>>({});
  /** Saved notes and the ones being typed, keyed `racmId::controlId`. */
  const [ctlNotes, setCtlNotes] = useState<Record<string, string>>({});
  const [ctlNoteDrafts, setCtlNoteDrafts] = useState<Record<string, string>>({});
  /** The one ticked RACM whose controls are showing. */
  const [openRacmCtl, setOpenRacmCtl] = useState<string | null>(null);
  const ctlKey = (racmId: string, controlId: string) => `${racmId}::${controlId}`;
  const scopableControls = (r: LibraryRacm) => r.controls.filter(c => isRowPublished(r, c.id));
  const outOf = (r: LibraryRacm) => scopableControls(r).filter(c => (ctlOuts[r.id] ?? []).includes(c.id));
  const keptOf = (r: LibraryRacm) => scopableControls(r).filter(c => !(ctlOuts[r.id] ?? []).includes(c.id));
  /** Every control of these RACMs back in, their notes gone — ticking or
   *  unticking a whole RACM starts it clean. */
  function resetControls(racmIds: string[]) {
    const ids = new Set(racmIds);
    const drop = <T,>(prev: Record<string, T>): Record<string, T> => {
      const next = Object.fromEntries(Object.entries(prev).filter(([k]) => !ids.has(k.split('::')[0])));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    };
    setCtlOuts(drop);
    setCtlNotes(drop);
    setCtlNoteDrafts(drop);
  }
  /** Take a control out (and open its note) or put it back (and drop the note —
   *  there is nothing left to explain). */
  const flipControl = (r: LibraryRacm, controlId: string) => {
    const key = ctlKey(r.id, controlId);
    const wasOut = (ctlOuts[r.id] ?? []).includes(controlId);
    setCtlOuts(prev => {
      const cur = prev[r.id] ?? [];
      return { ...prev, [r.id]: wasOut ? cur.filter(x => x !== controlId) : [...cur, controlId] };
    });
    if (wasOut) {
      const strip = (prev: Record<string, string>) => {
        if (!(key in prev)) return prev;
        const out = { ...prev }; delete out[key]; return out;
      };
      setCtlNotes(strip);
      setCtlNoteDrafts(strip);
    } else {
      setCtlNoteDrafts(prev => ({ ...prev, [key]: ctlNotes[key] ?? '' }));
    }
  };
  const saveCtlNote = (key: string) => {
    const text = (ctlNoteDrafts[key] ?? '').trim();
    if (!text) return;
    setCtlNotes(prev => ({ ...prev, [key]: text }));
    setCtlNoteDrafts(prev => { const out = { ...prev }; delete out[key]; return out; });
  };
  /** Backing out of a fresh untick puts the control back — no move without a
   *  reason. Re-editing a saved note just throws the edit away. */
  const cancelCtlNote = (r: LibraryRacm, controlId: string) => {
    const key = ctlKey(r.id, controlId);
    if (!ctlNotes[key]) { flipControl(r, controlId); return; }
    setCtlNoteDrafts(prev => { const out = { ...prev }; delete out[key]; return out; });
  };
  /** A RACM's own tick. Partly in → every control back in; all in → out;
   *  out → in, with every control. */
  const clickRacm = (process: string, r: LibraryRacm, ticked: boolean) => {
    if (ticked && outOf(r).length > 0) { resetControls([r.id]); return; }
    toggleRacm(process, r.id);
  };
  /** What each in-scope process takes, in the order the processes are listed
   *  (biggest material balance first) — which is also the order their controls
   *  are copied in. */
  const pickedByProcess = scopedProcesses.map(r => {
    const ids = picksFor(r.process);
    return { process: r.process, racms: racmsFor(r.process).filter(x => ids.includes(x.id)) };
  });
  const tickedRacms: LibraryRacm[] = pickedByProcess.flatMap(g => g.racms);
  const tickedControlCount = tickedRacms.reduce((s, r) => s + keptOf(r).length, 0);
  /** In scope with nothing to test it with. Continue holds until each has a
   *  RACM ticked (or uploaded) with at least one control left in, or is moved
   *  out with a note. */
  const noRacmInScope = pickedByProcess
    .filter(g => g.racms.reduce((s, r) => s + keptOf(r).length, 0) === 0)
    .map(g => g.process);
  /** Every control taken out of a ticked RACM in an in-scope process, with its
   *  note — the note gate, Review and the programme record. */
  const ctlChanges = pickedByProcess.flatMap(g => g.racms.flatMap(r => outOf(r).map(c => ({
    racmId: r.id,
    racm: r.name,
    controlId: c.id,
    code: c.code ?? c.id,
    control: c.description,
    note: (ctlNotes[ctlKey(r.id, c.id)] ?? '').trim(),
  }))));
  const ctlNotesOutstanding = ctlChanges.filter(c => !c.note).length;
  /** RACMs that started ticked in an in-scope process and were taken out, with
   *  the reason — the note gate, Review and the programme record. */
  const racmChanges = scopedProcesses.flatMap(p => {
    const picked = picksFor(p.process);
    const defaults = defaultPicksFor(p.process);
    return racmsFor(p.process)
      .filter(r => defaults.includes(r.id) && !picked.includes(r.id))
      .map(r => ({ process: p.process, racmId: r.id, racm: r.name, note: (racmNotes[r.id] ?? '').trim() }));
  });
  const racmNotesOutstanding = racmChanges.filter(c => !c.note).length;
  // First look at Scope: open the first in-scope process still waiting on a
  // RACM (else the first in scope). After that the user opens and folds.
  useEffect(() => {
    if (step !== SCOPE_STEP || openProc !== undefined) return;
    setOpenProc((pickedByProcess.find(g => g.racms.length === 0) ?? pickedByProcess[0])?.process ?? null);
    // Only the arrival matters — later ticks must not move the open list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, openProc]);
  /** Two ticked RACMs holding one control ID — two matrices written for one
   *  process at one company, both numbering from R001/C001. Flag and block
   *  (decision 9): copying both would put two controls under one ID. */
  const clashes = controlIdClashes(tickedRacms.map(r => ({ name: r.name, controls: keptOf(r) })));
  /** The clash lines for one process's RACMs — shown inside that process, next
   *  to the ticks that caused them. IDs carry the process code, so a clash is
   *  almost always between two RACMs of one process; any that isn't is shown
   *  above all the processes instead (`crossClashLines`). */
  const clashLinesFor = (racms: LibraryRacm[]) => {
    const names = new Set(racms.map(r => r.name));
    return clashSummary(clashes.filter(c => c.holders.every(h => names.has(h))));
  };
  const crossClashLines = clashSummary(clashes.filter(c =>
    !pickedByProcess.some(g => c.holders.every(h => g.racms.some(r => r.name === h)))));

  /** Upload RACM from a process with nothing to pick — the RACM tab's own
   *  Create RACM, process fixed. The RACM lands on the tab and is ticked here. */
  const [racmUploadFor, setRacmUploadFor] = useState<{ process: string; entity: string } | null>(null);
  const openRacmUpload = (process: string) => {
    // The matrix is tested at one company: the in-scope company carrying most
    // of this process's material balance, or the first company in scope.
    const inIds = new Set(scopedEntities.map(e => e.id));
    const byCompany = new Map<string, number>();
    materialRows.forEach(c => {
      if (processOf(c) === process && inIds.has(c.entityId)) byCompany.set(c.entityId, (byCompany.get(c.entityId) ?? 0) + c.balance);
    });
    const topId = Array.from(byCompany).sort((a, b) => b[1] - a[1])[0]?.[0];
    const entity = scopedEntities.find(e => e.id === topId)?.name ?? scopedEntities[0]?.name ?? '';
    setRacmUploadFor({ process, entity });
  };
  const onRacmUploaded = (process: string, racm: LibraryRacm) => {
    setRacmPicks(prev => {
      const cur = prev[process] ?? defaultPicksFor(process);
      return { ...prev, [process]: cur.includes(racm.id) ? cur : [...cur, racm.id] };
    });
    setRacmUploadFor(null);
  };
  // FlowModal closes this whole sheet on Escape (a window listener). While the
  // Create RACM dialog is up, Escape belongs to it — its listeners sit on the
  // document, so stopping the key there keeps one Escape from throwing the
  // engagement away along with the dialog.
  useEffect(() => {
    if (!racmUploadFor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') e.stopPropagation(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [racmUploadFor]);

  // ── Gates ────────────────────────────────────────────────────────────────
  const matTbReady = hasTb && unsourcedFiles === 0 && benchmark > 0 && (basis === 'custom' || pct > 0);
  /** Moved companies, moved processes, RACMs and controls taken out still owed
   *  a note — one count for the footer. */
  const notesDue = notesOutstanding + procNotesOutstanding + racmNotesOutstanding + ctlNotesOutstanding;
  const scopeReady = scopedProcesses.length > 0 && scopedEntities.length > 0
    && notesDue === 0 && noRacmInScope.length === 0 && clashes.length === 0;

  // Name checks. Too long blocks Continue; a name already in the library does
  // not — it saves as the next free "(2)", and Basics says so before it does.
  // The suggested name counts too: it can collide before anyone types.
  const nameTooLong = name.trim().length > NAME_MAX;
  const finalName = uniqueEngagementName(name);
  const nameTaken = finalName !== name.trim();

  /** Every cell a real count — a 0 or a blank box is not an agreed size. */
  const samplingReady = FREQUENCY_ORDER.every(f => {
    const row = sampling.sizes[f];
    return (['low', 'medium', 'high'] as const).every(r => Number.isFinite(row[r]) && row[r] >= 1);
  });

  const canContinue = [
    // Type — this journey only continues for SOX / ICFR.
    type === 'SOX / ICFR',
    // Basics — identity, the group it runs for, and who is in scope. With
    // Scoping parked this is the only step that collects entities, so it gates
    // on them: at least one named row, or the company itself via the checkbox.
    // RACMs stay optional — an entity can be listed before its matrix exists.
    // Code and Owner are parked from the step (user ask) — the code is always the
    // auto-generated one, so it no longer gates. Description is required, as on staging.
    name.trim().length > 0 && !nameTooLong && description.trim().length > 0 && groupName.trim().length > 0
      && entities.length > 0 && entities.every(e => e.name.trim()),
    // Materiality & TB — the rule answered and a trial balance attached (the
    // general ledger never holds Continue). The parked Scoping step's gate that
    // used to sit at this index is quoted on SCOPING_STEP.
    matTbReady,
    // Scope — at least one process and one company in, every move explained,
    // every in-scope process with a RACM ticked, and no control ID held twice.
    scopeReady,
    // Sampling — every cell of the agreed table is a real count. A zero would
    // mean a control nobody tests, which is not a sampling decision.
    samplingReady,
    true,
  ][step];

  /** Says what a greyed Continue is waiting for — the boxes that explain it are
   *  usually further up the scroll. A clash outranks a missing RACM (it names
   *  the thing to untick), which outranks a missing note. */
  const footerHint = step === MAT_TB_STEP
    ? (!hasTb ? 'Upload a trial balance to continue'
      : unsourcedFiles > 0 ? 'Answer the source of every file to continue' : null)
    : step === SCOPE_STEP
      ? (clashes.length > 0 ? 'Untick one of the RACMs whose control IDs clash'
        : noRacmInScope.length > 0 ? `Choose RACMs for ${andList(noRacmInScope)}`
        : notesDue > 0 ? `${notesDue} change${notesDue === 1 ? '' : 's'} need${notesDue === 1 ? 's' : ''} a note`
        : scopedProcesses.length === 0 ? 'Tick at least one process'
        : scopedEntities.length === 0 ? 'Tick at least one entity'
        : null)
      : null;

  const goNext = () => {
    if (!canContinue) return;
    if (SCOPING_STEP && step === 2) setScopingSkipped(false); // completed properly after all
    setStep(s => s + 1);
  };

  /** Entities read off an uploaded file — merged by name so a row the user
   *  already typed never duplicates. */
  /** A company somebody typed in that the trial balance has never heard of.
   *
   *  Scoping runs on the TB's numbers, so a company with no numbers behind it
   *  carries no captions, derives no processes and can be tested for nothing —
   *  "वो तो है ही नहीं तुम्हारे इसमें". It is flagged rather than deleted:
   *  the row may be right and the TB late, and quietly binning somebody's
   *  typing is not ours to do. Only asked once the TB has actually been read —
   *  before that, every row is unbacked and saying so would be noise. */
  const notInTrialBalance = (e: GroupEntity): boolean =>
    tbUpload === 'done'
    && !uploads[e.id]
    && !SEED_ENTITIES.some(s => s.name.trim().toLowerCase() === e.name.trim().toLowerCase());

  const mergeExtractedEntities = () => {
    setEntities(prev => {
      const have = new Set(prev.map(e => e.name.trim().toLowerCase()));
      return [...prev, ...SEED_ENTITIES.filter(e => !have.has(e.name.toLowerCase())).map(e => ({ ...e }))];
    });
  };

  const simulateRacmUpload = () => {
    setRacmUpload('parsing');
    window.setTimeout(() => { setRacmUpload('done'); mergeExtractedEntities(); }, 800);
  };

  /** ── Org chart → the entity table ──────────────────────────────────────
   *  The fastest honest way to fill this table. Every group already has a
   *  chart naming each company and showing which one sits on top, so asking
   *  the user to re-key it into our shape is exactly why the table sits empty.
   *  Whatever format they keep it in is accepted — a PDF, a photo or export of
   *  the printed chart, a Visio file — because "convert it first" is the same
   *  re-keying by another name.
   *
   *  It reads STRUCTURE only: who exists, holding vs subsidiary, ownership. An
   *  org chart says nothing about processes, so those cells stay the user's to
   *  fill until a RACM or trial balance arrives with something to extract.
   *  Merged by name, so a row already typed never doubles up. */
  const [orgChart, setOrgChart] = useState<
    | { name: string; state: 'parsing' }
    | { name: string; state: 'done'; found: number }
    | { name: string; state: 'unreadable'; reason: string }
    | null
  >(null);
  /** The chart the uploaded document turned out to be. Held rather than derived
   *  on each read: the clash prompt can sit open for as long as the user likes,
   *  and the merge it eventually runs has to be the one the upload started. */
  const [chart, setChart] = useState<SampleChart>(MERIDIAN_CHART);
  /** Companies the chart names that are already sitting in the table, typed by
   *  hand. Held rather than silently resolved: skipping them quietly orphaned
   *  everything held beneath them, and overwriting them quietly binned the
   *  user's typing. Neither is ours to choose (user ask). */
  const [clash, setClash] = useState<string[] | null>(null);
  /** The live table, readable from inside the parse timeout. */
  const entitiesRef = useRef<GroupEntity[]>([]);
  entitiesRef.current = entities;

  /** Merge the chart in, keeping the chain intact either way.
   *  `adopt`   — the row already in the table stays and becomes the parent the
   *              chart's companies attach to.
   *  `replace` — the chart's version wins; anything the user had hanging off
   *              their row is re-pointed at the chart's row so it isn't cut
   *              loose along with it. */
  const mergedWithChart = (existing: GroupEntity[], mode: 'adopt' | 'replace', src: SampleChart): GroupEntity[] => {
    const byName = new Map(existing.map(e => [e.name.trim().toLowerCase(), e]));
    if (mode === 'replace') {
      const swap = new Map<string, string>(); // the user's row id → the chart's
      src.entities.forEach(e => {
        const mine = byName.get(e.name.toLowerCase());
        if (mine) swap.set(mine.id, e.id);
      });
      const kept = existing
        .filter(e => !swap.has(e.id))
        .map(e => (e.parentId && swap.has(e.parentId) ? { ...e, parentId: swap.get(e.parentId) } : e));
      // The chart's row wins — except for a country the user typed on theirs.
      // An extraction fills a blank; it does not overwrite an answer.
      return [
        ...src.entities.map(e => {
          const mine = byName.get(e.name.toLowerCase());
          return mine?.country?.trim() ? { ...e, country: mine.country } : { ...e };
        }),
        ...kept,
      ];
    }
    const adopted = new Map<string, string>(); // the chart's row id → the user's
    src.entities.forEach(e => {
      const mine = byName.get(e.name.toLowerCase());
      if (mine) adopted.set(e.id, mine.id);
    });
    const fresh = src.entities
      .filter(e => !byName.has(e.name.toLowerCase()))
      .map(e => ({ ...e, parentId: e.parentId ? adopted.get(e.parentId) ?? e.parentId : undefined }));
    // The user's row stays as typed; only a country it was left without is
    // taken from the chart.
    const filled = existing.map(mine => {
      if (mine.country?.trim()) return mine;
      const theirs = src.entities.find(e => e.name.toLowerCase() === mine.name.trim().toLowerCase());
      return theirs?.country ? { ...mine, country: theirs.country } : mine;
    });
    return [...filled, ...fresh];
  };

  const resolveClash = (mode: 'adopt' | 'replace') => {
    setEntities(prev => mergedWithChart(prev, mode, chart));
    setGroupName(prev => (prev.trim() === '' || prev.trim() === SEED_GROUP_NAME ? chart.groupName : prev));
    setClash(null);
  };

  const onOrgChartSelected = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    setClash(null);
    setOrgChart({ name: file.name, state: 'parsing' });

    // The document itself decides what lands (24 Sep). It used to be the
    // filename, which meant every chart but two extracted somebody else's group.
    const result = await parseOrgChartFile(file);

    // The user can tick "There are no separate entities" while this is still
    // reading. That answer wins: merging a whole group in underneath it would
    // contradict the box they just ticked, and none of the rows would be
    // removable. Drop the extraction rather than half-apply it.
    if (soloEntityRef.current) { setOrgChart(null); return; }

    if (!result.ok) {
      setOrgChart(prev => (prev?.name === file.name ? { name: file.name, state: 'unreadable', reason: result.reason } : prev));
      return;
    }

    const src: SampleChart = { match: /(?!)/, groupName: result.chart.groupName, entities: result.chart.entities };
    setChart(src);
    const have = new Set(entitiesRef.current.map(e => e.name.trim().toLowerCase()));
    const clashing = src.entities.filter(e => have.has(e.name.toLowerCase()));
    if (clashing.length) {
      // Stop and ask. Nothing is merged until the user says which version wins.
      setClash(clashing.map(c => c.name));
      setOrgChart(prev => (prev?.name === file.name ? { name: file.name, state: 'done', found: src.entities.length } : prev));
      return;
    }
    setEntities(prev => mergedWithChart(prev, 'adopt', src));
    // The chart's root IS the group. Filled in only while the field still
    // holds the untouched default or nothing — a name the user typed is an
    // answer, and an extraction does not get to overwrite an answer.
    setGroupName(prev => (prev.trim() === '' || prev.trim() === SEED_GROUP_NAME ? src.groupName : prev));
    setOrgChart(prev => (prev?.name === file.name ? { name: file.name, state: 'done', found: src.entities.length } : prev));
  };

  const extractedReady = racmUpload === 'done' || tbUpload === 'done';
  /** RACMs attached to rows that are still in the list — entities dropped or
   *  swapped out by the checkbox must not keep counting. */
  const racmCount = entities.filter(e => entityRacm[e.id]).length;

  const classifyDoc = (fileName: string, existing: { req: ReqDocId }[]): ReqDocId => {
    const n = fileName.toLowerCase();
    if (/racm|sop/.test(n)) return 'racm';
    if (TB_UPLOAD && /(^|[^a-z])tb([^a-z]|$)|trial/.test(n)) return 'tb';
    if (/(^|[^a-z])gl([^a-z]|$)|ledger/.test(n)) return 'gl';
    // No keyword — fill whichever requirement still has nothing.
    return REQUIRED_DOCS.find(d => !existing.some(a => a.req === d.id))?.id ?? 'gl';
  };

  const onFilesSelected = (list: FileList | null) => {
    if (!list?.length) return;
    const batch: AttachedDoc[] = [];
    for (const f of Array.from(list)) {
      batch.push({ id: `att-${Date.now()}-${batch.length}`, name: f.name, req: classifyDoc(f.name, [...attached, ...batch]) });
    }
    setAttached(prev => [...prev, ...batch]);
    if (batch.some(b => b.req === 'racm') && racmUpload !== 'done') simulateRacmUpload();
    // The file itself is read, not its name. A ledger we cannot open falls
    // back to the simulated load so the step is never a dead end.
    const files = Array.from(list);
    const tbFile = files.find((f, i) => batch[i]?.req === 'tb');
    const glFile = files.find((f, i) => batch[i]?.req === 'gl');
    if (TB_UPLOAD && tbFile && tbUpload !== 'done') {
      if (isReadableLedger(tbFile.name)) void ingestTrialBalance(tbFile);
      else simulateTbUpload();
    }
    if (glFile && isReadableLedger(glFile.name)) void ingestGeneralLedger(glFile);
  };

  /** Removing the last file of a requirement re-arms it (and the step gate). */
  const removeAttached = (id: string) => {
    const next = attached.filter(a => a.id !== id);
    setAttached(next);
    if (!next.some(a => a.req === 'racm')) setRacmUpload('idle');
    if (TB_UPLOAD && !next.some(a => a.req === 'tb')) { setTbUpload('idle'); setUploads({}); setTbParse(null); setTbAddedIds(new Set()); }
    if (!next.some(a => a.req === 'gl')) setGlParse(null);
  };

  /** One consolidated group file per requirement — re-uploading replaces the
   *  previous one rather than stacking a second copy of the same document.
   *  The TB runs its simulated parse, but deliberately does NOT merge the
   *  seeded companies: the entity list is the user's, typed or via the
   *  no-entities checkbox, and shouldn't grow rows they never asked for. */
  const onGroupDocSelected = (req: ReqDocId, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    setAttached(prev => [...prev.filter(a => a.req !== req), { id: `att-grp-${req}-${Date.now()}`, name: file.name, req }]);
    if (req === 'tb') {
      if (isReadableLedger(file.name)) void ingestTrialBalance(file);
      else { setTbUpload('parsing'); window.setTimeout(() => setTbUpload('done'), 800); }
    }
    if (req === 'gl' && isReadableLedger(file.name)) void ingestGeneralLedger(file);
  };

  /** RACM attached to one entity. It also registers as a group `racm`
   *  attachment (user ask) so the parked Scoping step would come back already
   *  satisfied rather than asking for the same matrix a second time. The
   *  simulated parse fills that entity's process list, and deliberately does
   *  NOT merge the seeded entities — this upload speaks for one row only. */
  const onEntityRacmSelected = (entId: string, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const attId = `att-ent-${entId}-${Date.now()}`;
    setEntityRacm(prev => ({ ...prev, [entId]: { attId, name: file.name, state: 'parsing' } }));
    setAttached(prev => [...prev, { id: attId, name: file.name, req: 'racm' }]);
    window.setTimeout(() => {
      setEntityRacm(prev => (prev[entId]?.attId === attId
        ? { ...prev, [entId]: { ...prev[entId], state: 'done' } }
        : prev));
    }, 800);
  };

  const removeEntityRacm = (entId: string) => {
    const rec = entityRacm[entId];
    if (!rec) return;
    setEntityRacm(prev => { const next = { ...prev }; delete next[entId]; return next; });
    removeAttached(rec.attId);
  };

  /** Dropping an entity takes its RACM with it — no orphan attachment left
   *  ticking off a requirement for a row that no longer exists — and everything
   *  held beneath it goes too. A company only reaches the group THROUGH its
   *  parent; leaving the children behind would claim the group still owns them
   *  when the chain to them has just been cut. */
  const removeEntity = (entId: string) => {
    const doomed = familyOf(entId, entities);
    doomed.forEach(removeEntityRacm);
    setEntities(prev => prev.filter(e => !doomed.has(e.id)));
    setConfirmRemoveId(null);
  };

  /** The row whose delete is waiting to be confirmed. Only rows that hold
   *  others ask — deleting a leaf is one click, as it always was, so the
   *  friction appears exactly where the damage does. */
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  /** A company added BENEATH a named parent, rather than appended to the end of
   *  the list. It lands directly after that parent's existing family, so the
   *  table still reads top-down and the new row is already indented under the
   *  company it belongs to — nothing to re-parent afterwards. */
  const newRowSeq = useRef(0);
  /** The row to put the cursor in once it renders. Without it the button reads
   *  as broken: on a twelve-row group the new row lands below the fold, so the
   *  click appears to do nothing at all. */
  const [focusEntityId, setFocusEntityId] = useState<string | null>(null);

  /** A company added at the top of the list — the first one is the group's own
   *  holding, everything after it a subsidiary. Focused on arrival for the same
   *  reason as the per-parent add: the row lands below the fold on a long list,
   *  and a click that shows nothing reads as a broken button. */
  const addTopLevelEntity = () => {
    const row: GroupEntity = {
      id: `ent-new-${newRowSeq.current++}-${Date.now()}`,
      name: '',
      type: entities.length === 0 ? 'Holding' : 'Subsidiary',
      ownership: 100,
    };
    setFocusEntityId(row.id);
    setEntities(prev => [...prev, row]);
  };

  const addChildEntity = (parentId: string) => {
    const child: GroupEntity = {
      id: `ent-new-${newRowSeq.current++}-${Date.now()}`,
      name: '',
      type: 'Subsidiary',
      ownership: 100,
      parentId,
    };
    setFocusEntityId(child.id);
    setEntities(prev => {
      const idx = prev.findIndex(e => e.id === parentId);
      if (idx < 0) return [...prev, child];
      // Walk past everything already held under this parent — directly or
      // through one of its own subsidiaries — so the new row joins the end of
      // the family instead of splitting it.
      const family = new Set([parentId]);
      let insertAt = idx + 1;
      while (insertAt < prev.length && prev[insertAt].parentId && family.has(prev[insertAt].parentId!)) {
        family.add(prev[insertAt].id);
        insertAt++;
      }
      return [...prev.slice(0, insertAt), child, ...prev.slice(insertAt)];
    });
  };

  /** "No separate entities" — swap the table for the company itself. */
  const toggleSoloEntity = () => {
    if (!soloEntity) {
      preSoloEntities.current = entities;
      // groupShort: the listing tag belongs to the group field, not to a row
      // that names one company — otherwise the same company reads as
      // "Meridian Global Holdings, Inc." on the chart's row and
      // "Meridian Global Holdings, Inc. (NYSE: MGH)" here.
      setEntities([{ id: SOLO_ENTITY_ID, name: groupShort(groupName), type: 'Holding', ownership: 100 }]);
      soloEntityRef.current = true;
      setSoloEntity(true);
      return;
    }
    removeEntityRacm(SOLO_ENTITY_ID);
    setEntities(preSoloEntities.current);
    soloEntityRef.current = false;
    setSoloEntity(false);
  };

  /** The company's own row is the group name — keep it in step while it's typed. */
  useEffect(() => {
    if (!soloEntity) return;
    setEntities(prev => (prev.length === 1 && prev[0].id === SOLO_ENTITY_ID && prev[0].name !== groupName.trim()
      ? [{ ...prev[0], name: groupName.trim() }]
      : prev));
  }, [groupName, soloEntity]);
  /** Hand-added entities have nothing extracted — the user types their
   *  processes; matching names remap the entity's generic captions. */
  const [manualProcs, setManualProcs] = useState<Record<string, string>>({});
  const applyManualProcs = (entId: string, text: string) => {
    setManualProcs(prev => ({ ...prev, [entId]: text }));
    const tokens = text.split(/[,·;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const chosen = PROCESS_NAMES.filter(p => tokens.some(t => p.toLowerCase().includes(t)));
    if (!chosen.length) return;
    const capIds = [1, 2, 3, 4].map(n => `tb-${entId}-0${n}`);
    setMapping(prev => {
      const next = { ...prev };
      capIds.forEach((cid, i) => { next[cid] = chosen[i % chosen.length]; });
      return next;
    });
  };

  /** ── Trial balance → captions ────────────────────────────────────────────
   *  Reads the file. What it finds replaces the seeded figures wholesale: a
   *  company's captions, their balances, and the processes each one implies.
   *  Falls back to the old simulated load only when there is nothing readable
   *  to parse, so a demo run with a PDF still gets somewhere. */
  const ingestTrialBalance = async (file: File) => {
    setTbUpload('parsing');
    setLedgerError(null);
    const result = await parseTrialBalanceFile(file, entitiesRef.current);
    if (!result.ok) {
      setTbUpload('idle');
      setLedgerError({ kind: 'tb', name: file.name, reason: result.reason });
      return;
    }
    setTbParse(result);
    setUploads(Object.fromEntries(Object.entries(result.perEntity).map(([id, f]) => [id, { ...f }])));
    // The trial balance is the one input that knows about a company nobody
    // drew on the chart — a subsidiary incorporated mid-year has ledger
    // balances before it has ever appeared on an org chart. Those rows are
    // added rather than dropped, which is the whole reason a TB is asked for
    // at scoping rather than at fieldwork.
    if (result.unmatched.length) {
      setEntities(prev => {
        const have = new Set(prev.map(e => e.name.trim().toLowerCase()));
        const fresh = result.unmatched
          .filter(u => u.fileName && !have.has(u.fileName.trim().toLowerCase()))
          .map(u => ({ id: `tb-${u.fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: u.fileName, type: 'Subsidiary' as const, ownership: 100 }));
        if (fresh.length) setTbAddedIds(new Set(fresh.map(f => f.id)));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      // The captions of a company the table had no row for are keyed to a
      // blank entity until the row exists — re-point them at the row just made.
      result.captions.push(...result.unmatched.flatMap(u => {
        const id = `tb-${u.fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return u.captions.map(c => ({ ...c, entityId: id }));
      }));
    }
    setTbUpload('done');
  };

  /** A trial balance we could not open at all. The seeded load is kept for
   *  this case only, so the step still has something to show. */
  const simulateTbUpload = () => {
    setTbUpload('parsing');
    window.setTimeout(() => {
      setTbUpload('done');
      mergeExtractedEntities();
      setUploads(Object.fromEntries(Object.entries(SEED_TB_FILES).map(([id, f]) => [id, { ...f }])));
    }, 800);
  };

  /** ── General ledger → the lines behind a caption ─────────────────────────
   *  The GL used to be attached and never opened. Reading it is what lets a
   *  caption be drilled into: the postings that make it up, and which of them
   *  somebody keyed by hand. */
  const ingestGeneralLedger = async (file: File) => {
    setLedgerError(null);
    const result = await parseGeneralLedgerFile(file, entitiesRef.current);
    if (!result.ok) { setLedgerError({ kind: 'gl', name: file.name, reason: result.reason }); return; }
    setGlParse(result);
  };

  /** Everything Review stands on — reachable only through both gates, but
   *  Back can undo either on the way, so Create checks again. */
  const readyToCreate = matTbReady && scopeReady;

  const create = () => {
    if (!readyToCreate) return;
    const id = `sox-prog-${Date.now()}`;
    // Register a real runtime engagement so the programme card opens the
    // classic SOX workspace (tabs, control testing) exactly like any other
    // SOX engagement — seeded with this scoping's materiality.
    const CR = 10_000_000;
    /** The engagement's own copy of every RACM it ticked, process by process in
     *  the order Scope listed them. Copied now, at pick time: later edits on the
     *  RACM tab only reach engagements created afterwards (S11 decision 4).
     *  Controls taken out on Scope are left behind. */
    const copied = tickedRacms.flatMap(r => {
      const kept = new Set(keptOf(r).map(c => c.id));
      return copyRacmControls(r).filter(c => kept.has(c.id));
    });
    /** What the lead settled on the Sampling step, signed by nobody. The same
     *  proposal goes on the engagement and on the programme record, so the
     *  workspace opens on the table that was just filled in rather than on the
     *  demo seed's, and the reviewer still has to sign before testing (#22). */
    const proposedSampling: SamplingMethodology = {
      ...sampling,
      proposedBy: { by: owner || 'Engagement lead', at: 'just now' },
    };
    const tbNames = scopeFiles.filter(f => f.kind === 'tb').map(f => f.name);
    const companies = `${scopedEntities.length} of ${entities.length} ${entities.length === 1 ? 'company' : 'companies'}`;
    const processes = `${scopedProcesses.length} process${scopedProcesses.length === 1 ? '' : 'es'}`;
    const racmsCopied = `${tickedRacms.length} RACM${tickedRacms.length === 1 ? '' : 's'}`;
    registerEngagement({
      id,
      code: code.trim().toUpperCase(),
      // the suffixed name when the typed one is taken — the same one Basics promised
      name: finalName,
      description: description.trim()
        || `SOX 404 / ICFR programme — ${companies} and ${processes} in scope; ${racmsCopied} copied from the RACM tab (${copied.length} control${copied.length === 1 ? '' : 's'}).`,
      type: 'SOX / ICFR',
      soxConfig: {
        overallMateriality: Math.round(overallCr * CR),
        performanceMateriality: Math.round(overallCr * pmPct / 100 * CR),
        clearlyTrivial: Math.round(overallCr * cttPct / 100 * CR),
        sdBandPct: SD_BAND_PCT,
        aggregate: true,
        keyOnly: true,
      },
      // The controls are the RACMs ticked on Scope, copied — the workspace seeds
      // exactly these (soxControls wins over soxProcesses), so no template is
      // generated for any process.
      soxProcesses: [],
      soxSeedMode: 'fresh',
      soxRacms: tickedRacms.map(r => ({ racmId: r.id, name: r.name })),
      soxControls: copied,
      soxSampling: proposedSampling,
      // The anchor is the biggest process in scope (falls back to P2P).
      process: ({
        'Procure to Pay': 'P2P', 'Order to Cash': 'O2C', 'Record to Report': 'R2R', 'IT General Controls': 'ITGC',
      } as Record<string, ProcessCode>)[scopedProcesses[0]?.process ?? ''] ?? 'P2P',
      framework: 'COSO 2013 / SOX 404',
      owner,
      status: 'Active',
      periodStart: yearBasis === 'fy' ? `Apr ${fyEnd - 1}` : `Jan ${fyEnd}`,
      periodEnd: yearBasis === 'fy' ? `Mar ${fyEnd}` : `Dec ${fyEnd}`,
      startDate: yearBasis === 'fy' ? `${fyEnd - 1}-04-01` : `${fyEnd}-01-01`,
      endDate: yearBasis === 'fy' ? `${fyEnd}-03-31` : `${fyEnd}-12-31`,
      entity: groupName.trim(),
      controls: copied.length,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just created',
      nextScheduled: `Scoping — opinion as of ${asOf}`,
    });
    // The tab records the engagement as a user of each RACM — which is what
    // blocks deleting a RACM this engagement still names as its source.
    markRacmsUsed(tickedRacms.map(r => r.id), { id, name: finalName });
    logEvent({
      action: 'Create',
      description: `Created SOX ICFR engagement "${finalName}" — ${companies} and ${processes} in scope (${andList(scopedProcesses.map(r => r.process))}); ${racmsCopied} copied from the RACM tab (${copied.length} controls); materiality ${money(overallCr)}, performance ${money(perf)}; trial balance ${tbNames.join(', ')}`,
      module: 'SOX ICFR',
      entity: 'Engagement',
    });
    const inIds = new Set(scopedEntities.map(e => e.id));
    const programme: SoxProgramme = {
      id,
      engagementId: id,
      name: finalName,
      code: code.trim().toUpperCase(),
      owner,
      fy,
      asOf,
      phase: 'Scoping',
      groupName: groupName.trim(),
      // Every company on Basics stays on the register, in scope or not — the
      // next audit may bring one back. The trial balance rides on each row, which
      // is how the workspace's file list finds it. Several TBs: the first stands
      // for the group here; every file is kept on `scoping.files`.
      entities: entities.map(e => (tbNames[0] ? { ...e, tbFile: tbNames[0] } : { ...e })),
      materiality: {
        basis,
        benchmarkLabel: basisOpt.benchmarkLabel,
        benchmark,
        pct: basis === 'custom' ? 100 : pct,
        overall: overallCr,
        pmPct,
        cttPct,
      },
      totalCaptions: captions.length,
      // Above PERFORMANCE materiality now — the threshold Materiality & TB lists
      // accounts against — and qualitative picks are processes, not captions.
      quantCount: materialRows.length,
      qualCount: procChanges.filter(c => c.qualitative).length,
      // One entry per process in scope, with the controls copied for it. Read
      // by processesFor (the processes an engagement names) and by
      // processesForAudit, which maps an audit scoped BY COMPANY to processes
      // through `entities` — so they are the in-scope companies whose material
      // accounts map here, as short names like every other programme. New
      // audit's own "By RACM" list is built from the engagement's controls, not
      // from this, so it offers exactly the processes that were copied.
      racms: pickedByProcess.map((g): DerivedRacm => {
        const feeding = materialRows.filter(c => processOf(c) === g.process && inIds.has(c.entityId));
        const shorts = Array.from(new Set(feeding.map(c => entityShort(c.entityId, entities))));
        return {
          process: g.process as ProcessName,
          sources: feeding.map(c => ({ caption: c.caption, entity: entityShort(c.entityId, entities) })),
          // A process brought in on judgement has no material account, so no
          // company feeds it. Every company in scope stands in: left empty, an
          // audit scoped by company would silently drop a process this
          // engagement deliberately brought in.
          entities: shorts.length ? shorts : scopedEntities.map(e => entityShort(e.id, entities)),
          controls: g.racms.reduce((s, r) => s + keptOf(r).length, 0),
        };
      }),
      beyondTb: BEYOND_TB.filter(b => beyond[b.id]).map(b => b.id),
      // Proposed, not agreed: the reviewer signs it on the Configuration tab,
      // and every control's sample size is read off it from then on (#22).
      sampling: proposedSampling,
      // Scoped, not skipped: every process in scope has its RACMs, so the
      // workspace has nothing missing to nag about.
      scopingSkipped: undefined,
      scoping: {
        files: scopeFiles.map(f => ({ name: f.name, kind: f.kind, ...(f.origin ? { origin: f.origin } : {}) })),
        accountProcesses: Object.fromEntries(materialRows.map(c => [c.id, processOf(c)])),
        processScope: processRows.map(r => {
          const move = procChanges.find(c => c.process === r.process);
          return {
            process: r.process, total: r.total, accounts: r.accounts, recommended: r.recommended,
            inScope: procInScope(r),
            ...(move?.qualitative ? { qualitativeReason: move.reason } : {}),
            ...(move ? { note: move.note } : {}),
          };
        }),
        entityIds: scopedEntities.map(e => e.id),
        scopeNotes: scopeChanges,
        ...(racmChanges.length > 0 ? { racmNotes: racmChanges } : {}),
        ...(ctlChanges.length > 0 ? { controlNotes: ctlChanges } : {}),
      },
    };
    onCreated(programme);
  };

  return (
    // min-h-full + flex column: on short steps the footer still sits pinned to
    // the modal's bottom edge instead of floating mid-air after the content.
    <div className="flex flex-col min-h-full">
      {/* Modal header — same eyebrow pattern as the scoping summary; no
          breadcrumb or back affordance, close is X / Escape / Cancel. */}
      {/* Pinned header — eyebrow + stepper stay put while the step content
          scrolls beneath (mirror of the sticky footer; user ask). */}
      {/* Sticky clamps the MARGIN box, not the border box. -mt-6 (which cancels
          FlowModal's p-6 so the header can cover the scrollport's top padding
          when stuck) therefore made `top-0` shove the header 24px BELOW the
          space layout reserved for it — it painted over the first 24px of every
          step, swallowing the "Engagement name" label on Basics and slicing the
          top off the Recommended-files card on Scoping.
          `-top-6` cancels the margin in the clamp, so the header pins exactly at
          its static position (flush to the scrollport top, still covering the
          padding strip). pt-11 = pt-5 + the 24px the margin used to supply, so
          the title sits where it always did. */}
      <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-1">
        {/* Same title block as the classic wizard's header (user ask) — the
            journey keeps one identity across the handoff instead of the title
            disappearing the moment scoping takes over. FlowModal's floating X
            is suppressed for this sheet so there's only one close. */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-brand-600 shrink-0" />
              <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Create Engagement</h2>
            </div>
            <p className="text-[0.75rem] text-ink-500">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
        </div>
        {/* Type stays on the rail even when it was answered on the classic
            wizard — it reads as a completed step of one journey, not a step
            that never existed. Clicking it goes back to where it was answered. */}
        <StepRail
          steps={STEPS}
          step={step}
          onStepClick={i => {
            if (typePreselected && i === 0) { onBackToType ? onBackToType() : onCancel(); return; }
            setStep(i);
          }} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {step === 0 && (
          <StepShell title="Type">
            <div className="space-y-4">
              <div>
                <label className={basicsLabelCls}>Engagement type <span className="text-risk-700">*</span></label>
                <div className="space-y-2">
                  {TYPE_TILES.map(t => {
                    const selected = type === t.type;
                    return (
                      <button
                        key={t.type}
                        onClick={() => setType(t.type)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${t.tint} ${selected ? `ring-2 ${t.ring} border-transparent` : ''}`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.iconWrap}`}>{t.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[0.8125rem] font-semibold">{t.type}</div>
                            {selected && <Check size={15} className="shrink-0" />}
                          </div>
                          <p className="text-[0.75rem] opacity-80 mt-0.5 line-clamp-1">{t.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {type !== 'SOX / ICFR' && (
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-surface-2/60 border border-border-light">
                    <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                    <p className="text-[0.75rem] text-text-muted leading-relaxed">
                      Compliance, Internal Audit and Automation engagements are created from the classic New Engagement flow. This scoping journey continues for SOX / ICFR.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="Basics">
            <div className="space-y-4">
              <div>
                <label className={basicsLabelCls}>Engagement name <span className="text-risk-700">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setNameTouched(true); setName(e.target.value); }}
                  placeholder="e.g. P2P — SOX Q3 Testing"
                  className={inputCls}
                />
                {!nameTouched && name.trim().length > 0 && (
                  <p className="text-[0.6875rem] text-ink-500 mt-1">Suggested from the group — edit if your team names them differently.</p>
                )}
                {name.trim().length === 0 && <Hint text="Name is required" />}
                {nameTooLong && <Hint text={`Name must be ${NAME_MAX} characters or fewer — this one is ${name.trim().length}.`} />}
                {/* Informational, not an error — a taken name still continues. */}
                {nameTaken && !nameTooLong && (
                  <p className="text-[0.6875rem] text-ink-500 mt-1">An engagement called “{name.trim()}” already exists — this one will be saved as “{finalName}”.</p>
                )}
              </div>
              {/* PARKED (user ask, 15 Sep): Code and Owner — Basics matches staging's
                  (name, description, company / group, entities). The engagement
                  is still saved with the auto-generated code and the default
                  owner, so nothing downstream changes. To restore, uncomment.
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={basicsLabelCls}>Code <span className="text-risk-700">*</span></label>
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
                  <p className="text-[0.6875rem] text-ink-500 mt-1">Auto-generated — edit if your team uses its own scheme.</p>
                  {code.trim().length === 0 && <Hint text="Code is required" />}
                </div>
                <div>
                  <label className={basicsLabelCls}>Owner <span className="text-risk-700">*</span></label>
                  <FormSelect value={owner} options={OWNER_NAMES} onChange={setOwner} className={selectCls} ariaLabel="Owner" menuCls="w-full" />
                </div>
              </div>
              */}
              {AUDIT_PERIOD_FIELD && (<>
              <div className="grid grid-cols-2 gap-3">
                {YEAR_TYPE_PICKER && (
                  <div>
                    <label className={basicsLabelCls}>Year type <span className="text-risk-700">*</span></label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { if (yearBasis !== 'fy') { setYearBasis('fy'); setFyEnd(y => y + 1); } }}
                        className={`px-2 py-1.5 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer ${yearBasis === 'fy' ? yeSegActive : yeSegIdle}`}
                      >
                        Financial year
                        <span className="block text-[0.625rem] font-semibold opacity-70">Apr – Mar</span>
                      </button>
                      <button
                        onClick={() => { if (yearBasis !== 'cy') { setYearBasis('cy'); setFyEnd(y => y - 1); } }}
                        className={`px-2 py-1.5 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer ${yearBasis === 'cy' ? yeSegActive : yeSegIdle}`}
                      >
                        Calendar year
                        <span className="block text-[0.625rem] font-semibold opacity-70">Jan – Dec</span>
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className={basicsLabelCls}>Audit period <span className="text-risk-700">*</span></label>
                  <select value={fyEnd} onChange={e => setFyEnd(Number(e.target.value))} className={selectCls}>
                    {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[0.75rem] text-ink-500 -mt-1">
                An annual cycle, not a dated project — testing runs {yearBasis === 'fy' ? `Apr ${fyEnd - 1} – Mar ${fyEnd}` : `Jan – Dec ${fyEnd}`} and the programme carries the {fyLabel} name through testing and roll-forward.
              </p>
              </>)}
              <div>
                <label className={basicsLabelCls}>Description <span className="text-risk-700">*</span></label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
                {description.trim().length === 0 && <Hint text="Description is required" />}
              </div>

              {/* Group & entities — moved up from Scoping (user ask): who the
                  programme runs for is asked with the rest of the identity,
                  before the documents. The table still starts empty — the RACM
                  and trial-balance uploads on the Scoping step map entities in
                  by name, so anything typed here is merged, never duplicated. */}
              <div>
                {/* Staging's label (user ask, 15 Sep) — still required: the group
                    names the company list on the RACM tab, and the company itself
                    when there are no separate entities. */}
                <label className={basicsLabelCls}>Company / group name</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Altura Infra Group" className={inputCls} />
                {groupName.trim().length === 0 && <Hint text="Company / group name is required" />}
                {/* No subsidiaries is a real answer, not an empty table — asked
                    right under the company, as staging does (user ask, 15 Sep). */}
                <button
                  role="checkbox"
                  aria-checked={soloEntity}
                  onClick={toggleSoloEntity}
                  className={`mt-2 w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    soloEntity ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                  }`}
                >
                  <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5 border ${
                    soloEntity ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                  }`}>
                    {soloEntity && <Check size={10} />}
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold text-text">There are no separate entities</span>
                    <span className="block text-[11px] text-text-muted leading-relaxed mt-0.5">
                      This company is audited as the single entity in scope — no subsidiaries to list.
                    </span>
                  </span>
                </button>
              </div>

              {/* PARKED (user ask): the group trial balance / general ledger
                  upload. Files now arrive on the audit, not the engagement —
                  the New audit wizard's Scope & files step attaches the TB and
                  GL for the period being tested, which is where they belong,
                  since a new cycle brings new ones.

                  To restore: uncomment. Every handler behind it is still wired
                  (`GROUP_DOCS`, `attached`, `onGroupDocSelected`, `removeAttached`,
                  `tbUpload`), so this is a one-block uncomment.

                  Consequence while parked: `attached` stays empty, so the
                  entity rows carry no `tbFile` into the created programme and
                  the Review step's Documents card is parked with it (below).

              <div>
                <div className={basicsLabelCls}>
                  Group documents <span className="normal-case font-medium text-ink-400">(optional)</span>
                </div>
                <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                  {GROUP_DOCS.map(d => {
                    const doc = attached.find(a => a.req === d.id);
                    const parsing = d.id === 'tb' && tbUpload === 'parsing';
                    return (
                      <div key={d.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border-light last:border-b-0">
                        <FileText size={13} className="text-text-muted shrink-0" />
                        <span className="text-[12.5px] font-semibold text-text shrink-0">{d.name}</span>
                        <span className="px-1.5 py-0.5 rounded-md border border-border text-[10px] font-bold text-text-muted shrink-0">{d.formats}</span>
                        {doc ? (
                          <span className="ml-auto flex items-center gap-1.5 min-w-0">
                            <span className="text-[11.5px] text-text truncate">{doc.name}</span>
                            {parsing
                              ? <Loader2 size={11} className="animate-spin text-text-muted shrink-0" />
                              : <Check size={12} className="text-compliant-600 shrink-0" />}
                            <button
                              onClick={() => removeAttached(doc.id)}
                              aria-label={`Remove ${d.name}`}
                              className="p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <label className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-text-secondary cursor-pointer transition-colors shrink-0">
                            <Upload size={11} /> Upload
                            <input
                              type="file"
                              className="hidden"
                              aria-label={`Upload ${d.name}`}
                              onChange={e => { onGroupDocSelected(d.id, e.target.files); e.target.value = ''; }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[0.6875rem] text-ink-500 mt-1">
                  One consolidated file each, covering the whole group — every entity's own RACM is attached in the table below.
                </p>
              </div>
              */}
              <div>
                {/* The label shares its line with the org-chart upload — the
                    fast path to filling the table sits on the table's own
                    header, not buried under it. Hidden once the company is
                    the single entity: there is no structure left to read. */}
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className={basicsLabelInlineCls}>
                    {soloEntity ? 'Entity in scope' : 'Entities in scope of the group audit'}
                  </div>
                  {/* Both ways to fill the table sit together on its header —
                      the fast one and the manual one, offered at the same
                      moment rather than one up here and one at the far end of a
                      twelve-row list. The chart control keeps the OUTER slot
                      because it is the one that changes shape (button → spinner
                      → file chip); Add entity holds still beside it. */}
                  {!soloEntity && (
                    <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      onClick={addTopLevelEntity}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-primary transition-colors cursor-pointer shrink-0"
                    >
                      <Plus size={11} /> Add entity
                    </button>
                    {(
                    orgChart === null ? (
                      <label
                        title="Excel, CSV, image, Visio or PDF — the structure is read off the chart"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-text-secondary cursor-pointer transition-colors shrink-0"
                      >
                        <Upload size={11} /> Org Chart
                        <input
                          type="file"
                          className="hidden"
                          accept={ORG_CHART_ACCEPT}
                          aria-label="Upload org chart"
                          onChange={e => { onOrgChartSelected(e.target.files); e.target.value = ''; }}
                        />
                      </label>
                    ) : orgChart.state === 'parsing' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-light bg-white text-[11px] font-semibold text-text-muted shrink-0">
                        <Loader2 size={11} className="animate-spin" /> Reading the chart…
                      </span>
                    ) : orgChart.state === 'unreadable' ? (
                      <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border border-high-100 bg-high-50 max-w-[15rem] min-w-0 shrink-0">
                        <AlertTriangle size={11} className="text-high-700 shrink-0" />
                        <span className="text-[11px] text-high-700 truncate" title={orgChart.name}>{orgChart.name}</span>
                        <button
                          onClick={() => setOrgChart(null)}
                          aria-label="Remove org chart"
                          className="p-1 rounded text-high-700 hover:bg-high-100 transition-colors cursor-pointer shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border border-border-light bg-white max-w-[15rem] min-w-0 shrink-0">
                        <FileText size={11} className="text-text-muted shrink-0" />
                        <span className="text-[11px] text-text truncate" title={orgChart.name}>{orgChart.name}</span>
                        <button
                          onClick={() => setOrgChart(null)}
                          aria-label="Remove org chart"
                          title="Removes the file — the entities it found stay in the table"
                          className="p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    )
                    )}
                    </div>
                  )}
                </div>
                {/* A chart we cannot read says so, rather than quietly handing
                    over somebody else's group. Only a spreadsheet can be read
                    honestly here; a drawn chart needs OCR the prototype has
                    not got, so the message points at the two ways forward —
                    both of which are already on the row above. */}
                {!soloEntity && orgChart?.state === 'unreadable' && (
                  <div className="mb-1.5 rounded-md border border-high-100 bg-high-50 px-2.5 py-2">
                    <p className="text-[11px] text-high-700 leading-relaxed">
                      {orgChart.reason === 'not-a-spreadsheet'
                        ? <>Couldn’t read <span className="font-semibold">{orgChart.name}</span>. Ira reads org charts kept as <span className="font-semibold">Excel or CSV</span> — a drawn chart, PDF or image can’t be extracted. Re-upload it as .xlsx / .csv, or add the companies with <span className="font-semibold">Add entity</span>.</>
                        : orgChart.reason === 'no-entity-column'
                          ? <>Read <span className="font-semibold">{orgChart.name}</span>, but no column names the companies. The sheet needs a <span className="font-semibold">legal entity name</span> column — a parent, ownership % and jurisdiction column are read too, if it has them.</>
                          : orgChart.reason === 'no-rows'
                            ? <>Read <span className="font-semibold">{orgChart.name}</span>, but it has no company rows under its header.</>
                            : <>Couldn’t open <span className="font-semibold">{orgChart.name}</span> as a spreadsheet. Save it as .xlsx or .csv and upload it again.</>}
                    </p>
                  </div>
                )}
                {/* Extraction is a first draft, not an answer — say so once, in
                    the place the rows landed. */}
                {/* The chart named a company the table already has. Nothing is
                    merged until this is answered — resolving it silently either
                    orphaned the chart's subsidiaries or binned what the user
                    typed, and neither is a decision the screen gets to make. */}
                {!soloEntity && clash && (
                  <div className="mb-1.5 rounded-md border border-high-100 bg-high-50 px-2.5 py-2">
                    <p className="flex items-start gap-1.5 text-[11px] text-high-700">
                      <AlertCircle size={11} className="shrink-0 mt-0.5" />
                      <span>
                        {clash.length === 1 ? 'This company is' : `These ${clash.length} companies are`} already
                        in the table: <b className="font-semibold">{clash.join(', ')}</b>.
                      </span>
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <button
                        onClick={() => resolveClash('adopt')}
                        className="px-2 py-1 rounded-md bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                      >
                        Keep mine and continue
                      </button>
                      <button
                        onClick={() => resolveClash('replace')}
                        className="px-2 py-1 rounded-md border border-border-light bg-white text-[11px] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        Remove mine, use the chart's
                      </button>
                    </div>
                    <p className="text-[10.5px] text-text-muted mt-1.5">
                      Either way the companies held beneath it come in attached — nothing is left without a parent.
                    </p>
                  </div>
                )}
                {!soloEntity && !clash && orgChart?.state === 'done' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-compliant-700 mb-1.5">
                    <Sparkles size={11} className="shrink-0 mt-0.5" />
                    <span>
                      Read {chart.entities.length} companies off the chart — check the names, types and
                      countries before you continue.
                    </span>
                  </p>
                )}
                {/* Ownership % column — parked for now (grid was
                    [2.4fr_1fr_0.8fr_44px] with an Ownership header cell and this
                    per-row input; the data still seeds and shows downstream):
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={1} max={100}
                        value={ent.ownership}
                        onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, ownership: Number(e.target.value) } : x))}
                        className="w-14 text-[12px] tabular-nums text-text bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40"
                      />
                      <span className="text-[11px] text-text-muted">%</span>
                    </div>
                */}
                {/* overflow-VISIBLE, deliberately: the Type dropdown's menu is
                    absolutely positioned inside its row, so `overflow-hidden`
                    here sliced it off at the row below. The header band takes
                    the top corners itself (11px = the 12px outer radius less
                    the 1px border) so nothing squares off without the clip. */}
                <div className="border border-border-light rounded-xl bg-white">
                  {/* PARKED (user ask): the "Processes — extracted" column.
                      With it, the grid was [2.6fr_0.95fr_1.05fr_34px] —
                      Entity | Type | Processes | remove, before Country
                      existed. A <div>Processes — extracted</div> header cell
                      sits commented out here and the per-row cell below;
                      `entityProcesses` / `manualProcs` / `applyManualProcs`
                      stay wired, so restoring is uncommenting three blocks and
                      adding a fifth track to both grids (after Country, before
                      the 34px remove column) — take its width from the entity
                      track, or the Type labels start to clip.

                      Its width went to the entity name, which is the row's
                      identity and was clipping the longest ones.

                      Country (user ask) took some of it back. The tracks are
                      sized off the sheet's ~414px of usable row width: Type
                      ≈114px is the least that shows "Joint venture" whole in
                      the compact dropdown, Country ≈83px fits "United States",
                      and everything else stays with the entity name. */}
                  <div className="grid grid-cols-[2.1fr_1.1fr_0.8fr_34px] gap-2.5 px-4 py-2 rounded-t-[11px] text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                    <div>Entity</div><div>Type</div><div>Country</div>{/* <div>Processes — extracted</div> */}<div />
                  </div>
                  {entities.length === 0 && (
                    <div className="px-4 py-6 text-center text-[12px] text-text-muted border-b border-border-light">
                      No entities yet — upload the org chart or add them by hand.
                    </div>
                  )}
                  {entities.map((ent, i) => {
                    const racm = entityRacm[ent.id];
                    // Where this company sits in the chain, and what actually
                    // reaches the top through it. Both come off the org chart —
                    // a hand-added row is depth 1 with nothing to say.
                    const depth = soloEntity ? 0 : entityDepth(ent, entities);
                    const parent = ent.parentId ? entities.find(x => x.id === ent.parentId) : undefined;
                    const effective = effectiveOwnership(ent, entities);
                    /** How many companies go with this one if it is deleted. */
                    const heldBeneath = familyOf(ent.id, entities).size - 1;
                    /* Said only when it is news: a wholly-owned company held
                       directly by the parent is the default, and repeating
                       "100% owned" on every such row buries the two rows where
                       the number is the point.

                       NOT gated on type. Retyping a 74%-owned company to
                       Holding used to hide its "74% owned" line while
                       effectiveOwnership kept multiplying by that 74% — the
                       rows beneath it still read "74% · held through …" with
                       the source of the number nowhere on screen. The top
                       company is silent anyway: it owns 100% and has no parent,
                       so both branches below already decline to speak. */
                    const ownershipNote = soloEntity ? null
                      : parent && depth >= 2 ? `${effective}% · held through ${parent.name}`
                      : ent.ownership !== 100 ? `${effective}% owned`
                      : null;
                    return (
                    <div key={ent.id} className="border-b border-border-light last:border-b-0">
                      {/* py, not pt: the RACM line under each row used to supply
                          the bottom padding and is parked. */}
                      <div className="grid grid-cols-[2.1fr_1.1fr_0.8fr_34px] gap-2.5 px-4 py-2.5 items-center">
                      {/* Indented by its depth in the chain, so the table keeps
                          the shape the chart had instead of flattening twelve
                          companies into twelve peers. */}
                      <div className="flex items-center gap-1.5 min-w-0" style={depth > 0 ? { paddingLeft: depth * 10 } : undefined}>
                        {depth >= 2 && (
                          <span aria-hidden className="text-[11px] text-text-muted/70 leading-none shrink-0">↳</span>
                        )}
                        {ent.type === 'Holding'
                          ? <Landmark size={14} className="text-brand-700 shrink-0" />
                          : <Building2 size={14} className="text-text-muted shrink-0" />}
                        {soloEntity ? (
                          // The company's own row — its name is the group name.
                          <span className="block text-[13px] text-text truncate py-0.5">{ent.name || '—'}</span>
                        ) : (
                          <input
                            value={ent.name}
                            onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                            aria-label={`Entity ${i + 1} name`}
                            title={ent.name}
                            ref={el => {
                              if (!el || focusEntityId !== ent.id) return;
                              el.focus();
                              el.scrollIntoView({ block: 'nearest' });
                              queueMicrotask(() => setFocusEntityId(null));
                            }}
                            className="w-full text-[13px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                          />
                        )}
                      </div>
                      {soloEntity ? (
                        <span className="text-[12px] text-text-muted">Holding</span>
                      ) : (
                        <FormSelect
                          value={ent.type}
                          options={ENTITY_TYPES}
                          onChange={v => setEntities(prev => prev.map((x, j) => j === i ? { ...x, type: v as GroupEntity['type'] } : x))}
                          className={rowSelectCls}
                          ariaLabel={`Type for ${ent.name || `entity ${i + 1}`}`}
                          menuCls="w-full min-w-[150px]"
                        />
                      )}
                      {/* Editable on every row — imported, hand-added and the
                          company's own — since a chart can be wrong about it
                          and a typed row starts without one. min-w-0: an input
                          otherwise holds its column at its default width. */}
                      <input
                        value={ent.country ?? ''}
                        onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, country: e.target.value } : x))}
                        placeholder="Country"
                        aria-label={`Country for ${ent.name.trim() || `entity ${i + 1}`}`}
                        title={ent.country}
                        className="w-full min-w-0 text-[12px] text-text-secondary bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                      />
                      {/* PARKED (user ask): the per-row "Processes — extracted"
                          cell. Uncomment with its header cell and a fifth
                          track in both grids to bring it back (see the header
                          note). It sits after Country, matching the header.

                      {(() => {
                        // A parsed RACM speaks for its own entity, whoever added it.
                        if (racm?.state === 'done') {
                          const procs = entityProcesses(ent.id);
                          return (
                            <div className="text-[11px] text-text-muted leading-snug min-w-0 truncate" title={procs.join(', ')}>
                              {procs.length ? procs.join(' · ') : '—'}
                            </div>
                          );
                        }
                        // Hand-added rows — and rows an org chart put here, which
                        // names companies but not what they run — have nothing
                        // extracted yet, so the user fills it in.
                        if (ent.id.startsWith('ent-new-') || ent.id === SOLO_ENTITY_ID
                          || (isChartRow(ent.id) && !extractedReady)) {
                          return (
                            <input
                              value={manualProcs[ent.id] ?? ''}
                              onChange={e => applyManualProcs(ent.id, e.target.value)}
                              aria-label={`Processes for ${ent.name || 'new entity'}`}
                              placeholder="Type the processes — e.g. Order to Cash, Treasury"
                              className="w-full text-[11px] text-text-secondary bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                            />
                          );
                        }
                        const procs = extractedReady ? entityProcesses(ent.id) : [];
                        return (
                          <div className="text-[11px] text-text-muted leading-snug min-w-0 truncate" title={procs.join(', ')}>
                            {procs.length ? procs.join(' · ') : '—'}
                          </div>
                        );
                      })()}
                      */}
                      {/* Row actions — delete only (user ask; the per-row add
                          button is gone, adding is the header's job). Kept as a
                          flex cell so the icon sits hard right on every row and
                          the column reads as one straight line. */}
                      <div className="flex items-center justify-end gap-1.5">
                        {/* The trial balance has no numbers for this company, so
                            scoping has nothing to run on it. Said on the row,
                            beside the button that fixes it. */}
                        {notInTrialBalance(ent) && (
                          <span
                            title="The trial balance has no numbers for this company — nothing will derive for it. Remove it, or upload its trial balance."
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mitigated-50 text-mitigated-800 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                          >
                            <AlertTriangle size={9} /> No TB
                          </span>
                        )}
                        <button
                          onClick={() => (heldBeneath > 0 ? setConfirmRemoveId(ent.id) : removeEntity(ent.id))}
                          disabled={soloEntity || entities.length === 1}
                          aria-label={`Remove ${ent.name.trim() || `entity ${i + 1}`}`}
                          className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      </div>
                      {/* The chain, on its own line at full row width. It sat
                          inside the name cell first and truncated to
                          "100% · held throu…", which is worse than not saying
                          it — a fact you cannot finish reading is not a fact.
                          Indented to line up with the name it belongs to. */}
                      {/* Confirm, but only where the damage is real: deleting a
                          company that holds others takes all of them, and the
                          count is the fact the user needs before they click.
                          A leaf still deletes in one click. */}
                      {confirmRemoveId === ent.id && (
                        <div className="px-4 pb-2.5 -mt-0.5">
                          <div className="flex items-center gap-2 flex-wrap rounded-md border border-risk-100 bg-risk-50 px-2.5 py-2">
                            <span className="flex-1 min-w-0 text-[11px] text-risk-700">
                              Remove this and the {heldBeneath} compan{heldBeneath === 1 ? 'y' : 'ies'} held beneath it?
                            </span>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-2 py-1 rounded-md border border-border-light bg-white text-[11px] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => removeEntity(ent.id)}
                              aria-label={`Confirm remove ${ent.name.trim() || `entity ${i + 1}`} and everything beneath it`}
                              className="px-2 py-1 rounded-md bg-risk-600 text-white text-[11px] font-semibold hover:bg-risk-700 transition-colors cursor-pointer shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                      {ownershipNote && (
                        <div
                          className="pr-4 pb-2 -mt-1 text-[10.5px] text-text-muted leading-tight"
                          /* px-4 (16) + icon box (14 + gap 6) + the row's own
                             indent + the ↳ the name cell adds from depth 2 —
                             which is every row this note ever renders on, so
                             leaving it out misaligned all of them. */
                          style={{ paddingLeft: 16 + 20 + depth * 10 + (depth >= 2 ? 14 : 0) }}
                        >
                          {ownershipNote}
                        </div>
                      )}
                      {/* PARKED (user ask): the per-entity RACM upload that sat
                          on its own line under each row. The engagement is now
                          created without a matrix; one is added or generated
                          from the RACM tab afterwards, and the workspace
                          Overview flags its absence until then.

                          To restore: uncomment. `entityRacm`,
                          `onEntityRacmSelected` and `removeEntityRacm` are all
                          still wired.

                          Consequence while parked: `racmCount` is always 0, so
                          every created programme carries `scopingSkipped` — which
                          is now simply true, and the Overview nag is correct.

                      <div className="pl-[38px] pr-4 pb-2.5 pt-1.5">
                        {!racm ? (
                          <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-text-secondary cursor-pointer transition-colors">
                            <Upload size={11} /> Upload RACM
                            <input
                              type="file"
                              className="hidden"
                              aria-label={`Upload RACM for ${ent.name || `entity ${i + 1}`}`}
                              onChange={e => { onEntityRacmSelected(ent.id, e.target.files); e.target.value = ''; }}
                            />
                          </label>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 pl-2 pr-1 h-7 rounded-md border border-border-light bg-white max-w-full min-w-0">
                            <FileText size={11} className="text-text-muted shrink-0" />
                            <span className="text-[11px] text-text truncate">{racm.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9.5px] font-bold uppercase tracking-wide shrink-0">RACM</span>
                            {racm.state === 'parsing' ? (
                              <Loader2 size={11} className="animate-spin text-text-muted shrink-0 mr-1" />
                            ) : (
                              <button
                                onClick={() => removeEntityRacm(ent.id)}
                                aria-label={`Remove RACM for ${ent.name || `entity ${i + 1}`}`}
                                className="p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                      */}
                    </div>
                    );
                  })}
                  {/* "Add entity" used to close the table off here. It now sits
                      on the table's header beside Upload org chart (user ask) —
                      on a twelve-row group this footer was a scroll away from
                      the point of deciding you needed another company. */}
                </div>

                {/* Staging's check, under the table (user ask, 15 Sep). */}
                {!soloEntity && entities.length === 0 && <Hint text="Add at least one entity, or tick 'There are no separate entities'." />}
              </div>
            </div>
          </StepShell>
        )}

        {/* ── S11 · Materiality & TB ────────────────────────────────────────
            New audit's "Materiality & files" step, brought over for creation.
            No StepShell strapline — each half carries its own heading, as it
            does there. Files lead: the trial balance is what the rule below is
            applied TO, and it is required. */}
        {step === MAT_TB_STEP && (
          <div>
            <div className="flex items-baseline gap-2 mb-0.5">
              <h4 className="text-[0.8125rem] font-semibold text-ink-900">Trial balance &amp; general ledger</h4>
              <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">Trial balance required</span>
            </div>
            <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
              Upload the trial balance to continue — its material accounts decide which processes this engagement covers. The general ledger can be added later.
            </p>

            {/* A ledger we could not read says so, and says what to do about
                it — the same rule the org chart follows. */}
            {ledgerError && (
              <div className="mb-3 rounded-md border border-high-100 bg-high-50 px-2.5 py-2">
                <p className="text-[0.71875rem] text-high-700 leading-relaxed">
                  {ledgerError.reason === 'not-a-spreadsheet'
                    ? <>Couldn’t read <span className="font-semibold">{ledgerError.name}</span>. Ira reads a {ledgerError.kind === 'tb' ? 'trial balance' : 'general ledger'} kept as <span className="font-semibold">Excel or CSV</span>. Save it in one of those and upload it again.</>
                    : ledgerError.reason === 'no-amount-column'
                      ? <>Read <span className="font-semibold">{ledgerError.name}</span>, but no column carries an amount. A trial balance needs a <span className="font-semibold">debit and credit</span>, or a closing balance.</>
                      : ledgerError.reason === 'not-a-ledger'
                        ? <>Read <span className="font-semibold">{ledgerError.name}</span>, but it doesn’t look like a general ledger — journal lines need a <span className="font-semibold">posting date or document number</span> alongside the amount.</>
                        : ledgerError.reason === 'no-rows'
                          ? <>Read <span className="font-semibold">{ledgerError.name}</span>, but it has no ledger rows under its header.</>
                          : <>Couldn’t open <span className="font-semibold">{ledgerError.name}</span> as a spreadsheet. Save it as .xlsx or .csv and upload it again.</>}
                </p>
              </div>
            )}

            {/* Each kind owns its uploads: empty, the box is a dashed prompt
                with a labelled Upload; once it holds a file it becomes a solid
                card whose header carries an icon-only upload for another. */}
            <div className="space-y-2 mb-4">
              {([['tb', 'Trial balance'], ['gl', 'General ledger']] as const).map(([kind, title]) => {
                // Indices carried along — `scopeFiles` stays one flat list, so
                // remove addresses the real row, not the position in this box.
                const mine = scopeFiles.map((f, i) => ({ f, i })).filter(x => x.f.kind === kind);
                return (
                  <div key={kind} className={cn('rounded-lg border bg-white', mine.length ? 'border-canvas-border' : 'border-dashed border-canvas-border')}>
                    {mine.length === 0 ? (
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <FileSpreadsheet size={16} className="text-brand-600 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.75rem] font-semibold text-ink-800 truncate">{title}</span>
                          <span className="block text-[0.65625rem] text-ink-400">XLSX · CSV</span>
                        </span>
                        <button
                          onClick={() => addScopeFile(kind)}
                          className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.71875rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer shrink-0"
                        >
                          <Upload size={12} /> Upload
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-canvas-border">
                          <FileSpreadsheet size={14} className="text-brand-600 shrink-0" />
                          <span className="text-[0.75rem] font-semibold text-ink-800 flex-1 min-w-0 truncate">{title}</span>
                          <button
                            onClick={() => addScopeFile(kind)}
                            title={`Upload another ${title.toLowerCase()}`}
                            aria-label={`Upload another ${title.toLowerCase()}`}
                            className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors cursor-pointer shrink-0"
                          >
                            <Upload size={13} />
                          </button>
                        </div>
                        {mine.map(({ f, i }) => (
                          <div key={`${f.name}-${i}`} className="px-3 py-2.5 border-b border-canvas-border last:border-b-0">
                            <div className="flex items-center gap-2">
                              <Paperclip size={12} className="text-ink-400 shrink-0" />
                              <span className="text-[0.75rem] text-ink-900 flex-1 min-w-0 truncate" title={f.name}>{f.name}</span>
                              <button
                                onClick={() => setScopeFiles(prev => prev.filter((_, x) => x !== i))}
                                className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                                aria-label={`Remove ${f.name}`}
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {/* The source, asked as the file enters (user ask) —
                                this step's wording; the rest of SOX keeps System
                                export / Client-prepared for the same two answers. */}
                            <div className="mt-2">
                              <span className="block text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400 mb-1">Source of the document</span>
                              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={`Source of ${f.name}`}>
                                {([['System export', 'System generated'], ['Client-prepared', 'Client prepared']] as const).map(([o, label]) => (
                                  <button key={o} type="button" aria-pressed={f.origin === o}
                                    onClick={() => setScopeFiles(prev => prev.map((x, n) => (n === i ? { ...x, origin: o } : x)))}
                                    className={cn('h-7 px-2 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1',
                                      f.origin === o ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-ink-300')}>
                                    {f.origin === o && <Check size={11} className="shrink-0" />}{label}
                                  </button>
                                ))}
                              </div>
                              {!f.origin && <p className="text-[0.65625rem] text-high-700 font-semibold mt-1">Pick the source to continue</p>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-canvas-border">
              <h4 className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">Materiality rule</h4>
              <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
                Set before testing starts — exceptions are measured against it.
              </p>

              <label className="block text-[0.6875rem] font-semibold text-ink-500 mb-1.5">Basis</label>
              <FormSelect
                value={basis}
                options={BASIS_OPTIONS.map(b => ({ value: b.id, label: b.label }))}
                onChange={v => changeBasis(v as MaterialityBasis)}
                className={`${matInputCls} cursor-pointer appearance-none mb-1.5`}
                ariaLabel="Materiality basis"
                menuCls="w-full"
              />
              <p className="text-[0.6875rem] text-ink-400 mb-4">{basisOpt.hint}</p>

              <div className="flex gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-[0.6875rem] font-semibold text-ink-500 mb-1.5">{basis === 'custom' ? 'Overall materiality (₹ Cr)' : `${basisOpt.benchmarkLabel} (₹ Cr)`}</label>
                  <input type="number" min={0} value={benchmark} onChange={e => setBenchmark(Number(e.target.value))} className={`${matInputCls} tabular-nums`} />
                </div>
                {basis !== 'custom' && (
                  <div className="w-24 shrink-0">
                    <label className="block text-[0.6875rem] font-semibold text-ink-500 mb-1.5">Basis %</label>
                    <input type="number" min={0.1} max={100} step={0.1} value={pct} onChange={e => setPct(Number(e.target.value))} className={`${matInputCls} tabular-nums`} />
                  </div>
                )}
              </div>

              {/* The two thresholds testing runs against — asked as a share of
                  overall with the rupee figure shown back, so the two can't
                  drift apart. */}
              <div className="mt-4 space-y-3">
                {([
                  ['Performance materiality', pmPct, setPmPct, perf, 50, 75, 5, '% of overall — auditors typically set 50–75%'],
                  ['Clearly-trivial threshold', cttPct, setCttPct, trivial, 1, 10, 1, '% of overall — below this, differences are passed'],
                ] as const).map(([label, value, set, amount, lo, hi, stepBy, hint]) => (
                  <div key={label}>
                    <label className="block text-[0.6875rem] font-semibold text-ink-500 mb-1.5">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={lo} max={hi} step={stepBy} value={value}
                        onChange={e => set(Math.min(hi, Math.max(lo, Number(e.target.value))))}
                        className={`${matInputCls} tabular-nums w-20`}
                        aria-label={`${label} as a percentage of overall`}
                      />
                      <span className="text-[0.71875rem] text-ink-500 shrink-0">% of overall</span>
                      <span className="ml-auto text-[0.8125rem] font-semibold text-ink-900 tabular-nums shrink-0">{money(amount)}</span>
                    </div>
                    <p className="text-[0.6875rem] text-ink-400 leading-relaxed mt-1">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-canvas-border bg-white p-3.5">
                <div className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider mb-2">Computed thresholds</div>
                {([
                  ['Overall materiality', money(overallCr), basis === 'custom' ? 'Set directly' : `${pct}% × ₹${benchmark} Cr`, true],
                  ['Performance materiality', money(perf), `${pmPct}% of overall — the working threshold for testing`, false],
                  ['Clearly trivial', money(trivial), `${cttPct}% of overall — below this, differences are passed`, false],
                ] as const).map(([label, value, note, strong], i) => (
                  <div key={label} className={cn('py-2', i < 2 && 'border-b border-canvas-border')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn('text-[0.75rem]', strong ? 'font-semibold text-ink-900' : 'text-ink-600')}>{label}</span>
                      <span className={cn('tabular-nums', strong ? 'text-[0.875rem] font-bold text-ink-900' : 'text-[0.78125rem] text-ink-800')}>{value}</span>
                    </div>
                    <div className="text-[0.65625rem] text-ink-400 mt-0.5">{note}</div>
                  </div>
                ))}
              </div>

              {/* Read-only — where these numbers land, not another place to set
                  them. The significant-deficiency band is the one the
                  engagement is created with. */}
              {overallCr > 0 && (
                <div className="mt-5">
                  <h5 className="text-[0.75rem] font-semibold text-ink-900 mb-2">Where an exception would land</h5>
                  <div className="space-y-1">
                    {LADDER.map((r, i) => (
                      <div key={r.label} className={cn('flex items-center justify-between gap-3 px-3 py-2 rounded-lg border', r.tone)}>
                        <span className="text-[0.71875rem] font-semibold">
                          <span className="text-ink-300 tabular-nums mr-1.5">{i + 1}</span>{r.label}
                        </span>
                        <span className="text-[0.6875rem] tabular-nums text-right">{r.band}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-ink-400 mt-1.5 leading-relaxed">
                    The significant-deficiency band starts at {SD_BAND_PCT}% of overall — change it on Materiality &amp; scope once the engagement exists.
                  </p>
                </div>
              )}
            </div>

            {/* What the uploaded ledgers said. Only appears once a trial
                balance has actually been read — there is nothing honest to
                show about a file we could not open. */}
            {tbParse && (
              <LedgerExplorer
                entities={entities}
                captions={captions}
                gl={glParse}
                perf={perf}
                money={money}
                addedByTb={tbAddedIds}
              />
            )}

            {/* ── Map material accounts to processes ─────────────────────────
                After the rule, because it reads it: only accounts at or above
                performance materiality, redrawn as the rule changes. Appears
                once a trial balance is attached. Parked — ACCOUNT_MAPPING. */}
            {ACCOUNT_MAPPING && hasTb && (
              <div className="mt-6 pt-5 border-t border-canvas-border">
                <h4 className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">
                  Map material accounts to processes
                  <span className="font-normal text-ink-500"> · {materialRows.length} account{materialRows.length === 1 ? '' : 's'} ≥ {money(perf)} (PM)</span>
                </h4>
                <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
                  Ira suggested a process for each account — change any that landed on the wrong one.
                </p>
                {materialRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-canvas-border bg-white text-[0.71875rem] text-ink-400 px-4 py-5 text-center">
                    No account in the trial balance reaches {money(perf)} — nothing to map at this threshold.
                  </p>
                ) : (
                  /* No overflow-hidden: the process menus open downward out of
                     the last rows, and clipping them would hide the options. */
                  <div className="rounded-xl border border-canvas-border bg-white">
                    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1.45fr)] gap-2.5 px-3.5 py-2 border-b border-canvas-border text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">
                      <span>Account</span><span>Entity</span><span className="text-right">Balance</span><span>Process</span>
                    </div>
                    {materialRows.map(c => (
                      <div key={c.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1.45fr)] gap-2.5 items-center px-3.5 py-2 border-b border-canvas-border last:border-b-0">
                        <span className="text-[0.75rem] text-ink-900 truncate" title={c.caption}>{c.caption}</span>
                        <span className="text-[0.71875rem] text-ink-500 truncate" title={entities.find(e => e.id === c.entityId)?.name}>{entityShort(c.entityId, entities)}</span>
                        <span className="text-[0.75rem] text-ink-800 tabular-nums text-right">{money(c.balance)}</span>
                        <FormSelect
                          value={processOf(c)}
                          options={mappingOptions}
                          onChange={v => setAccountMap(prev => ({ ...prev, [c.id]: v }))}
                          className="w-full h-8 px-2.5 text-[0.75rem] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 transition-all"
                          ariaLabel={`Process for ${c.caption}`}
                          align="right"
                          menuCls="w-[220px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── S11 · Scope ────────────────────────────────────────────────────
            Two sections (entities first — user ask, 17 Sep): which entities
            (the numbers' call), then which processes (Ira's call from the
            mapping), each opening onto the RACMs it is tested with.
            Simplified the same day ("so much is happening here"): one tick on
            the left for every choice, each section's count said once in its
            header, a reason line only where it is news, one RACM list open at
            a time, and the processes with no material accounts behind
            "Show more". */}
        {step === SCOPE_STEP && (
          <StepShell>
            {/* ── 1 · Entities ── derived, not picked. The coverage line is the
                headline: the one number that says whether the engagement
                reaches far enough across the group. */}
            <section aria-labelledby="scope-entities">
              <div className="flex items-baseline justify-between gap-3 mb-0.5">
                <h4 id="scope-entities" className="text-[0.875rem] font-semibold text-ink-900">
                  <button
                    type="button"
                    onClick={() => setEntitiesOpen(v => !v)}
                    aria-expanded={entitiesOpen}
                    aria-controls="scope-entities-body"
                    className="inline-flex items-center gap-1.5 rounded-md cursor-pointer hover:text-brand-700 transition-colors"
                  >
                    Entities
                    <ChevronDown size={14} className={cn('shrink-0 text-ink-400 transition-transform', entitiesOpen && 'rotate-180')} />
                  </button>
                </h4>
                {scope.rows.length > 0 && (
                  <span className="shrink-0 text-[0.75rem] text-ink-500 tabular-nums">
                    {scopedEntities.length} of {scope.rows.length} in scope
                  </span>
                )}
              </div>
              <AnimatePresence initial={false}>
                {entitiesOpen && (
                  <motion.div
                    id="scope-entities-body"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
                      Ticked from the trial balance against performance materiality ({money(perf)}).
                    </p>

                    {scope.rows.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-baseline justify-between gap-3 text-[0.75rem]">
                          <span className="text-ink-600">
                            <span className="font-semibold text-ink-900 tabular-nums">{coveragePct}%</span> of the group covered
                          </span>
                          <span className="shrink-0 text-ink-400 tabular-nums">Target {COVERAGE_TARGET}%</span>
                        </div>
                        <span className="relative mt-1.5 block h-1 rounded-full bg-paper-100">
                          <span
                            className={cn('absolute inset-y-0 left-0 rounded-full transition-all', coverageMet ? 'bg-compliant-600' : 'bg-mitigated-500')}
                            style={{ width: `${Math.min(100, coveragePct)}%` }}
                          />
                          {/* The target, drawn where it falls. */}
                          <span className="absolute -top-0.5 h-2 w-px bg-ink-400" style={{ left: `${COVERAGE_TARGET}%` }} aria-hidden />
                        </span>
                        {!coverageMet && (
                          <p className="flex items-start gap-1.5 mt-1.5 text-[0.6875rem] text-mitigated-700">
                            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                            <span>Below target — tick more entities until {COVERAGE_TARGET}% of the group is covered.</span>
                          </p>
                        )}
                      </div>
                    )}

                    {splitFromParent.length > 0 && (
                      <p className="flex items-start gap-1.5 mb-2 text-[0.6875rem] text-high-700">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <span>
                          {splitFromParent.length} entit{splitFromParent.length === 1 ? 'y is' : 'ies are'} held by an
                          entity that is in scope, but left out{': '}
                          <b className="font-semibold">{splitFromParent.map(r => r.name).join(', ')}</b>.
                        </span>
                      </p>
                    )}

                    <div className="rounded-lg border border-canvas-border bg-white overflow-hidden">
                      {scope.rows.length === 0 ? (
                        <p className="text-[0.75rem] text-ink-400 px-4 py-6 text-center">No entities yet — add them on Basics.</p>
                      ) : scope.rows.map(row => {
                        const on = companyInScope(row);
                        const absent = row.status === 'absent';
                        const depth = chainDepth(row, scope.rows);
                        const changed = !absent && overrides[row.id] !== undefined;
                        const editing = noteDrafts[row.id] !== undefined;
                        /** Only the exceptions get a line — "clears performance
                         *  materiality" is what the tick already says. */
                        const exception = absent ? 'Not in the trial balance'
                          : row.status === 'coverage' ? `Added to reach ${COVERAGE_TARGET}% coverage`
                          : row.status === 'out' ? 'Below performance materiality'
                          : null;
                        return (
                          <div key={row.id} className="border-b border-canvas-border last:border-b-0">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              aria-label={absent ? `${row.name} — not in the trial balance` : row.name}
                              disabled={absent}
                              onClick={() => flipEntity(row)}
                              className={cn(
                                'group w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                                absent ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-brand-50/40',
                              )}
                            >
                              <TickBox state={on} disabled={absent} />
                              {/* Only the name indents — the ticks stay one straight
                                  column however deep an entity sits. */}
                              {depth > 0 && <span aria-hidden className="shrink-0" style={{ width: `${depth * 0.75}rem` }} />}
                              {depth >= 2 && (
                                <span aria-hidden className="text-[0.6875rem] text-ink-300 leading-none shrink-0 -mr-1.5">↳</span>
                              )}
                              <span className="flex-1 min-w-0">
                                <span className={cn('block text-[0.8125rem] truncate', absent ? 'text-ink-400' : 'text-ink-900')} title={row.name}>
                                  {row.name}
                                </span>
                                {exception && <span className="block text-[0.6875rem] text-ink-500 mt-0.5">{exception}</span>}
                              </span>
                              {!absent && (
                                <span className="shrink-0 text-[0.71875rem] text-ink-400 tabular-nums">
                                  {money(row.total)} · {row.sharePct}%
                                </span>
                              )}
                            </button>

                            <AnimatePresence initial={false}>
                              {changed && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                  className="overflow-hidden"
                                >
                                  <ScopeNote
                                    question={on ? 'Why is this entity in scope?' : 'Why is this entity out of scope?'}
                                    ariaLabel={on ? `Why ${row.name} is in scope` : `Why ${row.name} is out of scope`}
                                    editing={editing}
                                    draft={noteDrafts[row.id] ?? ''}
                                    onDraft={v => setNoteDrafts(prev => ({ ...prev, [row.id]: v }))}
                                    canSave={!!(noteDrafts[row.id] ?? '').trim()}
                                    onSave={() => saveNote(row.id)}
                                    onCancel={() => cancelNote(row)}
                                    onEdit={() => setNoteDrafts(prev => ({ ...prev, [row.id]: scopeNotes[row.id] ?? '' }))}
                                    saved={scopeNotes[row.id]}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* ── 2 · Processes and their RACMs ── overruled row by row with a
                note; bringing one IN against Ira is a qualitative pick and
                takes a reason from the list too. An in-scope row opens onto
                its RACM ticks (user ask, 17 Sep — no separate RACM section). */}
            <section aria-labelledby="scope-processes" className="mt-8 pt-6 border-t border-canvas-border">
              <div className="flex items-baseline justify-between gap-3 mb-0.5">
                <h4 id="scope-processes" className="text-[0.875rem] font-semibold text-ink-900">
                  <button
                    type="button"
                    onClick={() => setProcessesOpen(v => !v)}
                    aria-expanded={processesOpen}
                    aria-controls="scope-processes-body"
                    className="inline-flex items-center gap-1.5 rounded-md cursor-pointer hover:text-brand-700 transition-colors"
                  >
                    Processes and RACMs
                    <ChevronDown size={14} className={cn('shrink-0 text-ink-400 transition-transform', processesOpen && 'rotate-180')} />
                  </button>
                </h4>
                {processRows.length > 0 && (
                  <span className="shrink-0 text-[0.75rem] text-ink-500 tabular-nums">
                    {scopedProcesses.length} in scope · {tickedRacms.length} RACM{tickedRacms.length === 1 ? '' : 's'} · {tickedControlCount} control{tickedControlCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <AnimatePresence initial={false}>
                {processesOpen && (
                  <motion.div
                    id="scope-processes-body"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
                      {recommendedCount > 0
                        ? `Ira ticked the ${recommendedCount === 1 ? 'process' : `${recommendedCount} processes`} with material accounts. Choose the RACMs each one is tested with — every control in a ticked RACM is in scope; open it to take one out.`
                        : 'No process has material accounts in the trial balance. Tick the ones to test and choose their RACMs.'}
                    </p>
                    {crossClashLines.length > 0 && (
                      <ClashNote lines={crossClashLines} />
                    )}

                    <div className="rounded-lg border border-canvas-border bg-white overflow-hidden">
                      {processRows.length === 0 ? (
                        <p className="text-[0.75rem] text-ink-400 px-4 py-6 text-center">
                          {ACCOUNT_MAPPING
                            ? 'No material accounts mapped and no RACMs on the RACM tab yet.'
                            : 'No material accounts in the trial balance and no RACMs on the RACM tab yet.'}
                        </p>
                      ) : (
                        <>
                          {visibleProcs.map(r => {
                            const on = procInScope(r);
                            const picks = on ? pickedByProcess.find(g => g.process === r.process)?.racms ?? [] : [];
                            const pickedControls = picks.reduce((s, x) => s + keptOf(x).length, 0);
                            const move = procOverrides[r.process];
                            const qualitative = move === true;
                            const editing = procNoteDrafts[r.process] !== undefined;
                            const reasonDraft = procReasonDrafts[r.process] ?? '';
                            const onTab = on ? racmsFor(r.process) : [];
                            /** Nothing on the tab to tick — uploading is the only way on. */
                            const nothingOnTab = onTab.length === 0;
                            // A RACM with controls taken out is only partly in,
                            // so "Select all" reads as mixed until they're back.
                            const allTicked = !nothingOnTab && picks.length === onTab.length && picks.every(x => outOf(x).length === 0);
                            const someTicked = picks.length > 0 && !allTicked;
                            const groupLines = on ? clashLinesFor(picks) : [];
                            const listOpen = on && openProc === r.process;
                            const listId = `scope-racms-${r.process.replace(/\W+/g, '-').toLowerCase()}`;
                            /** What the RACM handle says while folded. Short: it now
                             *  shares the name row with the process and its numbers,
                             *  and the list it opens repeats the detail anyway. */
                            /** Notes this process still owes — RACMs and controls
                             *  taken out. Named on the folded handle, because their
                             *  boxes hide when the list closes. */
                            const notesDueHere = racmChanges.filter(c => c.process === r.process && !c.note).length
                              + picks.reduce((s, x) => s + outOf(x).filter(c => !(ctlNotes[ctlKey(x.id, c.id)] ?? '').trim()).length, 0);
                            const racmHandleBase = picks.length > 0
                              ? `${picks.length} of ${onTab.length} RACM${onTab.length === 1 ? '' : 's'} · ${pickedControls} control${pickedControls === 1 ? '' : 's'}`
                              : nothingOnTab
                                ? 'No RACM yet'
                                : `Choose from ${onTab.length} RACM${onTab.length === 1 ? '' : 's'}`;
                            const racmHandleLabel = groupLines.length > 0
                              ? 'Control IDs clash — untick one'
                              : notesDueHere > 0
                                ? `${racmHandleBase} · ${notesDueHere} note${notesDueHere === 1 ? '' : 's'} due`
                                : racmHandleBase;
                            return (
                              <div key={r.process} className="border-b border-canvas-border last:border-b-0">
                                {/* ── The name row ── tick, name, and (once the process
                                    is in scope) the handle that opens its RACMs, so a
                                    folded process says everything on one line. Two
                                    buttons side by side rather than one: ticking the
                                    process and opening its RACMs are different acts,
                                    and a button cannot live inside a button. */}
                                {/* The whole row still flips the process — it did when
                                    it was one button, and shrinking the target to the
                                    width of the name would make a tick a small thing
                                    to hit while the row still lights up under the
                                    cursor. The RACM chip stops the click at itself. */}
                                <div
                                  onClick={() => flipProcess(r)}
                                  className="group flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-brand-50/40 transition-colors"
                                >
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    aria-label={r.process}
                                    onClick={e => { e.stopPropagation(); flipProcess(r); }}
                                    className="min-w-0 flex items-center gap-3 py-0.5 text-left cursor-pointer"
                                  >
                                    <TickBox state={on} />
                                    <span className="min-w-0 flex items-center gap-2">
                                      <span title={r.process} className="text-[0.8125rem] font-medium text-ink-900 truncate">{r.process}</span>
                                      {qualitative && (
                                        <span className="shrink-0 px-1.5 rounded border border-brand-200 bg-brand-50 text-[0.625rem] font-semibold text-brand-700 leading-4">Qualitative</span>
                                      )}
                                    </span>
                                  </button>

                                  {on && (
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); setOpenProc(listOpen ? null : r.process); }}
                                      aria-expanded={listOpen}
                                      aria-controls={listId}
                                      title={racmHandleLabel}
                                      className={cn(
                                        'shrink min-w-0 h-6 pl-1.5 pr-1 inline-flex items-center gap-1 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer',
                                        groupLines.length > 0 ? 'border-risk-200 bg-risk-50 text-risk-700 hover:border-risk-300'
                                          : picks.length > 0 ? 'border-canvas-border bg-white text-ink-700 hover:border-ink-300'
                                          : nothingOnTab ? 'border-canvas-border bg-paper-50 text-ink-500 hover:border-ink-300'
                                          : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100',
                                      )}
                                    >
                                      {groupLines.length > 0
                                        ? <AlertTriangle size={11} className="shrink-0" />
                                        : picks.length > 0 && <Check size={11} className="shrink-0 text-compliant-600" />}
                                      <span className="truncate tabular-nums">{racmHandleLabel}</span>
                                      <ChevronDown size={12} className={cn('shrink-0 transition-transform', listOpen && 'rotate-180')} />
                                    </button>
                                  )}

                                  {r.accounts > 0 && (
                                    <span className="ml-auto shrink-0 text-[0.71875rem] text-ink-400 tabular-nums">
                                      {money(r.total)} · {r.accounts} account{r.accounts === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>

                                {/* ── Why ── a qualitative pick asks for its reason
                                    from the list first, then the note. */}
                                <AnimatePresence initial={false}>
                                  {move !== undefined && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                      className="overflow-hidden"
                                    >
                                      <ScopeNote
                                        question={on ? 'Why is this process in scope?' : 'Why is this process out of scope?'}
                                        ariaLabel={on ? `Why ${r.process} is in scope` : `Why ${r.process} is out of scope`}
                                        editing={editing}
                                        draft={procNoteDrafts[r.process] ?? ''}
                                        onDraft={v => setProcNoteDrafts(prev => ({ ...prev, [r.process]: v }))}
                                        canSave={!!(procNoteDrafts[r.process] ?? '').trim() && (!qualitative || !!reasonDraft)}
                                        onSave={() => saveProcNote(r.process)}
                                        onCancel={() => cancelProcNote(r.process)}
                                        onEdit={() => {
                                          setProcNoteDrafts(prev => ({ ...prev, [r.process]: procNotes[r.process] ?? '' }));
                                          if (qualitative) setProcReasonDrafts(prev => ({ ...prev, [r.process]: procReasons[r.process] ?? '' }));
                                        }}
                                        saved={<>
                                          {qualitative && procReasons[r.process] && <span className="font-semibold text-ink-900">{procReasons[r.process]} — </span>}
                                          {procNotes[r.process]}
                                        </>}
                                      >
                                        {qualitative && (
                                          <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label={`Reason ${r.process} is in scope`}>
                                            {QUAL_REASONS.map(q => (
                                              <button
                                                key={q}
                                                type="button"
                                                onClick={() => setProcReasonDrafts(prev => ({ ...prev, [r.process]: q }))}
                                                aria-pressed={reasonDraft === q}
                                                className={cn('h-7 px-2 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1',
                                                  reasonDraft === q ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-ink-300')}
                                              >
                                                {reasonDraft === q && <Check size={11} className="shrink-0" />}{q}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </ScopeNote>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* ── RACMs ── the tab's RACMs for this process, hung
                                    under its name. Ticks default to the ones written
                                    for an entity in scope; any number, from any
                                    entity, can be ticked. */}
                                <AnimatePresence initial={false}>
                                  {listOpen && (
                                    <motion.div
                                      id={listId}
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                      className="overflow-hidden"
                                    >
                                      <div className="ml-[2.75rem] mr-4 pb-3">
                                        {groupLines.length > 0 && <ClashNote lines={groupLines} />}
                                        {nothingOnTab ? (
                                          <div className="flex items-center gap-3">
                                            <p className="flex-1 min-w-0 text-[0.71875rem] text-ink-500 leading-relaxed">
                                              {draftRacmsFor(r.process).length > 0
                                                // The RACM exists — it just isn't publishable work yet, and
                                                // "upload one" would send the reader to build a second copy.
                                                ? <>{draftRacmsFor(r.process).length === 1 ? 'There is a RACM for this process, but it is still a draft' : `There are ${draftRacmsFor(r.process).length} RACMs for this process, but all of them are still drafts`}. Publish {draftRacmsFor(r.process).length === 1 ? 'it' : 'one'} on the RACM tab, upload another, or untick {r.process} and say why.</>
                                                : <>Upload one, or untick {r.process} and say why.</>}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => openRacmUpload(r.process)}
                                              title={`Upload a RACM for ${r.process} — it's saved to the RACM tab and ticked here`}
                                              className="shrink-0 h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.71875rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
                                            >
                                              <Upload size={12} /> Upload RACM
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="border-t border-canvas-border">
                                              {onTab.length > 1 && (
                                                <button
                                                  type="button"
                                                  role="checkbox"
                                                  aria-checked={allTicked ? true : someTicked ? 'mixed' : false}
                                                  aria-label={`${allTicked ? 'Untick' : 'Tick'} every ${r.process} RACM`}
                                                  onClick={() => setAllRacms(r.process, !allTicked)}
                                                  className="group w-full flex items-center gap-3 py-2 border-b border-canvas-border text-left cursor-pointer"
                                                >
                                                  <TickBox state={allTicked ? true : someTicked ? 'mixed' : false} />
                                                  <span className="text-[0.75rem] font-semibold text-ink-700">Select all</span>
                                                </button>
                                              )}
                                              {onTab.map(x => {
                                                const ticked = picks.some(p => p.id === x.id);
                                                // The name usually carries its entity
                                                // ("Order to Cash — Airline Group Ltd");
                                                // say it only when it doesn't.
                                                const showEntity = !!x.entity && !x.name.toLowerCase().includes(x.entity.toLowerCase());
                                                const all = scopableControls(x);
                                                const outIds = ticked ? outOf(x).map(c => c.id) : [];
                                                const keptCount = all.length - outIds.length;
                                                const partial = outIds.length > 0;
                                                const ctlNotesDue = outIds.filter(id => !(ctlNotes[ctlKey(x.id, id)] ?? '').trim()).length;
                                                /** Started ticked and was taken out — owes a note. */
                                                const racmOut = !ticked && racmChanges.some(c => c.racmId === x.id);
                                                const ctlOpen = ticked && openRacmCtl === x.id;
                                                const ctlListId = `scope-ctls-${x.id.replace(/\W+/g, '-')}`;
                                                return (
                                                  <div key={x.id} className="border-b border-canvas-border">
                                                    <div className="flex items-center gap-3">
                                                      <button
                                                        type="button"
                                                        role="checkbox"
                                                        aria-checked={partial ? 'mixed' : ticked}
                                                        aria-label={`${x.name} — ${all.length} controls`}
                                                        onClick={() => clickRacm(r.process, x, ticked)}
                                                        title={x.usedBy.length > 0 ? `Used by ${x.usedBy.map(u => u.name).join(', ')}` : undefined}
                                                        className="group flex-1 min-w-0 flex items-center gap-3 py-2 text-left cursor-pointer"
                                                      >
                                                        <TickBox state={partial ? 'mixed' : ticked} />
                                                        <span className="flex-1 min-w-0 truncate text-[0.78125rem] text-ink-900">
                                                          {x.name}
                                                          {showEntity && <span className="text-ink-400"> · {x.entity}</span>}
                                                        </span>
                                                      </button>
                                                      {/* A ticked RACM opens to its controls — every one
                                                          in, any can be taken out. */}
                                                      {ticked ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => setOpenRacmCtl(ctlOpen ? null : x.id)}
                                                          aria-expanded={ctlOpen}
                                                          aria-controls={ctlListId}
                                                          title={ctlOpen ? 'Hide controls' : 'Show controls — untick any that don’t apply'}
                                                          className="shrink-0 h-6 -mr-1 pl-1.5 pr-1 inline-flex items-center gap-1 rounded-md text-[0.71875rem] text-ink-500 tabular-nums hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                                                        >
                                                          {partial
                                                            ? `${keptCount} of ${all.length} controls${ctlNotesDue > 0 ? ' · note due' : ''}`
                                                            : `${all.length} control${all.length === 1 ? '' : 's'}`}
                                                          <ChevronDown size={12} className={cn('shrink-0 transition-transform', ctlOpen && 'rotate-180')} />
                                                        </button>
                                                      ) : (
                                                        <span className="shrink-0 text-[0.71875rem] text-ink-400 tabular-nums">
                                                          {all.length} control{all.length === 1 ? '' : 's'}
                                                        </span>
                                                      )}
                                                    </div>
                                                    {/* No saved note yet → the box is open to type into;
                                                        Cancel ticks the RACM back. */}
                                                    {racmOut && (
                                                      <ScopeNote
                                                        className="ml-7 mb-2"
                                                        question="Why is this RACM out of scope?"
                                                        ariaLabel={`Why ${x.name} is out of scope`}
                                                        editing={racmNoteDrafts[x.id] !== undefined || !racmNotes[x.id]}
                                                        draft={racmNoteDrafts[x.id] ?? ''}
                                                        onDraft={v => setRacmNoteDrafts(prev => ({ ...prev, [x.id]: v }))}
                                                        canSave={!!(racmNoteDrafts[x.id] ?? '').trim()}
                                                        onSave={() => saveRacmNote(x.id)}
                                                        onCancel={() => cancelRacmNote(r.process, x.id)}
                                                        onEdit={() => setRacmNoteDrafts(prev => ({ ...prev, [x.id]: racmNotes[x.id] ?? '' }))}
                                                        saved={racmNotes[x.id]}
                                                      />
                                                    )}
                                                    <AnimatePresence initial={false}>
                                                      {ctlOpen && (
                                                        <motion.div
                                                          id={ctlListId}
                                                          initial={{ opacity: 0, height: 0 }}
                                                          animate={{ opacity: 1, height: 'auto' }}
                                                          exit={{ opacity: 0, height: 0 }}
                                                          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                                          className="overflow-hidden"
                                                        >
                                                          <div className="ml-7 pb-2" role="group" aria-label={`${x.name} controls`}>
                                                            {all.map(c => {
                                                              const isOut = outIds.includes(c.id);
                                                              const key = ctlKey(x.id, c.id);
                                                              const label = c.code ?? c.id;
                                                              return (
                                                                <div key={c.id}>
                                                                  <button
                                                                    type="button"
                                                                    role="checkbox"
                                                                    aria-checked={!isOut}
                                                                    aria-label={`${label} — ${c.description}`}
                                                                    onClick={() => flipControl(x, c.id)}
                                                                    className="group w-full flex items-center gap-3 py-1.5 text-left cursor-pointer"
                                                                  >
                                                                    <TickBox state={!isOut} />
                                                                    <span className="shrink-0 font-mono text-[0.6875rem] text-ink-500">{label}</span>
                                                                    <span
                                                                      title={c.description}
                                                                      className={cn('flex-1 min-w-0 truncate text-[0.75rem]', isOut ? 'text-ink-400' : 'text-ink-800')}
                                                                    >
                                                                      {c.description}
                                                                    </span>
                                                                  </button>
                                                                  {isOut && (
                                                                    <ScopeNote
                                                                      className="ml-7 mb-2"
                                                                      question="Why is this control out of scope?"
                                                                      ariaLabel={`Why ${label} is out of scope`}
                                                                      editing={ctlNoteDrafts[key] !== undefined}
                                                                      draft={ctlNoteDrafts[key] ?? ''}
                                                                      onDraft={v => setCtlNoteDrafts(prev => ({ ...prev, [key]: v }))}
                                                                      canSave={!!(ctlNoteDrafts[key] ?? '').trim()}
                                                                      onSave={() => saveCtlNote(key)}
                                                                      onCancel={() => cancelCtlNote(x, c.id)}
                                                                      onEdit={() => setCtlNoteDrafts(prev => ({ ...prev, [key]: ctlNotes[key] ?? '' }))}
                                                                      saved={ctlNotes[key]}
                                                                    />
                                                                  )}
                                                                </div>
                                                              );
                                                            })}
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                    </AnimatePresence>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            {/* Quiet while there are RACMs to tick, so it
                                                doesn't invite a duplicate of one already
                                                there. */}
                                            <button
                                              type="button"
                                              onClick={() => openRacmUpload(r.process)}
                                              title={`Upload a RACM for ${r.process} — it's saved to the RACM tab and ticked here`}
                                              className="mt-1.5 -ml-2 h-7 px-2 inline-flex items-center gap-1.5 rounded-lg text-[0.71875rem] font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                                            >
                                              <Upload size={12} /> Upload a RACM
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                          {quietProcCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowAllProcs(v => !v)}
                              aria-expanded={showAllProcs}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:bg-brand-50/40 transition-colors cursor-pointer"
                            >
                              <span className="w-4 flex justify-center shrink-0">
                                <ChevronDown size={14} className={cn('transition-transform', showAllProcs && 'rotate-180')} />
                              </span>
                              {showAllProcs
                                ? 'Hide processes with no material accounts'
                                : <span>Show {quietProcCount} more process{quietProcCount === 1 ? '' : 'es'} <span className="font-normal text-ink-400">— no material accounts</span></span>}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </StepShell>
        )}

        {SCOPING_STEP && step === 2 && (
          <StepShell title="Scoping">
            {/* Required-files card (user ask): the three scoping documents
                listed as requirements, ONE bulk upload button (native
                multi-select picker), attached files as tagged chips beneath.
                The group name and entity table were asked on Basics. */}
            <div className="mb-5">
              <div className="border border-border-light rounded-xl bg-white">
                <div className="flex items-center gap-2 px-4 py-3">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-[13px] font-bold text-text">Recommended files</span>
                  <span className="text-[11.5px] text-text-muted">{REQUIRED_DOCS.length} recommended · {REQUIRED_DOCS.length} total</span>
                  <label className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[11.5px] font-semibold transition-colors cursor-pointer">
                    <Upload size={12} /> {attached.length > 0 ? 'Add more' : 'Upload'}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      aria-label="Upload recommended files"
                      onChange={e => { onFilesSelected(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                </div>
                <div className="px-4 pb-3.5 flex flex-wrap gap-2">
                  {REQUIRED_DOCS.map(d => {
                    const done = attached.some(a => a.req === d.id);
                    return (
                      <div key={d.id} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border ${done ? 'border-compliant-100 bg-compliant-50/40' : 'border-border-light bg-white'}`}>
                        <span className="text-[12.5px] font-semibold text-text">{d.name}</span>
                        <span className="px-1.5 py-0.5 rounded-md border border-border text-[10px] font-bold text-text-muted">{d.formats}</span>
                        {done && <Check size={13} className="text-compliant-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {attached.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                      Attached
                      <span className="w-[18px] h-[18px] rounded-full bg-ink-900 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">{attached.length}</span>
                    </span>
                    <span className="text-[11.5px] text-text-muted tabular-nums">{reqSatisfied}/{REQUIRED_DOCS.length} recommended inputs satisfied</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {attached.map(a => (
                      <span key={a.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-9 rounded-lg border border-border-light bg-white min-w-0">
                        <FileText size={12} className="text-text-muted shrink-0" />
                        <span className="text-[12px] text-text truncate">{a.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9.5px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">{REQ_TAG[a.req]}</span>
                        <button
                          onClick={() => removeAttached(a.id)}
                          aria-label={`Remove ${a.name}`}
                          className="ml-auto p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {(racmUpload === 'parsing' || tbUpload === 'parsing') && (
                    <span className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-text-muted">
                      <Loader2 size={12} className="animate-spin" /> Parsing…
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* The entity table lives on Basics now — say what the uploads did
                to it here, so the derivation stays visible on the step that
                caused it. */}
            {extractedReady && entities.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                <Check size={12} className="text-compliant-600 shrink-0" />
                {entities.length} {entities.length === 1 ? 'entity' : 'entities'} mapped from the uploads — review them on Basics.
              </div>
            )}
            {TB_UPLOAD && entities.length > 0 && tbUpload !== 'done' && (
              <Hint text="Upload the trial balances to continue — scoping runs on their numbers." />
            )}

            {/* Mapping lives here now (absorbed from the old Mapping step) —
                ALL extracted captions, since materiality hasn't run yet. */}
            {extractedReady && entities.length > 0 && (
              <>
                <div className="mt-5">
                  <FieldLabel>Map accounts to processes — every extracted caption</FieldLabel>
                  <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                    <div className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                      <div>Extracted caption</div><div>Entity</div><div>Process</div>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                      {captions.map(row => (
                        <div key={row.id} className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                          <div className="text-[12.5px] text-text truncate">{row.caption}</div>
                          <div className="text-[11.5px] text-text-muted">{entityShort(row.entityId, entities)}</div>
                          <select
                            value={captionProcess(row)}
                            onChange={e => setMapping(prev => ({ ...prev, [row.id]: e.target.value as ProcessName }))}
                            className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                          >
                            {PROCESS_NAMES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Helper line parked (user ask):
                  <p className="text-[11px] text-text-muted mt-2">The processes come from the uploaded RACM — adjust any caption that landed on the wrong one.</p>
                  */}
                </div>

                {BEYOND_TB_CARD && (
                <div className="mt-4 border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Beyond the trial balance</div>
                  <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Always considered for scope — they never appear as TB captions.</p>
                  <div className="space-y-1.5">
                    {BEYOND_TB.map(b => {
                      const on = beyond[b.id];
                      return (
                        <button
                          key={b.id}
                          onClick={() => setBeyond(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                          className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            on ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5 border ${
                            on ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                          }`}>
                            {on && <Check size={10} />}
                          </span>
                          <span>
                            <span className="block text-[12px] font-semibold text-text">{b.name}</span>
                            <span className="block text-[11px] text-text-muted leading-relaxed mt-0.5">{b.why}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </>
            )}
          </StepShell>
        )}

        {MATERIALITY_STEP && (
          <StepShell
            title="Materiality — set before any testing"
            sub="Pick the basis that fits the group, and the thresholds cascade from it. These numbers decide which trial-balance captions get flagged in the next step."
          >
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {BASIS_OPTIONS.map(b => {
                const active = basis === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => { setBasis(b.id); setBenchmark(b.defaultBenchmark); setPct(b.defaultPct); }}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      active ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border-light bg-white hover:border-primary/30'
                    }`}
                  >
                    <div className={`text-[12.5px] font-semibold ${active ? 'text-primary' : 'text-text'}`}>{b.label}</div>
                    <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{b.hint}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="border border-border-light rounded-xl bg-white p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>{basisOpt.benchmarkLabel} (₹ Cr)</FieldLabel>
                    <input
                      type="number" min={0}
                      value={benchmark}
                      onChange={e => setBenchmark(Number(e.target.value))}
                      className="w-full px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  {basis !== 'custom' && (
                    <div>
                      <FieldLabel>Basis %</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0.1} max={100} step={0.1}
                          value={pct}
                          onChange={e => setPct(Number(e.target.value))}
                          className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                        />
                        <span className="text-[12px] text-text-muted truncate">% of {basisOpt.benchmarkLabel.toLowerCase()}</span>
                      </div>
                    </div>
                  )}
                </div>
                {basis !== 'custom' && (
                  <div>
                    <FieldLabel>Overall materiality (₹ Cr)</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="w-40 px-3 py-2 text-[13px] font-semibold tabular-nums border border-border-light rounded-lg bg-surface-2/60 text-text">
                        {fmtCr(overallCr)}
                      </div>
                      <span className="text-[12px] text-text-muted">= {pct}% × {fmtCr(benchmark)} — switch to Custom amount to set it directly</span>
                    </div>
                  </div>
                )}
                <div>
                  <FieldLabel>Performance materiality (% of overall)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={50} max={75} step={5}
                      value={pmPct}
                      onChange={e => setPmPct(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                    <span className="text-[12px] text-text-muted">% of overall — auditors typically set 50–75%</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Clearly-trivial threshold (% of overall)</FieldLabel>
                  <input
                    type="number" min={1} max={10}
                    value={cttPct}
                    onChange={e => setCttPct(Number(e.target.value))}
                    className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Computed ladder */}
              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Computed thresholds</div>
                <LadderRow label="Overall materiality" value={fmtCr(overallCr)} strong
                  note={basis === 'custom' ? 'Set directly' : `${pct}% × ${fmtCr(benchmark)}`} />
                <LadderRow label="Performance materiality" value={fmtCr(overallCr * pmPct / 100)} note={`${pmPct}% of overall — the working threshold for testing`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall — below this, differences are passed`} last />
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border-light">
                  <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-text-muted leading-relaxed">
                    Materiality is locked before testing starts. Captions at or above {fmtCr(overallCr)} are flagged automatically in the next step.
                  </p>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {QUAL_STEP && (
          <StepShell
            title="Qualitative overlay"
            sub="Some captions sit below materiality but still belong in scope — small balances with huge flows, or complex accounting. Scope them in with a reason."
          >
            {belowThreshold.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-10 text-center">
                <Info size={18} className="mx-auto text-text-muted mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing sits below {fmtCr(overallCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  Every caption is already flagged quantitatively at this materiality, so there is nothing left to scope in by judgement. Continue to the mapping step.
                </p>
              </div>
            )}
            {belowThreshold.length > 0 && (
            <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-text">
                {quantScope.length} of {captions.length} captions cleared materiality automatically
              </span>
              <span className="text-[11.5px] text-text-muted">across {entities.length} entities · threshold {fmtCr(overallCr)}</span>
            </div>
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Caption (below {fmtCr(overallCr)})</div><div>Entity</div><div className="text-right">Balance</div><div>Scope in</div>
              </div>
              {belowThreshold.map(row => {
                const q = qual[row.id];
                const on = q?.on ?? false;
                return (
                  <div key={row.id} className={`border-b border-border-light last:border-b-0 ${on ? 'bg-brand-50/30' : ''}`}>
                    <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2.5 items-center">
                      <div className="text-[12.5px] text-text">{row.caption}</div>
                      <div className="text-[11.5px] text-text-muted">{entityShort(row.entityId, entities)}</div>
                      <div className="text-[12px] font-mono tabular-nums text-right text-text-secondary">{fmtCr(row.balance)}</div>
                      <div className="flex items-center gap-2">
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`Scope in ${row.caption}`}
                          onClick={() => setQual(prev => ({
                            ...prev,
                            [row.id]: on
                              ? { ...prev[row.id], on: false }
                              : { captionId: row.id, reason: prev[row.id]?.reason ?? QUAL_REASONS[0], note: prev[row.id]?.note ?? '', on: true },
                          }))}
                          className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${on ? 'bg-primary' : 'bg-surface-3'}`}
                        >
                          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[18px]' : 'left-[2px]'}`} />
                        </button>
                        {on && (
                          <select
                            value={q?.reason}
                            onChange={e => setQual(prev => ({ ...prev, [row.id]: { ...prev[row.id], reason: e.target.value as QualPick['reason'] } }))}
                            className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer min-w-0"
                          >
                            {QUAL_REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                    {on && q?.note && (
                      <div className="px-4 pb-2.5 -mt-1">
                        <p className="text-[11.5px] text-text-muted leading-relaxed pl-0.5">{q.note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}
            {/* Empty-scope guard — lived on the Mapping step until it was
                absorbed into Scoping; this is now the last gate before Review. */}
            {inScope.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-8 text-center mt-4">
                <AlertCircle size={18} className="mx-auto text-risk-700 mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing is in scope at {fmtCr(overallCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  No caption clears materiality and nothing is scoped in qualitatively — zero processes would derive, so there is no programme to create. Lower the threshold on the materiality step, or scope captions in above.
                </p>
              </div>
            )}
            <p className="text-[11.5px] text-text-muted mt-3">
              {qualScope.length} caption{qualScope.length === 1 ? '' : 's'} scoped in qualitatively — they join the {quantScope.length} quantitative flags.
            </p>
          </StepShell>
        )}

        {step === SAMPLING_STEP && (
          <StepShell
            sub="How this engagement samples — agreed once here, and what every control's sample size is then read off. Nothing is decided control by control."
          >
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <div className="px-3.5 py-2 border-b border-border bg-canvas">
                <div className="text-[0.78125rem] font-semibold text-text">Sample sizes</div>
                <p className="text-[0.71875rem] text-text-secondary mt-0.5">How many items to test, by how often the control runs and how the risk is rated.</p>
              </div>
              <table className="w-full text-[0.78125rem]">
                <thead>
                  <tr className="text-[0.6875rem] uppercase tracking-wide text-text-muted">
                    <th className="text-left font-semibold px-3.5 py-2">How often it runs</th>
                    <th className="font-semibold px-2 py-2 w-24">Low risk</th>
                    <th className="font-semibold px-2 py-2 w-24">Medium</th>
                    <th className="font-semibold px-2 py-2 w-24">High risk</th>
                  </tr>
                </thead>
                <tbody>
                  {FREQUENCY_ORDER.map(f => (
                    <tr key={f} className="border-t border-border">
                      <td className="px-3.5 py-1.5 text-text">
                        {FREQUENCY_SAYS[f]}
                        {/* No rhythm to size against, so these are a starting
                            point rather than a rule — said here, not hidden. */}
                        {f === 'Ad-hoc' && <span className="block text-[0.6875rem] text-text-muted">Judgment — size by how often it actually ran</span>}
                      </td>
                      {(['low', 'medium', 'high'] as const).map(r => (
                        <td key={r} className="px-2 py-1.5 text-center">
                          <input
                            type="number" min={1} value={sampling.sizes[f][r]}
                            onChange={e => setSize(f, r, Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                            aria-label={`${FREQUENCY_SAYS[f]}, ${r} risk`}
                            className="w-16 px-2 py-1 text-center border border-border rounded-md text-[0.78125rem] text-text bg-white outline-none focus:border-primary/40"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-[0.78125rem] font-semibold text-text mb-1.5">How items are selected</div>
                <div className="flex flex-col gap-1.5">
                  {SAMPLING_METHODS.map(m => (
                    <button
                      key={m} type="button" role="radio" aria-checked={sampling.method === m}
                      onClick={() => setSampling(s => ({ ...s, method: m }))}
                      className={cn('px-3 py-2 rounded-lg border text-left text-[0.78125rem] cursor-pointer transition-colors',
                        sampling.method === m ? 'border-brand-200 bg-brand-50 text-brand-700 font-semibold' : 'border-border text-text-secondary hover:text-text')}
                    >{m}</button>
                  ))}
                </div>
                <p className="text-[0.6875rem] text-text-muted mt-1.5 leading-relaxed">
                  The seed behind every draw is stored, so anyone can reperform the selection and land on the same items.
                </p>
              </div>

              <div>
                <div className="text-[0.78125rem] font-semibold text-text mb-1.5">Across the year's rounds</div>
                <div className="flex flex-col gap-1.5">
                  {(['per-round', 'whole-period'] as const).map(b => (
                    <button
                      key={b} type="button" role="radio" aria-checked={sampling.roundBasis === b}
                      onClick={() => setSampling(s => ({ ...s, roundBasis: b }))}
                      className={cn('px-3 py-2 rounded-lg border text-left text-[0.78125rem] cursor-pointer transition-colors',
                        sampling.roundBasis === b ? 'border-brand-200 bg-brand-50 text-brand-700 font-semibold' : 'border-border text-text-secondary hover:text-text')}
                    >{b === 'per-round' ? 'Per round' : 'Whole period'}</button>
                  ))}
                </div>
                {/* The choice is made with its effect visible, rather than
                    explained somewhere the person choosing will not be. */}
                <p className="text-[0.6875rem] text-text-muted mt-1.5 leading-relaxed">{ROUND_BASIS_EFFECT[sampling.roundBasis]}</p>
              </div>
            </div>

            {/* Any, all or none — the one answer here that is not a choice of one
                (the Dubai ask: quarters, countries and entities). */}
            <div className="mb-4">
              <div className="text-[0.78125rem] font-semibold text-text mb-1.5">What every draw has to reach</div>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="What every draw has to reach">
                {SAMPLING_SPREADS.map(x => {
                  const on = sampling.spread.includes(x.id);
                  return (
                    <button
                      key={x.id} type="button" role="checkbox" aria-checked={on}
                      onClick={() => setSampling(s => ({ ...s, spread: on ? s.spread.filter(i => i !== x.id) : [...s.spread, x.id] }))}
                      className={cn('px-3 py-2 rounded-lg border text-[0.78125rem] cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5',
                        on ? 'border-brand-200 bg-brand-50 text-brand-700 font-semibold' : 'border-border text-text-secondary hover:text-text')}
                    >{on && <Check size={12} className="shrink-0" aria-hidden />}{x.label}</button>
                  );
                })}
              </div>
              <p className="text-[0.6875rem] text-text-muted mt-1.5 leading-relaxed">
                {sampling.spread.length
                  ? `Every control's draw is split across ${spreadLabel(sampling.spread).toLowerCase()}, with at least one item in each.`
                  : 'Not spread — items fall wherever the selection puts them. Tick anything every draw has to reach.'}
              </p>
            </div>

            <div className="rounded-lg border border-border px-3.5 py-2.5 flex items-start gap-2">
              <Info size={13} className="text-text-muted shrink-0 mt-0.5" aria-hidden />
              <p className="text-[0.71875rem] text-text-secondary leading-relaxed">
                This is your proposal. It becomes the agreed methodology when the reviewer signs it on the engagement's
                Configuration tab — <span className="font-semibold text-text">testing waits for that signature</span>. Changing it afterwards creates a new version,
                and an audit already running finishes on the version it started under.
              </p>
            </div>
          </StepShell>
        )}

        {step === REVIEW_STEP && (
          <StepShell
            title="Review"
            sub={`Confirm the scope, and the RACMs it copies in, before the ${fy} programme is created.`}
          >
            {/* S11 — the steps' answers in the order they were given: who,
                the rule and its trial balance, the processes, then the RACMs
                those processes copy in. */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <ReviewCard title="Engagement">
                <ReviewRow label="Name" value={finalName} />
                <ReviewRow label="Code" value={code.trim().toUpperCase()} />
                <ReviewRow label="Owner" value={owner} />
                <ReviewRow label="Cycle" value={<>{fyLabel} <span className="font-normal text-ink-400">· opinion as of {asOf}</span></>} />
              </ReviewCard>

              {/* What was agreed on the Sampling step, said back before the
                  programme is created — it decides every sample size that
                  follows, so it does not belong only in a step nobody revisits. */}
              <ReviewCard title="Sampling methodology">
                <ReviewRow label="Selection" value={sampling.method} />
                <ReviewRow label="Spread across" value={spreadLabel(sampling.spread)} />
                <ReviewRow label="Across rounds" value={sampling.roundBasis === 'per-round' ? 'Per round' : 'Whole period'} />
                <ReviewRow label="Monthly control" value={`${sampling.sizes.Monthly.low}–${sampling.sizes.Monthly.high} items, by risk rating`} />
                <p className="text-[0.6875rem] text-ink-400 mt-1 leading-relaxed">
                  Proposed. Testing waits until the reviewer signs it on the Configuration tab.
                </p>
              </ReviewCard>

              <ReviewCard title={soloEntity ? 'Company in scope' : 'Group & entities'}>
                <div className="text-[13px] font-semibold text-text mb-1.5">{groupName}</div>
                {scope.rows.map(r => {
                  const e = entities.find(x => x.id === r.id);
                  const on = companyInScope(r);
                  const change = scopeChanges.find(c => c.entityId === r.id);
                  return (
                    <div key={r.id} className="py-0.5">
                      <div className="flex items-center gap-1.5 text-[0.71875rem] text-text-secondary min-w-0">
                        {r.type === 'Holding' ? <Landmark size={11} className="text-brand-700 shrink-0" /> : <Building2 size={11} className="text-text-muted shrink-0" />}
                        <span className="truncate">{r.name}</span>
                        {/* Its own span so a long name truncates before the country does. */}
                        {e?.country?.trim() && <span className="shrink-0">· {e.country.trim()}</span>}
                        <span className={cn('shrink-0 ml-auto pl-2 font-semibold', on ? 'text-ink-700' : 'text-ink-400')}>
                          {on ? 'In scope' : 'Out'}
                        </span>
                      </div>
                      {/* A company moved against the trial balance says why —
                          the part of the scope the numbers don't explain. */}
                      {change?.note && (
                        <p className="pl-[17px] text-[0.6875rem] text-ink-500 leading-relaxed">
                          {change.inScope ? 'Brought in' : 'Taken out'} — {change.note}
                        </p>
                      )}
                    </div>
                  );
                })}
                <p className="mt-2 text-[0.6875rem] text-text-muted tabular-nums">
                  {coveragePct}% of the group covered · target {COVERAGE_TARGET}%
                </p>
              </ReviewCard>

              <ReviewCard title="Materiality">
                <LadderRow label="Overall" value={money(overallCr)} strong note={basis === 'custom' ? 'Set directly' : `${pct}% of ${basisOpt.benchmarkLabel.toLowerCase()}`} />
                <LadderRow label="Performance" value={money(perf)} note={`${pmPct}% of overall`} />
                <LadderRow label="Clearly trivial" value={money(trivial)} note={`${cttPct}% of overall`} last />
              </ReviewCard>

              <ReviewCard title="Trial balance & accounts">
                <ReviewRow
                  label="Trial balance"
                  value={scopeFiles.filter(f => f.kind === 'tb').map(f => f.name).join(', ') || <span className="font-normal text-ink-400">Not attached</span>}
                />
                <ReviewRow
                  label="General ledger"
                  value={scopeFiles.filter(f => f.kind === 'gl').map(f => f.name).join(', ') || <span className="font-normal text-ink-400">Not attached</span>}
                />
                <ReviewRow
                  label="Account mapping"
                  value={<>{materialRows.length} material account{materialRows.length === 1 ? '' : 's'} mapped <span className="font-normal text-ink-400">· ≥ {money(perf)}</span></>}
                />
              </ReviewCard>

              {/* Which processes are in on Ira's word, which on the user's (with
                  the reason), and which were taken out and why. */}
              <ReviewCard title="Processes">
                <ReviewRow
                  label="In scope"
                  value={scopedProcesses.length === 0 ? <span className="font-normal text-ink-400">None</span> : (
                    <span className="block space-y-1.5">
                      {scopedProcesses.map(r => {
                        const move = procChanges.find(c => c.process === r.process);
                        return (
                          <span key={r.process} className="block">
                            {r.process}
                            <span className="font-normal text-ink-400"> · {move?.qualitative ? 'qualitative' : 'recommended by Ira'}</span>
                            {move?.qualitative && (
                              <span className="block text-[0.6875rem] font-normal text-ink-500 leading-relaxed">{move.reason} — {move.note}</span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                  )}
                />
                {procChanges.some(c => !c.inScope) && (
                  <ReviewRow
                    label="Moved out"
                    value={(
                      <span className="block space-y-1.5">
                        {procChanges.filter(c => !c.inScope).map(c => (
                          <span key={c.process} className="block">
                            {c.process}
                            <span className="block text-[0.6875rem] font-normal text-ink-500 leading-relaxed">{c.note}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  />
                )}
              </ReviewCard>

              {/* What the engagement will actually test — copied now, so this is
                  the last place to see it before the copies are taken. */}
              <ReviewCard title="RACMs from the RACM tab">
                {pickedByProcess.map(g => {
                  const count = g.racms.reduce((s, r) => s + keptOf(r).length, 0);
                  return (
                    <div key={g.process} className="py-2 border-b border-canvas-border">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[0.75rem] font-semibold text-ink-900 min-w-0 truncate">{g.process}</span>
                        <span className="text-[0.6875rem] text-ink-500 tabular-nums shrink-0">{count} control{count === 1 ? '' : 's'}</span>
                      </div>
                      {g.racms.map(r => {
                        const kept = keptOf(r).length;
                        const total = scopableControls(r).length;
                        const outs = ctlChanges.filter(c => c.racmId === r.id);
                        return (
                          <div key={r.id} className="mt-1">
                            <div className="flex items-baseline justify-between gap-3 text-[0.71875rem]">
                              <span className="min-w-0 truncate text-ink-600" title={r.name}>{r.name}</span>
                              <span className="shrink-0 text-ink-400 tabular-nums">{kept < total ? `${kept} of ${total}` : kept}</span>
                            </div>
                            {/* Each control taken out, with the reason given for it. */}
                            {outs.map(c => (
                              <p key={c.controlId} className="mt-0.5 pl-3 text-[0.6875rem] text-ink-500 leading-relaxed">
                                <span className="font-mono">{c.code}</span> out — {c.note}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                      {/* RACMs that started ticked and were taken out, and why. */}
                      {racmChanges.filter(c => c.process === g.process).map(c => (
                        <p key={c.racmId} className="mt-1 text-[0.6875rem] text-ink-500 leading-relaxed">
                          <span className="text-ink-600">{c.racm}</span> taken out — {c.note}
                        </p>
                      ))}
                    </div>
                  );
                })}
                <div className="flex items-baseline justify-between gap-3 pt-2">
                  <span className="text-[0.75rem] font-semibold text-ink-900">Total</span>
                  <span className="text-[0.8125rem] font-bold tabular-nums text-ink-900">
                    {tickedRacms.length} RACM{tickedRacms.length === 1 ? '' : 's'} · {tickedControlCount} control{tickedControlCount === 1 ? '' : 's'}
                  </span>
                </div>
              </ReviewCard>
            </div>

            {/* PARKED (S11) — the Review this step showed before creation
                scoped anything: the "created without a RACM" banner, the
                per-entity RACM line, the Documents card and the RACMs grid
                derived from captions. None of it is true of an engagement that
                arrives with its RACMs picked. Flip PRE_S11_REVIEW to see it. */}
            {PRE_S11_REVIEW && (<>
              {(scopingSkipped || racmCount === 0) && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-high-50 border border-high-100">
                  <AlertCircle size={13} className="text-high-700 shrink-0 mt-0.5" />
                  <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                    {/* One arm now, not two: the RACM and the TB / GL are no
                        longer asked for here, so arriving without them is the
                        normal path rather than something the user skipped. */}
                    The engagement is created without a RACM — add or generate one from the RACM tab, and the workspace
                    Overview will flag it until you do. The trial balance and general ledger are attached later, on the
                    audit that tests them.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 mb-4">
                <ReviewCard title={soloEntity ? 'Company in scope' : 'Group & entities'}>
                  <div className="text-[13px] font-semibold text-text mb-1.5">{groupName}</div>
                  {entities.map(e => (
                    <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary py-0.5 min-w-0">
                      {e.type === 'Holding' ? <Landmark size={11} className="text-brand-700 shrink-0" /> : <Building2 size={11} className="text-text-muted shrink-0" />}
                      <span className="truncate">{e.name}</span>
                      {/* Its own span so a long name truncates before the country does. */}
                      {e.country?.trim() && <span className="shrink-0">· {e.country.trim()}</span>}
                      {/* Say plainly whether the matrix is in — a missing RACM is
                          the thing that stalls the engagement later. */}
                      {entityRacm[e.id]
                        ? <span className="inline-flex items-center gap-1 text-text-muted shrink-0"><FileText size={10} /> <span className="max-w-[140px] truncate">{entityRacm[e.id].name}</span></span>
                        : <span className="text-text-muted shrink-0">· no RACM yet</span>}
                    </div>
                  ))}
                </ReviewCard>
                {SCOPING_STEP && (<>
                <ReviewCard title="Materiality">
                  <LadderRow label="Overall" value={fmtCr(overallCr)} strong note={basis === 'custom' ? 'Set directly' : `${pct}% of ${basisOpt.benchmarkLabel.toLowerCase()}`} />
                  <LadderRow label="Performance" value={fmtCr(overallCr * pmPct / 100)} note={`${pmPct}% of overall`} />
                  <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall`} last />
                </ReviewCard>
                <ReviewCard title="Scope funnel">
                  <FunnelRow label="TB captions parsed" value={captions.length} />
                  <FunnelRow label="Flagged above materiality" value={quantScope.length} />
                  <FunnelRow label="Scoped in qualitatively" value={qualScope.length} />
                  <FunnelRow label="Processes derived" value={derived.length} />
                  <FunnelRow label="Group-level workstreams" value={BEYOND_TB.filter(b => beyond[b.id]).length} last />
                </ReviewCard>
                </>)}
                {!SCOPING_STEP && (
                  <ReviewCard title="Documents">
                    {GROUP_DOCS.map(d => {
                      const doc = attached.find(a => a.req === d.id);
                      return (
                        <div key={d.id} className="flex items-center gap-1.5 text-[11.5px] py-0.5 min-w-0">
                          {doc
                            ? <Check size={11} className="text-compliant-600 shrink-0" />
                            : <Circle size={9} className="text-text-muted shrink-0" />}
                          <span className="text-text-secondary shrink-0">{d.name}</span>
                          <span className="text-text-muted truncate">{doc ? doc.name : '— not attached'}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1.5 text-[11.5px] py-0.5">
                      {racmCount > 0
                        ? <Check size={11} className="text-compliant-600 shrink-0" />
                        : <Circle size={9} className="text-text-muted shrink-0" />}
                      <span className="text-text-secondary shrink-0">RACM</span>
                      <span className="text-text-muted">
                        {racmCount > 0
                          ? `${racmCount} of ${entities.length} ${entities.length === 1 ? 'entity' : 'entities'}`
                          : '— add one from the RACM tab later'}
                      </span>
                    </div>
                  </ReviewCard>
                )}
              </div>

              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                  RACMs — added from the RACM tab once the engagement exists
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {derived.map(r => (
                    <div key={r.process} className="rounded-lg p-3 bg-surface-2/50">
                      <div className="text-[12.5px] font-semibold text-text">{r.process}</div>
                      <div className="text-[10.5px] text-text-muted mt-0.5 mb-2 tabular-nums">
                        {r.sources.length} source caption{r.sources.length === 1 ? '' : 's'} · {r.entities.join(', ')}
                      </div>
                      <SourceChips sources={r.sources} max={3} />
                    </div>
                  ))}
                  {BEYOND_TB.filter(b => beyond[b.id]).map(b => (
                    <div key={b.id} className="rounded-lg p-3 bg-surface-2/60">
                      <div className="text-[12.5px] font-semibold text-text-secondary">{b.name}</div>
                      <div className="text-[10.5px] text-text-muted mt-0.5">Group-level workstream — scoped without a TB caption</div>
                    </div>
                  ))}
                </div>
              </div>
            </>)}
          </StepShell>
        )}
      </motion.div>

      {/* Footer — pinned to the modal's bottom edge (mt-auto on short steps,
          sticky over the scroll on tall ones) so Back/Continue never float */}
      <div className="mt-auto pt-6" />
      <div className="flex items-center justify-between py-4 border-t border-border-light sticky bottom-0 bg-canvas -mx-6 px-6">
        <button
          onClick={() => (step === firstStep
            ? (typePreselected && onBackToType ? onBackToType() : onCancel())
            : setStep(s => s - 1))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === firstStep && !(typePreselected && onBackToType) ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <span className="flex items-center gap-2 min-w-0 pl-3">
            {/* What the greyed Continue is waiting for — see footerHint. */}
            {!canContinue && footerHint && (
              <span className="text-[0.71875rem] text-high-700 font-medium text-right leading-snug">{footerHint}</span>
            )}
            {SCOPING_STEP && step === 2 && (
              <button
                onClick={skipScoping}
                title="Create without scoping — the workspace Overview flags the missing RACM; the trial balance and GL arrive on the audit that tests them"
                className="px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canContinue}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Continue <ArrowRight size={13} />
            </button>
          </span>
        ) : (
          <button
            onClick={create}
            disabled={!readyToCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} /> Create {fy} programme
          </button>
        )}
      </div>

      {/* Upload RACM, from a process on Scope — the RACM tab's own Create RACM
          with the process settled by the row it was pressed on. Portalled to
          the body: this sheet is a transformed, fixed panel, and a fixed
          dialog inside it would be positioned against the sheet rather than
          the window. The RACM is saved to the tab by the dialog; it is only
          ticked here. */}
      {racmUploadFor && createPortal(
        <CreateRacmFlow
          fixedProcess={racmUploadFor.process}
          defaultEntity={racmUploadFor.entity || undefined}
          publishOnCreate
          onClose={() => setRacmUploadFor(null)}
          onCreated={racm => onRacmUploaded(racmUploadFor.process, racm)}
        />,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** The step rail is the only header — steps open straight with their one-line
 *  explainer (the user asked the duplicate per-step titles removed; Basics
 *  carries no explainer at all). */
function StepShell({ sub, children }: { title?: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      {sub && <p className="text-[12.5px] text-text-secondary mb-5 leading-relaxed">{sub}</p>}
      {children}
    </div>
  );
}

/** Step rail — same visual language as the Engagements creation flow
 *  (CreateEngagementWizard): thin segment bars, one per step, with the
 *  uppercase labels beneath. Travelled segments tint brand and click back;
 *  upcoming steps stay quiet and unclickable. Shared by the scoping and
 *  roll-forward flows. */
export function StepRail({ steps, step, onStepClick }: {
  steps: readonly string[];
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {steps.map((label, i) => (
          <button
            key={label}
            onClick={() => { if (i <= step) onStepClick(i); }}
            className={`flex-1 h-1.5 rounded-full transition-colors ${i === step ? 'bg-brand-600' : i < step ? 'bg-brand-300' : 'bg-canvas-border'} ${i <= step ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">
        {steps.map((label, i) => (
          <span key={label} className={i === step ? 'text-brand-700' : ''}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/** Control IDs held by two ticked RACMs. Blocks Continue, so it reads as the
 *  same warning box Basics uses when an org chart clashes with the table. */
/** The one tick on the Scope step — entities, processes and RACMs all use it,
 *  so a single control means "in". Sits inside a `group` row button, which
 *  carries the role, the state and the focus ring. */
function TickBox({ state, disabled }: { state: boolean | 'mixed'; disabled?: boolean }) {
  const filled = state === true || state === 'mixed';
  return (
    <span
      aria-hidden
      className={cn(
        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
        disabled ? 'border-canvas-border bg-paper-50'
          : filled ? 'bg-brand-600 border-brand-600 text-white'
          : 'border-ink-300 bg-white group-hover:border-ink-400',
      )}
    >
      {state === 'mixed' ? <Minus size={11} strokeWidth={3} /> : state ? <Check size={11} strokeWidth={3} /> : null}
    </span>
  );
}

/** The "why" under a Scope row moved against the numbers or against Ira. Set
 *  on workpaper tones — the note is retained in the working paper — and hung
 *  under the row's name like the RACM list. `children` sits above the text
 *  box (a qualitative pick's reason chips). `className` replaces the default
 *  indent — a control's note sits deeper, under the control. */
function ScopeNote({ question, ariaLabel, editing, draft, onDraft, canSave, onSave, onCancel, onEdit, saved, children, className }: {
  className?: string;
  question: string;
  ariaLabel: string;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  saved: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('p-3 rounded-lg border border-paper-300/70 bg-paper-50', className ?? 'ml-[2.75rem] mr-4 mb-3')}>
      <p className="text-[0.71875rem] font-semibold text-ink-800 mb-1.5">{question}</p>
      {editing ? (
        <>
          {children}
          <textarea
            aria-label={ariaLabel}
            autoFocus
            rows={2}
            value={draft}
            onChange={e => onDraft(e.target.value)}
            placeholder="Record your rationale — retained in the working paper."
            className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-white px-2.5 py-2 text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 resize-none transition-colors"
          />
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-7 px-2.5 rounded-lg text-[0.71875rem] font-semibold text-ink-500 hover:text-ink-800 hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="h-7 px-3 rounded-lg text-[0.71875rem] font-semibold bg-brand-600 text-white disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-brand-700 transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.75rem] text-ink-700 leading-relaxed min-w-0 whitespace-pre-wrap">{saved}</p>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 h-6 px-2 rounded-md text-[0.71875rem] font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

function ClashNote({ lines }: { lines: string[] }) {
  return (
    <div className="mb-2.5 rounded-md border border-high-100 bg-high-50 px-2.5 py-2">
      {lines.map(line => (
        <p key={line} className="flex items-start gap-1.5 text-[0.6875rem] text-high-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span>{line} — untick one to continue.</span>
        </p>
      ))}
    </div>
  );
}

/** Review rows — label left, value right, as on the New audit review. */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-canvas-border last:border-b-0">
      <span className="text-[0.71875rem] text-ink-500 shrink-0">{label}</span>
      <span className="text-[0.75rem] font-semibold text-ink-900 text-right min-w-0">{value}</span>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <div className="mt-1 flex items-center gap-1 text-[0.75rem] text-risk-700"><AlertCircle size={11} /> {text}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{children}</div>;
}

function LadderRow({ label, value, note, strong, last }: {
  label: string; value: string; note?: string; strong?: boolean; last?: boolean;
}) {
  return (
    <div className={`py-2 ${last ? '' : 'border-b border-border-light'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${strong ? 'font-semibold text-text' : 'text-text-secondary'}`}>{label}</span>
        <span className={`font-mono tabular-nums ${strong ? 'text-[15px] font-bold text-text' : 'text-[13px] text-text'}`}>{value}</span>
      </div>
      {note && <div className="text-[10.5px] text-text-muted mt-0.5">{note}</div>}
    </div>
  );
}

function FunnelRow({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${last ? '' : 'border-b border-border-light'}`}>
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className="text-[13px] font-bold tabular-nums text-text">{value}</span>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border-light rounded-xl bg-white p-4">
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">{title}</div>
      {children}
    </div>
  );
}
