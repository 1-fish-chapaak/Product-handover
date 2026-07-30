/**
 * The report book, read live.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The generated-report list is not a constant. `GENERATED_REPORTS` in mockData
 * is only the *seed*; the list the user actually has is persisted under
 * GENERATED_REPORTS_KEY and grows every time they generate a report or finish a
 * bulk run. ReportsView owns and writes it.
 *
 * Anything that reports *about* reports — Platform Usage in particular — must
 * read that same live list, not the seed. Importing `GENERATED_REPORTS` directly
 * means a report the user generated five minutes ago is invisible on the usage
 * page, which makes the page quietly wrong the moment anyone uses the product.
 *
 * This hook is the read seam. Same shape as `useKnowledgeSources` — one file to
 * replace when a real backend lands (GET /api/reports), and no other consumer
 * changes.
 *
 * ─── Today ──────────────────────────────────────────────────────────────────
 * Reads localStorage on mount, falling back to the seed when nothing is stored
 * (first visit) or the blob is unreadable. Writes still belong to ReportsView —
 * this is deliberately read-only, so there is exactly one writer.
 *
 * It re-reads on `storage` events (another tab) and on `focus` (the user came
 * back after generating something), so navigating between Reports and Platform
 * Usage always shows the same book.
 */

import { useCallback, useEffect, useState } from 'react';
import { GENERATED_REPORTS, GENERATED_REPORTS_KEY } from '../data/mockData';
import type { GeneratedReport } from '../components/reports/reportShared';

function readReports(): GeneratedReport[] {
  try {
    const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // ReportsView hides placeholder rows the same way; match it, or the two
        // screens disagree on how many reports exist.
        return (parsed as GeneratedReport[]).filter(r => !(r as { isEmpty?: boolean }).isEmpty);
      }
    }
  } catch {
    // Unreadable blob — fall through to the seed rather than blanking the page.
  }
  return [...GENERATED_REPORTS] as GeneratedReport[];
}

export function useGeneratedReports(): GeneratedReport[] {
  const [reports, setReports] = useState<GeneratedReport[]>(readReports);

  const refresh = useCallback(() => setReports(readReports()), []);

  useEffect(() => {
    // `storage` only fires for *other* tabs, so `focus` covers the common case:
    // generate a report, come back to this page, see it counted.
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return reports;
}
