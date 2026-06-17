import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import UploadSection from './UploadSection';
import ProgressSection from './ProgressSection';
import ResultsSection from './ResultsSection';
import {
	createRacmJob,
	getRacmJobResult,
	getRacmJobStatus,
	deleteRacmJob,
	uploadRacmFileLocal,
} from '../../service/racm.service';
import { useRacmJobPolling } from '../../hooks/useRacmJobPolling';
import { uploadFile } from '@/components/features/upload/service';

const isLocalEnv = import.meta.env.VITE_ENV === 'local';

const STATES = {
	IDLE: 'idle',
	UPLOADING: 'uploading',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	EMPTY: 'empty',
	ERROR: 'error',
};

const GeneratorTab = ({ selectedJobId, onJobIdChange }) => {
	const [state, setState] = useState(STATES.IDLE);
	const [jobId, setJobId] = useState(null);
	const [result, setResult] = useState(null);
	const [fileName, setFileName] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [uploadProgress, setUploadProgress] = useState(0);
	const internalJobIdRef = useRef(null);

	const { data: statusData } = useRacmJobPolling(
		jobId,
		state === STATES.PROCESSING,
	);

	// Handle selectedJobId from History tab — check status before loading
	// Skip if the jobId came from our own handleGenerate (avoid loading empty result)
	useEffect(() => {
		if (selectedJobId && selectedJobId !== internalJobIdRef.current) {
			setJobId(selectedJobId);
			setResult(null);
			// Check job status first to decide whether to poll or load result
			getRacmJobStatus(selectedJobId)
				.then((status) => {
					if (status.status === 'COMPLETED') {
						loadResult(selectedJobId);
					} else if (
						status.status === 'FAILED' ||
						status.status === 'CANCELLED'
					) {
						setState(STATES.ERROR);
						setErrorMessage(
							status.errorMessage ||
								status.message ||
								'RACM generation failed. Please try again.',
						);
					} else {
						// Job is still running (PENDING / IN_PROGRESS) — start polling
						setState(STATES.PROCESSING);
					}
				})
				.catch(() => {
					setState(STATES.ERROR);
					setErrorMessage('Failed to load job. Please try again.');
				});
		}
	}, [selectedJobId]);

	// Handle polling status updates
	useEffect(() => {
		if (!statusData) return;

		if (statusData.status === 'COMPLETED') {
			loadResult(jobId);
		} else if (statusData.status === 'FAILED') {
			setState(STATES.ERROR);
			setErrorMessage(
				statusData.errorMessage ||
					statusData.message ||
					'RACM generation failed. Please try again.',
			);
		} else if (statusData.status === 'CANCELLED') {
			setState(STATES.ERROR);
			setErrorMessage('The generation was cancelled.');
		}
	}, [statusData?.status, jobId]);

	const loadResult = async (id) => {
		try {
			const data = await getRacmJobResult(id);
			if (!data?.entries?.length) {
				setState(STATES.EMPTY);
				return;
			}
			setResult(data);
			setFileName(data.fileName || fileName);
			setState(STATES.COMPLETED);
		} catch {
			setState(STATES.ERROR);
			setErrorMessage('Failed to load results. Please try again.');
		}
	};

	const handleGenerate = useCallback(
		async (file, customPrompt) => {
			try {
				setState(STATES.UPLOADING);
				setUploadProgress(0);
				setFileName(file.name);
				setErrorMessage('');

				let newJobId;

				if (isLocalEnv) {
					// Local: upload multipart directly to backend
					const response = await uploadRacmFileLocal(file, customPrompt);
					newJobId = response.jobId;
				} else {
					// Production: upload to S3 via uploadFile, use returned URL
					const { url } = await uploadFile({
						file,
						updateProgress: (progress) => setUploadProgress(progress),
					});

					const response = await createRacmJob(
						url,
						file.name,
						customPrompt,
					);
					newJobId = response.jobId;
				}

				setJobId(newJobId);
				internalJobIdRef.current = newJobId;
				onJobIdChange?.(newJobId);
				setState(STATES.PROCESSING);
				toast.info('RACM generation started');
			} catch (error) {
				setState(STATES.ERROR);
				setErrorMessage(
					error?.response?.data?.error ||
						error?.response?.data?.message ||
						'Failed to start RACM generation',
				);
				toast.error('Failed to start RACM generation');
			}
		},
		[onJobIdChange],
	);

	const handleNewGeneration = () => {
		setState(STATES.IDLE);
		setJobId(null);
		internalJobIdRef.current = null;
		setResult(null);
		setFileName('');
		setErrorMessage('');
		onJobIdChange?.(null);
	};

	const handleCancel = async () => {
		const confirmed = window.confirm(
			'Are you sure? This will stop the analysis and delete the job.',
		);
		if (!confirmed) return;
		try {
			await deleteRacmJob(jobId);
			toast.info('Job cancelled');
		} catch {
			toast.warning(
				'Could not cancel the job — it may have already completed.',
			);
		}
		handleNewGeneration();
	};

	const handleRetry = () => {
		setState(STATES.IDLE);
		setErrorMessage('');
	};

	return (
		<div className="w-full max-w-7xl mx-auto">
			{state === STATES.IDLE && (
				<UploadSection onGenerate={handleGenerate} isDisabled={false} />
			)}

			{state === STATES.UPLOADING && (
				<div className="text-center py-12 space-y-3">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto" />
					<p className="text-sm text-primary60 font-medium">
						Uploading document...
						{uploadProgress > 0 ? ` ${uploadProgress}%` : ''}
					</p>
					<div className="w-64 mx-auto bg-gray-200 rounded-full h-1.5">
						<div
							className="bg-purple-100 h-1.5 rounded-full transition-all duration-300"
							style={{ width: `${uploadProgress}%` }}
						/>
					</div>
					<p className="text-xs text-primary40">{fileName}</p>
				</div>
			)}

			{state === STATES.PROCESSING && (
				<ProgressSection
					statusData={statusData}
					fileName={fileName}
					onCancel={handleCancel}
				/>
			)}

			{state === STATES.COMPLETED && result && (
				<ResultsSection
					result={result}
					fileName={fileName}
					jobId={jobId}
					onNewGeneration={handleNewGeneration}
				/>
			)}

			{state === STATES.EMPTY && (
				<div className="text-center py-12 space-y-4">
					<div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
						<svg
							className="w-6 h-6 text-amber-500"
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
					</div>
					<p className="text-sm text-primary60 font-medium">
						No RACM entries were generated from this document.
					</p>
					<p className="text-xs text-primary40 max-w-md mx-auto">
						Please upload a valid SOP, policy, or process document that
						contains defined workflows, controls, or compliance
						procedures.
					</p>
					<button
						onClick={handleRetry}
						className="px-6 py-2 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors"
					>
						Try with another file
					</button>
				</div>
			)}

			{state === STATES.ERROR && (
				<div className="text-center py-12 space-y-4">
					<div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
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
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<p className="text-sm text-red-600 font-medium">
						{errorMessage}
					</p>
					<button
						onClick={handleRetry}
						className="px-6 py-2 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors"
					>
						Try with another file
					</button>
				</div>
			)}
		</div>
	);
};

export default GeneratorTab;
