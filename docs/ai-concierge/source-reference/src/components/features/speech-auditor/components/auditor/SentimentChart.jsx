import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
} from 'recharts';

const SentimentChart = ({ segments }) => {
	if (!segments?.length) return null;

	const data = segments.map((seg) => ({
		time: seg.timestamp,
		score: seg.sentiment_score,
		speaker: seg.speaker,
		label: seg.sentiment_label,
	}));

	return (
		<div className="h-72 w-full">
			<ResponsiveContainer width="100%" height="100%">
				<LineChart
					data={data}
					margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
				>
					<CartesianGrid
						strokeDasharray="3 3"
						vertical={false}
						stroke="#e2e8f0"
					/>
					<XAxis
						dataKey="time"
						tick={{ fontSize: 11, fill: '#64748b' }}
						tickMargin={10}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						domain={[-1, 1]}
						tick={{ fontSize: 11, fill: '#64748b' }}
						axisLine={false}
						tickLine={false}
						ticks={[-1, -0.5, 0, 0.5, 1]}
					/>
					<Tooltip
						content={({ active, payload }) => {
							if (active && payload?.length) {
								const d = payload[0].payload;
								return (
									<div className="bg-white p-2.5 border border-gray-200 shadow-lg rounded-lg">
										<p className="text-[10px] text-primary40 mb-0.5">
											{d.time}
										</p>
										<p className="text-xs font-semibold text-primary80">
											{d.speaker}
										</p>
										<p className="text-xs text-primary60">
											Sentiment: {d.label} ({d.score})
										</p>
									</div>
								);
							}
							return null;
						}}
					/>
					<ReferenceLine y={0} stroke="#cbd5e1" />
					<Line
						type="monotone"
						dataKey="score"
						stroke="#7c3aed"
						strokeWidth={2.5}
						dot={{
							r: 3.5,
							fill: '#7c3aed',
							strokeWidth: 2,
							stroke: '#fff',
						}}
						activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
};

export default SentimentChart;
