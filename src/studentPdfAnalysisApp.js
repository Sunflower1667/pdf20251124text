import './student1.css'
import { extractTextFromPdfFile } from './pdfSpecExtract.js'
import { jsPDF } from 'jspdf'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import { exploreAllowsHydrateFromStorage, markExploreHydrateAllowed } from './exploreSession.js'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const COACH_SPEC_MAX_CHARS = 120_000
const SPEC_EXPLORE_REFLECTION_KEY = 'specExploreReflection'
const SPEC_SELF_CHECK_KEY = 'specSelfCheck'
/** 「발명 씨앗 찾기」(seed.js)가 저장해 둔 관심사·불편함 */
const SEED_DRAFT_KEY = 'pro10-seed-draft'

const REFLECTION_FIELDS = [
  { key: 'name', selector: '#reflect-name' },
  { key: 'materials', selector: '#reflect-materials' },
  { key: 'merits', selector: '#reflect-merits' },
  { key: 'improvements', selector: '#reflect-improvements' },
]

const COMPARE_LEVEL_CLASS = {
  '명세서에 있어요': 'compare-level--good',
  '명세서에는 없지만 생각해 볼 만해요': 'compare-level--maybe',
  '명세서 내용과 달라요': 'compare-level--recheck',
}

const LEVEL_ADJUST = `- 학생이 어려워하면 더 쉬운 말과 일상 속 비유로 한 번 더 풀어서 설명해 줘.
- 학생이 이미 잘 이해하고 있으면 명세서의 조금 더 구체적인 내용까지 짚어 줘.`
const KOREAN_ONLY = '- 반드시 한국어로만 답해.'

/**
 * @param {HTMLElement | null} rootEl
 * @param {{ heading?: string; subtitle?: string; showCoachPanel?: boolean }} [options]
 */
