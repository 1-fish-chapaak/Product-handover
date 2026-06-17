import RiskBadge from './RiskBadge';
import ScoreDonut from './ScoreDonut';
import ModuleCard from './ModuleCard';
import EvidenceChainTable from './EvidenceChainTable';
import { FORENSIC_MODULE_META } from '../../constants/forensics.constants';
import {
	Shield,
	FileText,
	Clock,
	AlertTriangle,
	Calculator,
	CalendarX,
	Bot,
	FileWarning,
	Layers,
	Receipt,
	QrCode,
} from 'lucide-react';

const formatElapsed = (createdAt, completedAt) => {
	if (!createdAt || !completedAt) return null;
	const parseTs = (ts) => new Date(ts);
	const seconds = Math.floor((parseTs(completedAt) - parseTs(createdAt)) / 1000);
	if (seconds < 0) return null;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins === 0) return `${secs}s`;
	return `${mins}m ${secs}s`;
};

const ACTION_CONFIG = {
	ACCEPT: {
		color: 'text-emerald-700',
		bgColor: 'bg-emerald-50',
		label: 'Accept',
	},
	ACCEPT_WITH_NOTE: {
		color: 'text-blue-700',
		bgColor: 'bg-blue-50',
		label: 'Accept with Note',
	},
	REVIEW: {
		color: 'text-amber-700',
		bgColor: 'bg-amber-50',
		label: 'Review Required',
	},
	ESCALATE: {
		color: 'text-orange-700',
		bgColor: 'bg-orange-50',
		label: 'Escalate',
	},
	REJECT: { color: 'text-red-700', bgColor: 'bg-red-50', label: 'Reject' },
};

// Modules grouped by analysis category
const CONTENT_MODULES = new Set([
	'content_validation',
	'content_verifier',
	'gstin_verifier',
	'qr_scanner',
]);

/**
 * Extract human-readable key findings from module data.
 * Returns structured finding objects with icon, title, and description.
 */
