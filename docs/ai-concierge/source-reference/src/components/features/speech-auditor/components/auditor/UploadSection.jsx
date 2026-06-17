import { useState, useRef } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import {
	SA_ACCEPTED_FILE_TYPES,
	SA_MAX_FILE_SIZE_MB,
} from '../../constants/speechAuditor.constants';

const acceptString = Object.entries(SA_ACCEPTED_FILE_TYPES)
	.flatMap(([mime, exts]) => [mime, ...exts])
	.join(',');

const UploadSection = ({ onGenerate, isDisabled }) => {
	const [file, setFile] = useState(null);
	const [instructions, setInstructions] = useState('');
	const fileInputRef = useRef(null);

	const handleFileChange = (e) => {
		if (e.target.files && e.target.files[0]) {
			const f = e.target.files[0];
			if (f.size > SA_MAX_FILE_SIZE_MB * 1024 * 1024) {
				alert(
					`File is too large. Maximum size is ${SA_MAX_FILE_SIZE_MB}MB.`,
				);
				return;
			}
			setFile(f);
		}
	};

	const handleSubmit = () => {
		if (!file) return;
		onGenerate(file, instructions);
	};

	return (
		<div className="max-w-2xl mx-auto space-y-6">
			<div>
				<label className="block text-sm font-medium text-primary60 mb-2">
					Upload Call Recording
				</label>
				<div
					className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-purple-4/30 transition-colors cursor-pointer"
					onClick={() => fileInputRef.current?.click()}
				>
					<input
						type="file"
						ref={fileInputRef}
						className="hidden"
						accept={acceptString}
						onChange={handleFileChange}
					/>
					{file ? (
						<div className="flex flex-col items-center gap-2">
							<FileAudio className="w-10 h-10 text-purple-100" />
							<span className="font-medium text-primary80">
								{file.name}
							</span>
							<span className="text-sm text-primary40">
								{(file.size / 1024 / 1024).toFixed(2)} MB
							</span>
						</div>
					) : (
						<div className="flex flex-col items-center gap-2">
							<Upload className="w-10 h-10 text-primary20" />
							<span className="font-medium text-primary80">
								Click to upload or drag and drop
							</span>
							<span className="text-sm text-primary40">
								MP3, WAV, M4A, MP4, WebM, OGG up to{' '}
								{SA_MAX_FILE_SIZE_MB}MB
							</span>
						</div>
					)}
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium text-primary60 mb-2">
					Custom Instructions (Optional)
				</label>
				<textarea
					rows={3}
					className="w-full rounded-xl border border-gray-200 shadow-sm focus:border-purple-100 focus:ring-purple-100 sm:text-sm p-3"
					placeholder="e.g., Focus on Quality point of view, check for specific compliance parameters..."
					value={instructions}
					onChange={(e) => setInstructions(e.target.value)}
				/>
			</div>

			<button
				onClick={handleSubmit}
				disabled={!file || isDisabled}
				className="w-full flex items-center justify-center gap-2 bg-purple-100 text-white px-6 py-3 rounded-xl font-medium hover:bg-purple-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				<FileAudio className="w-5 h-5" />
				Analyze Recording
			</button>
		</div>
	);
};

export default UploadSection;
