import './student2.css'

const app = document.querySelector('#ai-app')

app.innerHTML = `
  <div class="ai-shell">
    <header>
      <p>명세서를 붙여넣고 버튼을 누르면 명세서 요약봇이 핵심을 뽑아줍니다.</p>
      <h1>특허 명세서 요약 분석</h1>
    </header>

    <section class="prompt-area">
      <label for="spec-input">명세서 전문</label>
      <textarea
        id="spec-input"
        placeholder="예) 본 발명은 ... (PDF에서 복사한 텍스트를 붙여넣으세요)"
      ></textarea>
    </section>

    <div class="actions-row">
      <span id="status-pill" class="status-pill">준비 완료</span>
      <button id="analyze-btn" class="primary-btn" type="button">AI 분석 요청</button>
    </div>

    <section class="cards-grid" id="results-grid">
      ${createCard('특허 이름', ['입력 대기'])}
      ${createCard('출원 번호', ['입력 대기'])}
      ${createCard('발명품의 특징', ['입력 대기'])}
      ${createCard('발명품의 재료', ['입력 대기'])}
    </section>
  </div>
`

const specInput = document.querySelector('#spec-input')
const analyzeBtn = document.querySelector('#analyze-btn')
const statusPill = document.querySelector('#status-pill')
const resultsGrid = document.querySelector('#results-grid')

const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

analyzeBtn.addEventListener('click', async () => {
  const spec = specInput.value.trim()

  if (!spec) {
    setStatus('명세서를 입력해 주세요.', 'warn')
    specInput.focus()
    return
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    setStatus('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.', 'error')
    return
  }

  toggleProcessing(true)
  setStatus('명세서 요약봇이 명세서를 분석 중입니다. 잠시만 기다려 주세요...')

  try {
    const payload = await requestAnalysis(apiKey, spec)
    renderResults(payload)
    setStatus('분석 완료!', 'success')
  } catch (error) {
    console.error(error)
    setStatus(error.message || '분석에 실패했습니다.', 'error')
  } finally {
    toggleProcessing(false)
  }
})

function renderResults(data) {
  const {
    patentName = '',
    applicationNumber = '',
    features = [],
    materials = [],
  } = data || {}

  resultsGrid.innerHTML = [
    createCard('특허 이름', patentName || '제공되지 않음'),
    createCard('출원 번호', applicationNumber || '제공되지 않음'),
    createCard('발명품의 특징', withFallbackList(features)),
    createCard('발명품의 재료', withFallbackList(materials)),
  ].join('')
}

function withFallbackList(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return ['정보 없음']
}

function createCard(title, value) {
  const content =
    Array.isArray(value) && value.length > 0
      ? `<ul>${value.map((item) => `<li>${sanitize(item)}</li>`).join('')}</ul>`
      : `<div class="value">${sanitize(value)}</div>`

  return `
    <article class="info-card">
      <h2>${title}</h2>
      ${content}
    </article>
  `
}

function sanitize(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function setStatus(message, mode = 'info') {
  statusPill.textContent = message
  statusPill.dataset.mode = mode
}

function toggleProcessing(isBusy) {
  analyzeBtn.disabled = isBusy
  specInput.disabled = isBusy
}

async function requestAnalysis(apiKey, specText) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: [
                '너는 특허 명세서를 네 가지 항목으로 요약하는 전문가야.',
                '반드시 다음 JSON 스키마에 맞춰 돌려줘:',
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
                '정보가 없으면 빈 문자열이나 빈 배열을 사용해.',
              ].join('\n'),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `다음 명세서를 분석해 줘:\n${specText}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorPayload = await safeJson(response)
    const message =
      errorPayload?.error?.message ||
      `API 오류 (${response.status}) - ${response.statusText}`
    throw new Error(message)
  }

  const result = await response.json()
  const aiText =
    result?.output?.[0]?.content?.[0]?.text ||
    result?.output_text?.[0] ||
    result?.choices?.[0]?.message?.content

  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  try {
    return JSON.parse(aiText)
  } catch (error) {
    console.error('JSON parse error', error, aiText)
    throw new Error('AI 응답을 JSON으로 해석하지 못했습니다.')
  }
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

