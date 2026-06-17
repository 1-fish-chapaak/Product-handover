import { PieChart, Pie, Cell } from 'recharts';
import { RISK_LEVELS } from '../../constants/forensics.constants';

const RISK_COLORS = {
	GENUINE: '#10b981',
	LOW_RISK: '#3b82f6',
	MEDIUM_RISK: '#f59e0b',
	HIGH_RISK: '#f97316',
	FORGED: '#ef4444',
};

const ScoreDonut = ({ score, riskLevel }) => {
	const numScore = Number(score) || 0;
	const color = RISK_COLORS[riskLevel] || RISK_COLORS.MEDIUM_RISK;
	const riskConfig = RISK_LEVELS[riskLevel] || RISK_LEVELS.MEDIUM_RISK;

	const data = [{ value: numScore }, { value: 100 - numScore }];

	return (
		<div className="relative flex flex-col items-center">
			<PieChart width={140} height={140}>
				<Pie
					data={data}
					cx={65}
					cy={65}
					innerRadius={45}
					outerRadius={60}
					startAngle={90}
					endAngle={-270}
					dataKey="value"
					stroke="none"
				>
					<Cell fill={color} />
					<Cell fill="#f3f4f6" />
				</Pie>
			</PieChart>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-2xl font-bold" style={{ color }}>
					{numScore}
				</span>
				<span className="text-[10px] text-gray-500 font-medium">/ 100</span>
			</div>
			<span className={`text-xs font-medium mt-1 ${riskConfig.color}`}>
				{riskConfig.label}
			</span>
		</div>
	);
};

export default ScoreDonut;
