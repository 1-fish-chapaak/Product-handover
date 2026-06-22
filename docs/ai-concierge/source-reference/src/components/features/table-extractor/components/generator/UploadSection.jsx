import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import {
	TE_ACCEPTED_FILE_TYPES,
	TE_MAX_FILE_SIZE,
} from '../../constants/table-extractor.constants';

const UploadSection = ({
	files,
	setFiles,
	customInstruction,
	setCustomInstruction,
	onStartExtraction,
	isStarting,
}) => {
	const onDrop = useCallback(
		(acceptedFiles) => {
			setFiles((prev) => {
				const existingNames = new Set(prev.map((f) => f.name));
				const newFiles = acceptedFiles.filter(
					(f) => !existingNames.has(f.name),
				);
				const skipped = acceptedFiles.length - newFiles.length;
				if (skipped > 0) {
					toast.warning(
						`${skipped} file(s) skipped — files with the same name are already added.`,
					);
				}
				return [...prev, ...newFiles];
			});
		},
		[setFiles],
	);

	const onDropRejected = useCallback((fileRejections) => {
		const error = fileRejections[0]?.errors[0];
		if (error?.code === 'file-invalid-type') {
			toast.error('Unsupported file type. Please upload PDF files.');
		} else if (error?.code === 'file-too-large') {
			toast.error('File is too large. Maximum size is 100 MB per file.');
		} else {
			toast.error('File not accepted. Please try a different file.');
		}
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		onDropRejected,
		accept: TE_ACCEPTED_FILE_TYPES,
		maxSize: TE_MAX_FILE_SIZE,
		disabled: isStarting,
	});

	const handleRemoveFile = (e, index) => {
		e.stopPropagation();
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const handleClearAll = (e) => {
		e.stopPropagation();
		setFiles([]);
	};

	const getFileSize = (file) => {
		const mb = file.size / (1024 * 1024);
		return mb >= 1
			? `${mb.toFixed(1)} MB`
			: `${(file.size / 1024).toFixed(0)} KB`;
	};

	return (
		<div className="space-y-4">
			{/* Drop zone */}
			<div
				{...getRootProps()}
				className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
					isDragActive
						? 'border-purple-100 bg-purple-4'
						: 'border-[rgba(106,18,205,0.12)] hover:border-[rgba(106,18,205,0.25)] bg-white/40 backdrop-blur-sm'
				} ${isStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
			>
				<input {...getInputProps()} />
				{files.length > 0 ? (
					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-center gap-2">
							{files.map((file, index) => (
								<div
									key={file.name}
									className="bg-white/60 backdrop-blur-sm border border-white/70 text-primary80 rounded-lg px-3 py-2 flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
								>
									<svg
										className="w-4 h-4 shrink-0"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
									<span className="text-sm font-medium">
										{file.name}{' '}
										<span className="text-primary40 font-normal">
											({getFileSize(file)})
										</span>
									</span>
									<button
										onClick={(e) => handleRemoveFile(e, index)}
										className="ml-1 text-primary40 hover:text-primary80"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
							))}
						</div>
						<p className="text-xs text-primary40 mt-2">
							Drop more files or click to add
						</p>
						{files.length > 1 && (
							<button
								onClick={handleClearAll}
								className="text-xs text-red-500 hover:text-red-700 font-medium"
							>
								Clear all
							</button>
						)}
					</div>
				) : (
					<div>
						<svg
							className="w-10 h-10 mx-auto text-purple-40 mb-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						<p className="text-sm text-primary80 font-medium">
							{isDragActive
								? 'Drop your PDF files here'
								: 'Drag & drop your PDF invoices here'}
						</p>
						<p className="text-xs text-primary40 mt-1">
							Supports PDF files — max 100 MB each
						</p>
					</div>
				)}
			</div>

			{/* Custom Instructions */}
			<div>
				<label className="text-xs font-medium text-primary60 mb-1.5 block">
					Custom Instructions (Optional)
				</label>
				<textarea
					value={customInstruction}
					onChange={(e) => setCustomInstruction(e.target.value)}
					placeholder="E.g., 'Ignore the total row at the bottom', 'Dates are in DD/MM/YYYY format'..."
					className="w-full h-20 p-3 text-xs bg-white/40 backdrop-blur-sm border border-gray-200 rounded-xl outline-none focus:border-[rgba(106,18,205,0.3)] resize-none"
				/>
			</div>

			{/* Start Button */}
			<button
				onClick={onStartExtraction}
				disabled={files.length === 0 || isStarting}
				className="w-full bg-gradient-to-r from-[rgba(106,18,205,0.85)] to-[rgba(130,60,220,0.9)] text-white font-medium py-3 rounded-xl hover:from-[rgba(106,18,205,0.95)] hover:to-[rgba(130,60,220,1)] transition-all duration-300 shadow-[0_2px_12px_rgba(106,18,205,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_20px_rgba(106,18,205,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{isStarting
					? 'Starting...'
					: `Start Extraction${files.length > 0 ? ` (${files.length} file${files.length > 1 ? 's' : ''})` : ''}`}
			</button>
		</div>
	);
};

export default UploadSection;
