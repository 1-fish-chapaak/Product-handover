import { useMemo, useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import AiConciergeHeader from './components/AiConciergeHeader';
import AiConciergeTile from './components/AiConciergeTile';
import { AI_FEATURES } from './constants/ai-concierge.constants';

const SearchBar = ({ value, onChange }) => (
	<div className="flex items-center bg-white/60 backdrop-blur-lg border border-white/70 rounded-[52px] h-11 pl-4 pr-6 transition-all duration-300 w-[18.75rem] shadow-[0_2px_8px_rgba(106,18,205,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]">
		<i className="bi-search text-primary40 me-2"></i>
		<Input
			placeholder="Search AI tools..."
			className="border-none rounded-sm px-0 text-primary40 font-medium bg-transparent"
			value={value}
			onChange={onChange}
		/>
	</div>
);

const AiConciergePage = () => {
	const [search, setSearch] = useState('');
	const sectionRef = useRef(null);

	// Spotlight cursor effect. Tracks mouse position over the hero section
	// and updates CSS variables directly (no React re-render per frame) so
	// a radial-gradient overlay follows the cursor. Gives the AI Concierge
	// landing a premium "aware" feel similar to Vision Pro / Apple Intelligence
	// landing pages.
	useEffect(() => {
		const section = sectionRef.current;
		if (!section) return;

		const handleMove = (e) => {
			const rect = section.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 100;
			const y = ((e.clientY - rect.top) / rect.height) * 100;
			section.style.setProperty('--mouse-x', `${x}%`);
			section.style.setProperty('--mouse-y', `${y}%`);
		};

		section.addEventListener('mousemove', handleMove);
		return () => section.removeEventListener('mousemove', handleMove);
	}, []);

	const filteredFeatures = useMemo(() => {
		if (!search) return AI_FEATURES;
		const query = search.toLowerCase();
		return AI_FEATURES.filter(
			({ name, description, tags }) =>
				name.toLowerCase().includes(query) ||
				description.toLowerCase().includes(query) ||
				tags.some((tag) => tag.toLowerCase().includes(query)),
		);
	}, [search]);

	return (
		<div className="h-full w-full flex flex-col px-8">
			<AiConciergeHeader />

			<section
				ref={sectionRef}
				className="relative max-w-full flex-1 border border-white/60 mb-4 bg-gradient-to-br from-[rgba(249,245,255,1)] via-[rgba(238,232,248,0.5)] to-[rgba(249,250,251,1)] shadow-1xl rounded-xl overflow-hidden"
				style={{
					'--mouse-x': '50%',
					'--mouse-y': '50%',
				}}
			>
				{/* Spotlight cursor overlay. Radial gradient follows the
				    cursor via CSS variables updated in useEffect above. */}
				<div
					className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300"
					style={{
						background:
							'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(196, 113, 237, 0.15), rgba(18, 194, 233, 0.05) 30%, transparent 60%)',
					}}
					aria-hidden="true"
				/>

				<div className="relative p-4 mt-2 flex flex-row justify-between gap-4">
					<SearchBar
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<button
						type="button"
						onClick={() => {
							// Dispatch a synthetic Cmd+K to open the
							// global CommandPalette — gives a keyboard-less
							// affordance for discovering the palette.
							const isMac =
								navigator.platform.toUpperCase().indexOf('MAC') >= 0;
							const evt = new KeyboardEvent('keydown', {
								key: 'k',
								metaKey: isMac,
								ctrlKey: !isMac,
								bubbles: true,
							});
							window.dispatchEvent(evt);
						}}
						className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/70 text-xs text-primary60 hover:text-purple-100 hover:border-[rgba(106,18,205,0.25)] transition-colors"
					>
						<i className="bi-search" />
						<span>Quick jump</span>
						<kbd className="px-1.5 py-0.5 rounded bg-white/80 border border-gray-200 text-[10px] font-medium">
							{navigator.platform.toUpperCase().indexOf('MAC') >= 0
								? '\u2318'
								: 'Ctrl'}
							K
						</kbd>
					</button>
				</div>

				<div className="relative px-4 py-2 mb-4 overflow-y-auto max-h-[calc(100vh-16.875rem)]">
					{filteredFeatures.length > 0 ? (
						<div className="grid grid-cols-3 gap-4">
							{filteredFeatures.map((feature) => (
								<AiConciergeTile
									key={feature.id}
									feature={feature}
								/>
							))}
						</div>
					) : (
						<div className="w-full p-6 border border-primary1 rounded-s-xl rounded-e-xl">
							<p className="text-lg text-center text-primary60 font-medium">
								No matching AI tools found
							</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
};

export default AiConciergePage;
