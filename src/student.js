import './student.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="student-dashboard">
    <header class="dashboard-header">
      <div>
        <h1>학생 활동 대시보드</h1>
        <p class="subtitle">세 가지 활동을 한눈에 확인하세요</p>
        <button id="back-btn" class="back-btn">← 메인으로 돌아가기</button>
      </div>
      <div class="header-actions">
        <button id="save-all-btn" class="action-btn-primary">전체 활동 PDF 저장</button>
        <button id="view-past-btn" class="action-btn-secondary">과거 활동 보기</button>
      </div>
    </header>

    <div class="pages-container">
      <div class="page-section">
        <div class="page-header">
          <h2>📖 1. 명세서 쉽게 이해하기</h2>
          <button class="fullscreen-btn" data-page="student1" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="student1-frame"
          src="student1.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>

      <div class="page-section">
        <div class="page-header">
          <h2>💡 2. 발명 아이디어 창출</h2>
          <button class="fullscreen-btn" data-page="idea" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="idea-frame"
          src="idea.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>

      <div class="page-section">
        <div class="page-header">
          <h2>✍️ 3. 오늘 활동 소감</h2>
          <button class="fullscreen-btn" data-page="reflection" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="reflection-frame"
          src="reflection.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>
    </div>
  </div>
`

const backBtn = document.querySelector('#back-btn')
const saveAllBtn = document.querySelector('#save-all-btn')
const viewPastBtn = document.querySelector('#view-past-btn')
const fullscreenBtns = document.querySelectorAll('.fullscreen-btn')

// 메인으로 돌아가기
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html'
})

// 전체 활동 PDF 저장
saveAllBtn.addEventListener('click', async () => {
  saveAllBtn.disabled = true
  saveAllBtn.textContent = 'PDF 생성 중...'
  
  try {
    const { generateCombinedPdf } = await import('./studentActivity.js')
    await generateCombinedPdf()
    saveAllBtn.textContent = '전체 활동 PDF 저장'
  } catch (error) {
    console.error('PDF 저장 오류:', error)
    alert('PDF 저장 중 오류가 발생했습니다.')
    saveAllBtn.textContent = '전체 활동 PDF 저장'
  } finally {
    saveAllBtn.disabled = false
  }
})

// 과거 활동 보기
viewPastBtn.addEventListener('click', async () => {
  viewPastBtn.disabled = true
  viewPastBtn.textContent = '로딩 중...'
  
  try {
    const { loadPastActivities } = await import('./studentActivity.js')
    const activities = await loadPastActivities()
    showPastActivitiesModal(activities)
  } catch (error) {
    console.error('과거 활동 로드 오류:', error)
    alert('과거 활동을 불러오는 중 오류가 발생했습니다.')
  } finally {
    viewPastBtn.disabled = false
    viewPastBtn.textContent = '과거 활동 보기'
  }
})

// 과거 활동 모달 표시
function showPastActivitiesModal(activities) {
  // 모달 HTML 생성
  const modalHtml = `
    <div id="past-activities-modal" class="past-activities-modal">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>과거 활동 기록</h2>
          <button class="modal-close-btn" id="modal-close-btn">×</button>
        </div>
        <div class="modal-body">
          ${activities.length === 0 
            ? '<p style="text-align: center; color: #64748b; padding: 40px;">저장된 활동이 없습니다.</p>'
            : `
            <div class="activities-list">
              ${activities.map((activity, index) => {
                const date = activity.timestamp ? new Date(activity.timestamp).toLocaleString('ko-KR') : '날짜 없음'
                const typeLabels = {
                  analysis: '명세서 분석',
                  idea: '아이디어 창출',
                  reflection: '활동 소감'
                }
                const typeLabel = typeLabels[activity.type] || activity.type
                
                return `
                  <div class="activity-item" data-index="${index}">
                    <div class="activity-header">
                      <span class="activity-type">${typeLabel}</span>
                      <span class="activity-date">${date}</span>
                    </div>
                    <div class="activity-preview">
                      ${getActivityPreview(activity)}
                    </div>
                    <button class="view-detail-btn" data-index="${index}">상세 보기</button>
                  </div>
                `
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `
  
  // 모달 추가
  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  // 이벤트 리스너
  const modal = document.getElementById('past-activities-modal')
  const closeBtn = document.getElementById('modal-close-btn')
  const overlay = modal.querySelector('.modal-overlay')
  const viewDetailBtns = modal.querySelectorAll('.view-detail-btn')
  
  // 닫기 버튼
  const closeModal = () => {
    document.body.removeChild(modal)
  }
  
  closeBtn.addEventListener('click', closeModal)
  overlay.addEventListener('click', closeModal)
  
  // 상세 보기 버튼
  viewDetailBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index)
      const activity = activities[index]
      showActivityDetail(activity)
    })
  })
  
  // ESC 키로 닫기
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal()
      document.removeEventListener('keydown', handleEsc)
    }
  }
  document.addEventListener('keydown', handleEsc)
}

