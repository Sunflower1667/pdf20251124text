import './student1.css'
import { extractTextFromPdfFile } from './pdfSpecExtract.js'
import { jsPDF } from 'jspdf'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import { exploreAllowsHydrateFromStorage, markExploreHydrateAllowed } from './exploreSession.js'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const COACH_SPEC_MAX_CHARS = 120_000
const SPEC_EXPLORE_REFLECTION_KEY = 'specExploreReflection'

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
        <span>PDF 파일 선택</span>
      </label>
    </section>`

  const analysisSection = `
    <section class="analysis-panel">
      <div class="analysis-header">
        <div class="analysis-title-section">
          <h2>명세서 분석</h2>
          <button id="analyze-btn" type="button" disabled>명세서 분석하기</button>
        </div>
      </div>
      <p id="analysis-status" class="analysis-status">${escapeHtml(
        showCoachPanel
          ? 'PDF를 올리고, 왼쪽에서 보조교사와 대화·생각 정리를 마친 뒤 여기서 [명세서 분석하기]를 눌러 요약을 확인해 보세요.'
          : 'PDF가 업로드 완료되면 분석을 할 수 있어요!'
      )}</p>
      <div id="analysis-grid" class="analysis-grid">
        ${createAnalysisCard('특허 이름')}
        ${createAnalysisCard('출원 번호')}
        ${createAnalysisCard('발명품의 특징', true)}
        ${createAnalysisCard('발명품의 재료', true)}
      </div>
      <div class="analysis-actions">
        <button id="go-to-idea-btn" type="button" disabled>아이디어 창출하기</button>
      </div>
    </section>`

  const coachAside = showCoachPanel
    ? `
    <aside class="coach-panel" aria-label="발명 보조교사">
      <div class="coach-panel-header">
        <h2>발명 보조교사와 확인하기</h2>
        <p class="coach-panel-desc">오른쪽에서 PDF를 올린 뒤, 아래 순서대로 진행해 보세요. AI 요약은 맨 마지막에 오른쪽에서 확인합니다.</p>
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
            <button id="coach-send" type="button">보내기</button>
          </div>
        </div>
      </section>
      <section id="explore-reflection-block" class="coach-card coach-card--reflect" hidden aria-labelledby="coach-reflect-heading">
        <h3 id="coach-reflect-heading" class="coach-card-title"><span class="coach-step-num">2</span> 내 생각 정리</h3>
        <p class="explore-reflection-hint">대화를 두 번 이상 나눈 뒤 채워 주세요. 세 칸을 모두 채우면 오른쪽 [명세서 분석하기]를 누를 수 있어요.</p>
        <div class="explore-reflection-fields">
          <div class="explore-reflection-field">
            <label for="reflect-features"><span class="explore-label-num">1</span> 발명품의 특징</label>
            <textarea id="reflect-features" class="explore-reflection-textarea" rows="3" placeholder="내가 읽고 이해한 특징을 적어 보세요."></textarea>
          </div>
          <div class="explore-reflection-field">
            <label for="reflect-materials"><span class="explore-label-num">2</span> 발명품의 재료</label>
            <textarea id="reflect-materials" class="explore-reflection-textarea" rows="3" placeholder="명세서에 나온 재료·구성을 적어 보세요."></textarea>
          </div>
          <div class="explore-reflection-field">
            <label for="reflect-improvements"><span class="explore-label-num">3</span> 내가 생각하는 보완해야 할 점</label>
            <textarea id="reflect-improvements" class="explore-reflection-textarea" rows="3" placeholder="보완이 필요하다고 생각하는 점을 적어 보세요."></textarea>
          </div>
        </div>
      </section>
    </aside>`
    : ''

  rootEl.innerHTML = `
  <div class="shell${showCoachPanel ? ' shell--split' : ''}">
    <header>
      <h1>${escapeHtml(heading)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </header>
    ${
      showCoachPanel
        ? `<div class="explore-workspace">
      ${coachAside}
      <div class="explore-main explore-main--spec">
        ${uploaderSection}
        ${analysisSection}
      </div>
    </div>`
        : `${uploaderSection}
    ${analysisSection}`
    }
  </div>
`

  const pdfInput = rootEl.querySelector('#pdf-input')
  const analyzeBtn = rootEl.querySelector('#analyze-btn')
  const analysisStatusEl = rootEl.querySelector('#analysis-status')
  const analysisGrid = rootEl.querySelector('#analysis-grid')
  const goToIdeaBtn = rootEl.querySelector('#go-to-idea-btn')
  const coachMessagesEl = showCoachPanel ? rootEl.querySelector('#coach-messages') : null
  const coachInput = showCoachPanel ? rootEl.querySelector('#coach-input') : null
  const coachSend = showCoachPanel ? rootEl.querySelector('#coach-send') : null
  const coachHint = showCoachPanel ? rootEl.querySelector('#coach-hint') : null

  let lastExtractedText = ''
  let lastAnalysisData = null
  /** @type {File | null} */
  let lastPdfFile = null
  /** @type {{ role: 'user' | 'assistant'; content: string }[]} */
  let coachHistory = []

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
      ? '안녕하세요, 발명 보조교사입니다. 오른쪽에 AI가 정리한 명세서 요약도 함께 있어요. 본문·요약과 관련해 확인하고 싶은 점을 물어보세요.'
      : '안녕하세요, 발명 보조교사입니다. 지금은 아직 AI 요약 전이에요. 올려 주신 PDF에서 추출한 명세서 본문만 바탕으로 질문에 답해 드릴게요. 읽다가 어려운 부분이나 확인하고 싶은 점을 편하게 물어보세요.'
    coachHistory = [{ role: 'assistant', content: intro }]
    renderCoachMessages()
  }

  function countUserCoachTurns() {
    return coachHistory.filter((m) => m.role === 'user').length
  }

  function coachAnalysisReady() {
    return !!(
      lastAnalysisData &&
      typeof lastAnalysisData === 'object' &&
      (lastAnalysisData.patentName ||
        lastAnalysisData.applicationNumber ||
        (Array.isArray(lastAnalysisData.features) && lastAnalysisData.features.length))
    )
  }

  function coachPdfReady() {
    return !!lastExtractedText.trim()
  }

  function isReflectionComplete() {
    if (!showCoachPanel) return true
    const f = rootEl.querySelector('#reflect-features')
    const m = rootEl.querySelector('#reflect-materials')
    const i = rootEl.querySelector('#reflect-improvements')
    if (!f || !m || !i) return false
    return !!(f.value.trim() && m.value.trim() && i.value.trim())
  }

  function exploreCanRunAiAnalysis() {
    if (!showCoachPanel) return true
    if (coachAnalysisReady()) return true
    return countUserCoachTurns() >= 2 && isReflectionComplete()
  }

  function persistReflection() {
    if (!showCoachPanel) return
    const f = rootEl.querySelector('#reflect-features')
    const m = rootEl.querySelector('#reflect-materials')
    const i = rootEl.querySelector('#reflect-improvements')
    if (!f || !m || !i) return
    try {
      localStorage.setItem(
        SPEC_EXPLORE_REFLECTION_KEY,
        JSON.stringify({
          features: f.value,
          materials: m.value,
          improvements: i.value,
        })
      )
    } catch {
      /* ignore */
    }
    updateCoachUi()
  }

  function loadReflectionFromStorage() {
    if (!showCoachPanel || !exploreAllowsHydrateFromStorage(true)) return
    try {
      const r = localStorage.getItem(SPEC_EXPLORE_REFLECTION_KEY)
      if (!r) return
      const p = JSON.parse(r)
      const ef = rootEl.querySelector('#reflect-features')
      const em = rootEl.querySelector('#reflect-materials')
      const ei = rootEl.querySelector('#reflect-improvements')
      if (ef && typeof p.features === 'string') ef.value = p.features
      if (em && typeof p.materials === 'string') em.value = p.materials
      if (ei && typeof p.improvements === 'string') ei.value = p.improvements
    } catch {
      /* ignore */
    }
  }

  function clearReflectionUiAndStorage() {
    if (!showCoachPanel) return
    for (const sel of ['#reflect-features', '#reflect-materials', '#reflect-improvements']) {
      const el = rootEl.querySelector(sel)
      if (el) el.value = ''
    }
    try {
      localStorage.removeItem(SPEC_EXPLORE_REFLECTION_KEY)
    } catch {
      /* ignore */
    }
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
          hasStored = !!(
            String(p?.features || '').trim() ||
            String(p?.materials || '').trim() ||
            String(p?.improvements || '').trim()
          )
        }
      } catch {
        /* ignore */
      }
    }
    block.hidden = countUserCoachTurns() < 2 && !hasStored
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
        '먼저 오른쪽에서 PDF를 업로드하면, 업로드한 명세서 본문을 바탕으로 대화할 수 있어요.'
    } else if (!coachAnalysisReady() && countUserCoachTurns() < 2) {
      coachHint.textContent =
        '보조교사와 두 번 이상 대화한 뒤, 아래 「내 생각 정리하기」 칸이 열려요.'
    } else if (!coachAnalysisReady() && !isReflectionComplete()) {
      coachHint.textContent =
        '세 칸을 모두 채우면 오른쪽 [명세서 분석하기]를 눌러 AI 요약을 볼 수 있어요.'
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
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.patentName || parsed.applicationNumber || (Array.isArray(parsed.features) && parsed.features.length))
        ) {
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
        }
      }
    }
  } catch {
    /* ignore */
  }

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
        if (showCoachPanel) {
          coachHistory = []
          renderCoachMessages()
          clearReflectionUiAndStorage()
          updateCoachUi()
        }
        return
      }

      setAnalysisStatus('텍스트를 추출하는 중입니다...', 'info')
      if (analyzeBtn) analyzeBtn.disabled = true
      if (goToIdeaBtn) goToIdeaBtn.disabled = true
      lastAnalysisData = null
      lastPdfFile = file
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
            ? '텍스트 추출 완료! 왼쪽에서 발명 보조교사와 대화하고 생각을 정리한 뒤, 오른쪽에서 [명세서 분석하기]를 눌러 주세요.'
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
          '먼저 왼쪽에서 보조교사와 두 번 이상 대화한 뒤, 「내 생각 정리하기」 세 칸을 모두 채워 주세요.',
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
        const analysis = await requestAnalysis(apiKey, lastExtractedText)

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
          extractedTextSnapshot,
          ...(specPdfPath
            ? { specPdfPath, specPdfFileName: specPdfFileName || 'document.pdf' }
            : {}),
        }

        lastAnalysisData = enriched
        renderAnalysis(analysisGrid, enriched)

        localStorage.setItem('analysisData', JSON.stringify(enriched))
        localStorage.setItem('extractedText', lastExtractedText)

        await saveStudentActivity('analysis', enriched)

        if (goToIdeaBtn) goToIdeaBtn.disabled = false
        setAnalysisStatus('분석 완료! 아이디어 창출 단계로 이동할 수 있어요.', 'success')
        if (showCoachPanel) {
          markExploreHydrateAllowed()
          updateCoachUi()
          updateReflectionVisibility()
        }
      } catch (error) {
        console.error(error)
        setAnalysisStatus(error.message || '분석 중 오류가 발생했습니다.', 'error')
        if (goToIdeaBtn) goToIdeaBtn.disabled = true
      } finally {
        toggleAnalysis(false)
      }
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
    for (const id of ['#reflect-features', '#reflect-materials', '#reflect-improvements']) {
      const el = rootEl.querySelector(id)
      if (el) el.addEventListener('input', persistReflection)
    }
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
    patentName = '정보 없음',
    applicationNumber = '정보 없음',
    features = [],
    materials = [],
  } = data || {}

  analysisGrid.innerHTML = [
    renderCardContent('특허 이름', patentName),
    renderCardContent('출원 번호', applicationNumber),
    renderCardContent('발명품의 특징', withArrayFallback(features)),
    renderCardContent('발명품의 재료', withArrayFallback(materials)),
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

async function requestAnalysis(apiKey, text) {
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
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                '너는 특허 명세서를 중학생이 이해하기 쉽게 네 가지 항목으로 요약하는 전문가야.',
                '',
                '중요한 요구사항:',
                '1. 어려운 전문 용어나 기술 용어가 나오면 괄호 안에 쉬운 설명을 달아줘.',
                '   예: "폴리머(플라스틱 같은 재료)" 또는 "전도성(전기가 잘 통하는 성질)"',
                '2. 복잡한 설명은 중학생이 이해할 수 있는 쉬운 말로 바꿔서 설명해줘.',
                '3. 너무 긴 문장은 짧게 나눠서 설명해줘.',
                '4. 각 항목의 내용을 명확하고 간단하게 정리해줘.',
                '',
                '반드시 다음 JSON 구조를 지켜:',
                JSON.stringify(
                  {
                    patentName: 'string',
                    applicationNumber: 'string',
                    features: ['string'],
                    materials: ['string'],
                  },
                  null,
                  2
                ),
                '정보가 없으면 빈 문자열이나 빈 배열을 써.',
              ].join('\n'),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `다음 텍스트를 분석해 줘:\n${text}`,
            },
          ],
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

  const {
    patentName = '',
    applicationNumber = '',
    features = [],
    materials = [],
  } = analysisData || {}

  const hasAiSummary = !!(
    patentName ||
    applicationNumber ||
    (Array.isArray(features) && features.length) ||
    (Array.isArray(materials) && materials.length)
  )

  const analysisSummary = hasAiSummary
    ? [
        '특허 이름: ' + (patentName || '정보 없음'),
        '출원 번호: ' + (applicationNumber || '정보 없음'),
        '발명품의 특징: ' +
          (Array.isArray(features) && features.length ? features.join(' / ') : '정보 없음'),
        '발명품의 재료: ' +
          (Array.isArray(materials) && materials.length ? materials.join(' / ') : '정보 없음'),
      ].join('\n')
    : '(아직 [명세서 분석하기]를 누르기 전입니다. 아래 명세서 PDF 본문만 근거로 답하세요.)'

  const rawSpec = typeof specExtractedText === 'string' ? specExtractedText.trim() : ''
  let specBlock = ''
  if (rawSpec) {
    const truncated = rawSpec.length > COACH_SPEC_MAX_CHARS
    const body = truncated ? rawSpec.slice(0, COACH_SPEC_MAX_CHARS) : rawSpec
    specBlock =
      '\n\n[업로드된 명세서 PDF에서 추출한 본문]\n---\n' +
      body +
      '\n---\n' +
      (truncated
        ? `\n(참고: 앞부분 ${COACH_SPEC_MAX_CHARS.toLocaleString()}자만 포함)\n`
        : '')
  } else {
    specBlock = '\n\n[명세서 본문]\n본문 텍스트가 없습니다. 학생에게 PDF를 다시 업로드하라고 안내하세요.\n'
  }

  const systemPrompt = [
    '당신은 발명 보조교사로 대한민국 중학교 학생을 도와주는 발명 전문 교사입니다.',
    '학생이 업로드한 특허 명세서 본문과, 있다면 AI가 만든 요약만을 근거로 답합니다.',
    '인터넷 검색이나 책을 찾아보라고 하지 말고, 제공된 본문·요약 안에서만 설명하세요.',
    '중학생이 이해하기 쉬운 말과 존댓말, 간결한 답을 유지하세요.',
    '',
    '[AI 명세서 분석 요약 — 있을 때만 참고]',
    analysisSummary,
    specBlock,
  ].join('\n')

  const conversationHistory = history
    .slice(0, -1)
    .map((h) => {
      if (h.role === 'user') return `학생: ${h.content}`
      if (h.role === 'assistant') return `발명 보조교사: ${h.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')

  const userLine = last.content
  const fullPrompt = conversationHistory
    ? `${systemPrompt}\n\n이전 대화:\n${conversationHistory}\n\n학생: ${userLine}\n발명 보조교사:`
    : `${systemPrompt}\n\n학생: ${userLine}\n발명 보조교사:`

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

export function generateAnalysisPdf(analysis) {
  const {
    patentName = '정보 없음',
    applicationNumber = '정보 없음',
    features = [],
    materials = [],
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

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('1. 특허 이름', margin, yPos)
  yPos += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const patentNameText = formatText(patentName)
  const patentNameLines = doc.splitTextToSize(patentNameText, maxWidth)
  doc.text(patentNameLines, margin + 5, yPos)
  yPos += patentNameLines.length * 6 + 10

  if (yPos > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('2. 출원 번호', margin, yPos)
  yPos += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const appNumberText = formatText(applicationNumber)
  const appNumberLines = doc.splitTextToSize(appNumberText, maxWidth)
  doc.text(appNumberLines, margin + 5, yPos)
  yPos += appNumberLines.length * 6 + 10

  if (yPos > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('3. 발명품의 특징', margin, yPos)
  yPos += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const featuresText = formatArray(features)
  const featuresLines = doc.splitTextToSize(`• ${featuresText}`, maxWidth)
  doc.text(featuresLines, margin + 5, yPos)
  yPos += featuresLines.length * 6 + 10

  if (yPos > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    yPos = margin
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('4. 발명품의 재료', margin, yPos)
  yPos += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const materialsText = formatArray(materials)
  const materialsLines = doc.splitTextToSize(`• ${materialsText}`, maxWidth)
  doc.text(materialsLines, margin + 5, yPos)

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const fileName = `${year}-${month}-${day}-분석결과.pdf`
  doc.save(fileName)
}
