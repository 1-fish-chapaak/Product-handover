import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/forensics/jobs';

export const createForensicJob = async (fileUrl, fileName, enabledChecks) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			fileUrl,
			fileName,
			enabledChecks,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'createForensicJob',
			extra: { fileName, errorMessage: error.message },
		});
		throw error;
	}
};

export const getForensicJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'getForensicJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getForensicJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'getForensicJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteForensicJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'deleteForensicJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getForensicJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'getForensicJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadForensicFileLocal = async (file) => {
	try {
		const formData = new FormData();
		formData.append('file', file);
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'document-forensics',
			action: 'uploadForensicFileLocal',
			extra: { fileName: file.name, errorMessage: error.message },
		});
		throw error;
	}
};
