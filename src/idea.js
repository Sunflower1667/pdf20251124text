import './idea.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import { collectRefinedSections, stripMarkdownBoldMarkers } from './refinedIdeaSections.js'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const TRIZ_PRINCIPLES = [
  { id: 1, name: '쪼개기 (분할)', desc: '하나를 여러 개로 나누기', example: '조립식 레고, 화면을 접는 폴더블폰' },
  { id: 2, name: '핵심만 뽑기 (추출)', desc: '방해되는 건 버리고 필요한 것만 빼기', example: '시끄러운 본체를 밖으로 뺀 에어컨 실외기' },
  { id: 3, name: '부분만 다르게 (국소적 성질)', desc: '각 부분에 딱 맞는 기능을 넣기', example: '연필 뒤의 지우개, 다기능 칼' },
  { id: 4, name: '삐딱하게 (비대칭)', desc: '똑같은 모양을 비대칭으로 바꾸기', example: '손이 편한 인체공학적 마우스' },
  { id: 5, name: '합치기 (통합)', desc: '비슷한 것끼리 하나로 묶기', example: '샴푸+린스 올인원 제품, 복합기' },
  { id: 6, name: '만능 도구 (다능성)', desc: '하나로 여러 가지 일 하기', example: '전화+카메라+게임기가 합쳐진 스마트폰' },
  { id: 7, name: '쏙 집어넣기 (포개기)', desc: '큰 것 안에 작은 것 넣기', example: '겹쳐서 보관하는 마트 카트, 안테나' },
  { id: 8, name: '무게 줄이기 (무게 보상)', desc: '가볍게 만들거나 띄우기', example: '헬륨 풍선을 단 광고 풍선' },
  { id: 9, name: '미리 반대로 (사전 반대 조치)', desc: '나중에 생길 충격을 대비해 반대로 힘주기', example: '부러지지 않게 미리 굽혀둔 안경테' },
  { id: 10, name: '미리 준비하기 (사전 조치)', desc: '필요한 걸 미리 세팅하기', example: '뜯기 편하게 점선이 있는 과자 봉지' },
  { id: 11, name: '안전장치 (사전 보상)', desc: '만약을 위해 대비하기', example: '사고 나면 터지는 에어백, 데이터 자동 저장' },
  { id: 12, name: '높이 맞추기 (높이 조정)', desc: '힘들게 올리지 말고 높이를 맞추기', example: '바닥이 낮은 저상 버스' },
  { id: 13, name: '반대로 생각하기 (거꾸로)', desc: '위아래나 순서를 바꾸기', example: '거꾸로 세워두는 케첩 통, 러닝머신' },
  { id: 14, name: '동글동글하게 (구형화)', desc: '각진 것을 둥글게 바꾸기', example: '부드럽게 써지는 볼펜 끝 작은 구슬' },
  { id: 15, name: '변신 로봇 (역동성)', desc: '고정된 걸 움직이게 만들기', example: '길이 조절이 되는 셀카봉' },
  { id: 16, name: '조금 부족하거나 넘치게', desc: '한 번에 안 되면 아주 많이 하거나 조금만 하기', example: '페인트를 듬뿍 칠하고 깎아내기' },
  { id: 17, name: '층 쌓기 (차원 바꾸기)', desc: '평면을 입체로 만들기', example: '좁은 땅에 층층이 세우는 타워 주차장' },
  { id: 18, name: '덜덜덜 진동 (기계적 진동)', desc: '흔들어서 문제 해결하기', example: '이물질을 털어내는 진동 칫솔' },
  { id: 19, name: '깜빡깜빡 (주기적 작용)', desc: '계속하지 말고 끊어서 하기', example: '눈에 확 띄는 깜빡이 경고등' },
  { id: 20, name: '끊기지 않게 (연속성)', desc: '멈추지 않고 계속 돌아가게 하기', example: '잉크가 계속 나오는 만년필' },
  { id: 21, name: '눈보다 빠르게 (고속 처리)', desc: '아프거나 위험하기 전에 후다닥 하기', example: '통증을 못 느끼게 빠른 치과용 드릴' },
  { id: 22, name: '위기를 기회로', desc: '나쁜 것을 좋은 곳에 쓰기', example: '뜨거운 열기로 동네를 따뜻하게 하는 지역난방' },
  { id: 23, name: '스스로 확인 (피드백)', desc: '결과가 나오면 알아서 조절하기', example: '온도를 맞추는 보일러 센서' },
  { id: 24, name: '중간 연결 (매개체)', desc: '중간에 무언가를 끼워 넣기', example: '뜨거운 냄비를 잡는 주방 장갑' },
  { id: 25, name: '알아서 척척 (셀프 서비스)', desc: '물건이 스스로 하기', example: '충전하러 혼자 가는 로봇 청소기' },
  { id: 26, name: '가짜 쓰기 (복제)', desc: '비싸거나 위험한 진짜 대신 가짜 쓰기', example: '운전 연습하는 VR 시뮬레이터' },
  { id: 27, name: '한 번 쓰고 버리기 (일회용품)', desc: '싸게 만들어서 한 번만 쓰기', example: '위생적인 일회용 장갑' },
  { id: 28, name: '다른 에너지 쓰기 (방식 교체)', desc: '기계 대신 전기나 빛 쓰기', example: '열쇠 대신 쓰는 지문 인식' },
  { id: 29, name: '공기나 물의 힘', desc: '딱딱한 것 대신 공기 주머니 쓰기', example: '푹신한 에어쿠션 운동화' },
  { id: 30, name: '얇은 막 만들기 (유연한 막)', desc: '얇은 비닐이나 막으로 보호하기', example: '스마트폰 액정 필름' },
  { id: 31, name: '구멍 숭숭 (다공성 재료)', desc: '구멍을 내서 가볍게 하거나 통하게 하기', example: '물기를 쫙 흡수하는 스펀지' },
  { id: 32, name: '색깔 바꾸기 (색상 변화)', desc: '색이나 투명도를 바꾸기', example: '뜨거우면 색이 변하는 온도 감지 컵' },
  { id: 33, name: '끼리끼리 (동질성)', desc: '같은 재질로 만들기', example: '먹을 수 있는 초콜릿으로 만든 초콜릿 장식' },
  { id: 34, name: '알아서 사라지기 (폐기 및 재생)', desc: '할 일 다 하면 사라지게 하기', example: '몸속에서 녹는 수술용 실' },
  { id: 35, name: '성질 바꾸기 (속성 변화)', desc: '온도를 바꾸거나 농도를 조절하기', example: '액체로 된 물비누' },
  { id: 36, name: '상태 바꾸기 (상전이)', desc: '얼거나 녹는 힘을 이용하기', example: '시원함을 유지하는 아이스팩' },
  { id: 37, name: '늘어났다 줄어들었다 (열팽창)', desc: '열을 받으면 부풀어 오르는 성질 쓰기', example: '온도에 따라 휘어지는 바이메탈 스위치' },
  { id: 38, name: '산소 팍팍 (강산화제)', desc: '산소를 많이 넣어 에너지를 얻기', example: '숨쉬기 편하게 하는 휴대용 산소 캔' },
  { id: 39, name: '조용한 환경 (불활성 환경)', desc: '반응하지 않게 가두기', example: '과자가 안 부서지게 넣은 질소 가스' },
  { id: 40, name: '섞어서 튼튼하게 (복합 재료)', desc: '여러 재료를 섞어 장점만 갖기', example: '가볍고 튼튼한 탄소 섬유 낚싯대' },
]

