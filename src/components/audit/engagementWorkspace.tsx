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
import { draftedRacmRows } from '../../data/draftedRegisterStore';
import type { Engagement } from '../../data/engagements';

export interface WorkspaceWorkflow {
  id: string;
  code: string;
  name: string;
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
  // An engagement drafted by One-Click Audit carries its own register; the process
  // library is the fallback for every engagement that didn't come from the wizard.
  const drafted = draftedRacmRows(engagement.id);
  const rows = racmRowsForProcess(engagement.process);
  const usable = drafted ?? (rows.length > 0 ? rows : RACM_LIBRARY);
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
  return Array.from(byId.values());
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
  const [linksByAttribute, setLinksByAttribute] = useState<Record<string, string[]>>(() => seedLinks(base, workflows));

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
