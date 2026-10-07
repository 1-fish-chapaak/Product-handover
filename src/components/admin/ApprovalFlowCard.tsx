import { useMemo } from 'react';
import { ArrowDown, CheckCircle2, UserCheck, Users } from 'lucide-react';
import { UserMultiSelect } from '../exceptions/workflow/UserPicker';
import type { OrgUser } from '../exceptions/workflow/workflowTypes';
import { PEOPLE } from '../../data/grc-domain';
import {
  approvalChain, APPROVAL_MODES,
  type ApprovalMode, type ApprovalSide, type EscalationMatrixDef,
} from '../../data/escalationMatrixStore';

// ─── Approval flow, inside the policy it belongs to ───
// Who signs this department's work off. It sits on the same screen as the
// chasing cadence because they are one decision: a policy says both what happens
// when the work is done, and what happens when it isn't.
//
// There are no levels to build. Pick people and the order you picked them in is
// the order they approve in — first name is L1. The approval type then says
// whether the chain is walked one at a time, needs everyone, or clears on the
// first yes. The diagram on the right redraws as you go, so the configuration
// never has to be read back to be understood.
//
// Two sides, because they are not the same conversation: the risk owner's team
// signs the work off internally, then audit reviews it. They run end to end,
// owner side first — the same hand-off the Exceptions workflow engine makes.

type SideKey = 'ownerApproval' | 'auditorApproval';

// Each side offers only its own people. A risk owner's chain is signed off
// inside the business — the people who own and fix the issue — and the audit
// chain by assurance. Mixing the two rosters made it possible to build a chain
// where audit approves itself.
const OWNER_ROLES = new Set(['Risk Owner', 'Manager']);
const AUDIT_ROLES = new Set(['Auditor', 'Reviewer', 'Specialist']);

/** One side's roster, in the shape the shared picker speaks. Keyed by name,
 *  because that is what the close-out panel assigns an observation to. */
