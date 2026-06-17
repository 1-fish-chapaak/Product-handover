import { RACM_FIELDS } from './racm-field-definitions';

const downloadBlob = (blob, filename) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
};

export const exportToCsv = (entries, baseName) => {
	if (!entries?.length) return;

	const headers = RACM_FIELDS.map((f) => f.label);
	const keys = RACM_FIELDS.map((f) => f.key);

	const escapeCsv = (val) => {
		if (val == null) return '';
		const str = String(val);
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};

	const rows = entries.map((entry) =>
		keys.map((key) => escapeCsv(entry[key])).join(','),
	);

	const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	downloadBlob(blob, `${baseName}.csv`);
};

export const exportToJson = (entries, baseName) => {
	if (!entries?.length) return;

	const json = JSON.stringify(entries, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	downloadBlob(blob, `${baseName}.json`);
};

export const exportToXlsx = async (entries, baseName) => {
	if (!entries?.length) return;

	const XLSX = await import('xlsx');

	const headers = RACM_FIELDS.map((f) => f.label);
	const keys = RACM_FIELDS.map((f) => f.key);

	// Sheet 1: Detailed RACM — all entries with all fields
	const detailedData = entries.map((entry) =>
		keys.reduce((row, key, i) => {
			row[headers[i]] = entry[key] ?? '';
			return row;
		}, {}),
	);
	const detailedSheet = XLSX.utils.json_to_sheet(detailedData);

	// Auto-size columns
	detailedSheet['!cols'] = headers.map((h) => ({
		wch: Math.max(h.length, 20),
	}));

	// Sheet 2: Summary — process area breakdown + stats
	const processData = {};
	entries.forEach((e) => {
		const area = e.processArea || 'Unspecified';
		if (!processData[area]) {
			processData[area] = { risks: 0, controls: new Set(), topRisk: null };
		}
		processData[area].risks += 1;
		if (e.controlId) processData[area].controls.add(e.controlId);
		const rating = e.riskRating;
		if (rating) {
			const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
			const current = order[processData[area].topRisk] || 0;
			if ((order[rating] || 0) > current) {
				processData[area].topRisk = rating;
			}
		}
	});

	const summaryData = Object.entries(processData).map(([area, data]) => ({
		'Process Area': area,
		Risks: data.risks,
		Controls: data.controls.size,
		'Top Risk': data.topRisk || '-',
	}));

	const summarySheet = XLSX.utils.json_to_sheet(summaryData);
	summarySheet['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed RACM');
	XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

	const date = new Date().toISOString().slice(0, 10);
	XLSX.writeFile(wb, `RACM_${baseName}_${date}.xlsx`);
};
