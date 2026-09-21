import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

/** One entry of the shared file pool. A multi-sheet workbook fans out into one
 *  "file.xlsx [Sheet]" entry per picked sheet. */
export interface PoolFile {
  sourceId: string;
  name: string;
  status: 'processing' | 'ready' | 'failed';
  error?: string;
}

export interface SheetPickerItem {
  file: File;
  sheets: string[];
}

export interface FilePool {
  pool: PoolFile[];
  readyPool: PoolFile[];
  failedPool: PoolFile[];
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (sourceId: string) => void;
  /** Clears the whole pool — after a save or a started batch, wizard-style. */
  reset: () => void;
  isUploading: boolean;
  uploadError: string | null;
  /** Head of the multi-sheet picker queue (one modal per workbook). */
  sheetPicker: SheetPickerItem | null;
  sheetPickerPosition: { current: number; total: number } | null;
  confirmPickedSheets: (sheetNames: string[]) => void;
  cancelSheetPicker: () => void;
}

const XLSX_LIKE = /\.(xlsx|xls)$/i;
// Demo: a file whose name says "corrupt" fails ingestion, so the failed chip
// and its reason line are reachable without a real bad file.
const FAILS_INGEST = /corrupt/i;

let poolSeq = 0;

/** Owns the Upload Data / Run Workflows file pool: pick many files at once,
 *  each becomes a chip that "processes" for a moment and settles ready (or
 *  failed). Multi-sheet workbooks are read client-side (sheet names only) and
 *  queued through the sheet picker; everything else lands directly. */
export function useFilePool(): FilePool {
  const [pool, setPool] = useState<PoolFile[]>([]);
  const [picker, setPicker] = useState<{ queue: SheetPickerItem[]; done: number }>({ queue: [], done: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); };
  }, []);

  const register = (names: string[]) => {
    const entries: PoolFile[] = names.map(name => ({ sourceId: `pf-${++poolSeq}`, name, status: 'processing' }));
    setPool(prev => [...prev, ...entries]);
    entries.forEach((entry, i) => {
      const t = window.setTimeout(() => {
        const failed = FAILS_INGEST.test(entry.name);
        setPool(prev => prev.map(p => p.sourceId === entry.sourceId
          ? { ...p, status: failed ? 'failed' : 'ready', error: failed ? 'This file couldn’t be processed — it looks password-protected or corrupted.' : undefined }
          : p));
      }, 900 + i * 350);
      timers.current.push(t);
    });
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    const direct: string[] = [];
    const needPicker: SheetPickerItem[] = [];
    for (const file of files) {
      if (XLSX_LIKE.test(file.name)) {
        try {
          const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', bookSheets: true });
          if (wb.SheetNames.length > 1) { needPicker.push({ file, sheets: wb.SheetNames }); continue; }
        } catch {
          // Unparseable → upload directly; the (mock) ingestion decides.
        }
      }
      direct.push(file.name);
    }
    await new Promise(r => setTimeout(r, 450));
    register(direct);
    if (needPicker.length > 0) {
      setPicker(prev => ({ queue: [...prev.queue, ...needPicker], done: prev.queue.length === 0 ? 0 : prev.done }));
    }
    setIsUploading(false);
  };

  const dequeue = () => setPicker(prev => {
    const queue = prev.queue.slice(1);
    return queue.length === 0 ? { queue, done: 0 } : { queue, done: prev.done + 1 };
  });

  const confirmPickedSheets = (sheetNames: string[]) => {
    const head = picker.queue[0];
    if (!head) return;
    dequeue();
    if (sheetNames.length > 0) register(sheetNames.map(s => `${head.file.name} [${s}]`));
  };

  const removeFile = (sourceId: string) => setPool(prev => prev.filter(p => p.sourceId !== sourceId));

  const reset = () => {
    setPool([]);
    setPicker({ queue: [], done: 0 });
    setUploadError(null);
  };

  return {
    pool,
    readyPool: pool.filter(p => p.status === 'ready'),
    failedPool: pool.filter(p => p.status === 'failed'),
    addFiles,
    removeFile,
    reset,
    isUploading,
    uploadError,
    sheetPicker: picker.queue[0] ?? null,
    sheetPickerPosition: picker.queue.length > 0
      ? { current: picker.done + 1, total: picker.done + picker.queue.length }
      : null,
    confirmPickedSheets,
    cancelSheetPicker: dequeue,
  };
}
