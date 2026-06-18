import { CheckCircle, Download, AlertTriangle, Shield } from 'lucide-react';
import { MR_RISK_LEVELS } from '../../constants/medical-reader.constants';
import axiosClientV1 from '@/lib/axios';
import AnalysisReport from './AnalysisReport';

const ResultsSection = ({ result, fileNames, jobId, onNewAnalysis }) => {
	const summary = result?.summary;
	const riskLevel = summary?.overall_risk_level || 'Medium';
	const riskStyle = MR_RISK_LEVELS[riskLevel] || MR_RISK_LEVELS.Medium;

	const handleDownloadEvidence = async () => {
		if (!result?.evidenceUrls?.length) return;
		try {
			const response = await axiosClientV1.get(
				`/medical-reader/jobs/${jobId}/evidence/medical_forensic_analysis.csv`,
				{ responseType: 'blob' },
			);
			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', 'medical_forensic_analysis.csv');
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		} catch {
			// Error handled by axios interceptor
		}
	};

	return (
		<div className="space-y-6">
			{/* Success Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
						<CheckCircle className="w-5 h-5 text-green-500" />
					</div>
					<div>
						<h3 className="text-sm font-semibold text-primary80">
							Analysis Complete
						</h3>
						<p className="text-xs text-primary40">
							{summary?.total_files_analyzed || fileNames?.length || 0}{' '}
							report(s) analyzed
							{summary?.overall_patient_name &&
							summary.overall_patient_name !== 'Unknown'
								? ` — ${summary.overall_patient_name}`
								: ''}
						</p>
					</div>
				</div>
				<button
					onClick={onNewAnalysis}
					className="px-4 py-2 bg-purple-100 text-white text-sm font-medium rounded-lg hover:bg-purple-80 transition-colors"
				>
					New Analysis
				</button>
			</div>

			{/* Risk Level Banner */}
			<div
				className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${riskStyle.bgColor} ${riskStyle.border}`}
			>
				<Shield className={`w-5 h-5 ${riskStyle.color}`} />
				<div className="flex-1">
					<p className={`text-sm font-semibold ${riskStyle.color}`}>
						Overall Risk Level: {riskLevel}
					</p>
					{summary?.executive_summary && (
						<p className="text-xs text-primary60 mt-0.5 line-clamp-2">
							{summary.executive_summary}
						</p>
					)}
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 gap-4">
				{[
					{
						label: 'Files Analyzed',
						value:
							summary?.total_files_analyzed || fileNames?.length || 0,
					},
					{
						label: 'Reports Extracted',
						value: summary?.reports_count || 0,
					},
				].map(({ label, value }) => (
					<div
						key={label}
						className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/70 p-3 text-center"
					>
						<p className="text-lg font-semibold text-primary80">
							{value}
						</p>
						<p className="text-xs text-primary40">{label}</p>
					</div>
				))}
			</div>

			{/* Inline Analysis Report */}
			<AnalysisReport analysis={result?.result?.analysis} />

			{/* Evidence Download */}
			{result?.evidenceUrls?.length > 0 && (
				<div className="bg-white/50 backdrop-blur-sm rounded-xl border border-white/60 p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<AlertTriangle className="w-4 h-4 text-amber-500" />
							<p className="text-sm font-medium text-primary80">
								Forensic Evidence Report
							</p>
						</div>
						<button
							onClick={handleDownloadEvidence}
							className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
						>
							<Download className="w-3.5 h-3.5" />
							Download CSV
						</button>
					</div>
					<p className="text-xs text-primary40 mt-1">
						Complete per-test forensic data also available as CSV for
						audit trail and compliance records
					</p>
				</div>
			)}
		</div>
	);
};

export default ResultsSection;
