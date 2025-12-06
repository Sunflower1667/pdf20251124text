import './idea.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const app = document.querySelector('#app')

// localStorage에서 분석 데이터 가져오기
const analysisData = JSON.parse(localStorage.getItem('analysisData') || '{}')
const extractedText = localStorage.getItem('extractedText') || ''

if (!analysisData || Object.keys(analysisData).length === 0) {
  app.innerHTML = `
    <div class="shell">
      <h1>명세서 분석 데이터가 없습니다.</h1>
      <p>먼저 메인 페이지에서 명세서를 분석해 주세요.</p>
      <a href="index.html" class="back-btn">메인 페이지로 돌아가기</a>
    </div>
  `
} else {
  app.innerHTML = `
    <div class="shell">
      <header>
        <h1>발명 아이디어 창출</h1>
        <p class="subtitle">명세서를 바탕으로, 만들고 싶은 키워드를 활용해 새로운 발명 아이디어를 만들어보고 구체화해보세요.</p>
      </header>

      <section class="idea-generation">
        <div class="section-header">
          <h2>1단계: 아이디어 생성</h2>
          <p class="section-description">
            만들고 싶은 발명과 관련된 단어를 <strong>3개</strong> 입력한 뒤, 아이디어 생성을 눌러보세요.
            (예: 스마트폰 거치대, 친환경, 접이식 → <strong>스마트폰 거치대, 친환경, 접이식</strong>)
          </p>
        </div>

        <div class="keyword-input-row">
          <label for="keyword-input" class="keyword-label">만들고 싶은 발명을 떠올리게 하는 단어 3개를 입력해 보세요.</label>
          <input
            id="keyword-input"
            type="text"
            class="keyword-input"
            placeholder="예: 스마트폰 거치대, 친환경, 접이식"
          />
        </div>

        <div class="section-header section-header-bottom">
          <div class="idea-buttons">
            <button id="generate-ideas-btn" type="button">아이디어 3개 생성하기</button>
            <button id="regenerate-ideas-btn" type="button" disabled style="display: none;">아이디어 다시 생성하기</button>
          </div>
        </div>
        <div id="ideas-container" class="ideas-container"></div>
      </section>

      <section class="chat-section" id="chat-section" style="display: none;">
        <div class="section-header">
          <h2>2단계: 발명 도우미 챗봇</h2>
          <p>선택한 아이디어를 구체화하기 위해 교사와 대화하듯이 질문해 보세요. 최대 10번까지 질문할 수 있고, 마지막에는 지금까지의 내용을 정리해 줍니다.</p>
        </div>
        <div id="selected-idea" class="selected-idea"></div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-container">
          <textarea id="chat-input" placeholder="아이디어에 대해 질문하거나 설명을 요청하세요..." rows="3"></textarea>
          <button id="send-btn" type="button">전송</button>
        </div>
        <div class="chat-actions">
          <button id="save-chat-btn" type="button" disabled>대화 내용 저장하기</button>
        </div>
      </section>

      <section class="refined-ideas" id="refined-ideas" style="display: none;">
        <div class="section-header">
          <h2>3단계: 구체화된 아이디어</h2>
        </div>
        <div id="refined-cards" class="refined-cards"></div>
        <div class="actions">
          <button id="save-result-btn" type="button">결과 저장하기</button>
        </div>
      </section>
    </div>
  `
}

const generateIdeasBtn = document.querySelector('#generate-ideas-btn')
const regenerateIdeasBtn = document.querySelector('#regenerate-ideas-btn')
const ideasContainer = document.querySelector('#ideas-container')
const chatSection = document.querySelector('#chat-section')
const selectedIdeaEl = document.querySelector('#selected-idea')
const chatMessages = document.querySelector('#chat-messages')
const chatInput = document.querySelector('#chat-input')
const sendBtn = document.querySelector('#send-btn')
const saveChatBtn = document.querySelector('#save-chat-btn')
const refinedIdeasSection = document.querySelector('#refined-ideas')
const refinedCards = document.querySelector('#refined-cards')
const saveResultBtn = document.querySelector('#save-result-btn')
const keywordInput = document.querySelector('#keyword-input')

