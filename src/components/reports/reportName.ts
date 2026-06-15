// Report names often trail with the generated date ("… — Jun 12, 2026" /
// "… — March 2026"). That date already lives in its own Generated column / meta
// line, so strip the trailing date for display to avoid showing it twice. Stored
// names keep the date (search + uniqueness); this is display-only.
export function reportDisplayName(name: string): string {
  return name
    .replace(/\s*[—–-]\s*(?:[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{4})\s*$/, '')
    .trim() || name;
}
