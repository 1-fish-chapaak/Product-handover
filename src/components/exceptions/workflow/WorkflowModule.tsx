import { useState } from 'react';
import { motion } from 'motion/react';
import { Settings2, ClipboardList } from 'lucide-react';
import type { GrcException } from '../../../data/mockData';
import type { Persona } from './workflowTypes';
import WorkflowConfigurator from './WorkflowConfigurator';
import AssignmentsAdmin from './AssignmentsAdmin';

type SubView = 'configurator' | 'assignments';

const SUBVIEWS: { id: SubView; label: string; icon: typeof Settings2 }[] = [
  { id: 'configurator', label: 'Approval Routes', icon: Settings2 },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
];

/** Approval & Configuration — set up approval routes and assign exceptions.
 *  The day-to-day work (My Work / Awaiting My Approval) now lives under
 *  "Your tasks" on the Exceptions and Action Hub tabs, so users don't hop
 *  between separate places to do their job. */
export default function WorkflowModule({ role, exceptions }: { role: Persona; exceptions: GrcException[] }) {
  const [sub, setSub] = useState<SubView>('configurator');

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 pt-4 pb-8 max-w-[1600px] mx-auto min-h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-canvas-elevated border border-canvas-border rounded-[10px]">
            {SUBVIEWS.map(s => {
              const active = sub === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSub(s.id)}
                  className={`flex items-center gap-1.5 px-3 h-8 text-[12.5px] font-medium rounded-[8px] transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'}`}
                >
                  <s.icon size={13} />
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-ink-500 max-w-[440px]">
            Team members pick up their work and approvals under <span className="font-medium text-ink-700">Your tasks</span> on the Exceptions and Action Hub tabs.
          </p>
        </div>

        <motion.div key={sub} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex-1">
          {sub === 'configurator' && <WorkflowConfigurator role={role} />}
          {sub === 'assignments' && <AssignmentsAdmin role={role} exceptions={exceptions} />}
        </motion.div>
      </div>
    </div>
  );
}
