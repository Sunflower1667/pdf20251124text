import './student1.css'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url'
import { jsPDF } from 'jspdf'

GlobalWorkerOptions.workerSrc = pdfWorker

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="shell">
    <header>
      <h1>명세서 쉽게 이해하기</h1>
      <p class="subtitle">
       명세서 파일을 받아 업로드 해주세요!
      </p>
    </header>

    <section class="uploader">
      <label for="pdf-input" class="file-picker">
        <input id="pdf-input" type="file" accept="application/pdf" />
        <span>PDF 파일 선택</span>
      </label>
     
    </section>

    <section class="analysis-panel">
      <div class="analysis-header">
        <div class="analysis-title-section">
          <h2>명세서 분석</h2>
          <button id="analyze-btn" type="button" disabled>명세서 분석하기</button>
        </div>
      </div>
      <p id="analysis-status" class="analysis-status">pdf가 업로드 완료되면 분석을 할 수 있어요!</p>
      <div id="analysis-grid" class="analysis-grid">
        ${createAnalysisCard('특허 이름')}
        ${createAnalysisCard('출원 번호')}
        ${createAnalysisCard('발명품의 특징', true)}
        ${createAnalysisCard('발명품의 재료', true)}
      </div>
      <div class="analysis-actions">
        <button id="go-to-idea-btn" type="button" disabled>아이디어 창출하기</button>
      </div>
    </section>
  </div>
`

const pdfInput = document.querySelector('#pdf-input')
const statusEl = document.querySelector('#status')
const analyzeBtn = document.querySelector('#analyze-btn')
const analysisStatusEl = document.querySelector('#analysis-status')
const analysisGrid = document.querySelector('#analysis-grid')
const goToIdeaBtn = document.querySelector('#go-to-idea-btn')

let lastExtractedText = ''
let lastFileName = 'extracted-text'
let lastAnalysisData = null

if (!pdfInput) {
  console.error('PDF input element not found!')
}

if (pdfInput) {
  pdfInput.addEventListener('change', async () => {
  const file = pdfInput.files?.[0]
  
  if (!file) {
    setStatus('PDF를 다시 선택해 주세요.')
    analyzeBtn.disabled = true
    goToIdeaBtn.disabled = true
    lastExtractedText = ''
    lastAnalysisData = null
    return
  }

  lastFileName = file.name.replace(/\.pdf$/i, '') || 'pdf-text'
  setStatus('텍스트를 추출하는 중입니다...', 'info')
  analyzeBtn.disabled = true
  goToIdeaBtn.disabled = true
  lastAnalysisData = null

  try {
    // 자동으로 텍스트 추출
    lastExtractedText = await extractTextFromPdf(file)

    if (!lastExtractedText) {
      setStatus('텍스트를 찾지 못했습니다. 스캔된 PDF인지 확인해 주세요.', 'warn')
      analyzeBtn.disabled = true
      setAnalysisStatus('PDF에서 텍스트를 추출할 수 없습니다.')
      return
    }

    // 추출 완료 후 분석 버튼 활성화
    setStatus('텍스트 추출 완료! 명세서를 분석할 수 있어요!', 'success')
    analyzeBtn.disabled = false
    setAnalysisStatus('[명세서 분석하기]를 클릭하여 분석을 시작하세요.')
  } catch (error) {
    console.error(error)
    setStatus('추출 중 문제가 발생했습니다. 다른 PDF로 시도해 주세요.', 'error')
    analyzeBtn.disabled = true
    setAnalysisStatus('PDF 텍스트 추출에 실패했습니다.')
  }
  })
}


analyzeBtn.addEventListener('click', async () => {
  if (!lastExtractedText.trim()) {
    setAnalysisStatus('먼저 텍스트를 추출해 주세요.', 'warn')
    return
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    setAnalysisStatus('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.', 'error')
    return
  }

  toggleAnalysis(true)
  setAnalysisStatus('분석중 입니다.', 'info')
  
  // 로딩 애니메이션을 위한 스피너 표시
  analysisStatusEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div class="spinner" style="width: 20px; height: 20px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>분석중 입니다.</span>
    </div>
  `
  
  // CSS 애니메이션 추가
  if (!document.querySelector('#spinner-style')) {
    const style = document.createElement('style')
    style.id = 'spinner-style'
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }

  try {
    const analysis = await requestAnalysis(apiKey, lastExtractedText)
    lastAnalysisData = analysis
    renderAnalysis(analysis)
    
    // localStorage에 분석 데이터 저장
    localStorage.setItem('analysisData', JSON.stringify(analysis))
    localStorage.setItem('extractedText', lastExtractedText)
    
    // Firebase에 활동 저장
    const { saveStudentActivity } = await import('./activityStorage.js')
    await saveStudentActivity('analysis', analysis)
    
    // 아이디어 창출 버튼 활성화
    goToIdeaBtn.disabled = false
    setAnalysisStatus('분석 완료! 아이디어 창출 페이지로 이동하세요!', 'success')
  } catch (error) {
    console.error(error)
    setAnalysisStatus(error.message || '분석 중 오류가 발생했습니다.', 'error')
    goToIdeaBtn.disabled = true
  } finally {
    toggleAnalysis(false)
  }
})

