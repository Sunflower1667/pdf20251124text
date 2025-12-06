// 학생 활동을 Firebase Firestore에 저장하고 조회하는 유틸리티 함수
import { initFirebase } from './firebaseConfig.js'
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore'

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
 * 최근 3개 활동(analysis, idea, drawing)을 가져오기
 * @returns {Promise<Object>} { analysis, idea, drawing }
 */
export async function getRecentActivities() {
  try {
    const activities = await getStudentActivities(50)
    
    const result = {
      analysis: null,
      idea: null,
      drawing: null,
    }

    // 각 타입별로 가장 최근 활동 찾기
    for (const activity of activities) {
      if (activity.type === 'analysis' && !result.analysis) {
        result.analysis = activity
      } else if (activity.type === 'idea' && !result.idea) {
        result.idea = activity
      } else if (activity.type === 'drawing' && !result.drawing) {
        result.drawing = activity
      }

      // 모두 찾았으면 종료
      if (result.analysis && result.idea && result.drawing) {
        break
      }
    }

    return result
  } catch (error) {
    console.error('최근 활동 조회 오류:', error)
    return { analysis: null, idea: null, drawing: null }
  }
}

