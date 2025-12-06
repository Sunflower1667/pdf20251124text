import './teacher.css'
import { initFirebase } from './firebaseConfig.js'
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'

const app = document.querySelector('#app')
let db = null
let auth = null

// Admin ID 확인 (UID 또는 이메일)
const ADMIN_ID = import.meta.env.VITE_ADMIN_ID || ''
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

// 초기화
async function init() {
  try {
    // Firebase 초기화
    const firebaseResult = initFirebase()
    auth = firebaseResult.auth

    if (!auth) {
      showError('Firebase가 초기화되지 않았습니다.')
      return
    }

    // Firestore 가져오기
    db = getFirestore(firebaseResult.app)

    // 디버깅: 환경 변수 확인
    console.log('=== 관리자 권한 확인 디버깅 ===')
    console.log('VITE_ADMIN_ID:', ADMIN_ID ? '설정됨' : '설정 안 됨')
    console.log('VITE_ADMIN_EMAIL:', ADMIN_EMAIL ? '설정됨' : '설정 안 됨')

    // 인증 상태 확인
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // 로그인되지 않은 경우
        showLoginView()
      } else {
        // 디버깅: 사용자 정보 출력
        console.log('=== 로그인된 사용자 정보 ===')
        console.log('User UID:', user.uid)
        console.log('User Email:', user.email)
        console.log('User Display Name:', user.displayName)

        // Admin 권한 확인
        const isAdmin = await checkAdminPermission(user)
        console.log('관리자 권한 확인 결과:', isAdmin)
        
        if (isAdmin) {
          showMonitoringView(user)
        } else {
          // 간단한 오류 메시지만 표시
          showError('교사용 계정과 일치하지 않습니다.')
        }
      }
    })
  } catch (error) {
    console.error('초기화 오류:', error)
    showError('초기화 중 오류가 발생했습니다: ' + error.message)
  }
}

// Admin 권한 확인 (UID 또는 이메일)
async function checkAdminPermission(user) {
  // UID로 확인
  if (ADMIN_ID && user.uid === ADMIN_ID) {
    console.log('UID로 관리자 확인됨')
    return true
  }

  // 이메일로 확인
  if (ADMIN_EMAIL && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    console.log('이메일로 관리자 확인됨')
    return true
  }

  // 둘 다 설정되지 않은 경우
  if (!ADMIN_ID && !ADMIN_EMAIL) {
    console.warn('VITE_ADMIN_ID 또는 VITE_ADMIN_EMAIL이 설정되지 않았습니다.')
    return false
  }

  return false
}

// 로그인 화면 표시
function showLoginView() {
  app.innerHTML = `
    <div class="teacher-container">
      <div class="teacher-card">
        <header>
          <h1>교사 모니터링</h1>
          <p class="subtitle">학생 활동을 모니터링하려면 로그인이 필요합니다.</p>
        </header>
        <div class="login-section">
          <button id="google-login-btn" class="google-login-btn">
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>구글로 로그인</span>
          </button>
          <div id="error-message" class="error-message" style="display: none;"></div>
        </div>
        <div class="back-section">
          <a href="index.html" class="back-link">← 메인으로 돌아가기</a>
        </div>
      </div>
    </div>
  `

  const googleLoginBtn = document.querySelector('#google-login-btn')
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin)
  }
}

// 구글 로그인 처리
async function handleGoogleLogin() {
  try {
    const googleProvider = new GoogleAuthProvider()
    const currentAuth = auth || getAuth()

    await signInWithPopup(currentAuth, googleProvider)
  } catch (error) {
    console.error('로그인 오류:', error)
    const errorMessage = document.querySelector('#error-message')
    if (errorMessage) {
      errorMessage.textContent = '로그인 중 오류가 발생했습니다.'
      errorMessage.style.display = 'block'
    }
  }
}

