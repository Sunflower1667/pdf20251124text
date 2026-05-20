import './seed.css'
import { initFirebase } from './firebaseConfig.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

const DEFAULT_INTERESTS = ['운동', '게임', '환경', '요리', '음악', '동물', '학교생활', '가족']
const KIPRIS_URL = 'https://www.kipris.or.kr/khome/main.do'
const SESSION_KEY = 'pro10-current-session-id'
const DRAFT_KEY = 'pro10-seed-draft'

function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return `sess_${Date.now()}`
  }
}

const sessionId = getOrCreateSessionId()

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="seed-page">
    <header class="seed-header">
      <h1>나의 발명 씨앗 찾기</h1>
      <p class="seed-subtitle">관심사와 평소 느꼈던 불편함을 적어 보면, 발명 아이디어로 자라날 핵심 키워드를 AI가 추천해 줘요.</p>
    </header>

    <div class="seed-grid">
      <section class="seed-card" aria-labelledby="seed-input-title">
        <h2 id="seed-input-title">관심사 & 불편함 적기</h2>
        <p class="seed-card-desc">관심 있는 분야를 골라 보고, 평소에 겪었던 불편함을 한 문장으로 적어 주세요.</p>

        <div class="seed-section">
          <strong>1. 관심사 버블 (여러 개 선택 가능)</strong>
          <div class="chip-list" id="interest-chip-list"></div>

          <div class="custom-input-row">
            <input
              type="text"
              id="custom-interest-input"
              maxlength="20"
              placeholder="직접 입력 후 Enter / 추가 버튼 (예: 우주, 캠핑)"
              aria-label="직접 관심사 입력"
            />
            <button type="button" class="custom-add-btn" id="custom-interest-add">+ 추가</button>
          </div>
        </div>

        <div class="seed-section">
          <strong>2. 불편함 입력</strong>
          <label for="discomfort-text" class="seed-card-desc" style="margin:0;">
            언제 어디서 어떤 점이 불편했나요?
          </label>
          <textarea
            id="discomfort-text"
            class="discomfort-textarea"
            maxlength="400"
            placeholder="예) 비 오는 날 우산을 든 채 가방을 메면 어깨가 자꾸 젖어서 불편했어요."
          ></textarea>
        </div>

        <div class="seed-actions">
          <button type="button" class="btn-primary" id="recommend-btn">
            ✨ AI 키워드 추천 받기
          </button>
          <button type="button" class="btn-secondary" id="save-btn">현재 내용 저장하기</button>
          <button type="button" class="btn-secondary" id="reset-btn">처음부터 다시</button>
        </div>
        <div class="seed-status" id="seed-status" role="status" aria-live="polite"></div>
      </section>

      <aside class="seed-card ai-card" aria-labelledby="ai-title">
        <h2 id="ai-title">AI 추천 검색 키워드</h2>
        <p class="seed-card-desc">
          KIPRIS에서 비슷한 특허·실용신안을 찾을 때 쓰면 좋은 핵심 키워드 3개를 추천해 줘요.
        </p>
        <div class="ai-keywords" id="ai-keywords">
          <div class="ai-empty">
            왼쪽에서 관심사를 고르고 불편함을 적은 뒤<br />
            <strong>“AI 키워드 추천 받기”</strong> 버튼을 눌러 보세요.
          </div>
        </div>
      </aside>
    </div>

    <section class="kipris-card" aria-labelledby="kipris-title">
      <h2 id="kipris-title">명세서를 찾아볼 수 있는 사이트</h2>
      <p class="kipris-desc">
        AI가 추천해 준 키워드로 아래 사이트에서 비슷한 발명·특허 명세서를 검색해 보세요. 클릭하면 새 창에서 열립니다.
      </p>
      <div class="kipris-link-list">
        <a
          class="kipris-link"
          href="${KIPRIS_URL}"
          target="_blank"
          rel="noopener noreferrer"
          id="kipris-link"
        >
          키프리스(KIPRIS) 바로가기
        </a>
      </div>
      <div class="kipris-host">${KIPRIS_URL}</div>
    </section>
  </div>
