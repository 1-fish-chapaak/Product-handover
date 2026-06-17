import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IA_TABS } from '../constants/imageAnalytics.constants';

const ImageAnalyticsTabs = () => {
	return (
		<TabsList className="bg-transparent border-b border-gray-100 px-6 pt-2 pb-0 flex gap-4 h-auto rounded-none justify-start">
			{Object.values(IA_TABS).map((tab) => (
				<TabsTrigger
					key={tab.value}
					value={tab.value}
					className="text-sm font-medium text-primary40 pb-2.5 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-purple-100 data-[state=active]:text-purple-100 data-[state=active]:shadow-none"
				>
					{tab.label}
				</TabsTrigger>
			))}
		</TabsList>
	);
};

export default ImageAnalyticsTabs;
