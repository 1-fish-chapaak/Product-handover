import { FileText } from 'lucide-react';
import GradientHeading from '@/components/elements/GradientHeading';

const TableExtractorHeader = () => {
	return (
		<div className="bg-white/40 backdrop-blur-lg border-b border-white/60 px-6 py-4">
			<div className="flex items-center gap-3">
				<span className="rounded-xl bg-white/60 backdrop-blur-sm p-2 border border-white/70 inline-flex shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
					<FileText className="w-4 h-4 text-purple-100" />
				</span>
				<div>
					<GradientHeading className="text-lg font-semibold uppercase tracking-wide">
						Table Extractor
					</GradientHeading>
					<p className="text-xs text-primary40 mt-0.5">
						AI-powered structured data extraction from PDF invoices and
						documents
					</p>
				</div>
			</div>
		</div>
	);
};

export default TableExtractorHeader;
