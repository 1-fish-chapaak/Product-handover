import { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getEdaReportHtml } from '../../service/eda.service';
import { STAGE_BASE_URL, STAGE_APP_TOKEN } from '@/config';

const REPORT_TYPES = [
	{
		key: 'understanding',
		label: 'Data Understanding',
		icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
	},
	{
		key: 'anomaly',
		label: 'Anomaly Detection',
		icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
	},
	{
		key: 'heuristic',
		label: 'Heuristic Analysis',
		icon: 'M13 10V3L4 14h7v7l9-11h-7z',
	},
];

/** Strip the standalone nav header and embedded download/print buttons from report HTML */
const stripNavFromHtml = (html) => {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		// Remove header/nav elements (the dark top bar with report tabs)
		doc.querySelectorAll('header, nav, .navbar').forEach((el) => el.remove());
		// Remove embedded download/print button containers
		// but KEEP evidence CSV download links (btn-csv class)
		doc.querySelectorAll(
			'button, [class*="download"], [class*="print"]',
		).forEach((el) => {
			// Skip CSV evidence download buttons
			if (el.classList && el.classList.contains('btn-csv')) return;
			const text = (el.textContent || '').toLowerCase();
			if (
				text.includes('download') ||
				text.includes('print') ||
				text.includes('pdf')
			) {
				const parent = el.parentElement;
				if (
					parent &&
					parent.children.length <= 2 &&
					parent.tagName !== 'BODY'
				) {
					parent.remove();
				} else {
					el.remove();
				}
			}
		});
		return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
	} catch {
		return html;
	}
};

