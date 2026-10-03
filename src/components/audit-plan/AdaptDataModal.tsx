/**
 * "Adapt with your data" — the files a selection of standard workflows
 * needs, asked for once each. Every file is pre-matched to a Knowledge Hub
 * source where one is connected; the user changes a match, uploads what's
 * missing, or skips.
 *
 * Missing files can be dropped all at once: Ira places each upload into the
 * input it matches (by SAP code or name) and only asks about the ones it
 * can't place. Any one input can also take several files (e.g. MB51 split
 * by month). Workflows whose file stays missing are still built and come
 * back as "Needs your input", so nothing here blocks Continue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Database, FileUp, X, CircleDashed, Upload, Plus } from 'lucide-react';
import { Button } from '../shared/Button';
import { SEED } from '../data-sources/sources';
import {
  CHECK_CATALOG, autoMatch, placeUpload, requiredFilesFor, uploadChoice,
  type CatalogEntry, type FileSourceChoice, type StandardFile,
} from '../../data/auditPlan';
import { IraMark } from './PlanParts';

interface Props {
  keys: string[];
  onClose: () => void;
  onContinue: (choices: Record<string, FileSourceChoice | null>) => void;
}

/** Sources a file can be pointed at: connected databases + uploaded files/folders. */
const SOURCE_OPTIONS = SEED.filter(s => s.type === 'database' || s.type === 'file').map(s => s.name);

type DropResult = { placed: { code: string; count: number }[]; unplaced: string[] };

