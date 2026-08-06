// Where a custom format is used. One question, two answers, and the answer is
// derived from the fields the template already carries so there is no third
// state to keep in step:
//
//   all internal audit reports — no engagement, isDefault set. One format holds
//     this at a time; saving another into it clears the flag from the old one,
//     which stays on the list and stays pickable.
//   one engagement — engagementId set.
//
// Neither hides a format from anyone. The report's own Apply Template picker
// still switches a single report to anything on the list.

export type TemplateScope = 'internal-audit' | 'engagement';

export function templateScope(t: { engagementId?: string }): TemplateScope {
  return t.engagementId ? 'engagement' : 'internal-audit';
}

/** One line for a list row, or null when there is nothing worth saying: a
 *  format that is neither the one reports start in nor tied to an engagement is
 *  simply on the list, and a line saying so on every card is noise. */
export function templateScopeLine(
  t: { engagementId?: string; isDefault?: boolean },
  engagementName?: string,
): string | null {
  if (t.engagementId) return `Only for ${engagementName ?? 'an engagement that is no longer listed'}`;
  if (t.isDefault) return 'All internal audit reports';
  return null;
}

/** The same answer as a short tag for a list row: "Default" for the format all
 *  internal audit reports come out in, the engagement's own name when it is
 *  tied to one, and nothing for a format that is simply on the list. */
export function templateScopeTag(
  t: { engagementId?: string; isDefault?: boolean },
  engagementName?: string,
): string | null {
  if (t.engagementId) return engagementName ?? 'Engagement no longer listed';
  if (t.isDefault) return 'Default';
  return null;
}
