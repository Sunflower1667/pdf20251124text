// 학생 활동을 Firebase Firestore에 저장하고 조회하는 유틸리티 함수
import { initFirebase } from './firebaseConfig.js'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/** Firestore activities 문서 안에 넣는 명세서 추출 텍스트 상한(문서 1MB 제한·다른 필드 여유) */
export const ANALYSIS_EXTRACT_SNAPSHOT_MAX_CHARS = 450_000

/**
 * 학생 활동을 Firebase에 저장
 * @param {string} type - 활동 타입 ('analysis', 'idea', 'reflection')
 * @param {object} data - 활동 데이터
 * @returns {Promise<void>}
 */
export async function saveStudentActivity(type, data) {
  try {
    // Firebase 초기화
    const firebaseResult = initFirebase()

    if (!firebaseResult.app) {
      console.warn('Firebase가 초기화되지 않아 활동을 저장할 수 없습니다.')
      return
    }

    // Firestore 가져오기
    const db = getFirestore(firebaseResult.app)

    // 사용자 정보 가져오기
    const userId = localStorage.getItem('userId')
    const userEmail = localStorage.getItem('userEmail')
    const userName = localStorage.getItem('userName')

    if (!userId) {
      console.warn('사용자 ID가 없어 활동을 저장할 수 없습니다.')
      return
    }

    // 학생 문서 참조
    const studentRef = doc(db, 'students', userId)

    // 학생 정보 업데이트 (없으면 생성)
    await setDoc(
      studentRef,
      {
        email: userEmail || '',
        name: userName || userEmail || '이름 없음',
        lastActivity: serverTimestamp(),
      },
      { merge: true }
    )

    // 활동 데이터 저장
    const activitiesRef = collection(db, 'students', userId, 'activities')
    await addDoc(activitiesRef, {
      type: type,
      data: data,
      timestamp: serverTimestamp(),
    })

    console.log('학생 활동이 저장되었습니다:', type)
  } catch (error) {
    console.error('학생 활동 저장 오류:', error)
    // 저장 실패해도 앱은 계속 작동하도록 에러만 로그
  }
}

/**
 * 최종 활동 보고서 PDF를 Firebase Storage에 저장 (로컬 다운로드와 별개)
 * @param {Blob} pdfBlob
 * @param {string} fileName
 * @returns {Promise<string|null>} 업로드 경로(대략) 또는 Storage 미사용 시 null
 */
export async function saveFinalPdfToStorage(pdfBlob, fileName) {
  const firebaseResult = initFirebase()
  if (!firebaseResult?.app) {
    console.warn('[Storage] Firebase 앱이 없어 PDF 업로드를 건너뜁니다.')
    return null
  }

  let storage = firebaseResult.storage
  if (!storage) {
    const b = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim().replace(/^gs:\/\//, '')
    try {
      storage = b ? getStorage(firebaseResult.app, `gs://${b}`) : getStorage(firebaseResult.app)
    } catch (e) {
      console.warn('[Storage] 초기화 실패, PDF 업로드 건너뜀:', e?.message || e)
      return null
    }
  }

  const userId = localStorage.getItem('userId')
  if (!userId) {
    console.warn('[Storage] userId 없어 PDF 업로드를 건너뜁니다.')
    return null
  }

  const base = String(fileName || 'report.pdf').split(/[/\\]/).pop() || 'report.pdf'
  const safe = base.replace(/[^\w.\-가-힣 ()\[\]]+/g, '_')
  const path = `students/${userId}/finalPdfs/${Date.now()}_${safe}`

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, pdfBlob, { contentType: 'application/pdf' })
  console.log('[Storage] 최종 PDF 업로드 완료:', path)
  return path
}

/**
 * 명세서 원본 PDF 업로드 (분석 활동과 함께 보관)
 * @param {File | Blob} file
 * @param {string} [fileName]
 * @returns {Promise<string|null>} Storage 객체 경로(전체 ref path)
 */
