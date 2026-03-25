import './student.css'
import { initFirebase } from './firebaseConfig.js'
import { onAuthStateChanged, signOut } from 'firebase/auth'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="student-dashboard">
    <header class="dashboard-header">
      <div class="header-brand">
        <h1>학생 활동 대시보드</h1>
        <p class="subtitle">단계를 선택하면 아래 넓은 영역에서 활동합니다</p>
        <button id="back-btn" class="back-btn">← 메인으로 돌아가기</button>
        <nav class="activity-nav" aria-label="활동 단계 선택">
          <button type="button" class="activity-nav-btn" data-activity-src="student2.html">명세서 탐색하기</button>
          <button type="button" class="activity-nav-btn" data-activity-src="idea.html">발명 아이디어 창출하기</button>
          <button type="button" class="activity-nav-btn" data-activity-src="idea.html#concretize">발명품 선정 및 구체화</button>
          <button type="button" class="activity-nav-btn" data-activity-src="drawing.html">발명품 표현하기</button>
          <button type="button" class="activity-nav-btn" data-activity-src="invention-spec.html">나만의 발명품 명세서 완성하기</button>
        </nav>
      </div>
      <div class="header-actions">
        <button id="finish-activity-btn" class="action-btn-primary">활동 종료하기</button>
        <button id="resume-activities-btn" class="action-btn-primary">과거 활동 불러오기</button>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="view-past-btn" class="action-btn-secondary">과거 활동 보기</button>
          <div class="user-info" id="user-info" style="display: none;">
            <div class="user-profile">
              <img id="user-photo" src="" alt="프로필" class="user-avatar" onerror="this.style.display='none'">
              <span id="user-name" class="user-name"></span>
            </div>
            <button id="logout-btn" class="logout-btn">로그아웃</button>
          </div>
        </div>
      </div>
    </header>

    <div class="activity-workspace" id="activity-workspace">
      <div id="activity-placeholder" class="activity-placeholder" aria-live="polite">
        활동할 내용을 클릭하세요
      </div>
      <iframe
        id="activity-frame"
        class="activity-frame"
        title="선택한 활동"
        frameborder="0"
        hidden
      ></iframe>
    </div>
  </div>
