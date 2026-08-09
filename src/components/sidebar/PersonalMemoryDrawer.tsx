// ─── "What IRA knows about me" — the personal memory home ──────────────────
//
// Opened from the avatar menu (scope-follows-surface: personal memory is
// governed by its owner, nowhere else). Everything here is inferred and
// evidence-backed; every row forgets in one tap with undo, and "forget
// everything about me" lives here — both through the shared session layer,
// so the registry and every consuming surface reflect it instantly.

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain, Check, ChevronRight, CircleSlash, Undo2,
  SlidersHorizontal, BookOpen, Landmark, PenLine, ShieldCheck, Route, Repeat,
} from 'lucide-react';
import Drawer from '../shared/Drawer';
import ConfirmationModal from '../shared/ConfirmationModal';
import { KIND_META, type MemoryKind, type PlatformMemory } from '../../data/memoryStore';
import {
  useMemorySessionVersion, allMemories, decisionFor, isPersonalCleared,
  forgetMemory, undoForget, clearPersonal, undoClearPersonal,
} from '../../data/memorySession';
import { navigateToSmartLearn } from '../shared/memory/MemoryKit';

const KIND_ICON: Record<MemoryKind, React.ComponentType<{ size?: number; className?: string }>> = {
  preference: SlidersHorizontal, vocabulary: BookOpen, fact: Landmark,
  correction: PenLine, decision: Route, routine: Repeat, rule: ShieldCheck,
};

function PersonalRow({ memory }: { memory: PlatformMemory }) {
  const d = decisionFor(memory.id);
  const KindIcon = KIND_ICON[memory.kind];
  if (d?.forgotten) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas px-3.5 py-2.5">
        <CircleSlash size={13} className="shrink-0 text-ink-400" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-500">Forgotten — IRA will no longer use this.</span>
        <button type="button" onClick={() => undoForget(memory)}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline cursor-pointer">
          <Undo2 size={11} /> Undo
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <KindIcon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium leading-snug text-ink-900">{memory.statement}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-400">
            <span className="font-semibold text-ink-600">{KIND_META[memory.kind].label}</span>
            <span className="text-ink-300">·</span>
            <span>{memory.source}</span>
            {memory.confidence != null && (
              <>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1 text-compliant-700 font-semibold">
                  <Check size={9} strokeWidth={3} /> {Math.round(memory.confidence * 100)}%
                </span>
              </>
            )}
            <span className="text-ink-300">·</span>
            <span className="tabular-nums">recalled {memory.recallCount}×</span>
          </p>
        </div>
        <button type="button" onClick={() => forgetMemory(memory)}
          className="shrink-0 text-[11px] font-semibold text-ink-400 hover:text-risk transition-colors cursor-pointer">
          Forget
        </button>
      </div>
    </div>
  );
}

export default function PersonalMemoryDrawer({ onClose }: { onClose: () => void }) {
  useMemorySessionVersion();
  const [confirmClear, setConfirmClear] = useState(false);
  const cleared = isPersonalCleared();
  const personal = allMemories().filter(m => m.scope === 'personal');
  const liveCount = cleared ? 0 : personal.filter(m => !decisionFor(m.id)?.forgotten).length;

  return (
    <>
      <Drawer
        title="What IRA knows about you"
        subtitle={
          <span className="text-[11px] text-ink-400">
            {liveCount} personal memor{liveCount === 1 ? 'y' : 'ies'} — inferred from how you work, never shared, forgettable any time.
          </span>
        }
        onClose={onClose}
        footer={
          <>
            {!cleared && liveCount > 0 && (
              <button type="button" onClick={() => setConfirmClear(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-risk/30 px-3.5 text-[12px] font-semibold text-risk hover:bg-risk-50 transition-colors cursor-pointer">
                <CircleSlash size={13} /> Forget everything about me
              </button>
            )}
            <button type="button" onClick={() => { onClose(); navigateToSmartLearn(); }}
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-md border border-canvas-border px-3.5 text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
              Open Smart Learn <ChevronRight size={13} />
            </button>
          </>
        }
      >
        {cleared ? (
          <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-canvas">
              <Brain size={18} className="text-ink-400" />
            </div>
            <p className="text-[13px] font-semibold text-ink-700">IRA has forgotten everything about you.</p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-ink-400">
              New preferences will be proposed as you keep working — nothing returns without fresh evidence.
            </p>
            <button type="button" onClick={() => undoClearPersonal()}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">
              <Undo2 size={12} /> Undo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {personal.map(m => (
                <motion.div key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <PersonalRow memory={m} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Drawer>

      <ConfirmationModal
        open={confirmClear}
        title="Forget everything about you?"
        description="IRA will stop using all personal preferences, vocabulary, routines and corrections it has learned. Team, engagement, organization and source memories are not affected."
        confirmLabel="Forget everything"
        tone="destructive"
        onConfirm={() => { clearPersonal(); setConfirmClear(false); }}
        onClose={() => setConfirmClear(false)}
      />
    </>
  );
}
