import { FORENSIC_MODULE_META } from '../../constants/forensics.constants';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const ModuleCard = ({ moduleKey, moduleData }) => {
	const meta = FORENSIC_MODULE_META[moduleKey] || {
		label: moduleKey,
		description: '',
		color: 'border-l-gray-500',
	};

	const score = moduleData?.score;
	const flags = moduleData?.flags || [];
	const hasFlags = flags.length > 0;

	const scoreColor =
		score >= 70
			? 'text-emerald-600'
			: score >= 45
				? 'text-amber-600'
				: 'text-red-600';

	return (
		<div
			className={`border rounded-lg p-4 border-l-4 ${meta.color} bg-white hover:shadow-sm transition-shadow`}
		>
			<div className="flex items-start justify-between mb-2">
				<div>
					<h4 className="text-sm font-semibold text-primary80">
						{meta.label}
					</h4>
					<p className="text-xs text-primary40 mt-0.5">
						{meta.description}
					</p>
				</div>
				{score != null && (
					<span className={`text-lg font-bold ${scoreColor}`}>
						{score}
					</span>
				)}
			</div>

			{moduleData?.details && (
				<p className="text-xs text-primary60 mb-2 line-clamp-2">
					{moduleData.details}
				</p>
			)}

			{flags.length > 0 ? (
				<div className="space-y-1">
					{flags.slice(0, 4).map((flag, i) => (
						<div key={i} className="flex items-start gap-1.5 text-xs">
							<AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
							<span className="text-primary60">{flag}</span>
						</div>
					))}
					{/* Extra flags beyond the top 4 are hidden behind a native
					    <details> disclosure so the user can click to expand
					    without any JS state. Same pattern as the Advanced
					    diagnostics collapse in ForensicReport.jsx. */}
					{flags.length > 4 && (
						<details className="group mt-1">
							<summary className="text-xs text-primary40 hover:text-primary60 cursor-pointer list-none select-none ml-4.5 flex items-center gap-1">
								<span className="group-open:hidden">
									+ Show {flags.length - 4} more flag
									{flags.length - 4 > 1 ? 's' : ''}
								</span>
								<span className="hidden group-open:inline">
									Hide extra flags
								</span>
							</summary>
							<div className="space-y-1 mt-1">
								{flags.slice(4).map((flag, i) => (
									<div
										key={i + 4}
										className="flex items-start gap-1.5 text-xs"
									>
										<AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
										<span className="text-primary60">
											{flag}
										</span>
									</div>
								))}
							</div>
						</details>
					)}
				</div>
			) : (
				<div className="flex items-center gap-1.5 text-xs text-emerald-600">
					<CheckCircle2 className="w-3 h-3" />
					<span>No issues detected</span>
				</div>
			)}
		</div>
	);
};

export default ModuleCard;
