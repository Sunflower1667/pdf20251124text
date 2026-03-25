import './inventionSpec.css'

const STORAGE_KEY = 'myInventionSpecDraft'

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
    hint: '「발명품 표현하기」에서 그린 그림이 있다면, 그림에서 무엇을 나타내는지 적어 보세요.',
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
        앞 단계에서 떠올린 발명을, 특허 명세서와 비슷한 항목에 맞춰 정리해 보세요. 작성 내용은 이 기기에 임시 저장됩니다.
      </p>
    </header>
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
    <p class="save-hint" id="save-status" aria-live="polite"></p>
  </div>
`

const form = document.getElementById('spec-form')
const statusEl = document.getElementById('save-status')

FIELDS.forEach((f) => {
  const el = document.getElementById(f.id)
  if (el && initial[f.id] != null) el.value = String(initial[f.id])
})

let t = null
form.addEventListener('input', () => {
  const data = {}
  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id)
    if (el) data[f.id] = el.value
  })
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
})
