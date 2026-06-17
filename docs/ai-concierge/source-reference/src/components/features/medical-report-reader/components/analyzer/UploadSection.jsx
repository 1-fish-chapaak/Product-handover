import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, FolderOpen } from 'lucide-react';
import { MR_ACCEPTED_FILE_TYPES } from '../../constants/medical-reader.constants';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_EXTENSIONS = new Set([
	'.pdf',
	'.jpg',
	'.jpeg',
	'.png',
	'.webp',
	'.heic',
	'.heif',
]);

const isAcceptedFile = (name) => {
	const ext = ('.' + name.split('.').pop()).toLowerCase();
	return ACCEPTED_EXTENSIONS.has(ext);
};

/** Recursively read all files from a dropped folder via FileSystemEntry API */
const readEntriesRecursively = (entry) => {
	return new Promise((resolve) => {
		if (entry.isFile) {
			entry.file((file) => {
				// Preserve relative path from webkitRelativePath or entry.fullPath
				Object.defineProperty(file, 'relativePath', {
					value: entry.fullPath,
					writable: false,
				});
				resolve(isAcceptedFile(file.name) ? [file] : []);
			});
		} else if (entry.isDirectory) {
			const reader = entry.createReader();
			const allEntries = [];
			const readBatch = () => {
				reader.readEntries((entries) => {
					if (entries.length === 0) {
						Promise.all(allEntries.map(readEntriesRecursively)).then(
							(results) => resolve(results.flat()),
						);
					} else {
						allEntries.push(...entries);
						readBatch(); // Continue reading (batched API)
					}
				});
			};
			readBatch();
		} else {
			resolve([]);
		}
	});
};

