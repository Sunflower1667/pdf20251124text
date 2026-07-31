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
      <p class="seed-subtitle">평소에 불편했던 게 있나요? 거기서 발명 아이디어가 시작되요!</p>
    </header>

    <div class="seed-grid">
      <section class="seed-card" aria-labelledby="seed-input-title">
        <h2 id="seed-input-title">관심사 & 불편함 적기</h2>
        <p class="seed-card-desc">관심 있는 분야를 골라 보고, 평소에 겪었던 불편함을 한 문장으로 적어 주세요.</p>

        <div class="seed-section">
          <strong>관심 있는 분야를 골라봐요 — 여러 개도 OK!</strong>
          <div class="chip-list" id="interest-chip-list"></div>
          <p class="chip-counter" id="interest-counter" hidden></p>

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
          <strong>그 분야에서 불편했던 점을 써봐요</strong>
          <textarea
            id="discomfort-text"
            class="discomfort-textarea"
            maxlength="400"
            placeholder="예: 캠핑 가서 설거지할 때 물이 없어서 너무 힘들었어"
          ></textarea>
          <p class="discomfort-hint">정답은 없어요! 떠오르는 대로 써봐요!</p>
        </div>

        <div class="seed-actions">
          <button type="button" class="btn-primary" id="recommend-btn">
            ✦ AI가 키워드 뽑아줄게요
          </button>
          <button type="button" class="btn-secondary" id="save-btn">저장</button>
          <button type="button" class="btn-ghost" id="reset-btn">다시 쓸게요</button>
        </div>
        <div class="seed-status" id="seed-status" role="status" aria-live="polite"></div>
      </section>

      <aside class="seed-card ai-card" aria-labelledby="ai-title">
        <h2 id="ai-title">AI 추천 검색 키워드</h2>
        <p class="seed-card-desc">
          KIPRIS에서 비슷한 특허·실용신안을 찾을 때 쓰면 좋은 핵심 키워드 3개와,
          검색할 때 스스로 점검해 볼 질문 3개를 추천해 줘요.
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

    <section class="patent-select-card" aria-labelledby="patent-select-title">
      <h2 id="patent-select-title">고른 발명 정리하기</h2>
      <p class="patent-select-desc">
        KIPRIS에서 마음에 드는 발명 하나를 골랐다면, 읽은 내용을 적어 보세요. AI가 선택이 잘 됐는지 점검해 줄게요.
      </p>

      <div class="patent-form-grid">
        <label class="patent-field">
          <span class="patent-label">실제로 검색한 키워드</span>
          <input
            type="text"
            id="searched-keyword"
            class="patent-input"
            maxlength="40"
            placeholder="예: 방수 가방"
          />
        </label>

        <label class="patent-field">
          <span class="patent-label">고른 발명의 이름 <em class="patent-required">필수</em></span>
          <input
            type="text"
            id="patent-title"
            class="patent-input"
            maxlength="120"
            placeholder="예: 휴대용 접이식 세척기"
          />
        </label>

        <label class="patent-field">
          <span class="patent-label">출원번호 또는 등록번호</span>
          <input
            type="text"
            id="patent-number"
            class="patent-input"
            maxlength="40"
            placeholder="예: 10-2020-0123456"
          />
        </label>

        <label class="patent-field patent-field-full">
          <span class="patent-label">이해한 내용 한 줄 요약 <em class="patent-required">필수</em></span>
          <textarea
            id="patent-summary"
            class="patent-textarea"
            maxlength="400"
            placeholder="예: 물 없이도 설거지할 수 있게 작은 세척기를 접어서 들고 다니는 발명이에요."
          ></textarea>
        </label>
      </div>

      <div class="patent-select-actions">
        <button type="button" class="btn-primary" id="patent-check-btn">
          ✦ AI에게 선택 점검 받기
        </button>
      </div>
      <div class="patent-check-status" id="patent-check-status" role="status" aria-live="polite"></div>
      <div class="patent-feedback" id="patent-feedback"></div>
    </section>
  </div>
