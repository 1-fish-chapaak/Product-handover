import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  EngagementPatternType, ComplianceFramework, ControlScopeSource, TestingInputMethod,
  AuditScopeLevel, AutomationInputType, AutomationSetupMode, AutomationOutputType, RunType, RunFrequency,
} from '../configurableEngagementTypes';
import type { ComplianceConfig, InternalAuditConfig, AutomationProjectConfig, EngagementConfig } from '../configurableEngagementTypes';

interface Props {
  patternType: EngagementPatternType;
  config: EngagementConfig;
  onChange: (config: EngagementConfig) => void;
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const checkCls = 'w-3.5 h-3.5 rounded border-border text-primary cursor-pointer accent-[#6a12cd]';

export default function PatternConfigStep({ patternType, config, onChange }: Props) {
  if (patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING && config.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    return <ComplianceSetup config={config} onChange={onChange} />;
  }
  if (patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT && config.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    return <InternalAuditSetup config={config} onChange={onChange} />;
  }
  if (patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT && config.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    return <AutomationProjectSetup config={config} onChange={onChange} />;
  }
  return null;
}

// ─── Compliance Control Testing ───────────────────────────────────────────

function ComplianceSetup({ config, onChange }: { config: ComplianceConfig; onChange: (c: EngagementConfig) => void }) {
  const update = <K extends keyof ComplianceConfig>(field: K, value: ComplianceConfig[K]) =>
    onChange({ ...config, [field]: value });

  const racmFrameworks: ComplianceFramework[] = [ComplianceFramework.SOX_ICFR, ComplianceFramework.IFC, ComplianceFramework.ICOFR];
  const racmWarning = racmFrameworks.includes(config.framework) && config.controlScopeSource !== ControlScopeSource.RACM_VERSION;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">Compliance Setup</h3>
        <p className="text-[12px] text-text-muted">Configure framework, control scope, and testing approach.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Framework <span className="text-red-400">*</span></label>
          <select value={config.framework} onChange={e => update('framework', e.target.value as ComplianceFramework)} className={selectCls}>
            <option value={ComplianceFramework.SOX_ICFR}>SOX ICFR</option>
            <option value={ComplianceFramework.IFC}>IFC</option>
            <option value={ComplianceFramework.ICOFR}>ICOFR</option>
            <option value={ComplianceFramework.SOC1}>SOC 1</option>
            <option value={ComplianceFramework.SOC2}>SOC 2</option>
            <option value={ComplianceFramework.GDPR}>GDPR</option>
            <option value={ComplianceFramework.CUSTOM}>Custom</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Audit Type</label>
          <select value={config.auditType} onChange={e => update('auditType', e.target.value)} className={selectCls}>
            <option value="Financial Internal Control">Financial Internal Control</option>
            <option value="Compliance">Compliance</option>
            <option value="IT">IT</option>
            <option value="Operational">Operational</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Default Testing Input Method</label>
        <select value={config.defaultTestingInputMethod} onChange={e => update('defaultTestingInputMethod', e.target.value as TestingInputMethod)} className={selectCls}>
          <option value={TestingInputMethod.UPLOAD_SELECTED_SAMPLES}>Upload Selected Samples</option>
          <option value={TestingInputMethod.GENERATE_SAMPLES_FROM_POPULATION}>Generate Samples from Population</option>
          <option value={TestingInputMethod.TEST_FULL_POPULATION}>Test Full Population</option>
        </select>
      </div>

      {/* Upload RACM */}
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-text block">Upload RACM</span>
            <span className="text-[10px] text-gray-400">Upload an Excel/CSV RACM file to link controls to this engagement.</span>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors">
            Choose File
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                update('racmVersionId', `uploaded-${file.name}`);
                e.target.value = '';
              }
            }} />
          </label>
        </div>
        {config.racmVersionId && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
            <span>RACM linked: {config.racmVersionId.replace('uploaded-', '')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-not-allowed">
          <input type="checkbox" checked={config.reviewerRequired} disabled className={checkCls + ' opacity-50'} />
          Reviewer required
        </label>
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.requestPbcEnabled} onChange={e => update('requestPbcEnabled', e.target.checked)} className={checkCls} />
          Request PBC
        </label>
      </div>
    </div>
  );
}

