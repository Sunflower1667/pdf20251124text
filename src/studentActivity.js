// 학생 활동 통합 관리 모듈
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { getRecentActivities, getStudentActivities, getRecentActivitiesByStudentId } from './activityStorage.js'

/**
 * 3개 활동을 통합한 PDF 생성
 */
export async function generateCombinedPdf() {
  try {
    // 최근 활동 가져오기
    const activities = await getRecentActivities()
    
    if (!activities.analysis && !activities.idea && !activities.drawing) {
      alert('저장된 활동이 없습니다. 먼저 활동을 완료해주세요.')
      return
    }

    // HTML 콘텐츠 생성
    const contentHtml = `
      <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
          발명 아이디어 프로젝트 활동 보고서
        </h1>
        <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 40px;">
          작성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        ${activities.analysis ? generateAnalysisSection(activities.analysis.data) : ''}
        ${activities.idea ? generateIdeaSection(activities.idea.data) : ''}
        ${activities.drawing ? generateDrawingSection(activities.drawing.data) : ''}
      </div>
    `

    // 임시 div 생성
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = contentHtml
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '-9999px'
    tempDiv.style.width = '800px'
    tempDiv.style.overflow = 'visible'
    document.body.appendChild(tempDiv)

    const contentElement = tempDiv.firstElementChild
    
    // 콘텐츠가 완전히 렌더링될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 이미지 로드 대기
    const images = contentElement.querySelectorAll('img')
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = resolve // 에러가 나도 계속 진행
        setTimeout(resolve, 2000) // 최대 2초 대기
      })
    }))

    // html2canvas로 이미지 변환 (개선된 옵션)
    const canvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      height: contentElement.scrollHeight,
      width: contentElement.scrollWidth,
      windowWidth: contentElement.scrollWidth,
      windowHeight: contentElement.scrollHeight,
      allowTaint: false,
      removeContainer: false,
    })

    // PDF 생성 (개선된 페이지 분할 - 잘림 방지)
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const margin = 10 // 여백
    const contentWidth = imgWidth - (margin * 2)
    const contentHeight = pageHeight - (margin * 2)
    
    const doc = new jsPDF('p', 'mm', 'a4')
    
    // 전체 이미지 높이 계산 (픽셀을 mm로 변환)
    const totalImgHeight = (canvas.height * contentWidth) / canvas.width
    
    // 전체 이미지 높이가 한 페이지보다 작으면 한 페이지에 표시
    if (totalImgHeight <= contentHeight) {
      const imgData = canvas.toDataURL('image/png', 1.0)
      doc.addImage(imgData, 'PNG', margin, margin, contentWidth, totalImgHeight)
    } else {
      // 여러 페이지로 나누기
      let sourceY = 0
      let pageNum = 0
      const totalHeight = canvas.height
      const pageHeightPx = (contentHeight / contentWidth) * canvas.width
      
      while (sourceY < totalHeight) {
        if (pageNum > 0) {
          doc.addPage()
        }
        
        // 현재 페이지에 표시할 높이 계산
        const remainingHeight = totalHeight - sourceY
        const displayHeight = Math.min(pageHeightPx, remainingHeight)
        const displayHeightMm = (displayHeight / canvas.width) * contentWidth
        
        // 소스 이미지에서 잘라낼 영역
        const sourceHeight = displayHeight
        
        // 임시 캔버스에 현재 페이지 영역 복사
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sourceHeight
        const pageCtx = pageCanvas.getContext('2d')
        pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight)
        
        // 페이지 이미지 데이터
        const pageImgData = pageCanvas.toDataURL('image/png', 1.0)
        
        // PDF에 추가
        doc.addImage(pageImgData, 'PNG', margin, margin, contentWidth, displayHeightMm)
        
        sourceY += sourceHeight
        pageNum++
      }
    }

    // 파일명 생성
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const fileName = `${year}-${month}-${day}_활동보고서.pdf`
    doc.save(fileName)

    // 임시 div 제거
    document.body.removeChild(tempDiv)

    return true
  } catch (error) {
    console.error('통합 PDF 생성 오류:', error)
    alert('PDF 생성 중 오류가 발생했습니다.')
    return false
  }
}