export async function saveSpecPdfToStorage(file, fileName = 'spec.pdf') {
  const firebaseResult = initFirebase()
  if (!firebaseResult?.app) {
    console.warn('[Storage] Firebase 없음, 명세서 PDF 업로드 건너뜀')
    return null
  }

  let storage = firebaseResult.storage
  if (!storage) {
    const b = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim().replace(/^gs:\/\//, '')
    try {
      storage = b ? getStorage(firebaseResult.app, `gs://${b}`) : getStorage(firebaseResult.app)
    } catch (e) {
      console.warn('[Storage] 초기화 실패, 명세서 PDF 건너뜀:', e?.message || e)
      return null
    }
  }

  const userId = localStorage.getItem('userId')
  if (!userId) {
    console.warn('[Storage] userId 없음, 명세서 PDF 업로드 건너뜀')
    return null
  }

  const base = String(fileName || 'spec.pdf').split(/[/\\]/).pop() || 'spec.pdf'
  const safe = base.replace(/[^\w.\-가-힣 ()\[\]]+/g, '_') || 'spec.pdf'
  const path = `students/${userId}/specPdfs/${Date.now()}_${safe}`

  const storageRef = ref(storage, path)
  const body = file instanceof Blob ? file : new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
  await uploadBytes(storageRef, body, { contentType: 'application/pdf' })
  console.log('[Storage] 명세서 PDF 업로드 완료:', path)
  return path
}

/**
 * Storage에 저장된 명세서 PDF 바이너리.
 * getBytes(XHR) 대신 getDownloadURL + fetch 를 써서 일부 환경에서의 CORS 오류를 피합니다.
 * @param {string} fullPath - saveSpecPdfToStorage 반환 경로
 * @returns {Promise<Uint8Array|null>}
 */
export async function downloadSpecPdfFromStorage(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return null

  const firebaseResult = initFirebase()
  if (!firebaseResult?.app) {
    console.warn('[Storage] Firebase 없음, 명세서 다운로드 불가')
    return null
  }

  const auth = getAuth(firebaseResult.app)
  try {
    await auth.authStateReady()
  } catch {
    /* ignore */
  }
  if (!auth.currentUser) {
    console.warn('[Storage] Firebase Auth 사용자 없음 — 명세서 PDF 다운로드에 로그인이 필요합니다.')
    return null
  }

  let storage = firebaseResult.storage
  if (!storage) {
    const b = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim().replace(/^gs:\/\//, '')
    try {
      storage = b ? getStorage(firebaseResult.app, `gs://${b}`) : getStorage(firebaseResult.app)
    } catch (e) {
      console.warn('[Storage] 초기화 실패:', e?.message || e)
      return null
    }
  }

  const storageRef = ref(storage, fullPath)
  try {
    const url = await getDownloadURL(storageRef)
    const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' })
    if (!res.ok) {
      console.warn('[Storage] 명세서 PDF fetch 실패:', res.status, res.statusText)
      return null
    }
    const buf = await res.arrayBuffer()
    return buf.byteLength ? new Uint8Array(buf) : null
  } catch (e) {
    console.warn('[Storage] 명세서 PDF 다운로드 실패:', e?.message || e)
    return null
  }
}

/**
 * 활동 세트(통합 묶음) 한 건이 가질 수 있는 키 목록.
 * 대시보드의 각 활동 카드가 자신의 데이터를 이 키 아래에 두면, 한 번의 저장/로드로 전체가 동기화됩니다.
 */
export const ACTIVITY_SET_KEYS = [
  'seed',
  'analysis',
  'idea',
  'drawing',
  'inventionSpec',
  'reflection',
  'journey',
]

/** Firestore 단일 문서 1MB 제한을 넘기지 않도록 보수적인 상한. */
const ACTIVITY_SET_MAX_BYTES = 900_000

function approximateByteSize(value) {
  try {
    return new Blob([JSON.stringify(value ?? null)]).size
  } catch {
    try {
      return JSON.stringify(value ?? null).length
    } catch {
      return 0
    }
  }
}

/**
 * 한 활동(카드)의 데이터를 Firestore 안전한 형태로 정리합니다.
 * 빈 객체/널은 그대로 null 로 통일해 set 문서가 너무 부풀지 않게 합니다.
 */
function normalizeSetEntry(value) {
  if (value == null) return null
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.length ? value : null
  return Object.keys(value).length ? value : null
}

function buildSafeActivitySet(activitySet) {
  const safe = {}
  let hasAny = false
  for (const key of ACTIVITY_SET_KEYS) {
    const entry = normalizeSetEntry(activitySet?.[key])
    safe[key] = entry
    if (entry != null) hasAny = true
  }
  return { safe, hasAny }
}

/**
 * 학생 활동 카드 데이터 전체를 하나의 객체로 묶어 writeBatch로 저장합니다.
 *
 * 한 번의 batch.commit() 안에서:
 *   1) `students/{userId}` 문서의 lastActivity / 사용자 정보 갱신
 *   2) `students/{userId}/activitySets/{auto}` 에 통합 세트 문서 저장
 *   3) 비어 있지 않은 각 카드 데이터를 `students/{userId}/activities` 에도 동시 기록(과거 타임라인/교사 화면 호환용)
 *
 * @param {Record<string, unknown>} activitySet — 카드별 데이터 묶음
 * @returns {Promise<{ id: string; savedKeys: string[] } | null>} 저장된 세트 문서 정보(저장하지 않은 경우 null)
 */
export async function saveActivitySetWithBatch(activitySet) {
  const firebaseResult = initFirebase()
  if (!firebaseResult.app) {
    console.warn('Firebase가 초기화되지 않아 활동 세트를 저장할 수 없습니다.')
    return null
  }

  const userId = localStorage.getItem('userId')
  if (!userId) {
    console.warn('사용자 ID가 없어 활동 세트를 저장할 수 없습니다.')
    return null
  }

  const { safe, hasAny } = buildSafeActivitySet(activitySet)
  if (!hasAny) {
    console.info('[activitySet] 저장할 활동 데이터가 없어 건너뜁니다.')
    return null
  }

  const totalBytes = approximateByteSize(safe)
  if (totalBytes > ACTIVITY_SET_MAX_BYTES) {
    console.warn(
      `[activitySet] 활동 세트 추정 크기(${totalBytes}B)가 한도(${ACTIVITY_SET_MAX_BYTES}B)를 넘어 ` +
        '큰 항목(주로 그림 data URL)을 자동 축소합니다. 가능한 경우 Storage 업로드를 고려하세요.'
    )
    if (safe.drawing && typeof safe.drawing === 'object') {
      const placeholder = { ...safe.drawing }
      delete placeholder.image
      placeholder.imageOmitted = true
      safe.drawing = placeholder
    }
    if (safe.inventionSpec && typeof safe.inventionSpec === 'object' && safe.inventionSpec.drawingImage) {
      const placeholder = { ...safe.inventionSpec }
      delete placeholder.drawingImage
      placeholder.drawingImageOmitted = true
      safe.inventionSpec = placeholder
    }
  }

  const db = getFirestore(firebaseResult.app)
  const userEmail = localStorage.getItem('userEmail') || ''
  const userName = localStorage.getItem('userName') || ''

  const batch = writeBatch(db)

  const studentRef = doc(db, 'students', userId)
  batch.set(
    studentRef,
    {
      email: userEmail,
      name: userName || userEmail || '이름 없음',
      lastActivity: serverTimestamp(),
    },
    { merge: true }
  )

  const setsCol = collection(db, 'students', userId, 'activitySets')
  const setRef = doc(setsCol)
  const savedKeys = ACTIVITY_SET_KEYS.filter((k) => safe[k] != null)
  batch.set(setRef, {
    set: safe,
    savedKeys,
    timestamp: serverTimestamp(),
  })

  const activitiesCol = collection(db, 'students', userId, 'activities')
  const TYPE_MAP = {
    seed: 'seed',
    analysis: 'analysis',
    idea: 'idea',
    drawing: 'drawing',
    inventionSpec: 'invention_spec',
    reflection: 'reflection',
    journey: 'journey',
  }
  for (const key of savedKeys) {
    const type = TYPE_MAP[key]
    if (!type) continue
    batch.set(doc(activitiesCol), {
      type,
      data: safe[key],
      timestamp: serverTimestamp(),
      activitySetId: setRef.id,
    })
  }

  await batch.commit()
  console.log('[activitySet] writeBatch 저장 완료:', setRef.id, savedKeys)
  return { id: setRef.id, savedKeys }
}

/**
 * 가장 최근에 저장된 활동 세트 한 건을 불러옵니다. (페이지 로드 시 카드 일괄 복원용)
 * @returns {Promise<{ id: string; set: Record<string, unknown>; savedKeys: string[]; timestamp: Date } | null>}
 */
export async function getLatestActivitySet() {
  try {
    const firebaseResult = initFirebase()
    if (!firebaseResult.app) return null

    const userId = localStorage.getItem('userId')
    if (!userId) return null

    const db = getFirestore(firebaseResult.app)
    const setsCol = collection(db, 'students', userId, 'activitySets')
    const q = query(setsCol, orderBy('timestamp', 'desc'), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null

    const docSnap = snap.docs[0]
    const data = docSnap.data() || {}
    const rawSet = data.set && typeof data.set === 'object' ? data.set : {}
    const set = {}
    for (const key of ACTIVITY_SET_KEYS) {
      set[key] = rawSet[key] ?? null
    }
    return {
      id: docSnap.id,
      set,
      savedKeys: Array.isArray(data.savedKeys) ? data.savedKeys : ACTIVITY_SET_KEYS.filter((k) => set[k] != null),
      timestamp: data.timestamp?.toDate?.() || new Date(),
    }
  } catch (error) {
    console.error('최신 활동 세트 조회 오류:', error)
    return null
  }
}

/**
 * 학생의 활동 기록을 Firebase에서 가져오기
 * @param {number} maxResults - 최대 가져올 활동 수 (기본값: 50)
 * @returns {Promise<Array>} 활동 배열
 */
export async function getStudentActivities(maxResults = 50) {
  try {
    // Firebase 초기화
    const firebaseResult = initFirebase()

    if (!firebaseResult.app) {
      console.warn('Firebase가 초기화되지 않아 활동을 가져올 수 없습니다.')
      return []
    }

    // Firestore 가져오기
    const db = getFirestore(firebaseResult.app)

    // 사용자 정보 가져오기
    const userId = localStorage.getItem('userId')

    if (!userId) {
      console.warn('사용자 ID가 없어 활동을 가져올 수 없습니다.')
      return []
    }

    // 활동 데이터 가져오기
    const activitiesRef = collection(db, 'students', userId, 'activities')
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(maxResults))
    const querySnapshot = await getDocs(q)

    const activities = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      activities.push({
        id: doc.id,
        type: data.type,
        data: data.data,
        timestamp: data.timestamp?.toDate?.() || new Date(),
      })
    })

    return activities
  } catch (error) {
    console.error('학생 활동 조회 오류:', error)
    return []
  }
}

