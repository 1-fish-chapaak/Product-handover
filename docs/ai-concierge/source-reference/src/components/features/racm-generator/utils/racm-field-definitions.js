export const RACM_FIELDS = [
	{ key: 'riskId', label: 'Risk ID', group: 'IDENTIFICATION', width: 80 },
	{ key: 'controlId', label: 'Control ID', group: 'IDENTIFICATION', width: 90 },
	{
		key: 'processArea',
		label: 'Process Area',
		group: 'IDENTIFICATION',
		width: 160,
	},
	{ key: 'subProcess', label: 'Sub-Process', group: 'IDENTIFICATION', width: 160 },
	{ key: 'riskCategory', label: 'Risk Category', group: 'RISK', width: 140 },
	{ key: 'riskDescription', label: 'Risk Description', group: 'RISK', width: 280 },
	{ key: 'riskRating', label: 'Risk Rating', group: 'RISK', width: 110 },
	{ key: 'riskLikelihood', label: 'Likelihood', group: 'RISK', width: 100 },
	{ key: 'riskImpact', label: 'Impact', group: 'RISK', width: 80 },
	{
		key: 'controlObjective',
		label: 'Control Objective',
		group: 'CONTROL',
		width: 240,
	},
	{
		key: 'controlActivity',
		label: 'Control Activity',
		group: 'CONTROL',
		width: 280,
	},
	{ key: 'controlType', label: 'Control Type', group: 'CONTROL', width: 120 },
	{ key: 'controlNature', label: 'Control Nature', group: 'CONTROL', width: 140 },
	{ key: 'controlFrequency', label: 'Frequency', group: 'CONTROL', width: 120 },
	{ key: 'controlOwner', label: 'Control Owner', group: 'CONTROL', width: 160 },
	{
		key: 'controlEvidence',
		label: 'Control Evidence',
		group: 'CONTROL',
		width: 200,
	},
	{
		key: 'assertionsCoveredCEAVOP',
		label: 'Assertions (CEAVOP)',
		group: 'FINANCIAL',
		width: 160,
	},
	{
		key: 'financialStatementLineItem',
		label: 'FS Line Item',
		group: 'FINANCIAL',
		width: 180,
	},
	{
		key: 'regulatoryReference',
		label: 'Regulatory Ref',
		group: 'FINANCIAL',
		width: 160,
	},
	{ key: 'keyReport', label: 'Key Report', group: 'REPORTING', width: 160 },
	{
		key: 'ipeIceDetails',
		label: 'IPE/ICE Details',
		group: 'REPORTING',
		width: 180,
	},
	{
		key: 'segregationOfDuties',
		label: 'Segregation of Duties',
		group: 'GOVERNANCE',
		width: 200,
	},
	{
		key: 'managementReviewControl',
		label: 'Mgmt Review Control',
		group: 'GOVERNANCE',
		width: 200,
	},
	{
		key: 'extractionConfidence',
		label: 'Confidence',
		group: 'GOVERNANCE',
		width: 120,
	},
	{
		key: 'sopSectionReference',
		label: 'SOP Section Ref',
		group: 'GOVERNANCE',
		width: 160,
	},
];

export const getFieldsByGroup = (group) =>
	RACM_FIELDS.filter((f) => f.group === group);

export const getFieldByKey = (key) => RACM_FIELDS.find((f) => f.key === key);
