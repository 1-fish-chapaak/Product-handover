import { useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import SpeechAuditorHeader from './components/SpeechAuditorHeader';
import SpeechAuditorTabs from './components/SpeechAuditorTabs';
import AuditorTab from './components/auditor/AuditorTab';
import HistoryTab from './components/history/HistoryTab';
import { SA_TABS } from './constants/speechAuditor.constants';

const SpeechAuditorPage = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	const activeTab = useMemo(() => {
		const tabParam = searchParams.get('tab');
		return tabParam &&
			Object.values(SA_TABS)
				?.map((t) => t.value)
				.includes(tabParam)
			? tabParam
			: SA_TABS.AUDITOR.value;
	}, [searchParams]);

	const selectedJobId = useMemo(
		() => searchParams.get('jobId') || null,
		[searchParams],
	);

	useEffect(() => {
		if (!searchParams.get('tab')) {
			setSearchParams({ tab: activeTab }, { replace: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleTabChange = useCallback(
		(value) => {
			setSearchParams({ tab: value }, { replace: true });
		},
		[setSearchParams],
	);

	const setSelectedJobId = useCallback(
		(jobId) => {
			const tab = searchParams.get('tab') || SA_TABS.AUDITOR.value;
			if (jobId) {
				setSearchParams({ tab, jobId }, { replace: true });
			} else {
				setSearchParams({ tab }, { replace: true });
			}
		},
		[setSearchParams, searchParams],
	);

	const handleViewJob = useCallback(
		(jobId) => {
			setSearchParams(
				{ tab: SA_TABS.AUDITOR.value, jobId },
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	return (
		<div className="h-full w-full flex flex-col px-6 py-4 pt-2 bg-gradient-to-br from-[rgba(249,245,255,1)] via-[rgba(238,232,248,0.5)] to-[rgba(249,250,251,1)] rounded-lg">
			<button
				onClick={() => navigate('/app/ai-concierge')}
				className="inline-flex items-center gap-1 text-sm text-primary40 hover:text-purple-100 transition-colors mb-3"
			>
				<ChevronLeft className="size-4" />
				Back to AI Concierge
			</button>

			<div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_16px_rgba(106,18,205,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/70 overflow-hidden flex-1 flex flex-col min-h-0">
				<SpeechAuditorHeader />

				<Tabs
					value={activeTab}
					onValueChange={handleTabChange}
					className="flex-1 flex flex-col min-h-0"
				>
					<SpeechAuditorTabs />

					<div className="flex-1 overflow-auto px-6 pt-4 pb-6">
						<TabsContent value={SA_TABS.AUDITOR.value} className="mt-0">
							<AuditorTab
								selectedJobId={
									activeTab === 'auditor' ? selectedJobId : null
								}
								onJobIdChange={setSelectedJobId}
							/>
						</TabsContent>

						<TabsContent value={SA_TABS.HISTORY.value} className="mt-0">
							<HistoryTab onViewJob={handleViewJob} />
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
};

export default SpeechAuditorPage;
