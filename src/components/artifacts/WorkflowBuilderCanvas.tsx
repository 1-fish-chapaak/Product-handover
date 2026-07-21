import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CheckCircle, Database, ArrowRight,
  Sparkles, Lock, Upload, ToggleLeft, ToggleRight,
  FileText, Hash, GripVertical, Eye, EyeOff,
  Play, Save, ChevronLeft, Plus,
} from 'lucide-react';
import {
  WORKFLOW_TYPE_CONFIGS,
  type WorkflowTypeId,
  type WorkflowInputSource,
  type WorkflowOutputColumn,
} from '../../data/mockData';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';

interface Props {
  onClose: () => void;
  workflowType?: WorkflowTypeId;
  buildStage?: number; // 0=waiting, 1=input, 2=output, 3=preview
}

const STAGE_LABELS = [
  { label: 'Input Config', icon: Database },
  { label: 'Output Config', icon: ArrowRight },
  { label: 'Preview', icon: Eye },
];

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  text: { label: 'TXT', color: 'bg-evidence-50 text-evidence-700' },
  number: { label: 'NUM', color: 'bg-brand-50 text-brand-700' },
  badge: { label: 'BADGE', color: 'bg-brand-50 text-brand-700' },
  percent: { label: '%', color: 'bg-mitigated-50 text-mitigated-700' },
};

const FORMAT_COLORS: Record<string, string> = {
  // File formats are decorative — neutral draft tones, not GRC severity.
  CSV: 'bg-paper-50 text-ink-700',
  'PDF/CSV': 'bg-paper-50 text-ink-700',
  SQL: 'bg-paper-50 text-ink-700',
};

const TYPE_COLOR_CLASSES: Record<WorkflowTypeId, {
  accent: string; accentBg: string; accentBorder: string; accentRing: string;
  gradient: string; badgeBg: string; badgeText: string;
}> = {
  reconciliation: {
    accent: 'text-brand-700', accentBg: 'bg-brand-50', accentBorder: 'border-brand-200',
    accentRing: 'ring-purple-300', gradient: 'from-purple-400 to-violet-500',
    badgeBg: 'bg-brand-50', badgeText: 'text-brand-700',
  },
  detection: {
    accent: 'text-brand-700', accentBg: 'bg-brand-50', accentBorder: 'border-brand-200',
    accentRing: 'ring-purple-300', gradient: 'from-purple-500 to-violet-500',
    badgeBg: 'bg-brand-50', badgeText: 'text-brand-700',
  },
  monitoring: {
    accent: 'text-evidence-700', accentBg: 'bg-evidence-50', accentBorder: 'border-evidence',
    accentRing: 'ring-sky-300', gradient: 'from-sky-400 to-blue-500',
    badgeBg: 'bg-evidence-50', badgeText: 'text-evidence-700',
  },
  compliance: {
    accent: 'text-brand-700', accentBg: 'bg-brand-50', accentBorder: 'border-brand-200',
    accentRing: 'ring-violet-300', gradient: 'from-violet-500 to-purple-500',
    badgeBg: 'bg-brand-50', badgeText: 'text-brand-700',
  },
};

const RUN_LABELS: Record<WorkflowTypeId, string> = {
  reconciliation: 'Run Reconciliation',
  detection: 'Run Detection',
  monitoring: 'Run Now',
  compliance: 'Run Now',
};

function AISuggestionRow({ suggestion, colors: _colors, onApply }: { suggestion: { text: string; applied: boolean }; colors: any; onApply: () => void }) {
  const [applied, setApplied] = useState(suggestion.applied);
  return (
    <div className={`flex items-start gap-2.5 p-2 rounded-lg transition-all ${applied ? 'bg-primary/5 border border-primary/15' : 'hover:bg-white/60'}`}>
      <button
        onClick={() => { if (!applied) { setApplied(true); onApply(); } }}
        className={`shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
          applied ? 'bg-primary text-white' : `border-2 border-border hover:border-primary/40`
        }`}
      >
        {applied && <CheckCircle size={12} />}
      </button>
      <span className={`text-[0.75rem] leading-relaxed ${applied ? 'text-primary' : 'text-text-secondary'}`}>{suggestion.text}</span>
    </div>
  );
}

