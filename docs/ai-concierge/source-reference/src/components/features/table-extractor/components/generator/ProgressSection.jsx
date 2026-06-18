import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import {
	TE_STAGES,
	TE_STAGE_ORDER,
} from '../../constants/table-extractor.constants';
import GradientBorderLoader from '@/components/elements/GradientBorderLoader';
import TypewriterText from '@/components/elements/TypewriterText';
import AnalysisInsightPanel from '@/components/elements/AnalysisInsightPanel';

const PhaseStepIndicator = ({ currentStage }) => {
	const currentIdx = TE_STAGE_ORDER.indexOf(currentStage);

	return (
		<div className="flex items-center gap-1 flex-wrap">
			{TE_STAGE_ORDER.map((stage, idx) => {
				const stageInfo = TE_STAGES[stage];
				const isActive = idx === currentIdx;
				const isDone = idx < currentIdx;

				return (
					<div key={stage} className="flex items-center gap-1">
						<div
							className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
								isActive
									? 'bg-purple-4 text-purple-100 border border-[rgba(106,18,205,0.15)]'
									: isDone
										? 'bg-emerald-50 text-emerald-600'
										: 'bg-gray-50 text-primary40'
							}`}
						>
							{isActive && (
								<div className="animate-spin w-2.5 h-2.5 border border-purple-100 border-t-transparent rounded-full" />
							)}
							{isDone && (
								<svg
									className="w-2.5 h-2.5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={3}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							)}
							{stageInfo?.label || stage}
						</div>
						{idx < TE_STAGE_ORDER.length - 1 && (
							<svg
								className="w-3 h-3 text-[rgba(106,18,205,0.15)]"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 5l7 7-7 7"
								/>
							</svg>
						)}
					</div>
				);
			})}
		</div>
	);
};

const ProgressSection = ({ statusData, fileNames, onCancel }) => {
	const [elapsed, setElapsed] = useState(0);
	const [activityLog, setActivityLog] = useState([]);
	const startTimeRef = useRef(Date.now());
	const logEndRef = useRef(null);

	useEffect(() => {
		const timer = setInterval(() => {
			setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
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

	const progressPercent = statusData?.progress_percent || 0;

	return (
		<div className="space-y-4">
			<GradientBorderLoader minHeight="min-h-0">
				<div className="p-6 space-y-6">
					{fileNames?.length > 0 && (
						<div className="flex items-center gap-2 text-sm">
							<Sparkles className="w-4 h-4 text-violet-600 shrink-0 animate-pulse" />
							<span className="text-primary60">Extracting:</span>
							<span className="text-primary80 font-medium truncate">
								{fileNames.join(', ')}
							</span>
						</div>
					)}

					<PhaseStepIndicator
						currentStage={statusData?.stage || 'startup'}
					/>

					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<TypewriterText
								text={statusData?.message || 'Processing...'}
								className="text-primary60 font-medium"
							/>
							<span className="text-primary40">
								{formatTime(elapsed)}
							</span>
						</div>
						<div className="w-full bg-gray-200 rounded-full h-2.5">
							<div
								className="bg-purple-100 h-2.5 rounded-full transition-all duration-500"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
						<div className="flex justify-between text-xs text-primary40">
							<span>{progressPercent}%</span>
							<span>Elapsed: {formatTime(elapsed)}</span>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<p className="text-xs text-primary40">
							You can close this page and come back later. Your
							extraction will be saved automatically.
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
			<AnalysisInsightPanel feature="table-extractor" />
		</div>
	);
};

export default ProgressSection;