// 모니터링 화면 표시
function showMonitoringView(user) {
  app.innerHTML = `
    <div class="teacher-container">
      <div class="teacher-card">
        <header class="monitoring-header">
          <div>
            <h1>교사 모니터링</h1>
            <p class="subtitle">학생들의 활동을 확인하고 관리하세요</p>
            <button id="back-to-main-btn" class="back-btn">← 메인으로 돌아가기</button>
          </div>
          <div class="user-info">
            <div class="user-profile">
              <img src="${user.photoURL || ''}" alt="프로필" class="user-avatar" onerror="this.style.display='none'">
              <span class="user-name">${user.displayName || user.email}</span>
            </div>
            <button id="logout-btn" class="logout-btn">로그아웃</button>
          </div>
        </header>

        <div class="stats-section">
          <div class="stat-card">
            <div class="stat-value" id="total-students">-</div>
            <div class="stat-label">전체 학생</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="total-activities">-</div>
            <div class="stat-label">전체 활동</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="today-activities">-</div>
            <div class="stat-label">오늘 활동</div>
          </div>
        </div>

        <div class="students-section">
          <div class="section-header">
            <h2>학생 목록</h2>
            <button id="refresh-btn" class="refresh-btn">새로고침</button>
          </div>
          <div id="students-list" class="students-list">
            <div class="loading">학생 데이터를 불러오는 중...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 활동 기록 모달 -->
    <div id="activity-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title">활동 기록</h2>
          <button id="close-modal-btn" class="close-btn">×</button>
        </div>
        <div id="modal-body" class="modal-body"></div>
      </div>
    </div>
  `

  // 이벤트 리스너 등록
  const backToMainBtn = document.querySelector('#back-to-main-btn')
  const logoutBtn = document.querySelector('#logout-btn')
  const refreshBtn = document.querySelector('#refresh-btn')
  const closeModalBtn = document.querySelector('#close-modal-btn')
  const modal = document.querySelector('#activity-modal')

  if (backToMainBtn) {
    backToMainBtn.addEventListener('click', () => {
      window.location.href = 'index.html'
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth)
        window.location.href = 'index.html'
      } catch (error) {
        console.error('로그아웃 오류:', error)
      }
    })
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadStudents()
    })
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      modal.style.display = 'none'
    })
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none'
      }
    })
  }

  // 학생 데이터 로드
  loadStudents()
}

// 학생 목록 로드
async function loadStudents() {
  if (!db) {
    showError('Firestore가 초기화되지 않았습니다.')
    return
  }

  const studentsList = document.querySelector('#students-list')
  if (studentsList) {
    studentsList.innerHTML = '<div class="loading">학생 데이터를 불러오는 중...</div>'
  }

  try {
    // students 컬렉션에서 모든 문서 가져오기
    const studentsRef = collection(db, 'students')
    const studentsSnapshot = await getDocs(studentsRef)

    if (studentsSnapshot.empty) {
      if (studentsList) {
        studentsList.innerHTML = '<div class="empty-state">등록된 학생이 없습니다.</div>'
      }
      updateStats(0, 0, 0)
      return
    }

    const students = []
    let totalActivities = 0
    let todayActivities = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 각 학생의 활동 데이터 가져오기
    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data()
      const studentId = studentDoc.id

      // 활동 데이터 가져오기
      const activitiesRef = collection(db, 'students', studentId, 'activities')
      const activitiesSnapshot = await getDocs(query(activitiesRef, orderBy('timestamp', 'desc')))

      const activities = []
      activitiesSnapshot.forEach((activityDoc) => {
        const activityData = activityDoc.data()
        activities.push({
          id: activityDoc.id,
          ...activityData,
        })

        totalActivities++

        // 오늘 활동 확인
        if (activityData.timestamp) {
          const activityDate = activityData.timestamp.toDate()
          activityDate.setHours(0, 0, 0, 0)
          if (activityDate.getTime() === today.getTime()) {
            todayActivities++
          }
        }
      })

      students.push({
        id: studentId,
        name: studentData.name || studentData.email || '이름 없음',
        email: studentData.email || '',
        activities: activities,
        activityCount: activities.length,
      })
    }

    // 활동 수로 정렬
    students.sort((a, b) => b.activityCount - a.activityCount)

    // 통계 업데이트
    updateStats(students.length, totalActivities, todayActivities)

    // 학생 목록 렌더링
    renderStudentsList(students)
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error)
    if (studentsList) {
      studentsList.innerHTML = '<div class="error-state">학생 데이터를 불러오는 중 오류가 발생했습니다.</div>'
    }
  }
}

// 통계 업데이트
function updateStats(totalStudents, totalActivities, todayActivities) {
  const totalStudentsEl = document.querySelector('#total-students')
  const totalActivitiesEl = document.querySelector('#total-activities')
  const todayActivitiesEl = document.querySelector('#today-activities')

  if (totalStudentsEl) totalStudentsEl.textContent = totalStudents
  if (totalActivitiesEl) totalActivitiesEl.textContent = totalActivities
  if (todayActivitiesEl) todayActivitiesEl.textContent = todayActivities
}

