export const RACM_TABS = {
	GENERATOR: { value: 'generator', label: 'Generator' },
	HISTORY: { value: 'history', label: 'History' },
};

export const RACM_PHASES = {
	EXTRACT: {
		key: 'EXTRACT',
		label: 'Extracting',
		color: 'text-orange-500',
		bgColor: 'bg-orange-500',
	},
	CHUNK: {
		key: 'CHUNK',
		label: 'Chunking',
		color: 'text-blue-500',
		bgColor: 'bg-blue-500',
	},
	ANALYZE: {
		key: 'ANALYZE',
		label: 'Analyzing',
		color: 'text-indigo-500',
		bgColor: 'bg-indigo-500',
	},
	CONSOLIDATE: {
		key: 'CONSOLIDATE',
		label: 'Consolidating',
		color: 'text-purple-100',
		bgColor: 'bg-purple-100',
	},
	GAP_ANALYSIS: {
		key: 'GAP_ANALYSIS',
		label: 'Gap Analysis',
		color: 'text-teal-500',
		bgColor: 'bg-teal-500',
	},
	FINALIZE: {
		key: 'FINALIZE',
		label: 'Finalizing',
		color: 'text-green-500',
		bgColor: 'bg-green-500',
	},
};

export const RACM_PHASE_ORDER = [
	'EXTRACT',
	'CHUNK',
	'ANALYZE',
	'CONSOLIDATE',
	'GAP_ANALYSIS',
	'FINALIZE',
];

export const RACM_STATUSES = {
	PENDING: {
		key: 'PENDING',
		label: 'Pending',
		color: 'text-gray-500',
		bgColor: 'bg-gray-100',
	},
	IN_PROGRESS: {
		key: 'IN_PROGRESS',
		label: 'In Progress',
		color: 'text-blue-600',
		bgColor: 'bg-blue-50',
	},
	COMPLETED: {
		key: 'COMPLETED',
		label: 'Completed',
		color: 'text-green-600',
		bgColor: 'bg-green-50',
	},
	FAILED: {
		key: 'FAILED',
		label: 'Failed',
		color: 'text-red-600',
		bgColor: 'bg-red-50',
	},
	CANCELLED: {
		key: 'CANCELLED',
		label: 'Cancelled',
		color: 'text-gray-500',
		bgColor: 'bg-gray-50',
	},
};

export const ACCEPTED_FILE_TYPES = {
	'application/pdf': ['.pdf'],
	'text/csv': ['.csv'],
	'image/png': ['.png'],
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/tiff': ['.tiff'],
	'image/bmp': ['.bmp'],
	'image/webp': ['.webp'],
};

export const CONFIDENCE_COLORS = {
	EXTRACTED: {
		text: 'text-green-700',
		bg: 'bg-green-50',
		border: 'border-green-200',
	},
	INFERRED: {
		text: 'text-amber-700',
		bg: 'bg-amber-50',
		border: 'border-amber-200',
	},
	RECOMMENDED: {
		text: 'text-purple-700',
		bg: 'bg-purple-50',
		border: 'border-purple-200',
	},
};

export const RISK_RATING_COLORS = {
	Critical: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
	High: {
		text: 'text-orange-700',
		bg: 'bg-orange-50',
		border: 'border-orange-200',
	},
	Medium: {
		text: 'text-yellow-700',
		bg: 'bg-yellow-50',
		border: 'border-yellow-200',
	},
	Low: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
};

export const FIELD_GROUPS = {
	IDENTIFICATION: {
		label: 'Identification',
		fields: ['riskId', 'controlId', 'processArea', 'subProcess'],
	},
	RISK: {
		label: 'Risk Assessment',
		fields: [
			'riskCategory',
			'riskDescription',
			'riskRating',
			'riskLikelihood',
			'riskImpact',
		],
	},
	CONTROL: {
		label: 'Control Design',
		fields: [
			'controlObjective',
			'controlActivity',
			'controlType',
			'controlNature',
			'controlFrequency',
			'controlOwner',
			'controlEvidence',
		],
	},
	FINANCIAL: {
		label: 'Financial Reporting',
		fields: [
			'assertionsCoveredCEAVOP',
			'financialStatementLineItem',
			'regulatoryReference',
		],
	},
	REPORTING: {
		label: 'Reporting & Evidence',
		fields: ['keyReport', 'ipeIceDetails'],
	},
	GOVERNANCE: {
		label: 'Governance',
		fields: [
			'segregationOfDuties',
			'managementReviewControl',
			'extractionConfidence',
			'sopSectionReference',
		],
	},
};
