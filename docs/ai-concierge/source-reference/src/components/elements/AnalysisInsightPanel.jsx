import React, { useState, useEffect } from 'react';
import {
	Lightbulb,
	Target,
	ShieldCheck,
	FileText,
	Calculator,
	CalendarX,
	Bot,
	BarChart3,
	ImageIcon,
	Mic,
	TableProperties,
	HeartPulse,
	QrCode,
	Receipt,
	Layers,
	CheckCircle2,
	Scan,
} from 'lucide-react';

/**
 * AnalysisInsightPanel
 * --------------------
 * Shown below the active loader on every AI Concierge feature while a
 * long-running job is processing. Fills the otherwise-empty space under
 * the gradient-border loader card with two useful panels:
 *
 *   1. "What we're checking" — feature-specific list of the forensic
 *      modules / compliance checks / analysis steps the AI is running.
 *      Gives the user a live mental model of the work happening behind
 *      the scenes.
 *
 *   2. "Did you know?" — a rotating carousel of pro-tips or fun facts
 *      about the feature. Tips auto-rotate every 6 seconds and the user
 *      can click a pagination dot to jump.
 *
 * All content is driven by the `feature` prop which selects a preset
 * from INSIGHT_PRESETS below. This lets every ProgressSection across
 * the app use a single <AnalysisInsightPanel feature="..." /> without
 * needing to hand-maintain its own copy of the content.
 *
 * Presets are defined for each AI Concierge feature (document-forensics,
 * eda-builder, image-analytics, racm-generator, speech-auditor,
 * medical-reader, table-extractor).
 */

