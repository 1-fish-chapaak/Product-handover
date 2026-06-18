import { useCallback } from 'react';
import { exportToCsv, exportToJson, exportToXlsx } from '../utils/racm-export-utils';

export const useRacmExport = (entries, fileName) => {
	const baseName = fileName
		? fileName.replace(/\.[^/.]+$/, '') + '_RACM'
		: 'RACM_Export';

	const handleExportCsv = useCallback(() => {
		exportToCsv(entries, baseName);
	}, [entries, baseName]);

	const handleExportJson = useCallback(() => {
		exportToJson(entries, baseName);
	}, [entries, baseName]);

	const handleExportXlsx = useCallback(() => {
		exportToXlsx(entries, baseName);
	}, [entries, baseName]);

	return {
		handleExportCsv,
		handleExportJson,
		handleExportXlsx,
	};
};
