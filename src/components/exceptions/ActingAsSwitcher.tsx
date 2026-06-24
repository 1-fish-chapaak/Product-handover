import { useEffect } from 'react';
import { UserCog } from 'lucide-react';
import { useWorkflow } from './workflow/WorkflowContext';
import { ORG_USERS } from './workflow/workflowData';
import { UserSelect } from './workflow/UserPicker';

/**
 * "Acting as" identity switcher for the page header — lets a demo move between
 * team members so their personal queues and the approval chain update live.
 * Scoped to the current screen's persona: the Risk Owner screen shows the 4
 * risk-owner profiles, the Auditor screen shows the 4 auditor profiles.
 */
export default function ActingAsSwitcher() {
  const { currentUserId, setCurrentUser, role } = useWorkflow();
  const users = ORG_USERS.filter(u => u.persona === role);

  // When the screen's persona changes, snap the acting identity to a matching
  // profile (defaults to that side's lead) so the switcher never shows a person
  // from the other side.
  useEffect(() => {
    if (!users.some(u => u.id === currentUserId) && users[0]) setCurrentUser(users[0].id);
  }, [role, currentUserId, users, setCurrentUser]);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        <UserCog size={13} /> Acting as
      </span>
      <div className="w-[200px]">
        <UserSelect users={users} value={currentUserId} onChange={setCurrentUser} />
      </div>
    </div>
  );
}
