import { RACM_PHASES, RACM_PHASE_ORDER } from '../../constants/racm.constants';

const PhaseStepIndicator = ({ currentPhase, status }) => {
	const currentIndex = RACM_PHASE_ORDER.indexOf(currentPhase);
	const isCompleted = status === 'COMPLETED';

	return (
		<div className="flex items-center justify-between w-full px-4">
			{RACM_PHASE_ORDER.map((phaseKey, index) => {
				const phase = RACM_PHASES[phaseKey];
				const isDone = isCompleted || index < currentIndex;
				const isActive = !isCompleted && index === currentIndex;
				const isPending = !isCompleted && index > currentIndex;

				return (
					<div
						key={phaseKey}
						className="flex items-center flex-1 last:flex-none"
					>
						<div className="flex flex-col items-center">
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
									isDone
										? 'bg-green-500 text-white'
										: isActive
											? `${phase.bgColor} text-white animate-pulse`
											: 'bg-gray-200 text-gray-500'
								}`}
							>
								{isDone ? (
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
											d="M5 13l4 4L19 7"
										/>
									</svg>
								) : (
									index + 1
								)}
							</div>
							<span
								className={`text-xs mt-1 font-medium ${
									isDone
										? 'text-green-600'
										: isActive
											? phase.color
											: 'text-gray-400'
								}`}
							>
								{phase.label}
							</span>
						</div>
						{index < RACM_PHASE_ORDER.length - 1 && (
							<div
								className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
									isDone ? 'bg-green-400' : 'bg-gray-200'
								}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
};

export default PhaseStepIndicator;
