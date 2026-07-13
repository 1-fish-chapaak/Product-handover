import { Layers, Link2, GitCompare } from 'lucide-react';
import type { ComponentType } from 'react';
import type { InputSpec, SlotFunction } from '../concierge-workflow-builder/types';

// Resolve a slot's function, defaulting from the legacy `multiple` flag so older
// inputs (consolidated workbook) keep working without an explicit `func`.
export function resolveSlotFunction(input: InputSpec): SlotFunction {
  if (input.func) return input.func;
  return input.multiple ? 'consolidate' : 'single';
}

type TagMeta = { label: string; Icon: ComponentType<{ size?: number }>; title: string };

// 'single' is the implicit default and intentionally has no badge — only the
// non-default roles get a visible tag.
const META: Record<Exclude<SlotFunction, 'single'>, TagMeta> = {
  consolidate: {
    label: 'Multiple files',
    Icon: Layers,
    title: "This input accepts multiple files — they're unioned into one dataset before processing.",
  },
  reference: {
    label: 'Reference',
    Icon: Link2,
    title: 'Reference table — one source, joined/looked-up against the other inputs (never stacked).',
  },
  compare: {
    label: 'Compare',
    Icon: GitCompare,
    title: 'Compare slot — two or more sources kept distinct and aligned for diff (never concatenated).',
  },
};

/** Small role badge shown next to a required-file slot's name across the
 *  executor (Required Files, file-mapping, column-mapping). Renders nothing for
 *  the default 'single' role. */
export default function SlotFunctionTag({ input }: { input: InputSpec }) {
  const fn = resolveSlotFunction(input);
  if (fn === 'single') return null;
  const { label, Icon, title } = META[fn];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold rounded-md bg-brand-50 border border-brand-200 text-brand-700 px-1.5 py-0.5"
    >
      <Icon size={11} />
      {label}
    </span>
  );
}