`

const backBtn = document.querySelector('#back-btn')
const finishActivityBtn = document.querySelector('#finish-activity-btn')
const resumeActivitiesBtn = document.querySelector('#resume-activities-btn')
const viewPastBtn = document.querySelector('#view-past-btn')
const activityNavBtns = document.querySelectorAll('.activity-nav-btn')
const activityPlaceholder = document.querySelector('#activity-placeholder')
const activityFrame = document.querySelector('#activity-frame')
const userInfo = document.querySelector('#user-info')
const userName = document.querySelector('#user-name')
const userPhoto = document.querySelector('#user-photo')
const logoutBtn = document.querySelector('#logout-btn')

// Firebase 초기화 및 로그인 상태 확인
const firebaseResult = initFirebase()
if (firebaseResult.auth) {
  onAuthStateChanged(firebaseResult.auth, (user) => {
    if (user) {
      // 로그인 상태: 사용자 정보 표시
      const displayName = localStorage.getItem('userName') || user.displayName || user.email
      const photoURL = localStorage.getItem('userPhoto') || user.photoURL || ''
      
      if (userName) userName.textContent = displayName
      if (userPhoto) {
        userPhoto.src = photoURL
        userPhoto.style.display = photoURL ? 'block' : 'none'
      }
      if (userInfo) userInfo.style.display = 'flex'
    } else {
      // 로그아웃 상태: 사용자 정보 숨김
      if (userInfo) userInfo.style.display = 'none'
      // 로그인 페이지로 리다이렉트
      window.location.href = 'login.html?role=student'
    }
  })
} else {
  // Firebase 초기화 실패 시 localStorage 정보 사용
  const storedName = localStorage.getItem('userName')
  const storedPhoto = localStorage.getItem('userPhoto')
  
  if (storedName) {
    if (userName) userName.textContent = storedName
    if (userPhoto && storedPhoto) {
      userPhoto.src = storedPhoto
      userPhoto.style.display = 'block'
    }
    if (userInfo) userInfo.style.display = 'flex'
  }
}

// 로그아웃 버튼
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      try {
        if (firebaseResult.auth) {
          await signOut(firebaseResult.auth)
        }
        // localStorage 정리
        localStorage.removeItem('userId')
        localStorage.removeItem('userEmail')
        localStorage.removeItem('userName')
        localStorage.removeItem('userPhoto')
        localStorage.removeItem('userRole')
        // 로그인 페이지로 이동
        window.location.href = 'login.html?role=student'
      } catch (error) {
        console.error('로그아웃 오류:', error)
        alert('로그아웃 중 오류가 발생했습니다.')
      }
    }
  })
}

// 메인으로 돌아가기
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html'
  })
}

// 활동 종료하기 (reflection 모달 띄우기)
if (finishActivityBtn) {
  finishActivityBtn.addEventListener('click', () => {
    showReflectionModal()
  })
}

// Reflection 모달 표시
function showReflectionModal() {
  const modalHtml = `
    <div id="reflection-modal" class="reflection-modal">
      <div class="modal-overlay"></div>
      <div class="modal-content reflection-modal-content">
        <div class="modal-header">
          <h2>오늘 활동 소감</h2>
          <button id="close-reflection-modal-btn" class="close-btn">×</button>
        </div>
        <div class="modal-body reflection-modal-body">
          <iframe id="reflection-iframe" src="reflection.html" frameborder="0" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', modalHtml)
  
  const modal = document.getElementById('reflection-modal')
  const closeBtn = document.getElementById('close-reflection-modal-btn')
  const overlay = modal.querySelector('.modal-overlay')
  const iframe = document.getElementById('reflection-iframe')
  
  // 닫기 버튼
  const closeModal = () => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal)
    }
  }
  
  closeBtn.addEventListener('click', closeModal)
  overlay.addEventListener('click', closeModal)
  
  // iframe에서 메시지 받기 (활동 종료하기: 소감·피드백 Firebase 저장 후 전송)
  const messageHandler = async (event) => {
    const isFinish =
      event.data === 'finish-activity' ||
      (event.data && typeof event.data === 'object' && event.data.type === 'finish-activity')
    if (!isFinish) return

    try {
      const sa = await import('./studentActivity.js')
      await sa.persistLocalWorkbenchToFirebase()
      await new Promise((r) => setTimeout(r, 400))
      await sa.generateFinalPdf()

      closeModal()
      window.removeEventListener('message', messageHandler)

      showCompletionMessage()
    } catch (error) {
      console.error('활동 종료 처리 오류:', error)
      alert('활동을 마무리하는 중 오류가 발생했습니다. 네트워크를 확인 후 다시 시도해 주세요.')
    }
  }
  
  window.addEventListener('message', messageHandler)
}

