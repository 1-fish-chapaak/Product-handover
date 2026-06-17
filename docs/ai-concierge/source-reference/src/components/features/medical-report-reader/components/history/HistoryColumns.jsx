import dayjs from 'dayjs';
import { MR_STATUSES } from '../../constants/medical-reader.constants';

const getDisplayFileName = (name) => {
	if (!name) return 'No files';
	// Strip folder path prefixes, show only the filename
	const parts = name.split('/');
	return parts[parts.length - 1];
};

export const getMedicalReaderHistoryColumns = ({ onView, onDelete }) => [
	{
		accessorKey: 'fileNames',
		header: 'Files',
		cell: ({ row }) => {
			const names = row.original.fileNames || [];
			const displayName = getDisplayFileName(names[0]);
			const extra = names.length > 1 ? ` +${names.length - 1} more` : '';
			return (
				<span className="text-sm text-primary80">
					{displayName}
					{extra && <span className="text-primary40">{extra}</span>}
				</span>
			);
		},
	},
	{
		accessorKey: 'createdAt',
		header: 'Date',
		cell: ({ row }) => (
			<span className="text-sm text-primary60">
				{row.original.createdAt
					? dayjs(row.original.createdAt).format('MMM DD, YYYY h:mm A')
					: '—'}
			</span>
		),
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => {
			const status = MR_STATUSES[row.original.status] || MR_STATUSES.PENDING;
			return (
				<span className={`text-sm font-medium ${status.color}`}>
					{status.label}
				</span>
			);
		},
	},
	{
		id: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			const { status, externalId } = row.original;
			const canView = status !== 'CANCELLED';
			return (
				<div className="flex items-center gap-3">
					{canView && (
						<button
							onClick={() => onView(externalId)}
							className="text-sm text-purple-100 hover:text-purple-80 font-medium transition-colors"
						>
							{status === 'COMPLETED'
								? 'View'
								: status === 'IN_PROGRESS' || status === 'PENDING'
									? 'Track'
									: 'View'}
						</button>
					)}
					<button
						onClick={() => onDelete(externalId)}
						className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
					>
						Delete
					</button>
				</div>
			);
		},
	},
];
