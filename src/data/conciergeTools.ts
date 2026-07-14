/**
 * The AI Concierge tool catalog — the single source of truth for which tools
 * exist, what they do, and where they live.
 *
 * Kept out of the component so Platform Usage can count and name the tools
 * without importing a React view, and so the two can never disagree about what
 * the platform actually ships. The component owns only the icon and the accent
 * chip; every fact about a tool lives here.
 *
 * Workflow Builder is deliberately absent: its tile was pulled from the
 * Concierge homepage and workflow building now happens inside Ask IRA chat.
 */

export interface ConciergeToolTag {
  label: string;
  /** Legacy per-tag colour — tags render as a uniform brand chip today. */
  color: string;
}

export interface ConciergeTool {
  id: string;
  title: string;
  description: string;
  tags: ConciergeToolTag[];
  /** The app view this tool opens. */
  view: string;
}

export const CONCIERGE_TOOLS: ConciergeTool[] = [
  {
    id: 'racm-generator',
    title: 'RACM Generator',
    description: 'Generate Risk & Control Matrices from SOP and process documents',
    tags: [
      { label: 'RACM', color: 'bg-violet-100 text-violet-700' },
      { label: 'Risk', color: 'bg-risk-50 text-risk-700' },
      { label: 'SOP', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-racm',
  },
  {
    id: 'forensics',
    title: 'Document Forensics',
    description: 'Detect forgery, tampering, and AI-generated content in documents',
    tags: [
      { label: 'Compliance', color: 'bg-risk-50 text-risk-700' },
      { label: 'Detection', color: 'bg-mitigated-50 text-mitigated-700' },
    ],
    view: 'ai-concierge-forensics',
  },
  {
    id: 'table',
    title: 'Table Extractor',
    description: 'Extract structured tables from PDFs and images with AI',
    tags: [
      { label: 'Data', color: 'bg-sky-100 text-sky-700' },
      { label: 'Extraction', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-table-extractor',
  },
  {
    id: 'insights-anomaly',
    title: 'Insights & Anomaly Report',
    description: 'Automated statistical profiling, anomaly detection, and heuristic reports',
    tags: [
      { label: 'EDA', color: 'bg-sky-100 text-sky-700' },
      { label: 'Analytics', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Data', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-insights',
  },
  {
    id: 'image-analytics',
    title: 'Image Analytics',
    description: 'AI-powered image chat, comparison, and compliance auditing',
    tags: [
      { label: 'Image', color: 'bg-violet-100 text-violet-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Compare', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-image',
  },
  {
    id: 'speech-auditor',
    title: 'Speech Auditor',
    description: 'AI-powered call recording analysis with transcription, sentiment, and audit reports',
    tags: [
      { label: 'Speech', color: 'bg-fuchsia-100 text-fuchsia-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Sentiment', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-speech',
  },
  {
    id: 'medical-report-reader',
    title: 'Medical Report Reader',
    description: 'AI-powered forensic medical report analysis for insurance fraud detection',
    tags: [
      { label: 'Medical', color: 'bg-teal-100 text-teal-700' },
      { label: 'Forensics', color: 'bg-risk-50 text-risk-700' },
      { label: 'Insurance', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-medical',
  },
];
