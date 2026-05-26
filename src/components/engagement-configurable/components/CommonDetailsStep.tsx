import React from 'react';
import type { EngagementPatternType } from '../configurableEngagementTypes';
import { PATTERN_DISPLAY_LABELS } from '../configurableEngagementTypes';

export interface CommonDetails {
  name: string;
  description: string;
  owner: string;
  reviewer: string;
  businessProcess: string;
  entityOrLocation: string;
  plannedStartDate: string;
  plannedEndDate: string;
  dataPeriodStart: string;
  dataPeriodEnd: string;
}

interface Props {
  patternType: EngagementPatternType;
  details: CommonDetails;
  onChange: (details: CommonDetails) => void;
  reviewerRequired: boolean;
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

export default function CommonDetailsStep({ patternType, details, onChange, reviewerRequired }: Props) {
  const label = PATTERN_DISPLAY_LABELS[patternType];
  const ownerLabel = patternType === 'workflow_automation_project' ? 'Project Owner' : patternType === 'internal_audit_assignment' ? 'Assignment Owner' : 'Engagement Owner';
  const update = (field: keyof CommonDetails, value: string) => onChange({ ...details, [field]: value });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">{label} Details</h3>
        <p className="text-[12px] text-text-muted">Provide the basic information for this {label.toLowerCase()}.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>Name <span className="text-red-400">*</span></label>
          <input value={details.name} onChange={e => update('name', e.target.value)} placeholder={`Enter ${label.toLowerCase()} name`} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Objective / Description <span className="text-red-400">*</span></label>
          <textarea value={details.description} onChange={e => update('description', e.target.value)} rows={3}
            placeholder="Describe the objective and scope" className={inputCls + ' resize-none'} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{ownerLabel} <span className="text-red-400">*</span></label>
            <input value={details.owner} onChange={e => update('owner', e.target.value)} placeholder={`Assign ${ownerLabel.toLowerCase()}`} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Reviewer {reviewerRequired && <span className="text-red-400">*</span>}</label>
            <input value={details.reviewer} onChange={e => update('reviewer', e.target.value)} placeholder={reviewerRequired ? 'Assign reviewer' : 'Optional'} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Business Process</label>
            <input value={details.businessProcess} onChange={e => update('businessProcess', e.target.value)} placeholder="e.g. Procure to Pay" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Entity / Location</label>
            <input value={details.entityOrLocation} onChange={e => update('entityOrLocation', e.target.value)} placeholder="e.g. Corporate HQ" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Planned Start Date</label>
            <input type="date" value={details.plannedStartDate} onChange={e => update('plannedStartDate', e.target.value)} className={inputCls} />
            <p className="text-[9px] text-gray-400 mt-0.5">When work begins</p>
          </div>
          <div>
            <label className={labelCls}>Planned End Date</label>
            <input type="date" value={details.plannedEndDate} onChange={e => update('plannedEndDate', e.target.value)} className={inputCls} />
            <p className="text-[9px] text-gray-400 mt-0.5">When work ends</p>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-text block mb-0.5">Data Period</label>
          <p className="text-[10px] text-gray-400 mb-2">Select the period of data that will be reviewed, tested, or analyzed.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data Period From</label>
              <input type="date" value={details.dataPeriodStart} onChange={e => update('dataPeriodStart', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Data Period To</label>
              <input type="date" value={details.dataPeriodEnd} onChange={e => update('dataPeriodEnd', e.target.value)} className={inputCls} />
            </div>
          </div>
          {details.dataPeriodStart && details.dataPeriodEnd && details.dataPeriodStart > details.dataPeriodEnd && (
            <p className="text-[10px] text-red-500 mt-1">Data Period From should not be after Data Period To.</p>
          )}
        </div>
      </div>
    </div>
  );
}
