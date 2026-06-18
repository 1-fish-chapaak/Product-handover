import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/eda/jobs';

export const createEdaJob = async (fileUrls, fileNames) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			fileUrls,
			fileNames,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'createEdaJob',
			extra: { fileNames, errorMessage: error.message },
		});
		throw error;
	}
};

export const getEdaJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'getEdaJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getEdaJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'getEdaJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteEdaJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'deleteEdaJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getEdaJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'getEdaJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const getEdaReportHtml = async (jobId, reportType) => {
	try {
		const response = await axiosClientV1.get(
			`${BASE_PATH}/${jobId}/reports/${reportType}`,
			{ responseType: 'text', headers: { Accept: 'text/html' } },
		);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'getEdaReportHtml',
			extra: { jobId, reportType, errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadEdaFilesLocal = async (files) => {
	try {
		const formData = new FormData();
		files.forEach((file) => formData.append('files', file));
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'eda-builder',
			action: 'uploadEdaFilesLocal',
			extra: {
				fileNames: files.map((f) => f.name),
				errorMessage: error.message,
			},
		});
		throw error;
	}
};