// 완료 메시지 표시
function showCompletionMessage() {
  const messageHtml = `
    <div id="completion-modal" class="completion-modal">
      <div class="modal-overlay"></div>
      <div class="modal-content completion-modal-content">
        <div class="completion-icon" style="font-size: 4rem; margin-bottom: 20px;">✅</div>
        <h2 style="margin: 0 0 15px 0; font-size: 1.5rem;">활동이 완료되었습니다!</h2>
        <p style="margin: 0 0 30px 0; color: #64748b;">활동 내용이 Firebase에 저장되었고, 최종 보고서 PDF 파일도 저장되었습니다.</p>
        <button id="go-to-main-btn" class="action-btn-primary" style="padding: 12px 24px; font-size: 1rem; border: none; border-radius: 8px; cursor: pointer; background: #2563eb; color: white; font-weight: 600;">
          메인 페이지로 돌아가기
        </button>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', messageHtml)
  
  const modal = document.getElementById('completion-modal')
  const goToMainBtn = document.getElementById('go-to-main-btn')
  const overlay = modal.querySelector('.modal-overlay')
  
  goToMainBtn.addEventListener('click', () => {
    window.location.href = 'index.html'
  })
  
  overlay.addEventListener('click', () => {
    window.location.href = 'index.html'
  })
}

// 과거 활동 불러오기 → localStorage 복원 후 각 단계에서 이어하기
if (resumeActivitiesBtn) {
  resumeActivitiesBtn.addEventListener('click', async () => {
    resumeActivitiesBtn.disabled = true
    const prevLabel = resumeActivitiesBtn.textContent
    resumeActivitiesBtn.textContent = '불러오는 중...'

    try {
      const { restoreRecentActivitiesForContinue } = await import('./studentActivity.js')
      const { hadAny, message } = await restoreRecentActivitiesForContinue()

      if (!hadAny) {
        alert(
          '불러올 저장된 활동이 없습니다.\n명세서 분석·아이디어·그림 등을 진행하면 자동으로 저장되며, 이후 여기서 다시 불러올 수 있어요.'
        )
      } else {
        alert(
          `지난에 저장된 활동을 이 기기에 불러왔습니다.\n\n복원: ${message}\n\n각 단계 버튼을 눌러 화면을 열면 이어서 진행할 수 있습니다. 이미 열린 활동 창은 자동으로 새로고침됩니다.`
        )
        if (activityFrame && !activityFrame.hidden && activityFrame.src) {
          activityFrame.src = activityFrame.src
        }
      }
    } catch (error) {
      console.error('과거 활동 복원 오류:', error)
      alert('과거 활동을 불러오는 중 오류가 발생했습니다.')
    } finally {
      resumeActivitiesBtn.disabled = false
      resumeActivitiesBtn.textContent = prevLabel
    }
  })
}

// 과거 활동 보기
if (viewPastBtn) {
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
}

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
                  drawing: '발명품 표현하기',
                  reflection: '오늘 활동 소감'
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
  } else if (type === 'drawing') {
    const { image } = data || {}
    return image ? '<p>발명품 그림이 저장되어 있습니다.</p>' : '<p>저장된 그림이 없습니다.</p>'
  } else if (type === 'reflection') {
    const { reflection, feedback } = data || {}
    const preview = reflection ? sanitize(reflection.substring(0, 100)) : '소감 내용 없음'
    return `<p>${preview}${reflection && reflection.length > 100 ? '...' : ''}</p>${feedback ? '<p style="color: #64748b; font-size: 0.9em;">피드백 있음</p>' : ''}`
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
  } else if (type === 'drawing') {
    const { image } = data || {}
    detailHtml = `
      <h3>발명품 표현하기</h3>
      <p><strong>작성일:</strong> ${date}</p>
      ${image ? `
        <p><strong>그린 그림:</strong></p>
        <div style="text-align: center; margin-top: 20px;">
          <img src="${image}" alt="발명품 그림" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" />
        </div>
      ` : '<p>저장된 그림이 없습니다.</p>'}
    `
  } else if (type === 'reflection') {
    const { reflection, feedback } = data || {}
    detailHtml = `
      <h3>오늘 활동 소감</h3>
      <p><strong>작성일:</strong> ${date}</p>
      ${reflection ? `
        <div style="margin-bottom: 25px;">
          <p><strong>학생 소감:</strong></p>
          <div style="padding: 15px; background: #f8fafc; border-radius: 8px; white-space: pre-wrap; line-height: 1.8;">${sanitize(reflection)}</div>
        </div>
      ` : '<p>소감 내용이 없습니다.</p>'}
      ${feedback ? `
        <div>
          <p><strong>교사 피드백:</strong></p>
          <div style="padding: 15px; background: #ecfdf5; border-radius: 8px; white-space: pre-wrap; line-height: 1.8;">${sanitize(feedback)}</div>
        </div>
      ` : '<p>피드백이 아직 생성되지 않았습니다.</p>'}
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

// 단계 버튼 → 넓은 활동 영역에 iframe 로드
activityNavBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const src = btn.getAttribute('data-activity-src')
    if (!src || !activityFrame || !activityPlaceholder) return

    activityNavBtns.forEach((b) => b.classList.remove('is-active'))
    btn.classList.add('is-active')

    activityPlaceholder.hidden = true
    activityFrame.hidden = false

    const base = src.split('#')[0]
    const hash = src.includes('#') ? '#' + src.split('#').slice(1).join('#') : ''
    activityFrame.src = `${base}${hash}`
  })
})

