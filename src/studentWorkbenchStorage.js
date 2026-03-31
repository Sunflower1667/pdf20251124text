/**
 * 학생 활동(대시보드·iframe)에서 쓰는 로컬 초안.
 * 로그인 직후·로그아웃 시 비워 두고, Firebase 복원은 「과거 활동 불러오기」 등에서만 채웁니다.
 */
import { EXPLORE_HYDRATE_SESSION_KEY } from './exploreSession.js'

const WORKBENCH_DRAFT_KEYS = [
  'analysisData',
  'extractedText',
  'studentIdeaSessionRestore',
  'studentDrawingRestore',
  'myInventionSpecDraft',
  'specExploreReflection',
]

export function clearStudentWorkbenchLocalDrafts() {
  for (const key of WORKBENCH_DRAFT_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(EXPLORE_HYDRATE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
