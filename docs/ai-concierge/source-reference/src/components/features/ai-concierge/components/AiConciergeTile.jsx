import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const AiConciergeTile = ({ feature }) => {
	const navigate = useNavigate();
	const Icon = feature.icon;

	return (
		<Card
			className="group bg-white/55 backdrop-blur-xl border border-white/70 rounded-2xl shadow-[0_4px_16px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white/70 hover:border-[rgba(106,18,205,0.15)] hover:shadow-[0_8px_30px_rgba(106,18,205,0.12),0_0_0_1px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-1 cursor-pointer transition-all duration-300"
			onClick={() => navigate(`/app/ai-concierge/${feature.route}`)}
		>
			<CardHeader>
				<div className="flex items-center">
					<span className="rounded-xl bg-white/60 backdrop-blur-sm p-2.5 border border-white/70 inline-flex shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
						<Icon
							className="text-primary80 size-6 transition-colors duration-300 group-hover:text-purple-100"
							strokeWidth={1.5}
						/>
					</span>
				</div>
			</CardHeader>
			<CardContent>
				<h3 className="text-base font-semibold text-primary100 transition-colors duration-300 group-hover:text-purple-100">
					{feature.name}
				</h3>
				<p className="text-primary80 text-sm mt-1 mb-4 line-clamp-2 h-10">
					{feature.description}
				</p>
				<div className="flex flex-wrap gap-2">
					{feature.tags.map((tag) => (
						<Badge
							key={tag}
							variant="outline"
							className="px-2.5 py-1 bg-white/50 backdrop-blur-sm text-primary80 font-medium border border-white/60 rounded-full transition-all duration-300 group-hover:bg-[rgba(106,18,205,0.05)] group-hover:border-[rgba(106,18,205,0.12)] group-hover:text-purple-100"
						>
							{tag}
						</Badge>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export default AiConciergeTile;