const MAX_CHAT_TURNS = 10

let generatedIdeas = []
let selectedIdeaIndex = -1
let chatHistory = []
let refinedIdeasData = []
let lastKeywords = []

if (generateIdeasBtn) {
  generateIdeasBtn.addEventListener('click', async () => {
    // 키워드 입력 확인
    const { keywords, error } = parseKeywords(keywordInput?.value || '')
    if (error) {
      alert(error)
      keywordInput?.focus()
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      alert('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
      return
    }

    generateIdeasBtn.disabled = true
    generateIdeasBtn.textContent = '아이디어 생성 중...'

    try {
      generatedIdeas = await generateIdeas(apiKey, analysisData, keywords)
      lastKeywords = keywords
      displayIdeas(generatedIdeas)
      
      // Firebase에 활동 저장
      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('idea', { ideas: generatedIdeas, keywords })
      
      // 다시 생성 버튼 활성화
      if (regenerateIdeasBtn) {
        regenerateIdeasBtn.style.display = 'inline-block'
        regenerateIdeasBtn.disabled = false
      }
    } catch (error) {
      console.error(error)
      alert('아이디어 생성 중 오류가 발생했습니다.')
      generateIdeasBtn.disabled = false
      generateIdeasBtn.textContent = '아이디어 3개 생성하기'
    }
  })
}

if (regenerateIdeasBtn) {
  let isGenerating = false
  
  regenerateIdeasBtn.addEventListener('click', async () => {
    // 이미 생성 중이면 무시
    if (isGenerating) {
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      alert('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
      return
    }

    // 키워드 다시 읽기 (비어 있으면 마지막 사용 키워드 재사용)
    let keywords = []
    const inputValue = keywordInput?.value || ''
    if (inputValue.trim()) {
      const parsed = parseKeywords(inputValue)
      if (parsed.error) {
        alert(parsed.error)
        keywordInput?.focus()
        return
      }
      keywords = parsed.keywords
    } else {
      keywords = lastKeywords
    }

    if (!keywords || keywords.length === 0) {
      alert('아이디어를 만들 키워드 3개를 먼저 입력해 주세요.')
      keywordInput?.focus()
      return
    }

    // 기존 상태 초기화
    selectedIdeaIndex = -1
    chatHistory = []
    refinedIdeasData = []
    chatSection.style.display = 'none'
    refinedIdeasSection.style.display = 'none'
    if (saveChatBtn) saveChatBtn.disabled = true

    isGenerating = true
    const originalText = regenerateIdeasBtn.textContent
    regenerateIdeasBtn.textContent = '아이디어 생성 중...'

    try {
      generatedIdeas = await generateIdeas(apiKey, analysisData, keywords)
      lastKeywords = keywords
      displayIdeas(generatedIdeas)
      regenerateIdeasBtn.textContent = '아이디어 다시 생성하기'
    } catch (error) {
      console.error(error)
      alert('아이디어 생성 중 오류가 발생했습니다.')
      regenerateIdeasBtn.textContent = '아이디어 다시 생성하기'
    } finally {
      isGenerating = false
      // 버튼은 항상 활성화 상태 유지
      regenerateIdeasBtn.disabled = false
    }
  })
}

if (sendBtn) {
  sendBtn.addEventListener('click', sendMessage)
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })
}

if (saveChatBtn) {
  saveChatBtn.addEventListener('click', async () => {
    if (chatHistory.length === 0 || selectedIdeaIndex === -1) {
      alert('저장할 대화 내용이 없습니다.')
      return
    }

    saveChatBtn.disabled = true
    saveChatBtn.textContent = 'PDF 생성 중...'

    try {
      const selectedIdea = generatedIdeas[selectedIdeaIndex]
      await generateChatPdf(selectedIdea, chatHistory)
    } catch (error) {
      console.error('PDF 저장 오류:', error)
      alert('PDF 저장 중 오류가 발생했습니다.')
    } finally {
      saveChatBtn.disabled = false
      saveChatBtn.textContent = '대화 내용 저장하기'
    }
  })
}

