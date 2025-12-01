import './main.css'
import { initFirebase } from './firebaseConfig.js'

// Firebase 관련 변수들
let auth = null
let googleProvider = null
let signInWithPopup = null
let onAuthStateChanged = null
let signOut = null

// DOM이 로드된 후 실행
let appEl = null

// 로그인 전 UI
const renderLoginView = () => {
  if (!appEl) {
    console.error('App element is not available')
    return
  }
  
  appEl.innerHTML = `
    <div class="main-container">
      <div class="main-card">
        <header>
          <h1>발명 아이디어 창출 시스템</h1>
          <p class="subtitle">명세서 분석부터 아이디어 창출까지</p>
        </header>

        <div class="login-section">
          <p class="login-prompt">서비스를 이용하시려면 구글 계정으로 로그인해주세요</p>
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
      </div>
    </div>
  `

  const googleLoginBtn = document.querySelector('#google-login-btn')
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin)
  }
}

// 로그인 후 UI
const renderMainView = (user) => {
  if (!appEl) {
    console.error('App element is not available')
    return
  }
  
  appEl.innerHTML = `
    <div class="main-container">
      <div class="main-card">
        <header>
          <h1>발명 아이디어 창출 시스템</h1>
          <p class="subtitle">명세서 분석부터 아이디어 창출까지</p>
        </header>

        <div class="user-info">
          <div class="user-profile">
            <img src="${user.photoURL || ''}" alt="프로필" class="user-avatar" onerror="this.style.display='none'">
            <div class="user-details">
              <p class="user-name">${user.displayName || user.email}</p>
              <p class="user-email">${user.email}</p>
            </div>
          </div>
          <button id="logout-btn" class="logout-btn">로그아웃</button>
        </div>

        <div class="action-buttons">
          <button id="student-btn" class="action-btn student-btn">
            <div class="btn-icon">👨‍🎓</div>
            <div class="btn-content">
              <h2>학생활동</h2>
              <p>학생용 활동 페이지로 이동</p>
            </div>
          </button>

          <button id="teacher-btn" class="action-btn teacher-btn">
            <div class="btn-icon">👩‍🏫</div>
            <div class="btn-content">
              <h2>교사 모니터링</h2>
              <p>교사용 모니터링 페이지로 이동</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  `

  const studentBtn = document.querySelector('#student-btn')
  const teacherBtn = document.querySelector('#teacher-btn')
  const logoutBtn = document.querySelector('#logout-btn')

  if (studentBtn) {
    studentBtn.addEventListener('click', () => {
      localStorage.setItem('userRole', 'student')
      window.location.href = 'student.html'
    })
  }

  if (teacherBtn) {
    teacherBtn.addEventListener('click', () => {
      localStorage.setItem('userRole', 'teacher')
      window.location.href = 'teacher.html'
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (auth && signOut) {
          await signOut(auth)
        }
        localStorage.clear()
        // 로그아웃 후 로그인 화면으로 이동
        renderLoginView()
      } catch (error) {
        console.error('Logout error:', error)
        localStorage.clear()
        renderLoginView()
      }
    })
  }
}

