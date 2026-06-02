/**
 * Cross-entity joins for the Process Hub detail pages.
 *
 * The seed data in mockData.ts captures direct links (SOP -> RACM,
 * Control -> Risk, etc.) but not yet the Control <-> Workflow link.
 * CONTROL_WORKFLOWS bridges that until the data model catches up.
 */

import { CONTROLS, WORKFLOWS, RACMS, RISKS, SOPS, BUSINESS_PROCESSES } from './mockData';

const CONTROL_WORKFLOWS: Record<string, string[]> = {
  'CTR-001': ['wf-007'],
  'CTR-002': ['wf-003'],
  'CTR-005': ['wf-001'],
  'CTR-006': ['wf-008'],
  'CTR-007': ['wf-004'],
  'CTR-008': ['wf-005'],
};

function bpIdFromAbbr(abbr: string): string | undefined {
  return BUSINESS_PROCESSES.find(b => b.abbr === abbr)?.id;
}

export function getRiskRelationships(riskId: string, businessProcessAbbr: string) {
  const controls = CONTROLS.filter(c => c.riskId === riskId);
  const workflowIds = new Set(controls.flatMap(c => CONTROL_WORKFLOWS[c.id] ?? []));
  const workflows = WORKFLOWS.filter(w => workflowIds.has(w.id));
  const bpId = bpIdFromAbbr(businessProcessAbbr);
  const racms = bpId ? RACMS.filter(r => r.bpId === bpId) : [];
  return { controls, workflows, racms };
}

export function getControlRelationships(controlId: string) {
  const control = CONTROLS.find(c => c.id === controlId);
  if (!control) return { risks: [], workflows: [], racms: [] };
  const risks = RISKS.filter(r => r.id === control.riskId);
  const workflowIds = CONTROL_WORKFLOWS[control.id] ?? [];
  const workflows = WORKFLOWS.filter(w => workflowIds.includes(w.id));
  const bpId = risks[0]?.bpId;
  const racms = bpId ? RACMS.filter(r => r.bpId === bpId) : [];
  return { risks, workflows, racms };
}

export function getWorkflowRelationships(workflowId: string) {
  const workflow = WORKFLOWS.find(w => w.id === workflowId);
  if (!workflow) return { controls: [], risks: [], racms: [] };
  const controlIds = Object.entries(CONTROL_WORKFLOWS)
    .filter(([, wfs]) => wfs.includes(workflow.id))
    .map(([cid]) => cid);
  const controls = CONTROLS.filter(c => controlIds.includes(c.id));
  const riskIds = new Set(controls.map(c => c.riskId));
  const risks = RISKS.filter(r => riskIds.has(r.id));
  const racms = RACMS.filter(r => r.bpId === workflow.bpId);
  return { controls, risks, racms };
}

export function getSopRelationships(sopId: string) {
  const sop = SOPS.find(s => s.id === sopId);
  if (!sop) return { racm: null, risks: [], controls: [] };
  const racm = sop.racmId ? RACMS.find(r => r.id === sop.racmId) ?? null : null;
  const risks = RISKS.filter(r => r.bpId === sop.bpId);
  const riskIds = new Set(risks.map(r => r.id));
  const controls = CONTROLS.filter(c => riskIds.has(c.riskId));
  return { racm, risks, controls };
}

export function getRacmRelationships(racmId: string) {
  const racm = RACMS.find(r => r.id === racmId);
  if (!racm) return { sop: null, risks: [], controls: [], workflows: [] };
  const sop = racm.sopId ? SOPS.find(s => s.id === racm.sopId) ?? null : null;
  const risks = RISKS.filter(r => r.bpId === racm.bpId);
  const riskIds = new Set(risks.map(r => r.id));
  const controls = CONTROLS.filter(c => riskIds.has(c.riskId));
  const workflowIds = new Set(controls.flatMap(c => CONTROL_WORKFLOWS[c.id] ?? []));
  const workflows = WORKFLOWS.filter(w => workflowIds.has(w.id));
  return { sop, risks, controls, workflows };
}