export default function WorkflowBuilderCanvas({ onClose, workflowType, buildStage }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const config = workflowType ? WORKFLOW_TYPE_CONFIGS[workflowType] : null;
  const colors = workflowType ? TYPE_COLOR_CLASSES[workflowType] : null;

  // Internal stage management — external buildStage takes priority when provided
  const [internalStage, setInternalStage] = useState(0);
  const stage = buildStage !== undefined ? buildStage : internalStage;

  // Sync internal stage when external buildStage changes
  useEffect(() => {
    if (buildStage !== undefined) {
      setInternalStage(buildStage);
    }
  }, [buildStage]);

  // State
  const [sources, setSources] = useState<WorkflowInputSource[]>([]);
  const [tolerance, setTolerance] = useState('5');
  const [matchLogic, setMatchLogic] = useState('');
  const [outputColumns, setOutputColumns] = useState<WorkflowOutputColumn[]>([]);
  const [selectedLayout, setSelectedLayout] = useState('');
  const [kpiToggles, setKpiToggles] = useState<Record<string, boolean>>({});
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  // Multi-sheet output configuration
  const [outputSheets, setOutputSheets] = useState<{ id: string; name: string }[]>([
    { id: 'sheet-1', name: 'Results' },
  ]);
  const [activeSheetId, setActiveSheetId] = useState('sheet-1');
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);

  // Init state from config when workflowType changes
  useEffect(() => {
    if (!config) return;
    setSources(config.inputSources.map(s => ({ ...s })));
    const tolNum = config.matchSettings.toleranceDefault.replace('%', '').replace('N/A', '0');
    setTolerance(tolNum || '0');
    setMatchLogic(config.matchSettings.defaultLogic);
    setOutputColumns(config.outputColumns.map(c => ({ ...c })));
    setSelectedLayout(config.layoutOptions[0] || 'Table');
    const kpis: Record<string, boolean> = {};
    config.kpiOptions.forEach(k => { kpis[k.id] = k.enabled; });
    setKpiToggles(kpis);
    // Set default sheets based on workflow type
    const defaultSheets: { id: string; name: string }[] =
      config.id === 'reconciliation'
        ? [{ id: 'sheet-1', name: 'Matched' }, { id: 'sheet-2', name: 'Variances' }, { id: 'sheet-3', name: 'Unmatched' }]
        : config.id === 'detection'
        ? [{ id: 'sheet-1', name: 'Flagged Items' }, { id: 'sheet-2', name: 'Summary' }]
        : [{ id: 'sheet-1', name: 'Results' }];
    setOutputSheets(defaultSheets);
    setActiveSheetId(defaultSheets[0].id);
    setEditingSheetId(null);
    // When config arrives and we're at stage 0, advance to stage 1
    if (buildStage === undefined) {
      setInternalStage(1);
    }
  }, [workflowType]);

  const fillPercent = stage * 33.33;

  const toggleFreeze = (id: string) => {
    setSources(prev => prev.map(s => {
      if (s.id !== id) return s;
      const nowFrozen = !s.frozen;
      return {
        ...s,
        frozen: nowFrozen,
        frozenDate: nowFrozen ? 'Mar 26, 2026' : null,
        records: nowFrozen ? (s.records || 'Cached') : null,
      };
    }));
  };

  const toggleColumn = (id: string) => {
    setOutputColumns(prev => prev.map(c =>
      c.id === id && !c.frozen ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const toggleKpi = (id: string) => {
    setKpiToggles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const advanceStage = (next: number) => {
    setInternalStage(next);
  };

  const handleSaveWorkflow = () => {
    setShowSavedBanner(true);
    logEvent({ action: 'Create', description: `Created workflow "${config?.name ?? 'Untitled workflow'}"`, module: 'Workflows', entity: 'Workflow' });
    addToast({ message: 'Workflow saved', type: 'success' });
    setTimeout(() => setShowSavedBanner(false), 2500);
  };

  const enabledColumns = outputColumns.filter(c => c.enabled);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: stage >= 3 ? 700 : 680, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-full bg-surface-2 border-l border-border-light flex flex-col overflow-hidden shrink-0 relative"
    >
      {/* Workspace identifier */}
      <div className="h-7 border-b border-border-light bg-canvas flex items-center px-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className={colors?.accent || 'text-primary'} />
          <span className="text-[0.75rem] font-semibold tracking-[0.08em] uppercase text-text-muted">Workspace</span>
          <span className="text-[0.75rem] text-text-muted/70">· Workflow mode</span>
        </div>
      </div>

      {/* Save Banner */}
      <AnimatePresence>
        {showSavedBanner && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-r ${colors?.gradient || 'from-teal-500 to-emerald-500'} text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg`}
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.1 }}>
              <CheckCircle size={18} />
            </motion.div>
            <span className="text-[0.8125rem] font-semibold">Workflow Saved Successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar with Progress */}
      <div className="border-b border-border-light bg-white shrink-0">
        <div className="flex items-center justify-between px-3 h-11">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className={colors?.accent || 'text-primary'} />
            <span className="text-[0.75rem] font-semibold text-text">
              {config ? config.name : 'Workflow Canvas'}
            </span>
            {config && (
              <span className={`text-[0.75rem] font-bold px-2 py-0.5 rounded-full ${colors?.badgeBg} ${colors?.badgeText}`}>
                {config.id.charAt(0).toUpperCase() + config.id.slice(1)}
              </span>
            )}
            {stage > 0 && stage < 3 && (
              <span className={`text-[0.75rem] font-bold ${colors?.accent || 'text-primary'} ${colors?.accentBg || 'bg-primary/10'} px-2 py-0.5 rounded-full animate-pulse`}>
                Configuring...
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md hover:bg-paper-50 cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Stage Progress */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            {STAGE_LABELS.map((s, i) => {
              const filled = stage > i + 1;
              const active = stage === i + 1;
              return (
                <div key={s.label} className="flex items-center gap-1.5 flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.75rem] font-bold transition-all duration-300 ${
                    filled
                      ? `bg-gradient-to-r ${colors?.gradient || 'from-teal-400 to-emerald-500'} text-white`
                      : active
                        ? `${colors?.accentBg || 'bg-evidence-50'} ${colors?.accent || 'text-evidence-700'} ring-2 ${colors?.accentRing || 'ring-teal-300'}`
                        : 'bg-paper-50 text-ink-500'
                  }`}>
                    {filled ? <CheckCircle size={12} /> : i + 1}
                  </div>
                  <span className={`text-[0.75rem] font-medium truncate transition-colors ${
                    active ? `${colors?.accent || 'text-evidence-700'} font-bold` : filled ? 'text-text' : 'text-text-muted'
                  }`}>
                    {s.label}
                  </span>
                  {i < STAGE_LABELS.length - 1 && (
                    <div className={`flex-1 h-px transition-colors ${
                      filled ? `bg-gradient-to-r ${colors?.gradient || 'from-teal-400 to-emerald-500'}` : 'bg-border-light'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${colors?.gradient || 'from-teal-400 to-emerald-500'} rounded-full`}
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(fillPercent, 100)}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">

          {/* Stage 0: Waiting */}
          {stage === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
              <div className={`w-14 h-14 rounded-2xl ${colors?.accentBg || 'bg-primary/5'} flex items-center justify-center mb-3`}>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles size={24} className={`${colors?.accent || 'text-primary'} opacity-60`} />
                </motion.div>
              </div>
              <h4 className="text-[0.875rem] font-semibold text-text mb-1">Select a workflow type to begin configuration...</h4>
              <p className="text-[0.75rem] text-text-muted max-w-[280px]">Choose a workflow type in chat and the canvas will guide you through input, output, and preview steps.</p>
              <motion.div
                className="mt-4 flex gap-1"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted/30" />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Stage 1: Input Configuration */}
          <AnimatePresence mode="wait">
            {stage === 1 && config && colors && (
              <motion.div
                key="stage-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Database size={14} className={colors.accent} />
                  <h2 className="text-[0.8125rem] font-semibold text-text">Input Configuration</h2>
                  <span className={`text-[0.75rem] font-bold ${colors.badgeText} ${colors.badgeBg} px-2 py-0.5 rounded-full`}>
                    {sources.length} sources
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {sources.map((source, idx) => (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                        source.frozen ? colors.accentBorder : 'border-border-light'
                      }`}
                    >
                      <div className="p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-md ${source.frozen ? `${colors.accentBg} ${colors.accent}` : 'bg-paper-50 text-ink-500'}`}>
                              {source.frozen ? <Lock size={12} /> : <Database size={12} />}
                            </div>
                            <div>
                              <div className="text-[0.75rem] font-semibold text-text">{source.name}</div>
                              <div className="text-[0.75rem] text-text-muted">{source.type}</div>
                            </div>
                          </div>
                          <span className={`text-[0.75rem] font-bold px-1.5 py-0.5 rounded border ${FORMAT_COLORS[source.format] || 'bg-paper-50 text-ink-500 border-canvas-border'}`}>
                            {source.format}
                          </span>
                        </div>

                        {/* Fields */}
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {source.fields.map(field => (
                            <span key={field} className="text-[0.75rem] font-medium px-1.5 py-0.5 bg-surface-2 text-text-muted rounded">
                              {field}
                            </span>
                          ))}
                        </div>

                        {/* Freeze Toggle */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleFreeze(source.id)}
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            {source.frozen ? (
                              <ToggleRight size={18} className={colors.accent} />
                            ) : (
                              <ToggleLeft size={18} className="text-ink-300" />
                            )}
                            <span className={`text-[0.75rem] font-medium ${source.frozen ? colors.accent : 'text-text-muted'}`}>
                              {source.frozen ? 'Frozen' : 'Freeze'}
                            </span>
                          </button>
                          {source.frozen ? (
                            <span className={`text-[0.75rem] font-bold ${colors.badgeText} ${colors.badgeBg} px-1.5 py-0.5 rounded-full flex items-center gap-0.5`}>
                              <CheckCircle size={7} /> Frozen
                            </span>
                          ) : (
                            <span className="text-[0.75rem] font-bold text-high-700 bg-high-50 px-1.5 py-0.5 rounded-full">
                              Required
                            </span>
                          )}
                        </div>

                        {/* Frozen info or Upload zone */}
                        {source.frozen ? (
                          <div className={`mt-2 text-[0.75rem] ${colors.accent} ${colors.accentBg}/50 rounded-lg px-2 py-1.5`}>
                            Using cached version from {source.frozenDate}
                            {source.records && <span className={`block text-[0.75rem] ${colors.accent} opacity-70 mt-0.5`}>{source.records}</span>}
                          </div>
                        ) : (
                          <div className={`mt-2 border border-dashed border-border rounded-lg p-2 flex items-center justify-center gap-1.5 hover:${colors.accentBorder} hover:${colors.accentBg}/30 transition-colors cursor-pointer`}>
                            <Upload size={10} className="text-text-muted" />
                            <span className="text-[0.75rem] text-text-muted">Drop file or click to upload</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Match Tolerance */}
                {config.matchSettings.toleranceDefault !== 'N/A' && (
                  <div className="bg-white rounded-lg border border-border-light p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[0.75rem] font-semibold text-text flex items-center gap-1.5`}>
                        <Hash size={12} className={colors.accent} /> Match Tolerance
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tolerance}
                          onChange={e => setTolerance(e.target.value)}
                          className={`w-12 text-center text-[0.75rem] font-bold ${colors.accent} bg-white border ${colors.accentBorder} rounded-lg py-1 focus:outline-none`}
                        />
                        <span className="text-[0.75rem] text-text-muted font-medium">%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all`} style={{ width: `${Math.min(Number(tolerance) * 10, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[0.75rem] text-text-muted mt-1"><span>Exact</span><span>5%</span><span>10%</span></div>
                  </div>
                )}

                {/* Match Logic */}
                <div className="bg-white rounded-lg border border-border-light p-3 mb-4">
                  <span className="text-[0.75rem] font-semibold text-text mb-2 block">
                    {config.matchSettings.toleranceDefault === 'N/A' ? 'Detection Logic' : 'Match Logic'}
                  </span>
                  <div className="flex gap-2">
                    {config.matchSettings.logicOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => setMatchLogic(option)}
                        className={`flex-1 px-3 py-2 rounded-lg text-[0.75rem] font-medium transition-all cursor-pointer ${
                          matchLogic === option
                            ? `${colors.accentBg} ${colors.badgeText} border-2 ${colors.accentBorder} shadow-sm`
                            : `bg-surface-2 text-text-muted border-2 border-transparent hover:${colors.accentBorder}`
                        }`}
                      >
                        {option}
                        {matchLogic === option && <CheckCircle size={10} className="inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirm Button */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex justify-end">
                  <button
                    onClick={() => advanceStage(2)}
                    className={`flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r ${colors.gradient} hover:opacity-90 text-white rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer shadow-md`}
                  >
                    Confirm Inputs <ArrowRight size={13} />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 2: Output Configuration */}
          <AnimatePresence mode="wait">
            {stage === 2 && config && colors && (
              <motion.div
                key="stage-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight size={14} className={colors.accent} />
                  <h2 className="text-[0.8125rem] font-semibold text-text">Output Configuration</h2>
                  <span className={`text-[0.75rem] font-bold ${colors.badgeText} ${colors.badgeBg} px-2 py-0.5 rounded-full`}>
                    {enabledColumns.length} columns
                  </span>
                </div>

                {/* Output Sheets (Excel tabs) */}
                <div className="bg-white rounded-lg border border-border-light p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[0.75rem] font-semibold text-text flex items-center gap-1.5">
                      <FileText size={12} className={colors.accent} /> Output Sheets
                    </span>
                    <span className="text-[0.75rem] text-text-muted">Configure multiple sheets in Excel output</span>
                  </div>
                  <div className="flex items-end gap-0 bg-surface-2 rounded-t-lg overflow-hidden">
                    {outputSheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        onClick={() => { setActiveSheetId(sheet.id); setEditingSheetId(null); }}
                        className={`group relative flex items-center gap-1.5 px-3 py-2 text-[0.75rem] font-medium cursor-pointer transition-all border-b-2 ${
                          activeSheetId === sheet.id
                            ? `bg-white ${colors.accent} border-current shadow-sm -mb-px rounded-t-lg`
                            : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-white/50'
                        }`}
                      >
                        {editingSheetId === sheet.id ? (
                          <input
                            autoFocus
                            value={sheet.name}
                            onChange={(e) => setOutputSheets(prev => prev.map(s => s.id === sheet.id ? { ...s, name: e.target.value } : s))}
                            onBlur={() => setEditingSheetId(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingSheetId(null); }}
                            className={`w-20 bg-transparent border-b ${colors.accentBorder} text-[0.75rem] font-medium outline-none ${colors.accent}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span onDoubleClick={(e) => { e.stopPropagation(); setEditingSheetId(sheet.id); }}>
                            {sheet.name}
                          </span>
                        )}
                        {outputSheets.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const remaining = outputSheets.filter(s => s.id !== sheet.id);
                              setOutputSheets(remaining);
                              if (activeSheetId === sheet.id) setActiveSheetId(remaining[0].id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-risk-700 transition-all cursor-pointer"
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newId = `sheet-${Date.now()}`;
                        setOutputSheets(prev => [...prev, { id: newId, name: `Sheet ${prev.length + 1}` }]);
                        setActiveSheetId(newId);
                        setEditingSheetId(newId);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[0.75rem] text-text-muted hover:${colors.accent} transition-colors cursor-pointer`}
                    >
                      <Plus size={10} /> Add Sheet
                    </button>
                  </div>
                  <div className="border border-t-0 border-border-light rounded-b-lg p-2.5 bg-white">
                    <div className="flex items-center gap-2 text-[0.75rem] text-text-muted">
                      <FileText size={10} className={colors.accent} />
                      <span>
                        Configuring columns for <strong className={colors.accent}>{outputSheets.find(s => s.id === activeSheetId)?.name}</strong>
                      </span>
                      <span className="text-[0.75rem] bg-surface-2 px-1.5 py-0.5 rounded">Double-click tab to rename</span>
                    </div>
                  </div>
                </div>

                {/* Output Columns */}
                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  {outputColumns.map((col, idx) => (
                    <motion.div
                      key={col.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`bg-white rounded-lg border p-2.5 flex items-center gap-3 transition-all ${
                        col.enabled ? 'border-border-light shadow-sm' : 'border-border-light/50 opacity-50'
                      }`}
                    >
                      <GripVertical size={12} className="text-text-muted/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.75rem] font-medium text-text truncate">{col.name}</span>
                          <span className={`text-[0.4375rem] font-bold px-1.5 py-0.5 rounded shrink-0 ${TYPE_BADGES[col.type].color}`}>
                            {TYPE_BADGES[col.type].label}
                          </span>
                          {col.frozen && (
                            <span className={`text-[0.4375rem] font-bold ${colors.badgeText} ${colors.badgeBg} px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0`}>
                              <Lock size={6} /> Required
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleColumn(col.id)}
                        disabled={col.frozen}
                        className={`shrink-0 cursor-pointer ${col.frozen ? 'cursor-not-allowed' : ''}`}
                      >
                        {col.enabled ? (
                          <Eye size={14} className={colors.accent} />
                        ) : (
                          <EyeOff size={14} className="text-ink-300" />
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* KPI Options */}
                <div className="bg-white rounded-lg border border-border-light p-3 mb-4">
                  <span className="text-[0.75rem] font-semibold text-text mb-2 block">Dashboard KPIs</span>
                  <div className="space-y-1.5">
                    {config.kpiOptions.map(kpi => (
                      <label
                        key={kpi.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={kpiToggles[kpi.id] ?? kpi.enabled}
                          onChange={() => toggleKpi(kpi.id)}
                          className="w-3.5 h-3.5 rounded accent-current cursor-pointer"
                          style={{ accentColor: config.color }}
                        />
                        <span className="text-[0.75rem] font-medium text-text flex-1">{kpi.label}</span>
                        {kpi.id === 'run_comparison' && (
                          <span className="text-[0.75rem] font-bold text-mitigated-700 bg-mitigated-50 px-1.5 py-0.5 rounded">DELTA</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* AI Suggestions */}
                <div className="bg-gradient-to-r from-primary/5 via-white to-primary/5 rounded-xl border border-primary/10 p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="p-1 rounded-md bg-primary/10"><Sparkles size={11} className="text-primary" /></div>
                    <span className="text-[0.75rem] font-semibold text-text">AI Suggestions</span>
                    <span className="text-[0.75rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">SMART</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { text: 'Add "Trend vs Previous Run" column to track changes between executions', applied: false },
                      { text: 'Enable variance highlighting when amount difference exceeds tolerance', applied: true },
                      { text: 'Include "Time to Resolution" metric for flagged items', applied: false },
                      { text: 'Auto-group results by vendor for easier review', applied: false },
                    ].map((suggestion, idx) => (
                      <AISuggestionRow key={idx} suggestion={suggestion} colors={colors} onApply={() => addToast({ message: 'Suggestion applied to output configuration', type: 'success' })} />
                    ))}
                  </div>
                </div>

                {/* Layout Picker */}
                <div className="bg-white rounded-lg border border-border-light p-3 mb-4">
                  <span className="text-[0.75rem] font-semibold text-text mb-2 block">Output Layout</span>
                  <div className="flex gap-2">
                    {config.layoutOptions.map(layout => (
                      <button
                        key={layout}
                        onClick={() => setSelectedLayout(layout)}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-[0.75rem] font-medium transition-all cursor-pointer border-2 ${
                          selectedLayout === layout
                            ? `${colors.accentBg} ${colors.badgeText} ${colors.accentBorder} shadow-sm`
                            : `border-border-light text-text-muted hover:${colors.accentBorder}`
                        }`}
                      >
                        {layout}
                        {selectedLayout === layout && <CheckCircle size={10} className="inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirm Button */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between">
                  <button
                    onClick={() => advanceStage(1)}
                    className="flex items-center gap-1 text-[0.75rem] text-text-muted hover:text-text-secondary cursor-pointer"
                  >
                    <ChevronLeft size={12} /> Back to Inputs
                  </button>
                  <button
                    onClick={() => advanceStage(3)}
                    className={`flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r ${colors.gradient} hover:opacity-90 text-white rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer shadow-md`}
                  >
                    Confirm Output <ArrowRight size={13} />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 3: Preview */}
          <AnimatePresence mode="wait">
            {stage === 3 && config && colors && (
              <motion.div
                key="stage-3"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5 }}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className={colors.accent} />
                    <h2 className="text-[0.8125rem] font-semibold text-text">{config.name}</h2>
                    <span className="text-[0.75rem] font-bold bg-compliant-50 text-compliant-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-compliant animate-pulse" /> Live Preview
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${colors.gradient} hover:opacity-90 text-white rounded-lg text-[0.75rem] font-semibold transition-all cursor-pointer shadow-sm`}>
                      <Play size={10} /> Run Now
                    </button>
                    <button
                      onClick={handleSaveWorkflow}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-white transition-colors cursor-pointer"
                    >
                      <Save size={10} /> Save
                    </button>
                  </div>
                </div>

                {/* KPI Cards — dark bento style */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {config.previewStats.map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="rounded-2xl p-3 relative overflow-hidden"
                      style={{ background: 'linear-gradient(145deg, #1e1230 0%, #160d24 100%)', border: '1px solid rgba(106,18,205,0.12)' }}>
                      <div className={`text-[1rem] font-extrabold text-white leading-none`}>{stat.value}</div>
                      <div className="text-[0.75rem] text-white/40 mt-1">{stat.label}</div>
                      <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full opacity-20 blur-xl" style={{ background: config.color }} />
                    </motion.div>
                  ))}
                </div>

                {/* Mini Area Chart */}
                <div className="bg-white rounded-lg border border-border-light p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[0.75rem] font-bold text-text-muted">Execution Trend · Last 7 Runs</span>
                    <span className="text-[0.75rem] font-semibold text-compliant-700">{'\u2191'} 12% improvement</span>
                  </div>
                  <svg width="100%" height="48" viewBox="0 0 400 48" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="preview-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={config.color} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <polygon fill="url(#preview-trend)" points="0,48 0,38 57,35 114,30 171,32 228,25 285,20 342,15 400,10 400,48" />
                    <polyline fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" points="0,38 57,35 114,30 171,32 228,25 285,20 342,15 400,10" />
                    <circle cx="400" cy="10" r="3" fill={config.color} />
                  </svg>
                </div>

                {/* AI Summary */}
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="rounded-xl p-4 mb-4 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(106,18,205,0.04) 0%, rgba(255,255,255,0.8) 40%, rgba(106,18,205,0.02) 100%)', border: '1px solid rgba(106,18,205,0.08)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-primary" />
                    <span className="text-[0.75rem] font-bold text-primary">AI Summary</span>
                  </div>
                  {config.id === 'reconciliation' && (
                    <p className="text-[0.75rem] text-text leading-relaxed">
                      Processed <strong>1,247 records</strong> across PO, GRN, and Invoice data. <strong>87% matched</strong> successfully with zero variance.
                      <strong className="text-mitigated-700"> 98 records</strong> show amount variances within the 5% tolerance; recommend bulk approval.
                      <strong className="text-risk-700"> 60 unmatched items</strong> require manual investigation:
                      32 missing GRNs (likely goods in transit) and 28 invoices with no corresponding PO.
                      Top vendor by variance: <strong>Global Supplies Ltd</strong> (₹2,450 across 3 invoices).
                    </p>
                  )}
                  {config.id === 'detection' && (
                    <p className="text-[0.75rem] text-text leading-relaxed">
                      Scanned <strong>12,450 invoices</strong> against 6-month history. Identified <strong className="text-risk-700">8 potential duplicates</strong> totaling <strong>₹6.16L at risk</strong>.
                      Highest confidence match: INV-4521 vs INV-3102 (Acme Corp, 96% match).
                      <strong> 3 invoices</strong> from the same vendor within 48 hours flagged as suspicious.
                      False positive rate: <strong className="text-compliant-700">4.2%</strong> (down from 6.5% last run).
                      Recommend immediate review of the 3 critical-severity flags before next payment batch.
                    </p>
                  )}
                  {config.id === 'monitoring' && (
                    <p className="text-[0.75rem] text-text leading-relaxed">
                      Detected <strong>24 vendor master changes</strong> in the monitoring window.
                      <strong className="text-risk-700"> 3 unauthorized changes</strong> flagged; 2 bank account modifications by unrecognized users.
                      <strong>16 changes auto-approved</strong> based on authorization matrix.
                      Avg response time for flagged items: <strong>2.4 hours</strong>.
                      Critical alert: <strong>Acme Corp</strong> bank account changed from HDFC to ICICI by <code className="text-[0.75rem] bg-surface-2 px-1 rounded">admin_user</code>. Requires immediate verification.
                    </p>
                  )}
                  {config.id === 'compliance' && (
                    <p className="text-[0.75rem] text-text leading-relaxed">
                      Scanned <strong>2,341 users</strong> against 156 SOD rules. Found <strong className="text-risk-700">12 violations</strong>,
                      <strong>4 critical</strong> (Create PO + Approve PO, Edit Master + Pay Vendor).
                      <strong className="text-compliant-700">8 violations have compensating controls</strong> in place.
                      4 users require immediate role remediation.
                      P2P process has the highest violation density (7 of 12).
                      Recommend escalating USR-042 and USR-201 to access governance team.
                    </p>
                  )}
                </motion.div>

                {/* Preview Table — enhanced */}
                <div className="bg-white rounded-xl border border-border-light shadow-sm overflow-hidden mb-4">
                  {/* Sheet Tabs */}
                  {outputSheets.length > 1 && (
                    <div className="flex items-center bg-surface-2 border-b border-border-light">
                      {outputSheets.map((sheet) => (
                        <button
                          key={sheet.id}
                          onClick={() => setActiveSheetId(sheet.id)}
                          className={`px-4 py-2 text-[0.75rem] font-semibold transition-all cursor-pointer border-b-2 ${
                            activeSheetId === sheet.id
                              ? `bg-white ${colors.accent} border-current -mb-px`
                              : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-white/40'
                          }`}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Table Header */}
                  <div
                    className="grid gap-0 bg-surface-2 px-3 py-2 border-b border-border-light"
                    style={{ gridTemplateColumns: `28px repeat(${enabledColumns.length}, minmax(0, 1fr))` }}
                  >
                    <div className="text-[0.4375rem] font-bold text-text-muted/40">#</div>
                    {enabledColumns.map(col => (
                      <div key={col.id} className="text-[0.75rem] font-bold text-text-muted/60 truncate pr-1">
                        {col.name}
                      </div>
                    ))}
                  </div>

                  {/* Table Rows */}
                  {config.previewRows.map((row, i) => {
                    const rowBg =
                      row.status === 'matched' || row.status === 'ok' ? (i % 2 === 0 ? 'bg-compliant-50/30' : 'bg-compliant-50/15') :
                      row.status === 'variance' || row.status === 'warning' ? (i % 2 === 0 ? 'bg-mitigated-50/40' : 'bg-mitigated-50/20') :
                      row.status === 'unmatched' || row.status === 'flagged' ? (i % 2 === 0 ? 'bg-risk-50/30' : 'bg-risk-50/15') :
                      (i % 2 === 0 ? 'bg-white' : 'bg-surface-2/30');

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className={`grid gap-0 px-3 py-2.5 border-b border-border-light last:border-0 ${rowBg}`}
                        style={{ gridTemplateColumns: `28px repeat(${enabledColumns.length}, minmax(0, 1fr))` }}
                      >
                        <div className="text-[0.75rem] font-mono text-text-muted/40">{i + 1}</div>
                        {enabledColumns.map((col, ci) => {
                          const cellValue = row.cells[ci] ?? '';
                          const isBadge = col.type === 'badge';
                          const isPercent = col.type === 'percent';

                          if (isBadge) {
                            const badgeColor =
                              row.status === 'matched' || row.status === 'ok' ? 'text-compliant-700 bg-compliant-50' :
                              row.status === 'variance' || row.status === 'warning' ? 'text-mitigated-700 bg-mitigated-50' :
                              'text-risk-700 bg-risk-50';
                            const badgeIcon =
                              row.status === 'matched' || row.status === 'ok' ? '\u2713' :
                              row.status === 'variance' || row.status === 'warning' ? '\u26A0' : '\u2717';
                            return (
                              <div key={col.id} className="flex items-center">
                                <span className={`text-[0.75rem] font-bold px-2 py-0.5 rounded-full ${badgeColor} flex items-center gap-1`}>
                                  <span className="text-[0.4375rem]">{badgeIcon}</span> {cellValue}
                                </span>
                              </div>
                            );
                          }

                          if (isPercent) {
                            const pctNum = parseInt(cellValue);
                            const pctColor = pctNum >= 90 ? 'text-compliant-700' : pctNum >= 50 ? 'text-mitigated-700' : 'text-risk-700';
                            return (
                              <div key={col.id} className={`text-[0.75rem] font-bold ${pctColor}`}>
                                {cellValue}
                              </div>
                            );
                          }

                          return (
                            <div key={col.id} className={`text-[0.75rem] ${col.type === 'number' ? 'font-mono' : ''} text-text truncate pr-1`}>
                              {cellValue}
                            </div>
                          );
                        })}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-border-light">
                  <button onClick={() => advanceStage(2)} className="flex items-center gap-1 text-[0.75rem] text-text-muted hover:text-text-secondary cursor-pointer">
                    <ChevronLeft size={12} /> Edit Configuration
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSaveWorkflow} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-white transition-colors cursor-pointer">
                      <Save size={12} /> Save to Library
                    </button>
                    <button className={`flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r ${colors.gradient} hover:opacity-90 text-white rounded-xl text-[0.75rem] font-semibold transition-all cursor-pointer shadow-md`}>
                      <Play size={12} /> {RUN_LABELS[config.id]}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Building indicator — show when chat is driving stages and we're between 1-2 */}
          {buildStage !== undefined && stage > 0 && stage < 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-6">
              <div className={`flex items-center gap-2 text-[0.75rem] ${colors?.accent || 'text-primary'} font-medium`}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={14} />
                </motion.div>
                Waiting for next input from chat...
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
