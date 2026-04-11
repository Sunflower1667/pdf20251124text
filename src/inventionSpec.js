import './inventionSpec.css'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import { saveStudentActivity } from './activityStorage.js'

const STORAGE_KEY = 'myInventionSpecDraft'
const DRAWING_RESTORE_KEY = 'studentDrawingRestore'
const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const FIELDS = [
  {
    id: 'title',
    label: '발명의 명칭',
    hint: '만들 발명을 한 줄로 부를 이름을 적어 보세요.',
    rows: 2,
  },
  {
    id: 'field',
    label: '기술분야',
    hint: '이 발명이 속하는 분야(예: 생활용품, IT, 환경 등)를 적어 보세요.',
    rows: 3,
  },
  {
    id: 'background',
    label: '배경이 되는 기술',
    hint: '비슷한 것이 있거나, 지금까지 어떤 방식으로 쓰였는지 간단히 적어 보세요.',
    rows: 4,
  },
  {
    id: 'problem',
    label: '해결하고자 하는 과제',
    hint: '무엇이 불편하거나 부족해서 이 발명이 필요한지 적어 보세요.',
    rows: 4,
  },
  {
    id: 'solution',
    label: '과제를 해결하기 위한 수단',
    hint: '발명의 구성(모양·재료·부품)과 어떻게 동작하는지 구체적으로 적어 보세요.',
    rows: 6,
  },
  {
    id: 'effect',
    label: '발명의 효과',
    hint: '이 발명으로 어떤 좋은 점이 있는지 적어 보세요.',
    rows: 4,
  },
  {
    id: 'figures',
    label: '도면·그림에 대한 간단한 설명',
    hint: '「발명품 표현하기」에서 그린 그림을 반드시 포함하고, 그림에서 무엇을 나타내는지 적어 보세요.',
    rows: 4,
  },
]

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

app.innerHTML = `
  <div class="spec-shell">
    <header>
      <h1>나만의 발명품 명세서 완성하기</h1>
      <p class="lead">
        먼저 왼쪽에 명세서를 직접 작성하고, 오른쪽 위 [검토하기]로 보완점을 확인해 보세요. 작성 내용은 이 기기에 임시 저장됩니다.
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
            </div>
          `
          ).join('')}
        </form>
        <section class="drawing-required" aria-labelledby="drawing-required-title">
          <h2 id="drawing-required-title">필수 첨부: 발명품 표현하기 그림</h2>
          <p class="drawing-required-hint">「발명품 표현하기」에서 저장한 그림이 반드시 필요합니다.</p>
          <div id="drawing-preview-wrap" class="drawing-preview-wrap"></div>
        </section>
        <p class="save-hint" id="save-status" aria-live="polite"></p>
      </section>
      <aside class="spec-right" aria-label="명세서 검토 패널">
        <div class="review-head">
          <h2>보완하면 좋을 점</h2>
          <button type="button" id="review-btn" class="review-btn">검토하기</button>
        </div>
        <p id="review-status" class="review-status">먼저 왼쪽에 명세서를 작성한 뒤 [검토하기]를 눌러 주세요.</p>
        <ul id="review-list" class="review-list"></ul>
      </aside>
    </div>
  </div>
