// ─── Bring Your Own Template — which reader runs ────────────────────────────
//
// Two shapes of file, one result. A PowerPoint is read by pptxEngine and a PDF
// by byotEngine, and both hand back the same template, because only the reading
// differs. Everything after it — the two questions, the rating words, the
// sign-off setting, the descriptions — is shared.
//
// Decks come first. A committee deck is what most clients actually present, and
// it is easier to read than a PDF because the file labels its own parts.

import { readTemplateFromPdf, type ReadOutcome } from './byotEngine';
import { readTemplateFromDeck } from './pptxEngine';

export type { ReadOutcome, ReadResult, ReadFailReason, ReadSection, ReadBlock, ReadFurniture, ReadDropped, ReadTocCheck } from './byotEngine';
/** The last read, block by block, with the verdict each block got. The result
 *  says what was kept; this says why every other block was not. */
export { lastRead } from './byotEngine';

/** What the picker accepts, and the only two things this can return. */
export type UploadKind = 'deck' | 'pdf';

export function classifyUpload(name: string): UploadKind | 'legacy-ppt' | 'word' | 'spreadsheet' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pptx') return 'deck';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ppt') return 'legacy-ppt';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'spreadsheet';
  return null;
}

export async function readTemplateFromReport(file: File): Promise<ReadOutcome> {
  const kind = classifyUpload(file.name);
  if (kind === 'deck') return readTemplateFromDeck(file);
  if (kind === 'pdf') return readTemplateFromPdf(file);
  if (kind === 'legacy-ppt') return { ok: false, reason: 'legacy-ppt' };
  return { ok: false, reason: 'unsupported' };
}
