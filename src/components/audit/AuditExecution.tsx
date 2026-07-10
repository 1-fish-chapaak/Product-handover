import { useState } from 'react';
import {
  ClipboardCheck, Play, FileText,
  AlertTriangle
} from 'lucide-react';
import { ENGAGEMENTS, ENGAGEMENT_CONTROLS, DEFICIENCIES } from '../../data/mockData';
import { StatusBadge, SeverityBadge, FrameworkBadge, Avatar } from '../shared/StatusBadge';
import SmartTable from '../shared/SmartTable';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';

interface Props {
  onAskAboutControl?: (controlId: string) => void;
}

function TestPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    'not-started': { bg: 'bg-paper-50', text: 'text-ink-500', label: 'Not started' },
    'in-progress': { bg: 'bg-evidence-50', text: 'text-evidence-700', label: 'In progress' },
    effective: { bg: 'bg-compliant-50', text: 'text-compliant-700', label: 'Effective' },
    ineffective: { bg: 'bg-risk-50', text: 'text-risk-700', label: 'Ineffective' },
  };
  const s = map[status] || map['not-started'];
  return <span title={s.label} className={`inline-flex items-center ${s.bg} ${s.text} px-2 py-0.5 rounded text-[0.75rem] font-bold whitespace-nowrap`}>{s.label}</span>;
}

