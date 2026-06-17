import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	getImageAnalyticsJobs,
	deleteImageAnalyticsJob,
} from '../../service/imageAnalytics.service';
import { createHistoryColumns } from './HistoryColumns';
import Spinner from '@/components/elements/loading/Spinner';

const HistoryTab = ({ onViewJob }) => {
	const queryClient = useQueryClient();
	const [deleteJobId, setDeleteJobId] = useState(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const { data: jobs, isLoading } = useQuery({
		queryKey: ['ia-jobs-history'],
		queryFn: getImageAnalyticsJobs,
		refetchInterval: (query) => {
			const data = query?.state?.data;
			if (!data?.length) return false;
			const hasActiveJobs = data.some(
				(job) => job.status === 'PENDING' || job.status === 'IN_PROGRESS',
			);
			return hasActiveJobs ? 3000 : false;
		},
		refetchIntervalInBackground: true,
	});

	const confirmDelete = useCallback((jobId) => {
		setDeleteJobId(jobId);
	}, []);

	const handleDelete = async () => {
		if (!deleteJobId) return;
		try {
			setIsDeleting(true);
			await deleteImageAnalyticsJob(deleteJobId);
			toast.success('Job deleted successfully');
			queryClient.invalidateQueries({
				queryKey: ['ia-jobs-history'],
			});
		} catch {
			toast.error('Failed to delete job');
		} finally {
			setIsDeleting(false);
			setDeleteJobId(null);
		}
	};

	const columns = useMemo(
		() => createHistoryColumns(onViewJob, confirmDelete),
		[onViewJob, confirmDelete],
	);

	const table = useReactTable({
		data: jobs || [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner />
			</div>
		);
	}

	if (!jobs?.length) {
		return (
			<div className="text-center py-12">
				<p className="text-primary40 text-sm">
					No Image Analytics jobs yet. Try Image Chat, Compare, or Audit
					Report.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="border rounded-lg overflow-hidden">
				<table className="w-full">
					<thead className="bg-purple-4">
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="text-left px-4 py-3 text-xs font-medium text-primary60"
									>
										{flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								className="border-t border-gray-100 hover:bg-purple-2 cursor-pointer transition-colors"
								onClick={() => {
									if (row.original.status !== 'CANCELLED') {
										onViewJob(
											row.original.externalId,
											row.original.jobType,
										);
									}
								}}
							>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										className="px-4 py-3 text-sm text-primary80"
									>
										{flexRender(
											cell.column.columnDef.cell,
											cell.getContext(),
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<Dialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="text-primary80">
							Delete Job
						</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-primary60 mt-2">
						This will permanently delete this job and cannot be undone.
						Continue?
					</p>
					<div className="flex justify-end gap-3 mt-4">
						<button
							onClick={() => setDeleteJobId(null)}
							className="px-4 py-2 text-sm font-medium text-primary60 border rounded-lg hover:bg-gray-50"
						>
							Cancel
						</button>
						<button
							onClick={handleDelete}
							disabled={isDeleting}
							className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default HistoryTab;
