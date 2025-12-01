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
          // 초기화 실패 시 null 유지
          return { app: null, auth: null, googleProvider: null }
        }
      } else {
        console.warn('Firebase configuration is incomplete. Please check your .env file.')
        console.warn('Missing config:', {
          apiKey: !firebaseConfig.apiKey,
          authDomain: !firebaseConfig.authDomain,
          projectId: !firebaseConfig.projectId,
          appId: !firebaseConfig.appId
        })
        return { app: null, auth: null, googleProvider: null }
      }
    }

    return { app, auth, googleProvider }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
    return { app: null, auth: null, googleProvider: null }
  }
}

// Firebase 인스턴스 export (동적 로드된 값)
export { app, auth, googleProvider, initFirebase }

