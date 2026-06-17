export const FORENSICS_TABS = {
	ANALYZER: { value: 'analyzer', label: 'Analyzer' },
	HISTORY: { value: 'history', label: 'History' },
};

export const FORENSICS_STAGES = {
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
		label: 'Analyzing',
		color: 'text-purple-500',
		bgColor: 'bg-purple-500',
	},
	COMPLETE: {
		key: 'complete',
		label: 'Scoring',
		color: 'text-emerald-500',
		bgColor: 'bg-emerald-500',
	},
	DONE: {
		key: 'done',
		label: 'Complete',
		color: 'text-green-500',
		bgColor: 'bg-green-500',
	},
};

export const FORENSICS_STAGE_ORDER = [
	'startup',
	'download',
	'analyzing',
	'complete',
	'done',
];

export const FORENSICS_STATUSES = {
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

export const FORENSICS_MAX_FILE_SIZE_MB = 50;

export const FORENSICS_ESTIMATED_DURATION_MINUTES = 2;

export const FORENSICS_ACCEPTED_FILE_TYPES = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
	'application/pdf': ['.pdf'],
	'image/tiff': ['.tiff', '.tif'],
	'image/bmp': ['.bmp'],
	'image/webp': ['.webp'],
};

export const RISK_LEVELS = {
	GENUINE: {
		key: 'GENUINE',
		label: 'Genuine',
		color: 'text-emerald-700',
		bgColor: 'bg-emerald-50',
		borderColor: 'border-emerald-200',
		dotColor: 'bg-emerald-500',
	},
	LOW_RISK: {
		key: 'LOW_RISK',
		label: 'Low Risk',
		color: 'text-blue-700',
		bgColor: 'bg-blue-50',
		borderColor: 'border-blue-200',
		dotColor: 'bg-blue-500',
	},
	MEDIUM_RISK: {
		key: 'MEDIUM_RISK',
		label: 'Medium Risk',
		color: 'text-amber-700',
		bgColor: 'bg-amber-50',
		borderColor: 'border-amber-200',
		dotColor: 'bg-amber-500',
	},
	HIGH_RISK: {
		key: 'HIGH_RISK',
		label: 'High Risk',
		color: 'text-orange-700',
		bgColor: 'bg-orange-50',
		borderColor: 'border-orange-200',
		dotColor: 'bg-orange-500',
	},
	FORGED: {
		key: 'FORGED',
		label: 'Forged',
		color: 'text-red-700',
		bgColor: 'bg-red-50',
		borderColor: 'border-red-200',
		dotColor: 'bg-red-500',
	},
};

// User-facing metadata for each forensic module. The `description` field
// shows as a subtitle below the module title on the Analyzer report and
// must be written for NON-TECHNICAL auditors — describe WHAT the module
// is looking for in plain English, not WHICH algorithms it uses.
export const FORENSIC_MODULE_META = {
	pixel_forensics: {
		label: 'Pixel Forensics',
		description:
			'Looks for tampering marks like splicing, erasing, and pixel-level edits',
		color: 'border-l-blue-500',
	},
	content_validation: {
		label: 'Content Validation',
		description: 'AI review of document content — dates, amounts, and context',
		color: 'border-l-violet-500',
	},
	truesight_analysis: {
		label: 'TrueSight AI Detection',
		description:
			'Detects images created by AI tools (ChatGPT, DALL-E, Gemini, Stable Diffusion)',
		color: 'border-l-cyan-500',
	},
	image_quality: {
		label: 'Image Quality',
		description: 'Checks if the document was photographed clearly and in focus',
		color: 'border-l-gray-500',
	},
	metadata_analysis: {
		label: 'Metadata Analysis',
		description: 'Checks the file\u2019s hidden camera and editing history',
		color: 'border-l-yellow-500',
	},
	content_verifier: {
		label: 'Content Verifier',
		description:
			'Checks dates, math, GST rates, and identifiers for logical errors',
		color: 'border-l-emerald-500',
	},
	font_forensics: {
		label: 'Font Forensics',
		description:
			'Detects mismatched or substituted fonts \u2014 a sign of text editing',
		color: 'border-l-indigo-500',
	},
	pdf_structure: {
		label: 'PDF Structure',
		description:
			'Checks the PDF\u2019s internal structure for signs of editing after creation',
		color: 'border-l-pink-500',
	},
	jpeg_forensics: {
		label: 'JPEG Forensics',
		description:
			'Detects if the image was opened and re-saved in editing software',
		color: 'border-l-orange-500',
	},
	copy_move: {
		label: 'Copy-Move Detection',
		description:
			'Finds areas of the image that were copy-pasted from other parts of the same image',
		color: 'border-l-red-500',
	},
	pixel_metrics_det: {
		label: 'Pixel Metrics',
		description:
			'Checks the image for editing traces invisible to the naked eye',
		color: 'border-l-teal-500',
	},
	qr_scanner: {
		label: 'QR Scanner',
		description:
			'Decodes QR codes and checks that their data matches the printed text',
		color: 'border-l-lime-500',
	},
	gstin_verifier: {
		label: 'GSTIN Verifier',
		description:
			'Validates GSTIN format, state codes, and buyer/seller tax consistency',
		color: 'border-l-amber-500',
	},
	handwriting_forensics: {
		label: 'Handwriting Forensics',
		description:
			'Checks handwritten signatures and notes for signs of digital tampering',
		color: 'border-l-fuchsia-500',
	},
	ink_print_analysis: {
		label: 'Ink & Print Analysis',
		description:
			'Checks for print quality issues that suggest a fake or photocopy',
		color: 'border-l-rose-500',
	},
	template_detection: {
		label: 'Template Detection',
		description:
			'Flags invoices generated by software template services instead of real businesses',
		color: 'border-l-purple-500',
	},
	document_classification: {
		label: 'Document Classification',
		description: 'Identifies what kind of document this is',
		color: 'border-l-slate-500',
	},
};
