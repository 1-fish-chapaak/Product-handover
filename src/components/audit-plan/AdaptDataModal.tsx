/**
 * "Adapt with your data" — the files a selection of standard workflows
 * needs, asked for once each. Every file is pre-matched to a Knowledge Hub
 * source where one is connected; the user changes a match, uploads what's
 * missing, or skips. Workflows whose file stays missing are still built and
 * come back as "Needs your input", so nothing here blocks Continue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Database, FileUp, X, CircleDashed } from 'lucide-react';
import { Button } from '../shared/Button';
import { SEED } from '../data-sources/sources';
import {
  CHECK_CATALOG, autoMatch, requiredFilesFor, type CatalogEntry, type FileSourceChoice,
} from '../../data/auditPlan';
import { IraMark } from './PlanParts';

interface Props {
  keys: string[];
  onClose: () => void;
  onContinue: (choices: Record<string, FileSourceChoice | null>) => void;
}

/** Sources a file can be pointed at: connected databases + uploaded files/folders. */
const SOURCE_OPTIONS = SEED.filter(s => s.type === 'database' || s.type === 'file').map(s => s.name);

export default function AdaptDataModal({ keys, onClose, onContinue }: Props) {
  const entries = useMemo(
    () => keys.map(k => CHECK_CATALOG.find(e => e.key === k)).filter((e): e is CatalogEntry => !!e),
    [keys],
  );
  const required = useMemo(() => requiredFilesFor(entries), [entries]);
  const [choices, setChoices] = useState<Record<string, FileSourceChoice | null>>(
    () => Object.fromEntries(required.map(r => [r.file.id, autoMatch(r.file)])),
  );
  const uploadFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resolved = (id: string) => { const c = choices[id]; return !!c && c.kind !== 'skip'; };
  const readyFiles = required.filter(r => resolved(r.file.id)).length;
  const buildable = entries.filter(e => required.filter(r => r.unlocks.includes(e.key)).every(r => resolved(r.file.id))).length;
  const nameOf = (key: string) => CHECK_CATALOG.find(e => e.key === key)?.checkName ?? key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="adapt-title">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-900/40" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="relative w-full max-w-[52rem] max-h-[88vh] flex flex-col rounded-xl bg-canvas-elevated border border-canvas-border shadow-xl"
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

        <ul className="flex-1 overflow-y-auto divide-y divide-canvas-border">
          {required.map(({ file, unlocks }) => {
            const choice = choices[file.id];
            const value = !choice ? '' : choice.kind === 'skip' ? '__skip' : choice.kind === 'upload' ? '__uploaded' : choice.name;
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
                        if (v === '__upload') { uploadFor.current = file.id; fileInput.current?.click(); return; }
                        setChoices(c => ({ ...c, [file.id]: v === '__skip' ? { kind: 'skip' } : v === '' ? null : { kind: 'source', name: v } }));
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-ink-800 outline-none cursor-pointer truncate"
                    >
                      {!choice && <option value="">Not found — choose or upload</option>}
                      {choice?.kind === 'upload' && <option value="__uploaded">{choice.name}</option>}
                      {SOURCE_OPTIONS.map(n => (
                        <option key={n} value={n}>{n}{n === file.matches ? ' ✓' : ''}</option>
                      ))}
                      <option value="__upload">Upload a file…</option>
                      <option value="__skip">Skip for now</option>
                    </select>
                  </div>
                  <div className="mt-1 text-[0.6875rem] pl-0.5">
                    {!choice ? <span className="text-risk-700">Not in your connected sources</span>
                      : choice.kind === 'skip' ? <span className="text-ink-400">Workflows that need it will ask you later</span>
                      : choice.kind === 'upload' ? <span className="text-brand-700">Uploaded</span>
                      : choice.name === file.matches ? <span className="text-compliant-700 inline-flex items-center gap-1"><Check size={11} />Auto-matched{file.rows ? ` · ${file.rows}` : ''}</span>
                      : <span className="text-ink-500">Chosen by you</span>}
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

        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls,.txt"
          onChange={e => {
            const f = e.target.files?.[0];
            const id = uploadFor.current;
            if (f && id) setChoices(c => ({ ...c, [id]: { kind: 'upload', name: f.name } }));
            e.target.value = '';
            uploadFor.current = null;
          }}
        />
      </motion.div>
    </div>
  );
}
