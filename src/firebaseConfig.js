// Firebase 설정 - 환경변수에서 가져오기
// 주의: 모든 환경 변수는 VITE_ 접두사가 필요합니다!

// 환경 변수 로드 확인
const envVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 디버깅: 모든 환경 변수 확인 (항상 표시)
console.log('=== Firebase 환경 변수 로드 확인 ===')
console.log('import.meta.env 모드:', import.meta.env.MODE)
console.log('import.meta.env.DEV:', import.meta.env.DEV)
console.log('import.meta.env.PROD:', import.meta.env.PROD)
console.log('')
console.log('환경 변수 상태:')
const envKeyMap = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}
Object.keys(envVars).forEach(key => {
  const value = envVars[key]
  const envKey = envKeyMap[key]
  if (key === 'apiKey' || key === 'messagingSenderId' || key === 'appId') {
    console.log(`  ${envKey}:`, value ? `✓ 설정됨 (${value.substring(0, 10)}...)` : '❌ 없음')
  } else {
    console.log(`  ${envKey}:`, value || '❌ 없음')
  }
})
console.log('')

const firebaseConfig = {
  apiKey: envVars.apiKey || '',
  authDomain: envVars.authDomain || '',
  projectId: envVars.projectId || '',
  storageBucket: envVars.storageBucket || '',
  messagingSenderId: envVars.messagingSenderId || '',
  appId: envVars.appId || '',
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
        const missingFields = []
        if (!firebaseConfig.apiKey) missingFields.push('VITE_FIREBASE_API_KEY')
        if (!firebaseConfig.authDomain) missingFields.push('VITE_FIREBASE_AUTH_DOMAIN')
        if (!firebaseConfig.projectId) missingFields.push('VITE_FIREBASE_PROJECT_ID')
        if (!firebaseConfig.appId) missingFields.push('VITE_FIREBASE_APP_ID')
        
        console.error('❌ Firebase configuration is incomplete!')
        console.error('누락된 환경 변수:', missingFields.join(', '))
        console.error('')
        console.error('해결 방법:')
        console.error('1. 로컬 개발: 프로젝트 루트에 .env 파일을 생성하고 다음 변수들을 설정하세요:')
        console.error('   VITE_FIREBASE_API_KEY=your-api-key')
        console.error('   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com')
        console.error('   VITE_FIREBASE_PROJECT_ID=your-project-id')
        console.error('   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com')
        console.error('   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id')
        console.error('   VITE_FIREBASE_APP_ID=your-app-id')
        console.error('')
        console.error('2. Netlify 배포: Netlify 대시보드 → Site settings → Environment variables에서')
        console.error('   위의 모든 VITE_FIREBASE_* 변수들을 설정하고 재배포하세요.')
        console.error('')
        console.error('현재 설정 상태:')
        console.error({
          apiKey: firebaseConfig.apiKey ? '✓ 설정됨' : '✗ 없음',
          authDomain: firebaseConfig.authDomain ? '✓ 설정됨' : '✗ 없음',
          projectId: firebaseConfig.projectId ? '✓ 설정됨' : '✗ 없음',
          storageBucket: firebaseConfig.storageBucket ? '✓ 설정됨' : '✗ 없음',
          messagingSenderId: firebaseConfig.messagingSenderId ? '✓ 설정됨' : '✗ 없음',
          appId: firebaseConfig.appId ? '✓ 설정됨' : '✗ 없음'
        })
        
        return { app: null, auth: null, googleProvider: null, error: 'CONFIG_INCOMPLETE', missingFields }
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

