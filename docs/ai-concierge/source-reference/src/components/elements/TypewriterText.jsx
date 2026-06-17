import React, { useEffect, useState, useRef } from 'react';

/**
 * TypewriterText
 * --------------
 * Renders a text string with a typewriter animation. Every time the
 * `text` prop changes, the component resets and types out the new value
 * character-by-character with a configurable speed.
 *
 * Used in AI Concierge feature loaders to make progress messages feel
 * like a real-time stream from the analyzing agent rather than a static
 * label that suddenly changes.
 *
 * Props:
 *   - text: the string to type out
 *   - speed: milliseconds between characters (default 18ms ≈ 55 chars/sec,
 *     fast enough not to feel laggy for short status lines)
 *   - className: pass-through className for the wrapping <span>
 *   - showCursor: whether to show the blinking block cursor at the end
 *     while typing (default true)
 */
const TypewriterText = ({
	text = '',
	speed = 18,
	className = '',
	showCursor = true,
}) => {
	const [displayed, setDisplayed] = useState('');
	const [isTyping, setIsTyping] = useState(false);
	const timerRef = useRef(null);

	useEffect(() => {
		// Whenever the source text changes, restart the typing animation
		// from the beginning. Clearing the previous interval prevents two
		// timers from racing and producing scrambled output when messages
		// arrive rapidly.
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (!text) {
			setDisplayed('');
			setIsTyping(false);
			return;
		}

		setDisplayed('');
		setIsTyping(true);

		let i = 0;
		timerRef.current = setInterval(() => {
			i += 1;
			setDisplayed(text.slice(0, i));
			if (i >= text.length) {
				clearInterval(timerRef.current);
				timerRef.current = null;
				setIsTyping(false);
			}
		}, speed);

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [text, speed]);

	return (
		<span className={className}>
			{displayed}
			{showCursor && isTyping && (
				<span
					className="inline-block w-[2px] h-[1em] bg-current align-[-2px] ml-0.5 animate-pulse"
					aria-hidden="true"
				/>
			)}
		</span>
	);
};

export default TypewriterText;
