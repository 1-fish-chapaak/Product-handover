import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Save } from 'lucide-react';
import type { WorkflowDraft } from './types';
import { BUSINESS_PROCESSES, RACMS } from '../../data/mockData';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  workflow: WorkflowDraft;
  onConfirm: (payload: {
    name: string;
    bpId: string;
    businessProcess: string;
    racmId: string;
    racm: string;
    description: string;
  }) => void;
}

export default function SaveWorkflowModal({ open, onClose, workflow, onConfirm }: Props) {
  const [name, setName] = useState(workflow.name);
  const [bpId, setBpId] = useState('');
  const [racmId, setRacmId] = useState('');
  const [description, setDescription] = useState(workflow.description);

  useEffect(() => {
    if (!open) return;
    setName(workflow.name);
    setBpId('');
    setRacmId('');
    setDescription(workflow.description);
  }, [open, workflow]);

  const racmOptions = useMemo(
    () => (bpId ? RACMS.filter((r) => r.bpId === bpId) : []),
    [bpId],
  );

  const canSave = name.trim().length > 0 && bpId.length > 0 && racmId.length > 0;

  const handleConfirm = () => {
    const bp = BUSINESS_PROCESSES.find((b) => b.id === bpId);
    const racm = RACMS.find((r) => r.id === racmId);
    if (!bp || !racm) return;
    onConfirm({
      name: name.trim(),
      bpId,
      businessProcess: bp.name,
      racmId,
      racm: racm.name,
      description: description.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={
        <span className="inline-flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Save size={16} />
          </span>
          <span>Save as workflow</span>
        </span>
      }
      description="Turn this query result into a re-runnable workflow."
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!canSave}
            onClick={handleConfirm}
            leadingIcon={<Save size={13} />}
          >
            Save &amp; switch to workflow
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Switch-mode callout */}
        <div className="flex items-start gap-2.5 rounded-lg border border-mitigated-50 bg-mitigated-50/70 px-3.5 py-3">
          <Lightbulb size={15} className="text-mitigated-700 mt-0.5 shrink-0" />
          <p className="text-[0.8125rem] text-mitigated-700 leading-relaxed">
            This chat will switch to <strong className="font-semibold">workflow mode</strong>. You
            won&apos;t be able to switch back to query mode in this chat — start a new chat for
            that.
          </p>
        </div>

        {/* Workflow name */}
        <div>
          <label className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
            Workflow name <span className="text-risk">*</span>
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Duplicate Invoice Detection — Q1 ±3 days"
          />
          <p className="text-[0.75rem] text-ink-400 mt-1">
            IRA pre-filled this from your query. Edit if needed.
          </p>
        </div>

        {/* Business process + RACM */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
              Business process <span className="text-risk">*</span>
            </label>
            <Select
              value={bpId}
              onChange={(e) => {
                setBpId(e.target.value);
                setRacmId('');
              }}
            >
              <option value="">Select…</option>
              {BUSINESS_PROCESSES.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name} ({bp.abbr})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
              RACM <span className="text-risk">*</span>
            </label>
            <Select
              value={racmId}
              onChange={(e) => setRacmId(e.target.value)}
              disabled={!bpId}
            >
              <option value="">
                {bpId
                  ? racmOptions.length > 0
                    ? 'Select RACM…'
                    : 'No RACMs for this BP'
                  : 'Pick a business process first'}
              </option>
              {racmOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this workflow do?"
          />
          <p className="text-[0.75rem] text-ink-400 mt-1">
            Optional. IRA pre-filled this from your query.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