function asOrgUsers(side: 'owner' | 'auditor'): OrgUser[] {
  const roles = side === 'owner' ? OWNER_ROLES : AUDIT_ROLES;
  return PEOPLE
    .filter(p => roles.has(p.role))
    .map(p => ({
      id: p.name,
      name: p.name,
      initials: p.initials,
      role: p.role,
      email: '',
      persona: (side === 'owner' ? 'risk-owner' : 'auditor') as OrgUser['persona'],
      active: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const EMPTY: ApprovalSide = { approvers: [], mode: 'sequential' };

/** One side: who signs off, in the order picked, and how they reach a verdict. */
function SideBlock({ sideKey, title, hint, roster, policy, onChange }: {
  sideKey: SideKey;
  title: string;
  hint: string;
  roster: OrgUser[];
  policy: EscalationMatrixDef;
  onChange: (patch: Partial<EscalationMatrixDef>) => void;
}) {
  const side = policy[sideKey] ?? EMPTY;
  const set = (patch: Partial<ApprovalSide>) =>
    onChange({ [sideKey]: { ...side, ...patch } } as Partial<EscalationMatrixDef>);

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
      <div className="mb-2.5">
        <h4 className="text-[0.78125rem] font-semibold text-ink-900">{title}</h4>
        <p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5">{hint}</p>
      </div>

      <label className="text-[0.6875rem] font-semibold text-ink-600 mb-1 block">
        Approvers — first picked is L1
      </label>
      <UserMultiSelect
        users={roster}
        selectedIds={side.approvers}
        onChange={ids => set({ approvers: ids })}
        ariaLabel={`${title} approvers`}
      />

      {side.approvers.length > 0 && (
        <>
          <label className="text-[0.6875rem] font-semibold text-ink-600 mt-3 mb-1 block">Approval type</label>
          <div role="radiogroup" aria-label={`${title} approval type`} className="flex flex-wrap gap-1.5">
            {APPROVAL_MODES.map(m => {
              const on = side.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={m.hint}
                  onClick={() => set({ mode: m.value })}
                  className={`h-7 px-2.5 rounded-full border text-[0.75rem] font-medium cursor-pointer transition-colors ${on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-600 hover:border-brand-200'}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[0.6875rem] text-ink-500 leading-snug mt-1.5">
            {APPROVAL_MODES.find(m => m.value === side.mode)?.hint}
          </p>
        </>
      )}
    </div>
  );
}

/** The chain as a diagram, so the configuration explains itself. */
function FlowPreview({ policy }: { policy: EscalationMatrixDef }) {
  const steps = approvalChain(policy);
  const modeWord = (m: ApprovalMode) => (m === 'any' ? 'any one' : m === 'all' ? 'all must approve' : 'in order');

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
      <h4 className="text-[0.78125rem] font-semibold text-ink-900 mb-0.5">How this runs</h4>
      <p className="text-[0.6875rem] text-ink-500 leading-snug mb-3">
        Every action plan and action taken on an observation using this matrix.
      </p>

      {steps.length === 0 ? (
        <p className="text-[0.71875rem] text-ink-500">
          No approvers yet — the work takes a single auditor sign-off, exactly as close-out behaved before.
        </p>
      ) : (
        <ol className="space-y-0">
          {steps.map((s, i) => {
            const newSide = i === 0 || steps[i - 1].side !== s.side;
            return (
              <li key={`${s.side}-${i}`}>
                {newSide && (
                  <p className={`text-[0.625rem] font-semibold uppercase tracking-[0.1em] ${i === 0 ? '' : 'mt-3'} mb-1.5 ${s.side === 'owner' ? 'text-mitigated-700' : 'text-brand-700'}`}>
                    {s.sideLabel} side · {modeWord(s.mode)}
                  </p>
                )}
                {!newSide && (
                  <div className="flex justify-center py-1" aria-hidden="true">
                    <ArrowDown size={12} className="text-ink-300" />
                  </div>
                )}
                <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${s.side === 'owner' ? 'border-mitigated-200 bg-mitigated-50/40' : 'border-brand-200 bg-brand-50/40'}`}>
                  <span className={`shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[0.625rem] font-bold text-white ${s.side === 'owner' ? 'bg-mitigated-600' : 'bg-brand-600'}`}>
                    {s.name}
                  </span>
                  <span className="min-w-0 text-[0.71875rem] text-ink-800 leading-snug">
                    {s.approvers.join(s.mode === 'any' ? ' or ' : ', ')}
                  </span>
                  {s.approvers.length > 1 && <Users size={12} className="ml-auto shrink-0 text-ink-400" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
          <li>
            <div className="flex justify-center py-1" aria-hidden="true"><ArrowDown size={12} className="text-ink-300" /></div>
            <div className="flex items-center gap-2 rounded-md border border-compliant-200 bg-compliant-50/50 px-2.5 py-2">
              <CheckCircle2 size={14} className="shrink-0 text-compliant-700" aria-hidden="true" />
              <span className="text-[0.71875rem] font-semibold text-compliant-800">Approved</span>
            </div>
          </li>
        </ol>
      )}
    </div>
  );
}

export default function ApprovalFlowCard({ policy, onChange }: {
  policy: EscalationMatrixDef;
  onChange: (patch: Partial<EscalationMatrixDef>) => void;
}) {
  const ownerRoster = useMemo(() => asOrgUsers('owner'), []);
  const approverRoster = useMemo(() => asOrgUsers('auditor'), []);

  return (
    <section className="rounded-lg border border-canvas-border bg-canvas p-4">
      <div className="flex items-start gap-2.5 mb-4">
        <span className="shrink-0 w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
          <UserCheck size={14} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[0.8125rem] font-semibold text-ink-900">Approval flow</h3>
          <p className="text-[0.71875rem] text-ink-500 leading-snug mt-0.5">
            Who signs this work off, and in what order. Pick people in the order they approve —
            the first is L1 — and the diagram shows what you have built.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <SideBlock
            sideKey="ownerApproval"
            title="Risk Owner approvals"
            hint="Signed off inside the risk owner’s own team, before the work reaches audit."
            roster={ownerRoster}
            policy={policy}
            onChange={onChange}
          />
          <SideBlock
            sideKey="auditorApproval"
            title="Auditor approvals"
            hint="The audit side’s review, once the owner’s side is done."
            roster={approverRoster}
            policy={policy}
            onChange={onChange}
          />
        </div>
        <FlowPreview policy={policy} />
      </div>
    </section>
  );
}
