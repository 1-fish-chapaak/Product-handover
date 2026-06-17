import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMedicalReaderJobStatus } from '../service/medical-reader.service';
import { getAdaptiveInterval } from '../../shared/useAdaptivePolling';

export const useMedicalReaderJobPolling = (jobId, enabled = true) => {
	const startTimeRef = useRef(Date.now());

	return useQuery({
		queryKey: ['medical-reader-job-status', jobId],
		queryFn: () => getMedicalReaderJobStatus(jobId),
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
