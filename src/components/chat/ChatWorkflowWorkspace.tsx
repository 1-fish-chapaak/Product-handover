import { useMemo, useState } from 'react';
import DataSourcePanel from '../concierge-workflow-builder/DataSourcePanel';
import { generateWorkflow } from '../concierge-workflow-builder/mockApi';
import type { JourneyFiles } from '../concierge-workflow-builder/types';
import type { WorkflowTypeId } from '../../data/mockData';
import type { ComposerContext } from './composerContext';

interface Props {
  onClose: () => void;
  workflowType?: WorkflowTypeId;
  /** Hands a canvas CTA off to the chat composer as a focused context mode. */
  onCanvasAction?: (ctx: ComposerContext) => void;
}

const TYPE_PROMPT: Record<WorkflowTypeId, string> = {
  reconciliation: 'Three-way reconciliation across invoices, POs, and contracts',
  detection: 'Duplicate invoice detection',
  monitoring: 'Vendor master change monitoring',
  compliance: 'Segregation of duties compliance check',
};

export default function ChatWorkflowWorkspace({ onClose, workflowType, onCanvasAction }: Props) {
  const workflow = useMemo(
    () => generateWorkflow(workflowType ? TYPE_PROMPT[workflowType] : 'detection'),
    [workflowType],
  );
  const [files, setFiles] = useState<JourneyFiles>({});

  return (
    <div className="relative h-full bg-canvas-elevated border-l border-canvas-border">
      <DataSourcePanel
        workflow={workflow}
        files={files}
        setFiles={setFiles}
        step={3}
        onCanvasAction={onCanvasAction}
      />
    </div>
  );
}