if (saveResultBtn) {
  saveResultBtn.addEventListener('click', async () => {
    if (refinedIdeasData.length === 0) {
      alert('저장할 구체화된 아이디어가 없습니다.')
      return
    }

    saveResultBtn.disabled = true
    saveResultBtn.textContent = 'PDF 생성 중...'

    try {
      await generateResultPdf(refinedIdeasData)
    } catch (error) {
      console.error('PDF 저장 오류:', error)
      alert('PDF 저장 중 오류가 발생했습니다.')
    } finally {
      saveResultBtn.disabled = false
      saveResultBtn.textContent = '결과 저장하기'
    }
  })
}

async function generateIdeas(apiKey, analysis, keywords) {
  const keywordText =
    Array.isArray(keywords) && keywords.length > 0
      ? keywords.join(', ')
      : '입력된 키워드 없음'

  const prompt = `다음 명세서 정보와 학생이 입력한 키워드 3개를 바탕으로 새로운 발명품 아이디어 3개를 제시해주세요.

명세서 정보:
- 특허 이름: ${analysis.patentName || '정보 없음'}
- 출원 번호: ${analysis.applicationNumber || '정보 없음'}
- 발명품의 특징: ${Array.isArray(analysis.features) ? analysis.features.join(', ') : analysis.features || '정보 없음'}
- 발명품의 재료: ${Array.isArray(analysis.materials) ? analysis.materials.join(', ') : analysis.materials || '정보 없음'}

학생이 입력한 키워드 3개:
- ${keywordText}

각 아이디어는 간단한 이름과 한 줄 설명, 그리고 프로토타입 스케치를 제공해주세요.
학생이 입력한 키워드와 명세서의 특징/재료가 잘 섞이도록 아이디어를 만들어 주세요.

프로토타입 스케치는 SVG 코드로 작성해주세요. 중학교 학생이 쉽게 이해할 수 있도록 매우 간단하고 명확하게 그려주세요.

프로토타입 그림 요구사항:
- 중학교 학생 수준으로 이해하기 쉽게
- 복잡한 디테일 없이 핵심만 표현
- 간단한 도형(직사각형, 원, 선)만 사용
- 색상은 최소한으로 사용 (검은색 선과 1-2가지 색상만)
- 발명품의 전체적인 모양과 주요 부분만 보여주기
- 너무 세밀하거나 복잡한 그림은 피하기

다음 JSON 형식으로 응답해주세요:

{
  "ideas": [
    {
      "name": "아이디어 이름",
      "description": "간단한 설명",
      "prototype": "<svg width='200' height='150' viewBox='0 0 200 150' xmlns='http://www.w3.org/2000/svg'>...</svg>"
    },
    {
      "name": "아이디어 이름",
      "description": "간단한 설명",
      "prototype": "<svg width='200' height='150' viewBox='0 0 200 150' xmlns='http://www.w3.org/2000/svg'>...</svg>"
    },
    {
      "name": "아이디어 이름",
      "description": "간단한 설명",
      "prototype": "<svg width='200' height='150' viewBox='0 0 200 150' xmlns='http://www.w3.org/2000/svg'>...</svg>"
    }
  ]
}

프로토타입 SVG는 200x150 크기로, 발명품의 핵심 구조나 외형을 매우 간단한 선과 기본 도형(직사각형, 원, 삼각형)으로만 표현해주세요. 마치 초등학생이나 중학생이 손으로 그린 것처럼 단순하고 이해하기 쉽게 그려주세요.`

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
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    throw new Error(payload?.error?.message || `API 오류 (${response.status})`)
  }

  const result = await response.json()
  const aiText = extractAiText(result)

  if (!aiText) {
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  const parsed = parseAiJson(aiText)
  return parsed.ideas || []
}

