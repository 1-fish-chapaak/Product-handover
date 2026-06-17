import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	Table,
	TableRow,
	TableCell,
	WidthType,
	HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';

export const exportToPDF = (reportData, transcriptData) => {
	const doc = new jsPDF();

	doc.setFontSize(20);
	doc.setTextColor(41, 128, 185);
	doc.text('AUDIT REPORT', 105, 20, { align: 'center' });
	doc.setFontSize(14);
	doc.text('Booking Verification Call - Controls Assessment', 105, 28, {
		align: 'center',
	});

	autoTable(doc, {
		startY: 40,
		head: [['Information', 'Value']],
		body: (reportData.engagement_detail || []).map((item) => [
			item.information || '',
			item.value || '',
		]),
		theme: 'grid',
		headStyles: { fillColor: [41, 128, 185] },
	});

	doc.setFontSize(16);
	doc.setTextColor(0, 0, 0);
	doc.text('1. Executive Summary', 14, doc.lastAutoTable.finalY + 15);
	doc.setFontSize(10);
	const splitSummary = doc.splitTextToSize(
		reportData.executive_summary || '',
		180,
	);
	doc.text(splitSummary, 14, doc.lastAutoTable.finalY + 22);

	autoTable(doc, {
		startY: doc.lastAutoTable.finalY + 25 + splitSummary.length * 5,
		head: [['Control Area', 'Status', 'Risk', 'Auditor Remark']],
		body: (reportData.controls_summary || []).map((item) => [
			item.control_area || '',
			item.status || '',
			item.risk || '',
			item.remark || '',
		]),
		theme: 'grid',
		headStyles: { fillColor: [41, 128, 185] },
		didParseCell: function (data) {
			if (data.section === 'body' && data.column.index === 1) {
				if (data.cell.raw === 'Pass')
					data.cell.styles.fillColor = [46, 204, 113];
				else if (data.cell.raw === 'Fail')
					data.cell.styles.fillColor = [231, 76, 60];
				else if (data.cell.raw === 'Partial')
					data.cell.styles.fillColor = [243, 156, 18];
				else if (data.cell.raw === 'Flagged')
					data.cell.styles.fillColor = [155, 89, 182];
				data.cell.styles.textColor = [255, 255, 255];
			}
		},
	});

	doc.addPage();
	doc.setFontSize(16);
	doc.text('2. Detailed Audit Findings', 14, 20);

	let currentY = 30;
	(reportData.detailed_findings || []).forEach((finding) => {
		if (currentY > 250) {
			doc.addPage();
			currentY = 20;
		}

		doc.setFontSize(12);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(41, 128, 185);
		doc.text(
			`${finding.id} - ${finding.title} [${finding.risk} Risk | ${finding.status}]`,
			14,
			currentY,
		);
		currentY += 8;

		autoTable(doc, {
			startY: currentY,
			body: [
				['Observation', finding.observation || ''],
				['Audit Criteria', finding.criteria || ''],
				['Risk / Implication', finding.implication || ''],
				['Recommendation', finding.recommendation || ''],
			],
			theme: 'grid',
			columnStyles: {
				0: {
					cellWidth: 40,
					fontStyle: 'bold',
					fillColor: [240, 248, 255],
				},
				1: { cellWidth: 140 },
			},
		});

		currentY = doc.lastAutoTable.finalY + 15;
	});

	if (currentY > 220) {
		doc.addPage();
		currentY = 20;
	}
	doc.setFontSize(16);
	doc.setTextColor(0, 0, 0);
	doc.text('3. Priority Action Plan', 14, currentY);

	autoTable(doc, {
		startY: currentY + 8,
		head: [['#', 'Action Item', 'Responsible', 'Priority', 'Timeline']],
		body: (reportData.priority_action_plan || []).map((item) => [
			item.id || '',
			item.action_item || '',
			item.responsible || '',
			item.priority || '',
			item.timeline || '',
		]),
		theme: 'grid',
		headStyles: { fillColor: [41, 128, 185] },
	});

	currentY = doc.lastAutoTable.finalY + 15;
	if (currentY > 250) {
		doc.addPage();
		currentY = 20;
	}
	doc.setFontSize(16);
	doc.text("4. Auditor's Conclusion", 14, currentY);
	doc.setFontSize(10);
	const splitConclusion = doc.splitTextToSize(reportData.conclusion || '', 180);
	doc.text(splitConclusion, 14, currentY + 8);

	doc.addPage();
	doc.setFontSize(16);
	doc.text('Appendix: Call Transcript', 14, 20);

	autoTable(doc, {
		startY: 30,
		head: [['Time', 'Speaker', 'Text', 'Sentiment']],
		body: (transcriptData.segments || []).map((seg) => [
			seg.timestamp || '',
			seg.speaker || '',
			seg.text || '',
			seg.sentiment_label || '',
		]),
		theme: 'grid',
		headStyles: { fillColor: [100, 100, 100] },
	});

	doc.save('Audit_Report.pdf');
};

// Content width in DXA (twentieths of a point). Letter = 12240 DXA wide, minus 1" margins each side = 9360
const PAGE_W = 9360;

// Helper: convert percentage to DXA
const pct = (p) => Math.round((p / 100) * PAGE_W);

// Helper: create a table cell with DXA width
const cell = (text, widthPct) =>
	new TableCell({
		children: [
			new Paragraph({
				children: [new TextRun({ text: text || '', size: 20 })],
			}),
		],
		width: { size: pct(widthPct), type: WidthType.DXA },
	});

// Helper: bold header cell
const headerCell = (text, widthPct) =>
	new TableCell({
		children: [
			new Paragraph({
				children: [new TextRun({ text, bold: true, size: 20 })],
			}),
		],
		width: { size: pct(widthPct), type: WidthType.DXA },
	});

