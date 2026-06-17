export const TE_TABS = {
	GENERATOR: { value: 'generator', label: 'Generator' },
	HISTORY: { value: 'history', label: 'History' },
};

export const TE_STAGES = {
	startup: { label: 'Initializing', color: 'text-gray-500', icon: 'Loader2' },
	download: {
		label: 'Downloading Files',
		color: 'text-blue-500',
		icon: 'Download',
	},
	doc_scan: {
		label: 'Document Scan',
		color: 'text-cyan-500',
		icon: 'Search',
	},
	extract_header: {
		label: 'Extracting Headers',
		color: 'text-purple-500',
		icon: 'FileText',
	},
	extract_tables: {
		label: 'Extracting Tables',
		color: 'text-indigo-500',
		icon: 'Table',
	},
	validation: {
		label: 'Validating',
		color: 'text-amber-500',
		icon: 'ShieldCheck',
	},
	finalize: {
		label: 'Finalizing',
		color: 'text-emerald-500',
		icon: 'CheckCircle2',
	},
	complete: { label: 'Complete', color: 'text-emerald-600', icon: 'CheckCircle2' },
};

export const TE_STAGE_ORDER = [
	'startup',
	'download',
	'doc_scan',
	'extract_header',
	'extract_tables',
	'validation',
	'finalize',
	'complete',
];

export const TE_STATUSES = {
	PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
	IN_PROGRESS: { label: 'Processing', color: 'bg-blue-100 text-blue-600' },
	COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-600' },
	FAILED: { label: 'Failed', color: 'bg-red-100 text-red-600' },
	CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

export const TE_ACCEPTED_FILE_TYPES = {
	'application/pdf': ['.pdf'],
};

export const TE_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const INITIAL_EXTRACTION_FIELDS = [
	{
		id: 'h1',
		name: 'invoice_number',
		type: 'string',
		description: 'Invoice ID',
		source: 'header',
	},
	{
		id: 'h2',
		name: 'invoice_date',
		type: 'string',
		description: 'Date YYYY-MM-DD',
		source: 'header',
	},
	{
		id: 't1',
		name: 'description',
		type: 'string',
		description: 'Item name',
		source: 'table',
	},
	{
		id: 't2',
		name: 'amount',
		type: 'number',
		description: 'Total price',
		source: 'table',
	},
];