export default function AuditExecution({ onAskAboutControl: _unused }: Props) {
  const [selectedEngId, setSelectedEngId] = useState(ENGAGEMENTS[0].id);
  const [activeTab, setActiveTab] = useState<'controls' | 'deficiencies'>('controls');
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const eng = ENGAGEMENTS.find(e => e.id === selectedEngId)!;
  const controls = ENGAGEMENT_CONTROLS.filter(c => c.engId === selectedEngId);
  const progress = eng.controls > 0 ? Math.round((eng.tested / eng.controls) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.09} rotateOnHover hue={275} opacity={0.08} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Audit Execution</h1>
            <p className="text-sm text-text-secondary mt-1">Control testing and deficiency tracking</p>
          </div>
        </div>

        {/* Engagement selector */}
        <div className="flex gap-3 mb-6">
          {ENGAGEMENTS.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedEngId(e.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                selectedEngId === e.id
                  ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                  : 'border-border-light bg-white text-text-secondary hover:border-primary/20 active:scale-[0.98]'
              }`}
            >
              <FrameworkBadge fw={e.type} />
              {e.name}
              <StatusBadge status={e.status} />
            </button>
          ))}
        </div>

        {/* Engagement overview */}
        <div className="bg-white rounded-xl border border-border-light p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-text">{eng.name}</h2>
              <p className="text-[0.75rem] text-text-muted mt-0.5">
                {eng.start} — {eng.end} · Owner: {eng.owner}
              </p>
            </div>
            <button onClick={() => { addToast({ message: 'Running control tests for selected engagement...', type: 'success' }); logEvent({ action: 'Run', description: `Ran control tests for "${eng.name}"`, module: 'Engagements', entity: 'Control' }); }} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              <Play size={14} />
              Run Tests
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="bg-surface-2 rounded-lg p-3 text-center hover:bg-surface-2/80 transition-colors duration-200">
              <div className="text-xl font-bold text-text">{eng.controls}</div>
              <div className="text-[0.75rem] text-text-muted">Total Controls</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center hover:bg-surface-2/80 transition-colors duration-200">
              <div className="text-xl font-bold text-info">{eng.tested}</div>
              <div className="text-[0.75rem] text-text-muted">Tested</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center hover:bg-surface-2/80 transition-colors duration-200">
              <div className="text-xl font-bold text-success">{eng.effective}</div>
              <div className="text-[0.75rem] text-text-muted">Effective</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center hover:bg-surface-2/80 transition-colors duration-200">
              <div className="text-xl font-bold text-danger">{eng.deficiencies}</div>
              <div className="text-[0.75rem] text-text-muted">Deficiencies</div>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center hover:bg-surface-2/80 transition-colors duration-200">
              <div className="text-xl font-bold text-primary">{progress}%</div>
              <div className="text-[0.75rem] text-text-muted">Progress</div>
              <div className="mt-1.5 h-1.5 bg-border-light rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-4">
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors ${
              activeTab === 'controls'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <ClipboardCheck size={14} />
              Control Testing
              <span className={`text-[0.75rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'controls' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{controls.length}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('deficiencies')}
            className={`px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors ${
              activeTab === 'deficiencies'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} />
              Deficiencies
              <span className={`text-[0.75rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'deficiencies' ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'}`}>{DEFICIENCIES.length}</span>
            </span>
          </button>
        </div>

        {/* Controls Table */}
        {activeTab === 'controls' && (
          <SmartTable
            data={controls as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search controls..."
            searchKeys={['racm', 'control', 'assignee']}
            pageSize={10}
            columns={[
              { key: 'racm', label: 'RACM', width: '120px', render: (item) => (
                <span className="text-text-muted text-[0.75rem]">{String(item.racm)}</span>
              )},
              { key: 'control', label: 'Control', render: (item) => (
                <span className="text-text font-medium">{String(item.control)}</span>
              )},
              { key: 'isKey', label: 'Key', align: 'center', width: '50px', render: (item) => (
                item.isKey ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.75rem] font-bold">K</span> : null
              )},
              { key: 'assignee', label: 'Assignee', width: '110px', render: (item) => (
                <div className="flex items-center gap-1.5">
                  <Avatar name={String(item.assignee)} size={20} />
                  <span className="text-text-secondary text-[0.75rem]">{String(item.assignee).split(' ')[0]}</span>
                </div>
              )},
              { key: 'wt', label: 'WT', align: 'center', width: '70px', render: (item) => <span title="Walkthrough Testing"><TestPill status={String(item.wt)} /></span> },
              { key: 'de', label: 'DE', align: 'center', width: '70px', render: (item) => <span title="Design Effectiveness"><TestPill status={String(item.de)} /></span> },
              { key: 'oe', label: 'OE', align: 'center', width: '70px', render: (item) => <span title="Operating Effectiveness"><TestPill status={String(item.oe)} /></span> },
              { key: 'evidence', label: 'Evidence', align: 'center', width: '70px', render: (item) => (
                <span className="flex items-center justify-center gap-1 text-text-muted">
                  <FileText size={11} />
                  {String(item.evidence)}
                </span>
              )},
              /* Ask AI removed from all pages per PRD 2026-04-06 */
            ]}
          />
        )}

        {/* Deficiencies Table */}
        {activeTab === 'deficiencies' && (
          <SmartTable
            data={DEFICIENCIES as unknown as Record<string, unknown>[]}
            keyField="id"
            searchPlaceholder="Search deficiencies..."
            searchKeys={['id', 'finding', 'assignee']}
            paginated={false}
            columns={[
              { key: 'id', label: 'ID', width: '80px', render: (item) => (
                <span className="font-mono text-text-muted text-[0.75rem]">{String(item.id)}</span>
              )},
              { key: 'finding', label: 'Finding', render: (item) => (
                <div className="text-text font-medium max-w-sm line-clamp-2">{String(item.finding)}</div>
              )},
              { key: 'severity', label: 'Severity', width: '100px', render: (item) => <SeverityBadge severity={String(item.severity)} /> },
              { key: 'assignee', label: 'Assignee', width: '120px', render: (item) => (
                <div className="flex items-center gap-1.5">
                  <Avatar name={String(item.assignee)} size={20} />
                  <span className="text-text-secondary text-[0.75rem]">{String(item.assignee)}</span>
                </div>
              )},
              { key: 'status', label: 'Status', width: '100px', render: (item) => <StatusBadge status={String(item.status)} /> },
              { key: 'due', label: 'Due', width: '100px', render: (item) => (
                <span className="text-text-muted">{String(item.due)}</span>
              )},
            ]}
          />
        )}
      </div>
    </div>
  );
}