export default function AdaptDataModal({ keys, onClose, onContinue }: Props) {
  const entries = useMemo(
    () => keys.map(k => CHECK_CATALOG.find(e => e.key === k)).filter((e): e is CatalogEntry => !!e),
    [keys],
  );
  const required = useMemo(() => requiredFilesFor(entries), [entries]);
  const [choices, setChoices] = useState<Record<string, FileSourceChoice | null>>(
    () => Object.fromEntries(required.map(r => [r.file.id, autoMatch(r.file)])),
  );
  const [drop, setDrop] = useState<DropResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const uploadFor = useRef<string | null>(null);
  const rowInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolved = (id: string) => { const c = choices[id]; return !!c && c.kind !== 'skip'; };
  const missing = required.filter(r => !resolved(r.file.id));
  const readyFiles = required.length - missing.length;
  const buildable = entries.filter(e => required.filter(r => r.unlocks.includes(e.key)).every(r => resolved(r.file.id))).length;
  const nameOf = (key: string) => CHECK_CATALOG.find(e => e.key === key)?.checkName ?? key;

  const addUploads = (fileId: string, names: string[]) => {
    if (names.length === 0) return;
    setChoices(c => ({ ...c, [fileId]: uploadChoice(names, c[fileId]) }));
  };

  /** Bulk drop: place each file into the input it matches — missing inputs
   *  first, then any input (an upload can replace a connected source). */
  const placeAll = (names: string[]) => {
    if (names.length === 0) return;
    const missingFiles: StandardFile[] = missing.map(r => r.file);
    const allFiles: StandardFile[] = required.map(r => r.file);
    const byFile = new Map<string, string[]>();
    const unplaced: string[] = [];
    for (const n of names) {
      const f = placeUpload(n, missingFiles) ?? placeUpload(n, allFiles);
      if (f) byFile.set(f.id, [...(byFile.get(f.id) ?? []), n]);
      else unplaced.push(n);
    }
    setChoices(c => {
      const next = { ...c };
      byFile.forEach((ns, id) => { next[id] = uploadChoice(ns, c[id]); });
      return next;
    });
    setDrop(prev => ({
      placed: [...byFile.entries()].map(([id, ns]) => ({ code: required.find(r => r.file.id === id)?.file.code ?? id, count: ns.length })),
      unplaced: [...(prev?.unplaced ?? []), ...unplaced],
    }));
  };

  const assignUnplaced = (name: string, fileId: string) => {
    addUploads(fileId, [name]);
    setDrop(d => (d ? { ...d, unplaced: d.unplaced.filter(u => u !== name) } : d));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="adapt-title">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-900/40" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="relative w-full max-w-[52rem] max-h-[90vh] flex flex-col rounded-xl bg-canvas-elevated border border-canvas-border shadow-xl"
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-canvas-border">
          <IraMark size={30} />
          <div className="min-w-0 flex-1">
            <h2 id="adapt-title" className="text-[1.0625rem] font-semibold text-ink-900">
              Adapt {entries.length} standard workflow{entries.length === 1 ? '' : 's'} with your data
            </h2>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">
              {required.length} file{required.length === 1 ? '' : 's'} cover all of them. Ira matched what's already in your Knowledge Hub — change a match, or upload what's missing.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 hover:text-ink-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Bulk drop — shown while anything is missing, or to resolve leftovers */}
        {(missing.length > 0 || (drop && drop.unplaced.length > 0)) && (
          <div className="px-6 pt-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                placeAll(Array.from(e.dataTransfer.files).map(f => f.name));
              }}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors ${
                dragOver ? 'border-brand-400 bg-brand-50/60' : 'border-ink-300/70 bg-paper-50/60'
              }`}
            >
              <span className="size-9 rounded-md bg-white border border-canvas-border flex items-center justify-center shrink-0">
                <Upload size={16} className="text-brand-600" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[0.8125rem] font-medium text-ink-900">
                  {missing.length > 0
                    ? `${missing.length} file${missing.length === 1 ? '' : 's'} not found — drop them all here`
                    : 'Drop more files here'}
                </div>
                <div className="text-[0.75rem] text-ink-500">
                  Ira places each one by its SAP code or name (e.g. <span className="font-mono">MB51_Jan.xlsx</span>, <span className="font-mono">Sales_Orders.csv</span>). Several files can feed one input.
                </div>
              </div>
              <Button variant="outline" size="sm" leftIcon={<FileUp size={13} />} onClick={() => bulkInput.current?.click()}>
                Choose files
              </Button>
            </div>

            {drop && (drop.placed.length > 0 || drop.unplaced.length > 0) && (
              <div className="mt-2 rounded-md border border-canvas-border bg-white px-3 py-2 text-[0.75rem]" aria-live="polite">
                {drop.placed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-ink-600">
                    <Check size={12} className="text-compliant-700" aria-hidden />
                    Placed into
                    {drop.placed.map(p => (
                      <span key={p.code} className="inline-flex items-center h-5 px-1.5 rounded bg-compliant-50 text-compliant-700 font-mono">
                        {p.code}{p.count > 1 ? ` ×${p.count}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {drop.unplaced.length > 0 && (
                  <div className={drop.placed.length > 0 ? 'mt-2 pt-2 border-t border-canvas-border' : ''}>
                    <div className="text-mitigated-700 mb-1">Couldn't tell where {drop.unplaced.length === 1 ? 'this goes' : 'these go'} — assign {drop.unplaced.length === 1 ? 'it' : 'them'}:</div>
                    <ul className="space-y-1">
                      {drop.unplaced.map(name => (
                        <li key={name} className="flex items-center gap-2">
                          <FileUp size={12} className="text-ink-400 shrink-0" aria-hidden />
                          <span className="text-ink-800 truncate min-w-0 flex-1">{name}</span>
                          <select
                            aria-label={`Assign ${name}`}
                            defaultValue=""
                            onChange={e => e.target.value && assignUnplaced(name, e.target.value)}
                            className="h-7 rounded-md border border-canvas-border px-1.5 text-[0.75rem] text-ink-800 outline-none cursor-pointer max-w-[14rem]"
                          >
                            <option value="" disabled>Assign to…</option>
                            {[...missing, ...required.filter(r => resolved(r.file.id))].map(r => (
                              <option key={r.file.id} value={r.file.id}>{r.file.code} — {r.file.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setDrop(d => (d ? { ...d, unplaced: d.unplaced.filter(u => u !== name) } : d))}
                            aria-label={`Discard ${name}`}
                            className="size-6 rounded flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <ul className="flex-1 overflow-y-auto divide-y divide-canvas-border mt-2">
          {required.map(({ file, unlocks }) => {
            const choice = choices[file.id];
            const value = !choice ? '' : choice.kind === 'skip' ? '__skip' : choice.kind === 'upload' ? '__uploaded' : choice.name;
            const openRowUpload = () => { uploadFor.current = file.id; rowInput.current?.click(); };
            return (
              <li key={file.id} className="px-6 py-3 grid grid-cols-[4.75rem_minmax(0,1fr)_minmax(0,15rem)] gap-4 items-center">
                <span className="font-mono text-[0.75rem] font-semibold text-ink-800 bg-paper-100 rounded-md px-2 h-7 inline-flex items-center justify-center">{file.code}</span>
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-medium text-ink-900">{file.name}</div>
                  <div className="text-[0.75rem] text-ink-500 truncate" title={file.hint}>{file.hint}</div>
                  <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate" title={unlocks.map(nameOf).join(', ')}>
                    Unlocks <span className="font-medium text-ink-600 tabular-nums">{unlocks.length}</span> workflow{unlocks.length === 1 ? '' : 's'} · {unlocks.slice(0, 2).map(nameOf).join(', ')}{unlocks.length > 2 ? ` +${unlocks.length - 2}` : ''}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className={`flex items-center gap-2 h-9 rounded-md border pl-2.5 pr-1 ${
                    !choice ? 'border-risk-200 bg-risk-50/40' : choice.kind === 'skip' ? 'border-canvas-border bg-paper-50' : 'border-canvas-border bg-white'
                  }`}>
                    {!choice ? <CircleDashed size={14} className="text-risk-700 shrink-0" aria-hidden />
                      : choice.kind === 'upload' ? <FileUp size={14} className="text-brand-600 shrink-0" aria-hidden />
                      : choice.kind === 'skip' ? <X size={14} className="text-ink-400 shrink-0" aria-hidden />
                      : <Database size={14} className="text-compliant-700 shrink-0" aria-hidden />}
                    <select
                      aria-label={`Source for ${file.code} ${file.name}`}
                      value={value}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '__upload') { openRowUpload(); return; }
                        setChoices(c => ({ ...c, [file.id]: v === '__skip' ? { kind: 'skip' } : v === '' ? null : { kind: 'source', name: v } }));
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-ink-800 outline-none cursor-pointer truncate"
                    >
                      {!choice && <option value="">Not found — choose or upload</option>}
                      {choice?.kind === 'upload' && <option value="__uploaded">{choice.name}</option>}
                      {SOURCE_OPTIONS.map(n => (
                        <option key={n} value={n}>{n}{n === file.matches ? ' ✓' : ''}</option>
                      ))}
                      <option value="__upload">Upload files…</option>
                      <option value="__skip">Skip for now</option>
                    </select>
                  </div>
                  <div className="mt-1 text-[0.6875rem] pl-0.5 flex items-center gap-1.5 min-w-0">
                    {!choice || choice.kind === 'skip' ? (
                      <>
                        <span className={!choice ? 'text-risk-700' : 'text-ink-400'}>{!choice ? 'Not in your connected sources' : 'Skipped — its workflows will ask later'}</span>
                        <span className="text-ink-300" aria-hidden>·</span>
                        <button onClick={openRowUpload} className="font-medium text-brand-700 hover:underline cursor-pointer whitespace-nowrap">Upload files</button>
                      </>
                    ) : choice.kind === 'upload' ? (
                      <>
                        <span className="text-brand-700 truncate" title={(choice.files ?? [choice.name]).join(', ')}>
                          Uploaded · {(choice.files ?? [choice.name]).length} file{(choice.files ?? [choice.name]).length === 1 ? '' : 's'}
                        </span>
                        <span className="text-ink-300" aria-hidden>·</span>
                        <button onClick={openRowUpload} className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline cursor-pointer whitespace-nowrap"><Plus size={10} />Add more</button>
                      </>
                    ) : choice.name === file.matches ? (
                      <span className="text-compliant-700 inline-flex items-center gap-1"><Check size={11} />Auto-matched{file.rows ? ` · ${file.rows}` : ''}</span>
                    ) : (
                      <span className="text-ink-500">Chosen by you</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-canvas-border bg-paper-50/60 rounded-b-xl">
          <div className="text-[0.8125rem] text-ink-600">
            <span className="font-semibold text-ink-900 tabular-nums">{readyFiles} of {required.length}</span> files ready ·{' '}
            <span className="font-semibold text-ink-900 tabular-nums">{buildable} of {entries.length}</span> workflows fully covered
            {buildable < entries.length && (
              <div className="text-[0.75rem] text-ink-500">The rest are still built — they'll ask for the missing file in their own session.</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="primary" rightIcon={<ArrowRight size={14} />} onClick={() => onContinue(choices)}>
              Review Ira's plan
            </Button>
          </div>
        </div>

        {/* One input, several files */}
        <input
          ref={rowInput}
          type="file"
          multiple
          className="hidden"
          accept=".csv,.xlsx,.xls,.txt,.pdf"
          onChange={e => {
            const id = uploadFor.current;
            if (id) addUploads(id, Array.from(e.target.files ?? []).map(f => f.name));
            e.target.value = '';
            uploadFor.current = null;
          }}
        />
        {/* Many files, placed by Ira */}
        <input
          ref={bulkInput}
          type="file"
          multiple
          className="hidden"
          accept=".csv,.xlsx,.xls,.txt,.pdf"
          onChange={e => {
            placeAll(Array.from(e.target.files ?? []).map(f => f.name));
            e.target.value = '';
          }}
        />
      </motion.div>
    </div>
  );
}
