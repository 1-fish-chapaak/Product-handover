import { useState, useRef, useEffect, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy } from 'lucide-react';

// Fenced ```code``` block — dark surface with a copy button. Internal dependency
// of renderAssistantText; not exported on its own.
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-800 border-b border-ink-700">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1 px-1.5 h-6 rounded text-[0.6875rem] font-medium text-ink-400 hover:text-canvas-elevated hover:bg-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[0.8125rem] leading-[1.55] text-canvas-elevated font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── ReactMarkdown render for assistant prose ───────────────────────────────
// Renders **bold**, `inline code` as a styled chip, paragraphs with proper
// spacing, lists with prose indents, and ```fenced``` blocks via CodeBlock.
// Plain text without any markdown still renders identically — react-markdown
// just wraps it in a <p>. Shared by the chat assistant and the report query
// cards so both surfaces render answers in exactly the same format.

// Typography variants. `chat` is the original compact assistant style; `document`
// is the canonical AI-prose body for the report reading surface — every value is a
// DESIGN.md step: 16px body (§3 ramp "Body, AI prose"), leading 1.65 + ink-800 (§3
// AI prose), 66ch cap (§3 "The 66ch Response Rule"), 1px/2px borders only (§4
// "Border-First Rule"). No invented sizes or border widths.
type MarkdownVariant = 'chat' | 'document';

const VARIANT_STYLES: Record<MarkdownVariant, {
  p: string; ul: string; ol: string; li: string;
  h1: string; h2: string; h3: string; h4: string; blockquote: string;
}> = {
  chat: {
    p: 'mb-5 last:mb-0 leading-[1.7] text-[0.875rem] text-ink-800',
    ul: 'my-5 pl-6 space-y-2 list-disc marker:text-ink-400 text-[0.875rem]',
    ol: 'my-5 pl-6 space-y-2 list-decimal marker:text-ink-400 text-[0.875rem]',
    li: 'leading-[1.7] pl-1',
    h1: 'mt-5 mb-2 text-[1.125rem] font-bold leading-tight text-ink-900',
    h2: 'mt-5 mb-2 text-[1rem] font-bold leading-tight text-ink-900',
    h3: 'mt-4 mb-1.5 text-[0.875rem] font-bold leading-tight text-ink-900',
    h4: 'mt-4 mb-1.5 text-[0.8125rem] font-bold leading-tight text-ink-900',
    blockquote: 'my-3 pl-3 border-l-2 border-brand-200 text-ink-700 italic',
  },
  document: {
    // 16px / ink-800 — the "Body, AI prose" ramp step (§3). Line-height opened to
    // 1.8 and block gaps widened so the prose reads as airy distinct lines, not a
    // cramped wall of text. Headings get extra top space to separate ideas.
    p: 'mb-7 last:mb-0 leading-[1.8] text-[1rem] text-ink-800',
    ul: 'my-7 pl-6 space-y-3.5 list-disc marker:text-ink-400 text-[1rem] text-ink-800',
    ol: 'my-7 pl-6 space-y-3.5 list-decimal marker:text-ink-400 text-[1rem] text-ink-800',
    li: 'leading-[1.8] pl-1.5',
    // Headings step up the ramp: 20 / 18 / 17 / 16px — all defined steps (§3).
    h1: 'mt-9 mb-3 text-[1.25rem] font-bold leading-snug text-ink-900',
    h2: 'mt-9 mb-3 text-[1.125rem] font-bold leading-snug text-ink-900',
    h3: 'mt-8 mb-3 text-[1.0625rem] font-bold leading-snug text-ink-900',
    h4: 'mt-7 mb-2.5 text-[1rem] font-bold leading-snug text-ink-900',
    blockquote: 'my-7 pl-4 border-l-2 border-brand-200 text-ink-700 italic',
  },
};

export function renderAssistantText(text: string, variant: MarkdownVariant = 'chat'): ReactNode {
  if (!text) return null;
  const s = VARIANT_STYLES[variant];
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className={s.p}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-ink-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-400 transition-colors">
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className={s.ul}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className={s.ol}>{children}</ol>
        ),
        li: ({ children }) => (
          <li className={s.li}>{children}</li>
        ),
        h1: ({ children }) => (
          <h1 className={s.h1}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={s.h2}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={s.h3}>{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className={s.h4}>{children}</h4>
        ),
        blockquote: ({ children }) => (
          <blockquote className={s.blockquote}>{children}</blockquote>
        ),
        // Inline code: styled chip with mono font, hairline border, light bg.
        // Block code (triple-backtick) is delegated to <CodeBlock> via `pre`.
        code: (props) => {
          const { className, children, ...rest } = props as { className?: string; children?: ReactNode };
          const isBlock = /language-/.test(className || '');
          if (isBlock) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code
              {...rest}
              className="inline-flex items-center px-1.5 py-px mx-px rounded-md bg-canvas border border-canvas-border font-mono text-[0.85em] text-ink-800 align-baseline"
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => {
          // children should be a <code> element with language-* class + text.
          const child = (children as { props?: { className?: string; children?: ReactNode } })?.props;
          const className = child?.className || '';
          const langMatch = /language-([\w+-]+)/.exec(className);
          const lang = langMatch ? langMatch[1] : '';
          const raw = typeof child?.children === 'string'
            ? child.children
            : Array.isArray(child?.children) ? child!.children.join('') : '';
          return <CodeBlock language={lang} code={String(raw).replace(/\n$/, '')} />;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
