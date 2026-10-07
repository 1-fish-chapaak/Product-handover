import type { Tone } from '../shared/StatusBadge';
import type { Rating } from '../../data/auditPlan';

/** Risk / impact rating → the editorial severity pill tone. */
export const RATING_TONE: Record<Rating, Tone> = { High: 'risk', Medium: 'mitigated', Low: 'draft' };
