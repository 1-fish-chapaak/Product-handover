import { useState, useRef, useEffect } from 'react';
import { useRacmExport } from '../../hooks/useRacmExport';

const ExportButtons = ({ entries, fileName }) => {
	const { handleExportCsv, handleExportJson, handleExportXlsx } = useRacmExport(
		entries,
		fileName,
	);
	const [open, setOpen] = useState(false);
	const ref = useRef(null);

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (ref.current && !ref.current.contains(e.target)) setOpen(false);
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const options = [
		{ label: 'Download as XLSX', action: handleExportXlsx },
		{ label: 'Download as CSV', action: handleExportCsv },
		{ label: 'Download as JSON', action: handleExportJson },
	];

	return (
		<div className="relative" ref={ref}>
			<button
				onClick={() => setOpen((prev) => !prev)}
				className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-purple-4 text-primary60 font-medium transition-colors"
			>
				Download
				<svg
					className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{open && (
				<div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
					{options.map((opt) => (
						<button
							key={opt.label}
							onClick={() => {
								opt.action();
								setOpen(false);
							}}
							className="w-full text-left px-4 py-2 text-sm text-primary60 hover:bg-purple-4 hover:text-purple-100 transition-colors"
						>
							{opt.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

export default ExportButtons;
