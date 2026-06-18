import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Link2,
  Wrench,
  Clock,
  Shield,
  Plus,
} from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';
import { OWNER_NAMES } from '../../data/grc-domain';

/* ─── Types ─── */
export interface NewControlData {
  risk: string;
  name: string;
  description: string;
  objective: string;
  businessProcess: string;
  subProcess: string;
  owner: string;
  classification: 'Key' | 'Non-Key';
  nature: 'Preventive' | 'Detective' | 'Corrective';
  automation: 'Manual' | 'IT-dependent' | 'Automated';
  frequency: string;
  assertions: string[];
  attributes: { name: string; description: string }[];
  mappedRisks: string[];
  workflowChoice: 'link' | 'ask-ira' | 'manual' | 'skip';
  linkedWorkflowId: string | null;
}

interface Props {
  onClose: () => void;
  onSave: (data: NewControlData) => void;
  /** Optional prefill for business process (e.g., from RACM context) */
  defaultProcess?: string;
  /** Optional prefill for risk mapping (e.g., from RACM row) */
  defaultRiskIds?: string[];
  /** Optional prefill for the Risk field in Basic Details (the risk this control addresses) */
  defaultRisk?: string;
  /** 'drawer' (default) = right sidesheet; 'modal' = centered modal (used in the RACM Link Control flow). */
  presentation?: 'drawer' | 'modal';
}

/* ─── Constants ─── */
const STEPS = ['Basic Details', 'Classification', 'Assertions', 'Attributes', 'Workflow Setup'];

const BUSINESS_PROCESSES = [
  { value: 'P2P', label: 'Procure to Pay (P2P)' },
  { value: 'O2C', label: 'Order to Cash (O2C)' },
  { value: 'R2R', label: 'Record to Report (R2R)' },
  { value: 'ITGC', label: 'IT General Controls (ITGC)' },
  { value: 'S2C', label: 'Source to Contract (S2C)' },
];

const SUB_PROCESSES: Record<string, string[]> = {
  P2P: ['Vendor Management', 'Purchase Orders', 'Invoice Processing', 'Payment Execution', 'Goods Receipt'],
  O2C: ['Order Entry', 'Credit Management', 'Billing & Invoicing', 'Revenue Recognition', 'Collections'],
  R2R: ['Journal Entries', 'GL Reconciliation', 'Financial Close', 'Intercompany', 'Fixed Assets'],
  ITGC: ['Access Management', 'Change Management', 'Operations', 'Data Backup', 'Incident Response'],
  S2C: ['Supplier Selection', 'Contract Negotiation', 'Contract Compliance', 'Supplier Performance', 'Contract Renewal'],
};

const ASSERTIONS = [
  { id: 'completeness', label: 'Completeness', desc: 'All transactions are recorded' },
  { id: 'accuracy', label: 'Accuracy', desc: 'Amounts and data are recorded correctly' },
  { id: 'authorization', label: 'Authorization', desc: 'Transactions are properly authorized' },
  { id: 'occurrence', label: 'Occurrence', desc: 'Recorded transactions actually occurred' },
  { id: 'cutoff', label: 'Cut-off', desc: 'Transactions recorded in correct period' },
  { id: 'valuation', label: 'Valuation', desc: 'Assets/liabilities valued appropriately' },
  { id: 'existence', label: 'Existence', desc: 'Assets and liabilities exist at date' },
];

const FREQUENCIES = ['Per transaction', 'Daily', 'Monthly', 'Quarterly', 'Annually', 'As needed'];

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-risk-50 text-risk-700',
  high:     'bg-high-50 text-high-700',
  medium:   'bg-mitigated-50 text-mitigated-700',
  low:      'bg-compliant-50 text-compliant-700',
};

/* ─── Shared field styles ─── */
const inputClass = 'w-full px-3 py-2 rounded-lg border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectClass = inputClass + ' cursor-pointer';
const labelClass = 'block text-[0.75rem] font-semibold text-ink-700 mb-1.5';

