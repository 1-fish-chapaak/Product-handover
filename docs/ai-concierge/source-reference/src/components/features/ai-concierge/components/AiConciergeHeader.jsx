import Tag from '@/components/elements/Tag';

const AiConciergeHeader = () => {
	return (
		<header className="max-w-full flex-none mb-6">
			<div className="flex items-center gap-3">
				<h1 className="text-2xl font-semibold text-primary80">
					AI Concierge
				</h1>
				<span className="shrink-0 px-2 py-px rounded-md bg-white/50 backdrop-blur-sm border border-[rgba(106,18,205,0.12)] text-[10px] font-medium text-purple-100 tracking-wide">
					Beta
				</span>
			</div>
			<p className="text-primary40 text-sm mt-1">
				AI-powered tools for auditing, compliance, and data analysis
			</p>
		</header>
	);
};

export default AiConciergeHeader;
