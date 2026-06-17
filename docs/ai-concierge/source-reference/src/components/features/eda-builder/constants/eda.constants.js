export const EDA_TABS = {
	GENERATOR: { value: 'generator', label: 'Generator' },
	HISTORY: { value: 'history', label: 'History' },
};

export const EDA_STAGES = {
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
	INGEST: {
		key: 'ingest',
		label: 'Ingesting',
		color: 'text-cyan-500',
		bgColor: 'bg-cyan-500',
	},
	LINK: {
		key: 'link',
		label: 'Linking',
		color: 'text-indigo-500',
		bgColor: 'bg-indigo-500',
	},
	PROFILE: {
		key: 'profile',
		label: 'Profiling',
		color: 'text-violet-500',
		bgColor: 'bg-violet-500',
	},
	REPORT_UNDERSTANDING: {
		key: 'report_understanding',
		label: 'Understanding',
		color: 'text-orange-500',
		bgColor: 'bg-orange-500',
	},
	REPORT_ANOMALY: {
		key: 'report_anomaly',
		label: 'Anomaly Detection',
		color: 'text-red-500',
		bgColor: 'bg-red-500',
	},
	REPORT_HEURISTIC: {
		key: 'report_heuristic',
		label: 'Heuristic Analysis',
		color: 'text-green-500',
		bgColor: 'bg-green-500',
	},
};

export const EDA_STAGE_ORDER = [
	'startup',
	'download',
	'ingest',
	'link',
	'profile',
	'report_understanding',
	'report_anomaly',
	'report_heuristic',
];

export const EDA_STATUSES = {
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

export const EDA_MAX_FILE_SIZE_MB = 200;

export const EDA_ESTIMATED_DURATION_MINUTES = 5;

export const EDA_MAX_FILES = 10;

export const EDA_ACCEPTED_FILE_TYPES = {
	'text/csv': ['.csv'],
	'application/vnd.ms-excel': ['.xls'],
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

export const EDA_REPORT_TYPES = [
	{
		key: 'understanding',
		label: 'Data Understanding',
		description: 'Schema, distributions, and data quality overview',
		icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
	},
	{
		key: 'anomaly',
		label: 'Anomaly Detection',
		description: 'Statistical outliers, Z-scores, and Benford analysis',
		icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
	},
	{
		key: 'heuristic',
		label: 'Heuristic Analysis',
		description: 'Business rules, patterns, and feature engineering insights',
		icon: 'M13 10V3L4 14h7v7l9-11h-7z',
	},
];
