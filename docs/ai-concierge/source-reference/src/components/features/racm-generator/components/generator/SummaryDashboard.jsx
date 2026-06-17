import { useMemo } from 'react';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Cell,
} from 'recharts';

const RATING_COLORS = {
	Critical: '#dc2626',
	High: '#ea580c',
	Medium: '#ca8a04',
	Low: '#16a34a',
};

const StatCard = ({ label, value, color }) => (
	<div className="bg-white border rounded-xl p-4 flex flex-col items-center justify-center">
		<span className={`text-3xl font-bold ${color || 'text-primary80'}`}>
			{value}
		</span>
		<span className="text-sm text-primary40 mt-1">{label}</span>
	</div>
);

const SummaryDashboard = ({ entries }) => {
	const stats = useMemo(() => {
		if (!entries?.length) return null;

		const totalRisks = entries.length;
		const uniqueControls = new Set(
			entries.map((e) => (e.controlActivity || '').toLowerCase().trim()),
		).size;
		const processAreas = new Set(
			entries.map((e) => e.processArea).filter((p) => p && p.trim()),
		).size;

		const ratingCounts = {};
		entries.forEach((e) => {
			const rating = e.riskRating || 'Unrated';
			ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
		});

		const ratingData = ['Critical', 'High', 'Medium', 'Low'].map((rating) => ({
			name: rating,
			count: ratingCounts[rating] || 0,
			color: RATING_COLORS[rating],
		}));

		const processData = {};
		entries.forEach((e) => {
			const area = e.processArea || 'Unspecified';
			processData[area] = (processData[area] || 0) + 1;
		});
		const processAreaData = Object.entries(processData)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count);

		return {
			totalRisks,
			uniqueControls,
			processAreas,
			ratingData,
			processAreaData,
		};
	}, [entries]);

	if (!stats) return null;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-3 gap-4 min-w-0">
				<StatCard
					label="Total Risks"
					value={stats.totalRisks}
					color="text-purple-100"
				/>
				<StatCard
					label="Unique Controls"
					value={stats.uniqueControls}
					color="text-blue-600"
				/>
				<StatCard
					label="Process Areas"
					value={stats.processAreas}
					color="text-green-600"
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="bg-white border rounded-xl p-4">
					<h4 className="text-sm font-medium text-primary60 mb-3">
						Risk Rating Distribution
					</h4>
					<ResponsiveContainer width="100%" height={180}>
						<BarChart data={stats.ratingData} layout="vertical">
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis type="number" />
							<YAxis
								type="category"
								dataKey="name"
								width={70}
								fontSize={12}
							/>
							<Tooltip />
							<Bar dataKey="count" radius={[0, 4, 4, 0]}>
								{stats.ratingData.map((entry, index) => (
									<Cell key={index} fill={entry.color} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>

				<div className="bg-white border rounded-xl p-4">
					<h4 className="text-sm font-medium text-primary60 mb-3">
						Process Area Breakdown
					</h4>
					<div className="overflow-y-auto max-h-[180px]">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left text-primary40 text-xs">
									<th className="pb-2">Process Area</th>
									<th className="pb-2 text-right">Count</th>
								</tr>
							</thead>
							<tbody>
								{stats.processAreaData.map((area, i) => (
									<tr key={i} className="border-t border-gray-50">
										<td className="py-1.5 text-primary80">
											{area.name}
										</td>
										<td className="py-1.5 text-right text-primary60 font-medium">
											{area.count}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SummaryDashboard;
