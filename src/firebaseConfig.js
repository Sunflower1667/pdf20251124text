// Firebase 설정 — 모든 공개 키는 VITE_ 환경 변수 사용
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const envVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseConfig = {
  apiKey: envVars.apiKey || '',
  authDomain: envVars.authDomain || '',
  projectId: envVars.projectId || '',
  storageBucket: (envVars.storageBucket || '').trim(),
  messagingSenderId: envVars.messagingSenderId || '',
  appId: envVars.appId || '',
}

let app = null
let auth = null
let db = null
let storage = null
let googleProvider = null
let firebaseInitialized = false

function attachServices(firebaseApp) {
  auth = getAuth(firebaseApp)
  db = getFirestore(firebaseApp)
  googleProvider = new GoogleAuthProvider()

  if (!firebaseConfig.storageBucket) {
    storage = null
    console.warn(
      '[Firebase] VITE_FIREBASE_STORAGE_BUCKET이 비어 있습니다. Firebase Console → 프로젝트 설정 → 일반 에서 bucket(예: your-project-id.appspot.com)을 확인하고 .env에 넣어 주세요.'
    )
    return
  }

  try {
    storage = getStorage(firebaseApp)
  } catch (e) {
    console.error('[Firebase] Storage 초기화 실패:', e)
    storage = null
  }
}

function initFirebase() {
  if (typeof initializeApp === 'undefined' || typeof getApps === 'undefined') {
    console.error('Firebase 모듈을 로드할 수 없습니다. npm install firebase 를 확인하세요.')
    return { app: null, auth: null, db: null, storage: null, googleProvider: null, error: 'MODULE_NOT_LOADED' }
  }

  if (firebaseInitialized && app) {
    return { app, auth, db, storage, googleProvider }
  }

  try {
    const existingApps = getApps()

    if (existingApps.length > 0) {
      app = existingApps[0]
      attachServices(app)
      firebaseInitialized = true
      return { app, auth, db, storage, googleProvider }
    }

    const hasConfig =
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId

    if (!hasConfig) {
      const missingFields = []
      if (!firebaseConfig.apiKey) missingFields.push('VITE_FIREBASE_API_KEY')
      if (!firebaseConfig.authDomain) missingFields.push('VITE_FIREBASE_AUTH_DOMAIN')
      if (!firebaseConfig.projectId) missingFields.push('VITE_FIREBASE_PROJECT_ID')
      if (!firebaseConfig.appId) missingFields.push('VITE_FIREBASE_APP_ID')

      console.error('Firebase 설정이 불완전합니다. 누락:', missingFields.join(', '))
      console.error(
        'Storage까지 쓰려면 VITE_FIREBASE_STORAGE_BUCKET도 필수입니다. (Console → Storage에서 gs://… 또는 xxx.appspot.com 형식)'
      )
      return { app: null, auth: null, db: null, storage: null, googleProvider: null, error: 'CONFIG_INCOMPLETE', missingFields }
    }

    app = initializeApp(firebaseConfig)
    attachServices(app)
    firebaseInitialized = true
    return { app, auth, db, storage, googleProvider }
  } catch (error) {
    console.error('Firebase 초기화 오류:', error)
    return { app: null, auth: null, db: null, storage: null, googleProvider: null, error: 'INIT_FAILED' }
  }
}

export { app, auth, db, storage, googleProvider, initFirebase }

// 개발 시 환경 변수 점검 (민감 값 전체는 출력하지 않음)
if (import.meta.env.DEV) {
  console.log('[Firebase] MODE:', import.meta.env.MODE)
  console.log('[Firebase] storageBucket:', firebaseConfig.storageBucket ? '설정됨' : '없음 — Storage API 사용 시 bucket 오류가 납니다')
}

if (!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) {
  console.warn('[Firebase] VITE_FIREBASE_STORAGE_BUCKET 미설정. 파일 업로드/Storage 전용 기능이 동작하지 않을 수 있습니다.')
}
