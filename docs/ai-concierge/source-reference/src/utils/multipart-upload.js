import axios from 'axios';
import axiosClientV1 from '@/lib/axios';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk (S3 minimum for multipart)
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // 1 second

/**
 * Detect whether a presigned upload URL targets Azure Blob Storage. Azure is either
 * the native blob host OR our same-origin streaming proxy path (/blobproxy/...), which
 * is used when the storage account's public endpoint is disabled (e.g. TACO): there the
 * SAS URL is rewritten to https://<app-host>/blobproxy/... and no longer contains
 * "core.windows.net". See datamanager BlobService AZURE_BLOB_PROXY_BASE_URL.
 */
export const isAzureUploadUrl = (u) =>
	!!u && (u.includes('core.windows.net') || u.includes('/blobproxy/'));

/**
 * Headers for a single-PUT upload to a presigned URL. Azure PutBlob REQUIRES
 * x-ms-blob-type; S3 just needs Content-Type. Detection is by URL so it works whether
 * the target is the native blob host or the /blobproxy proxy. Use this from any direct
 * axios.put(presignedUrl, file) site so every upload path stays consistent.
 */
export const singlePutUploadHeaders = (url, file) =>
	isAzureUploadUrl(url)
		? { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type }
		: { 'Content-Type': file.type };

/**
 * Retry a function with exponential backoff
 */
const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === retries) throw error;
			const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
};

/**
 * Upload a single chunk to a presigned URL with retry logic
 */
const uploadChunk = async (presignedUrl, chunk, onProgress, cancelToken) => {
	return retryWithBackoff(() =>
		axios.put(presignedUrl, chunk, {
			headers: { 'Content-Type': 'application/octet-stream' },
			onUploadProgress: onProgress,
			cancelToken,
			timeout: 120000, // 2 min timeout per chunk
		}),
	);
};

/**
 * Multipart upload for S3
 *
 * Required backend endpoints:
 * 1. POST /datasources/multipart/initiate
 *    Body: { file_name, content_type, parts_count }
 *    Response: { upload_id, key }
 *
 * 2. POST /datasources/multipart/presigned-urls
 *    Body: { upload_id, key, parts_count }
 *    Response: { presigned_urls: { "1": "url", "2": "url", ... } }
 *
 * 3. POST /datasources/multipart/complete
 *    Body: { upload_id, key, parts: [{ part_number, etag }] }
 *    Response: { url }
 *
 * 4. POST /datasources/multipart/abort
 *    Body: { upload_id, key }
 */
