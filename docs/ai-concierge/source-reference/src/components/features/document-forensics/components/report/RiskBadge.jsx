import { RISK_LEVELS } from '../../constants/forensics.constants';

const RiskBadge = ({ riskLevel, size = 'md' }) => {
	const config = RISK_LEVELS[riskLevel] || RISK_LEVELS.MEDIUM_RISK;

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base',
	};

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.color} ${config.bgColor} ${config.borderColor} ${sizeClasses[size]}`}
		>
			<span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
			{config.label}
		</span>
	);
};

export default RiskBadge;
