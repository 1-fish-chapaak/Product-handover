import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getImageAnalyticsJobStatus } from '../service/imageAnalytics.service';
import {
	getAdaptiveInterval,
	TERMINAL_STATUSES,
} from '../../shared/useAdaptivePolling';

export const useImageAnalyticsJobPolling = (jobId, enabled = true) => {
	const startTimeRef = useRef(Date.now());

	return useQuery({
		queryKey: ['ia-job-status', jobId],
		queryFn: () => getImageAnalyticsJobStatus(jobId),
		enabled: !!jobId && enabled,
		retry: 3,
		retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
		refetchInterval: (query) => {
			const data = query?.state?.data;
			return getAdaptiveInterval(data, startTimeRef.current);
		},
		refetchIntervalInBackground: true,
	});
};