// 분석 섹션 HTML 생성
function generateAnalysisSection(analysisData) {
  if (!analysisData) return ''

  const { patentName, applicationNumber, features, materials } = analysisData

  return `
    <div style="margin-bottom: 50px; padding: 30px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #2563eb;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 25px; color: #2563eb;">
        1. 명세서 분석 결과
      </h2>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">특허 이름</h3>
        <p style="font-size: 14px; line-height: 1.8; margin-left: 10px;">${sanitize(patentName || '정보 없음')}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">출원 번호</h3>
        <p style="font-size: 14px; line-height: 1.8; margin-left: 10px;">${sanitize(applicationNumber || '정보 없음')}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">발명품의 특징</h3>
        <ul style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding-left: 20px;">
          ${Array.isArray(features) && features.length > 0
            ? features.map(f => `<li>${sanitize(f)}</li>`).join('')
            : '<li>정보 없음</li>'}
        </ul>
      </div>

      <div>
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">발명품의 재료</h3>
        <ul style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding-left: 20px;">
          ${Array.isArray(materials) && materials.length > 0
            ? materials.map(m => `<li>${sanitize(m)}</li>`).join('')
            : '<li>정보 없음</li>'}
        </ul>
      </div>
    </div>
  `
}

// 아이디어 섹션 HTML 생성
function generateIdeaSection(ideaData) {
  if (!ideaData) return ''

  const { name, description, chatHistory, refinedIdea, selectedIdea, ideas } = ideaData

  return `
    <div style="margin-bottom: 50px; padding: 30px; background: #f0fdf4; border-radius: 12px; border-left: 4px solid #22c55e;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 25px; color: #22c55e;">
        2. 발명 아이디어 창출
      </h2>
      
      ${selectedIdea ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">선택한 발명 아이디어</h3>
        <div style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding: 15px; background: white; border-radius: 8px;">
          <p style="font-weight: 600; margin-bottom: 8px;">${sanitize(selectedIdea.name || '')}</p>
          <p style="white-space: pre-wrap;">${sanitize(selectedIdea.description || '')}</p>
        </div>
      </div>
      ` : ''}

      ${chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #475569;">대화 내용</h3>
        <div style="font-size: 13px; line-height: 1.6; padding: 15px; background: white; border-radius: 8px;">
          ${chatHistory.map((msg, idx) => {
            const role = msg.role === 'user' ? '학생' : '도우미'
            const roleColor = msg.role === 'user' ? '#2563eb' : '#22c55e'
            return `<div style="margin-bottom: ${idx < chatHistory.length - 1 ? '15px' : '0'}; padding-bottom: ${idx < chatHistory.length - 1 ? '15px' : '0'}; border-bottom: ${idx < chatHistory.length - 1 ? '1px solid #e2e8f0' : 'none'};">
              <div style="font-weight: bold; color: ${roleColor}; margin-bottom: 5px;">${role}:</div>
              <div style="white-space: pre-wrap; line-height: 1.6;">${sanitize(msg.content || '')}</div>
            </div>`
          }).join('')}
        </div>
      </div>
      ` : ''}

      ${refinedIdea ? `
      <div style="margin-top: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">구체화된 아이디어</h3>
        <div style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding: 15px; background: white; border-radius: 8px;">
          ${typeof refinedIdea === 'string' 
            ? `<div style="white-space: pre-wrap;">${sanitize(refinedIdea)}</div>`
            : `
              ${refinedIdea.name ? `<div style="margin-bottom: 15px;"><strong>아이디어 이름:</strong> ${sanitize(refinedIdea.name)}</div>` : ''}
              ${refinedIdea.description ? `<div style="margin-bottom: 15px;"><strong>아이디어 설명:</strong><div style="white-space: pre-wrap; margin-top: 5px;">${sanitize(refinedIdea.description)}</div></div>` : ''}
              ${refinedIdea.features ? `<div style="margin-bottom: 15px;"><strong>특징:</strong><ul style="margin-top: 5px; padding-left: 20px;">${(Array.isArray(refinedIdea.features) ? refinedIdea.features : [refinedIdea.features]).map(f => `<li>${sanitize(f)}</li>`).join('')}</ul></div>` : ''}
              ${refinedIdea.materials ? `<div style="margin-bottom: 15px;"><strong>준비물:</strong><ul style="margin-top: 5px; padding-left: 20px;">${(Array.isArray(refinedIdea.materials) ? refinedIdea.materials : [refinedIdea.materials]).map(m => `<li>${sanitize(m)}</li>`).join('')}</ul></div>` : ''}
              ${refinedIdea.tools ? `<div style="margin-bottom: 15px;"><strong>필요한 도구:</strong><ul style="margin-top: 5px; padding-left: 20px;">${(Array.isArray(refinedIdea.tools) ? refinedIdea.tools : [refinedIdea.tools]).map(t => `<li>${sanitize(t)}</li>`).join('')}</ul></div>` : ''}
              ${refinedIdea.manufacturing ? `<div style="margin-bottom: 15px;"><strong>제작 방법:</strong><div style="white-space: pre-wrap; margin-top: 5px;">${sanitize(refinedIdea.manufacturing)}</div></div>` : ''}
              ${refinedIdea.notes ? `<div style="margin-bottom: 15px;"><strong>유의사항:</strong><div style="white-space: pre-wrap; margin-top: 5px;">${sanitize(refinedIdea.notes)}</div></div>` : ''}
            `}
        </div>
      </div>
      ` : ''}
    </div>
  `
}

