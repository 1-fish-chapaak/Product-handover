import { UserCog } from 'lucide-react';
import { useWorkflow } from './workflow/WorkflowContext';
import { ORG_USERS } from './workflow/workflowData';
import { UserSelect } from './workflow/UserPicker';

/**
 * "Acting as" identity switcher for the page header — lets a demo move between
 * team members so their personal queues (My Work / Awaiting My Approval) and the
 * approval chain update live. Shared across every tab in Manage Exceptions.
 */
export default function ActingAsSwitcher() {
  const { currentUserId, setCurrentUser } = useWorkflow();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        <UserCog size={13} /> Acting as
      </span>
      <div className="w-[200px]">
        <UserSelect users={ORG_USERS} value={currentUserId} onChange={setCurrentUser} />
      </div>
    </div>
  );
}
