// 학생 활동을 Firebase Firestore에 저장하는 유틸리티 함수

/**
 * 학생 활동을 Firebase에 저장
 * @param {string} type - 활동 타입 ('analysis', 'idea', 'reflection')
 * @param {object} data - 활동 데이터
 * @returns {Promise<void>}
 */
export async function saveStudentActivity(type, data) {
  try {
    // Firebase 초기화
    const { initFirebase } = await import('./firebaseConfig.js')
    const firebaseResult = await initFirebase()

    if (!firebaseResult.app) {
      console.warn('Firebase가 초기화되지 않아 활동을 저장할 수 없습니다.')
      return
    }

    // Firestore 가져오기
    const { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
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

