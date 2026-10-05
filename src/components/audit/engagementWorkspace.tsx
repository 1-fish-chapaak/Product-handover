/**
 * Engagement workspace store — shared, in-session state for one compliance/IA
 * engagement, consumed by the Controls, RACM, and Workflows tabs.
 *
 * Holds:
 *  - controls: base controls (from the RACM library) + user-added custom controls
 *  - extra attributes added to any control (base or custom)
 *  - attribute ↔ workflow links (live + bidirectional), so linking a workflow to
 *    an attribute in Controls shows up on the Workflows tab and vice-versa.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { RACM_LIBRARY, racmRowsForProcess, type ControlAttribute, type RACMRow } from '../../data/racm';
import type { Engagement } from '../../data/engagements';
import { getEngagementPlan, type PlanControl } from '../../data/auditPlan';

export interface WorkspaceWorkflow {
  id: string;
  code: string;
  name: string;
  /** Workflow Library id, when the engagement workflow wraps one. */
  libraryId?: string;
}

/** A plan control's single test attribute — the check that evidences it. */
const planAttributeId = (c: PlanControl) => `${c.controlId}-AI1`;

function planControlToWorkspace(c: PlanControl): WorkspaceControl {
  const manual = c.check.kind === 'manual';
  return {
    controlId: c.controlId,
    description: c.title,
    subProcess: c.subProcess,
    isKey: c.isKey,
    frequency: c.frequency,
    attributes: [{
      id: planAttributeId(c),
      description: c.check.name,
      testProcedure: c.check.description,
      requiredEvidence: manual ? ['Walkthrough evidence'] : ['Workflow exception report'],
      populationSize: 1000,
      defaultSampleSize: manual ? 25 : 0,
      scope: manual ? 'SAMPLE_BASED' : 'GENERIC',
    }],
    custom: false,
    inRacm: true,
  };
}

/** The workflow a plan control's check is linked to, if any. Reused checks
 *  match on the library id; new ones on the id the Workflows tab gives them. */
function planWorkflowFor(c: PlanControl, workflows: WorkspaceWorkflow[]): WorkspaceWorkflow | undefined {
  if (c.check.kind === 'manual') return undefined;
  return workflows.find(w =>
    (c.check.existingWorkflowId && w.libraryId === c.check.existingWorkflowId) || w.id === `pwf-${c.check.id}`,
  );
}

export interface WorkspaceControl {
  controlId: string;
  description: string;
  subProcess: string;
  isKey: boolean;
  frequency: RACMRow['frequency'];
  attributes: ControlAttribute[];
  /** True for user-added controls (vs. base RACM library controls). */
  custom: boolean;
  /** Whether this custom control was pushed into the RACM. */
  inRacm: boolean;
}

interface WorkspaceCtx {
  workflows: WorkspaceWorkflow[];
  /** Base + custom controls, each merged with any extra attributes added in-session. */
  controls: WorkspaceControl[];
  /** Custom controls flagged for the RACM (rendered by the RACM tab). */
  racmControls: WorkspaceControl[];
  attributeById: (attributeId: string) => { description: string; controlId: string } | undefined;

  // ── Attribute ↔ workflow links ──
  workflowIdsForAttribute: (attributeId: string) => string[];
  attributeIdsForWorkflow: (workflowId: string) => string[];
  linkWorkflow: (attributeId: string, workflowId: string) => void;
  unlinkWorkflow: (attributeId: string, workflowId: string) => void;

  // ── Authoring ──
  addControl: (input: { description: string; isKey: boolean; subProcess: string; attributes: string[]; inRacm: boolean }) => void;
  addAttribute: (controlId: string, description: string) => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function useEngagementWorkspace(): WorkspaceCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEngagementWorkspace must be used within EngagementWorkspaceProvider');
  return c;
}

/** Derive the base (library) controls for an engagement — one row per controlId.
 *  Exported so the engagement insight subjects are built from the SAME rows the
 *  Controls tab renders — the drawer's redirects land on rows that exist. */
export function baseControlsFor(engagement: Engagement): WorkspaceControl[] {
  // An engagement created by an audit plan holds exactly its plan's controls;
  // one extended by a plan lists the plan's controls ahead of the RACM set.
  const plan = getEngagementPlan(engagement.id);
  const planned = plan ? plan.controls.map(planControlToWorkspace) : [];
  if (plan?.mode === 'created') return planned;
  const rows = racmRowsForProcess(engagement.process);
  const usable = rows.length > 0 ? rows : RACM_LIBRARY;
  const byId = new Map<string, WorkspaceControl>();
  usable.forEach(r => {
    if (byId.has(r.controlId)) return;
    byId.set(r.controlId, {
      controlId: r.controlId,
      description: r.controlDescription,
      subProcess: r.subProcess,
      isKey: r.isKey,
      frequency: r.frequency,
      attributes: r.attributes,
      custom: false,
      inRacm: true,
    });
  });
  return [...planned, ...Array.from(byId.values()).filter(c => !planned.some(p => p.controlId === c.controlId))];
}

