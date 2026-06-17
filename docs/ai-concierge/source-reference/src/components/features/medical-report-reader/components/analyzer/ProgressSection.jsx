import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { MR_STAGES, MR_STAGE_ORDER } from '../../constants/medical-reader.constants';
import GradientBorderLoader from '@/components/elements/GradientBorderLoader';
import TypewriterText from '@/components/elements/TypewriterText';
import AnalysisInsightPanel from '@/components/elements/AnalysisInsightPanel';

const ProgressSection = ({ statusData, fileNames, onCancel }) => {
	const [elapsed, setElapsed] = useState(0);
	const [activityLog, setActivityLog] = useState([]);
	const startTimeRef = useRef(null);
	const logEndRef = useRef(null);

	useEffect(() => {
		if (statusData?.createdAt) {
			startTimeRef.current = new Date(statusData.createdAt).getTime();
		}
	}, [statusData?.createdAt]);

	useEffect(() => {
		const timer = setInterval(() => {
			if (startTimeRef.current) {
				setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
			}
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (statusData?.message) {
			setActivityLog((prev) => {
				const last = prev[prev.length - 1];
				if (last?.message === statusData.message) return prev;
				return [
					...prev,
					{
						time: new Date().toLocaleTimeString(),
						stage: statusData.stage,
						message: statusData.message,
					},
				];
			});
		}
	}, [statusData?.message, statusData?.stage]);

	useEffect(() => {
		logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [activityLog]);

	const formatTime = (seconds) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};

	const progressPercent = statusData?.progressPercent || 0;
	const currentStage = statusData?.stage || 'startup';
	const currentStageIndex = MR_STAGE_ORDER.indexOf(currentStage);

	return (
		<div className="space-y-4">
			<GradientBorderLoader minHeight="min-h-0">
				<div className="p-6 space-y-6">
					{fileNames?.length > 0 && (
						<div className="flex items-center gap-2 text-sm">
							<Sparkles className="w-4 h-4 text-violet-600 shrink-0 animate-pulse" />
							<span className="text-primary60">Analyzing:</span>
							<span className="text-primary80 font-medium truncate">
								{fileNames.join(', ')}
							</span>
						</div>
					)}

					{/* Phase indicators */}
					<div className="flex items-center gap-1 overflow-x-auto pb-2">
						{MR_STAGE_ORDER.map((stageKey, i) => {
							const stage = Object.values(MR_STAGES).find(
								(s) => s.key === stageKey,
							);
							const isComplete = i < currentStageIndex;
							const isCurrent = i === currentStageIndex;
							return (
								<div
									key={stageKey}
									className="flex items-center gap-1"
								>
									{i > 0 && (
										<div
											className={`w-6 h-0.5 ${isComplete ? 'bg-green-400' : 'bg-gray-200'}`}
										/>
									)}
									<div
										className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap
                  ${isComplete ? 'bg-green-50 text-green-600' : isCurrent ? `${stage?.bgColor}/10 ${stage?.color}` : 'bg-gray-50 text-gray-400'}`}
									>
										{isComplete ? (
											<span className="text-green-500">✓</span>
										) : isCurrent ? (
											<span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
										) : (
											<span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
										)}
										{stage?.label || stageKey}
									</div>
								</div>
							);
						})}
					</div>

					{/* Progress bar */}
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<TypewriterText
								text={statusData?.message || 'Processing...'}
								className="text-primary60 font-medium"
							/>
						</div>
						<div className="w-full bg-gray-200 rounded-full h-2.5">
							<div
								className="bg-purple-100 h-2.5 rounded-full transition-all duration-500"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
						<div className="flex justify-between text-xs text-primary40">
							<span>{progressPercent}%</span>
							<span>Time elapsed: {formatTime(elapsed)}</span>
						</div>
					</div>

					{/* Info + Cancel */}
					<div className="flex items-center justify-between">
						<p className="text-xs text-primary40">
							You can close this page and come back later. Your
							analysis will be saved automatically.
						</p>
						{onCancel && (
							<button
								onClick={onCancel}
								className="px-4 py-1.5 text-sm border border-red-300 text-red-500 rounded-lg hover:bg-red-50 font-medium transition-colors"
							>
								Cancel
							</button>
						)}
					</div>

					{/* Activity log */}
					{activityLog.length > 0 && (
						<div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
							<h4 className="text-xs font-medium text-primary40 mb-2">
								Activity Log
							</h4>
							<div className="space-y-1">
								{activityLog.map((entry, i) => (
									<div key={i} className="flex gap-2 text-xs">
										<span className="text-primary40 shrink-0">
											{entry.time}
										</span>
										<span className="text-primary60 font-medium shrink-0">
											[{entry.stage}]
										</span>
										<span className="text-primary80">
											{entry.message}
										</span>
									</div>
								))}
								<div ref={logEndRef} />
							</div>
						</div>
					)}
				</div>
			</GradientBorderLoader>
			<AnalysisInsightPanel feature="medical-reader" />
		</div>
	);
};

export default ProgressSection;