const INSIGHT_PRESETS = {
	'document-forensics': {
		checks: [
			{
				icon: Bot,
				label: 'AI Generation',
				description:
					'Detecting images from ChatGPT, DALL-E, Gemini, Stable Diffusion',
			},
			{
				icon: Layers,
				label: 'Copy-Move & Splicing',
				description:
					'Finding pixel regions that were copy-pasted or spliced in',
			},
			{
				icon: Calculator,
				label: 'Math & Tax Rules',
				description:
					'Validating subtotals, GST rates, and intra/inter-state tax',
			},
			{
				icon: Receipt,
				label: 'GSTIN & Identifiers',
				description:
					'Checking GSTIN format, state codes, and buyer/seller roles',
			},
			{
				icon: QrCode,
				label: 'QR Code Cross-Check',
				description:
					'Decoding QR codes and verifying data matches printed text',
			},
			{
				icon: CalendarX,
				label: 'Date Role Validation',
				description:
					'Smart future-date checks (DL/insurance expiry expected)',
			},
		],
		tips: [
			'Every JPEG has a hidden compression fingerprint (the Q-table). If a document\u2019s Q-table matches a known editor like MS Paint, we can tell the file was edited \u2014 even if the forger saved it back as a perfect-looking JPEG.',
			'A driving licence with an expiry date in 2028 is NOT suspicious. Our role-aware date checker reads the label near each date (Issue Date vs. Valid Until) before deciding whether to flag it.',
			'Copy-Move detection uses ORB keypoints and DBSCAN clustering. If the tool finds 4+ clusters of duplicate regions, the document was almost certainly digitally retouched.',
			'Invoice-generator websites like Canva, Zoho, and invoice-generator.com embed their brand in the PDF \u2019s /Producer or /Creator metadata. Our template detector reads those fields to flag software-generated invoices.',
			'Intra-state sales should use CGST+SGST; inter-state sales must use IGST. If the seller is in Maharashtra and buyer is in Karnataka but the bill charges CGST+SGST, it\u2019s a wrong-tax-type red flag.',
		],
	},
	'eda-builder': {
		checks: [
			{
				icon: BarChart3,
				label: 'Statistical Profiling',
				description:
					'Computing distributions, outliers, and data quality metrics',
			},
			{
				icon: Target,
				label: 'Anomaly Detection',
				description:
					'Identifying rows and columns that deviate from expected patterns',
			},
			{
				icon: FileText,
				label: 'Schema Inference',
				description:
					'Detecting types, relationships, and semantic meaning of columns',
			},
			{
				icon: Lightbulb,
				label: 'Business Insights',
				description: 'Generating natural-language summaries of key findings',
			},
		],
		tips: [
			'EDA Builder combines deterministic statistical checks with LLM-powered reasoning. The numbers come from code, the narrative comes from the AI \u2014 so every insight is both accurate and readable.',
			'Anomaly detection uses z-score, IQR, and LOF methods in parallel. If multiple methods flag the same row, it\u2019s almost certainly a genuine outlier worth investigating.',
			'The tool detects missing-value patterns automatically. "Sparse trailing columns" often indicate CSV export issues, not real data gaps.',
			'Process flows and mermaid diagrams are generated from the LLM\u2019s understanding of your data \u2014 not hand-coded. That\u2019s why every report has its own unique flow diagram.',
			'Benford\u2019s Law catches fraudulent numeric data: genuine financial numbers follow a specific leading-digit distribution. Manual tampering breaks it.',
		],
	},
	'image-analytics': {
		checks: [
			{
				icon: ImageIcon,
				label: 'Visual Content',
				description:
					'Understanding subjects, setting, and scene composition',
			},
			{
				icon: Target,
				label: 'Scope Grounding',
				description: 'Filtering findings to match your stated audit focus',
			},
			{
				icon: CheckCircle2,
				label: 'KPI Compliance',
				description:
					'Evaluating each image against extracted compliance rules',
			},
			{
				icon: Layers,
				label: 'Cross-Image Patterns',
				description:
					'Detecting changes over time and side-by-side differences',
			},
		],
		tips: [
			'Our Compare mode auto-detects whether your images are a time-series (progress photos) or side-by-side variants, and structures the output differently for each. Name your files sequentially to hint at timeline mode.',
			'Audit mode respects your stated scope. If you say "audit kitchen hygiene", we won\u2019t report missing hardhats \u2014 even if the guideline document mentions them.',
			'For batches over 10 images, we process in groups of 10 and consolidate the findings with a second pass. This keeps Gemini\u2019s output consistent without hitting token limits.',
			'The Chat mode never fabricates details. If you ask about something not visible in the image, it will tell you so explicitly instead of guessing.',
			'Image Analytics uses Gemini at temperature 0.2 for deterministic output. The same image and question always produce the same answer \u2014 critical for audit reproducibility.',
		],
	},
	'racm-generator': {
		checks: [
			{
				icon: FileText,
				label: 'SOP Parsing',
				description:
					'Extracting controls, risks, and procedures from source docs',
			},
			{
				icon: Target,
				label: 'Risk Mapping',
				description: 'Associating each control with the risks it mitigates',
			},
			{
				icon: CheckCircle2,
				label: 'Frequency Standardization',
				description: 'Normalizing control frequency to 6 standard values',
			},
			{
				icon: Layers,
				label: 'Matrix Generation',
				description: 'Assembling the final Risk Assessment Control Matrix',
			},
		],
		tips: [
			'RACM frequencies are normalized to six standard values: Continuous, Daily, Weekly, Monthly, Quarterly, and Annual. Source SOPs often use non-standard phrasing \u2014 we map them automatically.',
			'Every RACM row is traced back to a specific page and paragraph in the source SOP. You can audit the provenance of any control by clicking through to the source.',
			'The AI consolidates duplicate controls across multiple SOP sections. If the same procedure appears in chapters 3, 5, and 8, you get one consolidated RACM entry \u2014 not three.',
			'Gap analysis compares your generated RACM against a library of standard control frameworks (ISO 27001, SOC 2) to suggest missing controls.',
		],
	},
	'speech-auditor': {
		checks: [
			{
				icon: Mic,
				label: 'Transcription',
				description: 'Converting speech to text with speaker diarization',
			},
			{
				icon: Target,
				label: 'Sentiment Analysis',
				description: 'Tracking emotional tone across the call timeline',
			},
			{
				icon: CheckCircle2,
				label: 'Compliance Checks',
				description: 'Verifying disclosure statements and script adherence',
			},
			{
				icon: FileText,
				label: 'Call Summary',
				description: 'Generating executive summary and action items',
			},
		],
		tips: [
			'Speech Auditor identifies each speaker separately using diarization. You get a timeline showing when the agent was speaking vs. the customer \u2014 critical for compliance review.',
			'Sentiment is tracked in 10-second windows, not just overall. A call that starts positive and ends frustrated tells you something a single sentiment score would hide.',
			'Compliance checks look for required disclosure phrases ("This call is recorded", "My name is X from Y"). Missing disclosures are flagged with exact timestamp evidence.',
		],
	},
	'medical-reader': {
		checks: [
			{
				icon: HeartPulse,
				label: 'Clinical Parsing',
				description: 'Extracting diagnoses, procedures, and medications',
			},
			{
				icon: Target,
				label: 'Fraud Indicators',
				description:
					'Detecting inconsistencies and suspicious billing patterns',
			},
			{
				icon: Calculator,
				label: 'Billing Validation',
				description: 'Cross-checking CPT codes and claimed amounts',
			},
			{
				icon: FileText,
				label: 'Case Summary',
				description: 'Generating adjuster-ready case briefs',
			},
		],
		tips: [
			'Medical Report Reader uses chunked processing for large case files. A 200-page report is split into semantic chunks, processed in parallel, then stitched back together.',
			'Every finding is linked to a specific source paragraph. Adjusters can click any claim to see the exact medical record line that supports it.',
			'The tool distinguishes between diagnoses, procedures, and differential diagnoses using NLP tagging \u2014 so "possible pneumonia" is not treated as a confirmed diagnosis.',
		],
	},
	'table-extractor': {
		checks: [
			{
				icon: TableProperties,
				label: 'Table Detection',
				description: 'Identifying table boundaries on each PDF page',
			},
			{
				icon: Target,
				label: 'Cell Parsing',
				description:
					'Extracting row/column structure with merged-cell handling',
			},
			{
				icon: Calculator,
				label: 'Type Inference',
				description:
					'Detecting numeric, date, and currency columns automatically',
			},
			{
				icon: FileText,
				label: 'Clean Export',
				description: 'Producing normalized CSV/Excel output ready for audit',
			},
		],
		tips: [
			'Table Extractor preserves merged-cell structure. Complex invoice tables with vertically-merged "Description" cells are reconstructed accurately in the output.',
			'Currency symbols and thousand separators are normalized automatically. \u20B91,234.56 and Rs. 1234.56 both become 1234.56 in the structured output.',
			'Multi-page tables are stitched back together when they span pages. The tool detects continuation patterns and reconstructs the full logical table.',
		],
	},
};