const UploadSection = ({ onGenerate, isDisabled }) => {
	const [files, setFiles] = useState([]);
	const folderInputRef = useRef(null);

	const addFiles = useCallback((newFiles) => {
		setFiles((prev) => {
			const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
			const unique = newFiles.filter(
				(f) => !existing.has(`${f.name}-${f.size}`),
			);
			return [...prev, ...unique];
		});
	}, []);

	// Standard file drop (react-dropzone)
	const onDrop = useCallback((accepted) => addFiles(accepted), [addFiles]);

	// Folder drop via native drag event (bypasses react-dropzone)
	const handleNativeDrop = useCallback(
		async (e) => {
			const items = e.dataTransfer?.items;
			if (!items) return;

			// Check if any item is a directory
			const entries = [];
			let hasDirectory = false;
			for (const item of items) {
				const entry = item.webkitGetAsEntry?.();
				if (entry) {
					entries.push(entry);
					if (entry.isDirectory) hasDirectory = true;
				}
			}

			if (!hasDirectory) return; // Let react-dropzone handle regular files

			e.preventDefault();
			e.stopPropagation();
			const allFiles = (
				await Promise.all(entries.map(readEntriesRecursively))
			).flat();
			addFiles(allFiles);
		},
		[addFiles],
	);

	// Folder picker via hidden input with webkitdirectory
	const handleFolderSelect = useCallback(
		(e) => {
			const fileList = Array.from(e.target.files || []);
			const accepted = fileList.filter((f) => isAcceptedFile(f.name));
			addFiles(accepted);
			e.target.value = ''; // Reset for re-selection
		},
		[addFiles],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: MR_ACCEPTED_FILE_TYPES,
		maxSize: MAX_FILE_SIZE,
		disabled: isDisabled,
		noClick: false,
	});

	const removeFile = (index) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const handleGenerate = () => {
		if (files.length > 0) onGenerate(files);
	};

	const getFileIcon = (file) => {
		if (file.type === 'application/pdf')
			return <FileText className="w-4 h-4 text-red-500" />;
		return <Image className="w-4 h-4 text-blue-500" />;
	};

	const getRelativePath = (file) => {
		const path = file.relativePath || file.webkitRelativePath || '';
		if (!path || path === file.name) return null;
		// Show parent folder(s) only
		const parts = path.split('/').filter(Boolean);
		return parts.length > 1 ? parts.slice(0, -1).join('/') : null;
	};

	return (
		<div className="space-y-6">
			{/* Drop zone with folder support */}
			<div
				{...getRootProps()}
				onDropCapture={handleNativeDrop}
				className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-purple-100 bg-purple-100/5' : 'border-gray-300 hover:border-purple-100/50 bg-white/40 backdrop-blur-sm'}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
			>
				<input {...getInputProps()} />
				<div className="w-12 h-12 rounded-full bg-purple-100/10 flex items-center justify-center mx-auto mb-3">
					<Upload className="w-5 h-5 text-purple-100" />
				</div>
				<p className="text-sm font-medium text-primary80">
					{isDragActive
						? 'Drop files or folders here...'
						: 'Drag & drop files or folders, or click to browse'}
				</p>
				<p className="text-xs text-primary40 mt-1">
					PDF, JPEG, PNG, WebP, HEIC — up to 50 MB per file
				</p>
				<p className="text-xs text-primary40 mt-0.5">
					Upload a patient case folder or individual reports
				</p>
			</div>

			{/* Folder picker button */}
			<div className="flex justify-center">
				<input
					ref={folderInputRef}
					type="file"
					webkitdirectory=""
					directory=""
					multiple
					className="hidden"
					onChange={handleFolderSelect}
				/>
				<button
					onClick={() => folderInputRef.current?.click()}
					disabled={isDisabled}
					className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-100 bg-purple-100/5 border border-purple-100/20 rounded-lg hover:bg-purple-100/10 transition-colors disabled:opacity-50"
				>
					<FolderOpen className="w-4 h-4" />
					Upload Folder
				</button>
			</div>

			{/* File list */}
			{files.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium text-primary60">
							{files.length} file{files.length > 1 ? 's' : ''} selected
							{files.length > 4 && (
								<span className="text-xs text-primary40 ml-2">
									(will use batched analysis)
								</span>
							)}
						</p>
						<button
							onClick={() => setFiles([])}
							className="text-xs text-primary40 hover:text-red-500 transition-colors"
						>
							Clear all
						</button>
					</div>

					<div className="space-y-1.5 max-h-60 overflow-y-auto">
						{files.map((file, index) => {
							const folder = getRelativePath(file);
							return (
								<div
									key={`${file.name}-${index}`}
									className="flex items-center gap-3 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-lg border border-white/70"
								>
									{getFileIcon(file)}
									<div className="flex-1 min-w-0">
										<span className="text-sm text-primary80 truncate block">
											{file.name}
										</span>
										{folder && (
											<span className="text-xs text-primary40 truncate block">
												{folder}
											</span>
										)}
									</div>
									<span className="text-xs text-primary40 shrink-0">
										{(file.size / 1024).toFixed(0)} KB
									</span>
									<button
										onClick={() => removeFile(index)}
										className="text-primary40 hover:text-red-500 transition-colors"
									>
										<X className="w-3.5 h-3.5" />
									</button>
								</div>
							);
						})}
					</div>

					<button
						onClick={handleGenerate}
						disabled={isDisabled}
						className="w-full py-2.5 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors disabled:opacity-50"
					>
						Analyze {files.length} Report{files.length > 1 ? 's' : ''}
					</button>
				</div>
			)}

			<div className="bg-white/30 backdrop-blur-sm rounded-xl border border-white/50 p-4">
				<p className="text-xs font-semibold text-primary60 uppercase tracking-wider mb-3">
					How it works
				</p>
				<div className="flex items-start gap-4">
					{[
						{
							n: '1',
							t: 'Upload a case folder or individual medical reports',
						},
						{ n: '2', t: 'AI extracts every test result exhaustively' },
						{ n: '3', t: 'Cross-report forensic & fraud analysis' },
					].map(({ n, t }) => (
						<div key={n} className="flex items-start gap-2 flex-1">
							<span className="w-5 h-5 rounded-full bg-purple-100/10 text-purple-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
								{n}
							</span>
							<p className="text-xs text-primary40 leading-relaxed">
								{t}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default UploadSection;
