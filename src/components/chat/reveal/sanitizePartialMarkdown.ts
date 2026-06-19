// While assistant prose streams in character-by-character, the partial string
// frequently ends mid-token — a half-typed "**bold", an unclosed `inline code`
// span, or an unterminated ```fence```. Handed to react-markdown as-is, those
// dangling markers reflow the layout on every keystroke (bold suddenly turns
// on, then off, then on). This pass temporarily *closes* any open markdown
// construct so each frame renders as stable, finished markup. The closer is
// thrown away on the next tick when the real token completes — so the user
// only ever sees formatting lock in smoothly, never flicker.
export function sanitizePartialMarkdown(input: string): string {
  if (!input) return input;
  let text = input;

  // ── Fenced code blocks (```), handled first because they swallow everything
  //    inside them — an unterminated fence would otherwise render the rest of
  //    the answer as raw code. An odd number of ``` markers ⇒ one is open. ──
  const fences = text.match(/```/g);
  if (fences && fences.length % 2 === 1) {
    // Close on a fresh line so the opening fence's language hint stays intact.
    return text.endsWith('\n') ? `${text}\`\`\`` : `${text}\n\`\`\``;
  }

  // ── Inline code (`). Only meaningful outside a fence, which we've ruled out
  //    above. Odd backtick count ⇒ an open inline span; close it. ──
  const ticks = (text.match(/`/g) || []).length;
  if (ticks % 2 === 1) text += '`';

  // ── Bold (**). Count non-overlapping ** pairs; an odd count leaves one open. ──
  const bold = (text.match(/\*\*/g) || []).length;
  if (bold % 2 === 1) text += '**';

  // ── Italic emphasis with a single trailing * or _ that isn't part of a
  //    completed pair. After bold is balanced above, a lone trailing emphasis
  //    marker is the last common flicker source while typing "*word". Strip a
  //    single dangling marker rather than guess where it closes. ──
  text = text.replace(/(^|[^*])\*$/, '$1').replace(/(^|[^_])_$/, '$1');

  return text;
}