const AnalysisInsightPanel = ({ feature = 'document-forensics' }) => {
	const preset = INSIGHT_PRESETS[feature] || INSIGHT_PRESETS['document-forensics'];
	const [tipIdx, setTipIdx] = useState(0);
	// Two-phase tip swap: fade the current tip to 0, swap the text, then
	// fade the new tip back to 1. This avoids the layout jump from a
	// key-based remount (which re-ran findingFadeIn's translateY and
	// looked jittery when tip lengths differed). Smooth opacity-only fade.
	const [displayTipIdx, setDisplayTipIdx] = useState(0);
	const [tipVisible, setTipVisible] = useState(true);

	// Auto-rotate tips every 6 seconds. Clearing the interval on unmount
	// prevents a stale tipIdx update after the loader disappears.
	useEffect(() => {
		if (!preset.tips || preset.tips.length <= 1) return;
		const interval = setInterval(() => {
			setTipIdx((i) => (i + 1) % preset.tips.length);
		}, 6000);
		return () => clearInterval(interval);
	}, [preset.tips]);

	// When the source tipIdx changes, run the fade-out → swap → fade-in
	// sequence. The 300ms fade-out matches the CSS transition duration
	// on the paragraph below.
	useEffect(() => {
		if (tipIdx === displayTipIdx) return;
		setTipVisible(false);
		const timeout = setTimeout(() => {
			setDisplayTipIdx(tipIdx);
			setTipVisible(true);
		}, 300);
		return () => clearTimeout(timeout);
	}, [tipIdx, displayTipIdx]);

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{/* Left: What we're checking — feature-specific module list.
			    Border matches the right panel (purple-100) so both cards
			    read as siblings rather than the left one looking borderless. */}
			<div className="rounded-xl bg-white/60 backdrop-blur-sm border border-purple-100 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
				<div className="flex items-center gap-2 mb-4">
					<div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
						<Scan className="w-4 h-4 text-purple-600" />
					</div>
					<h3 className="text-xs font-bold uppercase tracking-widest text-primary60">
						What we&apos;re checking
					</h3>
				</div>
				<ul className="space-y-3">
					{preset.checks.map((check) => {
						const Icon = check.icon;
						return (
							<li
								key={check.label}
								className="flex items-start gap-2.5"
							>
								<div className="w-6 h-6 rounded-md bg-white border border-purple-100 flex items-center justify-center shrink-0 mt-0.5">
									<Icon className="w-3.5 h-3.5 text-purple-500" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium text-primary80">
										{check.label}
									</p>
									<p className="text-xs text-primary40 leading-snug">
										{check.description}
									</p>
								</div>
							</li>
						);
					})}
				</ul>
			</div>

			{/* Right: Did you know? — rotating tips carousel with smooth
			    opacity-only cross-fade (no translateY, no remount) to avoid
			    the layout jitter from different tip lengths. */}
			<div className="rounded-xl bg-gradient-to-br from-purple-50/80 via-white to-cyan-50/60 border border-purple-100 p-5 flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
				<div className="flex items-center gap-2 mb-4">
					<div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
						<Lightbulb className="w-4 h-4 text-amber-500" />
					</div>
					<h3 className="text-xs font-bold uppercase tracking-widest text-primary60">
						Did you know?
					</h3>
				</div>
				<p
					className="flex-1 text-sm text-primary80 leading-relaxed transition-opacity duration-300 ease-out"
					style={{ opacity: tipVisible ? 1 : 0 }}
				>
					{preset.tips[displayTipIdx] || ''}
				</p>
				{preset.tips.length > 1 && (
					<div className="flex gap-1.5 mt-4">
						{preset.tips.map((_, i) => (
							<button
								key={i}
								type="button"
								onClick={() => setTipIdx(i)}
								className={`h-1.5 rounded-full transition-all ${
									i === tipIdx
										? 'w-6 bg-purple-500'
										: 'w-1.5 bg-purple-200 hover:bg-purple-300'
								}`}
								aria-label={`Go to tip ${i + 1}`}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default AnalysisInsightPanel;