export const exportToDocx = async (reportData, transcriptData) => {
	const children = [];

	// Title
	children.push(
		new Paragraph({
			children: [
				new TextRun({
					text: 'AUDIT REPORT',
					bold: true,
					size: 36,
					color: '2980B9',
				}),
			],
			alignment: 'center',
			spacing: { after: 100 },
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: 'Booking Verification Call - Controls Assessment',
					size: 24,
					color: '7F8C8D',
				}),
			],
			alignment: 'center',
			spacing: { after: 300 },
		}),
	);

	// Engagement Detail
	if (reportData.engagement_detail?.length) {
		children.push(
			new Table({
				width: { size: PAGE_W, type: WidthType.DXA },
				columnWidths: [pct(40), pct(60)],
				rows: [
					new TableRow({
						children: [
							headerCell('Information', 40),
							headerCell('Value', 60),
						],
					}),
					...reportData.engagement_detail.map(
						(item) =>
							new TableRow({
								children: [
									cell(item.information, 40),
									cell(item.value, 60),
								],
							}),
					),
				],
			}),
			new Paragraph({ text: '', spacing: { after: 200 } }),
		);
	}

	// Executive Summary
	children.push(
		new Paragraph({
			text: '1. Executive Summary',
			heading: HeadingLevel.HEADING_2,
			spacing: { before: 200 },
		}),
		new Paragraph({
			text: reportData.executive_summary || '',
			spacing: { after: 200 },
		}),
	);

	// Controls Summary
	if (reportData.controls_summary?.length) {
		children.push(
			new Paragraph({
				text: '2. Controls Summary Scorecard',
				heading: HeadingLevel.HEADING_2,
			}),
			new Table({
				width: { size: PAGE_W, type: WidthType.DXA },
				columnWidths: [pct(30), pct(15), pct(15), pct(40)],
				rows: [
					new TableRow({
						children: [
							headerCell('Control Area', 30),
							headerCell('Status', 15),
							headerCell('Risk', 15),
							headerCell('Auditor Remark', 40),
						],
					}),
					...reportData.controls_summary.map(
						(item) =>
							new TableRow({
								children: [
									cell(item.control_area, 30),
									cell(item.status, 15),
									cell(item.risk, 15),
									cell(item.remark, 40),
								],
							}),
					),
				],
			}),
			new Paragraph({ text: '', spacing: { after: 200 } }),
		);
	}

	// Detailed Findings
	if (reportData.detailed_findings?.length) {
		children.push(
			new Paragraph({
				text: '3. Detailed Audit Findings',
				heading: HeadingLevel.HEADING_2,
			}),
		);
		reportData.detailed_findings.forEach((finding) => {
			children.push(
				new Paragraph({
					text: `${finding.id} - ${finding.title} [${finding.risk} Risk | ${finding.status}]`,
					heading: HeadingLevel.HEADING_3,
				}),
				new Table({
					width: { size: PAGE_W, type: WidthType.DXA },
					columnWidths: [pct(25), pct(75)],
					rows: [
						['Observation', finding.observation],
						['Audit Criteria', finding.criteria],
						['Risk / Implication', finding.implication],
						['Recommendation', finding.recommendation],
					].map(
						([label, value]) =>
							new TableRow({
								children: [headerCell(label, 25), cell(value, 75)],
							}),
					),
				}),
				new Paragraph({ text: '', spacing: { after: 150 } }),
			);
		});
	}

	// Priority Action Plan
	if (reportData.priority_action_plan?.length) {
		children.push(
			new Paragraph({
				text: '4. Priority Action Plan',
				heading: HeadingLevel.HEADING_2,
			}),
			new Table({
				width: { size: PAGE_W, type: WidthType.DXA },
				columnWidths: [pct(5), pct(35), pct(20), pct(15), pct(25)],
				rows: [
					new TableRow({
						children: [
							headerCell('#', 5),
							headerCell('Action Item', 35),
							headerCell('Responsible', 20),
							headerCell('Priority', 15),
							headerCell('Timeline', 25),
						],
					}),
					...reportData.priority_action_plan.map(
						(item) =>
							new TableRow({
								children: [
									cell(item.id?.toString(), 5),
									cell(item.action_item, 35),
									cell(item.responsible, 20),
									cell(item.priority, 15),
									cell(item.timeline, 25),
								],
							}),
					),
				],
			}),
			new Paragraph({ text: '', spacing: { after: 200 } }),
		);
	}

	// Conclusion
	children.push(
		new Paragraph({
			text: "5. Auditor's Conclusion",
			heading: HeadingLevel.HEADING_2,
		}),
		new Paragraph({
			text: reportData.conclusion || '',
			spacing: { after: 300 },
		}),
	);

	// Transcript Appendix
	if (transcriptData.segments?.length) {
		children.push(
			new Paragraph({
				text: 'Appendix: Call Transcript',
				heading: HeadingLevel.HEADING_2,
			}),
			new Table({
				width: { size: PAGE_W, type: WidthType.DXA },
				columnWidths: [pct(10), pct(15), pct(60), pct(15)],
				rows: [
					new TableRow({
						children: [
							headerCell('Time', 10),
							headerCell('Speaker', 15),
							headerCell('Text', 60),
							headerCell('Sentiment', 15),
						],
					}),
					...transcriptData.segments.map(
						(seg) =>
							new TableRow({
								children: [
									cell(seg.timestamp, 10),
									cell(seg.speaker, 15),
									cell(seg.text, 60),
									cell(seg.sentiment_label, 15),
								],
							}),
					),
				],
			}),
		);
	}

	const doc = new Document({
		sections: [{ properties: {}, children }],
	});

	const blob = await Packer.toBlob(doc);
	saveAs(blob, 'Audit_Report.docx');
};