/* ─── Component ─── */
export default function CreateControlDrawer({ onClose, onSave, defaultProcess, defaultRiskIds, defaultRisk, presentation = 'drawer' }: Props) {
  const isModal = presentation === 'modal';
  const [step, setStep] = useState(0);

  // Form state — with optional prefills
  const [risk, setRisk] = useState(defaultRisk || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [businessProcess, setBusinessProcess] = useState(defaultProcess || '');
  const [subProcess, setSubProcess] = useState('');
  const [owner, setOwner] = useState('');
  const [classification, setClassification] = useState<'Key' | 'Non-Key'>('Non-Key');
  const [nature, setNature] = useState<'Preventive' | 'Detective' | 'Corrective'>('Preventive');
  const [automation, setAutomation] = useState<'Manual' | 'IT-dependent' | 'Automated'>('Manual');
  const [frequency, setFrequency] = useState('');
  const [assertions, setAssertions] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<{ name: string; description: string }[]>([]);
  const [attrName, setAttrName] = useState('');
  const [attrDesc, setAttrDesc] = useState('');
  // Prefilled from RACM context (defaultRiskIds); the visible Risk Mapping step was removed.
  const [mappedRisks] = useState<string[]>(defaultRiskIds || []);
  const [workflowChoice, setWorkflowChoice] = useState<'link' | 'ask-ira' | 'manual' | 'skip'>('skip');
  const [linkedWorkflowId, setLinkedWorkflowId] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState('');

  // Validation per step
  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return name.trim().length > 0 && businessProcess !== '' && owner.trim().length > 0;
      case 1: return frequency !== '';
      case 2: return true; // assertions optional
      case 3: return true; // attributes optional
      // Workflow setup — must pick an option (Link/Ask IRA/Manual) to use the primary
      // button; the footer "Skip" button handles the no-workflow path separately.
      case 4: return workflowChoice === 'skip' ? false : workflowChoice === 'link' ? linkedWorkflowId !== null : true;
      default: return true;
    }
  }, [step, name, businessProcess, owner, frequency, workflowChoice, linkedWorkflowId]);

  const isLastStep = step === STEPS.length - 1;

  const save = (choice: NewControlData['workflowChoice'], wfId: string | null) => {
    onSave({
      risk, name, description, objective, businessProcess, subProcess, owner,
      classification, nature, automation, frequency, assertions, attributes,
      mappedRisks, workflowChoice: choice, linkedWorkflowId: wfId,
    });
  };

  const handleNext = () => {
    if (isLastStep) save(workflowChoice, linkedWorkflowId);
    else setStep(s => s + 1);
  };

  // Footer "Skip" — finish without a workflow (it can be linked later from the Control Library).
  const handleSkip = () => save('skip', null);

  // Workflow search
  const filteredWorkflows = useMemo(() => {
    const q = workflowSearch.toLowerCase();
    return WORKFLOWS.filter(w =>
      w.name.toLowerCase().includes(q) || w.desc.toLowerCase().includes(q)
    );
  }, [workflowSearch]);

  const toggleAssertion = (id: string) => {
    setAssertions(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const addAttribute = () => {
    if (!attrName.trim()) return;
    setAttributes(prev => [...prev, { name: attrName.trim(), description: attrDesc.trim() }]);
    setAttrName('');
    setAttrDesc('');
  };
  const removeAttribute = (i: number) => setAttributes(prev => prev.filter((_, idx) => idx !== i));

  /* ─── Step renderers ─── */
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Risk</label>
            <input value={risk} onChange={e => setRisk(e.target.value)} placeholder="Risk this control addresses" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Control Name <span className="text-risk">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Three-Way PO Match" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the governance intent of this control..." rows={3} className={inputClass + ' resize-none'} />
          </div>
          <div>
            <label className={labelClass}>Objective</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="What should this control achieve or prevent?" rows={2} className={inputClass + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Business Process <span className="text-risk">*</span></label>
              <select value={businessProcess} onChange={e => { setBusinessProcess(e.target.value); setSubProcess(''); }} className={selectClass}>
                <option value="">Select process</option>
                {BUSINESS_PROCESSES.map(bp => <option key={bp.value} value={bp.value}>{bp.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sub-process</label>
              <select value={subProcess} onChange={e => setSubProcess(e.target.value)} className={selectClass} disabled={!businessProcess}>
                <option value="">Select sub-process</option>
                {(SUB_PROCESSES[businessProcess] || []).map(sp => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Control Owner <span className="text-risk">*</span></label>
            <select value={owner} onChange={e => setOwner(e.target.value)} className={selectClass}>
              <option value="">Select owner</option>
              {OWNER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      );

      case 1: return (
        <div className="space-y-5">
          {/* Classification */}
          <div>
            <label className={labelClass}>Importance</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Key', 'Non-Key'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setClassification(v)}
                  className={`px-4 py-3 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                    classification === v
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {v === 'Key' && <span className="text-mitigated mr-1.5">&#9733;</span>}
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Nature */}
          <div>
            <label className={labelClass}>Nature</label>
            <div className="grid grid-cols-3 gap-3">
              {(['Preventive', 'Detective', 'Corrective'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setNature(v)}
                  className={`px-4 py-3 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                    nature === v
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Automation */}
          <div>
            <label className={labelClass}>Automation Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(['Manual', 'IT-dependent', 'Automated'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setAutomation(v)}
                  className={`px-4 py-3 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                    automation === v
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className={labelClass}>Frequency <span className="text-risk">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`px-3 py-2 rounded-lg border text-[0.75rem] font-medium transition-all cursor-pointer ${
                    frequency === f
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'
                  }`}
                >
                  <Clock size={11} className="inline mr-1.5 -mt-0.5" />
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <p className="text-[0.75rem] text-ink-500">Select the financial statement assertions this control addresses.</p>
          <div className="space-y-2">
            {ASSERTIONS.map(a => {
              const selected = assertions.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAssertion(a.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                      : 'border-canvas-border bg-white hover:bg-canvas'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-brand-600 bg-brand-600' : 'border-canvas-border'
                  }`}>
                    {selected && <Check size={12} className="text-white" />}
                  </div>
                  <div>
                    <div className="text-[0.8125rem] font-medium text-ink-800">{a.label}</div>
                    <div className="text-[0.75rem] text-ink-500">{a.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {assertions.length > 0 && (
            <div className="text-[0.75rem] text-ink-500">{assertions.length} assertion{assertions.length !== 1 ? 's' : ''} selected</div>
          )}
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <p className="text-[0.75rem] text-ink-500">Define the test attributes for this control — the specific checks performed when it's tested.</p>
          {/* Add attribute */}
          <div className="rounded-lg border border-canvas-border bg-canvas/40 p-3 space-y-2.5">
            <input value={attrName} onChange={e => setAttrName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttribute(); } }} placeholder="Attribute name (e.g. PO number matches invoice)" className={inputClass} />
            <input value={attrDesc} onChange={e => setAttrDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttribute(); } }} placeholder="Expected result (optional)" className={inputClass} />
            <button type="button" onClick={addAttribute} disabled={!attrName.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus size={13} />Add attribute
            </button>
          </div>
          {/* Added attributes */}
          {attributes.length === 0 ? (
            <p className="text-[0.75rem] text-ink-400 italic">No attributes added yet. Attributes are optional but recommended.</p>
          ) : (
            <div className="space-y-2">
              {attributes.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-white">
                  <div className="w-5 h-5 rounded-md bg-brand-50 text-brand-700 text-[0.625rem] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8125rem] font-medium text-ink-800">{a.name}</div>
                    {a.description && <div className="text-[0.75rem] text-ink-500 mt-0.5">{a.description}</div>}
                  </div>
                  <button type="button" onClick={() => removeAttribute(i)} aria-label="Remove attribute" className="text-ink-400 hover:text-risk cursor-pointer shrink-0"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          {attributes.length > 0 && <div className="text-[0.75rem] text-ink-500">{attributes.length} attribute{attributes.length !== 1 ? 's' : ''} defined</div>}
        </div>
      );

      // Risk Mapping step removed per design — the risk is now captured in Basic Details (the "Risk" field).

      case 4: return (
        <div className="flex flex-col gap-5 h-full">
          <div className="flex items-start justify-between gap-4 shrink-0">
            {workflowChoice === 'link' ? (
              <h3 className="font-display text-[15px] font-semibold text-ink-900">Link existing workflow</h3>
            ) : (
              <p className="text-[0.75rem] text-ink-500">
                Choose how this control will get its workflow. A workflow defines how the control is tested during engagements.
              </p>
            )}
            <button
              onClick={handleSkip}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-600 hover:bg-white hover:border-ink-300 transition-colors cursor-pointer"
            >
              Skip
            </button>
          </div>

          {/* Choice cards — hidden once Link is selected; the heading + list take over */}
          {workflowChoice !== 'link' && (
            <div className="space-y-2 shrink-0">
              {[
                { value: 'link' as const, icon: Link2, title: 'Link existing workflow', desc: 'Choose from the Workflow Library' },
                { value: 'manual' as const, icon: Wrench, title: 'Create workflow', desc: 'Open the standard Workflow Builder' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setWorkflowChoice(opt.value); if (opt.value !== 'link') setLinkedWorkflowId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                    workflowChoice === opt.value
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white hover:bg-canvas'
                  }`}
                >
                  <opt.icon size={16} className={workflowChoice === opt.value ? 'text-brand-600' : 'text-ink-400'} />
                  <div>
                    <div className="text-[0.8125rem] font-medium text-ink-800">{opt.title}</div>
                    <div className="text-[0.75rem] text-ink-500">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Workflow picker — only for Link option; fills the remaining container height */}
          {workflowChoice === 'link' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="relative shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={workflowSearch}
                  onChange={e => setWorkflowSearch(e.target.value)}
                  placeholder="Search workflows..."
                  className={inputClass + ' pl-8'}
                />
              </div>
              <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
                {filteredWorkflows.map(wf => {
                  const selected = linkedWorkflowId === wf.id;
                  return (
                    <button
                      key={wf.id}
                      onClick={() => setLinkedWorkflowId(selected ? null : wf.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20'
                          : 'border-canvas-border bg-white hover:bg-canvas'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-brand-600 bg-brand-600' : 'border-canvas-border'
                      }`}>
                        {selected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8125rem] font-medium text-ink-800">{wf.name}</div>
                        <div className="text-[0.75rem] text-ink-500 truncate">{wf.desc}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold bg-evidence-50 text-evidence-700 shrink-0 uppercase">{wf.type}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      );

      default: return null;
    }
  };

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.aside
        initial={isModal ? { opacity: 0 } : { x: 24, opacity: 0 }}
        animate={isModal ? { opacity: 1 } : { x: 0, opacity: 1 }}
        exit={isModal ? { opacity: 0 } : { x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className={isModal
          ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[600px] max-h-[calc(100vh-2rem)] bg-canvas-elevated rounded-2xl shadow-xl flex flex-col overflow-hidden"
          : "fixed top-0 right-0 bottom-0 w-full max-w-[600px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"}
        role="dialog"
        aria-label="Create Control"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-0 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-brand-600" />
                <h2 className="font-display text-[1.25rem] font-semibold text-ink-900 tracking-tight">Create Control</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Define a new reusable governance control.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 -mb-px overflow-x-auto">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={s}
                  onClick={() => { if (i < step) setStep(i); }}
                  className={`pb-3 px-2 text-[0.75rem] font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                    active
                      ? 'border-brand-600 text-brand-700'
                      : done
                        ? 'border-transparent text-brand-500 hover:text-brand-700'
                        : 'border-transparent text-ink-400'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.625rem] font-bold mr-1.5 ${
                    done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-400'
                  }`}>
                    {done ? <Check size={10} /> : i + 1}
                  </span>
                  {s}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="h-full"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => {
                  // On the workflow step, if the Link list is showing, Back first returns to
                  // the two options; another Back then goes to the previous step.
                  if (isLastStep && workflowChoice === 'link') {
                    setWorkflowChoice('skip');
                    setLinkedWorkflowId(null);
                  } else {
                    setStep(s => s - 1);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {/* On the workflow step the primary appears once an option is chosen; until
                then the user proceeds via the Skip button (next to the step description) or Back. */}
            {(!isLastStep || workflowChoice !== 'skip') && (
              <button
                onClick={handleNext}
                disabled={!stepValid}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLastStep
                  ? workflowChoice === 'link' ? 'Link Workflow & Create Control'
                  : workflowChoice === 'manual' ? 'Open Workflow Builder'
                  : 'Create Control'
                  : 'Continue'}
                {!isLastStep && <ChevronRight size={14} />}
              </button>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}
