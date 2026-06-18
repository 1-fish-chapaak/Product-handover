import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/speech-auditor/jobs';

export const createSpeechAuditorJob = async (fileUrl, fileName, instructions) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			fileUrl,
			fileName,
			instructions,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'createJob',
			extra: { fileName, errorMessage: error.message },
		});
		throw error;
	}
};

export const getSpeechAuditorJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'getJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getSpeechAuditorJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'getJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteSpeechAuditorJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'deleteJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getSpeechAuditorJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'getJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadSpeechAuditorFileLocal = async (file, instructions) => {
	try {
		const formData = new FormData();
		formData.append('file', file);
		if (instructions) formData.append('instructions', instructions);
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'speech-auditor',
			action: 'uploadFileLocal',
			extra: { fileName: file.name, errorMessage: error.message },
		});
		throw error;
	}
};