export function mountStudentPdfAnalysis(rootEl, options = {}) {
  if (!rootEl) {
    console.error('mountStudentPdfAnalysis: root element not found')
    return
  }

  const heading = options.heading ?? '명세서 쉽게 이해하기'
  const subtitle = options.subtitle ?? '명세서 파일을 받아 업로드 해주세요!'
  const showCoachPanel = options.showCoachPanel === true

  const uploaderSection = `
    <section class="uploader">
      <label for="pdf-input" class="file-picker">
        <input id="pdf-input" type="file" accept="application/pdf" />
        <span>발명 명세서 PDF 업로드</span>
      </label>
      <button id="download-pdf-btn" type="button" class="pdf-download-btn" disabled>명세서 PDF 다운로드</button>
    </section>`

  const selfCheckSection = `
    <section id="self-check-block" class="self-check" hidden aria-labelledby="self-check-heading">
      <div class="self-check-header">
        <h3 id="self-check-heading">스스로 따져 보기</h3>
        <button id="self-check-refresh-btn" type="button" class="self-check-refresh">질문 다시 받기</button>
      </div>
      <p class="self-check-desc">이 발명이 정말 좋기만 할까요? 아래 질문 3개에 내 생각을 적어 보세요. 정답은 없어요.</p>
      <p id="self-check-status" class="self-check-status" role="status" aria-live="polite" hidden></p>
      <div id="self-check-list" class="self-check-list"></div>
      <div class="self-check-actions">
        <button id="save-self-check-btn" type="button" class="btn-secondary" disabled>내 답변 저장하기</button>
      </div>
    </section>`

  const analysisSection = `
    <section class="analysis-panel">
      <div class="analysis-header">
        <div class="analysis-title-section">
          <h2>명세서 특징 요약정리 하기</h2>
          <div class="analysis-title-actions">
            <button id="analyze-btn" type="button" class="btn-primary" disabled>명세서 분석하기</button>
            ${
              showCoachPanel
                ? `<button id="compare-summary-btn" type="button" class="compare-icon-btn" disabled title="내가 쓴 장단점과 AI 요약을 비교해서 점검받기" aria-label="내가 쓴 장단점과 AI 요약을 비교해서 점검받기">
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                    <path d="M4 5h6v14H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="M14 5h6v14h-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="m15.6 11.6 1.6 1.7 2.6-3.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 9h2M6 12h2M6 15h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </button>`
                : ''
            }
          </div>
        </div>
      </div>
      <p id="analysis-status" class="analysis-status">${escapeHtml(
        showCoachPanel
          ? 'PDF를 올리고, 왼쪽에서 보조교사와 대화한 뒤 오른쪽의 「내 생각 정리」를 마치고 여기서 [명세서 분석하기]를 눌러 요약을 확인해 보세요.'
          : 'PDF가 업로드 완료되면 분석을 할 수 있어요!'
      )}</p>
      <div id="analysis-grid" class="analysis-grid">
        ${createAnalysisCard('발명품의 명칭')}
        ${createAnalysisCard('기술 분야')}
        ${createAnalysisCard('배경 기술')}
        ${createAnalysisCard('해결하고자 하는 과제')}
        ${createAnalysisCard('과제를 해결하기 위한 수단')}
        ${createAnalysisCard('주요 구성 요소', true)}
      </div>
      ${selfCheckSection}
      <div class="analysis-actions">
        <button id="go-to-idea-btn" type="button" class="btn-secondary" disabled>아이디어 창출하기</button>
      </div>
    </section>`

  const coachAside = showCoachPanel
    ? `
    <aside class="coach-panel" aria-label="발명 보조교사">
      <div class="coach-panel-header">
        <h2>발명 보조교사와 확인하기</h2>
        <p class="coach-panel-desc">위쪽에서 PDF를 올린 뒤, 보조교사와 대화하며 명세서를 이해해 보세요. 오른쪽에서 「내 생각 정리」를 마치고 [명세서 분석하기]를 누르면 AI 요약을 볼 수 있어요.</p>
      </div>
      <section class="coach-card" aria-labelledby="coach-chat-heading">
        <h3 id="coach-chat-heading" class="coach-card-title"><span class="coach-step-num">1</span> 보조교사와 대화</h3>
        <div class="coach-card-body coach-card-body--chat">
          <div id="coach-messages" class="coach-messages" role="log" aria-live="polite"></div>
        </div>
        <p id="coach-hint" class="coach-hint coach-hint--in-card"></p>
        <div class="coach-compose">
          <label class="sr-only" for="coach-input">메시지 입력</label>
          <textarea id="coach-input" rows="3" placeholder="명세서를 읽다가 궁금한 점이나, 이렇게 이해했는지 확인받고 싶은 내용을 적어 보세요…"></textarea>
          <div class="coach-compose-actions">
            <button id="coach-send" type="button" class="btn-secondary">보내기</button>
          </div>
        </div>
      </section>
    </aside>`
    : ''

  const reflectionSection = showCoachPanel
    ? `
    <section id="explore-reflection-block" class="coach-card coach-card--reflect" hidden aria-labelledby="coach-reflect-heading">
      <h3 id="coach-reflect-heading" class="coach-card-title"><span class="coach-step-num">2</span> 내 생각 정리</h3>
      <p class="explore-reflection-hint">왼쪽에서 보조교사와 두 번 이상 대화한 뒤 채워 주세요. 네 칸을 모두 채우면 아래 [명세서 분석하기]를 누를 수 있어요.</p>
      <div class="explore-reflection-fields">
        <div class="explore-reflection-field">
          <label for="reflect-name"><span class="explore-label-num">1</span> 발명품의 이름</label>
          <textarea id="reflect-name" class="explore-reflection-textarea" rows="2" placeholder="이 발명품을 뭐라고 부르면 좋을지 적어 보세요."></textarea>
        </div>
        <div class="explore-reflection-field">
          <label for="reflect-materials"><span class="explore-label-num">2</span> 발명품의 재료</label>
          <textarea id="reflect-materials" class="explore-reflection-textarea" rows="3" placeholder="명세서에 나온 재료·구성을 적어 보세요."></textarea>
        </div>
        <div class="explore-reflection-field">
          <label for="reflect-merits"><span class="explore-label-num">3</span> 발명품의 장점</label>
          <textarea id="reflect-merits" class="explore-reflection-textarea" rows="3" placeholder="이 발명품의 좋은 점을 적어 보세요."></textarea>
        </div>
        <div class="explore-reflection-field">
          <label for="reflect-improvements"><span class="explore-label-num">4</span> 발명품의 단점 (내가 생각하는 보완해야 하는 점)</label>
          <textarea id="reflect-improvements" class="explore-reflection-textarea" rows="3" placeholder="아쉬운 점이나 보완이 필요하다고 생각하는 점을 적어 보세요."></textarea>
        </div>
      </div>
      <div class="explore-reflection-actions">
        <button id="save-reflection-btn" type="button" class="btn-secondary" disabled>내 생각 정리 저장하기</button>
      </div>
    </section>`
    : ''

  rootEl.innerHTML = `
  <div class="shell${showCoachPanel ? ' shell--split' : ''}">
    <header>
      <h1>${escapeHtml(heading)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </header>
    ${uploaderSection}
    ${
      showCoachPanel
        ? `<div class="explore-workspace">
      ${coachAside}
      <div class="explore-main explore-main--spec">
        ${reflectionSection}
        ${analysisSection}
      </div>
    </div>`
        : `${analysisSection}`
    }
    ${
      showCoachPanel
        ? `<div id="compare-modal" class="compare-modal" hidden>
      <div class="compare-modal-backdrop" data-compare-close></div>
      <div class="compare-modal-panel" role="dialog" aria-modal="true" aria-labelledby="compare-modal-title">
        <div class="compare-modal-head">
          <h3 id="compare-modal-title">내가 쓴 장단점 점검하기</h3>
          <button type="button" class="compare-modal-close" data-compare-close aria-label="점검 창 닫기">✕</button>
        </div>
        <p class="compare-modal-desc">내가 적은 장점·단점을 AI 요약과 견주어 어디를 더 살펴보면 좋을지 알려 줘요.</p>
        <p id="compare-modal-status" class="compare-modal-status" role="status" aria-live="polite" hidden></p>
        <div id="compare-modal-body" class="compare-modal-body"></div>
        <div class="compare-modal-actions">
          <button id="compare-refresh-btn" type="button" class="btn-secondary">다시 점검받기</button>
        </div>
      </div>
    </div>`
        : ''
    }
  </div>
`

  const pdfInput = rootEl.querySelector('#pdf-input')
  const analyzeBtn = rootEl.querySelector('#analyze-btn')
  const analysisStatusEl = rootEl.querySelector('#analysis-status')
  const analysisGrid = rootEl.querySelector('#analysis-grid')
  const goToIdeaBtn = rootEl.querySelector('#go-to-idea-btn')
  const downloadPdfBtn = rootEl.querySelector('#download-pdf-btn')
  const coachMessagesEl = showCoachPanel ? rootEl.querySelector('#coach-messages') : null
  const coachInput = showCoachPanel ? rootEl.querySelector('#coach-input') : null
  const coachSend = showCoachPanel ? rootEl.querySelector('#coach-send') : null
  const coachHint = showCoachPanel ? rootEl.querySelector('#coach-hint') : null
  const saveReflectionBtn = showCoachPanel ? rootEl.querySelector('#save-reflection-btn') : null
  const selfCheckBlock = rootEl.querySelector('#self-check-block')
  const selfCheckListEl = rootEl.querySelector('#self-check-list')
  const selfCheckStatusEl = rootEl.querySelector('#self-check-status')
  const selfCheckRefreshBtn = rootEl.querySelector('#self-check-refresh-btn')
  const saveSelfCheckBtn = rootEl.querySelector('#save-self-check-btn')
  const compareBtn = rootEl.querySelector('#compare-summary-btn')
  const compareModal = rootEl.querySelector('#compare-modal')
  const compareModalBody = rootEl.querySelector('#compare-modal-body')
  const compareModalStatus = rootEl.querySelector('#compare-modal-status')
  const compareRefreshBtn = rootEl.querySelector('#compare-refresh-btn')

  let lastExtractedText = ''
  let lastAnalysisData = null
  /** @type {File | null} */
  let lastPdfFile = null
  /** @type {{ role: 'user' | 'assistant'; content: string }[]} */
  let coachHistory = []
  /** @type {{ focus: string; question: string; answer: string }[]} */
  let selfCheckQuestions = []
  let selfCheckBusy = false
  /** @type {{ prosReview: any[]; consReview: any[]; lookAgain: string[]; nextStep: string } | null} */
  let lastCompareReview = null
  let compareBusy = false

  function canDownloadPdf() {
    if (lastPdfFile) return true
    if (lastAnalysisData && typeof lastAnalysisData === 'object' && lastAnalysisData.specPdfPath) {
      return true
    }
    return false
  }

  function refreshDownloadPdfBtn() {
    if (!downloadPdfBtn) return
    downloadPdfBtn.disabled = !canDownloadPdf()
  }

  function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'document.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleDownloadPdfClick() {
    if (!downloadPdfBtn) return
    if (lastPdfFile) {
      triggerBlobDownload(lastPdfFile, lastPdfFile.name || 'document.pdf')
      return
    }
    const storedPath = lastAnalysisData?.specPdfPath
    if (!storedPath) {
      alert('다운로드할 명세서 PDF가 없어요. 먼저 PDF를 업로드해 주세요.')
      return
    }
    const originalLabel = downloadPdfBtn.textContent
    downloadPdfBtn.disabled = true
    downloadPdfBtn.textContent = '불러오는 중…'
    try {
      const { downloadSpecPdfFromStorage } = await import('./activityStorage.js')
      const bytes = await downloadSpecPdfFromStorage(storedPath)
      if (!bytes) {
        alert('저장된 명세서 PDF를 가져올 수 없어요. 로그인 상태를 확인해 주세요.')
        return
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const fileName = lastAnalysisData?.specPdfFileName || 'document.pdf'
      triggerBlobDownload(blob, fileName)
    } catch (error) {
      console.error('명세서 PDF 다운로드 오류:', error)
      alert('명세서 PDF 다운로드 중 오류가 발생했어요.')
    } finally {
      downloadPdfBtn.textContent = originalLabel || '명세서 PDF 다운로드'
      refreshDownloadPdfBtn()
    }
  }

  function renderCoachMessages() {
    if (!coachMessagesEl) return
    coachMessagesEl.innerHTML = coachHistory
      .map((m) => {
        const roleClass =
          m.role === 'user' ? 'coach-msg coach-msg--user' : 'coach-msg coach-msg--assistant'
        const label = m.role === 'user' ? '나' : '발명 보조교사'
        const body = escapeHtml(m.content).replace(/\n/g, '<br>')
        return `<div class="${roleClass}"><span class="coach-msg-label">${label}</span><div class="coach-msg-body">${body}</div></div>`
      })
      .join('')
    coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight
  }

  function setCoachWelcome() {
    const intro = coachAnalysisReady()
      ? '안녕! 나는 발명 도우미야 🤖 나와 대화를 하고, 자신의 생각을 정리한다면, 명세서의 특징을 요약 정리 받을 수 있어!\n궁금한 거 있으면 편하게 물어봐! 쉽게 설명해 줄게!'
      : '안녕하세요, 발명 보조교사입니다. 지금은 아직 AI 요약 전이에요. 올려 주신 PDF에서 추출한 명세서 본문만 바탕으로 질문에 답해 드릴게요. 읽다가 어려운 부분이나 확인하고 싶은 점을 편하게 물어보세요.'
    coachHistory = [{ role: 'assistant', content: intro }]
    renderCoachMessages()
  }

  function countUserCoachTurns() {
    return coachHistory.filter((m) => m.role === 'user').length
  }

  function coachAnalysisReady() {
    return hasAnalysisContent(lastAnalysisData)
  }

  function coachPdfReady() {
    return !!lastExtractedText.trim()
  }

  function reflectionInputs() {
    return REFLECTION_FIELDS.map((field) => ({
      key: field.key,
      el: rootEl.querySelector(field.selector),
    }))
  }

  function isReflectionComplete() {
    if (!showCoachPanel) return true
    return reflectionInputs().every(({ el }) => !!el && !!el.value.trim())
  }

  function exploreCanRunAiAnalysis() {
    if (!showCoachPanel) return true
    if (coachAnalysisReady()) return true
    return countUserCoachTurns() >= 2 && isReflectionComplete()
  }

  function persistReflection() {
    if (!showCoachPanel) return
    const inputs = reflectionInputs()
    if (inputs.some(({ el }) => !el)) return
    try {
      const payload = {}
      for (const { key, el } of inputs) payload[key] = el.value
      localStorage.setItem(SPEC_EXPLORE_REFLECTION_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
    // 학생이 장단점을 고치면 이전 점검 결과는 더 이상 맞지 않는다
    lastCompareReview = null
    updateCoachUi()
    refreshSaveReflectionButton()
    refreshCompareBtn()
  }

  function refreshSaveReflectionButton() {
    if (!saveReflectionBtn) return
    saveReflectionBtn.disabled = !isReflectionComplete()
  }

  function getReflectionValues() {
    const values = {}
    for (const { key, el } of reflectionInputs()) values[key] = el?.value?.trim() || ''
    return values
  }

  async function saveReflectionAsPdfAndActivity() {
    if (!saveReflectionBtn) return
    if (!isReflectionComplete()) {
      alert('네 칸을 모두 채운 뒤에 저장할 수 있어요.')
      return
    }

    const values = getReflectionValues()
    const originalLabel = saveReflectionBtn.textContent
    saveReflectionBtn.disabled = true
    saveReflectionBtn.textContent = '저장 중…'

    try {
      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('spec_explore_reflection', {
        name: values.name,
        materials: values.materials,
        merits: values.merits,
        improvements: values.improvements,
      })

      alert('내 생각 정리가 저장되었어요!')
    } catch (error) {
      console.error('내 생각 정리 저장 오류:', error)
      alert('저장 중 오류가 발생했어요. 다시 시도해 주세요.')
    } finally {
      saveReflectionBtn.textContent = originalLabel || '내 생각 정리 저장하기'
      refreshSaveReflectionButton()
    }
  }

  function loadReflectionFromStorage() {
    if (!showCoachPanel || !exploreAllowsHydrateFromStorage(true)) return
    try {
      const r = localStorage.getItem(SPEC_EXPLORE_REFLECTION_KEY)
      if (!r) return
      const p = JSON.parse(r)
      for (const { key, el } of reflectionInputs()) {
        if (el && typeof p?.[key] === 'string') el.value = p[key]
      }
    } catch {
      /* ignore */
    }
  }

  function clearReflectionUiAndStorage() {
    if (!showCoachPanel) return
    for (const { el } of reflectionInputs()) {
      if (el) el.value = ''
    }
    try {
      localStorage.removeItem(SPEC_EXPLORE_REFLECTION_KEY)
    } catch {
      /* ignore */
    }
    lastCompareReview = null
    renderCompareReview()
    setCompareStatus('')
    refreshSaveReflectionButton()
    refreshCompareBtn()
  }

  function updateReflectionVisibility() {
    const block = rootEl.querySelector('#explore-reflection-block')
    if (!block) return
    let hasStored = false
    if (exploreAllowsHydrateFromStorage(true)) {
      try {
        const r = localStorage.getItem(SPEC_EXPLORE_REFLECTION_KEY)
        if (r) {
          const p = JSON.parse(r)
          hasStored = REFLECTION_FIELDS.some((field) => String(p?.[field.key] || '').trim())
        }
      } catch {
        /* ignore */
      }
    }
    block.hidden = countUserCoachTurns() < 2 && !hasStored
  }

  function setSelfCheckStatus(message, mode = 'info') {
    if (!selfCheckStatusEl) return
    selfCheckStatusEl.textContent = message || ''
    selfCheckStatusEl.dataset.mode = mode
    selfCheckStatusEl.hidden = !message
  }

  function isSelfCheckComplete() {
    return (
      selfCheckQuestions.length > 0 &&
      selfCheckQuestions.every((q) => String(q.answer || '').trim())
    )
  }

  function refreshSaveSelfCheckBtn() {
    if (!saveSelfCheckBtn) return
    saveSelfCheckBtn.disabled = !isSelfCheckComplete()
  }

  function handleSelfCheckAnswerInput(event) {
    const index = Number(event.target.dataset.index)
    if (!Number.isInteger(index) || !selfCheckQuestions[index]) return
    selfCheckQuestions[index].answer = event.target.value
    persistSelfCheck()
    refreshSaveSelfCheckBtn()
  }

  function renderSelfCheck() {
    if (!selfCheckListEl) return
    selfCheckListEl.innerHTML = selfCheckQuestions
      .map(
        (q, i) => `
        <div class="self-check-item">
          <span class="self-check-index">${i + 1}</span>
          <div class="self-check-body">
            ${q.focus ? `<span class="self-check-focus">${escapeHtml(q.focus)}</span>` : ''}
            <p class="self-check-question">${escapeHtml(q.question)}</p>
            <label class="sr-only" for="self-check-answer-${i}">${escapeHtml(q.question)}에 대한 내 생각</label>
            <textarea id="self-check-answer-${i}" class="self-check-answer" data-index="${i}" rows="3" placeholder="내 생각을 적어 보세요.">${escapeHtml(q.answer || '')}</textarea>
          </div>
        </div>`
      )
      .join('')

    for (const el of selfCheckListEl.querySelectorAll('.self-check-answer')) {
      el.addEventListener('input', handleSelfCheckAnswerInput)
    }
    refreshSaveSelfCheckBtn()
  }

  function showSelfCheckBlock() {
    if (selfCheckBlock) selfCheckBlock.hidden = false
  }

  function persistSelfCheck() {
    try {
      localStorage.setItem(SPEC_SELF_CHECK_KEY, JSON.stringify(selfCheckQuestions))
    } catch {
      /* ignore */
    }
  }

  function loadSelfCheckFromStorage() {
    try {
      const raw = localStorage.getItem(SPEC_SELF_CHECK_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      selfCheckQuestions = parsed
        .filter((q) => q && typeof q.question === 'string' && q.question.trim())
        .map((q) => ({
          focus: String(q.focus || '').trim(),
          question: q.question.trim(),
          answer: typeof q.answer === 'string' ? q.answer : '',
        }))
      if (selfCheckQuestions.length) {
        renderSelfCheck()
        showSelfCheckBlock()
      }
    } catch {
      /* ignore */
    }
  }

  function clearSelfCheck() {
    selfCheckQuestions = []
    renderSelfCheck()
    setSelfCheckStatus('')
    if (selfCheckBlock) selfCheckBlock.hidden = true
    try {
      localStorage.removeItem(SPEC_SELF_CHECK_KEY)
    } catch {
      /* ignore */
    }
  }

  async function generateSelfCheckQuestions({ manual = false } = {}) {
    if (selfCheckBusy) return
    if (!hasAnalysisContent(lastAnalysisData)) {
      setSelfCheckStatus('먼저 [명세서 분석하기]로 요약을 만들어 주세요.', 'warn')
      return
    }
    if (
      manual &&
      selfCheckQuestions.some((q) => String(q.answer || '').trim()) &&
      !confirm('질문을 새로 받으면 지금 적은 답변이 지워져요. 계속할까요?')
    ) {
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      showSelfCheckBlock()
      setSelfCheckStatus('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.', 'error')
      return
    }

    selfCheckBusy = true
    if (selfCheckRefreshBtn) selfCheckRefreshBtn.disabled = true
    showSelfCheckBlock()
    setSelfCheckStatus('질문을 만드는 중입니다…', 'info')

    try {
      const { interests, discomfort } = readSeedContext()
      const questions = await requestSelfCheckQuestions(
        apiKey,
        lastAnalysisData,
        interests,
        discomfort
      )
      selfCheckQuestions = questions.map((q) => ({ ...q, answer: '' }))
      persistSelfCheck()
      renderSelfCheck()
      setSelfCheckStatus('질문 3개가 도착했어요. 천천히 생각해서 답해 보세요.', 'success')
    } catch (error) {
      console.error('스스로 따져 보기 질문 생성 오류:', error)
      setSelfCheckStatus(
        error.message || '질문을 만들지 못했어요. [질문 다시 받기]를 눌러 주세요.',
        'error'
      )
    } finally {
      selfCheckBusy = false
      if (selfCheckRefreshBtn) selfCheckRefreshBtn.disabled = false
    }
  }

  async function saveSelfCheckAnswers() {
    if (!saveSelfCheckBtn) return
    if (!isSelfCheckComplete()) {
      alert('세 질문에 모두 답한 뒤에 저장할 수 있어요.')
      return
    }

    const originalLabel = saveSelfCheckBtn.textContent
    saveSelfCheckBtn.disabled = true
    saveSelfCheckBtn.textContent = '저장 중…'

    try {
      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('spec_self_check', {
        patentName: String(lastAnalysisData?.title || lastAnalysisData?.patentName || '').trim(),
        questions: selfCheckQuestions.map((q) => ({
          focus: q.focus,
          question: q.question,
          answer: String(q.answer || '').trim(),
        })),
      })
      setSelfCheckStatus('내 답변이 저장되었어요!', 'success')
    } catch (error) {
      console.error('스스로 따져 보기 답변 저장 오류:', error)
      setSelfCheckStatus('저장 중 오류가 발생했어요. 다시 시도해 주세요.', 'error')
    } finally {
      saveSelfCheckBtn.textContent = originalLabel || '내 답변 저장하기'
      refreshSaveSelfCheckBtn()
    }
  }

  function studentProsCons() {
    if (!showCoachPanel) return { pros: [], cons: [] }
    const values = getReflectionValues()
    return {
      pros: splitStudentItems(values.merits),
      cons: splitStudentItems(values.improvements),
    }
  }

  function compareReady() {
    if (!showCoachPanel || !hasAnalysisContent(lastAnalysisData)) return false
    const { pros, cons } = studentProsCons()
    return pros.length > 0 || cons.length > 0
  }

  function refreshCompareBtn() {
    if (!compareBtn) return
    const ready = compareReady()
    compareBtn.disabled = !ready
    compareBtn.title = ready
      ? '내가 쓴 장단점과 AI 요약을 비교해서 점검받기'
      : '[명세서 분석하기]로 요약을 만들고 「내 생각 정리」에 장점이나 단점을 적으면 눌러 볼 수 있어요.'
  }

  function setCompareStatus(message, mode = 'info') {
    if (!compareModalStatus) return
    compareModalStatus.textContent = message || ''
    compareModalStatus.dataset.mode = mode
    compareModalStatus.hidden = !message
  }

  function renderCompareReview() {
    if (!compareModalBody) return
    if (!lastCompareReview) {
      compareModalBody.innerHTML = ''
      return
    }

    const { prosReview = [], consReview = [], lookAgain = [], nextStep = '' } = lastCompareReview

    const reviewList = (items, emptyText) => {
      if (!Array.isArray(items) || items.length === 0) {
        return `<p class="compare-empty">${escapeHtml(emptyText)}</p>`
      }
      return items
        .map((r) => {
          const levelClass = COMPARE_LEVEL_CLASS[r.level] || 'compare-level--maybe'
          return `
          <div class="compare-item">
            <div class="compare-item-head">
              <span class="compare-item-text">${escapeHtml(r.item || '')}</span>
              <span class="compare-level ${levelClass}">${escapeHtml(r.level || '')}</span>
            </div>
            <p class="compare-item-comment">${escapeHtml(r.comment || '')}</p>
          </div>`
        })
        .join('')
    }

    const lookAgainHtml =
      Array.isArray(lookAgain) && lookAgain.length
        ? `<section class="compare-section">
            <h4>다시 읽어 보면 좋을 곳</h4>
            <ul class="compare-look-again">${lookAgain
              .map((t) => `<li>${escapeHtml(t)}</li>`)
              .join('')}</ul>
          </section>`
        : ''

    const nextStepHtml = nextStep
      ? `<section class="compare-next-step">
          <h4>다음에 할 일</h4>
          <p>${escapeHtml(nextStep)}</p>
        </section>`
      : ''

    compareModalBody.innerHTML = `
      <section class="compare-section">
        <h4>내가 쓴 장점</h4>
        ${reviewList(prosReview, '아직 장점을 적지 않았어요.')}
      </section>
      <section class="compare-section">
        <h4>내가 쓴 단점</h4>
        ${reviewList(consReview, '아직 단점을 적지 않았어요.')}
      </section>
      ${lookAgainHtml}
      ${nextStepHtml}
    `
  }

  function handleCompareKeydown(event) {
    if (event.key === 'Escape') closeCompareModal()
  }

  function openCompareModal() {
    if (!compareModal) return
    compareModal.hidden = false
    document.addEventListener('keydown', handleCompareKeydown)
    const closeBtn = compareModal.querySelector('.compare-modal-close')
    if (closeBtn) closeBtn.focus()
    if (!lastCompareReview && !compareBusy) runCompareReview()
  }

  function closeCompareModal() {
    if (!compareModal) return
    compareModal.hidden = true
    document.removeEventListener('keydown', handleCompareKeydown)
    if (compareBtn && !compareBtn.disabled) compareBtn.focus()
  }

  async function runCompareReview() {
    if (compareBusy) return
    if (!compareReady()) {
      setCompareStatus(
        '먼저 [명세서 분석하기]로 요약을 만들고, 「내 생각 정리」에 장점이나 단점을 적어 주세요.',
        'warn'
      )
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      setCompareStatus('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.', 'error')
      return
    }

    compareBusy = true
    if (compareRefreshBtn) compareRefreshBtn.disabled = true
    setCompareStatus('내가 쓴 내용을 명세서 요약과 견주어 보는 중입니다…', 'info')

    try {
      const { pros, cons } = studentProsCons()
      lastCompareReview = await requestSummaryCompare(apiKey, lastAnalysisData, pros, cons)
      renderCompareReview()
      setCompareStatus('')
    } catch (error) {
      console.error('장단점 점검 오류:', error)
      lastCompareReview = null
      renderCompareReview()
      setCompareStatus(
        error.message || '점검 결과를 받지 못했어요. [다시 점검받기]를 눌러 주세요.',
        'error'
      )
    } finally {
      compareBusy = false
      if (compareRefreshBtn) compareRefreshBtn.disabled = false
    }
  }

  function refreshExploreAnalyzeButton() {
    if (!analyzeBtn) return
    if (!lastExtractedText.trim()) {
      analyzeBtn.disabled = true
      return
    }
    if (showCoachPanel && !exploreCanRunAiAnalysis()) {
      analyzeBtn.disabled = true
      return
    }
    analyzeBtn.disabled = false
  }

  function updateCoachUi() {
    if (!showCoachPanel || !coachInput || !coachSend || !coachHint) return
    const pdfOk = coachPdfReady()
    coachInput.disabled = !pdfOk
    coachSend.disabled = !pdfOk
    if (!pdfOk) {
      coachHint.textContent =
        '먼저 위쪽에서 PDF를 업로드하면, 업로드한 명세서 본문을 바탕으로 대화할 수 있어요.'
    } else if (!coachAnalysisReady() && countUserCoachTurns() < 2) {
      coachHint.textContent =
        '보조교사와 두 번 이상 대화한 뒤, 오른쪽에 「내 생각 정리」 칸이 열려요.'
    } else if (!coachAnalysisReady() && !isReflectionComplete()) {
      coachHint.textContent =
        '오른쪽 「내 생각 정리」 네 칸을 모두 채우면 [명세서 분석하기]를 눌러 AI 요약을 볼 수 있어요.'
    } else {
      coachHint.textContent = ''
    }
    updateReflectionVisibility()
    refreshExploreAnalyzeButton()
  }

  async function sendCoachMessage() {
    const text = coachInput?.value.trim()
    if (!text || !coachPdfReady()) return

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      coachHistory.push({ role: 'user', content: text })
      if (coachInput) coachInput.value = ''
      coachHistory.push({
        role: 'assistant',
        content: '.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.',
      })
      renderCoachMessages()
      return
    }

    coachHistory.push({ role: 'user', content: text })
    if (coachInput) coachInput.value = ''
    renderCoachMessages()

    if (coachSend) coachSend.disabled = true
    const prevLabel = coachSend?.textContent
    if (coachSend) coachSend.textContent = '응답 중…'

    try {
      const reply = await requestCoachReply(apiKey, lastAnalysisData, lastExtractedText, coachHistory)
      coachHistory.push({ role: 'assistant', content: reply })
      renderCoachMessages()
    } catch (error) {
      console.error(error)
      coachHistory.push({
        role: 'assistant',
        content: error.message || '응답을 받지 못했습니다. 다시 시도해 주세요.',
      })
      renderCoachMessages()
    } finally {
      if (coachSend) {
        coachSend.disabled = false
        if (prevLabel) coachSend.textContent = prevLabel
      }
      updateCoachUi()
    }
  }

  try {
    if (!exploreAllowsHydrateFromStorage(showCoachPanel)) {
      /* 탐색하기: 과거 활동 불러오기 전·이번 탭에서 작업 시작 전에는 localStorage 분석 복원 안 함 */
    } else {
      const stored = localStorage.getItem('analysisData')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (hasAnalysisContent(parsed)) {
          lastAnalysisData = parsed
          renderAnalysis(analysisGrid, parsed)
          if (goToIdeaBtn) goToIdeaBtn.disabled = false
          try {
            const textStored = localStorage.getItem('extractedText')
            if (textStored && typeof textStored === 'string') {
              lastExtractedText = textStored
            }
          } catch {
            /* ignore */
          }
          setAnalysisStatus(
            '저장된 명세서 분석 결과를 불러왔습니다. 새 PDF를 올리면 다시 분석할 수 있어요.',
            'success'
          )
          loadSelfCheckFromStorage()
          refreshCompareBtn()
        }
      }
    }
  } catch {
    /* ignore */
  }

  refreshDownloadPdfBtn()

  function setAnalysisStatus(message, mode = 'info') {
    if (!analysisStatusEl) return
    if (message.includes('<div') || message.includes('<span')) {
      analysisStatusEl.innerHTML = message
    } else {
      analysisStatusEl.textContent = message
    }
    analysisStatusEl.dataset.mode = mode
  }

  function toggleAnalysis(isBusy) {
    if (!analyzeBtn) return
    if (isBusy) {
      analyzeBtn.disabled = true
    } else {
      refreshExploreAnalyzeButton()
    }
    if (isBusy && goToIdeaBtn) goToIdeaBtn.disabled = true
  }

  if (pdfInput) {
    pdfInput.addEventListener('change', async () => {
      const file = pdfInput.files?.[0]

      if (!file) {
        setAnalysisStatus('PDF를 다시 선택해 주세요.')
        if (analyzeBtn) analyzeBtn.disabled = true
        if (goToIdeaBtn) goToIdeaBtn.disabled = true
        lastExtractedText = ''
        lastAnalysisData = null
        lastPdfFile = null
        clearSelfCheck()
        if (showCoachPanel) {
          coachHistory = []
          renderCoachMessages()
          clearReflectionUiAndStorage()
          updateCoachUi()
        }
        refreshDownloadPdfBtn()
        return
      }

      setAnalysisStatus('텍스트를 추출하는 중입니다...', 'info')
      if (analyzeBtn) analyzeBtn.disabled = true
      if (goToIdeaBtn) goToIdeaBtn.disabled = true
      lastAnalysisData = null
      lastPdfFile = file
      clearSelfCheck()
      refreshDownloadPdfBtn()
      if (showCoachPanel) {
        coachHistory = []
        renderCoachMessages()
        clearReflectionUiAndStorage()
        updateCoachUi()
      }

      try {
        lastExtractedText = await extractTextFromPdfFile(file)

        if (!lastExtractedText) {
          setAnalysisStatus('PDF에서 텍스트를 추출할 수 없습니다. 스캔 PDF인지 확인해 주세요.', 'warn')
          if (analyzeBtn) analyzeBtn.disabled = true
          if (showCoachPanel) updateCoachUi()
          return
        }

        setAnalysisStatus(
          showCoachPanel
            ? '텍스트 추출 완료! 왼쪽에서 발명 보조교사와 대화하고, 오른쪽의 「내 생각 정리」를 채운 뒤 아래 [명세서 분석하기]를 눌러 주세요.'
            : '텍스트 추출 완료! [명세서 분석하기]를 눌러 요약을 받아 보세요.',
          'success'
        )
        if (showCoachPanel) {
          markExploreHydrateAllowed()
          setCoachWelcome()
          updateCoachUi()
        } else if (analyzeBtn) {
          analyzeBtn.disabled = false
        }
      } catch (error) {
        console.error(error)
        setAnalysisStatus('PDF 텍스트 추출에 실패했습니다. 다른 파일로 시도해 주세요.', 'error')
        if (analyzeBtn) analyzeBtn.disabled = true
        if (showCoachPanel) updateCoachUi()
      }
    })
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      if (!lastExtractedText.trim()) {
        setAnalysisStatus('먼저 PDF를 업로드해 텍스트를 추출해 주세요.', 'warn')
        return
      }

      if (showCoachPanel && !exploreCanRunAiAnalysis()) {
        setAnalysisStatus(
          '먼저 왼쪽에서 보조교사와 두 번 이상 대화한 뒤, 오른쪽 「내 생각 정리」 네 칸을 모두 채워 주세요.',
          'warn'
        )
        return
      }

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY

      if (!apiKey) {
        setAnalysisStatus('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.', 'error')
        return
      }

      toggleAnalysis(true)
      analysisStatusEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div class="spinner" style="width: 20px; height: 20px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>분석 중입니다…</span>
    </div>
  `

      if (!document.querySelector('#spinner-style')) {
        const style = document.createElement('style')
        style.id = 'spinner-style'
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
        document.head.appendChild(style)
      }

      try {
        const studentInventionName = showCoachPanel ? getReflectionValues().name : ''
        const analysis = await requestAnalysis(apiKey, lastExtractedText, studentInventionName)

        let specPdfPath = null
        let specPdfFileName = null
        try {
          if (lastPdfFile && localStorage.getItem('userId')) {
            const { saveSpecPdfToStorage } = await import('./activityStorage.js')
            specPdfPath = await saveSpecPdfToStorage(lastPdfFile, lastPdfFile.name)
            if (specPdfPath) specPdfFileName = lastPdfFile.name
          }
        } catch (err) {
          console.warn('명세서 PDF Storage 저장 실패:', err)
        }

        const { saveStudentActivity, ANALYSIS_EXTRACT_SNAPSHOT_MAX_CHARS } = await import(
          './activityStorage.js'
        )
        const extractedTextSnapshot =
          lastExtractedText.length > ANALYSIS_EXTRACT_SNAPSHOT_MAX_CHARS
            ? lastExtractedText.slice(0, ANALYSIS_EXTRACT_SNAPSHOT_MAX_CHARS)
            : lastExtractedText

        const enriched = {
          ...analysis,
          ...legacyAnalysisFields(analysis),
          extractedTextSnapshot,
          ...(specPdfPath
            ? { specPdfPath, specPdfFileName: specPdfFileName || 'document.pdf' }
            : {}),
        }

        lastAnalysisData = enriched
        renderAnalysis(analysisGrid, enriched)
        refreshDownloadPdfBtn()

        localStorage.setItem('analysisData', JSON.stringify(enriched))
        localStorage.setItem('extractedText', lastExtractedText)

        await saveStudentActivity('analysis', enriched)

        if (goToIdeaBtn) goToIdeaBtn.disabled = false
        setAnalysisStatus(
          '분석 완료! 아래 「스스로 따져 보기」 질문에 답해 본 뒤 아이디어 창출 단계로 이동해 보세요.',
          'success'
        )
        if (showCoachPanel) {
          markExploreHydrateAllowed()
          updateCoachUi()
          updateReflectionVisibility()
        }

        lastCompareReview = null
        refreshCompareBtn()

        selfCheckQuestions = []
        renderSelfCheck()
        await generateSelfCheckQuestions()
      } catch (error) {
        console.error(error)
        setAnalysisStatus(error.message || '분석 중 오류가 발생했습니다.', 'error')
        if (goToIdeaBtn) goToIdeaBtn.disabled = true
      } finally {
        toggleAnalysis(false)
      }
    })
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      handleDownloadPdfClick()
    })
  }

  if (selfCheckRefreshBtn) {
    selfCheckRefreshBtn.addEventListener('click', () => {
      generateSelfCheckQuestions({ manual: true })
    })
  }

  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      openCompareModal()
    })
  }

  if (compareModal) {
    compareModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-compare-close]')) closeCompareModal()
    })
  }

  if (compareRefreshBtn) {
    compareRefreshBtn.addEventListener('click', () => {
      runCompareReview()
    })
  }

  if (saveSelfCheckBtn) {
    saveSelfCheckBtn.addEventListener('click', () => {
      saveSelfCheckAnswers()
    })
  }

  if (goToIdeaBtn) {
    goToIdeaBtn.addEventListener('click', () => {
      if (!lastAnalysisData) {
        setAnalysisStatus('아이디어 창출을 위해 먼저 분석을 완료해 주세요.', 'warn')
        return
      }

      if (window.parent !== window) {
        try {
          const parentWindow = window.parent
          const activityFrame = parentWindow.document.querySelector('#activity-frame')
          const legacyIdeaFrame = parentWindow.document.querySelector('#idea-frame')
          const target = activityFrame || legacyIdeaFrame

          if (target) {
            target.src = 'idea.html'
            const placeholder = parentWindow.document.querySelector('#activity-placeholder')
            if (placeholder) placeholder.hidden = true
            target.hidden = false
            parentWindow.document.querySelectorAll('.activity-nav-btn').forEach((b) => {
              b.classList.toggle('is-active', b.getAttribute('data-activity-src') === 'idea.html')
            })
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setAnalysisStatus('아이디어 창출 단계로 이동했습니다.', 'success')
            return
          }
        } catch (error) {
          console.error('iframe 접근 오류:', error)
        }
        window.open('idea.html', '_blank')
      } else {
        window.location.href = 'idea.html'
      }
    })
  }

  if (showCoachPanel) {
    loadReflectionFromStorage()
    if (coachPdfReady() || coachAnalysisReady()) {
      setCoachWelcome()
    }
    for (const { el } of reflectionInputs()) {
      if (el) el.addEventListener('input', persistReflection)
    }
    if (saveReflectionBtn) {
      saveReflectionBtn.addEventListener('click', () => {
        saveReflectionAsPdfAndActivity()
      })
    }
    refreshSaveReflectionButton()
    refreshCompareBtn()
    updateCoachUi()
    if (coachSend) {
      coachSend.addEventListener('click', () => {
        sendCoachMessage()
      })
    }
    if (coachInput) {
      coachInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          sendCoachMessage()
        }
      })
    }
  }

  listenForWorkbenchFlushRequest(async () => {
    if (!lastAnalysisData || typeof lastAnalysisData !== 'object') return
    try {
      let payload = lastAnalysisData
      if (lastPdfFile && localStorage.getItem('userId') && !lastAnalysisData.specPdfPath) {
        try {
          const { saveSpecPdfToStorage } = await import('./activityStorage.js')
          const p = await saveSpecPdfToStorage(lastPdfFile, lastPdfFile.name)
          if (p) {
            payload = {
              ...lastAnalysisData,
              specPdfPath: p,
              specPdfFileName: lastPdfFile.name,
            }
            lastAnalysisData = payload
          }
        } catch (_) {
          /* ignore */
        }
      }
      localStorage.setItem('analysisData', JSON.stringify(payload))
      if (lastExtractedText) localStorage.setItem('extractedText', lastExtractedText)
    } catch (_) {}
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createAnalysisCard(title, useList = false) {
  const placeholder = useList ? '<ul><li>결과 대기</li></ul>' : '<div class="value">결과 대기</div>'

  return `
    <article class="analysis-card">
      <h3>${title}</h3>
      ${placeholder}
    </article>
  `
}

function renderAnalysis(analysisGrid, data) {
  if (!analysisGrid) return
  const {
    title = '',
    field = '',
    background = '',
    problem = '',
    solution = '',
    components = [],
    patentName = '',
    features = [],
  } = data || {}

  analysisGrid.innerHTML = [
    renderCardContent('발명품의 명칭', withTextFallback(title || patentName)),
    renderCardContent('기술 분야', withTextFallback(field)),
    renderCardContent('배경 기술', withTextFallback(background)),
    renderCardContent('해결하고자 하는 과제', withTextFallback(problem)),
    renderCardContent('과제를 해결하기 위한 수단', withTextFallback(solution)),
    renderCardContent(
      '주요 구성 요소',
      withArrayFallback(Array.isArray(components) && components.length ? components : features)
    ),
  ].join('')
}

function renderCardContent(title, value) {
  const body = Array.isArray(value)
    ? `<ul>${value.map((item) => `<li>${sanitize(item)}</li>`).join('')}</ul>`
    : `<div class="value">${sanitize(value)}</div>`

  return `
    <article class="analysis-card">
      <h3>${title}</h3>
      ${body}
    </article>
  `
}

function hasAnalysisContent(data) {
  if (!data || typeof data !== 'object') return false
  const texts = [data.title, data.field, data.solution, data.patentName, data.applicationNumber]
  if (texts.some((t) => String(t || '').trim())) return true
  return [data.components, data.features].some((list) => Array.isArray(list) && list.length > 0)
}

/** 아이디어 창출·교사 화면·활동 보고서가 아직 읽는 예전 필드 이름을 함께 채워 준다. */
function legacyAnalysisFields(analysis) {
  const { title = '', solution = '', components = [] } = analysis || {}
  const componentList = Array.isArray(components)
    ? components.map((c) => String(c || '').trim()).filter(Boolean)
    : []
  const solutionText = String(solution || '').trim()

  return {
    patentName: String(title || '').trim(),
    applicationNumber: '',
    features: componentList.length ? componentList : solutionText ? [solutionText] : [],
    materials: [],
  }
}

function withTextFallback(content) {
  if (typeof content === 'string' && content.trim()) return content.trim()
  if (Array.isArray(content) && content.length) return content.join(' ')
  return '정보 없음'
}

function withArrayFallback(content) {
  if (Array.isArray(content) && content.length > 0) {
    return content
  }

  if (typeof content === 'string' && content.trim()) {
    return [content.trim()]
  }

  return ['정보 없음']
}

function sanitize(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function requestAnalysis(apiKey, text, patentTitle = '') {
  const patentText = typeof text === 'string' ? text : ''

  const prompt = `너는 특허 명세서를 중학생이 이해하기 쉽게 다섯 가지 항목으로 정리해 주는 발명 보조교사야.
학생은 나중에 자기 발명으로 똑같은 다섯 항목을 직접 쓰게 돼. 그러니 각 항목이 무엇을 담는 칸인지
학생이 자연스럽게 익힐 수 있도록 정리해 줘.

[학생이 고른 발명]
${patentTitle || '(정보 없음)'}

[명세서 본문]
${patentText}

[정리할 다섯 가지 항목]
1. 발명품의 명칭 — 이 발명을 뭐라고 부르는가
2. 기술 분야 — 어떤 분야에 쓰이는 기술인가
3. 배경 기술 — 이 발명이 나오기 전에는 어떤 방법을 썼고, 거기에 어떤 아쉬움이 있었는가
4. 해결하고자 하는 과제 — 이 발명이 없애려고 하는 불편함이나 문제는 무엇인가
5. 과제를 해결하기 위한 수단 — 그 문제를 어떤 방법과 구조로 해결했는가

[정리 규칙 — 매우 중요]
- 위 [명세서 본문]에 있는 내용만 써. 명세서에 없는 사실을 절대 만들면 안 돼.
- 명세서에 해당 내용이 없으면 문자열 항목은 빈 문자열("")로, 목록 항목은 빈 배열([])로 두고,
  없는 내용을 추측해서 채우지 마.
- 중학교 3학년이 이해할 수 있는 쉬운 말로 바꿔서 써.
  어려운 전문 용어나 기술 용어가 나오면 괄호 안에 쉬운 설명을 달아 줘.
  · 예: "폴리머(플라스틱 같은 재료)", "전도성(전기가 잘 통하는 성질)"
- 긴 문장은 짧게 나눠서 써. 한 문장은 40자 이내로.
- 이 발명의 장점이나 단점은 쓰지 마. 그건 학생이 직접 찾을 일이야.
${KOREAN_ONLY}
- 모든 문장은 존댓말로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "title": "발명품의 명칭. 명세서에 적힌 이름을 쉬운 말로",
  "field": "기술 분야. 1~2문장",
  "background": "배경 기술. 이전 방법과 그 아쉬움. 1~3문장",
  "problem": "해결하고자 하는 과제. 1~2문장",
  "solution": "과제를 해결하기 위한 수단. 1~3문장",
  "components": ["해결 수단을 이루는 주요 부분과 그 역할", "..."]
}`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    const msg =
      payload?.error?.message ||
      `API 오류 (${response.status}) - ${response.statusText}`
    throw new Error(msg)
  }

  const result = await response.json()
  const aiText = extractAiText(result)

  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  return parseAiJson(aiText)
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractAiText(result) {
  if (!result) return null

  if (Array.isArray(result.output)) {
    for (const block of result.output) {
      if (!Array.isArray(block?.content)) continue
      for (const piece of block.content) {
        if (piece?.type === 'output_text') {
          if (Array.isArray(piece.text)) {
            return piece.text.join('')
          }
          return piece.text
        }
      }
    }
  }

  if (Array.isArray(result.output_text) && result.output_text.length > 0) {
    return result.output_text[0]
  }

  return result?.choices?.[0]?.message?.content
}

function parseAiJson(rawText) {
  if (!rawText) {
    throw new Error('AI 응답이 비어 있습니다.')
  }

  const trimmed = rawText.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed

  const firstObject = extractFirstJson(candidate)

  try {
    return JSON.parse(firstObject)
  } catch (error) {
    console.error('JSON parse error', error, rawText)
    throw new Error('AI 응답을 JSON으로 해석하지 못했습니다.')
  }
}

function extractFirstJson(text) {
  const openIndex = text.indexOf('{')
  const closeIndex = text.lastIndexOf('}')

  if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) {
    return text
  }

  return text.slice(openIndex, closeIndex + 1)
}

/**
 * @param {string} apiKey
 * @param {object | null} analysisData
 * @param {string} specExtractedText
 * @param {{ role: 'user' | 'assistant'; content: string }[]} history
 */
async function requestCoachReply(apiKey, analysisData, specExtractedText, history) {
  const last = history[history.length - 1]
  if (!last || last.role !== 'user') {
    throw new Error('대화 상태가 올바르지 않습니다.')
  }

  const { title = '', patentName = '' } = analysisData || {}
  const patentTitle = String(title || patentName || '').trim()

  const rawSpec = typeof specExtractedText === 'string' ? specExtractedText.trim() : ''
  let patentText
  if (rawSpec) {
    patentText =
      rawSpec.length > COACH_SPEC_MAX_CHARS
        ? `${rawSpec.slice(0, COACH_SPEC_MAX_CHARS)}\n(참고: 앞부분 ${COACH_SPEC_MAX_CHARS.toLocaleString()}자만 포함)`
        : rawSpec
  } else {
    patentText = '본문 텍스트가 없습니다. 학생에게 PDF를 다시 업로드하라고 안내하세요.'
  }

  const question = last.content

  const conversationHistory = history
    .slice(0, -1)
    .map((h) => {
      if (h.role === 'user') return `학생: ${h.content}`
      if (h.role === 'assistant') return `발명 보조교사: ${h.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')

  const previousTurns = conversationHistory ? `\n[이전 대화]\n${conversationHistory}\n` : ''

  const fullPrompt = `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 직접 고른 특허 명세서를 읽다가 막힌 부분을 물어보면, 명세서 내용을 근거로 쉽게 풀어서 설명해 줘.

[학생이 고른 발명]
${patentTitle || '(정보 없음)'}

[명세서 본문]
${patentText}
${previousTurns}
[학생의 질문]
${question}

[답변 규칙 — 매우 중요]
- 위 [명세서 본문]에 있는 내용만 근거로 답해. 명세서에 없는 내용은 지어내지 마.
- 인터넷을 찾아보라거나 책을 읽어 보라고 하지 마. 명세서 안에서만 설명해.
- 명세서에 답이 없으면 "이 명세서에는 그 내용이 나와 있지 않아요"라고 솔직하게 말하고,
  대신 명세서의 어느 부분을 보면 비슷한 이야기가 있는지 알려 줘.
- 중학교 3학년이 이해할 수 있는 말로 설명해.
  어려운 전문 용어나 기술 용어가 나오면 괄호 안에 쉬운 설명을 달아 줘.
  · 예: "폴리머(플라스틱 같은 재료)", "전도성(전기가 잘 통하는 성질)"
- 긴 문장은 짧게 나눠서 써.
${LEVEL_ADJUST}
- 학생 대신 이 발명의 장점이나 단점을 정리해 주지 마. 그건 학생이 직접 할 일이야.
- 오늘 할 일은 "명세서 읽고 이해하기"까지야. 새 아이디어를 만들거나 도면을 그리는 이야기는 하지 마.
${KOREAN_ONLY}
- 답변은 존댓말로, 3~5문장 안에서 간결하게 써.`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: fullPrompt }],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    const msg =
      payload?.error?.message || `API 오류 (${response.status}) - ${response.statusText}`
    throw new Error(msg)
  }

  const result = await response.json()
  const aiText = extractAiText(result)

  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  return aiText.trim()
}

function readSeedContext() {
  try {
    const raw = localStorage.getItem(SEED_DRAFT_KEY)
    if (!raw) return { interests: [], discomfort: '' }
    const parsed = JSON.parse(raw)
    const interests = Array.isArray(parsed?.interests)
      ? parsed.interests.map((w) => String(w || '').trim()).filter(Boolean)
      : []
    const discomfort = typeof parsed?.discomfort === 'string' ? parsed.discomfort.trim() : ''
    return { interests, discomfort }
  } catch {
    return { interests: [], discomfort: '' }
  }
}

function summaryBlock(summary) {
  const {
    title = '',
    field = '',
    background = '',
    problem = '',
    solution = '',
    components = [],
  } = summary || {}
  const componentText = Array.isArray(components)
    ? components.map((c) => String(c || '').trim()).filter(Boolean).join(' / ')
    : String(components || '').trim()

  return [
    `- 발명품의 명칭: ${title || '(없음)'}`,
    `- 기술 분야: ${field || '(없음)'}`,
    `- 배경 기술: ${background || '(없음)'}`,
    `- 해결하고자 하는 과제: ${problem || '(없음)'}`,
    `- 과제를 해결하기 위한 수단: ${solution || '(없음)'}`,
    `- 주요 구성 부분: ${componentText || '(없음)'}`,
  ].join('\n')
}

/**
 * @param {string} apiKey
 * @param {object | null} summary
 * @param {string[]} interests
 * @param {string} discomfort
 */
async function requestSelfCheckQuestions(apiKey, summary, interests, discomfort) {
  const prompt = `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 방금 특허 명세서를 읽고 그 발명을 이해했어. 이제 학생이 그 발명을 그냥 받아들이지 않고
"정말 좋기만 할까?" 하고 스스로 따져 볼 수 있도록, 생각을 여는 질문 3개를 만들어 줘.

[학생이 정리한 명세서 요약]
${summaryBlock(summary)}

[학생의 관심사와 불편함]
- 관심사: ${(interests || []).join(', ') || '(없음)'}
- 불편함: ${discomfort || '(없음)'}

[질문 규칙 — 매우 중요]
- 반드시 질문만 만들어. 단점이나 문제점을 네가 직접 말하지 마.
  답, 예시 답안, 힌트의 정답도 절대 알려 주지 마. 학생이 스스로 찾아야 해.
- 3개 질문은 각각 다른 것을 따져 보게 해.
  1번은 사용 상황 — 이 발명을 실제로 써 보면 어떤 점이 불편할지
  2번은 작동 조건 — 어떤 상황이나 환경에서는 제대로 되지 않을지
  3번은 사용 대상 — 누가 쓰기에는 어려울지
- 위 요약의 [배경 기술], [과제를 해결하기 위한 수단], [주요 구성 부분]에 나온 말을
  질문 안에 직접 넣어서, 이 발명에만 해당하는 구체적인 질문으로 만들어.
  어떤 발명에나 쓸 수 있는 일반적인 질문은 안 돼.
- 한 질문은 한 문장, 45자 이내로 짧게.
- "예/아니오"로 끝나는 질문 대신, 이유를 말하게 하는 질문으로 만들어.
- 오늘 할 일은 "이 발명을 따져 보기"까지야. 새 아이디어를 만들어 보라고 하지 마.
${KOREAN_ONLY}
- 질문은 존댓말로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "questions": [
    { "focus": "사용 상황", "question": "질문 한 문장" },
    { "focus": "작동 조건", "question": "질문 한 문장" },
    { "focus": "사용 대상", "question": "질문 한 문장" }
  ]
}`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    throw new Error(
      payload?.error?.message || `API 오류 (${response.status}) - ${response.statusText}`
    )
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  const parsed = parseAiJson(aiText)
  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions
        .filter((q) => q && typeof q.question === 'string' && q.question.trim())
        .slice(0, 3)
        .map((q) => ({
          focus: String(q.focus || '').trim(),
          question: q.question.trim(),
        }))
    : []

  if (questions.length === 0) {
    throw new Error('질문을 받지 못했어요. [질문 다시 받기]를 눌러 주세요.')
  }

  return questions
}

/** 학생이 한 칸에 여러 줄로 적은 내용을 항목별로 나눈다. */
function splitStudentItems(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

/**
 * @param {string} apiKey
 * @param {object | null} summary
 * @param {string[]} pros
 * @param {string[]} cons
 */
async function requestSummaryCompare(apiKey, summary, pros, cons) {
  const prompt = `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 특허 명세서를 읽고 스스로 정리한 장점과 단점을, 명세서 내용과 견주어 점검해 줘.

[명세서 요약]
${summaryBlock(summary)}

[학생이 쓴 장점]
${(pros || []).map((p, i) => `${i + 1}. ${p}`).join('\n') || '(작성하지 않음)'}

[학생이 쓴 단점]
${(cons || []).map((c, i) => `${i + 1}. ${c}`).join('\n') || '(작성하지 않음)'}

[점검 규칙 — 매우 중요]
- 학생이 쓴 장점과 단점을 하나씩 보고, 명세서에 근거가 있는지 확인해서
  "명세서에 있어요 / 명세서에는 없지만 생각해 볼 만해요 / 명세서 내용과 달라요" 중 하나로 표시해 줘.
  그리고 왜 그렇게 봤는지 한 문장으로 설명해.
- "명세서 내용과 달라요"일 때도 틀렸다고 나무라지 말고, 명세서의 어느 부분을 다시 보면 좋을지만 알려 줘.
- 명세서에는 나와 있는데 학생이 아직 쓰지 않은 것이 있으면, 그 내용을 대신 써 주지 마.
  대신 "명세서에서 ○○ 부분을 다시 읽어 보면 아직 적지 않은 좋은 점이 하나 더 보일 거예요"처럼
  어디를 볼지만 알려 줘. 최대 2개까지만.
- 학생이 단점을 하나도 쓰지 않았어도 단점을 대신 말해 주지 마. 어디를 다시 볼지만 알려 줘.
${LEVEL_ADJUST}
- 점수, 등급, 순위, 몇 개 맞았는지는 말하지 마.
- 오늘 할 일은 "장단점 정리하기"까지야. 새 아이디어를 만들어 보라고 하지 마.
${KOREAN_ONLY}
- 모든 문장은 존댓말로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "prosReview": [
    { "item": "학생이 쓴 장점 그대로", "level": "명세서에 있어요", "comment": "한 문장 설명" }
  ],
  "consReview": [
    { "item": "학생이 쓴 단점 그대로", "level": "명세서에는 없지만 생각해 볼 만해요", "comment": "한 문장 설명" }
  ],
  "lookAgain": ["다시 읽어 볼 곳 안내 한 문장", "..."],
  "nextStep": "다음에 할 일 한 문장"
}`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    throw new Error(
      payload?.error?.message || `API 오류 (${response.status}) - ${response.statusText}`
    )
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  const parsed = parseAiJson(aiText)
  const reviewList = (list) =>
    Array.isArray(list)
      ? list
          .filter((r) => r && (r.item || r.comment))
          .map((r) => ({
            item: String(r.item || '').trim(),
            level: String(r.level || '').trim(),
            comment: String(r.comment || '').trim(),
          }))
      : []

  const review = {
    prosReview: reviewList(parsed?.prosReview),
    consReview: reviewList(parsed?.consReview),
    lookAgain: Array.isArray(parsed?.lookAgain)
      ? parsed.lookAgain.map((t) => String(t || '').trim()).filter(Boolean)
      : [],
    nextStep: String(parsed?.nextStep || '').trim(),
  }

  if (
    review.prosReview.length === 0 &&
    review.consReview.length === 0 &&
    review.lookAgain.length === 0
  ) {
    throw new Error('점검 결과가 비어 있어요. [다시 점검받기]를 눌러 주세요.')
  }

  return review
}

export function generateAnalysisPdf(analysis) {
  const {
    title = '',
    field = '',
    background = '',
    problem = '',
    solution = '',
    components = [],
    patentName = '',
    features = [],
  } = analysis || {}

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  let yPos = margin

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('명세서 분석 결과', margin, yPos)
  yPos += 15

  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  const formatArray = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return '정보 없음'
    return arr.filter((item) => item && item.trim()).join('\n• ')
  }

  const formatText = (text) => {
    if (!text || (typeof text === 'string' && !text.trim())) return '정보 없음'
    return String(text)
  }

  const componentList =
    Array.isArray(components) && components.length ? components : features

  const sections = [
    { heading: '1. 발명품의 명칭', body: formatText(title || patentName) },
    { heading: '2. 기술 분야', body: formatText(field) },
    { heading: '3. 배경 기술', body: formatText(background) },
    { heading: '4. 해결하고자 하는 과제', body: formatText(problem) },
    { heading: '5. 과제를 해결하기 위한 수단', body: formatText(solution) },
    { heading: '6. 주요 구성 요소', body: `• ${formatArray(componentList)}` },
  ]

  sections.forEach((section, index) => {
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      yPos = margin
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(section.heading, margin, yPos)
    yPos += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(section.body, maxWidth)
    doc.text(lines, margin + 5, yPos)
    yPos += lines.length * 6 + (index === sections.length - 1 ? 0 : 10)
  })

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const fileName = `${year}-${month}-${day}-분석결과.pdf`
  doc.save(fileName)
}
