/**
 * Pure helpers used by WidgetPickerParts and the Add-to-Dashboard / Add-to-Report
 * modals. Lives outside the component file so Fast Refresh stays component-only.
 */

export function toggleIn(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  setter(next);
}

export function setAll(items: string[], all: boolean, setter: (s: Set<string>) => void) {
  setter(all ? new Set(items) : new Set());
}
