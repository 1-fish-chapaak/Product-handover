import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/image-analytics/jobs';

export const createImageAnalyticsJob = async (
	jobType,
	fileUrls,
	fileNames,
	instructions,
) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			jobType,
			fileUrls,
			fileNames,
			instructions,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'createJob',
			extra: { jobType, fileNames, errorMessage: error.message },
		});
		throw error;
	}
};

export const getImageAnalyticsJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'getJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getImageAnalyticsJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'getJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteImageAnalyticsJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'deleteJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getImageAnalyticsJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'getJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const downloadImageAnalyticsReport = async (jobId, reportType) => {
	try {
		const response = await axiosClientV1.get(
			`${BASE_PATH}/${jobId}/reports/${reportType}`,
			{ responseType: 'blob' },
		);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'downloadReport',
			extra: { jobId, reportType, errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadImageAnalyticsFilesLocal = async (
	files,
	jobType,
	instructions,
) => {
	try {
		const formData = new FormData();
		files.forEach((file) => formData.append('files', file));
		formData.append('jobType', jobType);
		if (instructions) formData.append('instructions', instructions);
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'image-analytics',
			action: 'uploadFilesLocal',
			extra: {
				jobType,
				fileNames: files.map((f) => f.name),
				errorMessage: error.message,
			},
		});
		throw error;
	}
};
