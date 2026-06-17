import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import {
	IA_AUDIT_GUIDELINES_FILE_TYPES,
	IA_AUDIT_IMAGE_FILE_TYPES,
	IA_MAX_GUIDELINES,
} from '../../constants/imageAnalytics.constants';

const AuditUploadSection = ({ onGenerate, isDisabled }) => {
	const [guidelines, setGuidelines] = useState([]);
	const [images, setImages] = useState([]);
	const [instructions, setInstructions] = useState('');

	const guidelinesDropzone = useDropzone({
		onDrop: useCallback((accepted) => {
			setGuidelines((prev) => {
				const existing = new Set(prev.map((f) => f.name));
				const newFiles = accepted.filter((f) => !existing.has(f.name));
				const merged = [...prev, ...newFiles];
				if (merged.length > IA_MAX_GUIDELINES) {
					toast.error(
						`Maximum ${IA_MAX_GUIDELINES} guidelines documents allowed.`,
					);
					return merged.slice(0, IA_MAX_GUIDELINES);
				}
				return merged;
			});
		}, []),
		onDropRejected: useCallback(() => {
			toast.error('Please upload a PDF, DOC, DOCX, or TXT file.');
		}, []),
		accept: IA_AUDIT_GUIDELINES_FILE_TYPES,
		maxFiles: IA_MAX_GUIDELINES,
		maxSize: 50 * 1024 * 1024,
		disabled: isDisabled,
	});

	const imagesDropzone = useDropzone({
		onDrop: useCallback((accepted) => {
			setImages((prev) => {
				const existing = new Set(prev.map((f) => f.name));
				const newFiles = accepted.filter((f) => !existing.has(f.name));
				return [...prev, ...newFiles];
			});
		}, []),
		onDropRejected: useCallback(() => {
			toast.error('Please upload image files (JPEG, PNG, WebP).');
		}, []),
		accept: IA_AUDIT_IMAGE_FILE_TYPES,
		maxSize: 50 * 1024 * 1024,
		disabled: isDisabled,
	});

	const handleGenerate = () => {
		if (guidelines.length > 0 && images.length > 0) {
			onGenerate(guidelines, images, instructions);
		}
	};

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Guidelines upload */}
				<div>
					<label className="block text-sm font-medium text-primary60 mb-2">
						1. Upload Guidelines (Up to {IA_MAX_GUIDELINES})
					</label>
					<div
						{...guidelinesDropzone.getRootProps()}
						className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
							guidelinesDropzone.isDragActive
								? 'border-purple-100 bg-purple-4'
								: 'border-[rgba(106,18,205,0.12)] hover:border-[rgba(106,18,205,0.25)] bg-white/40 backdrop-blur-sm'
						}`}
					>
						<input {...guidelinesDropzone.getInputProps()} />
						{guidelines.length > 0 ? (
							<div className="space-y-2">
								<p className="text-sm font-medium text-primary80">
									{guidelines.length} document(s) selected
								</p>
								<div className="flex flex-wrap justify-center gap-1">
									{guidelines.map((f) => (
										<span
											key={f.name}
											className="text-xs bg-white/50 backdrop-blur-sm border border-white/60 text-primary60 px-2 py-1 rounded"
										>
											{f.name}
										</span>
									))}
								</div>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setGuidelines([]);
									}}
									className="text-xs text-red-500 hover:text-red-700 font-medium"
								>
									Clear all
								</button>
							</div>
						) : (
							<div>
								<svg
									className="w-8 h-8 mx-auto text-purple-40 mb-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<p className="text-sm text-primary80 font-medium">
									Drop guidelines here
								</p>
								<p className="text-xs text-primary40 mt-1">
									PDF, DOC, DOCX, TXT (up to {IA_MAX_GUIDELINES})
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Images upload */}
				<div>
					<label className="block text-sm font-medium text-primary60 mb-2">
						2. Upload Images to Audit
					</label>
					<div
						{...imagesDropzone.getRootProps()}
						className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
							imagesDropzone.isDragActive
								? 'border-purple-100 bg-purple-4'
								: 'border-[rgba(106,18,205,0.12)] hover:border-[rgba(106,18,205,0.25)] bg-white/40 backdrop-blur-sm'
						}`}
					>
						<input {...imagesDropzone.getInputProps()} />
						{images.length > 0 ? (
							<div className="space-y-2">
								<p className="text-sm font-medium text-primary80">
									{images.length} image(s) selected
								</p>
								<div className="flex flex-wrap justify-center gap-1">
									{images.slice(0, 5).map((f) => (
										<span
											key={f.name}
											className="text-xs bg-white/50 backdrop-blur-sm border border-white/60 text-primary60 px-2 py-1 rounded"
										>
											{f.name}
										</span>
									))}
									{images.length > 5 && (
										<span className="text-xs text-primary40">
											+{images.length - 5} more
										</span>
									)}
								</div>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setImages([]);
									}}
									className="text-xs text-red-500 hover:text-red-700 font-medium"
								>
									Clear all
								</button>
							</div>
						) : (
							<div>
								<svg
									className="w-8 h-8 mx-auto text-purple-40 mb-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<p className="text-sm text-primary80 font-medium">
									Drop images here
								</p>
								<p className="text-xs text-primary40 mt-1">
									JPEG, PNG, WebP
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium text-primary60 mb-1">
					3. Special Instructions (Optional)
				</label>
				<textarea
					value={instructions}
					onChange={(e) => setInstructions(e.target.value)}
					placeholder="E.g., Focus strictly on safety gear compliance. Report in bullet points..."
					className="w-full border border-[rgba(106,18,205,0.1)] bg-white/40 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-primary80 placeholder-primary40 focus:outline-none focus:ring-2 focus:ring-[rgba(106,18,205,0.15)] focus:border-transparent resize-none"
					rows={3}
					disabled={isDisabled}
				/>
			</div>

			<button
				onClick={handleGenerate}
				disabled={
					guidelines.length === 0 || images.length === 0 || isDisabled
				}
				className="w-full bg-gradient-to-r from-[rgba(106,18,205,0.85)] to-[rgba(130,60,220,0.9)] text-white font-medium py-3 rounded-xl hover:from-[rgba(106,18,205,0.95)] hover:to-[rgba(130,60,220,1)] transition-all duration-300 shadow-[0_2px_12px_rgba(106,18,205,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_20px_rgba(106,18,205,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Generate Audit Report
			</button>

			<div className="pt-5 border-t border-[rgba(106,18,205,0.06)] space-y-4">
				<p className="text-sm text-primary60 text-center leading-relaxed">
					Upload guidelines and images to audit — AI extracts KPIs from
					your compliance standards and evaluates each image, generating a
					structured report with Compliant / Non-Compliant / Partially
					Compliant status for every KPI.
				</p>
				<div>
					<p className="text-xs font-semibold text-primary20 uppercase tracking-wider mb-4 text-center">
						How it works
					</p>
					<div className="flex items-start justify-between">
						{[
							{
								title: 'Guidelines',
								desc: 'Upload standards (up to 5)',
							},
							{ title: 'Images', desc: 'Upload items to audit' },
							{
								title: 'KPI Extract',
								desc: 'AI extracts rules',
							},
							{
								title: 'Evaluate',
								desc: 'Per-KPI compliance check',
							},
							{ title: 'Download', desc: 'PDF & Excel export' },
						].map((step, i, arr) => (
							<div key={step.title} className="contents">
								<div className="flex-1 flex flex-col items-center text-center px-1">
									<div className="w-9 h-9 rounded-full bg-white/60 backdrop-blur-sm border border-[rgba(106,18,205,0.1)] shadow-[0_2px_8px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-center mb-2">
										<span className="text-purple-100 font-bold text-sm">
											{i + 1}
										</span>
									</div>
									<p className="text-xs font-semibold text-primary80">
										{step.title}
									</p>
									<p className="text-[11px] text-primary40 mt-0.5 leading-tight">
										{step.desc}
									</p>
								</div>
								{i < arr.length - 1 && (
									<div className="flex items-center pt-3.5">
										<svg
											className="w-4 h-4 text-[rgba(106,18,205,0.2)]"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default AuditUploadSection;
