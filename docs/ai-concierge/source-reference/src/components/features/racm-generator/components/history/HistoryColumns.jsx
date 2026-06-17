import dayjs from 'dayjs';
import { RACM_STATUSES } from '../../constants/racm.constants';

export const createHistoryColumns = (onView, onDelete) => [
	{
		accessorKey: 'fileName',
		header: 'File Name',
		cell: ({ getValue }) => (
			<span className="text-sm font-medium text-primary80">
				{getValue() || '-'}
			</span>
		),
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
		accessorKey: 'status',
		header: 'Status',
		cell: ({ getValue }) => {
			const status = RACM_STATUSES[getValue()] || RACM_STATUSES.PENDING;
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
		id: 'actions',
		header: 'Actions',
		cell: ({ row }) => (
			<div className="flex items-center gap-2">
				{row.original.status !== 'CANCELLED' && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onView(row.original.jobId);
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
						onDelete(row.original.jobId);
					}}
					className="text-xs text-red-500 hover:text-red-700 font-medium"
				>
					Delete
				</button>
			</div>
		),
	},
];