goToIdeaBtn.addEventListener('click', () => {
  if (!lastAnalysisData) {
    setAnalysisStatus('아이디어 창출을 위해 먼저 분석을 완료해 주세요.', 'warn')
    return
  }

  // iframe 환경인지 확인
  if (window.parent !== window) {
    // iframe 내부에서 실행 중인 경우, 부모 창의 idea-frame을 새로고침
    try {
      const parentWindow = window.parent
      const ideaFrame = parentWindow.document.querySelector('#idea-frame')
      if (ideaFrame) {
        ideaFrame.src = ideaFrame.src // 새로고침
        // 부모 창으로 스크롤 이동
        ideaFrame.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setAnalysisStatus('아이디어 창출 페이지로 이동했습니다.', 'success')
      } else {
        // idea-frame을 찾을 수 없으면 새 창으로 열기
        window.open('idea.html', '_blank')
      }
    } catch (error) {
      console.error('iframe 접근 오류:', error)
      // iframe 접근이 차단된 경우 새 창으로 열기
      window.open('idea.html', '_blank')
    }
  } else {
    // 일반 페이지인 경우 idea.html로 이동
    window.location.href = 'idea.html'
  }
})

function setStatus(message, mode = 'info') {
  if (!statusEl) {
    console.error('Status element not found!')
    return
  }
  statusEl.textContent = message
  statusEl.dataset.mode = mode
}

function setAnalysisStatus(message, mode = 'info') {
  if (!analysisStatusEl) {
    console.error('Analysis status element not found!')
    return
  }
  // HTML이 포함된 경우 innerHTML 사용, 그렇지 않으면 textContent 사용
  if (message.includes('<div') || message.includes('<span')) {
    analysisStatusEl.innerHTML = message
  } else {
    analysisStatusEl.textContent = message
  }
  analysisStatusEl.dataset.mode = mode
}

function toggleProcessing(isProcessing) {
  pdfInput.disabled = isProcessing
  analyzeBtn.disabled = isProcessing || !lastExtractedText
  goToIdeaBtn.disabled = isProcessing || !lastAnalysisData
}

function toggleAnalysis(isBusy) {
  analyzeBtn.disabled = isBusy || !lastExtractedText
  if (isBusy) {
    goToIdeaBtn.disabled = true
  }
}

async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const chunks = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text) {
      chunks.push(`--- Page ${pageNumber} ---\n${text}`)
    }
  }

  if (typeof pdf.cleanup === 'function') {
    pdf.cleanup()
  }

  return chunks.join('\n\n')
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

function renderAnalysis(data) {
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

function generateAnalysisPdf(analysis) {
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
