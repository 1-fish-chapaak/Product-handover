import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MR_TABS } from '../constants/medical-reader.constants';

const MedicalReaderTabs = () => {
	return (
		<TabsList className="bg-transparent border-b border-gray-200 rounded-none w-full justify-start gap-0 h-auto p-0">
			{Object.values(MR_TABS).map((tab) => (
				<TabsTrigger
					key={tab.value}
					value={tab.value}
					className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#6A12CD] data-[state=active]:text-purple-100 data-[state=active]:shadow-none px-6 py-3 text-sm font-medium text-primary40 hover:text-primary80 transition-colors"
				>
					{tab.label}
				</TabsTrigger>
			))}
		</TabsList>
	);
};

export default MedicalReaderTabs;
