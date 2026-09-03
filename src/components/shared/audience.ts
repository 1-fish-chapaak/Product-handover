/** Who can open a shared object. One list, so the share dialog and the
 *  visibility control on an open report can never drift apart. */
export const AUDIENCES = ['Only invited users', 'Everyone at Irame', 'Anyone with the link'] as const;
export type Audience = typeof AUDIENCES[number];

/** Audit work starts closed. A report reaches exactly the people invited to
 *  it, so opening it up is a deliberate act. */
export const DEFAULT_REPORT_AUDIENCE: Audience = 'Only invited users';

/** The short word the control shows. The full phrase is the menu row and the
 *  title, so the chip stays a chip without lying about what it means. */
export function audienceLabel(a: Audience): string {
  return a === 'Anyone with the link' ? 'Public' : a === 'Everyone at Irame' ? 'Workspace' : 'Invited only';
}

export function audienceHint(a: Audience): string {
  return a === 'Anyone with the link' ? 'Anyone with the link can open.'
    : a === 'Everyone at Irame' ? 'Anyone in your workspace can open.'
    : 'Only people invited can open.';
}