// 학생 목록 렌더링
function renderStudentsList(students) {
  const studentsList = document.querySelector('#students-list')
  if (!studentsList) return

  if (students.length === 0) {
    studentsList.innerHTML = '<div class="empty-state">등록된 학생이 없습니다.</div>'
    return
  }

  studentsList.innerHTML = students
    .map(
      (student) => `
    <div class="student-card" data-student-id="${student.id}">
      <div class="student-info">
        <div class="student-avatar">${student.name.charAt(0)}</div>
        <div class="student-details">
          <h3 class="student-name">${sanitize(student.name)}</h3>
          <p class="student-email">${sanitize(student.email)}</p>
        </div>
      </div>
      <div class="student-stats">
        <div class="activity-count">활동 ${student.activityCount}개</div>
      </div>
      <button class="view-activities-btn" data-student-id="${student.id}">활동 보기</button>
    </div>
  `
    )
    .join('')

  // 활동 보기 버튼 이벤트
  document.querySelectorAll('.view-activities-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const studentId = e.target.dataset.studentId
      const student = students.find((s) => s.id === studentId)
      if (student) {
        showActivityModal(student)
      }
    })
  })

}

// 활동 기록 모달 표시
function showActivityModal(student) {
  const modal = document.querySelector('#activity-modal')
  const modalTitle = document.querySelector('#modal-title')
  const modalBody = document.querySelector('#modal-body')

  if (!modal || !modalTitle || !modalBody) return

  modalTitle.textContent = `${sanitize(student.name)}의 활동 기록`
  modal.style.display = 'flex'

  if (student.activities.length === 0) {
    modalBody.innerHTML = '<div class="empty-state">활동 기록이 없습니다.</div>'
    return
  }

  // 활동 필터링: 중복 제거 및 피드백 우선 표시
  const filteredActivities = filterActivities(student.activities)

  // 활동 목록을 미리보기로 표시
  modalBody.innerHTML = filteredActivities
    .map((activity, index) => {
      const date = activity.timestamp
        ? activity.timestamp.toDate().toLocaleString('ko-KR')
        : '날짜 없음'

      const preview = getActivityPreview(activity)

      return `
        <div class="activity-item" style="margin-bottom: 20px; padding: 20px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div class="activity-header" style="margin-bottom: 10px; padding: 10px; background: #2563eb; border-radius: 6px;">
            <span class="activity-type" style="font-weight: bold; font-size: 1.1rem; color: #ffffff;">${getActivityTypeLabel(activity.type)}</span>
          </div>
          <div class="activity-date" style="color: #64748b; font-size: 0.9rem; margin-bottom: 15px; padding-left: 5px;">${date}</div>
          <div class="activity-preview" style="line-height: 1.8; margin-bottom: 15px;">
            ${preview}
          </div>
          <button class="view-detail-btn" data-activity-index="${index}" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500;">
            상세 보기
          </button>
        </div>
      `
    })
    .join('')

  // 상세 보기 버튼 이벤트 리스너 (필터링된 활동 배열 사용)
  const viewDetailBtns = modalBody.querySelectorAll('.view-detail-btn')
  viewDetailBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.activityIndex)
      const activity = filteredActivities[index]
      if (activity) {
        showActivityDetailModal(activity)
      }
    })
  })
}

// 활동 필터링: reflection만 피드백이 있는 것만 표시, 나머지는 모두 표시
function filterActivities(activities) {
  // reflection의 경우: 피드백이 있는 것만 표시 (중복 제거)
  // 다른 타입은 모두 표시
  
  const reflectionMap = new Map() // reflection의 경우 같은 내용인지 확인하기 위한 맵
  
  const filtered = []
  
  // 먼저 reflection이 아닌 활동들은 모두 추가
  activities.forEach(activity => {
    if (activity.type !== 'reflection') {
      filtered.push(activity)
    }
  })
  
  // reflection의 경우: 피드백이 있는 것만 추가 (같은 reflection 내용이면 피드백 있는 것만)
  activities.forEach(activity => {
    if (activity.type === 'reflection') {
      const reflection = activity.data?.reflection || ''
      const hasFeedback = !!activity.data?.feedback
      
      if (hasFeedback) {
        // 피드백이 있는 경우: 기존에 같은 reflection이 있으면 교체, 없으면 추가
        reflectionMap.set(reflection, activity)
      } else {
        // 피드백이 없는 경우: 같은 reflection이 이미 피드백 있는 것으로 추가되었으면 건너뛰기
        if (!reflectionMap.has(reflection)) {
          reflectionMap.set(reflection, activity)
        }
      }
    }
  })
  
  // reflection 맵의 값들을 추가
  reflectionMap.forEach(activity => {
    filtered.push(activity)
  })
  
  // 최종적으로 타임스탬프로 정렬 (최신순)
  filtered.sort((a, b) => {
    const timeA = a.timestamp?.toDate?.() || new Date(0)
    const timeB = b.timestamp?.toDate?.() || new Date(0)
    return timeB - timeA
  })
  
  return filtered
}

