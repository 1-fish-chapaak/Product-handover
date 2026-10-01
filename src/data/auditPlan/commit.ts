/**
 * Commit a reviewed plan: the one write path both surfaces share.
 *
 * For every selected engagement:
 *   • target 'new'      → create the Engagement (AI Recommended) and record
 *                         its plan controls as the engagement's controls.
 *   • target 'existing' → append the plan controls to that engagement.
 * Then every selected new check becomes a draft Workflow Library row linked
 * to its control and engagement. Reused checks are linked, not copied;
 * manual checks live on the control as a test procedure.
 */
import { addCreatedEngagements } from '../createdEngagementsStore';
import type { Engagement } from '../engagements';
import { PROCESS_LONG } from './catalog';
import { addPlanWorkflows, saveEngagementPlan, type PlanWorkflowRow } from './store';
import type { AuditPlan, PlanControl, PlanEngagement } from './types';

export interface CommittedEngagement {
  engagementId: string;
  engagementName: string;
  created: boolean;
  controls: PlanControl[];
  newChecks: PlanWorkflowRow[];
  reused: number;
  manual: number;
}

const monthLabel = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function toEngagement(p: PlanEngagement, controls: PlanControl[]): Engagement {
  const start = p.phases[0]?.start;
  const end = p.phases[p.phases.length - 1]?.end;
  const first = p.phases[0];
  return {
    id: `eng-ai-${Date.now().toString(36)}-${p.process.toLowerCase()}`,
    code: p.code,
    name: p.name,
    description: p.description,
    type: p.type,
    process: p.process,
    framework: p.framework,
    owner: p.owner,
    status: 'Planned',
    periodStart: start ? monthLabel(start) : '',
    periodEnd: end ? monthLabel(end) : '',
    startDate: start,
    endDate: end,
    controls: controls.length,
    health: 0,
    openIssues: 0,
    lastActivity: 'Just now',
    nextScheduled: first ? `${first.label} · ${dayLabel(first.start)}` : '—',
    milestones: p.phases.map(ph => ({ label: ph.label, date: ph.start })),
    aiRecommended: true,
  };
}

export function commitPlan(plan: AuditPlan): CommittedEngagement[] {
  const out: CommittedEngagement[] = [];
  const createdEngs: Engagement[] = [];
  const rows: PlanWorkflowRow[] = [];

  for (const p of plan.engagements.filter(e => e.selected)) {
    const controls = p.controls.filter(c => c.selected);
    if (controls.length === 0) continue;

    let engagementId: string;
    let engagementName: string;
    let created = false;
    if (p.target.kind === 'existing') {
      engagementId = p.target.engagementId;
      engagementName = p.target.engagementName;
    } else {
      const eng = toEngagement(p, controls);
      createdEngs.push(eng);
      engagementId = eng.id;
      engagementName = eng.name;
      created = true;
    }

    saveEngagementPlan({ engagementId, engagementName, mode: created ? 'created' : 'extended', controls });

    const newChecks: PlanWorkflowRow[] = controls
      .filter(c => c.check.kind === 'new')
      .map(c => ({
        id: `lw-ai-${c.check.id.replace(/^chk-/, '')}`,
        name: c.check.name,
        description: c.check.description,
        // The check's own process — a P2P engagement can carry an R2R check.
        tags: [c.process, 'ai plan'],
        businessProcess: PROCESS_LONG[c.process],
        controlId: c.controlId,
        status: 'draft',
        engagementId,
        engagementName,
        checkId: c.check.id,
        buildPrompt: c.check.buildPrompt,
        sampleId: c.check.sampleId,
        dataNeeds: c.check.dataNeeds,
        createdAt: new Date().toISOString(),
      }));
    rows.push(...newChecks);

    out.push({
      engagementId,
      engagementName,
      created,
      controls,
      newChecks,
      reused: controls.filter(c => c.check.kind === 'reuse').length,
      manual: controls.filter(c => c.check.kind === 'manual').length,
    });
  }

  addCreatedEngagements(createdEngs);
  addPlanWorkflows(rows);
  return out;
}