const extractKeyFindings = (modules) => {
	const findings = [];

	// ── Content validation: amount / date / generic content issues ──
	const cv = modules?.content_validation;
	if (cv && cv.score < 70) {
		const flags = cv.flags || [];
		const details = cv.details || '';
		if (
			flags.includes('Amount-Mismatch') ||
			details.toLowerCase().includes('sum')
		) {
			findings.push({
				icon: Calculator,
				title: 'Amount Mismatch',
				description:
					details || 'Line items do not add up to the stated total',
				severity: 'CRITICAL',
			});
		}
		if (
			flags.includes('Future-Date') ||
			details.toLowerCase().includes('future')
		) {
			findings.push({
				icon: CalendarX,
				title: 'Date Issue',
				description: flags.includes('Future-Date')
					? 'Document contains a future date'
					: details,
				severity: 'CRITICAL',
			});
		}
		if (findings.length === 0 && (flags.length > 0 || details)) {
			findings.push({
				icon: FileWarning,
				title: 'Content Issue',
				description: flags.join('; ') || details,
				severity: cv.score < 30 ? 'CRITICAL' : 'HIGH',
			});
		}
	}

	// ── TrueSight AI-generation detection ──
	const ts = modules?.truesight_analysis;
	if (ts && ts.score < 30) {
		const rawProb = ts.probability || 0;
		// probability may be 0-1 decimal or 0-100 percentage
		const probPct =
			rawProb <= 1 ? Math.round(rawProb * 100) : Math.round(rawProb);
		if (probPct >= 50) {
			findings.push({
				icon: Bot,
				title: 'AI Generation Detected',
				description: `TrueSight: ${probPct}% probability of synthetic generation`,
				severity: 'CRITICAL',
			});
		}
	}

	// ── Template-generator detection ──
	const td = modules?.template_detection;
	if (td && td.likely_template) {
		findings.push({
			icon: Layers,
			title: 'Generated Template',
			description:
				td.details ||
				`This document looks like a software-generated template${
					td.matched_service ? ` (${td.matched_service})` : ''
				}`,
			severity: 'HIGH',
		});
	}

	// ── Wrong tax type (intra vs inter-state CGST/SGST/IGST) ──
	const gv = modules?.gstin_verifier;
	if (gv?.flags?.length) {
		const taxFlag = gv.flags.find(
			(f) =>
				typeof f === 'string' && f.toLowerCase().includes('wrong tax type'),
		);
		if (taxFlag) {
			findings.push({
				icon: Receipt,
				title: 'Wrong Tax Type',
				description: taxFlag,
				severity: 'CRITICAL',
			});
		}
		const gstWithoutFlag = gv.flags.find(
			(f) =>
				typeof f === 'string' && f.toLowerCase().includes('no valid gstin'),
		);
		if (gstWithoutFlag) {
			findings.push({
				icon: Receipt,
				title: 'GST Without GSTIN',
				description: gstWithoutFlag,
				severity: 'CRITICAL',
			});
		}
	}

	// ── QR mismatch (elevated to Key Findings since QR is now critical) ──
	const qr = modules?.qr_scanner;
	if (qr && qr.score < 70) {
		const qrFlag =
			(qr.flags || []).find(
				(f) =>
					typeof f === 'string' &&
					(f.toLowerCase().includes('mismatch') ||
						f.toLowerCase().includes('qr')),
			) || qr.details;
		if (qrFlag) {
			findings.push({
				icon: QrCode,
				title: 'QR Code Mismatch',
				description: qrFlag,
				severity: qr.score < 30 ? 'CRITICAL' : 'HIGH',
			});
		}
	}

	// Deduplicate by title+description so repeated date-role flags don't
	// show twice (e.g. "Valid Until" + "Non Transferable Upto" pointing to
	// the same date get collapsed).
	const seen = new Set();
	return findings.filter((f) => {
		const key = `${f.title}::${f.description}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const SEVERITY_COLORS = {
	CRITICAL: 'border-red-200 bg-red-50',
	HIGH: 'border-orange-200 bg-orange-50',
};

const ForensicReport = ({ result }) => {
	const forensicResult = result?.result;
	if (!forensicResult) return null;

	const {
		composite_score: compositeScore,
		risk_level: riskLevel,
		primaryReason,
		recommended_action: recommendedAction,
		document_type_detected: docType,
		modules,
		evidence_chain: evidenceChain,
		confidence,
	} = forensicResult;

	const action = ACTION_CONFIG[recommendedAction] || ACTION_CONFIG.REVIEW;

	// Filter to only modules that actually ran (have data)
	const activeModules = Object.entries(modules || {}).filter(
		([, data]) => data && data.score != null,
	);

	// Sort by score ascending (most critical first)
	const sortedModules = [...activeModules].sort(
		(a, b) => (a[1].score ?? 100) - (b[1].score ?? 100),
	);

	// Group into content vs forensic
	const contentModules = sortedModules.filter(([key]) => CONTENT_MODULES.has(key));
	const forensicModules = sortedModules.filter(
		([key]) => !CONTENT_MODULES.has(key),
	);

	const keyFindings = extractKeyFindings(modules);

	return (
		<div className="space-y-6">
			{/* Executive Summary Card */}
			<div className="border rounded-xl p-6 bg-white">
				<div className="flex items-start gap-6">
					{/* Score Donut */}
					<ScoreDonut score={compositeScore} riskLevel={riskLevel} />

					{/* Summary Details */}
					<div className="flex-1 space-y-3">
						<div className="flex items-center gap-3">
							<RiskBadge riskLevel={riskLevel} size="lg" />
							<span
								className={`px-3 py-1 rounded-full text-sm font-medium ${action.color} ${action.bgColor}`}
							>
								{action.label}
							</span>
						</div>

						{/* Key Findings — structured bullets instead of raw text */}
						{keyFindings.length > 0 ? (
							<div className="space-y-1.5">
								<p className="text-xs font-medium text-primary40 uppercase tracking-wide">
									{keyFindings.length} critical finding
									{keyFindings.length > 1 ? 's' : ''}
								</p>
								{keyFindings.map((f, i) => (
									<div
										key={i}
										className="flex items-start gap-2 text-sm text-primary80"
									>
										<f.icon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
										<span>
											<strong>{f.title}:</strong>{' '}
											{f.description}
										</span>
									</div>
								))}
							</div>
						) : primaryReason ? (
							<p className="text-sm text-primary80">{primaryReason}</p>
						) : null}

						<div className="flex items-center gap-4 text-xs text-primary40">
							{docType && (
								<div className="flex items-center gap-1">
									<FileText className="w-3.5 h-3.5" />
									<span>{docType}</span>
								</div>
							)}
							{confidence != null && (
								<div className="flex items-center gap-1">
									<Shield className="w-3.5 h-3.5" />
									<span>{Math.round(confidence)}% confidence</span>
								</div>
							)}
							{formatElapsed(
								result?.createdAt,
								result?.completedAt,
							) && (
								<div className="flex items-center gap-1">
									<Clock className="w-3.5 h-3.5" />
									<span>
										Completed in{' '}
										{formatElapsed(
											result.createdAt,
											result.completedAt,
										)}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Key Findings Cards — prominent visual callout for critical issues.
			    Each card enters with a staggered fade-in-and-slide-up animation
			    so the report feels like the AI is assembling evidence live. */}
			{keyFindings.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{keyFindings.map((f, i) => (
						<div
							key={i}
							className={`border rounded-lg p-4 flex items-start gap-3 opacity-0 ${SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.HIGH}`}
							style={{
								animation: 'findingFadeIn 0.45s ease-out forwards',
								animationDelay: `${i * 150}ms`,
							}}
						>
							<div className="p-2 rounded-lg bg-white/60">
								<f.icon className="w-5 h-5 text-red-600" />
							</div>
							<div className="flex-1 min-w-0">
								<h4 className="text-sm font-semibold text-gray-900">
									{f.title}
								</h4>
								<p className="text-sm text-gray-700 mt-0.5">
									{f.description}
								</p>
							</div>
							<span className="text-xs font-medium text-red-600 bg-white/60 px-2 py-0.5 rounded shrink-0">
								{f.severity}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Content Analysis Modules */}
			{contentModules.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-primary80 mb-3 flex items-center gap-2">
						<FileText className="w-4 h-4" />
						Content Analysis ({contentModules.length})
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{contentModules.map(([key, data]) => (
							<ModuleCard
								key={key}
								moduleKey={key}
								moduleData={data}
							/>
						))}
					</div>
				</div>
			)}

			{/* Forensic Analysis Modules */}
			{forensicModules.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-primary80 mb-3 flex items-center gap-2">
						<Shield className="w-4 h-4" />
						Forensic Analysis ({forensicModules.length})
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{forensicModules.map(([key, data]) => (
							<ModuleCard
								key={key}
								moduleKey={key}
								moduleData={data}
							/>
						))}
					</div>
				</div>
			)}

			{/* Advanced diagnostics — collapsed by default so the main surface
			    stays focused on Key Findings and module cards. Power users can
			    expand to see the raw evidence chain with technical details. */}
			{evidenceChain?.length > 0 && (
				<details className="border rounded-lg overflow-hidden group">
					<summary className="bg-gray-50 px-4 py-2.5 border-b cursor-pointer flex items-center justify-between text-sm font-semibold text-primary60 hover:text-primary80 list-none">
						<span className="flex items-center gap-2">
							<AlertTriangle className="w-4 h-4" />
							Advanced diagnostics ({evidenceChain.length} finding
							{evidenceChain.length > 1 ? 's' : ''})
						</span>
						<span className="text-xs text-primary40 font-normal">
							Click to expand
						</span>
					</summary>
					<EvidenceChainTable evidenceChain={evidenceChain} />
				</details>
			)}
		</div>
	);
};

export default ForensicReport;
