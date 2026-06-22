// Composer "context mode" — the shared payload that a right-side canvas CTA
// (Plan ▸ Edit, Code ▸ Edit, a Source's Chat / Pick) hands off to the chat
// composer. The composer then enters a focused mode: a toned banner pill +
// helper line + Cancel, a contextual placeholder, and a Perplexity-style
// "attached context" chip showing exactly which artifact the next message
// acts on. One message resolves the mode (or Cancel clears it).
//
// Lives in its own module so the canvas (concierge-workflow-builder/
// DataSourcePanel) and the composer (chat/ChatView) can share the shape and
// the builders without a circular import.

export type ComposerContextKind = 'edit-plan' | 'edit-code' | 'source-chat' | 'source-pick';

// Maps to a small palette in ChatView (banner pill + chip accent).
export type ComposerTone = 'amber' | 'brand' | 'emerald' | 'slate';

// Icon key resolved to a lucide component in ChatView (keeps this module
// free of JSX so it can be imported anywhere).
export type ComposerIconKey = 'pencil' | 'message' | 'columns' | 'code';

export interface ComposerContextTarget {
  /** Bold title of the artifact, e.g. "Invoices" or "Query Execution Plan". */
  title: string;
  /** Muted second line, e.g. "CSV · 6 columns" or "4 steps". */
  subtitle?: string;
  /** Short uppercase format tag rendered as a tiny badge, e.g. "CSV", "PY". */
  badge?: string;
  /** Optional 1–2 line preview (Perplexity shows a quote from the doc). */
  excerpt?: string;
}

export interface ComposerContext {
  kind: ComposerContextKind;
  /** Pill label, e.g. "Editing plan". */
  label: string;
  /** Helper line to the right of the pill. */
  helper: string;
  /** Textarea placeholder while this mode is active. */
  placeholder: string;
  tone: ComposerTone;
  icon: ComposerIconKey;
  target?: ComposerContextTarget;
}

// ─── Builders ────────────────────────────────────────────────────────────
// Each canvas CTA calls one of these so the call sites stay declarative and
// the copy lives in one place.

export function editPlanContext(stepCount?: number): ComposerContext {
  return {
    kind: 'edit-plan',
    label: 'Editing plan',
    helper: 'Your next message updates the execution plan.',
    placeholder: 'What should change? e.g. “add a dedupe step before matching”',
    tone: 'amber',
    icon: 'pencil',
    target: {
      title: 'Query Execution Plan',
      subtitle: stepCount ? `${stepCount} step${stepCount === 1 ? '' : 's'}` : undefined,
    },
  };
}

export function editCodeContext(filename = 'workflow.py', language = 'Python'): ComposerContext {
  const badge =
    /sql/i.test(language) ? 'SQL'
    : /python/i.test(language) ? 'PY'
    : language.slice(0, 3).toUpperCase();
  const title = /sql/i.test(language) ? 'Generated SQL Query' : 'Generated Code';
  return {
    kind: 'edit-code',
    label: 'Editing code',
    helper: 'Describe the change — I’ll rewrite the generated code.',
    placeholder: 'e.g. “use a 2-day tolerance on invoice date”',
    tone: 'slate',
    icon: 'code',
    target: {
      title,
      subtitle: `${filename} · ${language}`,
      badge,
    },
  };
}

export function sourceChatContext(s: {
  name: string;
  type?: string;
  description?: string;
}): ComposerContext {
  const badge = s.type ? s.type.toUpperCase() : undefined;
  return {
    kind: 'source-chat',
    label: 'Asking Ira',
    helper: `Ask anything about ${s.name}.`,
    placeholder: `Ask about ${s.name}…`,
    tone: 'brand',
    icon: 'message',
    target: {
      title: s.name,
      subtitle: badge ? `${badge}${s.description ? ` · ${s.description}` : ''}` : s.description,
      badge,
      excerpt: s.description,
    },
  };
}

export function sourcePickContext(s: {
  name: string;
  type?: string;
  used?: number;
  total?: number;
}): ComposerContext {
  const badge = s.type ? s.type.toUpperCase() : undefined;
  const colsLine =
    s.used != null && s.total != null
      ? `Using ${s.used} of ${s.total} columns`
      : 'Choose the columns to use';
  return {
    kind: 'source-pick',
    label: 'Choosing columns',
    helper: `Tell me which columns of ${s.name} to use.`,
    placeholder: `e.g. “drop PO Ref, add Approver” for ${s.name}`,
    tone: 'emerald',
    icon: 'columns',
    target: {
      title: s.name,
      subtitle: colsLine,
      badge,
    },
  };
}
