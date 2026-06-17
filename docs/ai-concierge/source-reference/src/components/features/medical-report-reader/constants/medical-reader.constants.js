export const MR_TABS = {
	ANALYZER: { value: 'analyzer', label: 'Analyzer' },
	HISTORY: { value: 'history', label: 'History' },
};

export const MR_STAGES = {
	STARTUP: {
		key: 'startup',
		label: 'Initializing',
		color: 'text-gray-500',
		bgColor: 'bg-gray-500',
	},
	DOWNLOAD: {
		key: 'download',
		label: 'Downloading',
		color: 'text-blue-500',
		bgColor: 'bg-blue-500',
	},
	ANALYZING: {
		key: 'analyzing',
		label: 'Analyzing Reports',
		color: 'text-purple-500',
		bgColor: 'bg-purple-500',
	},
	REPORTING: {
		key: 'reporting',
		label: 'Generating Evidence',
		color: 'text-emerald-500',
		bgColor: 'bg-emerald-500',
	},
	COMPLETE: {
		key: 'complete',
		label: 'Complete',
		color: 'text-green-500',
		bgColor: 'bg-green-500',
	},
};

export const MR_STAGE_ORDER = [
	'startup',
	'download',
	'analyzing',
	'reporting',
	'complete',
];

export const MR_STATUSES = {
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

export const MR_MAX_FILE_SIZE_MB = 50;

export const MR_ESTIMATED_DURATION_MINUTES = 3;

export const MR_MAX_FILES = 20;

export const MR_ACCEPTED_FILE_TYPES = {
	'application/pdf': ['.pdf'],
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'image/webp': ['.webp'],
	'image/heic': ['.heic'],
	'image/heif': ['.heif'],
};

export const MR_RISK_LEVELS = {
	Low: {
		color: 'text-emerald-600',
		bgColor: 'bg-emerald-50',
		border: 'border-emerald-200',
	},
	Medium: {
		color: 'text-amber-600',
		bgColor: 'bg-amber-50',
		border: 'border-amber-200',
	},
	High: {
		color: 'text-orange-600',
		bgColor: 'bg-orange-50',
		border: 'border-orange-200',
	},
	Critical: {
		color: 'text-red-600',
		bgColor: 'bg-red-50',
		border: 'border-red-200',
	},
};
