import './inventionSpec.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import { saveStudentActivity } from './activityStorage.js'
import { SPEC_FIELDS, guideTerms, generateCounterQuestions, reviewSpec } from './specWritingAi.js'

const STORAGE_KEY = 'myInventionSpecDraft'
const DRAWING_RESTORE_KEY = 'studentDrawingRestore'
const IDEA_SESSION_KEY = 'studentIdeaSessionRestore'

const FIELD_META = {
  title: {
    hint: '만들 발명을 한 줄로 부를 이름을 적어 보세요.',
    rows: 2,
  },
  field: {
    hint: '이 발명이 속하는 분야(예: 생활용품, IT, 환경 등)를 적어 보세요.',
    rows: 3,
  },
  background: {
    hint: '비슷한 것이 있거나, 지금까지 어떤 방식으로 쓰였는지 간단히 적어 보세요.',
    rows: 4,
  },
  problem: {
    hint: '무엇이 불편하거나 부족해서 이 발명이 필요한지 적어 보세요.',
    rows: 4,
  },
  solution: {
    hint: '발명의 구성(모양·재료·부품)과 어떻게 동작하는지 구체적으로 적어 보세요.',
    rows: 6,
  },
  effect: {
    hint: '이 발명으로 어떤 좋은 점이 있는지 적어 보세요.',
    rows: 4,
  },
  figures: {
    hint: '「발명품 표현하기」에서 그린 그림을 반드시 포함하고, 그림에서 무엇을 나타내는지 적어 보세요.',
    rows: 4,
  },
}

const FIELDS = SPEC_FIELDS.map((f) => ({ ...f, ...(FIELD_META[f.id] || { hint: '', rows: 4 }) }))

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveDraft(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

const app = document.querySelector('#app')
const initial = loadDraft()

let counterQuestions = normalizeCounterAnswers(initial.counterAnswers)
let reviewResult = normalizeReview(initial.review)
let counterBusy = false

app.innerHTML = `
  <div class="spec-shell">
    <header>
      <h1>나만의 발명품 명세서 완성하기</h1>
      <p class="lead">
        먼저 왼쪽에 명세서를 직접 작성하고, 칸마다 [표현 다듬기]로 더 또렷한 말을 찾아보세요.
        다 쓴 뒤에는 [처음 보는 사람의 질문]에 답해 보고, 마지막으로 오른쪽 위 [검토하기]를 눌러 주세요.
        작성 내용은 이 기기에 임시 저장됩니다.
      </p>
    </header>
    <div class="spec-layout">
      <section class="spec-left">
        <form class="spec-form" id="spec-form">
          ${FIELDS.map(
            (f) => `
            <div class="field">
              <label for="${f.id}">${f.label}<span class="hint"> — ${f.hint}</span></label>
              <textarea id="${f.id}" name="${f.id}" rows="${f.rows}"></textarea>
              <div class="term-guide">
                <button type="button" class="term-guide-btn" data-field="${f.id}">표현 다듬기</button>
                <p class="term-guide-status" id="term-status-${f.id}" aria-live="polite"></p>
                <div class="term-guide-result" id="term-result-${f.id}"></div>
              </div>
            </div>
          `
          ).join('')}
        </form>
        <section class="drawing-required" aria-labelledby="drawing-required-title">
          <h2 id="drawing-required-title">필수 첨부: 발명품 표현하기 그림</h2>
          <p class="drawing-required-hint">「발명품 표현하기」에서 저장한 그림이 반드시 필요합니다.</p>
          <div id="drawing-preview-wrap" class="drawing-preview-wrap"></div>
        </section>
        <section class="counter" aria-labelledby="counter-title">
          <div class="counter-head">
            <h2 id="counter-title">처음 보는 사람의 질문에 답해 보기</h2>
            <button type="button" id="counter-btn" class="counter-btn">질문 받기</button>
          </div>
          <p class="counter-desc">
            이 명세서를 처음 보는 사람이라면 무엇을 궁금해할까요? 질문 3개에 답해 보면서
            내 글에서 아직 흐릿한 곳을 스스로 찾아 보세요. 정답은 없어요.
          </p>
          <p id="counter-status" class="counter-status" aria-live="polite"></p>
          <div id="counter-list" class="counter-list"></div>
        </section>
        <p class="save-hint" id="save-status" aria-live="polite"></p>
      </section>
      <aside class="spec-right" aria-label="명세서 검토 패널">
        <div class="review-head">
          <h2>함께 살펴보기</h2>
          <button type="button" id="review-btn" class="review-btn">검토하기</button>
        </div>
        <p id="review-status" class="review-status">먼저 왼쪽에 명세서를 작성한 뒤 [검토하기]를 눌러 주세요.</p>
        <div id="review-result" class="review-result"></div>
        <div class="save-pdf-wrap">
          <button type="button" id="save-pdf-btn" class="save-pdf-btn">명세서 완성! 저장!</button>
          <p id="save-pdf-status" class="save-pdf-status" aria-live="polite"></p>
        </div>
      </aside>
    </div>
  </div>
`

const form = document.getElementById('spec-form')
const statusEl = document.getElementById('save-status')
const reviewBtn = document.getElementById('review-btn')
const reviewStatusEl = document.getElementById('review-status')
const reviewResultEl = document.getElementById('review-result')
const drawingPreviewWrap = document.getElementById('drawing-preview-wrap')
const counterBtn = document.getElementById('counter-btn')
const counterStatusEl = document.getElementById('counter-status')
const counterListEl = document.getElementById('counter-list')
const savePdfBtn = document.getElementById('save-pdf-btn')
const savePdfStatusEl = document.getElementById('save-pdf-status')

FIELDS.forEach((f) => {
  const el = document.getElementById(f.id)
  if (el && initial[f.id] != null) el.value = String(initial[f.id])
})

let t = null
function scheduleDraftSave() {
  const data = collectDraft()
  window.clearTimeout(t)
  t = window.setTimeout(() => {
    saveDraft(data)
    if (statusEl) {
      statusEl.textContent = '임시 저장되었습니다.'
      window.setTimeout(() => {
        if (statusEl.textContent === '임시 저장되었습니다.') statusEl.textContent = ''
      }, 2000)
    }
  }, 400)
}

form.addEventListener('input', scheduleDraftSave)

function collectDraft() {
  const data = {}
  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id)
    if (el) data[f.id] = el.value
  })
  if (counterQuestions.length) data.counterAnswers = counterQuestions
  if (reviewResult) data.review = reviewResult
  return data
}

