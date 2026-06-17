import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { toast } from 'react-toastify';
import {
	getMedicalReaderJobs,
	deleteMedicalReaderJob,
} from '../../service/medical-reader.service';
import { getMedicalReaderHistoryColumns } from './HistoryColumns';

const HistoryTab = ({ onViewJob }) => {
	const queryClient = useQueryClient();
	const [deleteId, setDeleteId] = useState(null);

	const { data: jobs = [] } = useQuery({
		queryKey: ['medical-reader-jobs'],
		queryFn: getMedicalReaderJobs,
		refetchInterval: (query) => {
			const data = query?.state?.data;
			if (!data || !Array.isArray(data)) return false;
			const hasActive = data.some(
				(j) => j.status === 'PENDING' || j.status === 'IN_PROGRESS',
			);
			return hasActive ? 3000 : false;
		},
	});

	const handleDelete = async (jobId) => {
		const confirmed = window.confirm(
			'Are you sure you want to delete this job?',
		);
		if (!confirmed) return;
		try {
			await deleteMedicalReaderJob(jobId);
			queryClient.invalidateQueries({ queryKey: ['medical-reader-jobs'] });
			toast.info('Job deleted');
		} catch {
			toast.error('Failed to delete job');
		}
	};

	const columns = useMemo(
		() =>
			getMedicalReaderHistoryColumns({
				onView: onViewJob,
				onDelete: handleDelete,
			}),
		[onViewJob],
	);

	const table = useReactTable({
		data: jobs,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (jobs.length === 0) {
		return (
			<div className="text-center py-16">
				<p className="text-sm text-primary40">
					No analysis jobs yet. Go to the Analyzer tab to start your first
					analysis.
				</p>
			</div>
		);
	}

	return (
		<div className="border border-gray-100 rounded-xl overflow-hidden">
			<table className="w-full">
				<thead>
					{table.getHeaderGroups().map((hg) => (
						<tr key={hg.id} className="bg-gray-50/80">
							{hg.headers.map((header) => (
								<th
									key={header.id}
									className="px-4 py-3 text-left text-xs font-medium text-primary40 uppercase tracking-wider"
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
							className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors"
						>
							{row.getVisibleCells().map((cell) => (
								<td key={cell.id} className="px-4 py-3">
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
	);
};

export default HistoryTab;