// 키워드 파싱 유틸리티 (쉼표로 구분된 3개의 단어를 기대)
function parseKeywords(raw) {
  const value = raw.trim()
  if (!value) {
    return {
      keywords: [],
      error: '먼저 만들고 싶은 발명과 관련된 단어 3개를 입력해 주세요.',
    }
  }

  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length !== 3) {
    return {
      keywords: parts,
      error:
        '쉼표(,)로 구분하여 정확히 3개의 단어를 입력해 주세요. 예) 스마트폰 거치대, 친환경, 접이식',
    }
  }

  return { keywords: parts, error: null }
}

function displayIdeas(ideas) {
  if (!ideasContainer) return

  ideasContainer.innerHTML = ideas
    .map(
      (idea, index) => {
        // 프로토타입 SVG가 있으면 표시, 없으면 기본 플레이스홀더
        let prototypeHtml = ''
        if (idea.prototype && idea.prototype.trim()) {
          // SVG 코드가 있으면 그대로 사용 (sanitize하지 않음 - SVG는 안전한 HTML)
          const svgContent = idea.prototype.trim()
          // SVG 태그가 포함되어 있는지 확인
          if (svgContent.includes('<svg') || svgContent.includes('<SVG')) {
            prototypeHtml = `<div class="idea-prototype">${svgContent}</div>`
          } else {
            // SVG 태그가 없으면 감싸기
            prototypeHtml = `<div class="idea-prototype"><svg width="200" height="150" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg></div>`
          }
        } else {
          prototypeHtml = `<div class="idea-prototype-placeholder">
              <svg width="200" height="150" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="20" width="160" height="110" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="5,5"/>
                <text x="100" y="80" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Arial">프로토타입 이미지</text>
              </svg>
            </div>`
        }
        
        return `
    <div class="idea-card" data-index="${index}">
      <div class="idea-header">
        <h3>${sanitize(idea.name)}</h3>
      </div>
      ${prototypeHtml}
      <div class="idea-description">
        <p>${sanitize(idea.description)}</p>
      </div>
      <button class="select-idea-btn" data-index="${index}">이 아이디어 선택하기</button>
    </div>
  `
      }
    )
    .join('')

  document.querySelectorAll('.select-idea-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index)
      selectIdea(index, ideas[index])
    })
  })
}

function selectIdea(index, idea) {
  selectedIdeaIndex = index
  selectedIdeaEl.innerHTML = `
    <div class="selected-idea-content">
      <h3>선택한 아이디어: ${sanitize(idea.name)}</h3>
      <p>${sanitize(idea.description)}</p>
    </div>
  `
  chatSection.style.display = 'block'
  chatHistory = [
    {
      role: 'assistant',
      content: `안녕하세요! "${idea.name}" 아이디어를 구체화하는 것을 도와드리겠습니다. 어떤 부분을 더 자세히 알고 싶으신가요?`,
    },
  ]
  renderChatMessages()
  chatInput.focus()
}

