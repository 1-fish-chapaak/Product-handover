import { useQuery } from '@tanstack/react-query';
import { getRacmJobStatus } from '../service/racm.service';

export const useRacmJobPolling = (jobId, enabled = true) => {
	return useQuery({
		queryKey: ['racm-job-status', jobId],
		queryFn: () => getRacmJobStatus(jobId),
		enabled: !!jobId && enabled,
		retry: 3,
		retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
		refetchInterval: (query) => {
			const data = query?.state?.data;
			if (!data) return 2000;
			if (
				data.status === 'COMPLETED' ||
				data.status === 'FAILED' ||
				data.status === 'CANCELLED'
			) {
				return false;
			}
			return 2000;
		},
		refetchIntervalInBackground: true,
	});
};