// 활동 타입 레이블
function getActivityTypeLabel(type) {
  const labels = {
    analysis: '명세서 분석',
    idea: '아이디어 창출',
    drawing: '발명품 표현하기',
    reflection: '오늘 활동 소감',
  }
  return labels[type] || type
}

// 활동 미리보기 생성
function getActivityPreview(activity) {
  const { type, data } = activity
  
  if (type === 'analysis') {
    const { patentName } = data || {}
    return `<p>${sanitize(patentName || '명세서 분석 결과')}</p>`
  } else if (type === 'idea') {
    const { selectedIdea, name, description } = data || {}
    const ideaName = selectedIdea?.name || name || '아이디어'
    const ideaDesc = selectedIdea?.description || description || ''
    return `<p><strong>${sanitize(ideaName)}</strong><br>${sanitize(ideaDesc.substring(0, 100))}${ideaDesc.length > 100 ? '...' : ''}</p>`
  } else if (type === 'drawing') {
    const { image } = data || {}
    return image ? '<p>발명품 그림이 저장되어 있습니다.</p>' : '<p>저장된 그림이 없습니다.</p>'
  } else if (type === 'reflection') {
    const { reflection, feedback } = data || {}
    const preview = reflection ? sanitize(reflection.substring(0, 100)) : '소감 내용 없음'
    return `<p>${preview}${reflection && reflection.length > 100 ? '...' : ''}</p>${feedback ? '<p style="color: #64748b; font-size: 0.9em; margin-top: 8px;">피드백 있음</p>' : ''}`
  }
  
  return '<p>활동 내용</p>'
}

// 활동 상세 보기 모달 표시
function showActivityDetailModal(activity) {
  const { type, data, timestamp } = activity
  const date = timestamp
    ? timestamp.toDate().toLocaleString('ko-KR')
    : '날짜 없음'
  
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
    const { keywords, generatedIdeas, selectedIdea, chatHistory, refinedIdea } = data || {}
    detailHtml = `
      <h3>아이디어 창출</h3>
      <p><strong>작성일:</strong> ${date}</p>
      ${keywords ? `<p><strong>사용한 키워드:</strong> ${sanitize(Array.isArray(keywords) ? keywords.join(', ') : keywords)}</p>` : ''}
      ${generatedIdeas && Array.isArray(generatedIdeas) && generatedIdeas.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <p><strong>생성된 아이디어:</strong></p>
          <ul>
            ${generatedIdeas.map((idea) => `<li><strong>${sanitize(idea.name || '아이디어')}:</strong> ${sanitize(idea.description || '')}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${selectedIdea ? `
        <div style="margin-bottom: 20px;">
          <p><strong>선택한 아이디어:</strong> ${sanitize(selectedIdea.name || '정보 없음')}</p>
          <p style="white-space: pre-wrap;">${sanitize(selectedIdea.description || '정보 없음')}</p>
        </div>
      ` : ''}
      ${chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 ? `
        <p><strong>대화 내용:</strong></p>
        <div style="max-height: 300px; overflow-y: auto; padding: 10px; background: #f8fafc; border-radius: 8px;">
          ${chatHistory.map(msg => {
            const role = msg.role === 'user' ? '학생' : '도우미'
            return `<p><strong>${role}:</strong> ${sanitize(msg.content || '')}</p>`
          }).join('')}
        </div>
      ` : ''}
      ${refinedIdea ? `
        <div style="margin-top: 20px;">
          <p><strong>구체화된 아이디어:</strong></p>
          ${typeof refinedIdea === 'string' 
            ? `<p style="white-space: pre-wrap;">${sanitize(refinedIdea)}</p>`
            : `
              <div style="padding: 15px; background: #f0fdf4; border-radius: 8px;">
                ${refinedIdea.description ? `<p><strong>아이디어 설명:</strong> ${sanitize(refinedIdea.description)}</p>` : ''}
                ${refinedIdea.features ? `<p><strong>특징:</strong> ${Array.isArray(refinedIdea.features) ? refinedIdea.features.map(f => sanitize(f)).join(', ') : sanitize(refinedIdea.features)}</p>` : ''}
                ${refinedIdea.materials ? `<p><strong>준비물:</strong> ${Array.isArray(refinedIdea.materials) ? refinedIdea.materials.map(m => sanitize(m)).join(', ') : sanitize(refinedIdea.materials)}</p>` : ''}
                ${refinedIdea.tools ? `<p><strong>필요한 도구:</strong> ${Array.isArray(refinedIdea.tools) ? refinedIdea.tools.map(t => sanitize(t)).join(', ') : sanitize(refinedIdea.tools)}</p>` : ''}
                ${refinedIdea.manufacturing ? `<p><strong>제작방법:</strong> ${sanitize(refinedIdea.manufacturing)}</p>` : ''}
                ${refinedIdea.notes ? `<p><strong>유의사항:</strong> ${sanitize(refinedIdea.notes)}</p>` : ''}
              </div>
            `}
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
  } else {
    detailHtml = `
      <h3>기타 활동</h3>
      <pre>${sanitize(JSON.stringify(data, null, 2))}</pre>
    `
  }
  
  // 상세 보기 모달 생성
  const detailModalHtml = `
    <div id="activity-detail-modal" class="activity-detail-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
      <div class="modal-content" style="background: white; border-radius: 12px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #e2e8f0;">
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: bold;">활동 상세 내용</h2>
          <button id="detail-modal-close-btn" class="close-btn" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #64748b; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div class="modal-body" style="padding: 20px; line-height: 1.8;">
          ${detailHtml}
        </div>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', detailModalHtml)
  
  const detailModal = document.getElementById('activity-detail-modal')
  const detailCloseBtn = document.getElementById('detail-modal-close-btn')
  const detailOverlay = detailModal
  
  const closeDetailModal = () => {
    if (detailModal && detailModal.parentNode) {
      detailModal.parentNode.removeChild(detailModal)
    }
  }
  
  if (detailCloseBtn) {
    detailCloseBtn.addEventListener('click', closeDetailModal)
  }
  
  if (detailOverlay) {
    detailOverlay.addEventListener('click', (e) => {
      if (e.target === detailOverlay) {
        closeDetailModal()
      }
    })
  }
  
  // ESC 키로 닫기
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeDetailModal()
      document.removeEventListener('keydown', handleEsc)
    }
  }
  document.addEventListener('keydown', handleEsc)
}

