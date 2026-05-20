// Upstream depends on `UiAuditResult.kpis` flowing in from the QnA adapter;
// the prototype mocks responses, so the fixture here mirrors AUDIT_RESULT.kpis
// in ChatView.tsx — the same shape (label / value / color) the upstream uses.
// `color` is accepted for backward compatibility with existing payloads but
// is intentionally ignored: KPIs render through the canonical KpiTile so
// chat, dashboard, and workspace surfaces stay visually identical.

import { KpiTile } from '../shared/KpiTile';

interface KPI {
  label: string;
  value: string;
  color?: string;
}

interface Props {
  kpis?: KPI[];
}

const DEFAULT_KPIS: KPI[] = [
  { label: 'Records scanned', value: '1.2M' },
  { label: 'Duplicates found', value: '8' },
  { label: 'Total amount', value: '₹6.16L' },
  { label: 'Highest match', value: '96%' },
];

export default function OutputConfigTab({ kpis = DEFAULT_KPIS }: Props) {
  return (
    <div className="space-y-6 pt-4">
      <section>
        <header className="mb-4">
          <h3 className="text-[14px] font-semibold text-ink-800 leading-tight">Dashboard KPIs</h3>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            From the latest audit run
          </p>
        </header>

        {kpis.length === 0 ? (
          <p className="text-[12.5px] text-ink-500">
            Run a query once to populate dashboard KPIs from the latest result.
          </p>
        ) : (
          <div
            className={`grid gap-4 ${
              kpis.length >= 4
                ? 'grid-cols-2'
                : kpis.length === 3
                  ? 'grid-cols-3'
                  : kpis.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
            }`}
          >
            {kpis.map((kpi, ki) => (
              <KpiTile key={`${kpi.label}-${ki}`} label={kpi.label} value={kpi.value} index={ki} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
