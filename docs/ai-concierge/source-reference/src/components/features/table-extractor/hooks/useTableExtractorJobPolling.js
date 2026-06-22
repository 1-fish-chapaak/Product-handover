import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTableExtractorJobStatus } from '../service/table-extractor.service';
import { getAdaptiveInterval } from '../../shared/useAdaptivePolling';

export const useTableExtractorJobPolling = (jobId, enabled = true) => {
	const startTimeRef = useRef(Date.now());

	return useQuery({
		queryKey: ['table-extractor-job-status', jobId],
		queryFn: async () => {
			const res = await getTableExtractorJobStatus(jobId);
			return res.data;
		},
		enabled: !!jobId && enabled,
		staleTime: 0,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
		refetchInterval: (query) => {
			const data = query?.state?.data;
			return getAdaptiveInterval(data, startTimeRef.current);
		},
		refetchIntervalInBackground: true,
	});
};
