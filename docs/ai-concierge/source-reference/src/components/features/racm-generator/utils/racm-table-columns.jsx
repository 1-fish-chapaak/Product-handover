import { CONFIDENCE_COLORS, RISK_RATING_COLORS } from '../constants/racm.constants';

const BadgeCell = ({ value, colorMap }) => {
	const colors = colorMap[value] || {
		text: 'text-gray-700',
		bg: 'bg-gray-50',
		border: 'border-gray-200',
	};
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors.text} ${colors.bg} ${colors.border}`}
		>
			{value || '-'}
		</span>
	);
};

const TruncateCell = ({ value, maxWidth = 260 }) => (
	<div className="truncate" style={{ maxWidth }} title={value || ''}>
		{value || '-'}
	</div>
);

export const createRacmColumns = () => [
	{
		accessorKey: 'riskId',
		header: 'Risk ID',
		size: 72,
	},
	{
		accessorKey: 'controlId',
		header: 'Control ID',
		size: 82,
	},
	{
		accessorKey: 'processArea',
		header: 'Process Area',
		size: 150,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={140} />,
	},
	{
		accessorKey: 'subProcess',
		header: 'Sub-Process',
		size: 170,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={160} />,
	},
	{
		accessorKey: 'riskCategory',
		header: 'Risk Category',
		size: 130,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={120} />,
	},
	{
		accessorKey: 'riskDescription',
		header: 'Risk Description',
		size: 280,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={270} />,
	},
	{
		accessorKey: 'riskRating',
		header: 'Rating',
		size: 100,
		cell: ({ getValue }) => (
			<BadgeCell value={getValue()} colorMap={RISK_RATING_COLORS} />
		),
	},
	{
		accessorKey: 'riskLikelihood',
		header: 'Likelihood',
		size: 95,
	},
	{
		accessorKey: 'riskImpact',
		header: 'Impact',
		size: 80,
	},
	{
		accessorKey: 'controlObjective',
		header: 'Control Objective',
		size: 240,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={230} />,
	},
	{
		accessorKey: 'controlActivity',
		header: 'Control Activity',
		size: 280,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={270} />,
	},
	{
		accessorKey: 'controlType',
		header: 'Type',
		size: 110,
	},
	{
		accessorKey: 'controlNature',
		header: 'Nature',
		size: 110,
	},
	{
		accessorKey: 'controlFrequency',
		header: 'Frequency',
		size: 110,
	},
	{
		accessorKey: 'controlOwner',
		header: 'Owner',
		size: 150,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={140} />,
	},
	{
		accessorKey: 'assertionsCoveredCEAVOP',
		header: 'Assertions',
		size: 110,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={100} />,
	},
	{
		accessorKey: 'sopSectionReference',
		header: 'SOP Section',
		size: 130,
		cell: ({ getValue }) => <TruncateCell value={getValue()} maxWidth={120} />,
	},
	{
		accessorKey: 'extractionConfidence',
		header: 'Confidence',
		size: 115,
		cell: ({ getValue }) => (
			<BadgeCell value={getValue()} colorMap={CONFIDENCE_COLORS} />
		),
	},
];
