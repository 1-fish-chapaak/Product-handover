import { useEffect, useRef, useState } from 'react';
import { mockSchemaDiff, type DashboardFileSource, type SchemaDiff } from '../../../data/dashboardUpdate';
import type { PoolFile } from './useFilePool';

export type ReplaceStatus = 'idle' | 'validating' | 'ready' | 'incompatible';

export interface ReplaceState {
  status: ReplaceStatus;
  fileName?: string;
  newSourceId?: string;
  diff?: SchemaDiff;
}

export interface AppliedReplacement { datasetId: string; newName: string }

export interface FileReplacements {
  replacements: Record<string, ReplaceState>;
  /** Assign a ready pool file to a source row and run the column check. */
  assign: (source: DashboardFileSource, poolFile: PoolFile) => void;
  clear: (datasetId: string) => void;
  /** Drop every prepared replacement built on a removed pool file. */
  clearBySource: (sourceId: string) => void;
  /** A row is mid-check — Save waits for it to settle. */
  busy: boolean;
  readyCount: number;
  applying: boolean;
  /** Apply every ready row. Resolves with what was swapped. */
  apply: () => Promise<AppliedReplacement[]>;
}

/** Per-dataset replacement prep for Upload Data. Only PREPARES rows (assign +
 *  validate); `apply` is the Save — a pointer swap, no run. */
export function useFileReplacements(): FileReplacements {
  const [replacements, setReplacements] = useState<Record<string, ReplaceState>>({});
  const [applying, setApplying] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); };
  }, []);

  const assign = (source: DashboardFileSource, poolFile: PoolFile) => {
    const id = source.datasetId;
    setReplacements(prev => ({ ...prev, [id]: { status: 'validating', fileName: poolFile.name, newSourceId: poolFile.sourceId } }));
    const t = window.setTimeout(() => {
      const diff = mockSchemaDiff(source.columns, poolFile.name);
      setReplacements(prev => {
        const cur = prev[id];
        // The row was cleared or re-assigned while the check ran.
        if (!cur || cur.newSourceId !== poolFile.sourceId) return prev;
        return { ...prev, [id]: { ...cur, status: diff.compatible ? 'ready' : 'incompatible', diff } };
      });
    }, 900);
    timers.current.push(t);
  };

  const clear = (datasetId: string) => setReplacements(prev => {
    const next = { ...prev };
    delete next[datasetId];
    return next;
  });

  const clearBySource = (sourceId: string) => setReplacements(prev =>
    Object.fromEntries(Object.entries(prev).filter(([, s]) => s.newSourceId !== sourceId)));

  const apply = async (): Promise<AppliedReplacement[]> => {
    const prepared = Object.entries(replacements)
      .filter(([, s]) => s.status === 'ready' && s.fileName)
      .map(([datasetId, s]) => ({ datasetId, newName: s.fileName as string }));
    if (prepared.length === 0 || applying) return [];
    setApplying(true);
    await new Promise(r => setTimeout(r, 1200));
    setReplacements(prev => {
      const next = { ...prev };
      prepared.forEach(p => { delete next[p.datasetId]; });
      return next;
    });
    setApplying(false);
    return prepared;
  };

  const states = Object.values(replacements);
  return {
    replacements,
    assign,
    clear,
    clearBySource,
    busy: states.some(s => s.status === 'validating'),
    readyCount: states.filter(s => s.status === 'ready').length,
    applying,
    apply,
  };
}
