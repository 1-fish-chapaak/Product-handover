// ─── Engagement Library — Unified Landing Page ───────────────────────────
// One common page showing all engagements across Compliance, IA, and Automation.
// Filter by type. Plan Engagement opens pattern selection modal.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, Shield, ClipboardCheck, Workflow, Calendar, Users,
  ChevronRight, Briefcase, AlertTriangle, CheckCircle2,
} from 'lucide-react';

type EngagementType = 'All' | 'Compliance' | 'Internal Audit' | 'Automation';

interface LibraryEngagement {
  id: string;
  name: string;
  type: EngagementType;
  typeLabel: string;
  description: string;
  status: string;
  statusTone: string;
  owner: string;
  reviewer?: string;
  process: string;
  entity?: string;
  period: string;
  metrics: { label: string; value: number | string; color?: string }[];
  progress?: number;
}

const MOCK_ENGAGEMENTS: LibraryEngagement[] = [
  // Compliance
  { id: 'eng-001', name: 'P2P — SOX Audit', type: 'Compliance', typeLabel: 'Compliance', description: 'SOX ICFR testing of Procure-to-Pay controls — vendor master, PO approval, three-way match, payment release.', status: 'In Fieldwork', statusTone: 'bg-evidence-50 text-evidence-700', owner: 'Tushar Goel', reviewer: 'Karan Mehta', process: 'Procure to Pay', period: 'Jan 2026 – Jun 2026', metrics: [{ label: 'Controls', value: 14 }, { label: 'Tested', value: 8 }, { label: 'Deficiencies', value: 1, color: 'text-red-600' }], progress: 57 },
  { id: 'eng-002', name: 'O2C — SOX Audit', type: 'Compliance', typeLabel: 'Compliance', description: 'Revenue recognition, billing, and collections testing.', status: 'In Fieldwork', statusTone: 'bg-evidence-50 text-evidence-700', owner: 'Neha Joshi', process: 'Order to Cash', period: 'Jan 2026 – Jun 2026', metrics: [{ label: 'Controls', value: 10 }, { label: 'Tested', value: 4 }, { label: 'Deficiencies', value: 0 }], progress: 40 },
  { id: 'eng-003', name: 'R2R — SOX Audit', type: 'Compliance', typeLabel: 'Compliance', description: 'Record-to-Report financial close and journal entry controls.', status: 'In Fieldwork', statusTone: 'bg-evidence-50 text-evidence-700', owner: 'Karan Mehta', process: 'Record to Report', period: 'Jan 2026 – Jun 2026', metrics: [{ label: 'Controls', value: 12 }, { label: 'Tested', value: 6 }, { label: 'Deficiencies', value: 2, color: 'text-red-600' }], progress: 50 },
  { id: 'eng-004', name: 'S2C — Contract Review', type: 'Compliance', typeLabel: 'Compliance', description: 'Source-to-Contract compliance and authorization audit.', status: 'Planned', statusTone: 'bg-paper-100 text-ink-600', owner: 'Rohan Patel', process: 'Source to Contract', period: 'Apr 2026 – Sep 2026', metrics: [{ label: 'Controls', value: 8 }, { label: 'Tested', value: 0 }, { label: 'Deficiencies', value: 0 }], progress: 0 },
  // Internal Audit
  { id: 'ia-001', name: 'P2P Process Review', type: 'Internal Audit', typeLabel: 'Audit Assignment', description: 'Internal audit of procure-to-pay process controls.', status: 'In Progress', statusTone: 'bg-evidence-50 text-evidence-700', owner: 'Karan Mehta', reviewer: 'Sneha Desai', process: 'Procure to Pay', entity: 'Corporate', period: 'Jan 2026 – Jun 2026', metrics: [{ label: 'Observations', value: 3 }, { label: 'Open', value: 2, color: 'text-amber-600' }, { label: 'Actions Due', value: 0 }] },
  { id: 'ia-002', name: 'Vendor Onboarding Audit', type: 'Internal Audit', typeLabel: 'Audit Assignment', description: 'Vendor onboarding process and compliance review.', status: 'Observations Drafted', statusTone: 'bg-mitigated-50 text-mitigated-700', owner: 'Tushar Goel', process: 'Vendor Management', entity: 'Corporate', period: 'Feb 2026 – Jul 2026', metrics: [{ label: 'Observations', value: 5 }, { label: 'Open', value: 3, color: 'text-amber-600' }, { label: 'Actions Due', value: 1, color: 'text-red-600' }] },
  { id: 'ia-003', name: 'Inventory Management Review', type: 'Internal Audit', typeLabel: 'Audit Assignment', description: 'Plant-level inventory controls and cycle count audit.', status: 'Discussion Pending', statusTone: 'bg-brand-50 text-brand-700', owner: 'Neha Joshi', process: 'Inventory', entity: 'Plant — Pune', period: 'Mar 2026 – Aug 2026', metrics: [{ label: 'Observations', value: 4 }, { label: 'Open', value: 1, color: 'text-amber-600' }, { label: 'Actions Due', value: 2, color: 'text-red-600' }] },
  { id: 'ia-004', name: 'Payroll Process Audit', type: 'Internal Audit', typeLabel: 'Audit Assignment', description: 'HR payroll processing controls and compliance.', status: 'Final Report Pending', statusTone: 'bg-high-50 text-high-700', owner: 'Rohan Patel', process: 'HR & Payroll', entity: 'Corporate', period: 'Dec 2025 – May 2026', metrics: [{ label: 'Observations', value: 6 }, { label: 'Open', value: 0 }, { label: 'Actions Due', value: 3, color: 'text-red-600' }] },
  // Automation
  { id: 'auto-001', name: 'Duplicate Invoice Monitoring', type: 'Automation', typeLabel: 'Project', description: 'Detect and flag duplicate invoices across vendor ledgers using automated matching.', status: 'Active', statusTone: 'bg-compliant-50 text-compliant-700', owner: 'Karan Mehta', process: 'Procure to Pay', period: 'Recurring', metrics: [{ label: 'Workflows', value: 4 }, { label: 'Exceptions', value: 5, color: 'text-amber-600' }, { label: 'Cases', value: 3 }] },
  { id: 'auto-002', name: 'Vendor Master Monitoring', type: 'Automation', typeLabel: 'Project', description: 'Monitor vendor master data changes and flag unauthorized modifications.', status: 'Active', statusTone: 'bg-compliant-50 text-compliant-700', owner: 'Tushar Goel', process: 'Vendor Management', period: 'Recurring', metrics: [{ label: 'Workflows', value: 3 }, { label: 'Exceptions', value: 1 }, { label: 'Cases', value: 0 }] },
  { id: 'auto-003', name: 'Payment Control Monitoring', type: 'Automation', typeLabel: 'Project', description: 'Validate payment batches against authorization limits and split payments.', status: 'Scheduled', statusTone: 'bg-blue-50 text-blue-700', owner: 'Neha Joshi', process: 'Procure to Pay', period: 'Monthly', metrics: [{ label: 'Workflows', value: 2 }, { label: 'Exceptions', value: 0 }, { label: 'Cases', value: 0 }] },
];