`

const form = document.getElementById('spec-form')
const statusEl = document.getElementById('save-status')
const reviewBtn = document.getElementById('review-btn')
const reviewStatusEl = document.getElementById('review-status')
const reviewListEl = document.getElementById('review-list')
const drawingPreviewWrap = document.getElementById('drawing-preview-wrap')

FIELDS.forEach((f) => {
  const el = document.getElementById(f.id)
  if (el && initial[f.id] != null) el.value = String(initial[f.id])
})

let t = null
form.addEventListener('input', () => {
  const data = collectDraft()
  window.clearTimeout(t)
  t = window.setTimeout(() => {
    saveDraft(data)
    persistInventionSpecActivity(data)
    if (statusEl) {
      statusEl.textContent = '임시 저장되었습니다.'
      window.setTimeout(() => {
        if (statusEl.textContent === '임시 저장되었습니다.') statusEl.textContent = ''
      }, 2000)
    }
  }, 400)
})

function collectDraft() {
  const data = {}
  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id)
    if (el) data[f.id] = el.value
  })
  return data
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

function renderReviewItems(items) {
  if (!reviewListEl) return
  if (!Array.isArray(items) || !items.length) {
    reviewListEl.innerHTML = '<li>눈에 띄는 문제를 찾지 못했어요. 문장을 더 구체적으로 다듬어 보세요.</li>'
    return
  }
  reviewListEl.innerHTML = items.map((item) => `<li>${sanitize(item)}</li>`).join('')
}

async function requestSpecReview(apiKey, draft, drawingIncluded) {
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
                '너는 중학생의 발명품 명세서를 검토하는 교사다.',
                '학생이 스스로 먼저 작성한 명세서를 보고, 빠진 점·모호한 점·보완할 점을 짧고 구체적으로 알려준다.',
                '항상 한국어 존댓말을 사용한다.',
                '반드시 JSON으로만 답한다.',
                JSON.stringify(
                  {
                    issues: ['string'],
                  },
                  null,
                  2
                ),
              ].join('\n'),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  drawingIncluded,
                  specDraft: draft,
                },
                null,
                2
              ),
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`검토 API 오류 (${response.status})`)
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) throw new Error('검토 응답을 읽지 못했습니다.')
  const parsed = parseAiJson(aiText)
  return Array.isArray(parsed?.issues) ? parsed.issues : []
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

if (reviewBtn) {
  reviewBtn.addEventListener('click', async () => {
    const draft = collectDraft()
    if (!hasEnoughDraftToReview(draft)) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent =
          '학생이 먼저 작성해야 해요. 왼쪽 필수 항목(명칭/과제/수단/효과/도면 설명)을 먼저 채워 주세요.'
      }
      renderReviewItems([])
      return
    }

    const drawingImage = getDrawingImage()
    if (!drawingImage) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent =
          '「발명품 표현하기」에서 저장한 그림이 필요해요. 그림 저장 후 다시 검토해 주세요.'
      }
      renderReviewItems(['그림이 누락되었습니다. 발명품 표현하기에서 그린 그림을 반드시 포함해 주세요.'])
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      if (reviewStatusEl) reviewStatusEl.textContent = '.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.'
      return
    }

    reviewBtn.disabled = true
    if (reviewStatusEl) reviewStatusEl.textContent = '검토 중입니다…'
    try {
      const issues = await requestSpecReview(apiKey, draft, true)
      renderReviewItems(issues)
      if (reviewStatusEl) {
        reviewStatusEl.textContent =
          issues.length > 0
            ? `검토 완료: ${issues.length}개의 보완점을 확인했어요.`
            : '검토 완료: 큰 문제는 보이지 않습니다.'
      }
      saveDraft(draft)
      persistInventionSpecActivity(draft)
    } catch (error) {
      if (reviewStatusEl) {
        reviewStatusEl.textContent = error?.message || '검토 중 오류가 발생했습니다.'
      }
    } finally {
      reviewBtn.disabled = false
    }
  })
}

renderDrawingPreview()

listenForWorkbenchFlushRequest(() => {
  const data = collectDraft()
  saveDraft(data)
  persistInventionSpecActivity(data)
})

function extractAiText(result) {
  if (!result) return ''
  if (Array.isArray(result.output)) {
    for (const block of result.output) {
      if (!Array.isArray(block?.content)) continue
      for (const piece of block.content) {
        if (piece?.type !== 'output_text') continue
        if (Array.isArray(piece.text)) return piece.text.join('')
        return String(piece.text || '')
      }
    }
  }
  if (Array.isArray(result.output_text) && result.output_text.length) {
    return String(result.output_text[0] || '')
  }
  return String(result?.choices?.[0]?.message?.content || '')
}

function parseAiJson(rawText) {
  const trimmed = String(rawText || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const firstObject = extractFirstJson(candidate)
  return JSON.parse(firstObject)
}

function extractFirstJson(text) {
  const openIndex = text.indexOf('{')
  const closeIndex = text.lastIndexOf('}')
  if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) return text
  return text.slice(openIndex, closeIndex + 1)
}

function sanitize(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