// 구글 로그인 처리
const handleGoogleLogin = async () => {
  if (!auth || !googleProvider || !signInWithPopup) {
    // Firebase가 아직 로드되지 않았으면 다시 시도
    const loaded = await loadFirebase()
    if (!loaded) {
      const errorMessage = document.querySelector('#error-message')
      if (errorMessage) {
        showError(errorMessage, 'Firebase가 설치되지 않았습니다. 터미널에서 "npm install firebase" 명령어를 실행해주세요.')
      }
      return
    }
  }

  const googleLoginBtn = document.querySelector('#google-login-btn')
  const errorMessage = document.querySelector('#error-message')

  if (!googleLoginBtn) return

  try {
    googleLoginBtn.disabled = true
    googleLoginBtn.innerHTML = `
      <div class="spinner"></div>
      <span>로그인 중...</span>
    `
    if (errorMessage) {
      hideError(errorMessage)
    }

    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // 사용자 정보 저장
    localStorage.setItem('userId', user.uid)
    localStorage.setItem('userEmail', user.email)
    localStorage.setItem('userName', user.displayName || user.email)
    localStorage.setItem('userPhoto', user.photoURL || '')
  } catch (error) {
    console.error('Google login error:', error)

    let errorMsg = '로그인 중 오류가 발생했습니다.'
    if (error.code === 'auth/popup-closed-by-user') {
      errorMsg = '로그인 창이 닫혔습니다. 다시 시도해주세요.'
    } else if (error.code === 'auth/popup-blocked') {
      errorMsg = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.'
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMsg = '허가되지 않은 도메인입니다. Firebase 설정을 확인해주세요.'
    }

    if (errorMessage) {
      showError(errorMessage, errorMsg)
    }
    if (googleLoginBtn) {
      googleLoginBtn.disabled = false
      googleLoginBtn.innerHTML = `
        <svg class="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>구글로 로그인</span>
      `
    }
  }
}

// 에러 메시지 표시
const showError = (errorEl, message) => {
  if (errorEl) {
    errorEl.textContent = message
    errorEl.style.display = 'block'
  }
}

// 에러 메시지 숨김
const hideError = (errorEl) => {
  if (errorEl) {
    errorEl.style.display = 'none'
  }
}

// 인증 상태 초기화
function initializeAuth() {
  // 인증 상태 변화 감지 및 초기 로드
  if (auth && onAuthStateChanged) {
    // Firebase가 정상적으로 초기화된 경우
    onAuthStateChanged(auth, (user) => {
      if (user) {
        renderMainView(user)
      } else {
        renderLoginView()
      }
    }, (error) => {
      console.error('Auth state changed error:', error)
      renderLoginView()
      setTimeout(() => {
        const errorMessage = document.querySelector('#error-message')
        if (errorMessage) {
          showError(errorMessage, '인증 상태 확인 중 오류가 발생했습니다.')
        }
      }, 100)
    })
  } else {
    // Firebase가 초기화되지 않았을 때 로그인 화면 표시
    console.warn('Firebase is not initialized. Showing login view with error message.')
    renderLoginView()
    // DOM이 렌더링된 후에 에러 메시지 표시
    setTimeout(() => {
      const errorMessage = document.querySelector('#error-message')
      if (errorMessage) {
        showError(errorMessage, 'Firebase가 설정되지 않았습니다. .env 파일을 확인해주세요.')
      }
    }, 100)
  }
}

// Firebase 초기화 및 로드
async function loadFirebase() {
  try {
    const firebaseResult = await initFirebase()
    auth = firebaseResult.auth
    googleProvider = firebaseResult.googleProvider

    if (auth && googleProvider) {
      // Firebase가 로드된 후에만 함수들 import
      const firebaseAuth = await import('firebase/auth')
      signInWithPopup = firebaseAuth.signInWithPopup
      onAuthStateChanged = firebaseAuth.onAuthStateChanged
      signOut = firebaseAuth.signOut
      return true
    }
    return false
  } catch (error) {
    console.error('Firebase loading error:', error)
    return false
  }
}

// DOM이 준비될 때까지 대기
async function init() {
  appEl = document.querySelector('#app')
  
  if (!appEl) {
    console.error('App element not found!')
    return
  }

  // Firebase 로드 시도
  const firebaseReady = await loadFirebase()
  
  if (!firebaseReady) {
    // Firebase가 로드되지 않았을 때 로그인 화면 표시 및 에러 메시지
    renderLoginView()
    setTimeout(() => {
      const errorMessage = document.querySelector('#error-message')
      if (errorMessage) {
        showError(errorMessage, 'Firebase가 설치되지 않았습니다. 터미널에서 "npm install firebase" 명령어를 실행해주세요.')
      }
    }, 100)
    return
  }

  // 초기 렌더링 및 인증 상태 감지
  initializeAuth()
}

// DOM이 준비될 때까지 대기
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
