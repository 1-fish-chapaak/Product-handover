import { TE_STATUSES } from '../../constants/table-extractor.constants';

const formatDate = (dateStr) => {
	if (!dateStr) return '-';
	const d = new Date(dateStr);
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
};

export const createHistoryColumns = (onViewJob, onDeleteJob) => [
	{
		header: 'Files',
		accessorKey: 'file_names',
		cell: ({ row }) => {
			const names = row.original.file_names || [];
			return (
				<div className="flex items-center gap-2">
					<svg
						className="w-4 h-4 text-purple-100 shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<span className="font-medium truncate max-w-[200px]">
						{names[0] || 'Unknown'}
					</span>
					{names.length > 1 && (
						<span className="text-xs text-primary40">
							+{names.length - 1} more
						</span>
					)}
				</div>
			);
		},
	},
	{
		header: 'Date',
		accessorKey: 'created_at',
		cell: ({ row }) => (
			<span className="text-primary60">
				{formatDate(row.original.created_at)}
			</span>
		),
	},
	{
		header: 'Status',
		accessorKey: 'status',
		cell: ({ row }) => {
			const statusConfig =
				TE_STATUSES[row.original.status] || TE_STATUSES.PENDING;
			return (
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig.color}`}
				>
					{statusConfig.label}
				</span>
			);
		},
	},
	{
		header: 'Fields',
		accessorKey: 'extraction_fields',
		cell: ({ row }) => {
			const fields = row.original.extraction_fields || [];
			return (
				<span className="text-primary40">
					{fields.length} field{fields.length !== 1 ? 's' : ''}
				</span>
			);
		},
	},
	{
		header: '',
		id: 'actions',
		cell: ({ row }) => {
			const job = row.original;
			const isViewable = job.status !== 'CANCELLED';

			return (
				<div
					className="flex items-center gap-3 justify-end"
					onClick={(e) => e.stopPropagation()}
				>
					{isViewable && (
						<button
							onClick={() => onViewJob(job.external_id)}
							className="text-xs text-purple-100 hover:text-purple-80 font-medium"
						>
							{job.status === 'COMPLETED' ? 'View' : 'Track'}
						</button>
					)}
					<button
						onClick={() => onDeleteJob(job.external_id)}
						className="text-xs text-red-500 hover:text-red-700 font-medium"
					>
						Delete
					</button>
				</div>
			);
		},
	},
];
