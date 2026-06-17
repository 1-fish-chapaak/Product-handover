import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
	Search,
	ShieldCheck,
	BarChart3,
	ImageIcon,
	FileText,
	HeartPulse,
	Sparkles,
} from 'lucide-react';
import { TbMicrophone } from 'react-icons/tb';

/**
 * CommandPalette
 * --------------
 * Global Cmd+K (Ctrl+K on Windows/Linux) command palette for AI Concierge.
 * Mounted once at the app root. Press Cmd+K anywhere in the app to open,
 * Esc to close. Arrow keys + Enter navigate.
 *
 * Opens in a portal so z-index conflicts with nested modals / drawers are
 * eliminated. Uses simple substring matching for fuzzy-ish filtering —
 * sufficient for ~10 feature entries.
 */

const FEATURES = [
	{
		label: 'Document Forensics',
		description: 'Detect forgery, tampering, and AI generation',
		keywords: 'forensics tampering fake forgery ai-gen document',
		path: '/app/ai-concierge/document-forensics',
		icon: ShieldCheck,
	},
	{
		label: 'Insights & Anomaly Report',
		description: 'EDA Builder — statistical profiling and anomaly detection',
		keywords: 'eda insights anomaly statistics profile report',
		path: '/app/ai-concierge/eda-builder',
		icon: BarChart3,
	},
	{
		label: 'Image Analytics',
		description: 'Chat, compare, and audit compliance across images',
		keywords: 'image analytics compare chat audit compliance',
		path: '/app/ai-concierge/image-analytics',
		icon: ImageIcon,
	},
	{
		label: 'RACM Generator',
		description: 'Risk Assessment and Control Matrices from SOPs',
		keywords: 'racm risk control matrix sop compliance',
		path: '/app/ai-concierge/racm-generator',
		icon: FileText,
	},
	{
		label: 'Speech Auditor',
		description: 'Call recording analysis with transcription and sentiment',
		keywords: 'speech audio call recording transcription sentiment auditor',
		path: '/app/ai-concierge/speech-auditor',
		icon: TbMicrophone,
	},
	{
		label: 'Medical Report Reader',
		description: 'Forensic medical report analysis for insurance fraud',
		keywords: 'medical report insurance fraud health',
		path: '/app/ai-concierge/medical-report-reader',
		icon: HeartPulse,
	},
	{
		label: 'AI Concierge Home',
		description: 'Go to the AI Concierge feature hub',
		keywords: 'home hub landing start',
		path: '/app/ai-concierge',
		icon: Sparkles,
	},
];

const CommandPalette = () => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	const navigate = useNavigate();

	// Global Cmd+K / Ctrl+K listener. Also Esc-to-close and arrow-key nav
	// are handled here while the palette is open.
	useEffect(() => {
		const handler = (e) => {
			const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
			const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
			if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setOpen((prev) => !prev);
				return;
			}
			if (!open) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				setOpen(false);
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [open]);

	// Reset query + selection whenever the palette opens, and focus the input.
	useEffect(() => {
		if (open) {
			setQuery('');
			setSelectedIdx(0);
			// Defer focus until after the modal mounts in the portal.
			requestAnimationFrame(() => {
				inputRef.current?.focus();
			});
		}
	}, [open]);

	// Simple substring match on label + description + keywords. The
	// filtered array is reused for both render and keyboard nav.
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return FEATURES;
		return FEATURES.filter((f) => {
			const haystack =
				`${f.label} ${f.description} ${f.keywords}`.toLowerCase();
			return haystack.includes(q);
		});
	}, [query]);

	// Clamp selection when the filtered list shrinks.
	useEffect(() => {
		if (selectedIdx >= filtered.length) {
			setSelectedIdx(Math.max(0, filtered.length - 1));
		}
	}, [filtered.length, selectedIdx]);

	const handleSelect = useCallback(
		(idx) => {
			const feature = filtered[idx];
			if (!feature) return;
			setOpen(false);
			navigate(feature.path);
		},
		[filtered, navigate],
	);

	const handleInputKey = (e) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIdx((i) => Math.max(0, i - 1));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			handleSelect(selectedIdx);
		}
	};

	if (!open) return null;

	const modal = (
		<div
			className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
			onClick={() => setOpen(false)}
		>
			<div
				className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/60"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
					<Search className="w-5 h-5 text-primary40 shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleInputKey}
						placeholder={'Jump to any AI Concierge feature\u2026'}
						className="flex-1 outline-none text-sm text-primary80 placeholder-primary40 bg-transparent"
					/>
					<kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-primary40 bg-gray-100 border border-gray-200">
						Esc
					</kbd>
				</div>

				{/* Result list */}
				<div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
					{filtered.length === 0 ? (
						<div className="px-4 py-8 text-center text-sm text-primary40">
							No matching features
						</div>
					) : (
						filtered.map((f, i) => {
							const Icon = f.icon;
							const isSelected = i === selectedIdx;
							return (
								<button
									key={f.path}
									type="button"
									onMouseEnter={() => setSelectedIdx(i)}
									onClick={() => handleSelect(i)}
									className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
										isSelected
											? 'bg-gradient-to-r from-[rgba(106,18,205,0.08)] to-[rgba(18,194,233,0.08)]'
											: 'hover:bg-gray-50'
									}`}
								>
									<div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
										<Icon className="w-4 h-4 text-purple-100" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-primary80 truncate">
											{f.label}
										</p>
										<p className="text-xs text-primary40 truncate">
											{f.description}
										</p>
									</div>
									{isSelected && (
										<kbd className="text-[10px] text-primary40 font-medium px-1.5 py-0.5 rounded bg-white border border-gray-200 shrink-0">
											{'\u21B5'}
										</kbd>
									)}
								</button>
							);
						})
					)}
				</div>

				{/* Footer hint */}
				<div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-primary40">
					<span className="flex items-center gap-1">
						<kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
							{'\u2191'}
						</kbd>
						<kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
							{'\u2193'}
						</kbd>
						to navigate
					</span>
					<span className="flex items-center gap-1">
						<kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
							{'\u21B5'}
						</kbd>
						to open
					</span>
					<span className="flex items-center gap-1 ml-auto">
						<Sparkles className="w-3 h-3 text-violet-600" />
						AI Concierge
					</span>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
};

export default CommandPalette;
