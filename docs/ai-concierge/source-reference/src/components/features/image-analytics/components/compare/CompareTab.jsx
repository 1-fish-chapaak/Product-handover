import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import CompareUploadSection from './CompareUploadSection';
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

const CompareTab = ({ selectedJobId, onJobIdChange }) => {
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
		async (files, instructions) => {
			try {
				setState(STATES.UPLOADING);
				setUploadProgress(0);
				setFileNames(files.map((f) => f.name));
				setErrorMessage('');

				let newJobId;

				if (isLocalEnv) {
					setUploadProgress(50);
					const response = await uploadImageAnalyticsFilesLocal(
						files,
						'COMPARE',
						instructions,
					);
					setUploadProgress(100);
					newJobId = response.job_id;
				} else {
					const fileUrls = [];
					const names = [];
					for (let i = 0; i < files.length; i++) {
						setUploadProgress(Math.round((i / files.length) * 90));
						const { url } = await uploadFile({
							file: files[i],
							updateProgress: () => {},
						});
						fileUrls.push(url);
						names.push(files[i].name);
					}
					setUploadProgress(100);
					const response = await createImageAnalyticsJob(
						'COMPARE',
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
				toast.info('Comparison started');
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
		const confirmed = window.confirm(
			'Are you sure? This will stop the comparison.',
		);
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
				<CompareUploadSection
					onGenerate={handleGenerate}
					isDisabled={false}
				/>
			)}

			{state === STATES.UPLOADING && (
				<div className="text-center py-12 space-y-3">
					<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto" />
					<p className="text-sm text-primary60 font-medium">
						Uploading images...{' '}
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
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
								<svg
									className="w-5 h-5 text-green-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
							<h3 className="text-sm font-semibold text-primary80">
								Comparison Complete
							</h3>
						</div>
						<button
							onClick={handleNewAnalysis}
							className="px-4 py-1.5 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 transition-colors font-medium"
						>
							New Comparison
						</button>
					</div>
					<div className="bg-gray-50 rounded-lg p-6 text-sm text-primary80 leading-relaxed prose prose-sm prose-slate max-w-none prose-headings:text-primary80 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-primary80">
						<ReactMarkdown>
							{result.result?.answer || 'No comparison generated.'}
						</ReactMarkdown>
					</div>
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

export default CompareTab;