function normalizeCounterAnswers(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((q) => ({
      focus: String(q?.focus || ''),
      question: String(q?.question || ''),
      answer: String(q?.answer || ''),
    }))
    .filter((q) => q.question)
}

function normalizeReview(review) {
  if (!review || typeof review !== 'object') return null
  return {
    goodPoint: String(review.goodPoint || ''),
    fieldChecks: Array.isArray(review.fieldChecks) ? review.fieldChecks : [],
    spelling: Array.isArray(review.spelling) ? review.spelling : [],
    flow: Array.isArray(review.flow) ? review.flow : [],
    nextStep: String(review.nextStep || ''),
  }
}

function getIdeaName(draft) {
  const fromDraft = String(draft?.title || '').trim()
  if (fromDraft) return fromDraft
  try {
    const raw = localStorage.getItem(IDEA_SESSION_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return String(parsed?.selectedIdea?.name || '').trim()
  } catch {
    return ''
  }
}

function getDrawingImage() {
  try {
    const image = localStorage.getItem(DRAWING_RESTORE_KEY)
    return typeof image === 'string' && image.startsWith('data:image/') ? image : ''
  } catch {
    return ''
  }
}

function renderDrawingPreview() {
  if (!drawingPreviewWrap) return
  const image = getDrawingImage()
  if (!image) {
    drawingPreviewWrap.innerHTML = `
      <p class="drawing-required-missing">
        저장된 그림이 없습니다. 먼저 「발명품 표현하기」에서 그림을 저장해 주세요.
      </p>
    `
    return
  }
  drawingPreviewWrap.innerHTML = `<img src="${image}" alt="발명품 표현하기에서 저장한 그림" class="drawing-preview-image" />`
}

function hasEnoughDraftToReview(draft) {
  const requiredIds = ['title', 'problem', 'solution', 'effect', 'figures']
  return requiredIds.every((id) => String(draft?.[id] || '').trim().length > 0)
}

async function persistInventionSpecActivity(data) {
  try {
    await saveStudentActivity('invention_spec', {
      ...data,
      drawingImage: getDrawingImage() || '',
      timestamp: new Date().toISOString(),
    })
  } catch {
    /* ignore */
  }
}

// ── 6-1. 표현 다듬기 ─────────────────────────────────────────

function renderTermGuide(fieldId, guide) {
  const resultEl = document.getElementById(`term-result-${fieldId}`)
  if (!resultEl) return
  if (!guide) {
    resultEl.innerHTML = ''
    return
  }

  const blocks = []
  if (guide.items.length) {
    blocks.push(`
      <ul class="term-item-list">
        ${guide.items
          .map(
            (item) => `
          <li class="term-item">
            <p class="term-phrase">“${sanitize(item.studentPhrase)}”</p>
            <ul class="term-candidates">
              ${item.candidates.map((c) => `<li>${sanitize(c)}</li>`).join('')}
            </ul>
            ${item.why ? `<p class="term-why">${sanitize(item.why)}</p>` : ''}
          </li>
        `
          )
          .join('')}
      </ul>
    `)
  }
  if (guide.encouragement) {
    blocks.push(`<p class="term-encouragement">${sanitize(guide.encouragement)}</p>`)
  }
  resultEl.innerHTML = blocks.join('')
}

async function handleTermGuideClick(button) {
  const fieldId = button.dataset.field
  const field = FIELDS.find((f) => f.id === fieldId)
  if (!field) return

  const statusTarget = document.getElementById(`term-status-${fieldId}`)
  const setStatus = (message) => {
    if (statusTarget) statusTarget.textContent = message || ''
  }

  const studentText = String(document.getElementById(fieldId)?.value || '').trim()
  if (!studentText) {
    renderTermGuide(fieldId, null)
    setStatus('먼저 이 칸에 편한 말로 써 본 뒤 눌러 주세요.')
    return
  }

  button.disabled = true
  setStatus('더 또렷한 말을 찾고 있어요…')
  try {
    const guide = await guideTerms({
      fieldLabel: field.label,
      studentText,
      ideaName: getIdeaName(collectDraft()),
    })
    renderTermGuide(fieldId, guide)
    setStatus(
      guide.items.length
        ? '바꿔 볼 만한 곳을 찾았어요. 고쳐 쓰는 건 직접 해 보세요.'
        : '지금 문장도 또렷해요.'
    )
  } catch (error) {
    renderTermGuide(fieldId, null)
    setStatus(error?.message || '표현을 살펴보는 중 오류가 발생했어요.')
  } finally {
    button.disabled = false
  }
}

form.addEventListener('click', (event) => {
  const button = event.target.closest('.term-guide-btn')
  if (button) handleTermGuideClick(button)
})

// ── 6-2. 처음 보는 사람의 질문 ───────────────────────────────

function renderCounterQuestions() {
  if (!counterListEl) return
  if (!counterQuestions.length) {
    counterListEl.innerHTML = ''
    return
  }

  counterListEl.innerHTML = counterQuestions
    .map(
      (q, i) => `
      <div class="counter-item">
        <span class="counter-index">${i + 1}</span>
        <div class="counter-body">
          ${q.focus ? `<span class="counter-focus">${sanitize(q.focus)}</span>` : ''}
          <p class="counter-question">${sanitize(q.question)}</p>
          <label class="sr-only" for="counter-answer-${i}">${sanitize(q.question)}에 대한 내 생각</label>
          <textarea id="counter-answer-${i}" class="counter-answer" data-index="${i}" rows="3" placeholder="내 생각을 적어 보세요.">${sanitize(q.answer || '')}</textarea>
        </div>
      </div>
    `
    )
    .join('')

  counterListEl.querySelectorAll('.counter-answer').forEach((el) => {
    el.addEventListener('input', (event) => {
      const index = Number(event.target.dataset.index)
      if (!Number.isInteger(index) || !counterQuestions[index]) return
      counterQuestions[index].answer = event.target.value
      scheduleDraftSave()
    })
  })

  if (counterBtn) counterBtn.textContent = '질문 다시 받기'
}

if (counterBtn) {
  counterBtn.addEventListener('click', async () => {
    if (counterBusy) return
    const draft = collectDraft()
    const notReady = ['problem', 'solution'].some((id) => !String(draft?.[id] || '').trim())
    if (notReady) {
      if (counterStatusEl) {
        counterStatusEl.textContent =
          '먼저 「해결하고자 하는 과제」와 「과제를 해결하기 위한 수단」을 채운 뒤 눌러 주세요.'
      }
      return
    }

    counterBusy = true
    counterBtn.disabled = true
    if (counterStatusEl) counterStatusEl.textContent = '질문을 만들고 있어요…'
    try {
      const { questions, note } = await generateCounterQuestions({
        spec: draft,
        ideaName: getIdeaName(draft),
      })
      if (!questions.length) {
        if (counterStatusEl) {
          counterStatusEl.textContent = note || '명세서를 조금 더 채운 뒤 다시 눌러 주세요.'
        }
        return
      }
      const previous = new Map(counterQuestions.map((q) => [q.question, q.answer]))
      counterQuestions = questions.map((q) => ({ ...q, answer: previous.get(q.question) || '' }))
      renderCounterQuestions()
      if (counterStatusEl) {
        counterStatusEl.textContent = '질문에 답해 보고, 흐릿한 곳은 위 명세서를 직접 고쳐 보세요.'
      }
      scheduleDraftSave()
    } catch (error) {
      if (counterStatusEl) {
        counterStatusEl.textContent = error?.message || '질문을 받는 중 오류가 발생했어요.'
      }
    } finally {
      counterBusy = false
      counterBtn.disabled = false
    }
  })
}

// ── 6-3. 명세서 검토 ─────────────────────────────────────────

function renderReviewResult(result) {
  if (!reviewResultEl) return
  if (!result) {
    reviewResultEl.innerHTML = ''
    return
  }

  const blocks = []
  if (result.goodPoint) {
    blocks.push(`
      <p class="review-good">
        <span class="review-tag">잘된 곳</span>${sanitize(result.goodPoint)}
      </p>
    `)
  }

  if (result.fieldChecks.length) {
    blocks.push(`
      <section class="review-group">
        <h3>칸마다 살펴본 결과</h3>
        <ul class="review-check-list">
          ${result.fieldChecks
            .map(
              (check) => `
            <li class="review-check">
              <div class="review-check-head">
                <span class="review-level" data-level="${sanitize(check.level)}">${sanitize(check.level)}</span>
                <strong>${sanitize(check.field)}</strong>
              </div>
              <p>${sanitize(check.comment)}</p>
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
    `)
  }

  if (result.flow.length) {
    blocks.push(`
      <section class="review-group">
        <h3>이야기가 이어지는지</h3>
        <ul class="review-check-list">
          ${result.flow
            .map(
              (item) => `
            <li class="review-check">
              <div class="review-check-head">
                <span class="review-level" data-level="${sanitize(item.level)}">${sanitize(item.level)}</span>
                <strong>${sanitize(item.between)}</strong>
              </div>
              <p>${sanitize(item.comment)}</p>
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
    `)
  }

  if (result.spelling.length) {
    blocks.push(`
      <section class="review-group">
        <h3>맞춤법과 띄어쓰기</h3>
        <ul class="review-spelling-list">
          ${result.spelling
            .map(
              (item) => `
            <li class="review-spelling">
              <p class="review-spelling-pair">
                <span class="review-spelling-wrong">${sanitize(item.wrong)}</span>
                <span class="review-spelling-arrow">→</span>
                <span class="review-spelling-right">${sanitize(item.right)}</span>
              </p>
              ${item.why ? `<p class="review-spelling-why">${sanitize(item.why)}</p>` : ''}
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
    `)
  }

  if (result.nextStep) {
    blocks.push(`
      <p class="review-next">
        <span class="review-tag">다음에 할 일</span>${sanitize(result.nextStep)}
      </p>
    `)
  }

  reviewResultEl.innerHTML =
    blocks.join('') || '<p class="review-empty">검토 결과를 읽지 못했어요. 다시 눌러 주세요.</p>'
}

if (reviewBtn) {
  reviewBtn.addEventListener('click', async () => {
    const draft = collectDraft()
    if (!hasEnoughDraftToReview(draft)) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent =
          '학생이 먼저 작성해야 해요. 왼쪽 필수 항목(명칭/과제/수단/효과/도면 설명)을 먼저 채워 주세요.'
      }
      renderReviewResult(null)
      return
    }

    if (!getDrawingImage()) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent =
          '「발명품 표현하기」에서 저장한 그림이 필요해요. 그림 저장 후 다시 검토해 주세요.'
      }
      renderReviewResult(null)
      return
    }

    reviewBtn.disabled = true
    if (reviewStatusEl) reviewStatusEl.textContent = '함께 살펴보고 있어요…'
    try {
      reviewResult = await reviewSpec({
        spec: draft,
        ideaName: getIdeaName(draft),
        counterAnswers: counterQuestions,
      })
      renderReviewResult(reviewResult)
      if (reviewStatusEl) {
        const answered = counterQuestions.some((q) => String(q.answer || '').trim())
        reviewStatusEl.textContent = answered
          ? '살펴본 내용을 보고 고칠 곳을 직접 고쳐 보세요.'
          : '살펴봤어요. 아래 [처음 보는 사람의 질문]에도 답해 보면 더 단단해져요.'
      }
      const saved = collectDraft()
      saveDraft(saved)
      persistInventionSpecActivity(saved)
    } catch (error) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent = error?.message || '검토 중 오류가 발생했습니다.'
      }
    } finally {
      reviewBtn.disabled = false
    }
  })
}

// ── PDF 저장 ─────────────────────────────────────────────────

function buildPdfBlocks(draft, drawingImage, counterAnswers, review) {
  const blocks = []

  blocks.push(`
    <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #0f172a;">나만의 발명품 명세서</h1>
    <div style="height: 3px; background: linear-gradient(90deg, #2563eb, #7c3aed); border-radius: 2px;"></div>
  `)

  FIELDS.forEach((f) => {
    const value = String(draft?.[f.id] || '').trim() || '(작성되지 않음)'
    blocks.push(`
      <div>
        <h2 style="font-size: 17px; font-weight: 700; margin: 0 0 8px; color: #1e293b;">${sanitize(f.label)}</h2>
        <div style="font-size: 14px; line-height: 1.8; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #2563eb; white-space: pre-wrap; color: #0f172a; word-break: break-word; overflow-wrap: anywhere;">${sanitize(value).replace(/\n/g, '<br>')}</div>
      </div>
    `)
  })

  if (drawingImage) {
    blocks.push(`
      <div>
        <h2 style="font-size: 17px; font-weight: 700; margin: 0 0 10px; color: #1e293b;">발명품 표현하기 그림</h2>
        <div style="padding: 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center;">
          <img src="${drawingImage}" alt="발명품 그림" style="max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 0 auto;" />
        </div>
      </div>
    `)
  }

  const answeredQuestions = (counterAnswers || []).filter((q) => String(q?.answer || '').trim())
  if (answeredQuestions.length) {
    blocks.push(`
      <div style="padding: 18px 20px; background: #eff6ff; border-radius: 10px; border-left: 4px solid #2563eb;">
        <h2 style="font-size: 16px; font-weight: 700; margin: 0 0 10px; color: #1e3a8a;">처음 보는 사람의 질문과 내 답</h2>
        <div style="font-size: 13.5px; line-height: 1.8; color: #1e3a8a;">
          ${answeredQuestions
            .map(
              (q) => `
            <p style="margin: 0 0 10px;">
              <strong>${sanitize(q.question)}</strong><br>
              ${sanitize(q.answer).replace(/\n/g, '<br>')}
            </p>
          `
            )
            .join('')}
        </div>
      </div>
    `)
  }

  const reviewLines = []
  if (review?.goodPoint) reviewLines.push(`잘된 곳: ${review.goodPoint}`)
  ;(review?.fieldChecks || []).forEach((c) => {
    if (c?.field) reviewLines.push(`${c.field} [${c.level || ''}] ${c.comment || ''}`)
  })
  ;(review?.flow || []).forEach((c) => {
    if (c?.between) reviewLines.push(`${c.between} [${c.level || ''}] ${c.comment || ''}`)
  })
  ;(review?.spelling || []).forEach((s) => {
    if (s?.wrong) reviewLines.push(`맞춤법: ${s.wrong} → ${s.right}${s.why ? ` (${s.why})` : ''}`)
  })
  if (review?.nextStep) reviewLines.push(`다음에 할 일: ${review.nextStep}`)

  if (reviewLines.length) {
    blocks.push(`
      <div style="padding: 18px 20px; background: #fff7ed; border-radius: 10px; border-left: 4px solid #f97316;">
        <h2 style="font-size: 16px; font-weight: 700; margin: 0 0 10px; color: #9a3412;">함께 살펴본 내용</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.8; color: #7c2d12;">
          ${reviewLines.map((line) => `<li>${sanitize(line)}</li>`).join('')}
        </ul>
      </div>
    `)
  }

  blocks.push(`
    <div style="padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: right; color: #64748b; font-size: 12px;">
      작성일: ${new Date().toLocaleDateString('ko-KR')}
    </div>
  `)

  return blocks
}

async function waitForImagesToLoad(root) {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve()
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  )
}

async function generateInventionSpecPdf(draft, drawingImage, counterAnswers, review) {
  const RENDER_WIDTH_PX = 800
  const blocks = buildPdfBlocks(draft, drawingImage, counterAnswers, review)

  const stage = document.createElement('div')
  stage.style.cssText = [
    'position: absolute',
    'left: -10000px',
    'top: 0',
    `width: ${RENDER_WIDTH_PX}px`,
    'background: #ffffff',
    'padding: 0',
    "font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', system-ui, sans-serif",
    'color: #0f172a',
  ].join(';')

  const blockEls = blocks.map((html) => {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `width: ${RENDER_WIDTH_PX}px; background: #ffffff; box-sizing: border-box; padding: 0;`
    wrapper.innerHTML = html
    stage.appendChild(wrapper)
    return wrapper
  })

  document.body.appendChild(stage)

  try {
    await waitForImagesToLoad(stage)

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 12
    const marginY = 12
    const contentWidth = pageWidth - marginX * 2
    const contentHeight = pageHeight - marginY * 2
    const blockGap = 5

    let cursorY = marginY
    let isFirstOnPage = true

    for (const el of blockEls) {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: RENDER_WIDTH_PX,
      })

      let imgWidthMm = contentWidth
      let imgHeightMm = (canvas.height * imgWidthMm) / canvas.width

      if (imgHeightMm > contentHeight) {
        imgHeightMm = contentHeight
        imgWidthMm = (canvas.width * imgHeightMm) / canvas.height
      }

      const remaining = pageHeight - marginY - cursorY
      if (!isFirstOnPage && imgHeightMm > remaining) {
        doc.addPage()
        cursorY = marginY
        isFirstOnPage = true
      }

      const xOffset = marginX + (contentWidth - imgWidthMm) / 2
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', xOffset, cursorY, imgWidthMm, imgHeightMm)
      cursorY += imgHeightMm + blockGap
      isFirstOnPage = false
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const titleText = String(draft?.title || '').trim()
    const safeTitle = titleText
      ? titleText.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 30)
      : '발명품_명세서'
    const fileName = `${year}-${month}-${day}_${safeTitle}.pdf`
    doc.save(fileName)
  } finally {
    document.body.removeChild(stage)
  }
}

if (savePdfBtn) {
  savePdfBtn.addEventListener('click', async () => {
    const draft = collectDraft()
    const hasAnyContent = FIELDS.some((f) => String(draft?.[f.id] || '').trim().length > 0)
    if (!hasAnyContent) {
      if (savePdfStatusEl) savePdfStatusEl.textContent = '먼저 명세서를 작성해 주세요.'
      return
    }

    const drawingImage = getDrawingImage()

    savePdfBtn.disabled = true
    if (savePdfStatusEl) savePdfStatusEl.textContent = 'PDF를 만들고 있어요…'
    try {
      await generateInventionSpecPdf(draft, drawingImage, counterQuestions, reviewResult)
      saveDraft(draft)
      persistInventionSpecActivity(draft)
      if (savePdfStatusEl) savePdfStatusEl.textContent = 'PDF로 저장했어요!'
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      if (savePdfStatusEl) {
        savePdfStatusEl.textContent = error?.message || 'PDF 저장 중 오류가 발생했어요.'
      }
    } finally {
      savePdfBtn.disabled = false
      window.setTimeout(() => {
        if (savePdfStatusEl && savePdfStatusEl.textContent === 'PDF로 저장했어요!') {
          savePdfStatusEl.textContent = ''
        }
      }, 2500)
    }
  })
}

renderDrawingPreview()
renderCounterQuestions()
renderReviewResult(reviewResult)

listenForWorkbenchFlushRequest(() => {
  const data = collectDraft()
  saveDraft(data)
  persistInventionSpecActivity(data)
})

function sanitize(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
