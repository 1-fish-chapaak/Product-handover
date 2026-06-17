import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SA_TABS } from '../constants/speechAuditor.constants';

const SpeechAuditorTabs = () => (
	<div className="px-6 border-b border-gray-100">
		<TabsList className="bg-transparent h-auto p-0 gap-6">
			{Object.values(SA_TABS).map((tab) => (
				<TabsTrigger
					key={tab.value}
					value={tab.value}
					className="px-0 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-purple-100 data-[state=active]:text-purple-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-primary40 text-sm font-medium hover:text-primary60 transition-colors"
				>
					{tab.label}
				</TabsTrigger>
			))}
		</TabsList>
	</div>
);

export default SpeechAuditorTabs;
