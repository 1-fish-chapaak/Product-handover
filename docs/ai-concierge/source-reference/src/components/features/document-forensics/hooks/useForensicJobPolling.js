import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getForensicJobStatus } from '../service/forensics.service';
import { getAdaptiveInterval } from '../../shared/useAdaptivePolling';

export const useForensicJobPolling = (jobId, enabled = true) => {
	const startTimeRef = useRef(Date.now());

	return useQuery({
		queryKey: ['forensic-job-status', jobId],
		queryFn: () => getForensicJobStatus(jobId),
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
