import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Link2,
  Sparkles,
  Wrench,
  Clock,
  Shield,
} from 'lucide-react';
import { RISKS, WORKFLOWS } from '../../data/mockData';

/* ─── Types ─── */
export interface NewControlData {
  name: string;
  description: string;
  businessProcess: string;
  subProcess: string;
  owner: string;
  classification: 'Key' | 'Non-Key';
  nature: 'Preventive' | 'Detective' | 'Corrective';
  automation: 'Manual' | 'IT-dependent' | 'Automated';
  frequency: string;
  assertions: string[];
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
}

/* ─── Constants ─── */
const STEPS = ['Basic Details', 'Classification', 'Assertions', 'Risk Mapping', 'Workflow Setup'];

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
export default function CreateControlDrawer({ onClose, onSave, defaultProcess, defaultRiskIds }: Props) {
  const [step, setStep] = useState(0);

  // Form state — with optional prefills
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [businessProcess, setBusinessProcess] = useState(defaultProcess || '');
  const [subProcess, setSubProcess] = useState('');
  const [owner, setOwner] = useState('');
  const [classification, setClassification] = useState<'Key' | 'Non-Key'>('Non-Key');
  const [nature, setNature] = useState<'Preventive' | 'Detective' | 'Corrective'>('Preventive');
  const [automation, setAutomation] = useState<'Manual' | 'IT-dependent' | 'Automated'>('Manual');
  const [frequency, setFrequency] = useState('');
  const [assertions, setAssertions] = useState<string[]>([]);
  const [mappedRisks, setMappedRisks] = useState<string[]>(defaultRiskIds || []);
  const [riskSearch, setRiskSearch] = useState('');
  const [workflowChoice, setWorkflowChoice] = useState<'link' | 'ask-ira' | 'manual' | 'skip'>('skip');
  const [linkedWorkflowId, setLinkedWorkflowId] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState('');

  // Validation per step
  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return name.trim().length > 0 && businessProcess !== '' && owner.trim().length > 0;
      case 1: return frequency !== '';
      case 2: return true; // assertions optional
      case 3: return true; // risk mapping optional
      case 4: return workflowChoice === 'link' ? linkedWorkflowId !== null : true; // ask-ira, manual, skip always valid
      default: return true;
    }
  }, [step, name, businessProcess, owner, frequency, workflowChoice, linkedWorkflowId]);

  const isLastStep = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onSave({
        name, description, businessProcess, subProcess, owner,
        classification, nature, automation, frequency, assertions,
        mappedRisks, workflowChoice, linkedWorkflowId,
      });
    } else {
      setStep(s => s + 1);
    }
  };

  // Risk search
  const filteredRisks = useMemo(() => {
    const q = riskSearch.toLowerCase();
    return RISKS.filter(r =>
      r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [riskSearch]);

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

  const toggleRisk = (id: string) => {
    setMappedRisks(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  /* ─── Step renderers ─── */
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Control Name <span className="text-risk">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Three-Way PO Match" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the governance intent of this control..." rows={3} className={inputClass + ' resize-none'} />
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
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. Tushar Goel" className={inputClass} />
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
          <p className="text-[0.75rem] text-ink-500">Optionally map this control to existing risks from the Risk Register.</p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={riskSearch}
              onChange={e => setRiskSearch(e.target.value)}
              placeholder="Search risks..."
              className={inputClass + ' pl-8'}
            />
          </div>

          {/* Selected risks */}
          {mappedRisks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[0.75rem] font-semibold text-ink-600">{mappedRisks.length} risk{mappedRisks.length !== 1 ? 's' : ''} mapped</div>
              <div className="flex flex-wrap gap-2">
                {mappedRisks.map(rid => {
                  const risk = RISKS.find(r => r.id === rid);
                  return (
                    <span key={rid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-[0.75rem] font-medium">
                      <span className="font-mono">{rid}</span>
                      <button onClick={() => toggleRisk(rid)} className="hover:text-risk cursor-pointer"><X size={11} /></button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk list */}
          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
            {filteredRisks.map(risk => {
              const selected = mappedRisks.includes(risk.id);
              return (
                <button
                  key={risk.id}
                  onClick={() => toggleRisk(risk.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50'
                      : 'border-canvas-border bg-white hover:bg-canvas'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-brand-600 bg-brand-600' : 'border-canvas-border'
                  }`}>
                    {selected && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.6875rem] text-ink-500">{risk.id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold uppercase ${SEVERITY_STYLE[risk.severity]}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <div className="text-[0.75rem] text-ink-800 truncate mt-0.5">{risk.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-5">
          <p className="text-[0.75rem] text-ink-500">
            Choose how this control will get its workflow. A workflow defines how the control is tested during engagements.
          </p>

          {/* Choice cards */}
          <div className="space-y-2">
            {[
              { value: 'link' as const, icon: Link2, title: 'Link existing workflow', desc: 'Choose from the Workflow Library' },
              { value: 'ask-ira' as const, icon: Sparkles, title: 'Create new workflow with Ask IRA', desc: 'Use AI-guided Q&A to build a workflow for this control' },
              { value: 'manual' as const, icon: Wrench, title: 'Create workflow manually', desc: 'Open the standard Workflow Builder' },
              { value: 'skip' as const, icon: Clock, title: 'Skip for now', desc: 'Save control without workflow; can be linked later' },
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

          {/* Workflow picker — only for Link option */}
          {workflowChoice === 'link' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 overflow-hidden">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={workflowSearch}
                  onChange={e => setWorkflowSearch(e.target.value)}
                  placeholder="Search workflows..."
                  className={inputClass + ' pl-8'}
                />
              </div>
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
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
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[600px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
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
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between">
          <div className="text-[0.75rem] text-ink-400">
            Step {step + 1} of {STEPS.length}
          </div>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!stepValid}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLastStep
                ? workflowChoice === 'link' ? 'Link Workflow & Create Control'
                : workflowChoice === 'ask-ira' ? 'Continue in Ask IRA'
                : workflowChoice === 'manual' ? 'Open Workflow Builder'
                : 'Create Control'
                : 'Continue'}
              {!isLastStep && <ChevronRight size={14} />}
            </button>
          </div>
        </footer>
      </motion.aside>
    </>
  );
}
