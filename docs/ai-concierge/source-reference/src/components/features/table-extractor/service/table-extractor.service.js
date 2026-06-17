import axiosClientV1 from '@/lib/axios';

const BASE = '/table-extractor/jobs';

export const createTableExtractorJob = (
	fileUrls,
	fileNames,
	extractionFields,
	customInstruction,
) =>
	axiosClientV1.post(BASE, {
		fileUrls,
		fileNames,
		extractionFields,
		customInstruction,
	});

export const getTableExtractorJobStatus = (jobId) =>
	axiosClientV1.get(`${BASE}/${jobId}/status`);

export const getTableExtractorJobResult = (jobId) =>
	axiosClientV1.get(`${BASE}/${jobId}/result`);

export const deleteTableExtractorJob = (jobId) =>
	axiosClientV1.delete(`${BASE}/${jobId}`);

export const getTableExtractorJobs = () => axiosClientV1.get(BASE);

// Local dev only
export const uploadTableExtractorFilesLocal = (
	files,
	extractionFields,
	customInstruction,
) => {
	const formData = new FormData();
	files.forEach((f) => formData.append('files', f));
	formData.append('extractionFields', JSON.stringify(extractionFields));
	if (customInstruction) {
		formData.append('customInstruction', customInstruction);
	}
	return axiosClientV1.post(`${BASE}/upload`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
};
