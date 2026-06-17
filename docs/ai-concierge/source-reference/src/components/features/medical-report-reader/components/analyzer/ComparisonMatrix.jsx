import { useMemo } from 'react';
import { GitCompare } from 'lucide-react';

/**
 * Computes similarity % between two reports based on matching test values.
 */
const computeSimilarity = (reportA, reportB) => {
	const testsA = reportA.detailedResults || [];
	const testsB = reportB.detailedResults || [];
	if (!testsA.length || !testsB.length) return 0;

	// Build value map for B: testName → resultValue
	const mapB = {};
	testsB.forEach((t) => {
		mapB[t.testName?.toLowerCase()?.trim()] = t.resultValue?.trim();
	});

	let matches = 0;
	let comparable = 0;
	testsA.forEach((t) => {
		const key = t.testName?.toLowerCase()?.trim();
		if (key && mapB[key] !== undefined) {
			comparable++;
			if (mapB[key] === t.resultValue?.trim()) {
				matches++;
			}
		}
	});

	return comparable > 0 ? Math.round((matches / comparable) * 100) : 0;
};

const getCellColor = (pct, isSelf) => {
	if (isSelf) return 'bg-gray-100 text-gray-400';
	if (pct >= 80) return 'bg-red-100 text-red-700 font-bold';
	if (pct >= 50) return 'bg-orange-100 text-orange-700 font-semibold';
	if (pct >= 30) return 'bg-amber-50 text-amber-600';
	return 'bg-white text-primary40';
};

const getShortLabel = (report, index) => {
	const lab = report.labName || `Report ${index + 1}`;
	return lab.length > 15 ? lab.substring(0, 13) + '...' : lab;
};

const ComparisonMatrix = ({ reports }) => {
	const matrix = useMemo(() => {
		if (!reports || reports.length < 2) return null;
		return reports.map((a, i) =>
			reports.map((b, j) => (i === j ? -1 : computeSimilarity(a, b))),
		);
	}, [reports]);

	if (!matrix || reports.length < 2) return null;

	const hasHighSimilarity = matrix.some((row) => row.some((val) => val >= 50));

	return (
		<div className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/70 overflow-hidden">
			<div className="px-4 py-3 border-b border-gray-100">
				<div className="flex items-center gap-2">
					<GitCompare className="w-4 h-4 text-purple-100" />
					<h3 className="text-sm font-semibold text-primary80">
						Cross-Report Similarity Matrix
					</h3>
				</div>
				<p className="text-xs text-primary40 mt-0.5 ml-6">
					Shows how similar test values are between each pair of reports —
					high similarity across different labs suggests copy-paste
					fabrication
				</p>
				{hasHighSimilarity && (
					<span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200">
						High similarity detected
					</span>
				)}
			</div>
			<div className="p-4 overflow-x-auto">
				<table className="text-xs w-full">
					<thead>
						<tr>
							<th className="px-2 py-1.5 text-left text-primary40 font-medium" />
							{reports.map((r, i) => (
								<th
									key={i}
									className="px-2 py-1.5 text-center text-primary60 font-medium max-w-[80px] truncate"
									title={r.labName}
								>
									{getShortLabel(r, i)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{reports.map((r, i) => (
							<tr key={i}>
								<td
									className="px-2 py-1.5 text-primary60 font-medium max-w-[100px] truncate"
									title={r.labName}
								>
									{getShortLabel(r, i)}
								</td>
								{matrix[i].map((pct, j) => (
									<td
										key={j}
										className={`px-2 py-1.5 text-center rounded ${getCellColor(pct, i === j)}`}
									>
										{i === j ? '—' : `${pct}%`}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				<div className="flex items-center gap-4 mt-3 text-xs text-primary40">
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
						&ge;80% Likely fabricated
					</span>
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-orange-100 border border-orange-200" />
						50-79% Suspicious
					</span>
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-white border border-gray-200" />
						&lt;50% Normal
					</span>
				</div>
			</div>
		</div>
	);
};

export default ComparisonMatrix;