// ─── Internal Audit Assignment ────────────────────────────────────────────

function InternalAuditSetup({ config, onChange }: { config: InternalAuditConfig; onChange: (c: EngagementConfig) => void }) {
  const update = <K extends keyof InternalAuditConfig>(field: K, value: InternalAuditConfig[K]) =>
    onChange({ ...config, [field]: value });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">Audit Assignment Setup</h3>
        <p className="text-[12px] text-text-muted">Configure announcement, IDR, and reporting settings.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.idrEnabled} onChange={e => update('idrEnabled', e.target.checked)} className={checkCls} />
          Enable IDR
        </label>
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.announcementRequired} onChange={e => update('announcementRequired', e.target.checked)} className={checkCls} />
          Announcement required
        </label>
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.finalReportRequired} onChange={e => update('finalReportRequired', e.target.checked)} className={checkCls} />
          Final report required
        </label>
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.actionTrackingEnabled} onChange={e => update('actionTrackingEnabled', e.target.checked)} className={checkCls} />
          Action tracking
        </label>
      </div>
    </div>
  );
}

// ─── Workflow Automation Project ──────────────────────────────────────────

function AutomationProjectSetup({ config, onChange }: { config: AutomationProjectConfig; onChange: (c: EngagementConfig) => void }) {
  const update = <K extends keyof AutomationProjectConfig>(field: K, value: AutomationProjectConfig[K]) =>
    onChange({ ...config, [field]: value });

  const toggleOutput = (ot: AutomationOutputType) => {
    if (ot === AutomationOutputType.REPORT) return; // report is required
    const current = config.outputTypes;
    update('outputTypes', current.includes(ot) ? current.filter(o => o !== ot) : [...current, ot]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">Automation Project Setup</h3>
        <p className="text-[12px] text-text-muted">Define outputs, review needs, run cadence, and optional governance references. Workflow selection and data source configuration happen inside the project workspace.</p>
      </div>

      <div>
        <label className={labelCls}>Output Types</label>
        <div className="flex flex-wrap gap-3 mt-1">
          {Object.values(AutomationOutputType).map(ot => {
            const isReport = ot === AutomationOutputType.REPORT;
            const checked = config.outputTypes.includes(ot);
            const label = ot === 'CASE_MANAGEMENT' ? 'Case Management' : ot === 'DOWNLOADABLE_FILE' ? 'Downloadable File' : ot.charAt(0) + ot.slice(1).toLowerCase();
            const isDashboard = ot === 'DASHBOARD';
            return (
              <label key={ot} className={`flex items-center gap-2 text-[11px] ${isReport ? 'text-gray-400 cursor-not-allowed' : 'text-text cursor-pointer'}`} title={isDashboard ? 'Creates a monitoring dashboard when this project is scheduled for recurring runs.' : undefined}>
                <input type="checkbox" checked={checked || isReport} disabled={isReport} onChange={() => toggleOutput(ot)} className={checkCls + (isReport ? ' opacity-50' : '')} />
                {label}
              </label>
            );
          })}
        </div>
        <p className="text-[9px] text-gray-400 mt-1">Report is required and cannot be unchecked.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input type="checkbox" checked={config.reviewRequired} onChange={e => update('reviewRequired', e.target.checked)} className={checkCls} />
          Review required
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>RACM Reference (optional)</label>
          <input value={config.racmReferenceId || ''} onChange={e => update('racmReferenceId', e.target.value)} placeholder="Optional RACM link" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Control Reference (optional)</label>
          <input value={(config.controlReferenceIds || []).join(', ')} onChange={e => update('controlReferenceIds', e.target.value ? e.target.value.split(',').map(s => s.trim()) : [])} placeholder="Optional control IDs" className={inputCls} />
        </div>
      </div>
    </div>
  );
}