async function sendMessage() {
  const message = chatInput?.value.trim()
  if (!message || selectedIdeaIndex === -1) return

  // 현재까지의 사용자 메시지 수 계산 (이번 질문 포함)
  const userMessageCountBefore = chatHistory.filter((m) => m.role === 'user').length
  const currentTurn = userMessageCountBefore + 1

  if (currentTurn > MAX_CHAT_TURNS) {
    alert(`질문은 최대 ${MAX_CHAT_TURNS}번까지 할 수 있습니다. 마지막 답변을 참고해 정리해 보세요.`)
    return
  }

  chatHistory.push({ role: 'user', content: message })
  chatInput.value = ''
  renderChatMessages()

  sendBtn.disabled = true
  sendBtn.textContent = '전송 중...'

  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
    }

    const selectedIdea = generatedIdeas[selectedIdeaIndex]
    const response = await chatWithAI(
      apiKey,
      selectedIdea,
      message,
      chatHistory,
      currentTurn
    )
    chatHistory.push({ role: 'assistant', content: response })
    renderChatMessages()

    // 대화가 있으면 저장 버튼 활성화
    if (chatHistory.length > 1 && saveChatBtn) {
      saveChatBtn.disabled = false
    }

    // 대화가 충분히 진행되었는지 확인하고 구체화된 아이디어 생성
    const userMessageCount = chatHistory.filter((m) => m.role === 'user').length
    if (userMessageCount >= 3 && refinedIdeasData.length === 0) {
      try {
        await refineIdea(apiKey, selectedIdea, chatHistory)
      } catch (refineError) {
        console.error('Refine error:', refineError)
        // 구체화 실패해도 대화는 계속 가능
      }
    }

    // 최대 대화 횟수에 도달하면 입력 비활성화
    if (userMessageCount >= MAX_CHAT_TURNS) {
      chatInput.disabled = true
      sendBtn.disabled = true
      // 안내 메시지 추가 (추가 턴으로 치지 않기 위해 chatHistory에는 넣지 않음)
      alert(
        `이 아이디어에 대해 ${MAX_CHAT_TURNS}번의 질문을 모두 마쳤습니다.\n` +
          '마지막 답변에서 정리된 내용을 참고하여 보고서를 정리해 보세요.'
      )
    }
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage =
      error.message || '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.'
    chatHistory.push({ role: 'assistant', content: errorMessage })
    renderChatMessages()
  } finally {
    sendBtn.disabled = false
    sendBtn.textContent = '전송'
  }
}

