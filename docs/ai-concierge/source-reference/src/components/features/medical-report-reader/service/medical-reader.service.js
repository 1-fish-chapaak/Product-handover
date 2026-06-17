import axiosClientV1 from '@/lib/axios';
import { logError } from '@/lib/logger';

const BASE_PATH = '/medical-reader/jobs';

export const createMedicalReaderJob = async (fileUrls, fileNames) => {
	try {
		const response = await axiosClientV1.post(BASE_PATH, {
			fileUrls,
			fileNames,
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'createMedicalReaderJob',
			extra: { fileNames, errorMessage: error.message },
		});
		throw error;
	}
};

export const getMedicalReaderJobStatus = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/status`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'getMedicalReaderJobStatus',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getMedicalReaderJobResult = async (jobId) => {
	try {
		const response = await axiosClientV1.get(`${BASE_PATH}/${jobId}/result`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'getMedicalReaderJobResult',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const deleteMedicalReaderJob = async (jobId) => {
	try {
		const response = await axiosClientV1.delete(`${BASE_PATH}/${jobId}`);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'deleteMedicalReaderJob',
			extra: { jobId, errorMessage: error.message },
		});
		throw error;
	}
};

export const getMedicalReaderJobs = async () => {
	try {
		const response = await axiosClientV1.get(BASE_PATH);
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'getMedicalReaderJobs',
			extra: { errorMessage: error.message },
		});
		throw error;
	}
};

export const uploadMedicalReaderFilesLocal = async (files) => {
	try {
		const formData = new FormData();
		files.forEach((file) => formData.append('files', file));
		const response = await axiosClientV1.post(`${BASE_PATH}/upload`, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	} catch (error) {
		logError(error, {
			feature: 'medical-report-reader',
			action: 'uploadMedicalReaderFilesLocal',
			extra: {
				fileNames: files.map((f) => f.name),
				errorMessage: error.message,
			},
		});
		throw error;
	}
};
