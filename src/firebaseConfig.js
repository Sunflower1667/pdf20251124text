// Firebase 설정 - 환경변수에서 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// Firebase 정적 import
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

// Firebase 초기화
let app = null
let auth = null
let googleProvider = null
let firebaseInitialized = false

// Firebase 초기화 함수
function initFirebase() {
  // Firebase 모듈이 로드되었는지 확인
  if (typeof initializeApp === 'undefined' || typeof getApps === 'undefined') {
    console.error('Firebase 모듈을 로드할 수 없습니다. Firebase가 설치되어 있는지 확인하세요.')
    console.error('터미널에서 다음 명령어를 실행하세요: npm install firebase')
    return { app: null, auth: null, googleProvider: null, error: 'MODULE_NOT_LOADED' }
  }

  if (firebaseInitialized && app) {
    return { app, auth, googleProvider }
  }

  try {
    // Firebase가 이미 초기화되어 있는지 확인
    const existingApps = getApps()

    if (existingApps.length > 0) {
      // 이미 초기화된 앱이 있으면 사용
      app = existingApps[0]
      auth = getAuth(app)
      googleProvider = new GoogleAuthProvider()
      firebaseInitialized = true
    } else {
      // Firebase 설정값이 모두 있는지 확인
      const hasConfig = firebaseConfig.apiKey && 
                        firebaseConfig.authDomain && 
                        firebaseConfig.projectId && 
                        firebaseConfig.appId

      if (hasConfig) {
        try {
          app = initializeApp(firebaseConfig)
          auth = getAuth(app)
          googleProvider = new GoogleAuthProvider()
          firebaseInitialized = true
        } catch (error) {
          console.error('Firebase initialization error:', error)
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
          })
          return { app: null, auth: null, googleProvider: null, error: 'INIT_FAILED' }
        }
      } else {
        console.warn('Firebase configuration is incomplete. Please check your .env file.')
        console.warn('Missing config:', {
          apiKey: !firebaseConfig.apiKey,
          authDomain: !firebaseConfig.authDomain,
          projectId: !firebaseConfig.projectId,
          appId: !firebaseConfig.appId
        })
        console.warn('Current config values (first 10 chars):', {
          apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + '...' : 'empty',
          authDomain: firebaseConfig.authDomain || 'empty',
          projectId: firebaseConfig.projectId || 'empty',
          appId: firebaseConfig.appId || 'empty'
        })
        return { app: null, auth: null, googleProvider: null, error: 'CONFIG_INCOMPLETE' }
      }
    }

    return { app, auth, googleProvider }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    })
    return { app: null, auth: null, googleProvider: null, error: 'UNKNOWN_ERROR' }
  }
}

// Firebase 인스턴스 export (동적 로드된 값)
export { app, auth, googleProvider, initFirebase }

