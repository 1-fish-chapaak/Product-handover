import { useState, useEffect } from 'react';
import { Eye, EyeOff, Download, ShieldCheck } from 'lucide-react';

const DocumentViewer = ({ fileUrl, fileName, suspiciousRegions }) => {
	const [showOverlays, setShowOverlays] = useState(true);
	const [hoveredRegion, setHoveredRegion] = useState(null);
	const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
	const [pdfLoadError, setPdfLoadError] = useState(false);

	const isPdf = fileName?.toLowerCase().endsWith('.pdf');

	useEffect(() => {
		if (!isPdf || !fileUrl) return;
		if (fileUrl.startsWith('blob:')) {
			setPdfBlobUrl(fileUrl);
			return;
		}
		fetch(fileUrl)
			.then((res) => res.blob())
			.then((blob) => {
				const url = URL.createObjectURL(blob);
				setPdfBlobUrl(url);
			})
			.catch(() => setPdfLoadError(true));

		return () => {
			if (pdfBlobUrl && pdfBlobUrl !== fileUrl) {
				URL.revokeObjectURL(pdfBlobUrl);
			}
		};
	}, [fileUrl, isPdf]);

	if (!fileUrl) return null;

	return (
		<div className="border rounded-xl p-4 bg-white">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-primary80">
					Document Viewer
				</h3>
				<div className="flex items-center gap-3">
					{isPdf && fileUrl && (
						<a
							href={fileUrl}
							download={fileName || 'document.pdf'}
							className="flex items-center gap-1.5 text-xs text-primary60 hover:text-primary80 transition-colors"
						>
							<Download className="w-3.5 h-3.5" />
							Download
						</a>
					)}
					{suspiciousRegions?.length > 0 && (
						<button
							onClick={() => setShowOverlays(!showOverlays)}
							className="flex items-center gap-1.5 text-xs text-primary60 hover:text-primary80 transition-colors"
						>
							{showOverlays ? (
								<EyeOff className="w-3.5 h-3.5" />
							) : (
								<Eye className="w-3.5 h-3.5" />
							)}
							{showOverlays ? 'Hide overlays' : 'Show overlays'}
						</button>
					)}
				</div>
			</div>

			<div className="flex gap-4">
				<div className="flex-1 relative bg-gray-50 rounded-lg overflow-hidden">
					{isPdf ? (
						pdfLoadError ? (
							<div className="flex flex-col items-center justify-center h-[500px] text-center">
								<p className="text-sm text-primary60 mb-2">
									Unable to preview PDF inline.
								</p>
								<a
									href={fileUrl}
									download={fileName || 'document.pdf'}
									className="px-4 py-2 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 transition-colors"
								>
									Download PDF
								</a>
							</div>
						) : pdfBlobUrl ? (
							<object
								data={pdfBlobUrl}
								type="application/pdf"
								className="w-full h-[500px]"
							>
								<div className="flex flex-col items-center justify-center h-[500px] text-center">
									<p className="text-sm text-primary60 mb-2">
										PDF preview is not available in this browser.
									</p>
									<a
										href={fileUrl}
										download={fileName || 'document.pdf'}
										className="px-4 py-2 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 transition-colors"
									>
										Download PDF
									</a>
								</div>
							</object>
						) : (
							<div className="flex items-center justify-center h-[500px]">
								<div className="animate-spin w-6 h-6 border-2 border-purple-100 border-t-transparent rounded-full" />
							</div>
						)
					) : (
						<div className="relative">
							<img
								src={fileUrl}
								alt={fileName}
								className="w-full h-auto max-h-[500px] object-contain"
							/>
							{showOverlays &&
								suspiciousRegions?.map((region, i) => (
									<div
										key={i}
										className={`absolute border-2 transition-all cursor-pointer ${
											hoveredRegion === i
												? 'border-red-500 bg-red-500/20 shadow-lg shadow-red-500/30'
												: 'border-red-400/70 bg-red-400/10'
										}`}
										style={{
											left: `${region.x}%`,
											top: `${region.y}%`,
											width: `${region.width}%`,
											height: `${region.height}%`,
										}}
										onMouseEnter={() => setHoveredRegion(i)}
										onMouseLeave={() => setHoveredRegion(null)}
									>
										{hoveredRegion === i && region.label && (
											<div className="absolute -top-7 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap font-medium">
												{region.label}
											</div>
										)}
										<div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-red-500" />
										<div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-red-500" />
										<div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-red-500" />
										<div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-red-500" />
									</div>
								))}
						</div>
					)}
				</div>

				{suspiciousRegions?.length > 0 ? (
					<div className="w-64 shrink-0">
						<h4 className="text-xs font-semibold text-primary60 mb-2">
							Suspicious Regions ({suspiciousRegions.length})
						</h4>
						<div className="space-y-2 max-h-[460px] overflow-y-auto">
							{suspiciousRegions.map((region, i) => (
								<div
									key={i}
									className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
										hoveredRegion === i
											? 'border-red-300 bg-red-50'
											: 'border-gray-200 bg-white hover:border-gray-300'
									}`}
									onMouseEnter={() => setHoveredRegion(i)}
									onMouseLeave={() => setHoveredRegion(null)}
								>
									<p className="font-medium text-primary80">
										{region.label || `Region ${i + 1}`}
									</p>
									{region.page != null && (
										<p className="text-primary40 mt-0.5">
											Page {region.page}
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="w-64 shrink-0">
						<div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 text-center space-y-2">
							<div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto">
								<ShieldCheck className="w-5 h-5 text-emerald-600" />
							</div>
							<p className="text-xs font-semibold text-emerald-800">
								No visual splices detected
							</p>
							<p className="text-[11px] text-emerald-700 leading-snug">
								Pixel-level analysis found no tampering marks on this
								document. Any logical issues — amounts, dates, GSTINs
								— are listed in Key Findings above.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default DocumentViewer;
