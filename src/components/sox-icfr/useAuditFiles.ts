import { useMemo } from 'react';
import { useIcfr } from './store';
import { programmeFor } from './auditScope';
import { controlsUsingFile, defaultFileOrigin, fileOriginOf, guessFileKind, populationSources } from './helpers';
import type { AuditFileRecord, Control } from './types';

/** A file record as everything downstream reads it: the file's own facts, its
 *  provenance, and which controls have drawn a population off it. */
export interface AuditFile extends AuditFileRecord {
  usedBy: Control[];
  /** True where the record came out of the registry rather than being derived —
   *  i.e. somebody uploaded it through the app or corrected its answer. */
  recorded: boolean;
}

/**
 * Every file this audit holds, with provenance attached — ONE list, read by the
 * population step's source picker, by the file registry on Configuration, and by
 * the working paper.
 *
 * Two sources are merged, and the order matters:
 *
 *  1. DERIVED — the trial balances and general ledger the engagement was scoped
 *     against, and the RACM / SOP uploads. These pre-date the provenance rule,
 *     so each takes the default its kind implies (see defaultFileOrigin) and can
 *     be corrected on its file record like any other.
 *
 *  2. REGISTERED — anything uploaded through the app, and any answer somebody
 *     has changed. A registry entry always wins: it is the record of what a
 *     human actually said, and a default must never overwrite that.
 *
 * Provenance is never read off a population. A population names its source file
 * and inherits whatever that file says today — which is what makes correcting a
 * file record reach all forty controls that used it.
 */
export function useAuditFiles(): AuditFile[] {
  const { eng, racmDocs, openAuditId } = useIcfr();
  return useMemo(() => {
    // programmeFor, not PROGRAMMES: the Altura group's record lives in the V2
    // store, and reading only the classic one leaves this list empty.
    const prog = programmeFor(eng.id);
    const audit = eng.audits.find(a => a.id === openAuditId);
    const derived: AuditFileRecord[] = [];
    const add = (name: string, kind: string, rows: number, from: string, by: string) => {
      derived.push({ name, kind, rows, from, uploadedBy: by, uploadedAt: 'at scoping', origin: defaultFileOrigin(kind) });
    };
    audit?.files.forEach(f => add(
      f.name, f.kind === 'tb' ? 'Trial balance' : 'General ledger',
      f.kind === 'tb' ? 1240 : 18432, `${audit.period} audit`, audit.by,
    ));
    prog?.entities.forEach((en: { name: string; tbFile?: string; tbLines?: number }) => {
      if (en.tbFile) add(en.tbFile, 'Trial balance', en.tbLines ?? 1240, `${en.name} · engagement scoping`, eng.preparer);
    });
    if (prog) add(`general_ledger_${prog.fy}.csv`, 'General ledger', 18432, 'Engagement scoping', eng.preparer);
    racmDocs.forEach(d => add(d.name, 'RACM / SOP', 480, d.process ? `${d.process} RACM` : 'RACM page', eng.preparer));
    // Files a population already names as its source. A registry that leaves out
    // the file forty controls are actually reading is not a registry — and a
    // population seeded with the system it was pulled from has already answered
    // the question, so it lands answered rather than blocking work that is done.
    eng.controls.forEach(c => {
      const p = c.operating.population;
      if (!p) return;
      // Every file the population stands on. A control drawing off a ledger and
      // a vendor master names two, and leaving the second out of the registry
      // would hide a file the audit is demonstrably reading.
      populationSources(c).forEach(s => {
        if (!s.file) return;
        derived.push({
          name: s.file, kind: guessFileKind(s.file), rows: s.rows || s.count,
          from: p.source, uploadedBy: p.provenance?.extractedBy || eng.preparer, uploadedAt: p.provenance?.extractedOn || 'at scoping',
          origin: fileOriginOf(eng, s.file, p.provenance?.system).origin,
        });
      });
    });

    // Files an ATTRIBUTE's workflow reads. They are files the audit holds by any
    // reading — a workflow runs on them and a validation is recorded against
    // them — and leaving them out meant the population step could not offer the
    // very files the call says it should ("वर्कफ्लो लिंकिंग में जो इनपुट फाइल्स
    // हैं, वो सारी फाइल्स की लिस्ट").
    eng.controls.forEach(c => {
      c.operating.steps.forEach(s => {
        if (!s.inputFile?.name) return;
        const name = s.inputFile.name;
        // A PDF has no rows to count, so it is given none — the row count is
        // suppressed downstream by name, and a fabricated number here would be
        // a number somebody has to explain. Structured files get a stable one.
        const rows = /\.pdf$/i.test(name)
          ? 0
          : 400 + (name.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 4200);
        derived.push({
          name, kind: guessFileKind(name), rows,
          from: `${s.workflowName ?? 'Workflow'} · ${c.id}`,
          uploadedBy: s.inputFile.uploadedBy || eng.preparer, uploadedAt: s.inputFile.uploadedAt || 'at scoping',
          origin: fileOriginOf(eng, name).origin,
        });
      });
    });

    const registry = eng.fileRegistry ?? [];
    const out: AuditFile[] = [];
    const seen = new Set<string>();
    // A file can reach the derived list twice (an audit TB that is also the
    // scoping TB), so the first mention wins and the rest are dropped.
    for (const d of derived) {
      if (seen.has(d.name)) continue;
      seen.add(d.name);
      const rec = registry.find(r => r.name === d.name);
      out.push({
        ...d,
        // ONLY the provenance travels from the registry onto a derived file. A
        // record can exist purely because somebody corrected the answer on a
        // scoping file, and that record's placeholder facts must not overwrite
        // the row count, kind and origin story the engagement actually holds.
        ...(rec ? { origin: rec.origin, systemFetched: rec.systemFetched, originBy: rec.originBy, originAt: rec.originAt } : {}),
        usedBy: controlsUsingFile(eng, d.name),
        recorded: !!rec,
      });
    }
    // Registered files the engagement doesn't derive — the ones a control
    // uploaded. They are in the registry precisely so every other control can
    // reuse them without being asked where they came from again.
    for (const r of registry) {
      if (seen.has(r.name)) continue;
      seen.add(r.name);
      out.push({ ...r, usedBy: controlsUsingFile(eng, r.name), recorded: true });
    }
    return out;
  }, [eng, racmDocs, openAuditId]);
}

/** One file by name — what a population's source line reads to show where its
 *  data came from without holding a copy of the answer. */
export function useAuditFile(name?: string): AuditFile | undefined {
  const files = useAuditFiles();
  return name ? files.find(f => f.name === name) : undefined;
}
