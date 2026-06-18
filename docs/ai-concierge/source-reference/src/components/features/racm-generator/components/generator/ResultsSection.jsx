import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SummaryDashboard from './SummaryDashboard';
import RACMResultsTable from './RACMResultsTable';
import RACMDetailModal from './RACMDetailModal';
import ExportButtons from './ExportButtons';
import { updateRacmJobResult } from '../../service/racm.service';

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

const ResultsSection = ({ result, fileName, jobId, onNewGeneration }) => {
	const [selectedEntry, setSelectedEntry] = useState(null);
	const [showSummary, setShowSummary] = useState(true);
	const [editedEntries, setEditedEntries] = useState(null);
	const [savedEntries, setSavedEntries] = useState(null);
	const [isSaving, setIsSaving] = useState(false);

	const originalEntries = result?.entries || [];
	const summaryMarkdown = result?.summaryMarkdown;
	const displayEntries = editedEntries || savedEntries || originalEntries;
	const hasChanges = editedEntries !== null;

	const handleCellEdit = useCallback(
		(rowIndex, fieldKey, newValue) => {
			setEditedEntries((prev) => {
				const base = prev || [...originalEntries.map((e) => ({ ...e }))];
				const updated = [...base];
				updated[rowIndex] = { ...updated[rowIndex], [fieldKey]: newValue };
				return updated;
			});
		},
		[originalEntries],
	);

	const handleSave = async () => {
		if (!editedEntries || !jobId) return;
		try {
			setIsSaving(true);
			await updateRacmJobResult(jobId, editedEntries);
			toast.success('Changes saved successfully');
			setSavedEntries(editedEntries);
			setEditedEntries(null);
		} catch {
			toast.error('Failed to save changes');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setEditedEntries(null);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold text-primary80">Results</h3>
					<span className="text-sm text-primary40">
						{displayEntries.length} entries generated
						{formatElapsed(result?.createdAt, result?.completedAt) &&
							` \u00B7 ${formatElapsed(result.createdAt, result.completedAt)}`}
					</span>
					{hasChanges && (
						<span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
							Unsaved changes
						</span>
					)}
				</div>
				<div className="flex items-center gap-3">
					{hasChanges && (
						<>
							<button
								onClick={handleDiscard}
								disabled={isSaving}
								className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-primary60 font-medium transition-colors disabled:opacity-50"
							>
								Discard Changes
							</button>
							<button
								onClick={handleSave}
								disabled={isSaving}
								className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
							>
								{isSaving ? 'Saving...' : 'Save Changes'}
							</button>
						</>
					)}
					<button
						onClick={() => setShowSummary(!showSummary)}
						className="text-sm text-purple-100 hover:text-purple-80 font-medium"
					>
						{showSummary ? 'Hide Summary' : 'Show Summary'}
					</button>
					<ExportButtons entries={displayEntries} fileName={fileName} />
					{onNewGeneration && (
						<button
							onClick={onNewGeneration}
							className="px-3 py-1.5 text-sm bg-purple-100 text-white rounded-lg hover:bg-purple-80 font-medium transition-colors"
						>
							+ New Generation
						</button>
					)}
				</div>
			</div>

			{showSummary && (
				<>
					<SummaryDashboard entries={displayEntries} />

					{summaryMarkdown && (
						<div className="bg-white border rounded-xl p-5">
							<h4 className="text-sm font-semibold text-primary60 mb-3">
								SOP Analysis Summary
							</h4>
							<div className="prose prose-sm max-w-none text-primary80 prose-headings:text-primary80 prose-headings:font-semibold prose-p:text-primary60 prose-li:text-primary60 prose-strong:text-primary80 prose-table:text-sm">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{summaryMarkdown}
								</ReactMarkdown>
							</div>
						</div>
					)}
				</>
			)}

			<RACMResultsTable
				entries={displayEntries}
				onRowClick={(entry) => setSelectedEntry(entry)}
				onCellEdit={handleCellEdit}
			/>

			<RACMDetailModal
				entry={selectedEntry}
				open={!!selectedEntry}
				onClose={() => setSelectedEntry(null)}
			/>
		</div>
	);
};

export default ResultsSection;
