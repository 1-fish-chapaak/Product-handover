import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
	useReactTable,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
} from '@tanstack/react-table';
import { createRacmColumns } from '../../utils/racm-table-columns.jsx';

const EditableCell = ({ value, onSave, onCancel }) => {
	const [editValue, setEditValue] = useState(value || '');
	const inputRef = useRef(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	const handleKeyDown = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSave(editValue);
		} else if (e.key === 'Escape') {
			onCancel();
		}
	};

	const isLong = (value || '').length > 60;

	if (isLong) {
		return (
			<textarea
				ref={inputRef}
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={() => onSave(editValue)}
				onKeyDown={handleKeyDown}
				className="w-full min-w-[200px] px-2 py-1 text-sm border border-purple-100 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-40 resize-y"
				rows={3}
			/>
		);
	}

	return (
		<input
			ref={inputRef}
			type="text"
			value={editValue}
			onChange={(e) => setEditValue(e.target.value)}
			onBlur={() => onSave(editValue)}
			onKeyDown={handleKeyDown}
			className="w-full min-w-[80px] px-2 py-1 text-sm border border-purple-100 rounded bg-white focus:outline-none focus:ring-1 focus:ring-purple-40"
		/>
	);
};

const RACMResultsTable = ({ entries, onRowClick, onCellEdit }) => {
	const [sorting, setSorting] = useState([]);
	const [globalFilter, setGlobalFilter] = useState('');
	const [canScrollRight, setCanScrollRight] = useState(false);
	const [editingCell, setEditingCell] = useState(null); // { rowIndex, columnId }
	const scrollRef = useRef(null);

	const columns = useMemo(() => createRacmColumns(), []);

	const table = useReactTable({
		data: entries || [],
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		initialState: {
			pagination: { pageSize: 25 },
		},
	});

	const checkScroll = useCallback(() => {
		const el = scrollRef.current;
		if (el) {
			setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 1);
		}
	}, []);

	useEffect(() => {
		checkScroll();
		window.addEventListener('resize', checkScroll);
		return () => window.removeEventListener('resize', checkScroll);
	}, [checkScroll, entries]);

	const handleCellDoubleClick = (e, rowIndex, columnId) => {
		e.stopPropagation();
		if (onCellEdit) {
			setEditingCell({ rowIndex, columnId });
		}
	};

	const handleCellSave = (rowIndex, columnId, newValue) => {
		onCellEdit?.(rowIndex, columnId, newValue);
		setEditingCell(null);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<input
					type="text"
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					placeholder="Search entries..."
					className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-40"
				/>
				<div className="flex items-center gap-3">
					{canScrollRight && (
						<span className="text-xs text-primary40 animate-pulse">
							Scroll right for more columns →
						</span>
					)}
					<span className="text-sm text-primary40">
						{table.getFilteredRowModel().rows.length} entries
					</span>
				</div>
			</div>

			<div className="relative border rounded-lg">
				<div
					ref={scrollRef}
					className="overflow-x-auto"
					onScroll={checkScroll}
				>
					<table className="min-w-max">
						<thead className="bg-purple-4 sticky top-0 z-10">
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<th
											key={header.id}
											className="text-left px-3 py-2.5 text-xs font-semibold text-primary60 whitespace-nowrap cursor-pointer select-none border-b border-gray-200"
											style={{
												minWidth: header.getSize(),
												width: header.getSize(),
											}}
											onClick={header.column.getToggleSortingHandler()}
										>
											<div className="flex items-center gap-1">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{header.column.getIsSorted() ===
													'asc' && ' ↑'}
												{header.column.getIsSorted() ===
													'desc' && ' ↓'}
											</div>
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
									onClick={() => onRowClick?.(row.original)}
								>
									{row.getVisibleCells().map((cell) => {
										const isEditing =
											editingCell?.rowIndex === row.index &&
											editingCell?.columnId === cell.column.id;
										const fieldKey = cell.column.id;

										return (
											<td
												key={cell.id}
												className="px-3 py-2 text-sm text-primary80 whitespace-nowrap"
												style={{
													minWidth: cell.column.getSize(),
													width: cell.column.getSize(),
												}}
												onDoubleClick={(e) =>
													handleCellDoubleClick(
														e,
														row.index,
														fieldKey,
													)
												}
											>
												{isEditing ? (
													<EditableCell
														value={
															row.original[fieldKey]
														}
														onSave={(val) =>
															handleCellSave(
																row.index,
																fieldKey,
																val,
															)
														}
														onCancel={() =>
															setEditingCell(null)
														}
													/>
												) : (
													flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{canScrollRight && (
					<div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none rounded-r-lg" />
				)}
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<button
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
						className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 hover:bg-purple-4 text-primary60"
					>
						Previous
					</button>
					<button
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
						className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 hover:bg-purple-4 text-primary60"
					>
						Next
					</button>
				</div>
				<div className="flex items-center gap-3">
					<select
						value={table.getState().pagination.pageSize}
						onChange={(e) => table.setPageSize(Number(e.target.value))}
						className="border border-gray-300 rounded-md px-2 py-1 text-sm text-primary60"
					>
						{[25, 50, 100].map((size) => (
							<option key={size} value={size}>
								{size} / page
							</option>
						))}
					</select>
					<span className="text-sm text-primary40">
						Page {table.getState().pagination.pageIndex + 1} of{' '}
						{table.getPageCount()}
					</span>
				</div>
			</div>
		</div>
	);
};

export default RACMResultsTable;
