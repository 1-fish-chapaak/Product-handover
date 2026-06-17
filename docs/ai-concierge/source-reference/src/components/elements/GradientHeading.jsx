import React from 'react';
import { cn } from '@/lib/utils';

/**
 * GradientHeading
 * ---------------
 * Feature page heading component used across all AI Concierge pages.
 *
 * NOTE: We iterated through three looks on this component before
 * settling on the current one:
 *   1. Animated gradient text (purple→pink→cyan) — rolled back after
 *      feedback that the gradient rendered inconsistently across
 *      monitors and sometimes looked bad.
 *   2. Plain text-primary80 (dark navy) — felt flat and off-brand.
 *   3. Plain text-purple-100 (brand electric purple) — too saturated
 *      for large heading text, overpowered the page.
 *
 * Current (4th attempt): text-purple-80, the slightly-deeper variant
 * of the brand purple already used for hover states throughout the
 * app. Dark enough to read comfortably as a heading but still clearly
 * brand-aligned — a middle ground between the too-bright purple-100
 * and the too-flat primary80.
 *
 * Props:
 *   - as: HTML tag to render (default "h1")
 *   - className: additional Tailwind classes (font size, tracking, etc.)
 *   - children: the heading content
 */
const GradientHeading = ({ as: Tag = 'h1', className, children, ...rest }) => {
	return (
		<Tag className={cn('text-purple-80', className)} {...rest}>
			{children}
		</Tag>
	);
};

export default GradientHeading;