`

const chipList = document.querySelector('#interest-chip-list')
const customInput = document.querySelector('#custom-interest-input')
const customAddBtn = document.querySelector('#custom-interest-add')
const discomfortText = document.querySelector('#discomfort-text')
const recommendBtn = document.querySelector('#recommend-btn')
const saveBtn = document.querySelector('#save-btn')
const resetBtn = document.querySelector('#reset-btn')
const statusEl = document.querySelector('#seed-status')
const aiBox = document.querySelector('#ai-keywords')

const selectedInterests = new Set()
const customInterests = []
let lastRecommendedKeywords = []

function sanitize(value) {
  if (value == null) return ''
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

function setStatus(message, kind = '') {
  statusEl.textContent = message || ''
  statusEl.classList.remove('is-error', 'is-success')
  if (kind === 'error') statusEl.classList.add('is-error')
  if (kind === 'success') statusEl.classList.add('is-success')
}

function renderChips() {
  const seen = new Set()
  const items = []
  for (const word of DEFAULT_INTERESTS) {
    if (seen.has(word)) continue
    seen.add(word)
    items.push({ word, removable: false })
  }
  for (const word of customInterests) {
    const trimmed = word.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    items.push({ word: trimmed, removable: true })
  }

  chipList.innerHTML = items
    .map((item) => {
      const isActive = selectedInterests.has(item.word)
      const cls = ['chip']
      if (item.removable) cls.push('chip-custom')
      if (isActive) cls.push('is-selected')
      return `
        <button
          type="button"
          class="${cls.join(' ')}"
          data-word="${sanitize(item.word)}"
          aria-pressed="${isActive ? 'true' : 'false'}"
        >
          <span>${sanitize(item.word)}</span>
          ${
            item.removable
              ? `<span class="chip-remove" data-remove="${sanitize(item.word)}" title="삭제" aria-label="${sanitize(item.word)} 삭제">×</span>`
              : ''
          }
        </button>
      `
    })
    .join('')
}

renderChips()

chipList.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('[data-remove]')
  if (removeBtn) {
    e.stopPropagation()
    const w = removeBtn.getAttribute('data-remove')
    const idx = customInterests.indexOf(w)
    if (idx >= 0) customInterests.splice(idx, 1)
    selectedInterests.delete(w)
    renderChips()
    persistDraft()
    return
  }
  const chip = e.target.closest('.chip')
  if (!chip) return
  const word = chip.getAttribute('data-word')
  if (!word) return
  if (selectedInterests.has(word)) {
    selectedInterests.delete(word)
  } else {
    selectedInterests.add(word)
  }
  renderChips()
  persistDraft()
})

function addCustomInterest() {
  const raw = customInput.value.trim()
  if (!raw) return
  const word = raw.replace(/\s+/g, ' ')
  if (word.length > 20) {
    setStatus('관심사는 20자 이내로 입력해 주세요.', 'error')
    return
  }
  if (!DEFAULT_INTERESTS.includes(word) && !customInterests.includes(word)) {
    customInterests.push(word)
  }
  selectedInterests.add(word)
  customInput.value = ''
  setStatus('')
  renderChips()
  persistDraft()
}

customAddBtn.addEventListener('click', addCustomInterest)
customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    addCustomInterest()
  }
})

discomfortText.addEventListener('input', () => {
  persistDraft()
})

function persistDraft() {
  try {
    const payload = {
      interests: [...selectedInterests],
      customInterests: [...customInterests],
      discomfort: discomfortText.value || '',
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (Array.isArray(data?.customInterests)) {
      for (const w of data.customInterests) {
        if (typeof w === 'string' && w.trim() && !customInterests.includes(w.trim())) {
          customInterests.push(w.trim())
        }
      }
    }
    if (Array.isArray(data?.interests)) {
      for (const w of data.interests) {
        if (typeof w === 'string' && w.trim()) selectedInterests.add(w.trim())
      }
    }
    if (typeof data?.discomfort === 'string') {
      discomfortText.value = data.discomfort
    }
    renderChips()
  } catch {
    /* ignore */
  }
}

restoreDraft()

function getCurrentSelections() {
  const interests = [...selectedInterests].filter((w) => typeof w === 'string' && w.trim())
  const discomfort = discomfortText.value.trim()
  return { interests, discomfort }
}

function validateForRecommendation() {
  const { interests, discomfort } = getCurrentSelections()
  if (interests.length === 0 && !discomfort) {
    return { ok: false, message: '관심사를 1개 이상 고르거나 불편함을 적어 주세요.' }
  }
  return { ok: true, interests, discomfort }
}

async function callOpenAiForKeywords(interests, discomfort) {
  if (!OPENAI_API_KEY) {
    throw new Error('AI 키가 설정되지 않았어요. (VITE_OPENAI_API_KEY)')
  }

  const prompt = `너는 중학생의 발명 아이디어 코치야. 학생이 고른 관심사와 불편함을 보고, KIPRIS(한국 특허 검색 서비스)에서 비슷한 특허·실용신안을 찾기 위한 핵심 키워드 3개를 추천해 줘.