const TYPE_ICON: Record<string, React.ElementType> = { 'Compliance': Shield, 'Internal Audit': ClipboardCheck, 'Automation': Workflow };
const TYPE_COLORS: Record<string, string> = { 'Compliance': 'text-primary', 'Internal Audit': 'text-purple-600', 'Automation': 'text-emerald-600' };
const TYPE_BG: Record<string, string> = { 'Compliance': 'bg-primary/10', 'Internal Audit': 'bg-purple-100', 'Automation': 'bg-emerald-100' };
const TYPE_BADGE: Record<string, string> = { 'Compliance': 'bg-primary/10 text-primary', 'Internal Audit': 'bg-purple-50 text-purple-700', 'Automation': 'bg-emerald-50 text-emerald-700' };

export type { LibraryEngagement, EngagementType };

interface Props {
  onOpenEngagement: (engagement: LibraryEngagement) => void;
  onPlanEngagement: () => void;
}

export default function EngagementLibraryView({ onOpenEngagement, onPlanEngagement }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EngagementType>('All');

  const filtered = useMemo(() => {
    let list = MOCK_ENGAGEMENTS;
    if (typeFilter !== 'All') list = list.filter(e => e.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.owner.toLowerCase().includes(q) || e.process.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    return list;
  }, [typeFilter, search]);

  const counts = {
    all: MOCK_ENGAGEMENTS.length,
    compliance: MOCK_ENGAGEMENTS.filter(e => e.type === 'Compliance').length,
    ia: MOCK_ENGAGEMENTS.filter(e => e.type === 'Internal Audit').length,
    automation: MOCK_ENGAGEMENTS.filter(e => e.type === 'Automation').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Engagement Library</h1>
          <p className="text-sm text-text-secondary mt-1">Browse all engagements — compliance audits, internal audits, and automation projects.</p>
        </div>
        <button onClick={onPlanEngagement}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm">
          <Plus size={14} />Plan Engagement
        </button>
      </div>

      {/* Search + Type Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search engagements, owner, framework, or code..."
            className="w-full pl-9 pr-4 h-9 rounded-md border border-border-light bg-white text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { key: 'All' as EngagementType, label: 'All', count: counts.all },
            { key: 'Compliance' as EngagementType, label: 'Compliance', count: counts.compliance },
            { key: 'Internal Audit' as EngagementType, label: 'Internal Audit', count: counts.ia },
            { key: 'Automation' as EngagementType, label: 'Automation', count: counts.automation },
          ]).map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all ${
                typeFilter === f.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-brand-50'
              }`}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Engagement Table */}
      <div className="rounded-xl border border-border-light bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left">Engagement</th>
              <th className="px-4 py-2.5 text-center w-[120px]">Type</th>
              <th className="px-4 py-2.5 text-left w-[140px]">Process</th>
              <th className="px-4 py-2.5 text-left w-[120px]">Owner</th>
              <th className="px-4 py-2.5 text-center w-[120px]">Status</th>
              <th className="px-4 py-2.5 text-center w-[220px]">Metrics</th>
              <th className="px-4 py-2.5 text-left w-[130px]">Period</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((eng, i) => {
                const Icon = TYPE_ICON[eng.type] || Shield;
                return (
                  <motion.tr
                    key={eng.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => onOpenEngagement(eng)}
                    className="border-b border-border-light/50 hover:bg-primary/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${TYPE_BG[eng.type]} flex items-center justify-center shrink-0`}>
                          <Icon size={16} className={TYPE_COLORS[eng.type]} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-text group-hover:text-primary transition-colors truncate">{eng.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[300px]">{eng.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${TYPE_BADGE[eng.type]}`}>{eng.typeLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{eng.process}</td>
                    <td className="px-4 py-3">
                      <div className="text-text font-medium">{eng.owner}</div>
                      {eng.reviewer && <div className="text-[10px] text-gray-400">{eng.reviewer}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${eng.statusTone}`}>{eng.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        {eng.metrics.map(m => (
                          <div key={m.label} className="text-center">
                            <div className={`text-[13px] font-bold tabular-nums ${m.color || 'text-text'}`}>{m.value}</div>
                            <div className="text-[8px] text-gray-400">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-[11px]">
                      <span className="flex items-center gap-1"><Calendar size={10} />{eng.period}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[13px] text-text-muted">No engagements match your search.</div>
        )}
      </div>
    </div>
  );
}
