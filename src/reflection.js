import './reflection.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const app = document.querySelector('#app')

const EMOTION_OPTIONS = [
  { id: 'insight', icon: '💡', label: '깨달음' },
  { id: 'confusion', icon: '😵', label: '혼란' },
  { id: 'passion', icon: '🔥', label: '열정' },
  { id: 'worry', icon: '🧩', label: '고민' },
  { id: 'achievement', icon: '✅', label: '성취' },
]

const GROWTH_OPTIONS = [
  { id: 'seed', icon: '🌱', label: '씨앗', description: '이제 막 시작했어요' },
  { id: 'sprout', icon: '🌿', label: '싹', description: '조금씩 자라고 있어요' },
  { id: 'flower', icon: '🌸', label: '꽃', description: '활짝 피어났어요' },
  { id: 'fruit', icon: '🍎', label: '열매', description: '훌륭하게 결실을 맺었어요' },
]

app.innerHTML = `
  <div class="shell">
    <header>
      <h1>오늘 활동 소감</h1>
      <p class="subtitle">오늘 활동한 내용에 대한 소감을 자유롭게 작성해보세요.</p>
    </header>

    <section class="emotion-section">
      <div class="section-header">
        <h2>오늘의 내 마음은?</h2>
        <p class="section-hint">활동을 하면서 가장 크게 느꼈던 감정을 하나 골라보세요.</p>
      </div>
      <div class="emotion-grid" id="emotion-grid">
        ${EMOTION_OPTIONS.map(
          (opt) => `
          <button type="button" class="emotion-chip" data-emotion="${opt.id}">
            <span class="emotion-icon">${opt.icon}</span>
            <span class="emotion-label">${opt.label}</span>
          </button>
        `,
        ).join('')}
      </div>
    </section>

    <section class="growth-section">
      <div class="section-header">
        <h2>오늘 내 성장은 어디까지?</h2>
        <p class="section-hint">씨앗에서 열매까지, 오늘 내가 자란 만큼 골라보세요.</p>
      </div>
      <div class="growth-track" id="growth-track">
        ${GROWTH_OPTIONS.map(
          (opt, idx) => `
          <button type="button" class="growth-stage" data-growth="${opt.id}" data-step="${idx + 1}">
            <span class="growth-step">${idx + 1}단계</span>
            <span class="growth-icon">${opt.icon}</span>
            <span class="growth-label">${opt.label}</span>
            <span class="growth-desc">${opt.description}</span>
          </button>
          ${idx < GROWTH_OPTIONS.length - 1 ? '<span class="growth-arrow" aria-hidden="true">→</span>' : ''}
        `,
        ).join('')}
      </div>
    </section>

    <section class="reflection-input">
      <div class="input-header">
        <h2>간단한 소감</h2>
        <div class="char-count">
          <span id="char-count">0</span>자
        </div>
      </div>
      <textarea 
        id="reflection-text" 
        placeholder="오늘 활동에 대한 소감을 한두 문장으로 자유롭게 적어보세요.&#10;&#10;예) 처음엔 어려웠지만 아이디어가 떠올랐을 때 정말 뿌듯했어요."
        rows="4"
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
const emotionGrid = document.querySelector('#emotion-grid')
const growthTrack = document.querySelector('#growth-track')

let feedbackText = ''
let selectedEmotion = null
let selectedGrowth = null

function findEmotion(id) {
  return EMOTION_OPTIONS.find((o) => o.id === id) || null
}

function findGrowth(id) {
  return GROWTH_OPTIONS.find((o) => o.id === id) || null
}

function updateSubmitState() {
  const hasText = reflectionText.value.trim().length > 0
  const ready = hasText && !!selectedEmotion && !!selectedGrowth
  getFeedbackBtn.disabled = !ready

  if (!hasText && !selectedEmotion && !selectedGrowth) {
    statusMessage.textContent = '감정과 성장 단계를 고르고, 간단한 소감을 작성해 주세요.'
    statusMessage.dataset.mode = 'info'
    return
  }
  if (!selectedEmotion) {
    statusMessage.textContent = '오늘의 감정을 한 가지 골라 주세요.'
    statusMessage.dataset.mode = 'info'
    return
  }
  if (!selectedGrowth) {
    statusMessage.textContent = '오늘의 성장 단계를 골라 주세요.'
    statusMessage.dataset.mode = 'info'
    return
  }
  if (!hasText) {
    statusMessage.textContent = '간단한 소감을 한두 문장 작성해 주세요.'
    statusMessage.dataset.mode = 'info'
    return
  }
  statusMessage.textContent = '준비 완료! 제출하면 따뜻한 피드백을 받을 수 있어요.'
  statusMessage.dataset.mode = 'success'
}

reflectionText.addEventListener('input', () => {
  charCount.textContent = reflectionText.value.trim().length
  updateSubmitState()
})

emotionGrid.addEventListener('click', (event) => {
  const chip = event.target.closest('.emotion-chip')
  if (!chip) return
  selectedEmotion = chip.dataset.emotion
  emotionGrid
    .querySelectorAll('.emotion-chip')
    .forEach((el) => el.classList.toggle('is-selected', el === chip))
  updateSubmitState()
})

growthTrack.addEventListener('click', (event) => {
  const stage = event.target.closest('.growth-stage')
  if (!stage) return
  selectedGrowth = stage.dataset.growth
  const step = Number(stage.dataset.step)
  growthTrack.querySelectorAll('.growth-stage').forEach((el) => {
    const elStep = Number(el.dataset.step)
    el.classList.toggle('is-selected', el === stage)
    el.classList.toggle('is-passed', elStep < step)
  })
  updateSubmitState()
})

updateSubmitState()

// 소감 제출 및 피드백 받기
getFeedbackBtn.addEventListener('click', async () => {
  const text = reflectionText.value.trim()
  if (!text) {
    alert('피드백을 받을 소감 내용이 없습니다.')
    return
  }
  if (!selectedEmotion) {
    alert('오늘의 감정을 한 가지 골라 주세요.')
    return
  }
  if (!selectedGrowth) {
    alert('오늘의 성장 단계를 골라 주세요.')
    return
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    alert('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
    return
  }

  const emotion = findEmotion(selectedEmotion)
  const growth = findGrowth(selectedGrowth)

  getFeedbackBtn.disabled = true
  getFeedbackBtn.textContent = '제출 및 피드백 생성 중...'
  statusMessage.textContent = '소감을 제출하고 선생님이 따뜻한 피드백을 적고 있어요...'
  statusMessage.dataset.mode = 'info'

  try {
    const { saveStudentActivity } = await import('./activityStorage.js')
    await saveStudentActivity('reflection', {
      reflection: text,
      emotion: selectedEmotion,
      emotionLabel: emotion?.label || '',
      emotionIcon: emotion?.icon || '',
      growth: selectedGrowth,
      growthLabel: growth?.label || '',
      growthIcon: growth?.icon || '',
    })

    const { getRecentActivities } = await import('./activityStorage.js')
    const activities = await getRecentActivities()

    feedbackText = await generateFeedback(apiKey, text, activities, { emotion, growth })
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
      const emotion = findEmotion(selectedEmotion)
      const growth = findGrowth(selectedGrowth)
      const reflectionPayload = {
        reflection: text,
        feedback: feedbackText,
        emotion: selectedEmotion,
        emotionLabel: emotion?.label || '',
        emotionIcon: emotion?.icon || '',
        growth: selectedGrowth,
        growthLabel: growth?.label || '',
        growthIcon: growth?.icon || '',
      }

      const { saveStudentActivity } = await import('./activityStorage.js')
      await saveStudentActivity('reflection', reflectionPayload)

      if (window.parent !== window) {
        window.parent.postMessage(
          { type: 'finish-activity', reflection: reflectionPayload },
          '*'
        )
      } else {
        const sa = await import('./studentActivity.js')
        await sa.persistLocalWorkbenchToFirebase()
        await new Promise((r) => setTimeout(r, 600))
        await sa.generateFinalPdf({ reflectionOverride: reflectionPayload })
        alert('활동이 완료되었습니다! 활동 내용이 저장되었습니다.')
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
    const emotion = findEmotion(selectedEmotion)
    const growth = findGrowth(selectedGrowth)
    const reflectionPayload = {
      reflection: text,
      feedback: feedbackText,
      emotion: selectedEmotion,
      emotionLabel: emotion?.label || '',
      emotionIcon: emotion?.icon || '',
      growth: selectedGrowth,
      growthLabel: growth?.label || '',
      growthIcon: growth?.icon || '',
    }
    const { saveStudentActivity } = await import('./activityStorage.js')
    await saveStudentActivity('reflection', reflectionPayload)
    await generateReflectionPdf(text, feedbackText, { emotion, growth })
    
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

async function generateFeedback(apiKey, reflection, activities = {}, mood = {}) {
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
  
  const emotionLine = mood?.emotion
    ? `${mood.emotion.icon} ${mood.emotion.label}`
    : '선택하지 않음'
  const growthLine = mood?.growth
    ? `${mood.growth.icon} ${mood.growth.label} (${mood.growth.description})`
    : '선택하지 않음'

  const prompt = `당신은 학생의 마음을 가장 먼저 살피는 따뜻한 선생님입니다. 학생이 오늘 활동을 마치며 자신의 감정과 성장 단계, 그리고 짧은 소감을 남겼습니다. 평가나 점수보다 "정서적 지원"을 최우선으로, 짧고 따뜻한 글 피드백을 써 주세요.

