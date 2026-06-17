import { useMemo } from 'react';
import { AlertTriangle, Copy, Activity, Clock } from 'lucide-react';

const RedFlagSummary = ({ analysis }) => {
	const { identicalValues, abnormalValues, totalFlags } = useMemo(() => {
		if (!analysis?.reports?.length) {
			return { identicalValues: [], abnormalValues: [], totalFlags: 0 };
		}

		const reports = analysis.reports;
		const identical = [];
		const abnormal = [];

		// Build test value index: testName → [{value, lab, ref, reportIdx}]
		const testIndex = {};
		reports.forEach((report, idx) => {
			(report.detailedResults || []).forEach((test) => {
				const key = test.testName?.toLowerCase()?.trim();
				if (!key) return;
				if (!testIndex[key]) testIndex[key] = [];
				testIndex[key].push({
					value: test.resultValue?.trim(),
					lab: report.labName || `Report ${idx + 1}`,
					ref: report.reportRefNumber || '',
					date: report.reportDate || '',
					isRedFlag: test.isRedFlag,
					flagReason: test.flagReason || '',
					testName: test.testName,
					unit: test.unit || '',
				});
			});
		});

		// Find identical values across different labs
		const seenPairs = new Set();
		Object.entries(testIndex).forEach(([, entries]) => {
			if (entries.length < 2) return;
			for (let i = 0; i < entries.length; i++) {
				for (let j = i + 1; j < entries.length; j++) {
					if (
						entries[i].value === entries[j].value &&
						entries[i].lab !== entries[j].lab
					) {
						const pairKey = `${entries[i].testName}-${entries[i].lab}-${entries[j].lab}`;
						if (!seenPairs.has(pairKey)) {
							seenPairs.add(pairKey);
							identical.push({
								testName: entries[i].testName,
								value: entries[i].value,
								unit: entries[i].unit,
								labA: entries[i].lab,
								dateA: entries[i].date,
								labB: entries[j].lab,
								dateB: entries[j].date,
							});
						}
					}
				}
			}
		});

		// Collect abnormal values (red flags that aren't cross-lab matches)
		const identicalTestNames = new Set(
			identical.map((i) => i.testName?.toLowerCase()),
		);
		reports.forEach((report) => {
			(report.detailedResults || []).forEach((test) => {
				if (
					test.isRedFlag &&
					!identicalTestNames.has(test.testName?.toLowerCase())
				) {
					abnormal.push({
						testName: test.testName,
						value: test.resultValue,
						unit: test.unit || '',
						lab: report.labName || 'Unknown',
						reason: test.flagReason || 'Abnormal value',
					});
				}
			});
		});

		return {
			identicalValues: identical,
			abnormalValues: abnormal,
			totalFlags: identical.length + abnormal.length,
		};
	}, [analysis]);

	if (totalFlags === 0) return null;

	return (
		<div className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/70 overflow-hidden">
			<div className="px-4 py-3 border-b border-gray-100">
				<div className="flex items-center gap-2">
					<AlertTriangle className="w-4 h-4 text-red-500" />
					<h3 className="text-sm font-semibold text-primary80">
						Red Flag Summary
					</h3>
					<span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200">
						{totalFlags} flag{totalFlags > 1 ? 's' : ''}
					</span>
				</div>
				<p className="text-xs text-primary40 mt-0.5 ml-6">
					Suspicious findings across all reports — identical values between
					different labs indicate potential fraud, abnormal values indicate
					health risks
				</p>
			</div>

			<div className="p-4 space-y-4">
				{/* Identical values across labs */}
				{identicalValues.length > 0 && (
					<div>
						<div className="flex items-center gap-1.5 mb-2">
							<Copy className="w-3.5 h-3.5 text-red-500" />
							<p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
								Identical Values Across Labs (
								{identicalValues.length})
							</p>
						</div>
						<div className="space-y-1.5">
							{identicalValues.slice(0, 20).map((item, i) => (
								<div
									key={i}
									className="flex items-center gap-2 px-3 py-1.5 bg-red-50/50 rounded-lg text-xs border border-red-100"
								>
									<span className="font-medium text-primary80 w-36 truncate">
										{item.testName}
									</span>
									<span className="font-mono text-red-600 font-semibold">
										{item.value} {item.unit}
									</span>
									<span className="text-primary40">→</span>
									<span className="text-primary60 truncate">
										{item.labA}
										{item.dateA ? ` (${item.dateA})` : ''}
									</span>
									<span className="text-red-400">=</span>
									<span className="text-primary60 truncate">
										{item.labB}
										{item.dateB ? ` (${item.dateB})` : ''}
									</span>
								</div>
							))}
							{identicalValues.length > 20 && (
								<p className="text-xs text-primary40 px-3">
									+{identicalValues.length - 20} more identical
									matches...
								</p>
							)}
						</div>
					</div>
				)}

				{/* Abnormal values */}
				{abnormalValues.length > 0 && (
					<div>
						<div className="flex items-center gap-1.5 mb-2">
							<Activity className="w-3.5 h-3.5 text-amber-500" />
							<p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
								Abnormal Values ({abnormalValues.length})
							</p>
						</div>
						<div className="space-y-1.5">
							{abnormalValues.slice(0, 15).map((item, i) => (
								<div
									key={i}
									className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/50 rounded-lg text-xs border border-amber-100"
								>
									<span className="font-medium text-primary80 w-36 truncate">
										{item.testName}
									</span>
									<span className="font-mono text-amber-600 font-semibold">
										{item.value} {item.unit}
									</span>
									<span className="text-primary40 truncate flex-1">
										{item.lab} — {item.reason}
									</span>
								</div>
							))}
							{abnormalValues.length > 15 && (
								<p className="text-xs text-primary40 px-3">
									+{abnormalValues.length - 15} more abnormal
									values...
								</p>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default RedFlagSummary;
