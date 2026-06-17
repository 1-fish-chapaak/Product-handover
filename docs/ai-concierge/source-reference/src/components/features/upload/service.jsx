import axiosClientV1, { axiosClientV2 } from '@/lib/axios';
import { uploadWithResilience } from '@/utils/multipart-upload';

export const uploadInit = async (data) => {
	try {
		const response = await axiosClientV1.post(`/datasources/upload-init`, data);
		return response.data;
	} catch (error) {
		// Mark error to suppress axios interceptor toast (components show custom ones)
		if (error?.response?.status === 403) {
			error._skipAxiosToast = true;
		}
		throw error;
	}
};

export const getPresignedUrl = async ({ fileName, datasourceId }) => {
	const response = await axiosClientV1.post(`/datasources/presigned-url`, {
		// datasource_id: datasourceId,
		file_name: fileName,
	});

	return response.data;
};

export const getBulkPresignedUrls = async ({ fileNames }) => {
	const response = await axiosClientV1.post(`/datasources/bulk-presigned-url`, {
		files: fileNames,
	});

	return response.data;
};

export const uploadFile = async ({
	file,
	updateProgress,
	cancelToken,
	datasourceId,
}) => {
	try {
		const { presigned_url, url } = await getPresignedUrl({
			fileName: file?.name,
			datasourceId,
		});

		const result = await uploadWithResilience({
			file,
			presignedUrl: presigned_url,
			url,
			onProgress: updateProgress,
			cancelToken,
		});

		return { name: file.name, url: result.url, presigned_url };
	} catch (error) {
		console.error(`Error uploading file ${file.name}`, error);
		throw error;
	}
};

export const addFileInDs = async (data) => {
	const response = await axiosClientV1.post('/files/add-file', data);

	return response.data;
};

export const getDatasourceDetails = async ({ queryKey }) => {
	const { datasourceId, requiredFileId } = queryKey[1];
	const response = await axiosClientV2.get(`/datasources/${datasourceId}`, {
		params: {
			required_files_id: requiredFileId,
		},
	});

	return response.data;
};

export const removeFileFromDs = async ({ datasourceId, fileIds }) => {
	const response = await axiosClientV1.delete(`/files/${datasourceId}`, {
		data: fileIds,
	});

	return response.data;
};

export const getRequiredFilesStatus = async ({ queryKey }) => {
	const { datasourceId, workflowId } = queryKey[1];
	const response = await axiosClientV2.get(
		`/datasources/${datasourceId}/required-file-status/${workflowId}`,
	);

	return response.data;
};

export const removeSheets = async (fileId, sheetNames) => {
	try {
		const response = await axiosClientV1.delete('/files/delete-sheet', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				file_id: fileId,
				sheet_names: sheetNames,
			},
		});
		return response.data;
	} catch (error) {
		console.error('Error removing sheets from file', error);
		throw error;
	}
};
