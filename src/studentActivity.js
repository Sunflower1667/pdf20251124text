// 학생 활동 통합 관리 모듈
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { getRecentActivities, getStudentActivities } from './activityStorage.js'

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
    document.body.appendChild(tempDiv)

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

  const { name, description, chatHistory, refinedIdea } = ideaData

  return `
    <div style="margin-bottom: 50px; padding: 30px; background: #f0fdf4; border-radius: 12px; border-left: 4px solid #22c55e;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 25px; color: #22c55e;">
        2. 발명 아이디어 창출
      </h2>
      
      ${name ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">아이디어 이름</h3>
        <p style="font-size: 14px; line-height: 1.8; margin-left: 10px;">${sanitize(name)}</p>
      </div>
      ` : ''}

      ${description ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">아이디어 설명</h3>
        <p style="font-size: 14px; line-height: 1.8; margin-left: 10px; white-space: pre-wrap;">${sanitize(description)}</p>
      </div>
      ` : ''}

      ${refinedIdea ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569;">구체화된 아이디어</h3>
        <div style="font-size: 14px; line-height: 1.8; margin-left: 10px; padding: 15px; background: white; border-radius: 8px; white-space: pre-wrap;">${sanitize(refinedIdea)}</div>
      </div>
      ` : ''}

      ${chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 ? `
      <div style="margin-top: 20px;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #475569;">대화 내용 요약</h3>
        <div style="font-size: 13px; line-height: 1.6; max-height: 200px; overflow-y: auto; padding: 15px; background: white; border-radius: 8px;">
          ${chatHistory.slice(0, 5).map(msg => {
            const role = msg.role === 'user' ? '학생' : '도우미'
            return `<div style="margin-bottom: 12px;"><strong>${role}:</strong> ${sanitize(msg.content || '').substring(0, 200)}${(msg.content || '').length > 200 ? '...' : ''}</div>`
          }).join('')}
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
        3. 발명품 그림 그리기
      </h2>
      
      ${image ? `
      <div style="text-align: center;">
        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #475569;">그린 그림</h3>
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