/** 과거 활동 목록: 타입별로 나눠 가져와 병합 (한 타입만 연속 저장돼도 다른 단계 기록이 밀리지 않음) */
const ACTIVITY_TIMELINE_TYPES = [
  'analysis',
  'idea',
  'drawing',
  'reflection',
  'invention_spec',
  'journey',
]

/**
 * 활동 타입별 최근 N건씩 조회 후 시간순으로 합칩니다. 단일 limit 쿼리보다 타입 간 공정하게 노출됩니다.
 * @param {number} maxPerType - 타입당 최대 건수
 */
export async function getStudentActivitiesTimeline(maxPerType = 100) {
  try {
    const firebaseResult = initFirebase()
    if (!firebaseResult.app) {
      console.warn('Firebase가 초기화되지 않아 활동을 가져올 수 없습니다.')
      return []
    }
    const db = getFirestore(firebaseResult.app)
    const userId = localStorage.getItem('userId')
    if (!userId) {
      console.warn('사용자 ID가 없어 활동을 가져올 수 없습니다.')
      return []
    }

    const activitiesRef = collection(db, 'students', userId, 'activities')
    const byId = new Map()

    await Promise.all(
      ACTIVITY_TIMELINE_TYPES.map(async (type) => {
        const q = query(
          activitiesRef,
          where('type', '==', type),
          orderBy('timestamp', 'desc'),
          limit(maxPerType)
        )
        const querySnapshot = await getDocs(q)
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()
          byId.set(docSnap.id, {
            id: docSnap.id,
            type: data.type,
            data: data.data,
            timestamp: data.timestamp?.toDate?.() || new Date(),
          })
        })
      })
    )

    return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.warn(
      '타입별 활동 타임라인 조회 실패, 단일 쿼리로 대체합니다. (복합 색인 필요할 수 있음)',
      error
    )
    return getStudentActivities(maxPerType * ACTIVITY_TIMELINE_TYPES.length)
  }
}

