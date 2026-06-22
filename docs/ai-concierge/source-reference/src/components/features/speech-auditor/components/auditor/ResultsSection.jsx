import { useState } from 'react';
import { FileCheck, FileText, Activity, FileDown, Download } from 'lucide-react';
import { exportToPDF, exportToDocx } from '../../utils/exportUtils';
import SentimentChart from './SentimentChart';

const getStatusColor = (status) => {
	switch (status?.toLowerCase()) {
		case 'pass':
			return 'bg-emerald-100 text-emerald-800 border-emerald-200';
		case 'fail':
			return 'bg-red-100 text-red-800 border-red-200';
		case 'partial':
			return 'bg-amber-100 text-amber-800 border-amber-200';
		case 'flagged':
			return 'bg-purple-100/20 text-purple-800 border-purple-200';
		default:
			return 'bg-gray-100 text-gray-800 border-gray-200';
	}
};

const getRiskColor = (risk) => {
	switch (risk?.toLowerCase()) {
		case 'low':
			return 'text-emerald-600';
		case 'medium':
			return 'text-amber-600';
		case 'high':
			return 'text-red-600';
		default:
			return 'text-gray-600';
	}
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

const ResultsSection = ({ result, onNewAnalysis }) => {
	const [activeView, setActiveView] = useState('report');

	const reportData = result?.result?.report;
	const transcriptData = result?.result?.transcript;

	if (!reportData || !transcriptData) {
		return (
			<div className="text-center py-8 text-primary40">
				No results available.
			</div>
		);
	}

	const handleDownloadTxt = () => {
		const text = transcriptData.segments
			.map(
				(s) =>
					`[${s.timestamp}] ${s.speaker} (${s.sentiment_label}): ${s.text}`,
			)
			.join('\n\n');
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'Transcript.txt';
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="space-y-4">
			{/* Header bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-100">
					{[
						{
							key: 'report',
							label: 'Audit Report',
							icon: FileCheck,
						},
						{
							key: 'transcript',
							label: 'Transcript',
							icon: FileText,
						},
						{
							key: 'sentiment',
							label: 'Sentiment',
							icon: Activity,
						},
					].map(({ key, label, icon: Icon }) => (
						<button
							key={key}
							onClick={() => setActiveView(key)}
							className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
								activeView === key
									? 'bg-purple-4 text-purple-100'
									: 'text-primary40 hover:text-primary60'
							}`}
						>
							<Icon className="w-3.5 h-3.5" />
							{label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-2">
					{formatElapsed(result?.createdAt, result?.completedAt) && (
						<span className="text-xs text-primary40 mr-2">
							Completed in{' '}
							{formatElapsed(result.createdAt, result.completedAt)}
						</span>
					)}
					<button
						onClick={onNewAnalysis}
						className="px-3 py-1.5 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 transition-colors font-medium"
					>
						New Analysis
					</button>
					<button
						onClick={() => exportToPDF(reportData, transcriptData)}
						className="flex items-center gap-1.5 border border-gray-200 text-primary60 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
					>
						<FileText className="w-3.5 h-3.5" />
						PDF
					</button>
					<button
						onClick={() => exportToDocx(reportData, transcriptData)}
						className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
					>
						<FileDown className="w-3.5 h-3.5" />
						DOCX
					</button>
				</div>
			</div>

			{/* Audit Report */}
			{activeView === 'report' && (
				<div className="bg-white rounded-xl border border-gray-100 p-6 space-y-8">
					<div className="text-center space-y-1 border-b border-gray-100 pb-6">
						<h1 className="text-2xl font-bold text-indigo-900">
							AUDIT REPORT
						</h1>
						<p className="text-sm text-primary40">
							Booking Verification Call — Controls Assessment
						</p>
					</div>

					{/* Engagement Detail */}
					{reportData.engagement_detail?.length > 0 && (
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-indigo-900 text-white">
									<th className="p-2.5 font-semibold text-xs w-1/2">
										Engagement Detail
									</th>
									<th className="p-2.5 font-semibold text-xs w-1/2">
										Value
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 border border-gray-100">
								{reportData.engagement_detail.map((item, idx) => (
									<tr key={idx} className="hover:bg-gray-50">
										<td className="p-2.5 text-xs text-primary60 font-medium">
											{item.information}
										</td>
										<td className="p-2.5 text-xs text-primary40">
											{item.value}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}

					{/* Executive Summary */}
					<section className="space-y-2">
						<h2 className="text-base font-bold text-indigo-900 border-b-2 border-indigo-50 pb-1">
							1. Executive Summary
						</h2>
						<p className="text-primary60 leading-relaxed text-sm">
							{reportData.executive_summary}
						</p>
					</section>

					{/* Controls Summary */}
					{reportData.controls_summary?.length > 0 && (
						<section className="space-y-2">
							<h2 className="text-base font-bold text-indigo-900 border-b-2 border-indigo-50 pb-1">
								2. Controls Summary Scorecard
							</h2>
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse">
									<thead>
										<tr className="bg-indigo-900 text-white">
											<th className="p-2.5 font-semibold text-xs">
												Control Area
											</th>
											<th className="p-2.5 font-semibold text-xs">
												Status
											</th>
											<th className="p-2.5 font-semibold text-xs">
												Risk
											</th>
											<th className="p-2.5 font-semibold text-xs">
												Auditor Remark
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 border border-gray-100">
										{reportData.controls_summary.map(
											(item, idx) => (
												<tr
													key={idx}
													className="hover:bg-gray-50"
												>
													<td className="p-2.5 text-xs text-primary60">
														{item.control_area}
													</td>
													<td className="p-2.5 text-xs">
														<span
															className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(item.status)}`}
														>
															{item.status?.toUpperCase()}
														</span>
													</td>
													<td
														className={`p-2.5 text-xs font-semibold ${getRiskColor(item.risk)}`}
													>
														{item.risk}
													</td>
													<td className="p-2.5 text-xs text-primary40">
														{item.remark}
													</td>
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
						</section>
					)}

					{/* Detailed Findings */}
					{reportData.detailed_findings?.length > 0 && (
						<section className="space-y-4">
							<h2 className="text-base font-bold text-indigo-900 border-b-2 border-indigo-50 pb-1">
								3. Detailed Audit Findings
							</h2>
							{reportData.detailed_findings.map((finding, idx) => (
								<div
									key={idx}
									className="border border-gray-100 rounded-lg overflow-hidden"
								>
									<div className="bg-gray-50 p-3 border-b border-gray-100 flex items-center gap-2">
										<h3 className="font-bold text-sm text-indigo-900">
											{finding.id} — {finding.title}
										</h3>
										<span
											className={`text-xs font-semibold ${getRiskColor(finding.risk)}`}
										>
											[{finding.risk} Risk | {finding.status}]
										</span>
									</div>
									<table className="w-full text-left border-collapse">
										<tbody className="divide-y divide-gray-100">
											{[
												['Observation', finding.observation],
												['Audit Criteria', finding.criteria],
												[
													'Risk / Implication',
													finding.implication,
												],
												[
													'Recommendation',
													finding.recommendation,
												],
											].map(([label, value]) => (
												<tr key={label}>
													<td className="p-3 bg-gray-50/50 font-semibold text-xs text-primary60 w-1/4 border-r border-gray-100">
														{label}
													</td>
													<td className="p-3 text-xs text-primary40">
														{value}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							))}
						</section>
					)}

					{/* Priority Action Plan */}
					{reportData.priority_action_plan?.length > 0 && (
						<section className="space-y-2">
							<h2 className="text-base font-bold text-indigo-900 border-b-2 border-indigo-50 pb-1">
								4. Priority Action Plan
							</h2>
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-indigo-900 text-white">
										<th className="p-2.5 font-semibold text-xs w-10 text-center">
											#
										</th>
										<th className="p-2.5 font-semibold text-xs">
											Action Item
										</th>
										<th className="p-2.5 font-semibold text-xs">
											Responsible
										</th>
										<th className="p-2.5 font-semibold text-xs">
											Priority
										</th>
										<th className="p-2.5 font-semibold text-xs">
											Timeline
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 border border-gray-100">
									{reportData.priority_action_plan.map(
										(item, idx) => (
											<tr
												key={idx}
												className="hover:bg-gray-50"
											>
												<td className="p-2.5 text-xs text-primary60 text-center">
													{item.id}
												</td>
												<td className="p-2.5 text-xs text-primary60">
													{item.action_item}
												</td>
												<td className="p-2.5 text-xs text-primary40">
													{item.responsible}
												</td>
												<td className="p-2.5 text-xs">
													<span
														className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
															item.priority?.toLowerCase() ===
															'high'
																? 'bg-red-100 text-red-800'
																: item.priority?.toLowerCase() ===
																	  'medium'
																	? 'bg-amber-100 text-amber-800'
																	: 'bg-emerald-100 text-emerald-800'
														}`}
													>
														{item.priority}
													</span>
												</td>
												<td className="p-2.5 text-xs text-primary40">
													{item.timeline}
												</td>
											</tr>
										),
									)}
								</tbody>
							</table>
						</section>
					)}

					{/* Conclusion */}
					<section className="space-y-2">
						<h2 className="text-base font-bold text-indigo-900 border-b-2 border-indigo-50 pb-1">
							5. Auditor's Conclusion
						</h2>
						<p className="text-primary60 leading-relaxed text-sm">
							{reportData.conclusion}
						</p>
					</section>
				</div>
			)}

			{/* Transcript */}
			{activeView === 'transcript' && (
				<div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
					<div className="flex items-center justify-between border-b border-gray-100 pb-3">
						<div>
							<h2 className="text-base font-bold text-primary80">
								Call Transcript
							</h2>
							<p className="text-xs text-primary40 mt-0.5">
								Overall Sentiment:{' '}
								<span className="font-semibold text-primary80">
									{transcriptData.overall_sentiment > 0
										? 'Positive'
										: transcriptData.overall_sentiment < 0
											? 'Negative'
											: 'Neutral'}
								</span>
							</p>
						</div>
						<button
							onClick={handleDownloadTxt}
							className="flex items-center gap-1.5 border border-gray-200 text-primary60 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
						>
							<Download className="w-3.5 h-3.5" />
							Download TXT
						</button>
					</div>
					<div className="space-y-4">
						{transcriptData.segments.map((seg, idx) => (
							<div key={idx} className="flex gap-3">
								<div className="w-16 shrink-0 text-[10px] font-mono text-primary20 pt-1">
									{seg.timestamp}
								</div>
								<div className="flex-1 space-y-0.5">
									<div className="flex items-center gap-2">
										<span className="font-semibold text-xs text-primary80">
											{seg.speaker}
										</span>
										<span
											className={`text-[10px] px-1.5 py-0.5 rounded-full ${
												seg.sentiment_score > 0.2
													? 'bg-emerald-100 text-emerald-700'
													: seg.sentiment_score < -0.2
														? 'bg-red-100 text-red-700'
														: 'bg-gray-100 text-gray-700'
											}`}
										>
											{seg.sentiment_label}
										</span>
									</div>
									<p className="text-primary60 text-sm leading-relaxed">
										{seg.text}
									</p>
									{seg.original_text &&
										seg.original_text !== seg.text && (
											<p className="text-primary20 text-xs italic">
												Original: {seg.original_text}
											</p>
										)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Sentiment */}
			{activeView === 'sentiment' && (
				<div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
					<div className="border-b border-gray-100 pb-3">
						<h2 className="text-base font-bold text-primary80">
							Sentiment Trend Analysis
						</h2>
						<p className="text-xs text-primary40 mt-0.5">
							{transcriptData.overall_summary}
						</p>
					</div>
					<SentimentChart segments={transcriptData.segments} />
				</div>
			)}
		</div>
	);
};

export default ResultsSection;