/** Build a combined navigable HTML with all reports in iframes */
const buildCombinedReport = (reports, reportLabels) => {
	// Escape </script> in JSON to prevent premature script tag closure in the combined HTML.
	// JSON.stringify does NOT escape forward slashes, so </script> in report HTML
	// would close the outer <script> tag. Replacing with <\/script works because
	// JS interprets \/ as just / — so the data is preserved correctly.
	const reportsJson = JSON.stringify(reports).replace(/<\/script/gi, '<\\/script');
	const tabsJson = JSON.stringify(reportLabels);

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Insights &amp; Anomaly Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc}
.nav{display:flex;align-items:center;padding:14px 28px;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;gap:36px}
.nav-title{font-size:15px;font-weight:600;letter-spacing:.3px}
.nav-tabs{display:flex;gap:6px}
.nav-tab{padding:8px 18px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.7);border:none;background:none;font-size:13px;font-weight:500;transition:all .2s}
.nav-tab:hover{color:#fff;background:rgba(255,255,255,.12)}
.nav-tab.active{color:#fff;background:rgba(255,255,255,.18);font-weight:600}
.report-frame{width:100%;height:calc(100vh - 56px);border:none;display:none}
.report-frame.active{display:block}
</style></head><body>
<div class="nav"><div class="nav-title">Insights &amp; Anomaly Report</div>
<div class="nav-tabs" id="nav-tabs"></div></div>
<div id="frames"></div>
<script>
var reports=${reportsJson};
var tabs=${tabsJson};
var navTabs=document.getElementById('nav-tabs');
var framesDiv=document.getElementById('frames');
var keys=Object.keys(tabs);
keys.forEach(function(key,i){
if(!reports[key])return;
var btn=document.createElement('button');
btn.className='nav-tab'+(i===0?' active':'');
btn.textContent=tabs[key];
btn.setAttribute('data-key',key);
btn.onclick=function(){showTab(key)};
navTabs.appendChild(btn);
var iframe=document.createElement('iframe');
iframe.id='frame-'+key;
iframe.className='report-frame'+(i===0?' active':'');
iframe.sandbox='allow-scripts allow-same-origin allow-modals';
framesDiv.appendChild(iframe);
});
function showTab(key){
document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active')});
document.querySelectorAll('.report-frame').forEach(function(f){f.classList.remove('active')});
document.querySelector('[data-key="'+key+'"]').classList.add('active');
document.getElementById('frame-'+key).classList.add('active');
loadFrame(key);
}
function loadFrame(key){
var iframe=document.getElementById('frame-'+key);
if(iframe.dataset.loaded)return;
var doc=iframe.contentDocument||iframe.contentWindow.document;
doc.open();doc.write(reports[key]);doc.close();
iframe.dataset.loaded='true';
}
if(keys.length>0)loadFrame(keys[0]);
<\/script></body></html>`;
};

const DownloadIcon = () => (
	<svg
		className="w-3.5 h-3.5"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
		/>
	</svg>
);

const ReportViewer = ({ jobId, reportUrls, summary, initialTab }) => {
	const [activeTab, setActiveTab] = useState(initialTab || '');
	const [htmlCache, setHtmlCache] = useState({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [statsOpen, setStatsOpen] = useState(false);
	const [downloadingAll, setDownloadingAll] = useState(false);
	const iframeRef = useRef(null);

	const availableReports = REPORT_TYPES.filter(
		(r) => reportUrls?.[r.key] || reportUrls?.[r.key + '_standalone'],
	);

	// Set initial tab if provided, or auto-select first available report
	useEffect(() => {
		if (initialTab && initialTab !== activeTab) {
			setActiveTab(initialTab);
		} else if (!activeTab && availableReports.length > 0) {
			setActiveTab(availableReports[0].key);
		}
	}, [initialTab, availableReports.length]);

	const fetchReport = useCallback(
		async (reportKey) => {
			if (htmlCache[reportKey]) return;
			setLoading(true);
			setError('');
			try {
				// Try standalone first, then regular
				const type = reportUrls?.[reportKey + '_standalone']
					? reportKey + '_standalone'
					: reportKey;
				let html = await getEdaReportHtml(jobId, type);
				// Inject script that intercepts CSV download clicks and fetches
				// with auth headers (x-app-token), since plain <a> clicks
				// don't send custom headers and get blocked by AuthenticationFilter.
				const csvDownloadScript = `<script>
document.addEventListener('click', function(e) {
	var link = e.target.closest('a.btn-csv');
	if (!link) return;
	e.preventDefault();
	var url = '${STAGE_BASE_URL || ''}' + link.getAttribute('href');
	fetch(url, {
		headers: { 'x-app-token': '${STAGE_APP_TOKEN || ''}' },
		credentials: 'include'
	})
	.then(function(r) {
		if (!r.ok) throw new Error('Download failed: ' + r.status);
		return r.blob();
	})
	.then(function(blob) {
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = link.getAttribute('href').split('/').pop();
		a.click();
		URL.revokeObjectURL(a.href);
	})
	.catch(function(err) { alert('CSV download failed: ' + err.message); });
});
<\/script>`;
				html = html.replace('</body>', csvDownloadScript + '</body>');
				setHtmlCache((prev) => ({ ...prev, [reportKey]: html }));
			} catch (err) {
				setError(
					`Failed to load ${reportKey} report: ${err?.response?.status === 404 ? 'Report not found' : err.message}`,
				);
			} finally {
				setLoading(false);
			}
		},
		[jobId, reportUrls, htmlCache],
	);

	// Fetch when tab changes
	useEffect(() => {
		if (activeTab) {
			fetchReport(activeTab);
		}
	}, [activeTab, fetchReport]);

	// Resize iframe to fit content
	const handleIframeLoad = useCallback(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;
		try {
			const doc = iframe.contentDocument || iframe.contentWindow?.document;
			if (doc?.body) {
				const height = Math.max(doc.body.scrollHeight, 600);
				iframe.style.height = `${Math.min(height, 2000)}px`;
			}
		} catch {
			// Cross-origin or access error — use default height
		}
	}, []);

	/** Print current report as PDF via browser print dialog */
	const handlePrintPdf = () => {
		const iframe = iframeRef.current;
		if (!iframe) return;
		try {
			iframe.contentWindow?.print();
		} catch {
			// Fallback: open HTML in new window and print
			const html = htmlCache[activeTab];
			if (!html) return;
			const win = window.open('', '_blank');
			if (win) {
				win.document.write(stripNavFromHtml(html));
				win.document.close();
				setTimeout(() => win.print(), 500);
			}
		}
	};

	/** Download current tab's report HTML (nav stripped) */
	const handleDownload = () => {
		const html = htmlCache[activeTab];
		if (!html) return;
		const cleanHtml = stripNavFromHtml(html);
		const blob = new Blob([cleanHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${activeTab}-report.html`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/** Download all reports combined into a single navigable HTML */
	const handleDownloadAll = async () => {
		setDownloadingAll(true);
		try {
			const allReports = {};
			for (const { key } of availableReports) {
				if (htmlCache[key]) {
					allReports[key] = stripNavFromHtml(htmlCache[key]);
				} else {
					const type = reportUrls?.[key + '_standalone']
						? key + '_standalone'
						: key;
					const html = await getEdaReportHtml(jobId, type);
					setHtmlCache((prev) => ({ ...prev, [key]: html }));
					allReports[key] = stripNavFromHtml(html);
				}
			}

			const reportLabels = {};
			availableReports.forEach(({ key, label }) => {
				reportLabels[key] = label;
			});

			const combinedHtml = buildCombinedReport(allReports, reportLabels);
			const blob = new Blob([combinedHtml], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'insights-anomaly-report.html';
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			setError('Failed to download all reports');
		} finally {
			setDownloadingAll(false);
		}
	};

	const llmCosts = summary?.llm_costs || {};
	const hasStats =
		llmCosts &&
		(llmCosts.total_cost != null ||
			llmCosts.total_input_tokens != null ||
			llmCosts.calls != null);

	if (availableReports.length === 0) return null;

	const btnClass =
		'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-purple-100 bg-white border border-purple-100/30 rounded-lg hover:bg-purple-100 hover:text-white transition-all duration-200 shadow-sm';

	return (
		<div className="mt-6 border border-gray-200/80 rounded-xl overflow-hidden shadow-sm">
			{/* Header */}
			<div className="px-5 py-3.5 border-b bg-gradient-to-r from-purple-4 to-indigo-50/50 flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<div className="w-7 h-7 rounded-lg bg-purple-100/10 flex items-center justify-center">
						<svg
							className="w-4 h-4 text-purple-100"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</div>
					<h3 className="text-sm font-semibold text-primary80">
						Report Viewer
					</h3>
				</div>
				{activeTab && htmlCache[activeTab] && (
					<div className="flex items-center gap-2">
						<button onClick={handlePrintPdf} className={btnClass}>
							<svg
								className="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
								/>
							</svg>
							Download PDF
						</button>
						<button onClick={handleDownload} className={btnClass}>
							<DownloadIcon />
							Download HTML
						</button>
						<button
							onClick={handleDownloadAll}
							disabled={downloadingAll}
							className={`${btnClass} disabled:opacity-50`}
						>
							<svg
								className="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
								/>
							</svg>
							{downloadingAll ? 'Preparing...' : 'Download All HTML'}
						</button>
					</div>
				)}
			</div>

			{/* Tabs — tab bar hidden since report cards above handle switching */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				{/* Content */}
				{availableReports.map(({ key }) => (
					<TabsContent key={key} value={key} className="mt-0">
						{loading && !htmlCache[key] ? (
							<div className="flex items-center justify-center py-20 bg-gray-50/30">
								<div className="text-center space-y-3">
									<div className="animate-spin w-8 h-8 border-2 border-purple-100 border-t-transparent rounded-full mx-auto" />
									<p className="text-sm text-primary40">
										Loading report...
									</p>
								</div>
							</div>
						) : error && !htmlCache[key] ? (
							<div className="flex items-center justify-center py-20 bg-red-50/20">
								<div className="text-center space-y-3">
									<svg
										className="w-10 h-10 text-red-400 mx-auto"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={1.5}
											d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									<p className="text-sm text-red-500">{error}</p>
									<button
										onClick={() => {
											setError('');
											fetchReport(key);
										}}
										className="text-xs text-purple-100 hover:underline"
									>
										Retry
									</button>
								</div>
							</div>
						) : htmlCache[key] ? (
							<div className="bg-white">
								<iframe
									ref={iframeRef}
									srcDoc={stripNavFromHtml(htmlCache[key])}
									onLoad={handleIframeLoad}
									title={`${key} report`}
									className="w-full border-0"
									style={{ minHeight: '600px', height: '800px' }}
								/>
							</div>
						) : null}
					</TabsContent>
				))}
			</Tabs>

			{/* Pipeline & LLM Stats */}
			{hasStats && (
				<div className="border-t border-gray-100">
					<button
						onClick={() => setStatsOpen(!statsOpen)}
						className="w-full px-5 py-3 flex items-center justify-between text-sm text-primary40 hover:text-primary60 hover:bg-gray-50/50 transition-all duration-200"
					>
						<div className="flex items-center gap-2">
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
							<span className="font-medium">
								Pipeline &amp; LLM Stats
							</span>
						</div>
						<svg
							className={`w-4 h-4 transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
					{statsOpen && (
						<div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
							{llmCosts.total_cost != null && (
								<StatCard
									label="Total LLM Cost"
									value={`$${Number(llmCosts.total_cost).toFixed(4)}`}
								/>
							)}
							{llmCosts.total_input_tokens != null && (
								<StatCard
									label="Input Tokens"
									value={Number(
										llmCosts.total_input_tokens,
									).toLocaleString()}
								/>
							)}
							{llmCosts.total_output_tokens != null && (
								<StatCard
									label="Output Tokens"
									value={Number(
										llmCosts.total_output_tokens,
									).toLocaleString()}
								/>
							)}
							{llmCosts.calls != null && (
								<StatCard label="LLM Calls" value={llmCosts.calls} />
							)}
							{llmCosts.provider && (
								<StatCard
									label="Provider"
									value={llmCosts.provider}
								/>
							)}
							{llmCosts.model && (
								<StatCard label="Model" value={llmCosts.model} />
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

const StatCard = ({ label, value }) => (
	<div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
		<p className="text-xs text-primary40">{label}</p>
		<p className="text-sm font-semibold text-primary80 mt-0.5">{value}</p>
	</div>
);

export default ReportViewer;