const TRIZ_GROUPS = [
  { title: '1구역: 모양과 구조를 바꿔봐! (1~10번)', range: [1, 10] },
  { title: '2구역: 움직임과 환경을 바꿔봐! (11~20번)', range: [11, 20] },
  { title: '3구역: 기발한 아이디어로 해결! (21~30번)', range: [21, 30] },
  { title: '4구역: 재료의 성질을 이용해! (31~40번)', range: [31, 40] },
]

function buildTrizPromptText() {
  return TRIZ_PRINCIPLES.map(
    (p) => `${p.id}. ${p.name}: ${p.desc} (예: ${p.example})`
  ).join('\n')
}

function buildTrizGuideHtml() {
  return TRIZ_GROUPS.map((g) => {
    const items = TRIZ_PRINCIPLES.filter((p) => p.id >= g.range[0] && p.id <= g.range[1])
      .map(
        (p) =>
          `<li><span class="triz-num">${p.id}</span> <strong>${sanitize(p.name)}</strong>: ${sanitize(p.desc)} <span class="triz-ex">(예: ${sanitize(p.example)})</span></li>`
      )
      .join('')
    return `<div class="triz-group"><h4>${sanitize(g.title)}</h4><ul>${items}</ul></div>`
  }).join('')
}

const app = document.querySelector('#app')

