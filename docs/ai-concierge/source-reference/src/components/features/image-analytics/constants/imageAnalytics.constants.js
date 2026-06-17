export const IA_TABS = {
	CHAT: { value: 'chat', label: 'Image Chat' },
	COMPARE: { value: 'compare', label: 'Compare' },
	AUDIT: { value: 'audit', label: 'Audit Report' },
	HISTORY: { value: 'history', label: 'History' },
};

export const IA_STAGES = {
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
	ANALYSIS: {
		key: 'analysis',
		label: 'Analyzing',
		color: 'text-purple-500',
		bgColor: 'bg-purple-500',
	},
	REPORT_GENERATION: {
		key: 'report_generation',
		label: 'Report Generation',
		color: 'text-orange-500',
		bgColor: 'bg-orange-500',
	},
	COMPLETE: {
		key: 'complete',
		label: 'Complete',
		color: 'text-green-500',
		bgColor: 'bg-green-500',
	},
};

export const IA_STAGE_ORDER = [
	'startup',
	'download',
	'analysis',
	'report_generation',
	'complete',
];

export const IA_STATUSES = {
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

export const IA_JOB_TYPES = {
	CHAT: {
		key: 'CHAT',
		label: 'Image Chat',
		color: 'text-indigo-600',
		bgColor: 'bg-indigo-50',
	},
	COMPARE: {
		key: 'COMPARE',
		label: 'Compare',
		color: 'text-cyan-600',
		bgColor: 'bg-cyan-50',
	},
	AUDIT: {
		key: 'AUDIT',
		label: 'Audit',
		color: 'text-amber-600',
		bgColor: 'bg-amber-50',
	},
};

export const IA_ESTIMATED_DURATION_MINUTES = {
	CHAT: 1,
	COMPARE: 3,
	AUDIT: 10,
};

export const IA_MAX_FILE_SIZE_MB = 50;

export const IA_CHAT_ACCEPTED_FILE_TYPES = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'image/webp': ['.webp'],
	'image/heic': ['.heic'],
	'image/heif': ['.heif'],
};

export const IA_COMPARE_ACCEPTED_FILE_TYPES = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'image/webp': ['.webp'],
};

export const IA_AUDIT_GUIDELINES_FILE_TYPES = {
	'application/pdf': ['.pdf'],
	'application/msword': ['.doc'],
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
		'.docx',
	],
	'text/plain': ['.txt'],
};

export const IA_AUDIT_IMAGE_FILE_TYPES = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'image/webp': ['.webp'],
};

export const IA_KPI_STATUSES = {
	COMPLIANT: {
		key: 'Compliant',
		label: 'Compliant',
		color: 'text-green-800',
		bgColor: 'bg-green-100',
	},
	'NON-COMPLIANT': {
		key: 'Non-Compliant',
		label: 'Non-Compliant',
		color: 'text-red-800',
		bgColor: 'bg-red-100',
	},
};

export const IA_MAX_GUIDELINES = 5;
