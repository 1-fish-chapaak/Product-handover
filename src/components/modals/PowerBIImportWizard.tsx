import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, BarChart3, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { POWER_BI_DASHBOARDS } from '../../data/mockData';
import { useToast } from '../shared/Toast';

interface Props {
  onClose: () => void;
}

type WizardStep = 'connect' | 'browse' | 'preview' | 'done';

export default function PowerBIImportWizard({ onClose }: Props) {
  const { addToast } = useToast();
  const [step, setStep] = useState<WizardStep>('connect');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const steps: WizardStep[] = ['connect', 'browse', 'preview', 'done'];
  const currentIndex = steps.indexOf(step);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      setTimeout(() => setStep('browse'), 500);
    }, 1500);
  };

  const handleImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setStep('done');
      addToast({ type: 'success', message: 'Dashboard imported.' });
    }, 1200);
  };

  const selectedData = POWER_BI_DASHBOARDS.find(d => d.id === selectedDashboard);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative glass-card-strong rounded-2xl shadow-2xl w-[560px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-mitigated-50 rounded-xl">
              <BarChart3 size={16} className="text-mitigated-700" />
            </div>
            <h3 className="text-[15px] font-semibold text-text">Import from Power BI</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 py-3 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${
                i < currentIndex ? 'bg-compliant-50 text-compliant-700' :
                i === currentIndex ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'
              }`}>
                {i < currentIndex ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-[12px] font-medium capitalize ${i === currentIndex ? 'text-primary' : 'text-text-muted'}`}>
                {s}
              </span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border-light ml-1" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-5 min-h-[300px]">
          <AnimatePresence mode="wait">
            {step === 'connect' && (
              <motion.div key="connect" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col items-start text-left py-8">
                <div className="w-12 h-12 rounded-xl bg-mitigated-50 border border-mitigated-50 flex items-center justify-center mb-4">
                  <BarChart3 size={24} className="text-mitigated-700" />
                </div>
                <h4 className="text-[16px] font-semibold text-ink-800 mb-1">Connect to Power BI</h4>
                <p className="text-[13px] text-ink-500 mb-6 max-w-[300px]">Sign in to your Power BI account to browse and import dashboards.</p>
                {connected ? (
                  <div className="flex items-center gap-2 text-compliant-700">
                    <CheckCircle size={20} />
                    <span className="text-[14px] font-semibold">Connected.</span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 px-5 h-10 bg-brand-600 text-white rounded-md text-[13px] font-semibold hover:bg-brand-500 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {connecting ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                    {connecting ? 'Connecting…' : 'Connect to Power BI'}
                  </button>
                )}
              </motion.div>
            )}

            {step === 'browse' && (
              <motion.div key="browse" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="text-[14px] font-semibold text-text mb-3">Select a Dashboard</h4>
                <div className="grid grid-cols-2 gap-3">
                  {POWER_BI_DASHBOARDS.map(dash => (
                    <button
                      key={dash.id}
                      onClick={() => setSelectedDashboard(dash.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedDashboard === dash.id
                          ? 'border-primary bg-primary-xlight shadow-sm'
                          : 'border-border-light hover:border-primary/30 bg-white'
                      }`}
                    >
                      <div className="h-12 rounded-lg bg-mitigated-50 border border-mitigated-50 mb-2.5 flex items-center justify-center">
                        <BarChart3 size={20} className="text-mitigated-700" />
                      </div>
                      <div className="text-[12px] font-semibold text-text mb-0.5">{dash.name}</div>
                      <div className="text-[12px] text-text-muted">{dash.workspace} · {dash.tiles} tiles</div>
                      <div className="text-[12px] text-text-muted/60 mt-1">Last refresh: {dash.lastRefresh}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-5">
                  <button onClick={() => setStep('connect')} className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button
                    onClick={() => setStep('preview')}
                    disabled={!selectedDashboard}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-[12px] font-semibold hover:bg-primary-hover disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Preview <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'preview' && selectedData && (
              <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h4 className="text-[14px] font-semibold text-text mb-3">Preview: {selectedData.name}</h4>
                <div className="rounded-xl border border-border-light bg-surface-2 p-4 mb-4">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {Array.from({ length: Math.min(selectedData.tiles, 6) }).map((_, i) => (
                      <div key={i} className={`h-16 rounded-lg flex items-center justify-center ${
                        i % 3 === 0 ? 'bg-evidence-50' :
                        i % 3 === 1 ? 'bg-compliant-50' :
                        'bg-brand-50'
                      }`}>
                        <div className="w-8 h-2 bg-white/60 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="text-[12px] text-text-muted text-center">
                    {selectedData.tiles} tiles · {selectedData.workspace} · Last refresh: {selectedData.lastRefresh}
                  </div>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep('browse')} className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">
                    <ArrowLeft size={13} /> Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-medium text-white rounded-xl text-[13px] font-semibold hover:from-primary-hover hover:to-primary disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {importing ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                    {importing ? 'Importing...' : 'Import Dashboard'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  className="w-16 h-16 rounded-full bg-compliant-50 flex items-center justify-center mb-4"
                >
                  <CheckCircle size={32} className="text-compliant-700" />
                </motion.div>
                <h4 className="text-[16px] font-semibold text-text mb-1">Dashboard Imported!</h4>
                <p className="text-[13px] text-text-muted mb-6">"{selectedData?.name}" has been added to your dashboards.</p>
                <button
                  onClick={onClose}
                  className="px-10 py-2.5 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  View in Dashboards
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