`

const chipList = document.querySelector('#interest-chip-list')
const interestCounter = document.querySelector('#interest-counter')
const customInput = document.querySelector('#custom-interest-input')
const customAddBtn = document.querySelector('#custom-interest-add')
const discomfortText = document.querySelector('#discomfort-text')
const recommendBtn = document.querySelector('#recommend-btn')
const saveBtn = document.querySelector('#save-btn')
const resetBtn = document.querySelector('#reset-btn')
const statusEl = document.querySelector('#seed-status')
const aiBox = document.querySelector('#ai-keywords')
const searchedKeywordInput = document.querySelector('#searched-keyword')
const patentTitleInput = document.querySelector('#patent-title')
const patentNumberInput = document.querySelector('#patent-number')
const patentSummaryInput = document.querySelector('#patent-summary')
const patentCheckBtn = document.querySelector('#patent-check-btn')
const patentCheckStatusEl = document.querySelector('#patent-check-status')
const patentFeedbackBox = document.querySelector('#patent-feedback')

const selectedInterests = new Set()
const customInterests = []
let lastRecommendedKeywords = []
let lastRecommendedQuestions = []
let lastPatentSelectionFeedback = null

const PATENT_LEVEL_CLASS = {
  '좋아요': 'is-good',
  '조금 더': 'is-more',
  '다시 보기': 'is-retry',
}

function sanitize(value) {
  if (value == null) return ''
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

function setPatentStatus(message, kind = '') {
  if (!patentCheckStatusEl) return
  patentCheckStatusEl.textContent = message || ''
  patentCheckStatusEl.classList.remove('is-error', 'is-success')
  if (kind === 'error') patentCheckStatusEl.classList.add('is-error')
  if (kind === 'success') patentCheckStatusEl.classList.add('is-success')
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

  updateInterestCounter()
}

function updateInterestCounter() {
  if (!interestCounter) return
  const count = selectedInterests.size
  if (count === 0) {
    interestCounter.hidden = true
    interestCounter.textContent = ''
    return
  }
  interestCounter.hidden = false
  interestCounter.textContent = `✓ ${count}개 선택됨 — 더 골라도 좋아!`
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

function getSelectedPatentInput() {
  return {
    searchedKeyword: searchedKeywordInput?.value.trim() || '',
    patentTitle: patentTitleInput?.value.trim() || '',
    patentNumber: patentNumberInput?.value.trim() || '',
    patentSummary: patentSummaryInput?.value.trim() || '',
  }
}

function persistDraft() {
  try {
    const payload = {
      interests: [...selectedInterests],
      customInterests: [...customInterests],
      discomfort: discomfortText.value || '',
      selectedPatent: getSelectedPatentInput(),
      patentSelectionFeedback: lastPatentSelectionFeedback,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function bindPatentInputPersistence() {
  for (const el of [
    searchedKeywordInput,
    patentTitleInput,
    patentNumberInput,
    patentSummaryInput,
  ]) {
    el?.addEventListener('input', persistDraft)
  }
}

bindPatentInputPersistence()

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
    if (data?.selectedPatent && typeof data.selectedPatent === 'object') {
      const p = data.selectedPatent
      if (searchedKeywordInput && typeof p.searchedKeyword === 'string') {
        searchedKeywordInput.value = p.searchedKeyword
      }
      if (patentTitleInput && typeof p.patentTitle === 'string') {
        patentTitleInput.value = p.patentTitle
      }
      if (patentNumberInput && typeof p.patentNumber === 'string') {
        patentNumberInput.value = p.patentNumber
      }
      if (patentSummaryInput && typeof p.patentSummary === 'string') {
        patentSummaryInput.value = p.patentSummary
      }
    }
    if (data?.patentSelectionFeedback && typeof data.patentSelectionFeedback === 'object') {
      lastPatentSelectionFeedback = data.patentSelectionFeedback
      renderPatentFeedback(lastPatentSelectionFeedback)
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

async function requestOpenAi(prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('AI 키가 설정되지 않았어요. (VITE_OPENAI_API_KEY)')
  }

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
  return aiText
}

async function callOpenAiForKeywords(interests, discomfort) {
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

  const aiText = await requestOpenAi(prompt)
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

async function callOpenAiForQuestions(interests, discomfort, keywords) {
  const prompt = `너는 중학생의 발명 아이디어 코치야. 학생이 이제 KIPRIS에서 특허를 검색하러 갈 참이야.
