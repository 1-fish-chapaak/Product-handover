/**
 * REDRAWING A SAVED RACM'S FLOWCHART.
 *
 * The user's ask (29 Sep): "Jo bhi RCMs SOP se extract hongi, usmein RCM library
 * wali row mein View SOP, View Flowchart do button aayenge."
 *
 * The chart is drawn by `SopFlowchartView`, which reads `ImportRow[]` — the
 * draft rows the import wizard works in. A saved `LibraryRacm` has none: it
 * keeps `controls: Control[]` and nothing else of the extraction. So the chart
 * has to be drawn again from the controls, which is what this file does.
 *
 * IT IS A REDRAWING, NOT A RECORD. The library never stored the chart's nodes —
 * `ProcessFlowchart` on the record is metadata only (which SOP, when, and
 * whether a walkthrough has confirmed it). That is the right way round: a chart
 * kept as geometry would drift from the controls the moment one was edited,
 * and then the picture would be quietly wrong. Drawn from the controls every
 * time, it cannot be.
 *
 * WHAT IS LOST, AND WHY IT DOES NOT MATTER HERE. An imported control does not
 * remember whether Ira had merely suggested it — `origin` is not kept — so every
 * box reads as the SOP's own. It is true of what was imported: a suggestion the
 * reviewer accepted became part of the matrix, and one they did not is not here
 * to draw. Rows left out of the import are likewise absent rather than counted,
 * so `omitted` is 0 against a saved RACM.
 */
import type { ImportRow } from './racmImport';
import type { Control } from './types';

/**
 * A saved RACM's controls as rows the spine can read.
 *
 * Only the fields `sopSpine` actually looks at are filled — the stage, the risk,
 * the control's name and section. Attributes, design checks and duplicate
 * verdicts belong to an import under review and mean nothing here, so they are
 * left empty rather than reconstructed into something that was never true.
 */
export function chartRowsFromControls(controls: Control[]): ImportRow[] {
  return controls.map((c, i) => ({
    key: c.id,
    rowNo: i + 1,
    // Every row of a saved RACM was imported, whatever it started as. See the
    // header on why the suggestion mark is not carried.
    origin: 'sop' as const,
    ...(c.sopSectionRef ? { sectionRef: c.sopSectionRef } : {}),
    values: {
      riskId: c.riskId,
      riskTitle: c.riskTitle ?? '',
      riskDescription: c.riskDescription,
      controlId: c.id,
      controlTitle: c.description,
      controlActivity: c.controlActivity ?? '',
      subProcess: c.subProcess,
      sopSectionRef: c.sopSectionRef ?? '',
    },
    extras: {},
    attributes: [],
    designChecks: [],
    mergedDuplicateChecks: 0,
    frequency: c.frequency,
    isKey: c.isKey,
    nature: c.nature,
    type: c.type,
    assertions: c.assertions,
  }));
}