async function chatWithAI(apiKey, idea, message, history, currentTurn) {
  let systemPrompt = `당신은 발명 도우미 역할을 하는 교사입니다. 
학생이 선택한 아이디어 "${idea.name}" (${idea.description})를 이해하고 발전시키도록 도와주세요.

항상 교사가 학생에게 설명하듯이, 존댓말로 친절하고 차분하게 말해 주세요.
학생이 방금 한 질문에 대해 먼저 직접적인 답을 해 주고,
필요한 경우에만 짧게 예시나 추가 설명을 덧붙여 주세요.

특히 다음 내용을 중심으로 설명해 주세요.
1) 발명품을 어떻게 만들면 좋은지 (제작 단계, 공정)
2) 필요한 재료와 도구
3) 발명품의 핵심 특징과 장점
4) 사용 시 주의할 점이나 유의사항`

  // 마지막 턴(10번째 질문)에서는 전체 내용을 정리하는 답변을 생성
  if (currentTurn >= MAX_CHAT_TURNS) {
    systemPrompt += `

지금은 학생과의 ${MAX_CHAT_TURNS}번째 대화입니다.
이번 답변에서는 지금까지의 대화를 바탕으로 아래 네 가지를 정리해서 안내해 주세요.
- 이 발명 아이디어가 어떤 것인지 한 문단으로 요약
- 발명품의 주요 특징 정리 (목록 형태)
- 필요한 재료와 도구 정리 (목록 형태)
- 제작 방법과 제작 순서 설명 (단계별로)
- 사용 시 주의해야 할 점이나 유의사항 정리

학생이 이 답변만 보고도 보고서에 옮겨 적을 수 있을 정도로
차례대로, 읽기 쉽게 정리해 주세요.`
  }

  // 대화 이력을 텍스트로 구성
  const conversationHistory = history
    .slice(0, -1) // 마지막 assistant 메시지 제외 (현재 사용자 메시지 전까지)
    .map((h) => {
      if (h.role === 'user') return `사용자: ${h.content}`
      if (h.role === 'assistant') return `도우미: ${h.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')

  const fullPrompt = conversationHistory
    ? `${systemPrompt}\n\n이전 대화:\n${conversationHistory}\n\n사용자: ${message}\n도우미:`
    : `${systemPrompt}\n\n사용자: ${message}\n도우미:`

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
          content: [
            {
              type: 'input_text',
              text: fullPrompt,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    const errorMsg =
      payload?.error?.message ||
      `API 오류 (${response.status}) - ${response.statusText}`
    console.error('Chat API Error:', errorMsg, payload)
    throw new Error(errorMsg)
  }

  const result = await response.json()
  const aiText = extractAiText(result)

  if (!aiText) {
    console.error('Failed to extract AI text:', result)
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  return aiText.trim()
}

async function refineIdea(apiKey, idea, history) {
  const conversationText = history
    .map((m) => {
      if (m.role === 'user') return `사용자: ${m.content}`
      if (m.role === 'assistant') return `도우미: ${m.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n')

  const prompt = `다음 대화 내용을 바탕으로 "${idea.name}" 아이디어를 구체화한 내용을 정리해주세요.

대화 내용:
${conversationText}

다음 JSON 형식으로 응답해주세요:
{
  "name": "아이디어 이름",
  "description": "아이디어에 대한 전체 설명",
  "features": ["특징1", "특징2"],
  "manufacturing": "제작 방법 설명",
  "notes": "유의사항"
}`

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    const errorMsg =
      payload?.error?.message ||
      `API 오류 (${response.status}) - ${response.statusText}`
    console.error('Refine API Error:', errorMsg, payload)
    throw new Error(errorMsg)
  }

  const result = await response.json()
  const aiText = extractAiText(result)

  if (!aiText) {
    console.error('Failed to extract AI text in refine:', result)
    throw new Error('AI 응답을 읽을 수 없습니다.')
  }

  const refined = parseAiJson(aiText)

  refinedIdeasData.push(refined)
  displayRefinedIdeas(refinedIdeasData)
}

function displayRefinedIdeas(refined) {
  if (!refinedCards) return

  refinedCards.innerHTML = refined
    .map(
      (idea) => `
    <article class="refined-card">
      <h3>${sanitize(idea.name)}</h3>
      <div class="refined-content">
        <div class="refined-section">
          <h4>아이디어 설명</h4>
          <p>${sanitize(idea.description)}</p>
        </div>
        <div class="refined-section">
          <h4>특징</h4>
          <ul>${(Array.isArray(idea.features) ? idea.features : [idea.features]).map((f) => `<li>${sanitize(f)}</li>`).join('')}</ul>
        </div>
        <div class="refined-section">
          <h4>제작 방법</h4>
          <p>${sanitize(idea.manufacturing)}</p>
        </div>
        <div class="refined-section">
          <h4>유의사항</h4>
          <p>${sanitize(idea.notes)}</p>
        </div>
      </div>
    </article>
  `
    )
    .join('')

  refinedIdeasSection.style.display = 'block'
}

function renderChatMessages() {
  if (!chatMessages) return

  chatMessages.innerHTML = chatHistory
    .map(
      (msg) => `
    <div class="chat-message ${msg.role}">
      <div class="message-content">${sanitize(msg.content).replace(/\n/g, '<br>')}</div>
    </div>
  `
    )
    .join('')

  chatMessages.scrollTop = chatMessages.scrollHeight
}

async function generateChatPdf(idea, history) {
  // HTML 콘텐츠 생성
  const contentHtml = `
    <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        아이디어 창출 대화 내용
      </h1>
      
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #475569;">아이디어 이름</h2>
        <p style="font-size: 14px; line-height: 1.6; margin-left: 10px;">${sanitize(idea.name || '정보 없음')}</p>
      </div>

      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #475569;">아이디어 설명</h2>
        <p style="font-size: 14px; line-height: 1.6; margin-left: 10px;">${sanitize(idea.description || '정보 없음')}</p>
      </div>

      <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #475569;">대화 내용</h2>
        ${history
          .map((msg, index) => {
            const role = msg.role === 'user' ? '사용자' : '도우미'
            const roleColor = msg.role === 'user' ? '#2563eb' : '#475569'
            return `
            <div style="margin-bottom: ${index < history.length - 1 ? '20px' : '0'}; padding-bottom: ${index < history.length - 1 ? '20px' : '0'}; border-bottom: ${index < history.length - 1 ? '1px solid #e2e8f0' : 'none'};">
              <div style="font-weight: bold; color: ${roleColor}; margin-bottom: 8px; font-size: 14px;">
                ${role}:
              </div>
              <div style="font-size: 13px; line-height: 1.8; color: #0f172a; white-space: pre-wrap; margin-left: 10px;">
                ${sanitize(msg.content || '').replace(/\n/g, '<br>')}
              </div>
            </div>
          `
          })
          .join('')}
      </div>
    </div>
  `

  // 임시 div 생성
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = contentHtml
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.width = '800px'
  document.body.appendChild(tempDiv)

  try {
    // html2canvas로 이미지 변환
    const canvas = await html2canvas(tempDiv.firstElementChild, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    // PDF 생성
    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    const doc = new jsPDF('p', 'mm', 'a4')
    let position = 0

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      doc.addPage()
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // 파일명 생성
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const fileName = `${year}-${month}-${day}_아이디어 창출.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error('PDF 생성 오류:', error)
    alert('PDF 생성 중 오류가 발생했습니다.')
  } finally {
    // 임시 div 제거
    document.body.removeChild(tempDiv)
  }
}

async function generateResultPdf(refined) {
  // HTML 콘텐츠 생성
  const contentHtml = `
    <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        구체화된 발명 아이디어
      </h1>
      ${refined
        .map(
          (idea, index) => `
        <div style="margin-bottom: ${index < refined.length - 1 ? '40px' : '0'}; padding-bottom: ${index < refined.length - 1 ? '30px' : '0'}; border-bottom: ${index < refined.length - 1 ? '2px solid #e2e8f0' : 'none'};">
          <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #0f172a;">
            ${index + 1}. ${sanitize(idea.name)}
          </h2>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">아이디어 설명</h3>
            <p style="font-size: 14px; line-height: 1.7; margin-left: 10px;">${sanitize(idea.description || '정보 없음')}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">특징</h3>
            <ul style="font-size: 14px; line-height: 1.7; margin-left: 10px; padding-left: 20px;">
              ${(Array.isArray(idea.features) ? idea.features : [idea.features])
                .map((f) => `<li>${sanitize(f)}</li>`)
                .join('')}
            </ul>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">제작 방법</h3>
            <p style="font-size: 14px; line-height: 1.7; margin-left: 10px; white-space: pre-wrap;">${sanitize(idea.manufacturing || '정보 없음').replace(/\n/g, '<br>')}</p>
          </div>

          <div style="margin-bottom: 0;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">유의사항</h3>
            <p style="font-size: 14px; line-height: 1.7; margin-left: 10px; white-space: pre-wrap;">${sanitize(idea.notes || '정보 없음').replace(/\n/g, '<br>')}</p>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `

  // 임시 div 생성
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = contentHtml
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.width = '800px'
  document.body.appendChild(tempDiv)

  try {
    // html2canvas로 이미지 변환
    const canvas = await html2canvas(tempDiv.firstElementChild, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    // PDF 생성
    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    const doc = new jsPDF('p', 'mm', 'a4')
    let position = 0

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      doc.addPage()
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // 파일명 생성
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const fileName = `${year}-${month}-${day}-발명아이디어.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error('PDF 생성 오류:', error)
    alert('PDF 생성 중 오류가 발생했습니다.')
  } finally {
    // 임시 div 제거
    document.body.removeChild(tempDiv)
  }
}

function sanitize(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
  if (!rawText) throw new Error('AI 응답이 비어 있습니다.')

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

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

