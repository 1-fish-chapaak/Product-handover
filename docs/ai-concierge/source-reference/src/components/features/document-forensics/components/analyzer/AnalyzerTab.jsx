import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import UploadSection from './UploadSection';
import ProgressSection from './ProgressSection';
import ForensicScannerOverlay from './ForensicScannerOverlay';
import ForensicReport from '../report/ForensicReport';
import DocumentViewer from '../viewer/DocumentViewer';
import {
	createForensicJob,
	getForensicJobResult,
	getForensicJobStatus,
	deleteForensicJob,
	uploadForensicFileLocal,
} from '../../service/forensics.service';
import { useForensicJobPolling } from '../../hooks/useForensicJobPolling';
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

const AnalyzerTab = ({ selectedJobId, onJobIdChange }) => {
	const [state, setState] = useState(selectedJobId ? STATES.LOADING : STATES.IDLE);
	const [jobId, setJobId] = useState(selectedJobId || null);
	const [result, setResult] = useState(null);
	const [fileName, setFileName] = useState('');
	const [filePreviewUrl, setFilePreviewUrl] = useState(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [uploadProgress, setUploadProgress] = useState(0);
	const internalJobIdRef = useRef(null);

	const { data: statusData } = useForensicJobPolling(
		jobId,
		state === STATES.PROCESSING,
	);

	useEffect(() => {
		if (selectedJobId && selectedJobId !== internalJobIdRef.current) {
			setJobId(selectedJobId);
			setResult(null);
			setFilePreviewUrl(null);
			getForensicJobStatus(selectedJobId)
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
			const data = await getForensicJobResult(id);
			setResult(data);
			setFileName(data.fileName || fileName);
			setState(STATES.COMPLETED);
		} catch {
			setState(STATES.ERROR);
			setErrorMessage('Failed to load results. Please try again.');
		}
	};

	const handleGenerate = useCallback(
		async (file) => {
			try {
				setState(STATES.UPLOADING);
				setUploadProgress(0);
				setFileName(file.name);
				setErrorMessage('');

				// Create a preview URL for the uploaded file
				const previewUrl = URL.createObjectURL(file);
				setFilePreviewUrl(previewUrl);

				let newJobId;

				if (isLocalEnv) {
					setUploadProgress(50);
					const response = await uploadForensicFileLocal(file);
					setUploadProgress(100);
					newJobId = response.job_id;
				} else {
					setUploadProgress(30);
					const { url } = await uploadFile({
						file,
						updateProgress: () => {},
					});
					setUploadProgress(100);
					const response = await createForensicJob(url, file.name);
					newJobId = response.job_id;
				}

				setJobId(newJobId);
				internalJobIdRef.current = newJobId;
				onJobIdChange?.(newJobId);
				setState(STATES.PROCESSING);
				toast.info('Forensic analysis started');
			} catch (error) {
				setState(STATES.ERROR);
				setErrorMessage(
					error?.response?.data?.error ||
						error?.response?.data?.message ||
						'Failed to start forensic analysis',
				);
				toast.error('Failed to start forensic analysis');
			}
		},
		[onJobIdChange],
	);

	const handleNewAnalysis = () => {
		setState(STATES.IDLE);
		setJobId(null);
		internalJobIdRef.current = null;
		setResult(null);
		setFileName('');
		setErrorMessage('');
		if (filePreviewUrl) {
			URL.revokeObjectURL(filePreviewUrl);
			setFilePreviewUrl(null);
		}
		onJobIdChange?.(null);
	};

	const handleCancel = async () => {
		const confirmed = window.confirm(
			'Are you sure? This will stop the analysis and delete the job.',
		);
		if (!confirmed) return;
		try {
			await deleteForensicJob(jobId);
			toast.info('Job cancelled');
		} catch {
			toast.warning(
				'Could not cancel the job — it may have already completed.',
			);
		}
		handleNewAnalysis();
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
						Uploading file...
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
				<div className="space-y-4">
					<ForensicScannerOverlay
						fileUrl={filePreviewUrl}
						fileName={fileName}
						isPdf={fileName?.toLowerCase().endsWith('.pdf')}
					/>
					<ProgressSection
						statusData={statusData}
						fileName={fileName}
						onCancel={handleCancel}
					/>
				</div>
			)}

			{state === STATES.COMPLETED && result && (
				<div className="space-y-6">
					<div className="flex justify-end">
						<button
							onClick={handleNewAnalysis}
							className="px-4 py-2 text-sm bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors"
						>
							New Analysis
						</button>
					</div>
					<ForensicReport result={result} />
					{filePreviewUrl && (
						<DocumentViewer
							fileUrl={filePreviewUrl}
							fileName={fileName}
							suspiciousRegions={
								result?.result?.suspiciousRegions || []
							}
						/>
					)}
				</div>
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
						onClick={handleRetry}
						className="px-6 py-2 bg-purple-100 text-white font-medium rounded-lg hover:bg-purple-80 transition-colors"
					>
						Try again
					</button>
				</div>
			)}
		</div>
	);
};

export default AnalyzerTab;
