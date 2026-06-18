import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/racm/jobs';

export const createRacmJob = async (fileUrl, fileName, customPrompt) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			fileUrl,
			fileName,
			customPrompt: customPrompt || null,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'createRacmJob',
			extra: { fileName, errorMessage: error.message },
		});
		throw error;
	}
};

export const getRacmJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'getRacmJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getRacmJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'getRacmJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const updateRacmJobResult = async (jobId, entries) => {
	try {
		const response = await axiosClientV1.put(`${BASE_PATH}/${jobId}/result`, {
			entries,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'updateRacmJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteRacmJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'deleteRacmJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getRacmJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'getRacmJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadRacmFileLocal = async (file, customPrompt) => {
	try {
		const formData = new FormData();
		formData.append('file', file);
		if (customPrompt) {
			formData.append('customPrompt', customPrompt);
		}
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'racm-generator',
			action: 'uploadRacmFileLocal',
			extra: { fileName: file.name, errorMessage: error.message },
		});
		throw error;
	}
};
