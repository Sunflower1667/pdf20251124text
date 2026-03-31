import './student1.css'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url'
import { jsPDF } from 'jspdf'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'

GlobalWorkerOptions.workerSrc = pdfWorker

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

/**
 * @param {HTMLElement | null} rootEl
 * @param {{ heading?: string; subtitle?: string }} [options]
 */
export function mountStudentPdfAnalysis(rootEl, options = {}) {
  if (!rootEl) {
    console.error('mountStudentPdfAnalysis: root element not found')
    return
  }

  const heading = options.heading ?? '명세서 쉽게 이해하기'
  const subtitle = options.subtitle ?? '명세서 파일을 받아 업로드 해주세요!'

  rootEl.innerHTML = `
  <div class="shell">
    <header>
      <h1>${escapeHtml(heading)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
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
      <p id="analysis-status" class="analysis-status">PDF가 업로드 완료되면 분석을 할 수 있어요!</p>
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

  const pdfInput = rootEl.querySelector('#pdf-input')
  const analyzeBtn = rootEl.querySelector('#analyze-btn')
  const analysisStatusEl = rootEl.querySelector('#analysis-status')
  const analysisGrid = rootEl.querySelector('#analysis-grid')
  const goToIdeaBtn = rootEl.querySelector('#go-to-idea-btn')

  let lastExtractedText = ''
  let lastAnalysisData = null

  try {
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
        setAnalysisStatus(
          '저장된 명세서 분석 결과를 불러왔습니다. 새 PDF를 올리면 다시 분석할 수 있어요.',
          'success'
        )
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
    analyzeBtn.disabled = isBusy || !lastExtractedText
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
        return
      }

      setAnalysisStatus('텍스트를 추출하는 중입니다...', 'info')
      if (analyzeBtn) analyzeBtn.disabled = true
      if (goToIdeaBtn) goToIdeaBtn.disabled = true
      lastAnalysisData = null

      try {
        lastExtractedText = await extractTextFromPdf(file)

        if (!lastExtractedText) {
          setAnalysisStatus('PDF에서 텍스트를 추출할 수 없습니다. 스캔 PDF인지 확인해 주세요.', 'warn')
          if (analyzeBtn) analyzeBtn.disabled = true
          return
        }

        setAnalysisStatus('텍스트 추출 완료! [명세서 분석하기]를 눌러 요약을 받아 보세요.', 'success')
        if (analyzeBtn) analyzeBtn.disabled = false
      } catch (error) {
        console.error(error)
        setAnalysisStatus('PDF 텍스트 추출에 실패했습니다. 다른 파일로 시도해 주세요.', 'error')
        if (analyzeBtn) analyzeBtn.disabled = true
      }
    })
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      if (!lastExtractedText.trim()) {
        setAnalysisStatus('먼저 PDF를 업로드해 텍스트를 추출해 주세요.', 'warn')
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
        lastAnalysisData = analysis
        renderAnalysis(analysisGrid, analysis)

        localStorage.setItem('analysisData', JSON.stringify(analysis))
        localStorage.setItem('extractedText', lastExtractedText)

        const { saveStudentActivity } = await import('./activityStorage.js')
        await saveStudentActivity('analysis', analysis)

        if (goToIdeaBtn) goToIdeaBtn.disabled = false
        setAnalysisStatus('분석 완료! 아이디어 창출 단계로 이동할 수 있어요.', 'success')
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

  listenForWorkbenchFlushRequest(() => {
    if (lastAnalysisData && typeof lastAnalysisData === 'object') {
      try {
        localStorage.setItem('analysisData', JSON.stringify(lastAnalysisData))
        if (lastExtractedText) localStorage.setItem('extractedText', lastExtractedText)
      } catch (_) {}
    }
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
