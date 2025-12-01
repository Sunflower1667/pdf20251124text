// Firebase 설정 - 환경변수에서 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// Firebase 초기화
let app = null
let auth = null
let googleProvider = null
let firebaseLoaded = false

// Firebase 동적 로드 및 초기화
async function initFirebase() {
  if (firebaseLoaded) {
    return { app, auth, googleProvider }
  }

  try {
    // Firebase 모듈 동적 import
    const { initializeApp, getApps } = await import('firebase/app')
    const { getAuth, GoogleAuthProvider } = await import('firebase/auth')

    firebaseLoaded = true

    // Firebase가 이미 초기화되어 있는지 확인
    const existingApps = getApps()

    if (existingApps.length > 0) {
      // 이미 초기화된 앱이 있으면 사용
      app = existingApps[0]
      auth = getAuth(app)
      googleProvider = new GoogleAuthProvider()
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
        } catch (error) {
          console.error('Firebase initialization error:', error)
          // 초기화 실패 시 null 유지
        }
      } else {
        console.warn('Firebase configuration is incomplete. Please check your .env file.')
      }
    }

    return { app, auth, googleProvider }
  } catch (error) {
    console.error('Failed to load Firebase:', error)
    console.error('Please run: npm install firebase')
    firebaseLoaded = false
    return { app: null, auth: null, googleProvider: null }
  }
}

// Firebase 인스턴스 export (동적 로드된 값)
export { app, auth, googleProvider, initFirebase }

