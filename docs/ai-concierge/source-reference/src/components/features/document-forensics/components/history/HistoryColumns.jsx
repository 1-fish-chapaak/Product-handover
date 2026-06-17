import dayjs from 'dayjs';
import { FORENSICS_STATUSES } from '../../constants/forensics.constants';
import RiskBadge from '../report/RiskBadge';

export const createHistoryColumns = (onView, onDelete) => [
	{
		accessorKey: 'fileName',
		header: 'File Name',
		cell: ({ getValue }) => {
			const name = getValue();
			return (
				<span className="text-sm font-medium text-primary80">
					{name || '-'}
				</span>
			);
		},
	},
	{
		accessorKey: 'riskLevel',
		header: 'Risk Level',
		cell: ({ getValue }) => {
			const level = getValue();
			return level ? <RiskBadge riskLevel={level} size="sm" /> : '-';
		},
	},
	{
		accessorKey: 'compositeScore',
		header: 'Score',
		cell: ({ getValue }) => {
			const score = getValue();
			if (score == null) return '-';
			const color =
				score >= 70
					? 'text-emerald-600'
					: score >= 45
						? 'text-amber-600'
						: 'text-red-600';
			return <span className={`text-sm font-semibold ${color}`}>{score}</span>;
		},
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ getValue }) => {
			const status =
				FORENSICS_STATUSES[getValue()] || FORENSICS_STATUSES.PENDING;
			return (
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${status.color} ${status.bgColor}`}
				>
					{status.label}
				</span>
			);
		},
	},
	{
		accessorKey: 'createdAt',
		header: 'Date',
		cell: ({ getValue }) => {
			const val = getValue();
			return (
				<span className="text-sm text-primary60">
					{val ? dayjs(val).format('MMM D, YYYY h:mm A') : '-'}
				</span>
			);
		},
	},
	{
		id: 'actions',
		header: 'Actions',
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				{row.original.status !== 'CANCELLED' && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onView(row.original.externalId);
						}}
						className="text-xs text-purple-100 hover:text-purple-80 font-medium"
					>
						{row.original.status === 'COMPLETED' ||
						row.original.status === 'FAILED'
							? 'View'
							: 'Track'}
					</button>
				)}
				<button
					onClick={(e) => {
						e.stopPropagation();
						onDelete(row.original.externalId);
					}}
					className="text-xs text-red-500 hover:text-red-700 font-medium"
				>
					Delete
				</button>
			</div>
		),
	},
];