[학생이 오늘 수행한 활동 요약]
${activitySummary || '활동 정보 없음'}

[학생이 고른 오늘의 감정]
${emotionLine}

[학생이 고른 오늘의 성장 단계]
${growthLine}

[학생의 소감]
${reflection}

작성 규칙:
1. 가장 먼저, 학생이 고른 감정(${mood?.emotion?.label || ''})을 있는 그대로 받아주고 공감해 주세요. "그런 마음이 드는 건 자연스러워" 같은 정서적 수용을 먼저 해 주세요.
2. 평가/지적/조언은 최소화하세요. 부족한 점을 지적하기보다, 학생이 오늘 보여준 작은 노력과 용기를 구체적으로 알아봐 주세요.
3. 학생이 고른 성장 단계(${mood?.growth?.label || ''})를 인정하고, 그 단계에 어울리는 따뜻한 응원 한 문장을 넣어 주세요. (예: 씨앗이면 "시작한 것 자체가 대단해", 열매면 "정말 잘 자라났구나")
4. 만약 감정이 '혼란'이나 '고민'처럼 힘든 감정이라면, 해결책을 서둘러 주기보다 "괜찮아, 그런 날도 있어"라고 안심시켜 주세요.
5. 어려운 단어 없이, 중학생이 편하게 읽을 수 있게 친근한 말투로 써 주세요.
6. 분량은 4~6문장 정도로 짧고 진심 어린 편지처럼 작성해 주세요. 마지막은 짧은 응원 한 줄로 마무리해 주세요.`

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

async function generateReflectionPdf(reflection, feedback, mood = {}) {
  const moodHtml = (mood?.emotion || mood?.growth)
    ? `
      <div style="display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap;">
        ${mood?.emotion ? `
        <div style="flex: 1; min-width: 220px; padding: 18px 20px; background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 13px; color: #92400e; font-weight: 700; margin-bottom: 8px;">오늘의 감정</div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${sanitize(mood.emotion.icon)} ${sanitize(mood.emotion.label)}</div>
        </div>` : ''}
        ${mood?.growth ? `
        <div style="flex: 1; min-width: 220px; padding: 18px 20px; background: #dcfce7; border-radius: 12px; border-left: 4px solid #16a34a;">
          <div style="font-size: 13px; color: #166534; font-weight: 700; margin-bottom: 8px;">오늘의 성장</div>
          <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${sanitize(mood.growth.icon)} ${sanitize(mood.growth.label)}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">${sanitize(mood.growth.description || '')}</div>
        </div>` : ''}
      </div>
    `
    : ''

  const contentHtml = `
    <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        오늘 활동 소감
      </h1>

      ${moodHtml}

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

