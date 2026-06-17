import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { EDA_ACCEPTED_FILE_TYPES } from '../../constants/eda.constants';
import { getFileSize } from '@/utils/file';

const UploadSection = ({ onGenerate, isDisabled }) => {
	const [files, setFiles] = useState([]);

	const onDrop = useCallback((acceptedFiles) => {
		setFiles((prev) => {
			const existingNames = new Set(prev.map((f) => f.name));
			const newFiles = acceptedFiles.filter((f) => !existingNames.has(f.name));
			const skipped = acceptedFiles.length - newFiles.length;
			if (skipped > 0) {
				toast.warning(
					`${skipped} file(s) skipped — files with the same name are already added.`,
				);
			}
			return [...prev, ...newFiles];
		});
	}, []);

	const onDropRejected = useCallback((fileRejections) => {
		const error = fileRejections[0]?.errors[0];
		if (error?.code === 'file-invalid-type') {
			toast.error('Unsupported file type. Please upload CSV or Excel files.');
		} else if (error?.code === 'file-too-large') {
			toast.error('File is too large. Maximum size is 100 MB per file.');
		} else {
			toast.error('File not accepted. Please try a different file.');
		}
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		onDropRejected,
		accept: EDA_ACCEPTED_FILE_TYPES,
		maxSize: 100 * 1024 * 1024,
		disabled: isDisabled,
	});

	const handleGenerate = () => {
		if (files.length > 0) {
			onGenerate(files);
		}
	};

	const handleRemoveFile = (e, index) => {
		e.stopPropagation();
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const handleClearAll = (e) => {
		e.stopPropagation();
		setFiles([]);
	};

	return (
		<div className="space-y-4">
			<div
				{...getRootProps()}
				className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
					isDragActive
						? 'border-purple-100 bg-purple-4'
						: 'border-[rgba(106,18,205,0.12)] hover:border-[rgba(106,18,205,0.25)] bg-white/40 backdrop-blur-sm'
				} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
								? 'Drop your files here'
								: 'Drag & drop your data files here'}
						</p>
						<p className="text-xs text-primary40 mt-1">
							Supports CSV and Excel files (.csv, .xls, .xlsx)
						</p>
						<p className="text-xs text-primary40 mt-0.5">
							Upload one or more files — max 100 MB each
						</p>
					</div>
				)}
			</div>

			<button
				onClick={handleGenerate}
				disabled={files.length === 0 || isDisabled}
				className="w-full bg-gradient-to-r from-[rgba(106,18,205,0.85)] to-[rgba(130,60,220,0.9)] text-white font-medium py-3 rounded-xl hover:from-[rgba(106,18,205,0.95)] hover:to-[rgba(130,60,220,1)] transition-all duration-300 shadow-[0_2px_12px_rgba(106,18,205,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_20px_rgba(106,18,205,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Run Analysis
				{files.length > 0 &&
					` (${files.length} file${files.length > 1 ? 's' : ''})`}
			</button>

			{/* Feature summary & flow */}
			<div className="pt-5 border-t border-[rgba(106,18,205,0.06)] space-y-4">
				<p className="text-sm text-primary60 text-center leading-relaxed">
					Upload your datasets and get comprehensive statistical profiling
					— identify data quality issues, detect anomalies, and uncover
					hidden patterns, all powered by AI.
				</p>

				<div>
					<p className="text-xs font-semibold text-primary20 uppercase tracking-wider mb-4 text-center">
						How it works
					</p>
					<div className="flex items-start justify-between">
						{[
							{
								title: 'Upload',
								desc: 'CSV or Excel files',
							},
							{
								title: 'Data Profiling',
								desc: 'Statistical column summaries',
							},
							{
								title: 'Anomaly Detection',
								desc: 'Outliers & irregularities',
							},
							{
								title: 'Heuristic Analysis',
								desc: 'Rule-based quality checks',
							},
							{
								title: 'Report',
								desc: 'Interactive visual report',
							},
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

export default UploadSection;
