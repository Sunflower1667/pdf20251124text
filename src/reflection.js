import './reflection.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="shell">
    <header>
      <h1>오늘 활동 소감</h1>
      <p class="subtitle">오늘 활동한 내용에 대한 소감을 자유롭게 작성해보세요.</p>
    </header>

    <section class="reflection-input">
      <div class="input-header">
        <h2>소감 작성</h2>
        <div class="char-count">
          <span id="char-count">0</span>자
        </div>
      </div>
      <textarea 
        id="reflection-text" 
        placeholder="오늘 활동에 대한 소감을 작성해주세요...&#10;&#10;예: 오늘은 명세서를 분석하고 새로운 발명 아이디어를 생각해보는 시간이었습니다. 처음에는 어려웠지만, AI 도우미의 도움으로 아이디어를 구체화할 수 있어서 좋았습니다..."
        rows="6"
      ></textarea>
    </section>

    <section class="actions-section">
      <div class="action-buttons">
        <button id="get-feedback-btn" type="button" disabled>소감 제출 및 피드백 받기</button>
      </div>
      <p id="status-message" class="status-message">소감을 작성하면 제출 및 피드백을 받을 수 있습니다.</p>
    </section>

    <section class="feedback-section" id="feedback-section" style="display: none;">
      <h2>교사 피드백</h2>
      <div id="feedback-content" class="feedback-content"></div>
      <div class="feedback-actions">
        <button id="save-with-feedback-btn" type="button">PDF로 오늘 활동결과 저장하기</button>
        <button id="finish-activity-btn" type="button" style="display: none;">활동 종료하기</button>
      </div>
    </section>
  </div>
`

const reflectionText = document.querySelector('#reflection-text')
const charCount = document.querySelector('#char-count')
const getFeedbackBtn = document.querySelector('#get-feedback-btn')
const statusMessage = document.querySelector('#status-message')
const feedbackSection = document.querySelector('#feedback-section')
const feedbackContent = document.querySelector('#feedback-content')
const saveWithFeedbackBtn = document.querySelector('#save-with-feedback-btn')
const finishActivityBtn = document.querySelector('#finish-activity-btn')

let feedbackText = ''

// 글자 수 카운트
reflectionText.addEventListener('input', () => {
  const text = reflectionText.value.trim()
  const length = text.length
  charCount.textContent = length

  // 버튼 활성화/비활성화
  const hasContent = length > 0
  getFeedbackBtn.disabled = !hasContent

  // 상태 메시지 업데이트
  if (length === 0) {
    statusMessage.textContent = '소감을 작성하면 제출 및 피드백을 받을 수 있습니다.'
    statusMessage.dataset.mode = 'info'
  } else {
    statusMessage.textContent = '소감이 작성되었습니다. 제출 및 피드백을 받을 수 있습니다.'
    statusMessage.dataset.mode = 'success'
  }
})

// 소감 제출 및 피드백 받기
getFeedbackBtn.addEventListener('click', async () => {
  const text = reflectionText.value.trim()
  if (!text) {
    alert('피드백을 받을 소감 내용이 없습니다.')
    return
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    alert('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
    return
  }

  getFeedbackBtn.disabled = true
  getFeedbackBtn.textContent = '제출 및 피드백 생성 중...'
  statusMessage.textContent = '소감을 제출하고 발명아이디어 보조교사가 피드백을 작성하고 있습니다...'
  statusMessage.dataset.mode = 'info'

  try {
    // Firebase에 활동 저장 (소감 제출)
    const { saveStudentActivity } = await import('./activityStorage.js')
    await saveStudentActivity('reflection', { reflection: text })
    
    // 이전 활동 가져오기
    const { getRecentActivities } = await import('./activityStorage.js')
    const activities = await getRecentActivities()
    
    feedbackText = await generateFeedback(apiKey, text, activities)
    feedbackContent.innerHTML = `
      <div class="feedback-text">${sanitize(feedbackText).replace(/\n/g, '<br>')}</div>
    `
    feedbackSection.style.display = 'block'
    
    // 활동 종료하기 버튼 표시 (모달에서 열렸는지 확인)
    if (window.parent !== window && finishActivityBtn) {
      // iframe 안에서 실행 중 (모달에서 열림)
      finishActivityBtn.style.display = 'inline-block'
    }
    
    statusMessage.textContent = '피드백이 생성되었습니다.'
    statusMessage.dataset.mode = 'success'
  } catch (error) {
    console.error('피드백 생성 오류:', error)
    statusMessage.textContent = error.message || '제출 및 피드백 생성 중 오류가 발생했습니다.'
    statusMessage.dataset.mode = 'error'
  } finally {
    getFeedbackBtn.disabled = false
    getFeedbackBtn.textContent = '소감 제출 및 피드백 받기'
  }
})

// 활동 종료하기 버튼
if (finishActivityBtn) {
  finishActivityBtn.addEventListener('click', async () => {
    const text = reflectionText.value.trim()
    if (!text) {
      alert('소감을 먼저 작성해주세요.')
      return
    }

    if (!feedbackText) {
      alert('피드백을 먼저 받아주세요.')
      return
    }

    finishActivityBtn.disabled = true
    finishActivityBtn.textContent = '활동 종료 중...'

    try {
      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('reflection', { reflection: text, feedback: feedbackText })

      if (window.parent !== window) {
        window.parent.postMessage({ type: 'finish-activity' }, '*')
      } else {
        const sa = await import('./studentActivity.js')
        await sa.persistLocalWorkbenchToFirebase()
        await new Promise((r) => setTimeout(r, 400))
        await sa.generateFinalPdf()
        alert('활동이 완료되었습니다! Firebase에 저장되었고, 활동 보고서 PDF도 저장되었습니다.')
        window.location.href = 'index.html'
      }
    } catch (error) {
      console.error('활동 종료 오류:', error)
      alert('활동 종료 중 오류가 발생했습니다.')
      finishActivityBtn.disabled = false
      finishActivityBtn.textContent = '활동 종료하기'
    }
  })
}

// PDF로 오늘 활동결과 저장 (Firebase 먼저, 이어서 PDF 파일)
saveWithFeedbackBtn.addEventListener('click', async () => {
  const text = reflectionText.value.trim()
  if (!text) {
    alert('저장할 소감 내용이 없습니다.')
    return
  }

  if (!feedbackText) {
    alert('저장할 피드백 내용이 없습니다. 먼저 피드백을 받아주세요.')
    return
  }

  saveWithFeedbackBtn.disabled = true
  saveWithFeedbackBtn.textContent = '저장 중...'

  try {
    const { saveStudentActivity } = await import('./activityStorage.js')
    await saveStudentActivity('reflection', { reflection: text, feedback: feedbackText })
    await generateReflectionPdf(text, feedbackText)
    
    statusMessage.textContent = 'PDF 파일로 저장되었습니다. (소감·피드백은 Firebase에도 저장되었습니다.)'
    statusMessage.dataset.mode = 'success'
  } catch (error) {
    console.error('PDF 저장 오류:', error)
    alert('PDF 저장 중 오류가 발생했습니다.')
    statusMessage.textContent = '저장 중 오류가 발생했습니다.'
    statusMessage.dataset.mode = 'error'
  } finally {
    saveWithFeedbackBtn.disabled = false
    saveWithFeedbackBtn.textContent = 'PDF로 오늘 활동결과 저장하기'
  }
})

async function generateFeedback(apiKey, reflection, activities = {}) {
  // 이전 활동 정보 정리
  let activitySummary = ''
  
  if (activities.analysis) {
    const { patentName, features, materials } = activities.analysis.data || {}
    activitySummary += `\n1. 명세서 분석 활동:\n`
    activitySummary += `   - 분석한 특허: ${patentName || '정보 없음'}\n`
    if (features && Array.isArray(features)) {
      activitySummary += `   - 발명품 특징: ${features.slice(0, 3).join(', ')}\n`
    }
    if (materials && Array.isArray(materials)) {
      activitySummary += `   - 사용 재료: ${materials.slice(0, 3).join(', ')}\n`
    }
  }
  
  if (activities.idea) {
    const { selectedIdea, chatHistory, refinedIdea } = activities.idea.data || {}
    activitySummary += `\n2. 발명 아이디어 창출 활동:\n`
    if (selectedIdea) {
      activitySummary += `   - 선택한 아이디어: ${selectedIdea.name || '정보 없음'}\n`
      activitySummary += `   - 아이디어 설명: ${(selectedIdea.description || '').substring(0, 100)}...\n`
    }
    if (chatHistory && Array.isArray(chatHistory)) {
      activitySummary += `   - 대화 횟수: ${chatHistory.filter(m => m.role === 'user').length}번\n`
    }
    if (refinedIdea) {
      activitySummary += `   - 구체화된 아이디어: 완료\n`
    }
  }
  
  if (activities.drawing) {
    const { image } = activities.drawing.data || {}
    activitySummary += `\n3. 발명품 표현하기 활동:\n`
    activitySummary += `   - 그림: ${image ? '완료' : '미완료'}\n`
  }
  
  const prompt = `학생이 오늘 활동에 대한 소감을 작성했습니다. 교사로서 따뜻하고 격려하는 말투로 피드백과 평가를 해주세요.

