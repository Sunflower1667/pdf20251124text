/** 학생 대시보드가 활동 iframe에 “지금 화면 기준으로 localStorage에 맞춰 저장”을 요청할 때 사용 */

export const WORKBENCH_FLUSH_REQUEST = 'student-workbench-flush-request'
export const WORKBENCH_FLUSH_DONE = 'student-workbench-flush-done'

/**
 * @param {Window | null | undefined} iframeWindow
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export function requestChildWorkbenchFlush(iframeWindow, timeoutMs = 2800) {
  return new Promise((resolve) => {
    if (!iframeWindow) {
      resolve()
      return
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg)
      resolve()
    }, timeoutMs)

    function onMsg(ev) {
      if (ev.data?.type !== WORKBENCH_FLUSH_DONE || ev.data.requestId !== requestId) return
      clearTimeout(timer)
      window.removeEventListener('message', onMsg)
      resolve()
    }

    window.addEventListener('message', onMsg)
    try {
      iframeWindow.postMessage({ type: WORKBENCH_FLUSH_REQUEST, requestId }, '*')
    } catch {
      clearTimeout(timer)
      window.removeEventListener('message', onMsg)
      resolve()
    }
  })
}

/**
 * @param {() => void | Promise<void>} runFlush - localStorage 등에 동기 반영
 */
export function listenForWorkbenchFlushRequest(runFlush) {
  window.addEventListener('message', (e) => {
    if (e.data?.type !== WORKBENCH_FLUSH_REQUEST) return
    const requestId = e.data.requestId
    const reply = () => {
      try {
        e.source?.postMessage({ type: WORKBENCH_FLUSH_DONE, requestId }, '*')
      } catch {
        /* ignore */
      }
    }
    Promise.resolve()
      .then(() => runFlush())
      .then(reply, reply)
  })
}
