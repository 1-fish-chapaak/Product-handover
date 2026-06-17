import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import AuditUploadSection from './AuditUploadSection';
import AuditResultSection from './AuditResultSection';
import ProgressSection from '../shared/ProgressSection';
import {
	createImageAnalyticsJob,
	getImageAnalyticsJobResult,
	getImageAnalyticsJobStatus,
	deleteImageAnalyticsJob,
	uploadImageAnalyticsFilesLocal,
} from '../../service/imageAnalytics.service';
import { useImageAnalyticsJobPolling } from '../../hooks/useImageAnalyticsJobPolling';
import { uploadFile } from '@/components/features/upload/service';

const isLocalEnv = import.meta.env.VITE_ENV === 'local';

const STATES = {
	IDLE: 'idle',
	UPLOADING: 'uploading',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	ERROR: 'error',
	LOADING: 'loading',
};

const AuditTab = ({ selectedJobId, onJobIdChange }) => {
	const [state, setState] = useState(selectedJobId ? STATES.LOADING : STATES.IDLE);
	const [jobId, setJobId] = useState(selectedJobId || null);
	const [result, setResult] = useState(null);
	const [fileNames, setFileNames] = useState([]);
	const [errorMessage, setErrorMessage] = useState('');
	const [uploadProgress, setUploadProgress] = useState(0);
	const internalJobIdRef = useRef(null);

	const { data: statusData } = useImageAnalyticsJobPolling(
		jobId,
		state === STATES.PROCESSING,
	);

	useEffect(() => {
		if (selectedJobId && selectedJobId !== internalJobIdRef.current) {
			setJobId(selectedJobId);
			setResult(null);
			getImageAnalyticsJobStatus(selectedJobId)
				.then((status) => {
					if (status.status === 'COMPLETED') {
						setState(STATES.LOADING);
						loadResult(selectedJobId);
					} else if (status.status === 'FAILED') {
						setState(STATES.ERROR);
						setErrorMessage(
							status.errorMessage ||
								'Analysis failed. Please try again.',
						);
					} else if (status.status === 'CANCELLED') {
						setState(STATES.ERROR);
						setErrorMessage('The analysis was cancelled.');
					} else {
						setState(STATES.PROCESSING);
					}
				})
				.catch(() => {
					setState(STATES.ERROR);
					setErrorMessage('Failed to load job. Please try again.');
				});
		}
	}, [selectedJobId]);

	useEffect(() => {
		if (!statusData) return;
		if (statusData.status === 'COMPLETED') {
			loadResult(jobId);
		} else if (statusData.status === 'FAILED') {
			setState(STATES.ERROR);
			setErrorMessage(
				statusData.errorMessage ||
					statusData.message ||
					'Analysis failed. Please try again.',
			);
		} else if (statusData.status === 'CANCELLED') {
			setState(STATES.ERROR);
			setErrorMessage('The analysis was cancelled.');
		}
	}, [statusData?.status, jobId]);

	const loadResult = async (id) => {
		try {
			const data = await getImageAnalyticsJobResult(id);
			setResult(data);
			setState(STATES.COMPLETED);
		} catch {
			setState(STATES.ERROR);
			setErrorMessage('Failed to load results. Please try again.');
		}
	};

	const handleGenerate = useCallback(
		async (guidelinesFiles, imageFiles, instructions) => {
			try {
				setState(STATES.UPLOADING);
				setUploadProgress(0);
				// Guidelines first, then images (order matters for Python pipeline)
				const guidelinesList = Array.isArray(guidelinesFiles)
					? guidelinesFiles
					: [guidelinesFiles];
				const allFiles = [...guidelinesList, ...imageFiles];
				setFileNames(allFiles.map((f) => f.name));
				setErrorMessage('');

				let newJobId;

				if (isLocalEnv) {
					setUploadProgress(50);
					const response = await uploadImageAnalyticsFilesLocal(
						allFiles,
						'AUDIT',
						instructions,
					);
					setUploadProgress(100);
					newJobId = response.job_id;
				} else {
					const fileUrls = [];
					const names = [];
					for (let i = 0; i < allFiles.length; i++) {
						setUploadProgress(Math.round((i / allFiles.length) * 90));
						const { url } = await uploadFile({
							file: allFiles[i],
							updateProgress: () => {},
						});
						fileUrls.push(url);
						names.push(allFiles[i].name);
					}
					setUploadProgress(100);
					const response = await createImageAnalyticsJob(
						'AUDIT',
						fileUrls,
						names,
						instructions,
					);
					newJobId = response.job_id;
				}

				setJobId(newJobId);
				internalJobIdRef.current = newJobId;
				onJobIdChange?.(newJobId);
				setState(STATES.PROCESSING);
				toast.info('Audit analysis started');
			} catch (error) {
				setState(STATES.ERROR);
				setErrorMessage(
					error?.response?.data?.error ||
						error?.response?.data?.message ||
						'Failed to start analysis',
				);
				toast.error('Failed to start analysis');
			}
		},
		[onJobIdChange],
	);

	const handleNewAnalysis = () => {
		setState(STATES.IDLE);
		setJobId(null);
		internalJobIdRef.current = null;
		setResult(null);
		setFileNames([]);
		setErrorMessage('');
		onJobIdChange?.(null);
	};

	const handleCancel = async () => {
		const confirmed = window.confirm('Are you sure? This will stop the audit.');
		if (!confirmed) return;
		try {
			await deleteImageAnalyticsJob(jobId);
			toast.info('Job cancelled');
		} catch {
			toast.warning(
				'Could not cancel the job — it may have already completed.',
			);
		}
		handleNewAnalysis();
	};

	return (
		<div className="w-full max-w-7xl mx-auto">
			{state === STATES.IDLE && (
				<AuditUploadSection onGenerate={handleGenerate} isDisabled={false} />
			)}

			{state === STATES.UPLOADING && (
				<div className="text-center py-12 space-y-3">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto" />
					<p className="text-sm text-primary60 font-medium">
						Uploading files...{' '}
						{uploadProgress > 0 ? `${uploadProgress}%` : ''}
					</p>
					<div className="w-64 mx-auto bg-gray-200 rounded-full h-1.5">
						<div
							className="bg-purple-100 h-1.5 rounded-full transition-all duration-300"
							style={{ width: `${uploadProgress}%` }}
						/>
					</div>
				</div>
			)}

			{state === STATES.PROCESSING && (
				<ProgressSection
					statusData={statusData}
					fileNames={fileNames}
					onCancel={handleCancel}
				/>
			)}

			{state === STATES.COMPLETED && result && (
				<AuditResultSection
					result={result}
					jobId={jobId}
					onNewAnalysis={handleNewAnalysis}
				/>
			)}

			{state === STATES.LOADING && (
				<div className="text-center py-12 space-y-3">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto" />
					<p className="text-sm text-primary60 font-medium">
						Loading results...
					</p>
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
						onClick={() => {
							setState(STATES.IDLE);
							setErrorMessage('');
						}}
						className="px-6 py-2 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors"
					>
						Try again
					</button>
				</div>
			)}
		</div>
	);
};

export default AuditTab;
