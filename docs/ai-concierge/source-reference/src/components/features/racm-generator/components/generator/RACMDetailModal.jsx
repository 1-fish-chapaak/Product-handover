import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	FIELD_GROUPS,
	CONFIDENCE_COLORS,
	RISK_RATING_COLORS,
} from '../../constants/racm.constants';
import { RACM_FIELDS } from '../../utils/racm-field-definitions';

const WIDE_FIELDS = new Set([
	'riskDescription',
	'controlObjective',
	'controlActivity',
	'controlEvidence',
	'segregationOfDuties',
	'managementReviewControl',
]);

const FieldValue = ({ fieldKey, value, isWide }) => {
	if (fieldKey === 'extractionConfidence' && value) {
		const colors = CONFIDENCE_COLORS[value] || {};
		return (
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors.text || ''} ${colors.bg || ''} ${colors.border || ''}`}
			>
				{value}
			</span>
		);
	}
	if (fieldKey === 'riskRating' && value) {
		const colors = RISK_RATING_COLORS[value] || {};
		return (
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors.text || ''} ${colors.bg || ''} ${colors.border || ''}`}
			>
				{value}
			</span>
		);
	}
	return (
		<span
			className={`text-sm text-primary80 ${isWide ? 'whitespace-pre-wrap' : ''}`}
		>
			{value || '-'}
		</span>
	);
};

const RACMDetailModal = ({ entry, open, onClose }) => {
	if (!entry) return null;

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-primary80">
						{entry.riskId} / {entry.controlId} — {entry.processArea}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 mt-4">
					{Object.entries(FIELD_GROUPS).map(([groupKey, group]) => (
						<div key={groupKey}>
							<h3 className="text-sm font-semibold text-purple-100 border-b border-purple-10 pb-1 mb-3">
								{group.label}
							</h3>
							<div className="grid grid-cols-2 gap-x-4 gap-y-3">
								{group.fields.map((fieldKey) => {
									const fieldDef = RACM_FIELDS.find(
										(f) => f.key === fieldKey,
									);
									const isWide = WIDE_FIELDS.has(fieldKey);
									return (
										<div
											key={fieldKey}
											className={`space-y-0.5 ${isWide ? 'col-span-2' : ''}`}
										>
											<label className="text-xs font-medium text-primary40">
												{fieldDef?.label || fieldKey}
											</label>
											<div
												className={
													isWide
														? 'bg-gray-50 rounded-md px-3 py-2 text-sm'
														: ''
												}
											>
												<FieldValue
													fieldKey={fieldKey}
													value={entry[fieldKey]}
													isWide={isWide}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default RACMDetailModal;