// localStorage에서 분석 데이터 가져오기
const analysisData = JSON.parse(localStorage.getItem('analysisData') || '{}')
const extractedText = localStorage.getItem('extractedText') || ''

if (!analysisData || Object.keys(analysisData).length === 0) {
  app.innerHTML = `
    <div class="shell">
      <h1>명세서 분석 데이터가 없습니다.</h1>
      <p>먼저 메인 페이지에서 명세서를 분석해 주세요.</p>
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
            만들고 싶은 발명과 관련된 단어를 <strong>3개</strong> 입력하면, 입력한 단어와 어울리는
            <strong>TRIZ 발명 기법</strong>을 골라 그 원리를 적용한 새로운 아이디어를 만들어줘요.
            (예: 스마트폰 거치대, 친환경, 접이식)
          </p>
        </div>

        <details class="triz-guide">
          <summary>🛠️ 발명 치트키 40: TRIZ 발명 기법 살펴보기</summary>
          <div class="triz-guide-body">
            <p class="triz-guide-intro">아래 40가지는 세상 속 발명품을 분석해 정리한 "생각의 기술"이에요. AI가 학생이 입력한 단어와 가장 잘 어울리는 기법을 골라 새 아이디어를 만들어줘요.</p>
            ${buildTrizGuideHtml()}
          </div>
        </details>

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
          <h2>[2단계: 발명 아이디어 구체화하기]</h2>
          <p>선택한 아이디어를 구체화하기 위해 교사와 대화하듯이 질문해 보세요. 최대 10번까지 질문할 수 있습니다.</p>
        </div>
        <div id="selected-idea" class="selected-idea"></div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-container">
          <textarea id="chat-input" placeholder="아이디어에 대해 질문하거나 설명을 요청하세요..." rows="3"></textarea>
          <div class="chat-buttons">
            <button id="send-btn" type="button">전송</button>
            <button id="save-chat-btn" type="button" disabled>대화 내용 저장하기</button>
          </div>
        </div>
        <div class="refine-step-subheader">
          <h2>[구체화한 아이디어 정리하기]</h2>
        </div>
        <div class="refine-action" style="text-align: center;">
          <button id="refine-idea-btn" type="button" disabled style="padding: 12px 24px; font-size: 1rem; font-weight: 600; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background 150ms ease;">
            아이디어 구체화
          </button>
        </div>
      </section>

      <section class="refined-ideas" id="refined-ideas" style="display: none;">
        <div class="section-header">
          <h2>3단계: 구체화된 아이디어</h2>
          <p class="section-description">
            2단계 챗봇과 나눈 대화 내용을 바탕으로, 아이디어를 보고서에 옮기기 좋게 자세히 정리해 두었어요.
          </p>
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
const refineIdeaBtn = document.querySelector('#refine-idea-btn')
const refinedIdeasSection = document.querySelector('#refined-ideas')
const refinedCards = document.querySelector('#refined-cards')
const saveResultBtn = document.querySelector('#save-result-btn')
const keywordInput = document.querySelector('#keyword-input')

const MAX_CHAT_TURNS = 10

/** 학생 대시보드(iframe 부모)에 아이디어 단계 표시 동기화 */
function notifyParentIdeaStep(step) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'student-idea-step', step }, '*')
    }
  } catch {
    /* ignore */
  }
}

let generatedIdeas = []
let selectedIdeaIndex = -1
let chatHistory = []
let refinedIdeasData = []
let lastKeywords = []

function applyIdeaPageHash() {
  const raw = (location.hash || '').replace(/^#/, '').toLowerCase()
  if (raw !== 'concretize') return
  requestAnimationFrame(() => {
    const chat = document.getElementById('chat-section')
    const gen = document.querySelector('.idea-generation')
    if (!gen && !chat) return
    const chatOpen = chat && getComputedStyle(chat).display !== 'none'
    ;(chatOpen ? chat : gen)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

if (generateIdeasBtn) {
  applyIdeaPageHash()
  window.addEventListener('hashchange', applyIdeaPageHash)

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
      selectedIdeaIndex = -1
      chatHistory = []
      if (chatSection) chatSection.style.display = 'none'
      if (refinedIdeasSection) refinedIdeasSection.style.display = 'none'
      if (saveChatBtn) saveChatBtn.disabled = true
      if (refineIdeaBtn) refineIdeaBtn.disabled = true
      displayIdeas(generatedIdeas)
      flushStudentIdeaSessionToStorage()
      notifyParentIdeaStep('generation')

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
    if (refineIdeaBtn) refineIdeaBtn.disabled = true
    notifyParentIdeaStep('generation')

    isGenerating = true
    const originalText = regenerateIdeasBtn.textContent
    regenerateIdeasBtn.textContent = '아이디어 생성 중...'

    try {
      generatedIdeas = await generateIdeas(apiKey, analysisData, keywords)
      lastKeywords = keywords
      displayIdeas(generatedIdeas)
      flushStudentIdeaSessionToStorage()
      notifyParentIdeaStep('generation')
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
    saveChatBtn.textContent = '저장 중...'

    try {
      const selectedIdea = generatedIdeas[selectedIdeaIndex]
      
      // PDF 생성
      await generateChatPdf(selectedIdea, chatHistory)
      
      // Firebase에 대화 내용 저장
      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('idea', {
        ideas: generatedIdeas,
        keywords: lastKeywords,
        selectedIdea: selectedIdea,
        chatHistory: chatHistory,
        refinedIdea: refinedIdeasData.length > 0 ? refinedIdeasData[refinedIdeasData.length - 1] : null
      })
      
      alert('대화 내용이 저장되었습니다!')
    } catch (error) {
      console.error('저장 오류:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      saveChatBtn.disabled = false
      saveChatBtn.textContent = '대화 내용 저장하기'
    }
  })
}

if (refineIdeaBtn) {
  refineIdeaBtn.addEventListener('click', async () => {
    if (chatHistory.length === 0 || selectedIdeaIndex === -1) {
      alert('먼저 아이디어를 선택하고 대화를 나눈 후 구체화할 수 있습니다.')
      return
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      alert('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
      return
    }

    refineIdeaBtn.disabled = true
    refineIdeaBtn.textContent = '구체화 중...'

    try {
      const selectedIdea = generatedIdeas[selectedIdeaIndex]
      await refineIdea(apiKey, selectedIdea, chatHistory)
      refineIdeaBtn.textContent = '아이디어 구체화 완료'
    } catch (error) {
      console.error('구체화 오류:', error)
      alert('아이디어 구체화 중 오류가 발생했습니다.')
      refineIdeaBtn.disabled = false
      refineIdeaBtn.textContent = '아이디어 구체화'
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

  const trizListText = buildTrizPromptText()

  const prompt = `당신은 중학생을 위한 발명 도우미입니다. 학생이 입력한 키워드 3개와 명세서 정보를 바탕으로, 아래 "TRIZ 발명 치트키 40"에서 가장 어울리는 기법을 선택해 그 원리를 실제로 적용한 새로운 발명 아이디어 3개를 만들어 주세요.

[TRIZ 발명 치트키 40]
${trizListText}

[규칙]
1. 아이디어 3개는 서로 다른 TRIZ 기법을 골라 적용해 주세요. (같은 기법 중복 금지)
2. 각 아이디어는 학생이 입력한 키워드와 명세서의 특징/재료가 자연스럽게 녹아들어야 해요.
3. 너무 추상적이지 않고, 중학생이 실제 만들거나 상상해볼 수 있을 정도로 구체적이어야 해요.
4. 응답의 모든 한글 문장은 해요체("~예요", "~어요")로 통일해 주세요.

[명세서 정보]
- 특허 이름: ${analysis.patentName || '정보 없음'}
- 출원 번호: ${analysis.applicationNumber || '정보 없음'}
- 발명품의 특징: ${Array.isArray(analysis.features) ? analysis.features.join(', ') : analysis.features || '정보 없음'}
- 발명품의 재료: ${Array.isArray(analysis.materials) ? analysis.materials.join(', ') : analysis.materials || '정보 없음'}

[학생이 입력한 키워드 3개]
- ${keywordText}

[프로토타입 스케치 SVG 요구사항]
- 시점: 평면도보다는 정면도나 대각선에서 본 모습 위주.
- 표현: 매우 단순한 도형(직사각형, 원, 선, 삼각형, 타원 등)만 사용. 핵심 부위에는 짧은 <text> 라벨(예: '버튼', '입구')을 넣어도 좋아요. 검은색 선과 포인트 컬러 1~2개만 사용.
- 크기: 200x150 (viewBox='0 0 200 150').
- 손으로 그린 듯 단순하게.

[응답 형식 - 아래 JSON만 출력]
{
  "ideas": [
    {
      "name": "아이디어 이름",
      "description": "한두 문장으로 된 간단한 설명",
      "trizPrinciple": {
        "id": 1,
        "name": "쪼개기 (분할)",
        "applied": "이 발명에서 분할 원리가 어떻게 적용됐는지 한 문장으로 설명"
      },
      "prototype": "<svg width='200' height='150' viewBox='0 0 200 150' xmlns='http://www.w3.org/2000/svg'>...</svg>"
    },
    { "...": "위와 같은 형식으로 총 3개" }
  ]
}

trizPrinciple.id는 1~40 사이의 정수, name은 위 목록의 정확한 이름, applied는 그 기법을 이 아이디어에 어떻게 녹였는지 학생이 알아보기 쉽게 한 문장으로 써 주세요.`

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

function renderTrizBadge(triz) {
  if (!triz || (!triz.name && !triz.id)) return ''
  const idNum = Number(triz.id)
  const matched =
    Number.isFinite(idNum) ? TRIZ_PRINCIPLES.find((p) => p.id === idNum) : null
  const name = triz.name || matched?.name || ''
  const idLabel = Number.isFinite(idNum) ? idNum : matched?.id || ''
  const desc = matched?.desc || ''
  const example = matched?.example || ''
  const applied = triz.applied || ''
  return `
    <div class="idea-triz">
      <div class="idea-triz-head">
        ${idLabel !== '' ? `<span class="idea-triz-id">TRIZ ${sanitize(String(idLabel))}</span>` : ''}
        <span class="idea-triz-name">${sanitize(name)}</span>
      </div>
      ${desc ? `<p class="idea-triz-desc">${sanitize(desc)}${example ? ` <span class="idea-triz-ex">(예: ${sanitize(example)})</span>` : ''}</p>` : ''}
      ${applied ? `<p class="idea-triz-applied"><strong>이 아이디어에서는</strong> ${sanitize(applied)}</p>` : ''}
    </div>
  `
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
        
        const trizHtml = renderTrizBadge(idea.trizPrinciple)

        return `
    <div class="idea-card" data-index="${index}">
      <div class="idea-header">
        <h3>${sanitize(idea.name)}</h3>
      </div>
      ${prototypeHtml}
      ${trizHtml}
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
  const trizLine = idea.trizPrinciple?.name
    ? `<p class="selected-idea-triz">적용된 TRIZ 기법: <strong>${sanitize(`${idea.trizPrinciple.id ?? ''} ${idea.trizPrinciple.name}`.trim())}</strong></p>`
    : ''
  selectedIdeaEl.innerHTML = `
    <div class="selected-idea-content">
      <h3>선택한 아이디어: ${sanitize(idea.name)}</h3>
      <p>${sanitize(idea.description)}</p>
      ${trizLine}
    </div>
  `
  chatSection.style.display = 'block'
  chatHistory = [
    {
      role: 'assistant',
      content: `안녕하세요! "${idea.name}" 아이디어를 같이 구체화해 볼게요. 궁금한 점은 편하게 물어봐 주세요!`,
    },
  ]
  renderChatMessages()
  chatInput.focus()
  if (refineIdeaBtn) refineIdeaBtn.disabled = true
  flushStudentIdeaSessionToStorage()
  notifyParentIdeaStep('concretize')
}

