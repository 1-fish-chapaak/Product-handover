// Bridge: ExtractionSession → AtrReportData (the shape the existing AtrDocument
// renderer consumes). Only selected observations flow through; fields the user
// skipped are cleared so the renderer omits them; the wizard-only fields
// (id, completeness, selection, missing-field tracking) are dropped.

import type { AtrReportData, AtrObservation } from '../atrTypes';
import type { ExtractionSession, ExtractedObservation } from './types';
import { SEED_INSIGHTS } from './mockExtraction';
import { setFieldValue } from './observationFields';

function toAtrObservation(o: ExtractedObservation): AtrObservation {
  let e = o;
  o.missingFields.filter(f => f.state === 'skipped').forEach(f => { e = setFieldValue(e, f.key, ''); });
  // Strip the extraction-layer fields; what remains is AtrObservation-shaped.
  const { id: _id, number: _n, completeness: _c, selected: _s, confidence: _cf, missingFields: _mf, dueDate: _dd, ...rest } = e;
  void _id; void _n; void _c; void _s; void _cf; void _mf; void _dd;
  return { ...rest, title: rest.title?.trim() || 'Untitled observation' };
}

export function toAtrReportData(session: ExtractionSession): AtrReportData {
  return {
    meta: { ...session.meta },
    observations: session.observations.filter(o => o.selected).map(toAtrObservation),
    insights: SEED_INSIGHTS.map(i => ({ ...i })),
  };
}