export const multipartUpload = async ({
	file,
	onProgress,
	cancelToken,
	chunkSize = DEFAULT_CHUNK_SIZE,
}) => {
	const totalSize = file.size;
	const partsCount = Math.ceil(totalSize / chunkSize);

	// Step 1: Initiate multipart upload
	const initResponse = await axiosClientV1.post(
		'/datasources/multipart/initiate',
		{
			file_name: file.name,
			content_type: file.type,
			parts_count: partsCount,
		},
	);

	const { upload_id, key } = initResponse.data;

	try {
		// Step 2: Get presigned URLs for all parts
		const urlsResponse = await axiosClientV1.post(
			'/datasources/multipart/presigned-urls',
			{
				upload_id,
				key,
				parts_count: partsCount,
			},
		);

		const presignedUrls = urlsResponse.data.presigned_urls;

		// Step 3: Upload each chunk
		const uploadedParts = [];
		let totalLoaded = 0;

		for (let partNumber = 1; partNumber <= partsCount; partNumber++) {
			const start = (partNumber - 1) * chunkSize;
			const end = Math.min(start + chunkSize, totalSize);
			const chunk = file.slice(start, end);
			const chunkSizeActual = end - start;

			const response = await uploadChunk(
				presignedUrls[partNumber],
				chunk,
				(progressEvent) => {
					const chunkLoaded = progressEvent.loaded || 0;
					const currentTotal = totalLoaded + chunkLoaded;
					const pct = Math.round((currentTotal / totalSize) * 100);
					if (typeof onProgress === 'function') onProgress(pct);
				},
				cancelToken,
			);

			totalLoaded += chunkSizeActual;

			// S3 returns ETag in the response headers
			const etag = response.headers?.etag || response.headers?.ETag;
			uploadedParts.push({
				part_number: partNumber,
				etag: etag?.replace(/"/g, ''),
			});
		}

		// Step 4: Complete multipart upload
		const completeResponse = await axiosClientV1.post(
			'/datasources/multipart/complete',
			{
				upload_id,
				key,
				parts: uploadedParts,
			},
		);

		return {
			name: file.name,
			url: completeResponse.data.url,
		};
	} catch (error) {
		// Abort multipart upload on failure to clean up S3 resources
		try {
			await axiosClientV1.post('/datasources/multipart/abort', {
				upload_id,
				key,
			});
		} catch {
			// Ignore abort errors
		}
		throw error;
	}
};

/**
 * Azure Blob block upload
 *
 * Required backend endpoints:
 * 1. POST /datasources/block-upload/presigned-url
 *    Body: { file_name }
 *    Response: { base_url, sas_token, url }
 *
 * Azure Block Blob upload works by:
 * - PUT each block with ?comp=block&blockid=<base64_id> appended to the URL
 * - PUT block list with ?comp=blocklist to commit all blocks
 */
export const azureBlockUpload = async ({
	file,
	onProgress,
	cancelToken,
	chunkSize = DEFAULT_CHUNK_SIZE,
}) => {
	const totalSize = file.size;
	const partsCount = Math.ceil(totalSize / chunkSize);

	// Step 1: Get base presigned URL for Azure blob
	const urlResponse = await axiosClientV1.post(
		'/datasources/block-upload/presigned-url',
		{ file_name: file.name },
	);

	const { base_url, sas_token, url: fileUrl } = urlResponse.data;

	const blockIds = [];
	let totalLoaded = 0;

	// Step 2: Upload each block
	for (let i = 0; i < partsCount; i++) {
		const start = i * chunkSize;
		const end = Math.min(start + chunkSize, totalSize);
		const chunk = file.slice(start, end);
		const chunkSizeActual = end - start;

		// Azure requires base64-encoded block IDs of equal length
		const blockId = btoa(String(i).padStart(6, '0'));
		blockIds.push(blockId);

		const blockUrl = `${base_url}?comp=block&blockid=${encodeURIComponent(blockId)}&${sas_token}`;

		await retryWithBackoff(() =>
			axios.put(blockUrl, chunk, {
				headers: {
					'x-ms-blob-type': 'BlockBlob',
					'Content-Type': 'application/octet-stream',
				},
				onUploadProgress: (progressEvent) => {
					const chunkLoaded = progressEvent.loaded || 0;
					const currentTotal = totalLoaded + chunkLoaded;
					const pct = Math.round((currentTotal / totalSize) * 100);
					if (typeof onProgress === 'function') onProgress(pct);
				},
				cancelToken,
				timeout: 120000,
			}),
		);

		totalLoaded += chunkSizeActual;
	}

	// Step 3: Commit block list
	const blockListXml = `<?xml version="1.0" encoding="utf-8"?>
<BlockList>
${blockIds.map((id) => `  <Latest>${id}</Latest>`).join('\n')}
</BlockList>`;

	const commitUrl = `${base_url}?comp=blocklist&${sas_token}`;

	await axios.put(commitUrl, blockListXml, {
		headers: {
			'Content-Type': 'application/xml',
			'x-ms-blob-content-type': file.type,
		},
		cancelToken,
	});

	return {
		name: file.name,
		url: fileUrl,
	};
};

/**
 * Smart upload: uses multipart for large files, single PUT for small files.
 * Includes retry logic for single PUT uploads as well.
 */
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB

export const uploadWithResilience = async ({
	file,
	presignedUrl,
	url,
	onProgress,
	cancelToken,
	cloudProvider, // 's3' | 'azure' | auto-detect from presignedUrl
}) => {
	const provider =
		cloudProvider ||
		(presignedUrl?.includes('amazonaws.com')
			? 's3'
			: isAzureUploadUrl(presignedUrl)
				? 'azure'
				: 's3');

	// For large files, use multipart/block upload
	if (file.size > MULTIPART_THRESHOLD) {
		if (provider === 'azure') {
			return azureBlockUpload({ file, onProgress, cancelToken });
		}
		return multipartUpload({ file, onProgress, cancelToken });
	}

	// For small files, use single PUT with retry
	const headers = {};
	if (provider === 's3') {
		headers['Content-Type'] = file.type;
	} else if (provider === 'azure') {
		headers['x-ms-blob-type'] = 'BlockBlob';
		headers['Content-Type'] = file.type;
	}

	await retryWithBackoff(() =>
		axios.put(presignedUrl, file, {
			headers,
			onUploadProgress: (progressEvent) => {
				const total = progressEvent.total ?? 0;
				const loaded = progressEvent.loaded ?? 0;
				const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
				if (typeof onProgress === 'function') onProgress(pct);
			},
			cancelToken,
			timeout: 300000, // 5 min timeout for single upload
		}),
	);

	return { name: file.name, url };
};
