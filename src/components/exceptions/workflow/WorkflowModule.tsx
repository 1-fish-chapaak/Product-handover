import { useState } from 'react';
import { motion } from 'motion/react';
import { Settings2, Inbox, ClipboardList, GitBranch, UserCog } from 'lucide-react';
import type { GrcException } from '../../../data/mockData';
import type { Persona } from './workflowTypes';
import { useWorkflow } from './WorkflowContext';
import { ORG_USERS } from './workflowData';
import { UserSelect } from './UserPicker';
import WorkflowConfigurator from './WorkflowConfigurator';
import AssigneeWorkPanel from './AssigneeWorkPanel';
import ApprovalInbox from './ApprovalInbox';
import AssignmentsAdmin from './AssignmentsAdmin';

type SubView = 'configurator' | 'assignments' | 'my-work' | 'approvals';

const SUBVIEWS: { id: SubView; label: string; icon: typeof Settings2 }[] = [
  { id: 'configurator', label: 'Route Configurator', icon: Settings2 },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'my-work', label: 'My Work', icon: GitBranch },
  { id: 'approvals', label: 'Approval Inbox', icon: Inbox },
];

/** Root of the Assignment & Workflow tab — sub-navigation + the "Acting as"
 *  identity switcher used to demo the assignee / approver personas. */
export default function WorkflowModule({ role, exceptions }: { role: Persona; exceptions: GrcException[] }) {
  const { currentUserId, setCurrentUser, assignments } = useWorkflow();
  const [sub, setSub] = useState<SubView>('configurator');

  const myWorkCount = assignments.filter(a => a.assigneeId === currentUserId && (a.status === 'drafting' || a.status === 'rejected')).length;
  const approvalCount = assignments.filter(a => a.status === 'in-approval' && a.currentLevelIndex >= 0 && a.levels[a.currentLevelIndex]?.assigneeIds.includes(currentUserId) && a.assigneeId !== currentUserId).length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 pt-4 pb-8 max-w-[1600px] mx-auto min-h-full flex flex-col">
        {/* Sub-nav + acting-as identity */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-canvas-elevated border border-canvas-border rounded-[10px]">
            {SUBVIEWS.map(s => {
              const active = sub === s.id;
              const badge = s.id === 'my-work' ? myWorkCount : s.id === 'approvals' ? approvalCount : 0;
              return (
                <button
                  key={s.id}
                  onClick={() => setSub(s.id)}
                  className={`relative flex items-center gap-1.5 px-3 h-8 text-[12.5px] font-medium rounded-[8px] transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'}`}
                >
                  <s.icon size={13} />
                  {s.label}
                  {badge > 0 && <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold bg-brand-600 text-white rounded-full tabular-nums">{badge}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500"><UserCog size={13} /> Acting as</span>
            <div className="w-[230px]">
              <UserSelect users={ORG_USERS} value={currentUserId} onChange={setCurrentUser} />
            </div>
          </div>
        </div>

        <motion.div key={sub} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex-1">
          {sub === 'configurator' && <WorkflowConfigurator role={role} />}
          {sub === 'assignments' && <AssignmentsAdmin role={role} exceptions={exceptions} />}
          {sub === 'my-work' && <AssigneeWorkPanel exceptions={exceptions} />}
          {sub === 'approvals' && <ApprovalInbox exceptions={exceptions} />}
        </motion.div>
      </div>
    </div>
  );
}
