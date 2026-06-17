import axiosClientV1 from '@/lib/axios';
import { removeQueryString } from './url';
import { logError } from '@/lib/logger';
import { toast } from '@/lib/toast';

export const isImageFile = (file) => {
	return file.type.includes('image');
};

export function isImageUrl(url) {
	const urlWithoutQueryString = removeQueryString(url);
	return /\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i.test(urlWithoutQueryString);
}

/**
 * Get file type from file object
 * Uses centralized config for comprehensive MIME type handling
 * @deprecated For new code, use getFileTypeFromFile from @/config/file-upload.config.js.
 * This export exists for legacy compatibility (e.g., mapping to 'pdf' / 'excel' / 'csv').
 */
export { getFileTypeLegacy as getFileType } from '@/config/file-upload.config';

export const createSignedUrlFromS3Url = async (s3Url) => {
	const url = removeQueryString(s3Url);
	const resp = await axiosClientV1.get(
		`/files/signed-url?file_url=${decodeURI(url)}`,
	);
	return resp?.data?.presigned_url;
};

export const downloadFile = (fileUrl, fileName) => {
	if (fileName) {
		fetch(fileUrl)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				return response.blob();
			})
			.then((blob) => {
				const blobUrl = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = blobUrl;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(blobUrl);
			})
			.catch((err) => {
				logError(err, {
					feature: 'file_download',
					action: 'download_blob',
				});
				toast.error('Failed to download file');
			});
	} else {
		const a = document.createElement('a');
		a.href = fileUrl;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
};

export const getFileSize = (file) => {
	const size = typeof file === 'number' ? file : file?.size;
	if (size) {
		return size < 1024 * 1024
			? (size / 1024).toFixed(1) + ' KB'
			: (size / (1024 * 1024)).toFixed(1) + ' MB';
	}
	return '.';
};
