import { FileText, Plus, FileStack, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../shared/Button';
import ReportBrowser, { type ReportRowView } from '../components/ReportBrowser';
import { hasUnresolved } from '../observationFields';
import type { ExtractionSession } from '../types';

function reportTitle(s: ExtractionSession): string {
  return s.meta.reportName?.trim() || s.meta.auditTitle?.trim() || s.file?.filename || 'Untitled report';
}

// ISO → "DD Mon YYYY, HH:MM" (the extraction time).
function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** The "Observations Extracted" tab — every report extracted this visit, in the
 *  Reports-module grid/list UX (search + selectable global filters + view
 *  toggle). Opening a card shows the report's observations + details. */
export default function ReportsExtractedList({ sessions, activeId, onOpen, onRemove, onUploadAnother }: {
  sessions: ExtractionSession[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onUploadAnother: () => void;
}) {
  const view = (s: ExtractionSession): ReportRowView => {
    const obs = s.observations;
    const issues = obs.filter(hasUnresolved).length;
    const selected = obs.filter(o => o.selected).length;
    const status = issues > 0 ? (
      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.6875rem] font-semibold whitespace-nowrap shrink-0">
        <AlertTriangle size={11} aria-hidden="true" /> {issues} to review
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-compliant-50 text-compliant-700 text-[0.6875rem] font-semibold whitespace-nowrap shrink-0">
        <CheckCircle2 size={11} aria-hidden="true" /> {selected} selected
      </span>
    );
    return {
      icon: FileText,
      iconClass: s.meta.section === 'Assurance' ? 'bg-evidence-50 text-evidence-700' : 'bg-brand-50 text-brand-700',
      eyebrow: s.meta.section || 'Report',
      title: reportTitle(s),
      subtitle: [s.meta.reviewType, s.meta.auditLocation].filter(Boolean).join(' · ') || undefined,
      description: s.meta.auditEntity || undefined,
      pills: [s.meta.financialYear, s.meta.reportNumber].filter((p): p is string => !!p),
      badge: status,
      footerRight: <span className="text-[0.6875rem] tabular-nums text-ink-400">{obs.length} obs · {Math.round(s.confidence * 100)}%</span>,
      // List view shows when the report was extracted (date + time).
      statusCell: <span className="text-[0.71875rem] tabular-nums text-ink-500 whitespace-nowrap">{fmtDateTime(s.completedAt ?? s.startedAt)}</span>,
    };
  };

  return (
    <ReportBrowser
      sessions={sessions}
      activeId={activeId}
      onOpen={onOpen}
      onRemove={onRemove}
      searchPlaceholder="Search by title, entity, report number…"
      view={view}
      nameLabel="Observations Extracted"
      statusLabel="Extracted"
      emptyFilteredTitle="No reports match your filters."
      storageKey="irame.atr-extracted"
      empty={{
        icon: FileStack,
        title: 'No observations extracted yet',
        body: "Upload a report on the Upload tab — once it's extracted, its observations appear here.",
        action: <Button variant="primary" size="md" leftIcon={<Plus size={15} />} onClick={onUploadAnother}>Upload a report</Button>,
      }}
    />
  );
}