학생이 오늘 수행한 활동들:
${activitySummary || '활동 정보 없음'}

학생의 소감:
${reflection}

다음 내용을 포함하여 피드백을 작성해주세요:
1. 학생이 수행한 활동들(명세서 분석, 아이디어 창출, 발명품 표현하기)과 소감을 연결하여 종합적으로 평가
2. 각 활동에서 보인 노력과 성장을 구체적으로 인정하는 내용
3. 잘한 점과 칭찬할 부분 (특히 활동과 소감을 연결하여)
4. 더 개선할 수 있는 부분에 대한 조언
5. 격려와 응원의 메시지

교사의 말투로 친근하고 따뜻하게 작성해주세요. 학생이 중학생이므로 쉬운 용어를 사용하고, 활동 내용과 소감을 자연스럽게 연결하여 피드백해주세요.`

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
    const errorMsg =
      payload?.error?.message ||
      `API 오류 (${response.status}) - ${response.statusText}`
    console.error('Feedback API Error:', errorMsg, payload)
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

async function generateReflectionPdf(reflection, feedback) {
  const contentHtml = `
    <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        오늘 활동 소감
      </h1>
      
      <div style="margin-bottom: ${feedback ? '40px' : '0'};">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #475569;">학생 소감</h2>
        <div style="font-size: 14px; line-height: 1.8; padding: 20px; background: #f8fafc; border-radius: 12px; white-space: pre-wrap;">${sanitize(reflection).replace(/\n/g, '<br>')}</div>
      </div>

      ${feedback
        ? `
      <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e2e8f0;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #475569;">교사 피드백</h2>
        <div style="font-size: 14px; line-height: 1.8; padding: 20px; background: #ecfdf5; border-radius: 12px; white-space: pre-wrap;">${sanitize(feedback).replace(/\n/g, '<br>')}</div>
      </div>
      `
        : ''}
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: right; color: #64748b; font-size: 12px;">
        작성일: ${new Date().toLocaleDateString('ko-KR')}
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
    const fileName = feedback
      ? `${year}-${month}-${day}_활동소감_피드백.pdf`
      : `${year}-${month}-${day}_활동소감.pdf`
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

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

