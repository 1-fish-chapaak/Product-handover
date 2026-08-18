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
import { racmRegisters, useRacmRegisterVersion, type SopDoc } from './racmRegisterStore';

export type { SopDoc } from './racmRegisterStore';

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

  // ── The RACM register — single source for the RACM and Controls tabs ──
  /** Every risk-control row this engagement owns. Seeded from the process
   *  library, empty for an engagement created without a scope. */
  racmRows: RACMRow[];
  /** Replace the whole register (uploading a full matrix). */
  replaceRacmRows: (rows: RACMRow[]) => void;
  /** Add rows for a newly extracted area, keeping what is already there. */
  appendRacmRows: (rows: RACMRow[]) => void;
  /** Remove a control everywhere — register, Controls tab and workflow links. */
  deleteControl: (controlId: string) => void;
  /** SOPs the auditor linked, by RACM entry id. Survives leaving the tab. */
  sopOverrides: Record<string, SopDoc>;
  setSopOverride: (entryId: string, sop: SopDoc) => void;

  /** Register + custom controls, each merged with any extra attributes added in-session. */
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

/** The rows an engagement's RACM register starts life with. An engagement
 *  created without a scope (the lean Internal Audit flow) starts empty — its
 *  register is built from the RACM the auditor uploads or extracts inside it. */
export function seedRacmRows(engagement: Engagement): RACMRow[] {
  if (engagement.unscoped) return [];
  const rows = racmRowsForProcess(engagement.process);
  return rows.length > 0 ? rows : RACM_LIBRARY;
}

/** Collapse RACM rows into one control per controlId. This is the ONLY place
 *  controls are derived, so a control carries the same id on the RACM tab and
 *  the Controls tab however it got there — library, SOP extraction or upload. */
export function controlsFromRows(rows: RACMRow[]): WorkspaceControl[] {
  const byId = new Map<string, WorkspaceControl>();
  rows.forEach(r => {
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

/** The controls an engagement starts with. Exported so the engagement insight
 *  subjects are built from the SAME rows the Controls tab renders — the
 *  drawer's redirects land on rows that exist. */
export function baseControlsFor(engagement: Engagement): WorkspaceControl[] {
  return controlsFromRows(seedRacmRows(engagement));
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
  // The register. Backed by the module-level store so an uploaded or extracted
  // RACM survives ANY navigation — tab switches, the full-page editor (which
  // renders outside this provider), even leaving the engagement — and so the
  // Controls tab and the editor see the same controls the auditor just created.
  const registerVersion = useRacmRegisterVersion();
  const { racmRows, sopOverrides } = useMemo(() => {
    const reg = racmRegisters.ensure(engagement.id, () => seedRacmRows(engagement));
    return { racmRows: reg.rows, sopOverrides: reg.sops };
    // registerVersion re-reads the store after every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagement, registerVersion]);
  const base = useMemo(() => controlsFromRows(racmRows), [racmRows]);

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

  const replaceRacmRows = useCallback((rows: RACMRow[]) => racmRegisters.replaceRows(engagement.id, rows), [engagement.id]);

  const appendRacmRows = useCallback((rows: RACMRow[]) => racmRegisters.appendRows(engagement.id, rows), [engagement.id]);

  const setSopOverride = useCallback((entryId: string, sop: SopDoc) => {
    racmRegisters.setSop(engagement.id, entryId, sop);
  }, [engagement.id]);

  /** Delete a control everywhere it exists. The RACM is the register, so a row
   *  removed there must not linger on the Controls tab or keep a workflow
   *  pointed at an attribute that no longer exists. */
  const deleteControl = useCallback((controlId: string) => {
    racmRegisters.removeControl(engagement.id, controlId);
    setCustomControls(prev => prev.filter(c => c.controlId !== controlId));
    setExtraAttributes(prev => {
      if (!(controlId in prev)) return prev;
      const next = { ...prev };
      delete next[controlId];
      return next;
    });
    // Attribute ids are always prefixed with their control id.
    setLinksByAttribute(prev => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([attrId, ids]) => {
        if (!attrId.startsWith(controlId)) next[attrId] = ids;
      });
      return next;
    });
  }, [engagement.id]);

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
    racmRows,
    replaceRacmRows,
    appendRacmRows,
    deleteControl,
    sopOverrides,
    setSopOverride,
    controls,
    racmControls,
    attributeById,
    workflowIdsForAttribute,
    attributeIdsForWorkflow,
    linkWorkflow,
    unlinkWorkflow,
    addControl,
    addAttribute,
  }), [workflows, racmRows, replaceRacmRows, appendRacmRows, deleteControl, sopOverrides, setSopOverride,
    controls, racmControls, attributeById, workflowIdsForAttribute, attributeIdsForWorkflow, linkWorkflow, unlinkWorkflow, addControl, addAttribute]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
