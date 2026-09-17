import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import ListToolbar, { ToolbarViewToggle } from '../../../shared/ListToolbar';
import ColumnFilter from '../../../shared/ColumnFilter';
import ReportCard from '../../../shared/ReportCard';
import InfiniteCardGrid from '../../../shared/InfiniteCardGrid';
import SmartTable from '../../../shared/SmartTable';
import EmptyState from '../../../shared/EmptyState';
import ConfirmDialog from '../../ConfirmDialog';
import type { LucideIcon } from 'lucide-react';
import type { ExtractionSession } from '../types';

// The fields a report can be filtered by — the user chooses which are shown as
// global filters (the "Fields" picker). Every option is drawn from the reports
// actually present, so we never offer a value that matches nothing.
const FILTER_FIELDS: { key: string; label: string; get: (s: ExtractionSession) => string | undefined }[] = [
  { key: 'section', label: 'Section', get: s => s.meta.section },
  { key: 'reviewType', label: 'Review type', get: s => s.meta.reviewType },
  { key: 'auditLocation', label: 'Audit location', get: s => s.meta.auditLocation },
  { key: 'region', label: 'Region', get: s => s.meta.region },
  { key: 'location', label: 'Location', get: s => s.meta.location },
  { key: 'auditFunction', label: 'Function', get: s => s.meta.auditFunction },
  { key: 'financialYear', label: 'Financial year', get: s => s.meta.financialYear },
  { key: 'auditEntity', label: 'Audit entity', get: s => s.meta.auditEntity },
  { key: 'auditSpoc', label: 'Audit SPOC', get: s => s.meta.auditSpoc },
];
const DEFAULT_FILTER_KEYS = ['section', 'reviewType', 'auditFunction', 'financialYear'];
// Compact column headers for the list view.
const COL_LABEL: Record<string, string> = { financialYear: 'FY', auditFunction: 'Function', auditLocation: 'Location', auditEntity: 'Entity', auditSpoc: 'SPOC' };

export interface ReportRowView {
  icon: LucideIcon;
  iconClass: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  description?: string;
  pills: string[];
  /** Grid card badge (status chip) and footer, plus the list-view status cell. */
  badge?: ReactNode;
  footerRight?: ReactNode;
  statusCell?: ReactNode;
}

const loadJson = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const saveJson = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } };

/** Shared browser for the extracted-reports and generated-ATR lists: a search
 *  box + user-selectable global filters + grid/list toggle, mirroring the
 *  Reports module. The caller maps each session to a `view` (card/row visuals)
 *  and owns which sessions to show. */
