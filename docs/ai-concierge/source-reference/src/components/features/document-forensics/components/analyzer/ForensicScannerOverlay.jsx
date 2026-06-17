import React from 'react';
import { Scan } from 'lucide-react';

/**
 * ForensicScannerOverlay
 * ----------------------
 * HUD-style scanner animation shown while a Document Forensics job is
 * running. Renders the uploaded document image with:
 *   - an animated horizontal sweep line that moves top-to-bottom in a loop
 *     (powered by the scannerSweep keyframe in src/index.css)
 *   - four L-shaped corner brackets framing the image in neon purple
 *   - a top-left "VISION ENGINE SCANNING" label with a pulsing indicator
 *   - a subtle dark gradient overlay for contrast
 *
 * The visual language is intentionally Minority-Report / Iron-Man — designed
 * to turn a plain "wait for the pipeline" moment into a flagship loading
 * experience that feels like a real forensic scanner at work.
 *
 * Props:
 *   - fileUrl: preview URL of the uploaded file (image or PDF)
 *   - fileName: display filename
 *   - isPdf: whether the file is a PDF (we skip image rendering then)
 */
const ForensicScannerOverlay = ({ fileUrl, fileName, isPdf = false }) => {
	// Skip overlay entirely for PDFs since we don't have a preview image.
	if (!fileUrl || isPdf) return null;

	return (
		<div className="relative w-full rounded-xl overflow-hidden bg-white border border-purple-200 shadow-[0_0_40px_rgba(196,113,237,0.18)]">
			{/* Header bar — "VISION ENGINE SCANNING" with a pulsing red dot.
			    Light theme: soft purple tint instead of dark navy. */}
			<div className="relative z-20 flex items-center justify-between px-4 py-2.5 border-b border-purple-100 bg-purple-50/50">
				<div className="flex items-center gap-2">
					<Scan className="w-4 h-4 text-purple-600" />
					<span className="text-[11px] font-bold tracking-[0.2em] text-purple-700 uppercase">
						Irame Vision Engine
					</span>
					<span className="text-[10px] text-purple-400 tracking-widest">
						v2.0
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
					<span className="text-[10px] font-semibold tracking-widest text-red-500 uppercase">
						Scanning
					</span>
				</div>
			</div>

			{/* Image container with scanner overlay.
			    White background so the uploaded document looks natural
			    and the HUD brackets read clearly against the paper. */}
			<div className="relative w-full h-[360px] flex items-center justify-center bg-white">
				{/* The uploaded image (contained, not cropped) */}
				<img
					src={fileUrl}
					alt={fileName}
					className="max-w-full max-h-full object-contain"
					draggable={false}
				/>

				{/* Horizontal scan sweep line — moves top-to-bottom infinitely.
				    Uses the scannerSweep keyframe defined in index.css.
				    On white background we keep the purple-to-cyan glow but
				    increase opacity so the line stays visible. */}
				<div
					className="pointer-events-none absolute left-0 right-0 h-[3px] z-10"
					style={{
						animation: 'scannerSweep 2.4s linear infinite',
						background:
							'linear-gradient(90deg, transparent, rgba(106,18,205,0.85) 50%, transparent)',
						boxShadow:
							'0 0 14px 2px rgba(106,18,205,0.55), 0 0 28px 4px rgba(18,194,233,0.25)',
					}}
				/>

				{/* Corner brackets — 4 L-shaped HUD corners, darker purple
				    so they read clearly on the white background. */}
				<div className="pointer-events-none absolute inset-4 z-10">
					{/* Top-left */}
					<div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-purple-500" />
					{/* Top-right */}
					<div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-purple-500" />
					{/* Bottom-left */}
					<div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-purple-500" />
					{/* Bottom-right */}
					<div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-purple-500" />
				</div>

				{/* Scanline grid — subtle horizontal lines for that CRT feel.
				    Lower opacity on white so it's a texture, not a distraction. */}
				<div
					className="pointer-events-none absolute inset-0 z-5 opacity-30"
					style={{
						background:
							'repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(106,18,205,0.05) 3px, rgba(106,18,205,0.05) 4px)',
					}}
				/>
			</div>

			{/* Footer — filename and "analyzing" marquee. Light theme. */}
			<div className="relative z-20 flex items-center justify-between px-4 py-2 border-t border-purple-100 bg-purple-50/50">
				<span className="text-[11px] text-purple-700 truncate max-w-[60%]">
					{fileName}
				</span>
				<span className="text-[10px] font-mono text-cyan-600 tracking-wider">
					&gt;&gt; DEEP PIXEL ANALYSIS
				</span>
			</div>
		</div>
	);
};

export default ForensicScannerOverlay;
