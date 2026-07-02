import type { Persona } from './workflowTypes';
import WorkflowConfigurator from './WorkflowConfigurator';

/** Approval Flow — set up the reusable approval chains. The day-to-day work
 *  (My Work / Awaiting My Approval) lives under "Your tasks" on the Exceptions
 *  and Action Hub tabs, so users don't hop between separate places. */
export default function WorkflowModule({ role }: { role: Persona }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 pt-6 pb-8 max-w-[1600px] mx-auto min-h-full flex flex-col">
        <WorkflowConfigurator role={role} />
      </div>
    </div>
  );
}
