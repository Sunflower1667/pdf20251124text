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
    return
  }

  try {
    const raw = firebaseConfig.storageBucket.replace(/^gs:\/\//, '')
    const bucketGs = `gs://${raw}`
    storage = getStorage(firebaseApp, bucketGs)
  } catch (e) {
    console.warn('[Firebase] getStorage(gs://…) 실패, 기본 버킷으로 재시도:', e)
    try {
      storage = getStorage(firebaseApp)
    } catch (e2) {
      console.error('[Firebase] Storage 초기화 실패:', e2)
      storage = null
    }
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

/* Vite는 빌드할 때만 import.meta.env.VITE_* 를 코드에 박습니다. .env만 고치고 재시작/재빌드·재배포를 안 하면 예전(빈 값) 번들이 그대로입니다. */
if (!firebaseConfig.storageBucket) {
  console.warn(
    '[Firebase] Storage bucket이 이 빌드에 포함되어 있지 않습니다.\n' +
      '· 로컬: 프로젝트 루트 `.env`에 `VITE_FIREBASE_STORAGE_BUCKET`을 넣은 뒤 **`npm run dev`를 완전히 끄고 다시 실행**, 또는 **`npm run build` 후 `dist`를 다시 사용**하세요.\n' +
      '· Netlify/Vercel 등: 사이트 설정의 **Environment variables**에 같은 이름으로 값을 넣고 **재배포**하세요(저장소에 없는 `.env`는 배포 빌드에 자동으로 안 올라갑니다).\n' +
      '· 값: Firebase Console → 프로젝트 설정 → 일반 → `storageBucket` (예: `프로젝트ID.appspot.com` 또는 `프로젝트ID.firebasestorage.app`).'
  )
}
