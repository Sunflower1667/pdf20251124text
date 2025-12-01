import './login.css'
import { initFirebase } from './firebaseConfig.js'
import { signInWithPopup } from 'firebase/auth'

// Firebase 관련 변수들
let auth = null
let googleProvider = null

const appEl = document.querySelector('#app')

// URL에서 역할 확인
const urlParams = new URLSearchParams(window.location.search)
const role = urlParams.get('role') || localStorage.getItem('userRole') || 'student'
const roleName = role === 'teacher' ? '교사' : '학생'

appEl.innerHTML = `
  <div class="login-container">
    <div class="login-card">
      <header>
        <h1>${roleName} 로그인</h1>
        <p class="subtitle">구글 계정으로 로그인하세요</p>
      </header>

      <div id="error-message" class="error-message" style="display: none;"></div>

      <button id="google-login-btn" class="google-login-btn">
        <svg class="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>구글로 로그인</span>
      </button>

      <div class="back-link">
        <a href="index.html">← 메인 페이지로 돌아가기</a>
      </div>
    </div>
  </div>
`

const googleLoginBtn = document.querySelector('#google-login-btn')
const errorMessage = document.querySelector('#error-message')

// Firebase 로드 함수
async function loadFirebase() {
  try {
    const firebaseResult = initFirebase()
    auth = firebaseResult.auth
    googleProvider = firebaseResult.googleProvider

    if (auth && googleProvider) {
      return true
    }
    return false
  } catch (error) {
    console.error('Firebase loading error:', error)
    return false
  }
}

// 초기 Firebase 로드
loadFirebase().catch(err => {
  console.error('Failed to load Firebase on page load:', err)
  if (errorMessage) {
    showError('Firebase가 설치되지 않았습니다. 터미널에서 "npm install firebase" 명령어를 실행해주세요.')
  }
})

googleLoginBtn.addEventListener('click', async () => {
  // Firebase가 아직 로드되지 않았으면 다시 시도
  if (!auth || !googleProvider || !signInWithPopup) {
    const loaded = await loadFirebase()
    if (!loaded) {
      showError('Firebase가 설치되지 않았습니다. 터미널에서 "npm install firebase" 명령어를 실행해주세요.')
      return
    }
  }

  try {
    googleLoginBtn.disabled = true
    googleLoginBtn.innerHTML = `
      <div class="spinner"></div>
      <span>로그인 중...</span>
    `
    hideError()

    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // 사용자 정보 저장
    localStorage.setItem('userRole', role)
    localStorage.setItem('userId', user.uid)
    localStorage.setItem('userEmail', user.email)
    localStorage.setItem('userName', user.displayName || user.email)
    localStorage.setItem('userPhoto', user.photoURL || '')

    // 역할에 따라 페이지 이동
    if (role === 'teacher') {
      window.location.href = 'teacher.html' // 교사 모니터링 페이지 (추후 생성)
    } else {
      window.location.href = 'student1.html' // 학생 활동 페이지
    }
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
    
    showError(errorMsg)
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
})

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message
    errorMessage.style.display = 'block'
  }
}

function hideError() {
  if (errorMessage) {
    errorMessage.style.display = 'none'
  }
}