function tryRestoreStudentIdeaSession() {
  try {
    const raw = localStorage.getItem('studentIdeaSessionRestore')
    if (!raw || !ideasContainer) return
    const s = JSON.parse(raw)
    if (!s?.ideas || !Array.isArray(s.ideas) || s.ideas.length === 0) return

    generatedIdeas = s.ideas
    lastKeywords = Array.isArray(s.keywords) ? s.keywords : []
    if (keywordInput && lastKeywords.length) {
      keywordInput.value = lastKeywords.join(', ')
    }
    displayIdeas(generatedIdeas)
    if (regenerateIdeasBtn) {
      regenerateIdeasBtn.style.display = 'inline-block'
      regenerateIdeasBtn.disabled = false
    }
    if (generateIdeasBtn) {
      generateIdeasBtn.disabled = false
      generateIdeasBtn.textContent = '아이디어 3개 생성하기'
    }

    const sel = s.selectedIdea
    selectedIdeaIndex = -1
    if (sel) {
      const idx = generatedIdeas.findIndex(
        (i) => i.name === sel.name && i.description === sel.description
      )
      selectedIdeaIndex = idx >= 0 ? idx : -1
    }

    const savedChat = Array.isArray(s.chatHistory) ? s.chatHistory : []
    if (selectedIdeaIndex >= 0 && savedChat.length > 0 && selectedIdeaEl && chatSection) {
      const idea = generatedIdeas[selectedIdeaIndex]
      const trizLine = idea.trizPrinciple?.name
        ? `<p class="selected-idea-triz">적용된 TRIZ 기법: <strong>${sanitize(`${idea.trizPrinciple.id ?? ''} ${idea.trizPrinciple.name}`.trim())}</strong></p>`
        : ''
      selectedIdeaEl.innerHTML = `
        <div class="selected-idea-content">
          <h3>선택한 아이디어: ${sanitize(idea.name)}</h3>
          <p>${sanitize(idea.description)}</p>
          ${trizLine}
        </div>
      `
      chatSection.style.display = 'block'
      chatHistory = savedChat
      renderChatMessages()
      const userTurns = chatHistory.filter((m) => m.role === 'user').length
      if (saveChatBtn) saveChatBtn.disabled = chatHistory.length <= 1
      if (refineIdeaBtn) refineIdeaBtn.disabled = userTurns < 1
      if (userTurns >= MAX_CHAT_TURNS) {
        if (chatInput) chatInput.disabled = true
        if (sendBtn) sendBtn.disabled = true
      }
    }

    if (s.refinedIdea) {
      refinedIdeasData = Array.isArray(s.refinedIdea) ? s.refinedIdea : [s.refinedIdea]
      displayRefinedIdeas(refinedIdeasData)
    }

    if (selectedIdeaIndex >= 0) {
      notifyParentIdeaStep('concretize')
    } else {
      notifyParentIdeaStep('generation')
    }
  } catch (e) {
    console.error('아이디어 세션 복원 실패:', e)
  }
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

    // 대화가 있으면 아이디어 구체화 버튼 활성화
    const userMessageCount = chatHistory.filter((m) => m.role === 'user').length
    if (userMessageCount >= 1 && refineIdeaBtn) {
      refineIdeaBtn.disabled = false
    }

    // 최대 대화 횟수에 도달하면 입력 비활성화
    if (userMessageCount >= MAX_CHAT_TURNS) {
      chatInput.disabled = true
      sendBtn.disabled = true
      
      // 마지막 대화 턴 완료 시 Firebase에 저장
      if (selectedIdeaIndex !== -1) {
        try {
          const { saveStudentActivity } = await import('./activityStorage.js')
          const selectedIdea = generatedIdeas[selectedIdeaIndex]
          await saveStudentActivity('idea', {
            ideas: generatedIdeas,
            keywords: lastKeywords,
            selectedIdea: selectedIdea,
            chatHistory: chatHistory,
            refinedIdea: refinedIdeasData.length > 0 ? refinedIdeasData[refinedIdeasData.length - 1] : null
          })
        } catch (error) {
          console.error('자동 저장 오류:', error)
        }
      }
      
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
  const trizContext = idea.trizPrinciple?.name
    ? `\n이 아이디어는 TRIZ 발명 기법 "${idea.trizPrinciple.id ?? ''} ${idea.trizPrinciple.name}"을(를) 적용해 만들어졌어요. 적용 방식: ${idea.trizPrinciple.applied || '명시되지 않음'}\n학생이 이 원리를 이해하면서 아이디어를 구체화하도록 자연스럽게 연결해 답변해 주세요.`
    : ''

  let systemPrompt = `당신은 발명 도우미 역할을 하는 교사입니다.
학생이 선택한 아이디어 "${idea.name}" (${idea.description})를 이해하고 발전시키도록 도와주세요.${trizContext}

말투는 반드시 해요체로 통일해 주세요. 문장은 가능한 한 '~요', '~예요', '~어요', '~죠', '~네요'처럼 부드럽게 끝내고,
'~합니다', '~됩니다'처럼 딱딱한 보고서체·하오체 느낌은 피해 주세요.
친근하고 따뜻하게, 중학생도 이해하기 쉬운 단어로 설명해 주세요.
학생이 방금 한 질문에는 먼저 직접 답해 주고, 필요할 때만 짧은 예시나 덧붙임을 넣어 주세요.

`

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
차례대로, 읽기 쉽게 정리해 주세요. 이때도 말투는 해요체로 유지해 주세요.`
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

  const prompt = `다음은 학생과 발명 도우미(챗봇)가 나눈 전체 대화입니다. 이 대화만이 아니라, 대화 속에 흩어진 설명·예시·정정 내용까지 모두 읽고 "${idea.name}" 아이디어를 한 번에 이해할 수 있도록 아주 구체적으로 정리해 주세요.

원래 아이디어 요약: ${idea.description}

대화 전문:
${conversationText}

규칙:
- 학생 질문과 도우미 답변에 실제로 나온 내용을 최대한 빠짐없이 반영하세요. 한쪽 말만이 아니라, 질문과 답이 이어지며 좁혀진 내용도 포함하세요.
- 대화에 없는 내용은 추측으로 채우지 말고, 꼭 필요하면 앞에 *제안*을 붙이세요.
- 문장은 해요체로 통일해 주세요.
- 각 필드는 짧게 끊지 말고, 보고서에 복사해 쓸 수 있을 만큼 충분히 길고 구체적으로 쓰세요.

다음 JSON만 출력하세요:
{
  "name": "아이디어 이름 (대화에서 정해진 이름이 있으면 그대로)",
  "chatSummary": "챗봇 대화에서 나온 핵심만 5문장 이상으로 요약 (질문·답변에서 다룬 주제, 결정된 점, 도우미가 강조한 점 포함)",
  "description": "이 아이디어가 무엇인지, 누구를 위한 것인지, 어떤 문제를 어떻게 푸는지까지 서술형으로 상세히 (대화에 나온 표현·수치·재료명 등 구체적으로)",
  "structureOrPrinciple": "모양·구성·작동 원리나 구조 (대화에 없으면 빈 문자열로)",
  "features": ["특징 4개 이상, 대화에 근거해 구체적으로"],
  "howToUse": "실제로 쓰는 방법을 단계나 상황별로 자세히",
  "materials": ["준비물, 대화·제안 구분 규칙 동일"],
  "tools": ["필요한 도구"],
  "manufacturingSteps": ["제작 1단계", "2단계", "3단계", "… 대화에 나온 순서대로, 가능한 한 세분화"],
  "manufacturing": "제작 전체를 한 번 더 설명 (단계와 겹치면 보충만)",
  "expectedEffect": "기대 효과·장점 (대화 기반, 없으면 빈 문자열로)",
  "notes": "유의사항·한계·안전 (대화 기반)"
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

  // 기존 구체화된 아이디어가 있으면 교체, 없으면 추가
  if (refinedIdeasData.length > 0) {
    refinedIdeasData[0] = refined
  } else {
    refinedIdeasData.push(refined)
  }
  displayRefinedIdeas(refinedIdeasData)
  
  // 구체화된 아이디어 생성 시 Firebase에 저장
  if (selectedIdeaIndex !== -1) {
    try {
      const { saveStudentActivity } = await import('./activityStorage.js')
      const selectedIdea = generatedIdeas[selectedIdeaIndex]
      await saveStudentActivity('idea', {
        ideas: generatedIdeas,
        keywords: lastKeywords,
        selectedIdea: selectedIdea,
        chatHistory: chatHistory,
        refinedIdea: refined
      })
    } catch (error) {
      console.error('구체화된 아이디어 저장 오류:', error)
    }
  }
}

function displayRefinedIdeas(refined) {
  if (!refinedCards) return

  refinedCards.innerHTML = refined
    .map((idea) => {
      const sections = collectRefinedSections(idea, sanitize)
      const body =
        sections.length > 0
          ? sections
              .map(
                (s) => `
        <div class="refined-section">
          <h4>${sanitize(s.title)}</h4>
          <div class="refined-section-body">${s.html}</div>
        </div>`
              )
              .join('')
          : `<p class="refined-empty">표시할 구체화 내용이 없습니다. 아이디어 구체화를 다시 실행해 보세요.</p>`
      return `
    <article class="refined-card">
      <h3>${sanitize(idea.name)}</h3>
      <div class="refined-content">${body}</div>
    </article>
  `
    })
    .join('')

  refinedIdeasSection.style.display = 'block'
}

function renderChatMessages() {
  if (!chatMessages) return

  chatMessages.innerHTML = chatHistory
    .map(
      (msg) => `
    <div class="chat-message ${msg.role}">
      <div class="message-content">${sanitize(stripMarkdownBoldMarkers(msg.content)).replace(/\n/g, '<br>')}</div>
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

      ${
        idea.trizPrinciple?.name
          ? `<div style="margin-bottom: 30px;">
              <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #475569;">적용된 TRIZ 발명 기법</h2>
              <p style="font-size: 14px; line-height: 1.6; margin-left: 10px;"><strong>${sanitize(`${idea.trizPrinciple.id ?? ''} ${idea.trizPrinciple.name}`.trim())}</strong></p>
              ${idea.trizPrinciple.applied ? `<p style="font-size: 13px; line-height: 1.6; margin-left: 10px; color:#475569;">적용 방식: ${sanitize(idea.trizPrinciple.applied)}</p>` : ''}
            </div>`
          : ''
      }

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
                ${sanitize(stripMarkdownBoldMarkers(msg.content || '')).replace(/\n/g, '<br>')}
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
        .map((idea, index) => {
          const sections = collectRefinedSections(idea, sanitize)
          const blocks =
            sections.length > 0
              ? sections
                  .map(
                    (s) => `
          <div style="margin-bottom: 18px;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">${sanitize(s.title)}</h3>
            <div style="font-size: 14px; line-height: 1.75; margin-left: 10px;">${s.html}</div>
          </div>`
                  )
                  .join('')
              : `<p style="font-size: 14px; margin-left: 10px;">${sanitize('구체화 내용을 불러올 수 없습니다.')}</p>`
          return `
        <div style="margin-bottom: ${index < refined.length - 1 ? '40px' : '0'}; padding-bottom: ${index < refined.length - 1 ? '30px' : '0'}; border-bottom: ${index < refined.length - 1 ? '2px solid #e2e8f0' : 'none'};">
          <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #0f172a;">
            ${index + 1}. ${sanitize(idea.name)}
          </h2>
          ${blocks}
        </div>
      `
        })
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

function flushStudentIdeaSessionToStorage() {
  const kwRaw = keywordInput?.value?.trim()
  const kws = kwRaw
    ? kwRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    : lastKeywords
  const hasWork =
    generatedIdeas.length > 0 ||
    (kws && kws.length > 0) ||
    (chatHistory && chatHistory.length > 1) ||
    (refinedIdeasData && refinedIdeasData.length > 0)
  if (!hasWork) return
  const payload = {
    ideas: generatedIdeas,
    keywords: kws?.length ? kws : lastKeywords,
    selectedIdea:
      selectedIdeaIndex >= 0 && generatedIdeas[selectedIdeaIndex]
        ? generatedIdeas[selectedIdeaIndex]
        : null,
    chatHistory,
    refinedIdea: refinedIdeasData?.length ? refinedIdeasData : null,
  }
  try {
    localStorage.setItem('studentIdeaSessionRestore', JSON.stringify(payload))
  } catch (_) {}
}

listenForWorkbenchFlushRequest(flushStudentIdeaSessionToStorage)

if (generateIdeasBtn) {
  tryRestoreStudentIdeaSession()
}
