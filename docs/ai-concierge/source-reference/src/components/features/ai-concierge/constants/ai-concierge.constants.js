import {
	TbTableOptions,
	TbChartHistogram,
	TbShieldCheck,
	TbPhoto,
	TbMicrophone,
	TbHeartRateMonitor,
} from 'react-icons/tb';

/**
 * AI Concierge feature registry — single source of truth for all AI features.
 * To add a new AI feature, add an entry here and create its page component.
 */
export const AI_FEATURES = [
	{
		id: 'racm-generator',
		name: 'RACM Generator',
		description:
			'Generate Risk Assessment and Control Matrices from SOP documents',
		icon: TbTableOptions,
		route: 'racm-generator',
		tags: ['RACM', 'Risk', 'SOP'],
		beta: true,
	},
	{
		id: 'eda-builder',
		name: 'Insights & Anomaly Report',
		description:
			'Automated statistical profiling, anomaly detection, and heuristic reports',
		icon: TbChartHistogram,
		route: 'eda-builder',
		tags: ['EDA', 'Analytics', 'Data'],
		beta: true,
	},
	{
		id: 'document-forensics',
		name: 'Document Forensics',
		description: 'Analyze documents for forgery, tampering, and AI generation',
		icon: TbShieldCheck,
		route: 'document-forensics',
		tags: ['Forensics', 'Document', 'Fraud'],
		beta: true,
	},
	{
		id: 'image-analytics',
		name: 'Image Analytics',
		description: 'AI-powered image chat, comparison, and compliance auditing',
		icon: TbPhoto,
		route: 'image-analytics',
		tags: ['Image', 'Audit', 'Compare'],
		beta: true,
	},
	{
		id: 'speech-auditor',
		name: 'Speech Auditor',
		description:
			'AI-powered call recording analysis with transcription, sentiment, and audit reports',
		icon: TbMicrophone,
		route: 'speech-auditor',
		tags: ['Speech', 'Audit', 'Sentiment'],
		beta: true,
	},
	{
		id: 'medical-report-reader',
		name: 'Medical Report Reader',
		description:
			'AI-powered forensic medical report analysis for insurance fraud detection',
		icon: TbHeartRateMonitor,
		route: 'medical-report-reader',
		tags: ['Medical', 'Forensics', 'Insurance'],
		beta: true,
	},
];