// 에러 표시
function showError(message) {
  app.innerHTML = `
    <div class="teacher-container">
      <div class="teacher-card">
        <div class="error-state">
          <h2>접근 불가</h2>
          <p style="font-size: 1.1rem; margin: 20px 0;">${sanitize(message)}</p>
          <a href="index.html" class="back-link" style="margin-top: 20px; display: inline-block;">← 메인으로 돌아가기</a>
        </div>
      </div>
    </div>
  `
}

// 상세 오류 표시
function showErrorWithDetails(message, details = []) {
  app.innerHTML = `
    <div class="teacher-container">
      <div class="teacher-card">
        <div class="error-state">
          <h2>오류</h2>
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">${sanitize(message)}</p>
          ${details.length > 0 ? `
            <div class="error-details" style="margin: 20px 0; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
              <h3 style="margin: 0 0 12px; font-size: 1rem; color: #b91c1c;">상세 정보:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #991b1b;">
                ${details.map(detail => `<li style="margin: 8px 0;">${sanitize(detail)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <div class="debug-info" style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 0.9rem; color: #64748b;">
            <p><strong>해결 방법:</strong></p>
            <ol style="margin: 8px 0; padding-left: 20px;">
              <li>프로젝트 루트의 <code>.env</code> 파일을 확인하세요.</li>
              <li><code>VITE_ADMIN_ID</code> 또는 <code>VITE_ADMIN_EMAIL</code>을 설정하세요.</li>
              <li>Firebase 콘솔에서 사용자 UID를 확인하거나 이메일을 사용하세요.</li>
              <li>환경 변수 변경 후 개발 서버를 재시작하세요.</li>
            </ol>
            <p style="margin-top: 12px;"><strong>예시 (.env 파일):</strong></p>
            <pre style="margin: 8px 0; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.85rem; overflow-x: auto;">VITE_ADMIN_ID=your-firebase-user-uid
# 또는
VITE_ADMIN_EMAIL=admin@example.com</pre>
          </div>
          <a href="index.html" class="back-link" style="margin-top: 20px; display: inline-block;">← 메인으로 돌아가기</a>
        </div>
      </div>
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

// 초기화 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}