/** Seed a few attribute→workflow links so the Workflows tab reads as live out of the box. */
function seedLinks(base: WorkspaceControl[], workflows: WorkspaceWorkflow[]): Record<string, string[]> {
  const attrIds = base.flatMap(c => c.attributes.map(a => a.id));
  const links: Record<string, string[]> = {};
  workflows.forEach((wf, i) => {
    const attr = attrIds[i];
    if (attr) links[attr] = [...(links[attr] ?? []), wf.id];
  });
  return links;
}

export function EngagementWorkspaceProvider({
  engagement,
  workflows,
  children,
}: {
  engagement: Engagement;
  workflows: WorkspaceWorkflow[];
  children: ReactNode;
}) {
  const base = useMemo(() => baseControlsFor(engagement), [engagement]);

  const [customControls, setCustomControls] = useState<WorkspaceControl[]>([]);
  // Extra attributes added in-session, keyed by controlId (works for base + custom controls).
  const [extraAttributes, setExtraAttributes] = useState<Record<string, ControlAttribute[]>>({});
  const [linksByAttribute, setLinksByAttribute] = useState<Record<string, string[]>>(() => {
    // Plan controls come linked to their check; the demo seed links fill the rest.
    const plan = getEngagementPlan(engagement.id);
    const planLinks: Record<string, string[]> = {};
    plan?.controls.forEach(c => {
      const wf = planWorkflowFor(c, workflows);
      if (wf) planLinks[planAttributeId(c)] = [wf.id];
    });
    if (plan?.mode === 'created') return planLinks;
    return { ...seedLinks(base, workflows), ...planLinks };
  });

  const controls = useMemo<WorkspaceControl[]>(() => {
    const merge = (c: WorkspaceControl): WorkspaceControl => {
      const extra = extraAttributes[c.controlId];
      return extra && extra.length ? { ...c, attributes: [...c.attributes, ...extra] } : c;
    };
    return [...customControls.map(merge), ...base.map(merge)];
  }, [base, customControls, extraAttributes]);

  const racmControls = useMemo(() => controls.filter(c => c.custom && c.inRacm), [controls]);

  const attrIndex = useMemo(() => {
    const m = new Map<string, { description: string; controlId: string }>();
    controls.forEach(c => c.attributes.forEach(a => m.set(a.id, { description: a.description, controlId: c.controlId })));
    return m;
  }, [controls]);

  const attributeById = useCallback((id: string) => attrIndex.get(id), [attrIndex]);

  const workflowIdsForAttribute = useCallback(
    (attributeId: string) => linksByAttribute[attributeId] ?? [],
    [linksByAttribute],
  );

  const attributeIdsForWorkflow = useCallback(
    (workflowId: string) =>
      Object.entries(linksByAttribute)
        .filter(([, ids]) => ids.includes(workflowId))
        .map(([attrId]) => attrId),
    [linksByAttribute],
  );

  const linkWorkflow = useCallback((attributeId: string, workflowId: string) => {
    setLinksByAttribute(prev => {
      const list = prev[attributeId] ?? [];
      if (list.includes(workflowId)) return prev;
      return { ...prev, [attributeId]: [...list, workflowId] };
    });
  }, []);

  const unlinkWorkflow = useCallback((attributeId: string, workflowId: string) => {
    setLinksByAttribute(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).filter(id => id !== workflowId) }));
  }, []);

  const addControl = useCallback((input: { description: string; isKey: boolean; subProcess: string; attributes: string[]; inRacm: boolean }) => {
    setCustomControls(prev => {
      const seq = prev.length + 1;
      const controlId = `C-NEW-${String(seq).padStart(2, '0')}`;
      const attributes: ControlAttribute[] = input.attributes
        .map(s => s.trim())
        .filter(Boolean)
        .map((desc, i) => ({
          id: `${controlId}-A${i + 1}`,
          description: desc,
          testProcedure: 'Define the test procedure for this attribute.',
          requiredEvidence: [],
          populationSize: 0,
          defaultSampleSize: 0,
        }));
      const control: WorkspaceControl = {
        controlId,
        description: input.description.trim(),
        subProcess: input.subProcess.trim() || 'New controls',
        isKey: input.isKey,
        frequency: 'Monthly',
        attributes,
        custom: true,
        inRacm: input.inRacm,
      };
      return [control, ...prev];
    });
  }, []);

  const addAttribute = useCallback((controlId: string, description: string) => {
    const desc = description.trim();
    if (!desc) return;
    setExtraAttributes(prev => {
      const list = prev[controlId] ?? [];
      const attr: ControlAttribute = {
        id: `${controlId}-X${list.length + 1}`,
        description: desc,
        testProcedure: 'Define the test procedure for this attribute.',
        requiredEvidence: [],
        populationSize: 0,
        defaultSampleSize: 0,
      };
      return { ...prev, [controlId]: [...list, attr] };
    });
  }, []);

  const value = useMemo<WorkspaceCtx>(() => ({
    workflows,
    controls,
    racmControls,
    attributeById,
    workflowIdsForAttribute,
    attributeIdsForWorkflow,
    linkWorkflow,
    unlinkWorkflow,
    addControl,
    addAttribute,
  }), [workflows, controls, racmControls, attributeById, workflowIdsForAttribute, attributeIdsForWorkflow, linkWorkflow, unlinkWorkflow, addControl, addAttribute]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