[학생 정보]
- 관심사: ${interests.length ? interests.join(', ') : '(선택하지 않음)'}
- 불편함: ${discomfort || '(작성하지 않음)'}

[추천 규칙 — 매우 중요]
- 키워드와 설명 모두 반드시 "한글"로만 작성해. 한자(漢字), 일본어, 영어, 특수문자는 절대 사용하지 마.
  · 예시 (잘못된 예): "雨傘", "rain umbrella", "雨가리개"
  · 예시 (좋은 예): "우산", "방수가방", "어깨끈"
- 키워드는 명사 위주로 1~2단어, 5~10자 이내로 짧게.
- 중학생이 직접 입력해서 검색하기 쉬운, 친숙하고 일상적인 단어로 골라줘.
- 너무 일반적인 단어(예: "물건", "사람")는 피하고, 발명·기술과 연결되는 단어로.
- 각 키워드마다 "왜 이 키워드를 추천하는지" 중학생도 이해하기 쉬운 말로 한 문장 설명. 설명에도 한자를 쓰지 마.
- 정확히 3개를 추천.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "keywords": [
    { "term": "키워드1", "reason": "추천 이유 한 문장" },
    { "term": "키워드2", "reason": "추천 이유 한 문장" },
    { "term": "키워드3", "reason": "추천 이유 한 문장" }
  ]
}`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || `AI 호출 오류 (${response.status})`)
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) throw new Error('AI 응답을 읽을 수 없어요.')

  const parsed = parseAiJson(aiText)
  if (!parsed || !Array.isArray(parsed.keywords)) {
    throw new Error('AI 응답을 JSON으로 해석하지 못했어요.')
  }
  return parsed.keywords
    .filter((k) => k && typeof k.term === 'string' && k.term.trim())
    .slice(0, 3)
    .map((k) => ({
      term: cleanKoreanText(k.term),
      reason: cleanKoreanText(typeof k.reason === 'string' ? k.reason : ''),
    }))
    .filter((k) => k.term)
}

function cleanKoreanText(text) {
  if (text == null) return ''
  let cleaned = String(text)
  cleaned = cleaned.replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '')
  cleaned = cleaned.replace(/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/g, '')
  cleaned = cleaned.replace(/[（）()]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  return cleaned
}

function extractAiText(result) {
  if (!result) return null
  if (Array.isArray(result.output)) {
    for (const block of result.output) {
      if (!Array.isArray(block?.content)) continue
      for (const piece of block.content) {
        if (piece?.type === 'output_text') {
          return Array.isArray(piece.text) ? piece.text.join('') : piece.text
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
  if (!rawText) return null
  const trimmed = String(rawText).trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const openIndex = candidate.indexOf('{')
  const closeIndex = candidate.lastIndexOf('}')
  const jsonSlice =
    openIndex !== -1 && closeIndex !== -1 && closeIndex > openIndex
      ? candidate.slice(openIndex, closeIndex + 1)
      : candidate
  try {
    return JSON.parse(jsonSlice)
  } catch (err) {
    console.error('AI JSON 파싱 실패', err, rawText)
    return null
  }
}

function renderAiKeywords(keywords) {
  if (!keywords || keywords.length === 0) {
    aiBox.innerHTML = `
      <div class="ai-empty">추천 결과가 없어요. 다시 시도해 보세요.</div>
    `
    return
  }
  aiBox.innerHTML = keywords
    .map((k, i) => {
      return `
        <div class="ai-keyword-item">
          <div class="ai-keyword-index">${i + 1}</div>
          <div class="ai-keyword-body">
            <div class="ai-keyword-term">${sanitize(k.term)}</div>
            ${k.reason ? `<div class="ai-keyword-reason">${sanitize(k.reason)}</div>` : ''}
          </div>
        </div>
      `
    })
    .join('')
}

recommendBtn.addEventListener('click', async () => {
  const valid = validateForRecommendation()
  if (!valid.ok) {
    setStatus(valid.message, 'error')
    return
  }
  setStatus('')
  recommendBtn.disabled = true
  const prevLabel = recommendBtn.textContent
  recommendBtn.textContent = '추천 받는 중...'
  aiBox.innerHTML = `<div class="ai-loading">AI가 발명 씨앗에 어울리는 키워드를 고르고 있어요...</div>`

  try {
    const keywords = await callOpenAiForKeywords(valid.interests, valid.discomfort)
    lastRecommendedKeywords = keywords
    renderAiKeywords(keywords)
    setStatus('AI 키워드를 추천했어요. 자동으로 저장합니다.', 'success')
    await saveToFirebase({ silent: true })
  } catch (err) {
    console.error('AI 추천 오류:', err)
    aiBox.innerHTML = `<div class="ai-empty">추천에 실패했어요.<br />${sanitize(err.message || '잠시 후 다시 시도해 주세요.')}</div>`
    setStatus(err.message || 'AI 추천에 실패했어요.', 'error')
  } finally {
    recommendBtn.disabled = false
    recommendBtn.textContent = prevLabel
  }
})

async function saveToFirebase({ silent = false } = {}) {
  const { interests, discomfort } = getCurrentSelections()
  if (interests.length === 0 && !discomfort && lastRecommendedKeywords.length === 0) {
    if (!silent) setStatus('저장할 내용이 없어요. 관심사나 불편함을 먼저 입력해 주세요.', 'error')
    return false
  }

  const userId = localStorage.getItem('userId') || ''
  const userName = localStorage.getItem('userName') || ''
  const userEmail = localStorage.getItem('userEmail') || ''

  const firebaseResult = initFirebase()
  if (!firebaseResult?.db) {
    if (!silent) setStatus('Firebase가 준비되지 않아 저장하지 못했어요.', 'error')
    return false
  }

  try {
    const ref = collection(firebaseResult.db, 'userProgress')
    await addDoc(ref, {
      sessionId,
      userId: userId || null,
      userName: userName || null,
      userEmail: userEmail || null,
      step: 'seed',
      interests,
      customInterests: [...customInterests],
      discomfort,
      recommendedKeywords: lastRecommendedKeywords,
      createdAt: serverTimestamp(),
    })
    if (!silent) setStatus('Firebase에 저장했어요!', 'success')
    return true
  } catch (err) {
    console.error('Firebase 저장 오류:', err)
    if (!silent) setStatus(`저장 중 오류가 발생했어요: ${err.message || ''}`, 'error')
    return false
  }
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true
  const prev = saveBtn.textContent
  saveBtn.textContent = '저장 중...'
  try {
    await saveToFirebase({ silent: false })
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = prev
  }
})

resetBtn.addEventListener('click', () => {
  if (!confirm('지금 입력한 관심사와 불편함을 모두 지울까요?')) return
  selectedInterests.clear()
  customInterests.length = 0
  discomfortText.value = ''
  lastRecommendedKeywords = []
  renderChips()
  aiBox.innerHTML = `
    <div class="ai-empty">
      왼쪽에서 관심사를 고르고 불편함을 적은 뒤<br />
      <strong>“AI 키워드 추천 받기”</strong> 버튼을 눌러 보세요.
    </div>
  `
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
  setStatus('처음 상태로 돌아갔어요.', 'success')
})
