// Section Library (Template Studio §6) — reusable section blocks that carry their
// own AI generation guidance, so building a template is partly composition: drag
// in "Sign-off", and it brings its rules with it. Persisted to localStorage;
// seeded with a few common audit blocks so the feature is usable from day one.

import type { TemplateSection } from './reportShared';

export type LibrarySection = TemplateSection & { id: string };

const KEY = 'irame.section-library.v1';

const SEED: LibrarySection[] = [
  { id: 'lib-exec', name: 'Executive Summary', icon: 'file-text', guidance: 'Under 150 words, executive tone. Lead with the overall conclusion, then the two or three most important points.' },
  { id: 'lib-signoff', name: 'Sign-off', icon: 'shield', guidance: 'Names, roles and dates of the preparers and approvers. No narrative — a clean approval block.' },
  { id: 'lib-risk', name: 'Risk Assessment', icon: 'alert-triangle', guidance: 'Summarise the key risks by severity; surface High and Medium first, with likelihood and impact.' },
  { id: 'lib-controls', name: 'Control Testing Results', icon: 'check-circle', guidance: 'Controls tested, pass/fail counts, and each exception with its root cause and affected control.' },
  { id: 'lib-recs', name: 'Recommendations', icon: 'lightbulb', guidance: 'Actionable recommendations tied to findings; each with an owner and a target date where known.' },
];

export function loadSectionLibrary(): LibrarySection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as LibrarySection[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

export function saveSectionLibrary(list: LibrarySection[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full / disabled — non-fatal */ }
}

/** Add a section as a reusable block (deduped by name, case-insensitive). Returns
 *  the new library so the caller can update state. */
export function addToSectionLibrary(list: LibrarySection[], section: TemplateSection): LibrarySection[] {
  const exists = list.some(s => s.name.toLowerCase() === section.name.trim().toLowerCase());
  if (exists || !section.name.trim()) return list;
  const next = [...list, { id: `lib-${Date.now()}`, name: section.name.trim(), icon: section.icon || 'file-text', guidance: section.guidance }];
  saveSectionLibrary(next);
  return next;
}
