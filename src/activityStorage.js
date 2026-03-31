// 학생 활동을 Firebase Firestore에 저장하고 조회하는 유틸리티 함수
import { initFirebase } from './firebaseConfig.js'
import { getAuth } from 'firebase/auth'
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
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
  }
  for (const activity of activities) {
    if (activity.type === 'analysis' && !result.analysis) result.analysis = activity
    else if (activity.type === 'idea' && !result.idea) result.idea = activity
    else if (activity.type === 'drawing' && !result.drawing) result.drawing = activity
    else if (activity.type === 'reflection' && !result.reflection) result.reflection = activity
    else if (activity.type === 'invention_spec' && !result.inventionSpec) result.inventionSpec = activity
    if (
      result.analysis &&
      result.idea &&
      result.drawing &&
      result.reflection &&
      result.inventionSpec
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
      return { analysis: null, idea: null, drawing: null, reflection: null, inventionSpec: null }
    }

    const db = getFirestore(firebaseResult.app)

    try {
      const [analysis, idea, drawing, reflection, inventionSpec] = await Promise.all([
        getLatestActivityByType(db, userId, 'analysis'),
        getLatestActivityByType(db, userId, 'idea'),
        getLatestActivityByType(db, userId, 'drawing'),
        getLatestActivityByType(db, userId, 'reflection'),
        getLatestActivityByType(db, userId, 'invention_spec'),
      ])
      return { analysis, idea, drawing, reflection, inventionSpec }
    } catch (e) {
      console.warn('타입별 최신 활동 조회 실패, 목록 스캔으로 대체합니다. Firestore 복합 색인(type+timestamp)이 필요할 수 있습니다.', e)
      const activities = await getStudentActivities(300)
      return pickLatestFromFlatList(activities)
    }
  } catch (error) {
    console.error('최근 활동 조회 오류:', error)
    return { analysis: null, idea: null, drawing: null, reflection: null, inventionSpec: null }
  }
}