학생이 아무거나 고르지 않고 스스로 기준을 세워서 고를 수 있도록,
스스로에게 던져 볼 점검 질문 3개를 만들어 줘.

[학생 정보]
- 관심사: ${interests.length ? interests.join(', ') : '(선택하지 않음)'}
- 불편함: ${discomfort || '(작성하지 않음)'}
- 추천받은 키워드: ${keywords.map((k) => k.term).join(', ')}

[질문 규칙 — 매우 중요]
- 반드시 질문만 만들어. 답, 예시 답안, 정답을 알려 주지 마.
- 3개 질문은 각각 다른 것을 점검하게 해.
  1번은 검색 방향(어떤 키워드로 어떻게 찾을지),
  2번은 고른 발명이 내 불편함과 이어지는지,
  3번은 그 발명에 아직 아쉬운 점이 남아 있는지.
- 학생이 쓴 불편함에 나오는 말을 질문 안에 그대로 넣어서 자기 이야기처럼 느끼게 해.
- 한 질문은 한 문장, 40자 이내로 짧게.
- "예/아니오"로 끝나는 질문 대신, 이유를 말하게 하는 질문으로 만들어.
- 반드시 한글로만 써. 한자(漢字), 일본어, 영어는 절대 쓰지 마.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "questions": [
    { "focus": "검색 방향", "question": "질문 한 문장" },
    { "focus": "연결성", "question": "질문 한 문장" },
    { "focus": "발전 가능성", "question": "질문 한 문장" }
  ]
}`

  const aiText = await requestOpenAi(prompt)
  const parsed = parseAiJson(aiText)
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error('점검 질문 응답을 JSON으로 해석하지 못했어요.')
  }
  return parsed.questions
    .filter((q) => q && typeof q.question === 'string' && q.question.trim())
    .slice(0, 3)
    .map((q) => ({
      focus: cleanKoreanText(typeof q.focus === 'string' ? q.focus : ''),
      question: cleanKoreanText(q.question),
    }))
    .filter((q) => q.question)
}

async function callOpenAiForPatentCheck(interests, discomfort, selectedPatent) {
  const { searchedKeyword, patentTitle, patentNumber, patentSummary } = selectedPatent
  const prompt = `너는 중학생의 발명 아이디어 코치야. 학생이 KIPRIS에서 직접 찾아 고른 발명 하나를 보고,
그 선택이 잘 된 선택인지 두 가지 기준으로 점검해 주고 다음에 무엇을 하면 좋을지 알려 줘.

[학생 정보]
- 관심사: ${interests.join(', ')}
- 불편함: ${discomfort}
- 실제로 검색한 키워드: ${searchedKeyword || '(적지 않음)'}
- 고른 발명의 이름: ${patentTitle}
- 출원번호 또는 등록번호: ${patentNumber || '(적지 않음)'}
- 학생이 이해한 내용 한 줄 요약: ${patentSummary}

[점검 기준]
1. 관심사 연결성 — 고른 발명이 학생의 관심사, 불편함과 실제로 이어지는가
2. 발전 가능성 — 이 발명을 더 좋게 바꿀 여지가 남아 있는가

