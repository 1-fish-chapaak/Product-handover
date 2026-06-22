export const SA_TABS = {
	AUDITOR: { value: 'auditor', label: 'Auditor' },
	HISTORY: { value: 'history', label: 'History' },
};

export const SA_STAGES = {
	STARTUP: {
		key: 'startup',
		label: 'Initializing',
		color: 'text-gray-500',
		bgColor: 'bg-gray-500',
	},
	UPLOAD: {
		key: 'upload',
		label: 'Uploading',
		color: 'text-blue-500',
		bgColor: 'bg-blue-500',
	},
	PROCESSING: {
		key: 'processing',
		label: 'Processing',
		color: 'text-indigo-500',
		bgColor: 'bg-indigo-500',
	},
	TRANSCRIPTION: {
		key: 'transcription',
		label: 'Transcribing',
		color: 'text-purple-500',
		bgColor: 'bg-purple-500',
	},
	REPORT: {
		key: 'report',
		label: 'Generating Report',
		color: 'text-orange-500',
		bgColor: 'bg-orange-500',
	},
	SAVING: {
		key: 'saving',
		label: 'Saving Results',
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

export const SA_STAGE_ORDER = [
	'startup',
	'upload',
	'processing',
	'transcription',
	'report',
	'saving',
	'complete',
];

export const SA_STATUSES = {
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

export const SA_ACCEPTED_FILE_TYPES = {
	'audio/mpeg': ['.mp3', '.mpga', '.mpeg'],
	'audio/wav': ['.wav'],
	'audio/x-m4a': ['.m4a'],
	'audio/mp4': ['.m4a'],
	'video/mp4': ['.mp4'],
	'video/webm': ['.webm'],
	'audio/ogg': ['.ogg'],
	'audio/flac': ['.flac'],
	'audio/aac': ['.aac'],
};

export const SA_MAX_FILE_SIZE_MB = 300;

export const SA_ESTIMATED_DURATION_MINUTES = 5;
