/** 명세서 탐색하기: 과거 활동(또는 이번 탭에서의 작업)을 허용할 때만 localStorage에서 복원 */

export const EXPLORE_HYDRATE_SESSION_KEY = 'pro10-explore-hydrate'

/**
 * @param {boolean} showCoachPanel
 */
export function exploreAllowsHydrateFromStorage(showCoachPanel) {
  if (!showCoachPanel) return true
  try {
    return sessionStorage.getItem(EXPLORE_HYDRATE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function markExploreHydrateAllowed() {
  try {
    sessionStorage.setItem(EXPLORE_HYDRATE_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}