[피드백 규칙 — 매우 중요]
- 학생 대신 다른 발명을 골라 주거나 추천하지 마. 지금 고른 것을 어떻게 점검할지만 알려 줘.
- 새로운 아이디어를 대신 만들어 주지 마. 그건 나중에 학생이 직접 할 일이야.
- 기준마다 "좋아요 / 조금 더 / 다시 보기" 중 하나를 고르고, 왜 그렇게 봤는지 한 문장으로 설명해.
- "다시 보기"일 때도 무엇을 고치라고 지시하지 말고, 스스로 다시 살펴볼 곳만 짚어 줘.
- 학생이 쓴 요약이 짧거나 서툴면 설명을 더 쉽고 자세하게, 길고 자세하면 간결하게 맞춰서 써.
- 반드시 한글로만 써. 한자(漢字), 일본어, 영어는 절대 쓰지 마.
  특허 문서에 나오는 어려운 말은 중학생이 아는 쉬운 말로 바꿔서 써.
- 마지막에 다음에 할 일 한 가지를 한 문장으로 알려 줘.
  오늘 할 일은 "발명 찾아서 고르기"까지야. 그 뒤 활동은 말하지 마.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "checks": [
    { "criterion": "관심사 연결성", "level": "좋아요", "comment": "한 문장 설명" },
    { "criterion": "발전 가능성", "level": "조금 더", "comment": "한 문장 설명" }
  ],
  "nextStep": "다음에 할 일 한 문장"
}`

  const aiText = await requestOpenAi(prompt)
  const parsed = parseAiJson(aiText)
  if (!parsed || !Array.isArray(parsed.checks)) {
    throw new Error('선택 점검 응답을 JSON으로 해석하지 못했어요.')
  }

  const checks = parsed.checks
    .filter((c) => c && typeof c.comment === 'string' && c.comment.trim())
    .slice(0, 2)
    .map((c) => ({
      criterion: cleanKoreanText(typeof c.criterion === 'string' ? c.criterion : ''),
      level: cleanKoreanText(typeof c.level === 'string' ? c.level : ''),
      comment: cleanKoreanText(c.comment),
    }))
    .filter((c) => c.comment)

  const nextStep = cleanKoreanText(typeof parsed.nextStep === 'string' ? parsed.nextStep : '')
  if (checks.length === 0 || !nextStep) {
    throw new Error('선택 점검 결과가 충분하지 않아요.')
  }

  return { checks, nextStep }
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

function renderAiResults(keywords, questions = []) {
  if (!keywords || keywords.length === 0) {
    aiBox.innerHTML = `
      <div class="ai-empty">추천 결과가 없어요. 다시 시도해 보세요.</div>
    `
    return
  }

  const keywordsHtml = keywords
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

  const questionsHtml =
    questions.length > 0
      ? `
        <div class="ai-questions-section">
          <h3 class="ai-questions-title">KIPRIS 검색 전, 스스로에게 물어봐요</h3>
          ${questions
            .map((q, i) => {
              return `
                <div class="ai-question-item">
                  <div class="ai-question-index">${i + 1}</div>
                  <div class="ai-question-body">
                    ${q.focus ? `<div class="ai-question-focus">${sanitize(q.focus)}</div>` : ''}
                    <div class="ai-question-text">${sanitize(q.question)}</div>
                  </div>
                </div>
              `
            })
            .join('')}
        </div>
      `
      : ''

  aiBox.innerHTML = keywordsHtml + questionsHtml
}

function renderPatentFeedback(feedback) {
  if (!patentFeedbackBox) return
  if (!feedback || !Array.isArray(feedback.checks) || feedback.checks.length === 0) {
    patentFeedbackBox.innerHTML = ''
    return
  }

  const checksHtml = feedback.checks
    .map((c) => {
      const levelClass = PATENT_LEVEL_CLASS[c.level] || ''
      return `
        <div class="patent-check-item">
          <div class="patent-check-head">
            <span class="patent-check-criterion">${sanitize(c.criterion || '점검')}</span>
            <span class="patent-check-level ${levelClass}">${sanitize(c.level || '')}</span>
          </div>
          <p class="patent-check-comment">${sanitize(c.comment)}</p>
        </div>
      `
    })
    .join('')

  const nextStepHtml = feedback.nextStep
    ? `
      <div class="patent-next-step">
        <strong>다음에 할 일</strong>
        <p>${sanitize(feedback.nextStep)}</p>
      </div>
    `
    : ''

  patentFeedbackBox.innerHTML = `
    <div class="patent-feedback-inner">
      <h3 class="patent-feedback-title">AI 선택 점검 결과</h3>
      ${checksHtml}
      ${nextStepHtml}
    </div>
  `
}

function validatePatentCheck() {
  const { interests, discomfort } = getCurrentSelections()
  const selectedPatent = getSelectedPatentInput()

  if (!selectedPatent.patentTitle) {
    return { ok: false, message: '고른 발명의 이름을 적어 주세요.' }
  }
  if (!selectedPatent.patentSummary) {
    return { ok: false, message: '이해한 내용 한 줄 요약을 적어 주세요.' }
  }
  if (interests.length === 0 && !discomfort) {
    return { ok: false, message: '위쪽에서 관심사나 불편함을 먼저 적어 주세요.' }
  }

  return { ok: true, interests, discomfort, selectedPatent }
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
  aiBox.innerHTML = `<div class="ai-loading">AI가 키워드와 검색 점검 질문을 만들고 있어요...</div>`

  try {
    const keywords = await callOpenAiForKeywords(valid.interests, valid.discomfort)
    const questions = await callOpenAiForQuestions(valid.interests, valid.discomfort, keywords)
    lastRecommendedKeywords = keywords
    lastRecommendedQuestions = questions
    renderAiResults(keywords, questions)
    setStatus('AI 키워드와 점검 질문을 추천했어요. 자동으로 저장합니다.', 'success')
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

patentCheckBtn.addEventListener('click', async () => {
  const valid = validatePatentCheck()
  if (!valid.ok) {
    setPatentStatus(valid.message, 'error')
    return
  }

  setPatentStatus('')
  patentCheckBtn.disabled = true
  const prevLabel = patentCheckBtn.textContent
  patentCheckBtn.textContent = '점검 받는 중...'
  patentFeedbackBox.innerHTML = `<div class="ai-loading">AI가 고른 발명을 점검하고 있어요...</div>`

  try {
    const feedback = await callOpenAiForPatentCheck(
      valid.interests,
      valid.discomfort,
      valid.selectedPatent
    )
    lastPatentSelectionFeedback = feedback
    renderPatentFeedback(feedback)
    persistDraft()
    setPatentStatus('선택 점검 결과를 정리했어요. 자동으로 저장합니다.', 'success')
    await saveToFirebase({ silent: true })
  } catch (err) {
    console.error('선택 점검 오류:', err)
    patentFeedbackBox.innerHTML = `<div class="ai-empty">점검에 실패했어요.<br />${sanitize(err.message || '잠시 후 다시 시도해 주세요.')}</div>`
    setPatentStatus(err.message || '선택 점검에 실패했어요.', 'error')
  } finally {
    patentCheckBtn.disabled = false
    patentCheckBtn.textContent = prevLabel
  }
})

async function saveToFirebase({ silent = false } = {}) {
  const { interests, discomfort } = getCurrentSelections()
  const selectedPatent = getSelectedPatentInput()
  const hasPatentInput =
    selectedPatent.searchedKeyword ||
    selectedPatent.patentTitle ||
    selectedPatent.patentNumber ||
    selectedPatent.patentSummary
  if (
    interests.length === 0 &&
    !discomfort &&
    lastRecommendedKeywords.length === 0 &&
    !hasPatentInput &&
    !lastPatentSelectionFeedback
  ) {
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
      recommendedQuestions: lastRecommendedQuestions,
      selectedPatent,
      patentSelectionFeedback: lastPatentSelectionFeedback,
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
  lastRecommendedQuestions = []
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
