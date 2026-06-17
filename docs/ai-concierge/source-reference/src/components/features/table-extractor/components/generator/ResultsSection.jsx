const ResultsSection = ({ result, fileNames, extractionFields, onNewAnalysis }) => {
	const rows = result?.extracted_rows || [];
	const summary = result?.summary;
	const validationFlags = result?.validation_flags || [];

	// Build a set of flagged row indices for quick lookup
	const flaggedRows = new Set(validationFlags.map((f) => f.row_index));

	// Columns to display — exclude internal _file and _page
	const displayKeys =
		rows.length > 0
			? Object.keys(rows[0]).filter((k) => k !== '_file' && k !== '_page')
			: (extractionFields || []).map((f) => f.name);

	const downloadCsv = () => {
		if (rows.length === 0) return;
		// Order: schema fields first (header fields, then table fields), then _file, _pg
		const schemaKeys = (extractionFields || []).map((f) => f.name);
		const metaKeys = ['_file', '_page'];
		const allRawKeys = Object.keys(rows[0]);
		const extraKeys = allRawKeys.filter(
			(k) => !schemaKeys.includes(k) && !metaKeys.includes(k),
		);
		const orderedKeys = [...schemaKeys, ...extraKeys, ...metaKeys];
		// Use _pg in CSV header to match standalone convention
		const csvHeader = orderedKeys
			.map((k) => (k === '_page' ? '_pg' : k))
			.join(',');
		const csvRows = rows
			.map((r) => orderedKeys.map((k) => JSON.stringify(r[k] ?? '')).join(','))
			.join('\n');
		const blob = new Blob([csvHeader + '\n' + csvRows], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `table_extractor_results_${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const summaryStats = [
		{
			key: 'total_rows',
			label: 'Total Rows',
			value: summary?.total_rows ?? rows.length,
			icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
			iconColor: 'text-blue-500',
		},
		{
			key: 'total_pages',
			label: 'Pages Processed',
			value: summary?.total_pages,
			icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
			iconColor: 'text-purple-500',
		},
		{
			key: 'files_processed',
			label: 'Files Processed',
			value: summary?.files_processed ?? fileNames?.length,
			icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
			iconColor: 'text-emerald-500',
		},
		...(validationFlags.length > 0
			? [
					{
						key: 'validation_flags',
						label: 'Validation Flags',
						value: validationFlags.length,
						icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
						iconColor: 'text-amber-500',
					},
				]
			: []),
	].filter((s) => s.value != null);

	return (
		<div className="space-y-5">
			{/* Success Header */}
			<div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl px-5 py-4">
				<div className="flex items-center gap-3">
					<div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
						<svg
							className="w-5 h-5 text-emerald-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<div>
						<h3 className="text-base font-semibold text-primary80">
							Extraction Complete
						</h3>
						<p className="text-sm text-primary40 mt-0.5">
							{fileNames?.join(', ')}
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						onClick={onNewAnalysis}
						className="px-4 py-2 text-sm font-medium border border-purple-100 text-purple-100 rounded-lg hover:bg-purple-100 hover:text-white transition-all duration-200"
					>
						New Extraction
					</button>
					<button
						onClick={downloadCsv}
						disabled={rows.length === 0}
						className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 inline-flex items-center gap-1.5"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						Export CSV ({rows.length})
					</button>
				</div>
			</div>

			{/* Summary Stats */}
			{summaryStats.length > 0 && (
				<div className="grid grid-cols-3 gap-3">
					{summaryStats.map(({ key, label, value, icon, iconColor }) => (
						<div
							key={key}
							className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3.5 shadow-sm"
						>
							<div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
								<svg
									className={`w-4.5 h-4.5 ${iconColor}`}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d={icon}
									/>
								</svg>
							</div>
							<div>
								<p className="text-xs text-primary40 leading-tight">
									{label}
								</p>
								<p className="text-lg font-semibold text-primary80 leading-tight mt-0.5">
									{value}
								</p>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Results Table */}
			{rows.length > 0 ? (
				<div className="border rounded-lg overflow-hidden">
					<table className="w-full">
						<thead className="bg-purple-4">
							<tr>
								{displayKeys.map((k) => (
									<th
										key={k}
										className="text-left px-4 py-3 text-xs font-medium text-primary60 whitespace-nowrap"
									>
										{k.replace(/_/g, ' ')}
									</th>
								))}
								<th className="text-left px-4 py-3 text-xs font-medium text-primary60">
									Source
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row, i) => (
								<tr
									key={i}
									className={`border-t border-gray-100 hover:bg-purple-2 transition-colors ${flaggedRows.has(i) ? 'bg-amber-50/50' : ''}`}
								>
									{displayKeys.map((k, j) => (
										<td
											key={j}
											className="px-4 py-3 text-sm text-primary80 truncate max-w-[250px]"
										>
											{String(row[k] ?? '---')}
										</td>
									))}
									<td className="px-4 py-3 text-xs text-primary40 font-mono">
										{row._file} (p.{row._page})
										{flaggedRows.has(i) && (
											<span
												className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700"
												title={
													validationFlags.find(
														(f) => f.row_index === i,
													)?.reason
												}
											>
												flagged
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="text-center py-12">
					<p className="text-primary40 text-sm">
						No rows were extracted. Try adjusting your schema or
						uploading a different document.
					</p>
				</div>
			)}

			{/* Validation Flags */}
			{validationFlags.length > 0 && (
				<div className="border border-amber-200 rounded-lg overflow-hidden">
					<div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
						<h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
							<svg
								className="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							Validation Flags ({validationFlags.length})
						</h4>
					</div>
					<div className="divide-y divide-amber-100 max-h-48 overflow-y-auto">
						{validationFlags.map((flag, i) => (
							<div
								key={i}
								className="px-4 py-2 flex items-start gap-3 text-sm"
							>
								<span className="text-amber-600 font-mono text-xs shrink-0 mt-0.5">
									Row {flag.row_index + 1}
								</span>
								<span className="text-primary60">{flag.reason}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default ResultsSection;
