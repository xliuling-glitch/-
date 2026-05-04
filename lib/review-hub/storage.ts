import type { ReviewHubData } from './types';

const KEY = 'review-hub-v1';

function defaultData(): ReviewHubData {
  return { shopTargets: {}, assignments: [], submissions: [] };
}

export function loadReviewHub(): ReviewHubData {
  if (typeof window === 'undefined') return defaultData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const v = JSON.parse(raw) as Partial<ReviewHubData>;
    return {
      shopTargets: v.shopTargets && typeof v.shopTargets === 'object' ? v.shopTargets : {},
      assignments: Array.isArray(v.assignments) ? v.assignments : [],
      submissions: Array.isArray(v.submissions) ? v.submissions : [],
    };
  } catch {
    return defaultData();
  }
}

export function saveReviewHub(data: ReviewHubData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const REVIEW_HUB_STAFF_KEY = 'review-hub-current-staff';

export function getCurrentStaffName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(REVIEW_HUB_STAFF_KEY) || '';
}

export function setCurrentStaffName(name: string) {
  localStorage.setItem(REVIEW_HUB_STAFF_KEY, name);
}
