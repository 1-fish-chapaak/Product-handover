import { useState } from 'react';
import { toast } from 'react-toastify';
import { downloadImageAnalyticsReport } from '../../service/imageAnalytics.service';

const KPI_STATUS_STYLES = {
	compliant: 'bg-green-100 text-green-800',
	'non-compliant': 'bg-red-100 text-red-800',
};

// Legacy severity styles for old jobs that used non_compliances
const SEVERITY_STYLES = {
	high: 'bg-red-100 text-red-800',
	medium: 'bg-yellow-100 text-yellow-800',
	low: 'bg-blue-100 text-blue-800',
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

const AuditResultSection = ({ result, jobId, onNewAnalysis }) => {
	const auditResult = result?.result || {};
	const kpis = auditResult.kpis || [];
	const nonCompliances = auditResult.non_compliances || [];
	const summary = auditResult.summary || 'No summary available.';
	const reportUrls = result?.reportUrls || {};
	const [downloading, setDownloading] = useState(null);

	// Determine if this is a new KPI-based result or legacy non_compliances
	const isKpiBased = kpis.length > 0;

	const handleDownload = async (reportType) => {
		const isExcel = reportType.includes('excel');
		const extension = isExcel ? 'xlsx' : 'pdf';
		try {
			setDownloading(reportType);
			const blob = await downloadImageAnalyticsReport(jobId, reportType);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `audit_report.${extension}`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			toast.error(`Failed to download ${extension.toUpperCase()} report`);
		} finally {
			setDownloading(null);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
						<svg
							className="w-5 h-5 text-green-500"
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
					<h3 className="text-sm font-semibold text-primary80">
						Audit Complete
						{formatElapsed(result?.createdAt, result?.completedAt) && (
							<span className="ml-2 text-xs font-normal text-primary40">
								(
								{formatElapsed(result.createdAt, result.completedAt)}
								)
							</span>
						)}
					</h3>
				</div>
				<div className="flex items-center gap-3">
					{/* Download buttons */}
					{reportUrls.pdf_report && (
						<button
							onClick={() => handleDownload('pdf_report')}
							disabled={downloading === 'pdf_report'}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-md text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
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
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							{downloading === 'pdf_report' ? 'Downloading...' : 'PDF'}
						</button>
					)}
					{reportUrls.excel_report && (
						<button
							onClick={() => handleDownload('excel_report')}
							disabled={downloading === 'excel_report'}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
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
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							{downloading === 'excel_report'
								? 'Downloading...'
								: 'Excel'}
						</button>
					)}
					<button
						onClick={onNewAnalysis}
						className="px-4 py-1.5 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 transition-colors font-medium"
					>
						New Audit
					</button>
				</div>
			</div>

			{/* Summary */}
			<div className="bg-gray-50 rounded-lg p-6">
				<h4 className="text-xs font-semibold text-primary40 uppercase tracking-wider mb-2">
					Summary
				</h4>
				<p className="text-sm text-primary80 leading-relaxed">{summary}</p>
			</div>

			{/* KPI Evaluations (new format) */}
			{isKpiBased ? (
				<div>
					<h4 className="text-xs font-semibold text-primary40 uppercase tracking-wider mb-3">
						KPI Evaluations
						<span className="ml-2 text-primary60">({kpis.length})</span>
					</h4>

					{kpis.length > 0 ? (
						<div className="space-y-3">
							{kpis.map((kpi, i) => {
								const statusKey = (kpi.status || '').toLowerCase();
								const statusStyle =
									KPI_STATUS_STYLES[statusKey] ||
									'bg-gray-100 text-gray-600';

								return (
									<div
										key={i}
										className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
									>
										<div className="flex justify-between items-start mb-2">
											<h5 className="font-medium text-sm text-primary80">
												{kpi.kpiNumber}: {kpi.kpiDescription}
											</h5>
											<span
												className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle}`}
											>
												{kpi.status}
											</span>
										</div>

										<p className="text-sm text-primary60 mb-2">
											<span className="font-medium text-primary80">
												Evidence Images:
											</span>{' '}
											{kpi.evidenceImages?.length > 0
												? kpi.evidenceImages.join(', ')
												: 'None'}
										</p>

										<p className="text-sm text-primary60 mb-3">
											<span className="font-medium text-primary80">
												Reasoning:
											</span>{' '}
											{kpi.reasoning}
										</p>

										{statusKey !== 'compliant' &&
											kpi.recommendation && (
												<div className="bg-indigo-50 rounded p-3">
													<p className="text-sm text-indigo-900">
														<span className="font-medium">
															Recommendation:
														</span>{' '}
														{kpi.recommendation}
													</p>
												</div>
											)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-center py-8 bg-green-50 rounded-lg border border-green-100">
							<svg
								className="w-8 h-8 text-green-500 mx-auto mb-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p className="text-green-800 font-medium text-sm">
								No KPIs evaluated!
							</p>
						</div>
					)}
				</div>
			) : (
				/* Legacy Non-Compliances (backward compat for old jobs) */
				<div>
					<h4 className="text-xs font-semibold text-primary40 uppercase tracking-wider mb-3">
						Non-Compliances
						{nonCompliances.length > 0 && (
							<span className="ml-2 text-red-500">
								({nonCompliances.length})
							</span>
						)}
					</h4>

					{nonCompliances.length > 0 ? (
						<div className="space-y-3">
							{nonCompliances.map((nc, i) => (
								<div
									key={i}
									className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
								>
									<div className="flex justify-between items-start mb-2">
										<h5 className="font-medium text-sm text-primary80">
											{nc.image_name || nc.imageName}
										</h5>
										<span
											className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
												SEVERITY_STYLES[
													(nc.severity || '').toLowerCase()
												] || 'bg-gray-100 text-gray-600'
											}`}
										>
											{nc.severity}
										</span>
									</div>
									<p className="text-sm text-primary60 mb-3">
										<span className="font-medium text-primary80">
											Issue:
										</span>{' '}
										{nc.issue}
									</p>
									<div className="bg-indigo-50 rounded p-3">
										<p className="text-sm text-indigo-900">
											<span className="font-medium">
												Recommendation:
											</span>{' '}
											{nc.recommendation}
										</p>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8 bg-green-50 rounded-lg border border-green-100">
							<svg
								className="w-8 h-8 text-green-500 mx-auto mb-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p className="text-green-800 font-medium text-sm">
								No non-compliances found!
							</p>
						</div>
					)}
				</div>
			)}

			{/* LLM Cost */}
			{result?.llmCostUsd > 0 && (
				<p className="text-xs text-primary40 text-right">
					LLM Cost: ${result.llmCostUsd.toFixed(4)}
				</p>
			)}
		</div>
	);
};

export default AuditResultSection;
