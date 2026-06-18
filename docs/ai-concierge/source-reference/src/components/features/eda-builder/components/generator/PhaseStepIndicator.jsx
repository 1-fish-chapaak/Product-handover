import { EDA_STAGES, EDA_STAGE_ORDER } from '../../constants/eda.constants';

const PhaseStepIndicator = ({ currentStage, status }) => {
	const currentIndex = EDA_STAGE_ORDER.indexOf(currentStage);
	const isCompleted = status === 'COMPLETED';

	return (
		<div className="flex items-center justify-between w-full px-2">
			{EDA_STAGE_ORDER.map((stageKey, index) => {
				const stage = EDA_STAGES[stageKey.toUpperCase()] || {
					label: stageKey,
					color: 'text-gray-500',
					bgColor: 'bg-gray-500',
				};
				const isDone = isCompleted || index < currentIndex;
				const isActive = !isCompleted && index === currentIndex;

				return (
					<div
						key={stageKey}
						className="flex items-center flex-1 last:flex-none"
					>
						<div className="flex flex-col items-center">
							<div
								className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
									isDone
										? 'bg-green-500 text-white'
										: isActive
											? `${stage.bgColor} text-white animate-pulse`
											: 'bg-gray-200 text-gray-500'
								}`}
							>
								{isDone ? (
									<svg
										className="w-3.5 h-3.5"
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
								className={`text-[10px] mt-1 font-medium text-center leading-tight max-w-[4.5rem] ${
									isDone
										? 'text-green-600'
										: isActive
											? stage.color
											: 'text-gray-400'
								}`}
							>
								{stage.label}
							</span>
						</div>
						{index < EDA_STAGE_ORDER.length - 1 && (
							<div
								className={`flex-1 h-0.5 mx-1 mt-[-1rem] ${
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