/**
 * 특정 학생의 활동 기록을 Firebase에서 가져오기 (교사용)
 * @param {string} studentId - 학생 ID
 * @param {number} maxResults - 최대 가져올 활동 수 (기본값: 50)
 * @returns {Promise<Array>} 활동 배열
 */
export async function getStudentActivitiesById(studentId, maxResults = 50) {
  try {
    // Firebase 초기화
    const firebaseResult = initFirebase()

    if (!firebaseResult.app) {
      console.warn('Firebase가 초기화되지 않아 활동을 가져올 수 없습니다.')
      return []
    }

    // Firestore 가져오기
    const db = getFirestore(firebaseResult.app)

    if (!studentId) {
      console.warn('학생 ID가 없어 활동을 가져올 수 없습니다.')
      return []
    }

    // 활동 데이터 가져오기
    const activitiesRef = collection(db, 'students', studentId, 'activities')
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(maxResults))
    const querySnapshot = await getDocs(q)

    const activities = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      activities.push({
        id: doc.id,
        type: data.type,
        data: data.data,
        timestamp: data.timestamp?.toDate?.() || new Date(),
      })
    })

    return activities
  } catch (error) {
    console.error('학생 활동 조회 오류:', error)
    return []
  }
}

/**
 * 타입별 최신 활동 1건 (timestamp 기준). 전체 50건을 훑는 방식은 다른 타입 기록이 많으면
 * 오래된 명세/아이디어가 잡히거나 최신이 목록에서 빠질 수 있어 쿼리로 분리합니다.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} studentId
 * @param {string} type
 */
