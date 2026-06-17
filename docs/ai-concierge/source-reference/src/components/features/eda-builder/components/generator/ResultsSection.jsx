const BASE_URL = import.meta.env.VITE_STAGE_BASE_URL || '';

const resolveReportUrl = (url) => {
	if (!url) return url;
	// Absolute URLs (S3 presigned) — use as-is
	if (url.startsWith('http://') || url.startsWith('https://')) return url;
	// Relative paths (local dev) — prepend BE base URL
	return `${BASE_URL}${url}`;
};

const formatElapsed = (createdAt, completedAt) => {
	if (!createdAt || !completedAt) return null;
	const parseTs = (ts) => new Date(ts);
	const seconds = Math.floor((parseTs(completedAt) - parseTs(createdAt)) / 1000);
	if (seconds < 0) return null;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins === 0) return `${secs}s`;
	return `${mins}m ${secs}s`;
};

const ResultsSection = ({ result, fileNames, onNewAnalysis, onViewReport }) => {
	const reportUrls = result?.reportUrls || {};
	const evidenceUrls = result?.evidenceUrls || [];
	const summary = result?.summary;

	const reportTypes = [
		{
			key: 'understanding',
			label: 'Data Understanding',
			description: 'Schema, distributions, and data quality overview',
			icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
			color: 'from-blue-500/10 to-indigo-500/10',
			iconBg: 'bg-blue-50',
			iconColor: 'text-blue-600',
			borderAccent: 'hover:border-blue-300',
		},
		{
			key: 'anomaly',
			label: 'Anomaly Detection',
			description: 'Statistical outliers, Z-scores, and Benford analysis',
			icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
			color: 'from-amber-500/10 to-orange-500/10',
			iconBg: 'bg-amber-50',
			iconColor: 'text-amber-600',
			borderAccent: 'hover:border-amber-300',
		},
		{
			key: 'heuristic',
			label: 'Heuristic Analysis',
			description:
				'Business rules, patterns, and feature engineering insights',
			icon: 'M13 10V3L4 14h7v7l9-11h-7z',
			color: 'from-emerald-500/10 to-teal-500/10',
			iconBg: 'bg-emerald-50',
			iconColor: 'text-emerald-600',
			borderAccent: 'hover:border-emerald-300',
		},
	];

	const summaryStats = [
		{
			key: 'total_rows',
			label: 'Total Rows',
			value: summary?.total_rows?.toLocaleString(),
			icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
			iconColor: 'text-blue-500',
		},
		{
			key: 'total_columns',
			label: 'Total Columns',
			value: summary?.total_columns,
			icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7',
			iconColor: 'text-purple-500',
		},
		{
			key: 'files_analyzed',
			label: 'Files Analyzed',
			value: summary?.files_analyzed,
			icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
			iconColor: 'text-emerald-500',
		},
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
							Analysis Complete
							{formatElapsed(
								result?.createdAt,
								result?.completedAt,
							) && (
								<span className="ml-2 text-xs font-normal text-primary40">
									(
									{formatElapsed(
										result.createdAt,
										result.completedAt,
									)}
									)
								</span>
							)}
						</h3>
						<p className="text-sm text-primary40 mt-0.5">
							{fileNames?.join(', ')}
						</p>
					</div>
				</div>
				<button
					onClick={onNewAnalysis}
					className="px-4 py-2 text-sm font-medium border border-purple-100 text-purple-100 rounded-lg hover:bg-purple-100 hover:text-white transition-all duration-200"
				>
					New Analysis
				</button>
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

			{/* Report Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				{reportTypes.map(
					({
						key,
						label,
						description,
						icon,
						color,
						iconBg,
						iconColor,
						borderAccent,
					}) => {
						const rawUrl =
							reportUrls[key + '_standalone'] || reportUrls[key];
						const url = resolveReportUrl(rawUrl);
						const hasReport = !!url;

						return (
							<div
								key={key}
								className={`group relative border rounded-xl p-4 transition-all duration-200 bg-gradient-to-br ${color} ${
									hasReport
										? `${borderAccent} cursor-pointer hover:shadow-md hover:-translate-y-0.5`
										: 'opacity-50 grayscale'
								}`}
								onClick={() => hasReport && onViewReport?.(key)}
							>
								<div className="flex items-start gap-3">
									<div
										className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
									>
										<svg
											className={`w-5 h-5 ${iconColor}`}
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
									<div className="min-w-0">
										<h4 className="text-sm font-semibold text-primary80">
											{label}
										</h4>
										<p className="text-xs text-primary40 mt-0.5 leading-relaxed">
											{description}
										</p>
									</div>
								</div>
								{hasReport ? (
									<p className="text-xs font-semibold mt-3 text-purple-100 group-hover:translate-x-0.5 transition-transform duration-200">
										View Report &rarr;
									</p>
								) : (
									<p className="text-xs text-primary40 mt-3">
										Not available
									</p>
								)}
							</div>
						);
					},
				)}
			</div>

			{/* Evidence CSV downloads are accessible via inline buttons within each report */}

			{result?.llmCostUsd != null && result.llmCostUsd > 0 && (
				<p className="text-xs text-primary40 text-right">
					LLM cost: ${result.llmCostUsd.toFixed(4)}
				</p>
			)}
		</div>
	);
};

export default ResultsSection;