export default function ReportBrowser({
  sessions, activeId, onOpen, onRemove, searchPlaceholder,
  view, nameLabel = 'Report', statusLabel, empty, emptyFilteredTitle, storageKey,
}: {
  sessions: ExtractionSession[];
  activeId: string | null;
  onOpen: (id: string) => void;
  /** Delete a row. The browser asks the user to confirm first — this fires
   *  only once they have. */
  onRemove?: (id: string) => void;
  searchPlaceholder: string;
  view: (s: ExtractionSession) => ReportRowView;
  /** Header label for the list-view name column. */
  nameLabel?: string;
  /** Header label for the list-view status column. */
  statusLabel: string;
  empty: { icon: LucideIcon; title: string; body: string; action?: ReactNode };
  emptyFilteredTitle: string;
  /** localStorage prefix for this list's remembered filters + view mode. */
  storageKey: string;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [enabledKeys, setEnabledKeys] = useState<string[]>(() => loadJson(`${storageKey}.filters`, DEFAULT_FILTER_KEYS));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => loadJson(`${storageKey}.view`, 'list'));

  const setEnabled = (labels: string[]) => {
    const keys = FILTER_FIELDS.filter(f => labels.includes(f.label)).map(f => f.key);
    setEnabledKeys(keys); saveJson(`${storageKey}.filters`, keys);
  };
  const setView = (m: 'grid' | 'list') => { setViewMode(m); saveJson(`${storageKey}.view`, m); };
  const setFilter = (key: string, vals: string[]) => setSelected(prev => ({ ...prev, [key]: vals }));

  // Options per field come from the sessions present.
  const optionsFor = (key: string) => {
    const f = FILTER_FIELDS.find(x => x.key === key)!;
    return [...new Set(sessions.map(f.get).map(v => v?.trim()).filter((v): v is string => !!v))].sort();
  };

  const activeFields = FILTER_FIELDS.filter(f => enabledKeys.includes(f.key));

  const searchText = (s: ExtractionSession) => {
    const v = view(s);
    return [v.title, s.meta.auditEntity, s.meta.reportNumber, s.meta.preparedBy, s.meta.auditTitle]
      .filter(Boolean).join(' ').toLowerCase();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...sessions].reverse().filter(s => {
      for (const f of activeFields) {
        const sel = selected[f.key];
        if (sel && sel.length && !sel.includes((f.get(s) ?? '').trim())) return false;
      }
      if (q && !searchText(s).includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, search, selected, enabledKeys]);

  const activeFilterCount = Object.values(selected).reduce((n, v) => n + v.length, 0);
  const hasQueryOrFilter = !!search.trim() || activeFilterCount > 0;

  // Deleting is destructive (the extracted observations go with the report), so
  // the trash button only stages the row; the confirm dialog does the removing.
  const [pendingRemove, setPendingRemove] = useState<ExtractionSession | null>(null);
  const deleteBtn = (s: ExtractionSession) => onRemove && (
    <button
      onClick={e => { e.stopPropagation(); setPendingRemove(s); }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-200 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
      aria-label={`Delete ${view(s).title}`}
      title="Delete"
    >
      <Trash2 size={14} />
    </button>
  );
  const confirmRemove = () => {
    if (pendingRemove) onRemove?.(pendingRemove.id);
    setPendingRemove(null);
  };
  const pendingObs = pendingRemove?.observations.length ?? 0;

  return (
    <div>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder={searchPlaceholder}
        trailing={
          <>
            {/* Grid / list toggle, sitting right next to the search box. */}
            <ToolbarViewToggle mode={viewMode} onChange={setView} />
            {activeFields.map(f => {
              const opts = optionsFor(f.key);
              if (opts.length === 0) return null;
              return (
                <ColumnFilter
                  key={f.key}
                  variant="button" icon selectIndicator="checkbox"
                  label={f.label}
                  options={opts}
                  value={selected[f.key] ?? []}
                  onChange={vals => setFilter(f.key, vals)}
                  align="end"
                />
              );
            })}
            {/* Pick which fields are used as global filters. */}
            <ColumnFilter
              variant="button" icon selectIndicator="checkbox"
              label="Fields"
              options={FILTER_FIELDS.map(f => f.label)}
              value={activeFields.map(f => f.label)}
              onChange={setEnabled}
              align="end"
            />
          </>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} body={empty.body} action={empty.action} size="compact" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={empty.icon} title={emptyFilteredTitle} body="Try a different search, or clear the filters above." size="compact" />
      ) : viewMode === 'grid' ? (
        <InfiniteCardGrid
          items={filtered}
          resetKey={`${search}-${JSON.stringify(selected)}-${enabledKeys.join()}`}
          renderItem={(s, i) => {
            const v = view(s);
            return (
              <ReportCard
                key={s.id}
                index={i}
                icon={v.icon}
                iconClass={v.iconClass}
                eyebrow={v.eyebrow}
                title={v.title}
                subtitle={v.subtitle}
                description={v.description}
                pills={v.pills}
                accent={s.id === activeId ? 'bg-brand-500' : undefined}
                badge={v.badge}
                footerRight={v.footerRight}
                onClick={() => onOpen(s.id)}
                actions={deleteBtn(s) || undefined}
              />
            );
          }}
        />
      ) : (
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated overflow-clip">
          <SmartTable
            variant="modern"
            dense
            fixedLayout
            searchable={false}
            hideResultCount
            data={filtered as unknown as Record<string, unknown>[]}
            keyField="id"
            onRowClick={item => onOpen((item as unknown as ExtractionSession).id)}
            columns={[
              { key: 'name', label: nameLabel, truncate: true, render: item => {
                const s = item as unknown as ExtractionSession; const v = view(s); const Icon = v.icon;
                return (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${v.iconClass}`}><Icon size={15} strokeWidth={1.75} /></span>
                    <div className="min-w-0">
                      <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{v.title}</div>
                      {v.subtitle && <div className="text-[0.71875rem] text-ink-500 truncate">{v.subtitle}</div>}
                    </div>
                  </div>
                );
              }},
              // One column per field the user has enabled as a global filter —
              // uniform width for even spacing, left-aligned under the header.
              ...activeFields.map(f => ({
                key: f.key,
                label: COL_LABEL[f.key] ?? f.label,
                width: '150px',
                render: (item: Record<string, unknown>) => {
                  const val = f.get(item as unknown as ExtractionSession)?.trim();
                  return <span className="text-[0.75rem] text-ink-700 truncate block" title={val || undefined}>{val || '—'}</span>;
                },
              })),
              // Extracted / Generated — same uniform width + left alignment as the
              // field columns so every column lines up under its header.
              { key: 'status', label: statusLabel, width: '150px', render: (item: Record<string, unknown>) => <div className="text-left">{view(item as unknown as ExtractionSession).statusCell}</div> },
              ...(onRemove ? [{ key: 'actions', label: '', width: '56px', sortable: false, align: 'right' as const, render: (item: Record<string, unknown>) => <div className="flex justify-end">{deleteBtn(item as unknown as ExtractionSession)}</div> }] : []),
            ]}
          />
        </div>
      )}

      {hasQueryOrFilter && filtered.length > 0 && (
        <p className="pt-2 text-[0.6875rem] text-ink-400 tabular-nums">Showing {filtered.length} of {sessions.length}</p>
      )}

      {/* Delete re-confirmation — names the report and what goes with it.
          Portalled to the body: this browser sits inside the Create Report
          modal, whose transformed, overflow-hidden panel would otherwise trap
          and clip the fixed dialog. */}
      {createPortal(
      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        title="Delete this extracted report?"
        description={pendingRemove ? (
          <>
            <span className="font-semibold text-ink-800">“{view(pendingRemove).title}”</span> and its {pendingObs} extracted observation{pendingObs === 1 ? '' : 's'} will be removed from this list. This can't be undone.
            {pendingRemove.generatedAt && <> The Action Taken Report already generated from it stays in Reports.</>}
          </>
        ) : ''}
        confirmLabel="Delete"
        destructive
      />,
      document.body,
      )}
    </div>
  );
}