async function getLatestActivityByType(db, studentId, type) {
  if (!studentId || !type) return null
  const activitiesRef = collection(db, 'students', studentId, 'activities')
  const q = query(activitiesRef, where('type', '==', type), orderBy('timestamp', 'desc'), limit(1))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.empty) return null
  const docSnap = querySnapshot.docs[0]
  const data = docSnap.data()
  return {
    id: docSnap.id,
    type: data.type,
    data: data.data,
    timestamp: data.timestamp?.toDate?.() || new Date(),
  }
}

function pickLatestFromFlatList(activities) {
  const result = {
    analysis: null,
    idea: null,
    drawing: null,
    reflection: null,
    inventionSpec: null,
    journey: null,
  }
  for (const activity of activities) {
    if (activity.type === 'analysis' && !result.analysis) result.analysis = activity
    else if (activity.type === 'idea' && !result.idea) result.idea = activity
    else if (activity.type === 'drawing' && !result.drawing) result.drawing = activity
    else if (activity.type === 'reflection' && !result.reflection) result.reflection = activity
    else if (activity.type === 'invention_spec' && !result.inventionSpec) result.inventionSpec = activity
    else if (activity.type === 'journey' && !result.journey) result.journey = activity
    if (
      result.analysis &&
      result.idea &&
      result.drawing &&
      result.reflection &&
      result.inventionSpec &&
      result.journey
    ) {
      break
    }
  }
  return result
}

