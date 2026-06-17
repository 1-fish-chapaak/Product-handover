import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SchemaBuilder from './SchemaBuilder';
import UploadSection from './UploadSection';
import ProgressSection from './ProgressSection';
import ResultsSection from './ResultsSection';
import { useTableExtractorJobPolling } from '../../hooks/useTableExtractorJobPolling';
import {
	createTableExtractorJob,
	uploadTableExtractorFilesLocal,
	getTableExtractorJobResult,
	deleteTableExtractorJob,
} from '../../service/table-extractor.service';
import { uploadFile } from '@/components/features/upload/service';
import { INITIAL_EXTRACTION_FIELDS } from '../../constants/table-extractor.constants';

const isLocalEnv = import.meta.env.VITE_ENV === 'local';

const STATES = {
	SCHEMA: 'schema',
	UPLOAD: 'upload',
	UPLOADING: 'uploading',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	ERROR: 'error',
	LOADING: 'loading',
};

const GeneratorTab = ({ selectedJobId, onJobIdChange }) => {
	const [state, setState] = useState(
		selectedJobId ? STATES.LOADING : STATES.SCHEMA,
	);
	const [fields, setFields] = useState([...INITIAL_EXTRACTION_FIELDS]);
	const [uploadFiles, setUploadFiles] = useState([]);
	const [customInstruction, setCustomInstruction] = useState('');
	const [jobId, setJobId] = useState(selectedJobId || null);
	const [resultData, setResultData] = useState(null);
	const [fileNames, setFileNames] = useState([]);
	const [error, setError] = useState(null);

	const queryClient = useQueryClient();

	const { data: statusData } = useTableExtractorJobPolling(
		jobId,
		state === STATES.PROCESSING,
	);

	// Handle incoming selectedJobId from History
	useEffect(() => {
		if (selectedJobId && selectedJobId !== jobId) {
			setJobId(selectedJobId);
			setState(STATES.LOADING);
		}
	}, [selectedJobId]);

	// React to status changes
	useEffect(() => {
		if (!statusData) return;

		if (statusData.status === 'COMPLETED') {
			fetchResult(jobId);
		} else if (statusData.status === 'FAILED') {
			setState(STATES.ERROR);
			setError(statusData.message || 'Extraction failed.');
		} else if (statusData.status === 'IN_PROGRESS' && state === STATES.LOADING) {
			setState(STATES.PROCESSING);
		}
	}, [statusData]);

	const fetchResult = async (id) => {
		try {
			const res = await getTableExtractorJobResult(id);
			setResultData(res.data);
			setFileNames(res.data.file_names || []);
			if (res.data.extraction_fields) {
				setFields(
					res.data.extraction_fields.map((f, i) => ({
						...f,
						id: `loaded-${i}`,
					})),
				);
			}
			setState(STATES.COMPLETED);
		} catch {
			setState(STATES.ERROR);
			setError('Failed to fetch results.');
		}
	};

	const handleProceedToUpload = () => {
		if (fields.length === 0) return;
		setState(STATES.UPLOAD);
	};

	const handleBackToSchema = () => {
		setState(STATES.SCHEMA);
	};

	const handleStartExtraction = async () => {
		setState(STATES.UPLOADING);
		setError(null);

		try {
			const extractionFields = fields.map((f) => ({
				name: f.name,
				type: f.type,
				description: f.description,
				source: f.source,
			}));

			let newJobId;

			if (isLocalEnv) {
				// Local dev: upload files directly via multipart
				const response = await uploadTableExtractorFilesLocal(
					uploadFiles,
					extractionFields,
					customInstruction,
				);
				newJobId = response.data.job_id;
			} else {
				// Production/UAT: upload to S3 via presigned URLs, then create job
				const fileUrls = [];
				const names = [];

				for (let i = 0; i < uploadFiles.length; i++) {
					const file = uploadFiles[i];
					const { url } = await uploadFile({
						file,
						updateProgress: () => {},
					});
					fileUrls.push(url);
					names.push(file.name);
				}

				const response = await createTableExtractorJob(
					fileUrls,
					names,
					extractionFields,
					customInstruction,
				);
				newJobId = response.data.job_id;
			}

			setJobId(newJobId);
			setFileNames(uploadFiles.map((f) => f.name));
			onJobIdChange?.(newJobId);
			setState(STATES.PROCESSING);
		} catch (err) {
			setState(STATES.ERROR);
			setError(err.response?.data?.message || 'Failed to start extraction.');
		}
	};

	const handleCancel = async () => {
		if (!jobId) return;
		if (!window.confirm('Cancel this extraction? This cannot be undone.'))
			return;

		try {
			await deleteTableExtractorJob(jobId);
			queryClient.invalidateQueries({
				queryKey: ['table-extractor-jobs'],
			});
		} catch {
			// ignore
		}
		resetToSchema();
	};

	const resetToSchema = () => {
		setState(STATES.SCHEMA);
		setJobId(null);
		onJobIdChange?.(null);
		setResultData(null);
		setError(null);
		setUploadFiles([]);
		setFileNames([]);
		setCustomInstruction('');
	};

	// Loading state — fetch existing job
	useEffect(() => {
		if (state === STATES.LOADING && jobId) {
			getTableExtractorJobResult(jobId)
				.then((res) => {
					setResultData(res.data);
					setFileNames(res.data.file_names || []);
					if (res.data.extraction_fields) {
						setFields(
							res.data.extraction_fields.map((f, i) => ({
								...f,
								id: `loaded-${i}`,
							})),
						);
					}
					setState(STATES.COMPLETED);
				})
				.catch(() => {
					setState(STATES.PROCESSING);
				});
		}
	}, [state, jobId]);

	return (
		<div className="space-y-6">
			{/* SCHEMA state */}
			{state === STATES.SCHEMA && (
				<>
					<SchemaBuilder fields={fields} setFields={setFields} />
					<div className="flex justify-end pt-2">
						<button
							onClick={handleProceedToUpload}
							disabled={fields.length === 0}
							className="bg-gradient-to-r from-[rgba(106,18,205,0.85)] to-[rgba(130,60,220,0.9)] text-white font-medium px-8 py-2.5 rounded-xl hover:from-[rgba(106,18,205,0.95)] hover:to-[rgba(130,60,220,1)] transition-all duration-300 shadow-[0_2px_12px_rgba(106,18,205,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next: Upload Files
						</button>
					</div>
				</>
			)}

			{/* UPLOAD state */}
			{state === STATES.UPLOAD && (
				<div className="max-w-2xl mx-auto">
					<div className="flex items-center justify-between mb-4">
						<button
							onClick={handleBackToSchema}
							className="inline-flex items-center gap-1 text-sm text-primary40 hover:text-purple-100 transition-colors"
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
									d="M15 19l-7-7 7-7"
								/>
							</svg>
							Back to Schema
						</button>
						<span className="text-xs text-primary40">
							{fields.length} fields configured
						</span>
					</div>
					<UploadSection
						files={uploadFiles}
						setFiles={setUploadFiles}
						customInstruction={customInstruction}
						setCustomInstruction={setCustomInstruction}
						onStartExtraction={handleStartExtraction}
						isStarting={false}
					/>
				</div>
			)}

			{/* UPLOADING state */}
			{state === STATES.UPLOADING && (
				<div className="flex flex-col items-center justify-center py-16">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto mb-4" />
					<p className="text-sm text-primary60">
						Uploading files and starting extraction...
					</p>
				</div>
			)}

			{/* PROCESSING state */}
			{state === STATES.PROCESSING && (
				<ProgressSection
					statusData={statusData}
					fileNames={fileNames}
					onCancel={handleCancel}
				/>
			)}

			{/* COMPLETED state */}
			{state === STATES.COMPLETED && resultData && (
				<ResultsSection
					result={resultData}
					fileNames={fileNames}
					extractionFields={fields}
					onNewAnalysis={resetToSchema}
				/>
			)}

			{/* ERROR state */}
			{state === STATES.ERROR && (
				<div className="text-center py-12">
					<div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
						<svg
							className="w-6 h-6 text-red-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
					</div>
					<p className="text-sm text-red-600 font-medium mb-4">{error}</p>
					<button
						onClick={resetToSchema}
						className="px-6 py-2 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-all"
					>
						Try Again
					</button>
				</div>
			)}

			{/* LOADING state */}
			{state === STATES.LOADING && (
				<div className="flex flex-col items-center justify-center py-16">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto mb-4" />
					<p className="text-sm text-primary60">Loading job...</p>
				</div>
			)}
		</div>
	);
};

export default GeneratorTab;