// 활동 미리보기 생성
function getActivityPreview(activity) {
  const { type, data } = activity
  
  if (type === 'analysis') {
    const { patentName } = data || {}
    return `<p>${sanitize(patentName || '명세서 분석 결과')}</p>`
  } else if (type === 'idea') {
    const { name, description } = data || {}
    return `<p><strong>${sanitize(name || '아이디어')}</strong><br>${sanitize((description || '').substring(0, 100))}${(description || '').length > 100 ? '...' : ''}</p>`
  } else if (type === 'reflection') {
    const { reflection } = data || {}
    return `<p>${sanitize((reflection || '').substring(0, 100))}${(reflection || '').length > 100 ? '...' : ''}</p>`
  }
  
  return '<p>활동 내용</p>'
}

// 활동 상세 보기
function showActivityDetail(activity) {
  const { type, data, timestamp } = activity
  const date = timestamp ? new Date(timestamp).toLocaleString('ko-KR') : '날짜 없음'
  
  let detailHtml = ''
  
  if (type === 'analysis') {
    const { patentName, applicationNumber, features, materials } = data || {}
    detailHtml = `
      <h3>명세서 분석 결과</h3>
      <p><strong>작성일:</strong> ${date}</p>
      <p><strong>특허 이름:</strong> ${sanitize(patentName || '정보 없음')}</p>
      <p><strong>출원 번호:</strong> ${sanitize(applicationNumber || '정보 없음')}</p>
      <p><strong>발명품의 특징:</strong></p>
      <ul>${Array.isArray(features) ? features.map(f => `<li>${sanitize(f)}</li>`).join('') : '<li>정보 없음</li>'}</ul>
      <p><strong>발명품의 재료:</strong></p>
      <ul>${Array.isArray(materials) ? materials.map(m => `<li>${sanitize(m)}</li>`).join('') : '<li>정보 없음</li>'}</ul>
    `
  } else if (type === 'idea') {
    const { name, description, chatHistory, refinedIdea } = data || {}
    detailHtml = `
      <h3>아이디어 창출</h3>
      <p><strong>작성일:</strong> ${date}</p>
      <p><strong>아이디어 이름:</strong> ${sanitize(name || '정보 없음')}</p>
      <p><strong>아이디어 설명:</strong></p>
      <p style="white-space: pre-wrap;">${sanitize(description || '정보 없음')}</p>
      ${refinedIdea ? `<p><strong>구체화된 아이디어:</strong></p><p style="white-space: pre-wrap;">${sanitize(refinedIdea)}</p>` : ''}
      ${chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 ? `
        <p><strong>대화 내용:</strong></p>
        <div style="max-height: 300px; overflow-y: auto; padding: 10px; background: #f8fafc; border-radius: 8px;">
          ${chatHistory.map(msg => {
            const role = msg.role === 'user' ? '학생' : '도우미'
            return `<p><strong>${role}:</strong> ${sanitize(msg.content || '')}</p>`
          }).join('')}
        </div>
      ` : ''}
    `
  } else if (type === 'reflection') {
    const { reflection, feedback } = data || {}
    detailHtml = `
      <h3>활동 소감</h3>
      <p><strong>작성일:</strong> ${date}</p>
      <p><strong>학생 소감:</strong></p>
      <p style="white-space: pre-wrap;">${sanitize(reflection || '정보 없음')}</p>
      ${feedback ? `<p><strong>교사 피드백:</strong></p><p style="white-space: pre-wrap;">${sanitize(feedback)}</p>` : ''}
    `
  }
  
  // 상세 보기 모달 생성
  const detailModalHtml = `
    <div id="activity-detail-modal" class="activity-detail-modal">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>활동 상세 내용</h2>
          <button class="modal-close-btn" id="detail-modal-close-btn">×</button>
        </div>
        <div class="modal-body">
          ${detailHtml}
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', detailModalHtml)
  
  const detailModal = document.getElementById('activity-detail-modal')
  const detailCloseBtn = document.getElementById('detail-modal-close-btn')
  const detailOverlay = detailModal.querySelector('.modal-overlay')
  
  const closeDetailModal = () => {
    document.body.removeChild(detailModal)
  }
  
  detailCloseBtn.addEventListener('click', closeDetailModal)
  detailOverlay.addEventListener('click', closeDetailModal)
  
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeDetailModal()
      document.removeEventListener('keydown', handleEsc)
    }
  }
  document.addEventListener('keydown', handleEsc)
}

// XSS 방지
function sanitize(value) {
  if (value == null) return ''
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

// 전체 화면 버튼 클릭 이벤트
fullscreenBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.getAttribute('data-page')
    let url = ''
    
    switch(page) {
      case 'student1':
        url = 'student1.html'
        break
      case 'idea':
        url = 'idea.html'
        break
      case 'reflection':
        url = 'reflection.html'
        break
    }
    
    if (url) {
      window.open(url, '_blank')
    }
  })
})