/**
 * 특정 학생의 최근 4개 활동(analysis, idea, drawing, reflection)을 가져오기 (교사용)
 * @param {string} studentId - 학생 ID
 * @returns {Promise<Object>} { analysis, idea, drawing, reflection }
 */
export async function getRecentActivitiesByStudentId(studentId) {
  try {
    const firebaseResult = initFirebase()
    if (!firebaseResult.app || !studentId) {
      return { analysis: null, idea: null, drawing: null, reflection: null, inventionSpec: null }
    }
    const db = getFirestore(firebaseResult.app)

    try {
      const [analysis, idea, drawing, reflection, inventionSpec] = await Promise.all([
        getLatestActivityByType(db, studentId, 'analysis'),
        getLatestActivityByType(db, studentId, 'idea'),
        getLatestActivityByType(db, studentId, 'drawing'),
        getLatestActivityByType(db, studentId, 'reflection'),
        getLatestActivityByType(db, studentId, 'invention_spec'),
      ])
      return { analysis, idea, drawing, reflection, inventionSpec }
    } catch (e) {
      console.warn('타입별 최신 활동 조회 실패, 목록 스캔으로 대체합니다. Firestore 복합 색인(type+timestamp)이 필요할 수 있습니다.', e)
      const activities = await getStudentActivitiesById(studentId, 300)
      return pickLatestFromFlatList(activities)
    }
  } catch (error) {
    console.error('최근 활동 조회 오류:', error)
    return { analysis: null, idea: null, drawing: null, reflection: null, inventionSpec: null }
  }
}

/**
 * 최근 4개 활동(analysis, idea, drawing, reflection)을 가져오기
 * @returns {Promise<Object>} { analysis, idea, drawing, reflection }
 */
export async function getRecentActivities() {
  try {
    const firebaseResult = initFirebase()
    const userId = localStorage.getItem('userId')

    if (!firebaseResult.app || !userId) {
      return {
        analysis: null,
        idea: null,
        drawing: null,
        reflection: null,
        inventionSpec: null,
        journey: null,
      }
    }

    const db = getFirestore(firebaseResult.app)

    try {
      const [analysis, idea, drawing, reflection, inventionSpec, journey] = await Promise.all([
        getLatestActivityByType(db, userId, 'analysis'),
        getLatestActivityByType(db, userId, 'idea'),
        getLatestActivityByType(db, userId, 'drawing'),
        getLatestActivityByType(db, userId, 'reflection'),
        getLatestActivityByType(db, userId, 'invention_spec'),
        getLatestActivityByType(db, userId, 'journey'),
      ])
      return { analysis, idea, drawing, reflection, inventionSpec, journey }
    } catch (e) {
      console.warn('타입별 최신 활동 조회 실패, 목록 스캔으로 대체합니다. Firestore 복합 색인(type+timestamp)이 필요할 수 있습니다.', e)
      const activities = await getStudentActivities(300)
      return pickLatestFromFlatList(activities)
    }
  } catch (error) {
    console.error('최근 활동 조회 오류:', error)
    return {
      analysis: null,
      idea: null,
      drawing: null,
      reflection: null,
      inventionSpec: null,
      journey: null,
    }
  }
}