// 그림 그리기 섹션 HTML 생성
function generateDrawingSection(drawingData) {
  if (!drawingData) return ''

  const { image } = drawingData

  return `
    <div style="margin-bottom: 30px; padding: 30px; background: #fef3c7; border-radius: 12px; border-left: 4px solid #f59e0b;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 25px; color: #f59e0b;">
        3. 발명품 표현하기
      </h2>
      
      ${image ? `
      <div style="text-align: center;">
        <img src="${image}" alt="발명품 그림" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" />
      </div>
      ` : '<p style="text-align: center; color: #64748b;">저장된 그림이 없습니다.</p>'}
    </div>
  `
}

// XSS 방지
function sanitize(value) {
  if (value == null) return ''
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

/**
 * 과거 활동 목록 가져오기
 */
export async function loadPastActivities() {
  try {
    const activities = await getStudentActivities(100)
    return activities
  } catch (error) {
    console.error('과거 활동 로드 오류:', error)
    return []
  }
}

const IDEA_RESTORE_KEY = 'studentIdeaSessionRestore'
const DRAWING_RESTORE_KEY = 'studentDrawingRestore'

/**
 * Firebase에 저장된 최신 활동을 localStorage에 복원해 각 활동 페이지에서 이어하기 가능하게 함.
 * @returns {Promise<{ hadAny: boolean; message: string }>}
 */
export async function restoreRecentActivitiesForContinue() {
  const recent = await getRecentActivities()
  const parts = []
  let hadAny = false

  if (recent.analysis?.data) {
    localStorage.setItem('analysisData', JSON.stringify(recent.analysis.data))
    localStorage.setItem('extractedText', '')
    parts.push('명세서 분석')
    hadAny = true
  }

  if (recent.idea?.data) {
    localStorage.setItem(IDEA_RESTORE_KEY, JSON.stringify(recent.idea.data))
    parts.push('아이디어·대화·구체화')
    hadAny = true
  } else {
    localStorage.removeItem(IDEA_RESTORE_KEY)
  }

  if (recent.drawing?.data?.image) {
    localStorage.setItem(DRAWING_RESTORE_KEY, recent.drawing.data.image)
    parts.push('발명품 그림')
    hadAny = true
  } else {
    localStorage.removeItem(DRAWING_RESTORE_KEY)
  }

  if (recent.inventionSpec?.data && typeof recent.inventionSpec.data === 'object') {
    try {
      localStorage.setItem('myInventionSpecDraft', JSON.stringify(recent.inventionSpec.data))
      parts.push('나만의 발명품 명세서 초안')
      hadAny = true
    } catch (_) {}
  }

  return {
    hadAny,
    message: parts.length ? parts.join(', ') : '복원할 항목 없음',
  }
}

/**
 * 브라우저에만 있는 최신 작업물을 활동 종료 직전에 Firebase에 한 번 더 맞춰 저장합니다.
 * (소감·피드백은 reflection 페이지에서 별도 저장됩니다.)
 */
export async function persistLocalWorkbenchToFirebase() {
  if (!localStorage.getItem('userId')) {
    console.warn('persistLocalWorkbenchToFirebase: 로그인 사용자 없음')
    return
  }

  const { saveStudentActivity } = await import('./activityStorage.js')

  try {
    const rawAnalysis = localStorage.getItem('analysisData')
    if (rawAnalysis) {
      const data = JSON.parse(rawAnalysis)
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        await saveStudentActivity('analysis', data)
      }
    }
  } catch (e) {
    console.warn('명세서 분석 Firebase 동기화 실패:', e)
  }

  try {
    const rawIdea = localStorage.getItem(IDEA_RESTORE_KEY)
    if (rawIdea) {
      const data = JSON.parse(rawIdea)
      if (data?.ideas && Array.isArray(data.ideas) && data.ideas.length > 0) {
        await saveStudentActivity('idea', data)
      }
    }
  } catch (e) {
    console.warn('아이디어 Firebase 동기화 실패:', e)
  }

  try {
    const img = localStorage.getItem(DRAWING_RESTORE_KEY)
    if (img && typeof img === 'string' && img.startsWith('data:')) {
      await saveStudentActivity('drawing', {
        image: img,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (e) {
    console.warn('그림 Firebase 동기화 실패:', e)
  }

  try {
    const rawInv = localStorage.getItem('myInventionSpecDraft')
    if (rawInv) {
      const data = JSON.parse(rawInv)
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        await saveStudentActivity('invention_spec', data)
      }
    }
  } catch (e) {
    console.warn('발명 명세서 초안 Firebase 동기화 실패:', e)
  }
}

/**
 * 최종 활동 보고서 PDF 생성 (reflection 포함)
 * @param {object} [options]
 * @param {{ reflection?: string; feedback?: string }} [options.reflectionOverride] iframe에서 방금 저장한 소감·피드백(재조회 레이스 방지)
 */
export async function generateFinalPdf(options = {}) {
  try {
    const activities = await getRecentActivities()

    let analysisData = activities.analysis?.data
    try {
      const raw = localStorage.getItem('analysisData')
      if (raw) {
        const p = JSON.parse(raw)
        if (p && typeof p === 'object' && Object.keys(p).length > 0) analysisData = p
      }
    } catch (_) {}

    let ideaData = activities.idea?.data
    try {
      const raw = localStorage.getItem(IDEA_RESTORE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p?.ideas && Array.isArray(p.ideas) && p.ideas.length > 0) ideaData = p
      }
    } catch (_) {}

    let drawingData = activities.drawing?.data
    try {
      const img = localStorage.getItem(DRAWING_RESTORE_KEY)
      if (img && typeof img === 'string' && img.startsWith('data:')) {
        drawingData = { ...(drawingData || {}), image: img }
      }
    } catch (_) {}

    const reflectionData = options.reflectionOverride || activities.reflection?.data

    if (!analysisData && !ideaData && !drawingData && !reflectionData) {
      alert('저장된 활동이 없습니다. 먼저 활동을 완료해주세요.')
      return
    }

    // HTML 콘텐츠 생성
    const contentHtml = `
      <div style="font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', sans-serif; padding: 40px; max-width: 800px; background: white; color: #0f172a;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px;">
          발명 아이디어 프로젝트 활동 보고서
        </h1>
        <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 40px;">
          작성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        ${analysisData ? generateAnalysisSection(analysisData) : ''}
        ${ideaData ? generateIdeaSection(ideaData) : ''}
        ${drawingData ? generateDrawingSection(drawingData) : ''}
        ${reflectionData ? generateReflectionSection(reflectionData) : ''}
      </div>
    `

    // 임시 div 생성
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = contentHtml
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '-9999px'
    tempDiv.style.width = '800px'
    tempDiv.style.overflow = 'visible'
    document.body.appendChild(tempDiv)

    const contentElement = tempDiv.firstElementChild
    
    // 콘텐츠가 완전히 렌더링될 때까지 대기 (더 긴 대기 시간)
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Force reflow to ensure layout is complete
    void contentElement.offsetHeight
    
    // 이미지 로드 대기 (더 긴 대기 시간)
    const images = contentElement.querySelectorAll('img')
    await Promise.all(Array.from(images).map(img => {
      if (img.complete && img.naturalHeight > 0) return Promise.resolve()
      return new Promise((resolve, reject) => {
        img.onload = () => {
          // 이미지 로드 후 추가 대기
          setTimeout(resolve, 100)
        }
        img.onerror = () => {
          // 에러가 나도 계속 진행
          setTimeout(resolve, 100)
        }
        setTimeout(resolve, 3000) // 최대 3초 대기
      })
    }))
    
    // 최종 렌더링 대기
    await new Promise(resolve => setTimeout(resolve, 300))

    // html2canvas로 이미지 변환 (최적화된 옵션)
    const canvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      height: contentElement.scrollHeight,
      width: contentElement.scrollWidth,
      windowWidth: contentElement.scrollWidth,
      windowHeight: Math.max(contentElement.scrollHeight, contentElement.offsetHeight),
      allowTaint: false,
      removeContainer: false,
      onclone: (clonedDoc) => {
        // 클론된 문서에서도 스타일이 제대로 적용되도록
        const clonedElement = clonedDoc.querySelector('div')
        if (clonedElement) {
          clonedElement.style.width = '800px'
          clonedElement.style.overflow = 'visible'
        }
      }
    })

    // PDF 생성 (강화된 페이지 분할 - 잘림 완전 방지)
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const margin = 10 // 여백
    const contentWidth = imgWidth - (margin * 2)
    // 여유 공간을 확보하기 위해 contentHeight를 약간 줄임 (5mm 여유)
    const contentHeight = pageHeight - (margin * 2) - 5
    
    const doc = new jsPDF('p', 'mm', 'a4')
    
    // 전체 이미지 높이 계산 (픽셀을 mm로 변환)
    const totalImgHeight = (canvas.height * contentWidth) / canvas.width
    
    // 전체 이미지 높이가 한 페이지보다 작으면 한 페이지에 표시
    if (totalImgHeight <= contentHeight) {
      const imgData = canvas.toDataURL('image/png', 1.0)
      doc.addImage(imgData, 'PNG', margin, margin, contentWidth, totalImgHeight)
    } else {
      // 여러 페이지로 나누기 (강화된 잘림 방지 로직)
      let sourceY = 0
      let pageNum = 0
      const totalHeight = canvas.height
      
      // 페이지당 픽셀 높이를 계산 (여유 공간 고려)
      // contentHeight (mm) / contentWidth (mm) * canvas.width (px) = 페이지당 픽셀 높이
      const pageHeightPx = Math.floor((contentHeight / contentWidth) * canvas.width)
      
      // 안전 마진 추가 (2픽셀 여유)
      const safePageHeightPx = pageHeightPx - 2
      
      while (sourceY < totalHeight) {
        if (pageNum > 0) {
          doc.addPage()
        }
        
        // 현재 페이지에 표시할 높이 계산
        const remainingHeight = totalHeight - sourceY
        
        // 안전한 페이지 높이 사용
        let displayHeightPx = Math.min(safePageHeightPx, remainingHeight)
        
        // 마지막 페이지인 경우 남은 모든 내용 포함
        if (remainingHeight <= safePageHeightPx + 10) {
          // 마지막 페이지에 가까우면 남은 모든 내용 포함
          displayHeightPx = remainingHeight
        }
        
        // mm로 변환 (정확한 비율 유지)
        const displayHeightMm = (displayHeightPx / canvas.width) * contentWidth
        
        // 소스 이미지에서 잘라낼 영역 (픽셀 단위)
        const sourceHeight = Math.ceil(displayHeightPx)
        
        // 실제로 복사할 높이 (원본 캔버스 범위 내에서)
        const actualSourceHeight = Math.min(sourceHeight, totalHeight - sourceY)
        
        // 임시 캔버스에 현재 페이지 영역 복사
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = actualSourceHeight
        const pageCtx = pageCanvas.getContext('2d')
        
        // 배경을 흰색으로 설정
        pageCtx.fillStyle = '#ffffff'
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        
        // 원본 캔버스에서 해당 영역 복사
        pageCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, actualSourceHeight,
          0, 0, canvas.width, actualSourceHeight
        )
        
        // 페이지 이미지 데이터
        const pageImgData = pageCanvas.toDataURL('image/png', 1.0)
        
        // 실제 표시할 높이를 mm로 재계산
        const actualDisplayHeightMm = (actualSourceHeight / canvas.width) * contentWidth
        
        // PDF에 추가 (정확한 위치와 크기)
        doc.addImage(pageImgData, 'PNG', margin, margin, contentWidth, actualDisplayHeightMm)
        
        // 다음 페이지로 이동
        sourceY += actualSourceHeight
        
        // 마지막 페이지인지 확인 (모든 내용이 포함되었는지)
        if (sourceY >= totalHeight) {
          break
        }
        
        pageNum++
        
        // 무한 루프 방지 (최대 100페이지)
        if (pageNum > 100) {
          console.warn('페이지 분할이 100페이지를 초과했습니다.')
          break
        }
      }
    }

    // 파일명 생성
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const fileName = `${year}-${month}-${day}_최종활동보고서.pdf`
    
    // PDF를 Blob으로 변환
    const pdfBlob = doc.output('blob')
    
    // Firebase Storage에 저장
    try {
      const { saveFinalPdfToStorage } = await import('./activityStorage.js')
      await saveFinalPdfToStorage(pdfBlob, fileName)
    } catch (error) {
      console.error('PDF 저장 오류:', error)
      // 저장 실패해도 다운로드는 진행
    }
    
    // 로컬 다운로드
    doc.save(fileName)

    // 임시 div 제거
    document.body.removeChild(tempDiv)

    return true
  } catch (error) {
    console.error('최종 PDF 생성 오류:', error)
    alert('PDF 생성 중 오류가 발생했습니다.')
    return false
  }
}

// Reflection 섹션 HTML 생성
function generateReflectionSection(reflectionData) {
  if (!reflectionData) return ''

  const { reflection, feedback } = reflectionData

  return `
    <div style="margin-bottom: 30px; padding: 30px; background: #fefce8; border-radius: 12px; border-left: 4px solid #eab308;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 25px; color: #eab308;">
        4. 오늘 활동 소감
      </h2>
      
      ${reflection ? `
      <div style="margin-bottom: ${feedback ? '25px' : '0'};">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">학생 소감</h3>
        <div style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding: 15px; background: white; border-radius: 8px; white-space: pre-wrap;">${sanitize(reflection)}</div>
      </div>
      ` : ''}

      ${feedback ? `
      <div>
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">교사 피드백</h3>
        <div style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding: 15px; background: #ecfdf5; border-radius: 8px; white-space: pre-wrap;">${sanitize(feedback)}</div>
      </div>
      ` : ''}
    </div>
  `
}

