import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * GradientBorderLoader
 * --------------------
 * A visual loading placeholder with an animated moving-gradient border.
 * Ported from the Bulk SQL Executor banner so the same premium-feeling
 * loader can be reused anywhere long-running content is being prepared.
 *
 * Props:
 *   - label: short text shown next to the sparkle icon (e.g. "Analyzing")
 *   - sublabel: optional secondary text (e.g. "Checking tampering marks")
 *   - icon: optional custom lucide icon component (defaults to Sparkles)
 *   - className: outer wrapper class override
 *   - minHeight: Tailwind class for min-height (defaults to "min-h-[72px]")
 *   - children: optional content to render inside the gradient-bordered
 *     card INSTEAD of the default label/sublabel layout. Use this when
 *     you want to wrap a more complex loader (step indicator, progress
 *     bar, activity log) in the gradient border.
 *
 * The border animation uses a 4-stop color gradient (pink → purple → cyan
 * → light gray) on a 300% background position, scrolled infinitely via
 * the `borderMove` keyframe defined in src/index.css. The inner white
 * panel sits on top of the gradient to "cut out" the border effect.
 */
const GradientBorderLoader = ({
	label = 'Loading\u2026',
	sublabel,
	icon: Icon = Sparkles,
	className,
	minHeight = 'min-h-[72px]',
	children,
}) => {
	return (
		<div
			className={cn(
				'relative w-full rounded-[12px] overflow-hidden',
				minHeight,
				className,
			)}
			role="status"
			aria-live="polite"
		>
			{/* Animated gradient border. The inner white div masks the
			    middle of the gradient, leaving only the border visible.
			    8s ease-in-out timing makes the hue drift feel calm and
			    deliberate rather than frantic — matches the shimmer
			    pace of the GradientHeading so headers and loaders
			    breathe on the same rhythm. */}
			<div
				className="absolute inset-0 rounded-[12px] p-[1.5px]
				bg-[linear-gradient(90deg,#F7797D,#C471ED,#12C2E9,#E9E9E9)]
				bg-[length:300%_300%]
				animate-[borderMove_8s_ease-in-out_infinite]"
			>
				<div className="w-full h-full bg-white rounded-[12px]" />
			</div>

			{/* Foreground content. If `children` is provided, render it
			    (for wrapping complex loaders). Otherwise, render the
			    default label/sublabel layout. */}
			<div className="relative rounded-[12px]">
				{children ? (
					children
				) : (
					<div className="px-4 py-4 flex justify-center items-center gap-2 w-full">
						<Icon className="size-5 text-violet-600 shrink-0" />
						<div className="flex flex-col min-w-0">
							<p className="text-sm font-semibold text-purple-100 truncate">
								{label}
							</p>
							{sublabel && (
								<p className="text-xs text-primary60 truncate">
									{sublabel}
								</p>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default GradientBorderLoader;
