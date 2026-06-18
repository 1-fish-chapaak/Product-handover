import rawData from './ar-racm-entries.json';

// Shape of a single risk-control row in the SOP_Accounts Receivable RACM export.
export interface ArRacmEntry {
  riskId: string;
  controlId: string;
  processArea: string;
  subProcess: string;
  riskCategory: string;
  riskDescription: string;
  riskRating: 'Critical' | 'High' | 'Medium' | 'Low';
  riskLikelihood: string;
  riskImpact: string;
  controlObjective: string;
  controlActivity: string;
  controlType: 'Preventive' | 'Detective';
  controlNature: string;
  controlFrequency: string;
  controlOwner: string;
  controlEvidence: string;
  assertionsCoveredCEAVOP: string;
  financialStatementLineItem: string;
  regulatoryReference: string;
  segregationOfDuties: string;
  extractionConfidence: 'EXTRACTED' | 'INFERRED' | 'RECOMMENDED';
  sopSectionReference: string;
  gapsIdentified: string;
  itApplication: string;
  todDataValidated: string;
  todChecksPerformed: string;
  todResults: string;
  remediationActionPlan: string;
  timelines: string;
  processOwnerName: string;
  remarks: string;
  reviewerApprover: string;
}

export const AR_RACM_ENTRIES: ArRacmEntry[] = rawData as ArRacmEntry[];

// ID used to wire this RACM into the RACM list table.
export const AR_RACM_ID = 'racm-ar-001';
