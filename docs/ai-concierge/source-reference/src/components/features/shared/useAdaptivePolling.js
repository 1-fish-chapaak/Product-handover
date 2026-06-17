/**
 * Adaptive polling interval calculator for AI Concierge job status polling.
 *
 * Starts fast (2s) for responsiveness, then slows down to reduce server load
 * on long-running jobs. Stops entirely on terminal statuses.
 *
 * Schedule:
 *   0–2 min:   2s  (fast — user is watching)
 *   2–5 min:   5s  (moderate — job is working)
 *   5+ min:   10s  (slow — likely a long job, reduce polling)
 *
 * Usage:
 *   import { getAdaptiveInterval, TERMINAL_STATUSES } from '../shared/useAdaptivePolling';
 *
 *   refetchInterval: (query) => {
 *     const data = query?.state?.data;
 *     return getAdaptiveInterval(data, jobCreatedAt);
 *   }
 */

export const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

/**
 * Returns the polling interval in milliseconds, or false to stop polling.
 * @param {Object|null} statusData - The latest status response from the API.
 * @param {number|null} jobStartTime - Unix timestamp (ms) when the job was created/started.
 * @returns {number|false}
 */
export const getAdaptiveInterval = (statusData, jobStartTime) => {
	if (!statusData) return 2000;
	if (TERMINAL_STATUSES.includes(statusData.status)) return false;

	if (!jobStartTime) return 2000;

	const elapsedMs = Date.now() - jobStartTime;
	const elapsedMin = elapsedMs / 60000;

	if (elapsedMin < 2) return 2000; // fast: first 2 minutes
	if (elapsedMin < 5) return 5000; // moderate: 2–5 minutes
	return 10000; // slow: 5+ minutes
};
