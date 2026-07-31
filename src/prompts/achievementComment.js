import { callAi, cleanKoreanText } from '../lib/ai.js'

// ─────────────────────────────────────────────────────────────
// 1. 이름 + 조사
// ─────────────────────────────────────────────────────────────

/** 마지막 글자에 받침이 있는지 판별 */
function hasJongseong(word) {
  if (!word) return false
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return false // 한글 음절이 아니면 false
  return (code - 0xac00) % 28 !== 0
}

/**
 * 이름 + 조사 완성형을 만든다.
 * 받침 있음: 민준 → 민준이가 / 민준이는 / 민준이를
 * 받침 없음: 지우 → 지우가   / 지우는   / 지우를
 */
export function nameWithParticle(name, kind = 'subject') {
  const safe = (name || '').trim()
  if (!safe) {
    return { subject: '친구가', topic: '친구는', object: '친구를' }[kind] || '친구'
  }
  const jong = hasJongseong(safe)
  const base = jong ? `${safe}이` : safe
  const table = { subject: '가', topic: '는', object: '를' }
  return base + (table[kind] || '')
}

// ─────────────────────────────────────────────────────────────
// 2. 감정 / 성장 단계 선택지
// ─────────────────────────────────────────────────────────────

export const EMOTIONS = ['깨달음', '혼란', '열정', '고민', '성취']

export const GROWTH_STAGES = [
  '이제 막 시작했어요',
  '조금씩 자라고 있어요',
  '활짝 피어났어요',
  '훌륭하게 결실을 맺었어요',
]

/** 지원이 필요한 정서 상태인지 */
export const HEAVY_EMOTIONS = ['혼란', '고민']

// ─────────────────────────────────────────────────────────────
// 3. 프롬프트
// ─────────────────────────────────────────────────────────────

/**
 * @param {object}  p
 * @param {string}  p.studentName      학생 이름 (동의 취득 전제)
 * @param {string}  p.activitySummary  해당 차시에 학생이 수행한 활동 요약
 * @param {string}  p.emotionLabel     학생이 고른 감정
 * @param {string}  p.growthLabel      학생이 고른 성장 단계
 * @param {string}  p.reflection       학생이 작성한 소감
 * @param {number}  p.session          차시 번호 (1~7)
 */
export function achievementCommentPrompt({
  studentName,
  activitySummary,
  emotionLabel,
  growthLabel,
  reflection,
  session,
}) {
  const subjectName = nameWithParticle(studentName, 'subject')
  const topicName = nameWithParticle(studentName, 'topic')
  const isHeavyEmotion = HEAVY_EMOTIONS.includes(emotionLabel)
  const isFinalSession = Number(session) === 7

  // 7차시는 마지막 시간이므로, 그날 활동이 아니라 일곱 시간 전체를 되돌아보게 한다.
  // 이때 activitySummary에는 해당 차시 활동이 아니라 1~6차시 전체 이력 요약을 전달한다.
  const questionRule = isFinalSession
    ? `11. reflectionQuestion에는 짧은 성찰 질문 한 개만 써.
   - 오늘 하루가 아니라, 일곱 시간 동안의 발명 과정 전체를 되돌아볼 수 있는 질문이어야 해.
   - 한 문장, 35자 이내. 답이나 예시 답안은 절대 알려 주지 마.
   - ${
     isHeavyEmotion
       ? '지금 학생이 힘든 마음이니, 부담을 주는 질문 대신 가볍게 떠올려 볼 수 있는 질문으로 만들어.'
       : '발명을 하면서 자기 안에서 달라진 것을 스스로 짚어 볼 수 있는 질문으로 만들어.'
   }
   - 앞으로 무엇을 하라고 권하지 마.`
    : `11. reflectionQuestion에는 짧은 성찰 질문 한 개만 써.
   - 오늘 학생이 한 생각이나 선택을 스스로 되돌아볼 수 있는 질문이어야 해.
   - 한 문장, 30자 이내. 답이나 예시 답안은 절대 알려 주지 마.
   - ${
     isHeavyEmotion
       ? '지금 학생이 힘든 마음이니, 부담을 주는 질문 대신 가볍게 떠올려 볼 수 있는 질문으로 만들어.'
       : '오늘의 경험을 스스로 돌아볼 수 있는 질문으로 만들어.'
   }
   - 다음 시간에 무엇을 할지는 알려 주지 마.`

  const opening = isFinalSession
    ? `너는 중학생의 발명 아이디어 코치야. 일곱 시간 동안의 발명 활동을 모두 마친 학생이 쓴 소감을 읽고, 학생이 그동안 자기가 무엇을 해냈는지 스스로 알아차릴 수 있도록 따뜻한 성취 코멘트를 써 줘.`
    : `너는 중학생의 발명 아이디어 코치야. 오늘 활동을 마친 학생이 쓴 소감을 읽고, 학생이 오늘 자기가 무엇을 해냈는지 스스로 알아차릴 수 있도록 따뜻한 성취 코멘트를 써 줘.`

  const summaryLabel = isFinalSession
    ? '학생이 일곱 시간 동안 해 온 일'
    : '학생이 오늘 수행한 활동 요약'

  return `${opening}

[학생을 부르는 말]
- 주격: ${subjectName}
- 주제격: ${topicName}

[${summaryLabel}]
${activitySummary || '(활동 정보 없음)'}

[학생이 고른 오늘의 감정]
${emotionLabel || '(고르지 않음)'}

[학생이 고른 오늘의 성장 단계]
${growthLabel || '(고르지 않음)'}

[학생의 소감]
${reflection || '(작성하지 않음)'}

말투 예시 — 이 톤과 문장 리듬만 참고해. 내용은 절대 가져다 쓰지 마.
"오늘 느낀 그 마음은 정말 자연스러운 감정입니다. 오늘 ○○가 어려워 보이는 활동 앞에서도 끝까지 자기 생각을 적어 냈다는 건, 아주 의미 있는 경험이겠죠? 그렇게 한 걸음씩 나아가고 있다는 사실을 꼭 기억해 주세요."

작성 규칙:
1. 인사(안녕하세요, ~야 등)는 생략하고 바로 본문으로 시작해.
2. 말투는 위 예시처럼 정중하고 따뜻한 ~입니다, ~겠죠?, ~해 주세요 체로 써. 반말이나 지나치게 캐주얼한 표현은 쓰지 마.
3. 학생을 부를 때는 [학생을 부르는 말]에 적힌 형태를 그대로 써. '이(가)', '은(는)'처럼 조사를 괄호로 함께 적지 마.
4. 가장 먼저, 학생이 고른 감정을 있는 그대로 받아주고 공감해. 정서적 수용으로 시작하되, 감정에 어울리게 표현을 매번 다르게 써. 똑같은 첫 문장을 반복하지 마.
5. 그다음, ${isFinalSession ? '일곱 시간 동안' : '오늘'} 학생이 실제로 한 일을 한두 문장으로 짚어 줘.
   - 위 활동 내용과 [소감]에 있는 것을 바탕으로, 학생이 한 행동을 구체적으로 써.
   - "잘했어요" 같은 칭찬만 하지 말고, 무엇을 해서 여기까지 왔는지를 학생 자신의 행동으로 알려 줘.
   - 소감이 짧으면 위 활동 내용에서 학생이 실제로 한 선택이나 고쳐 쓴 내용을 찾아서 짚어 줘.${
     isFinalSession
       ? '\n   - 특히 처음과 나중이 어떻게 달라졌는지, 중간에 방향을 바꾼 곳이 있다면 그 대목을 짚어 줘.'
       : ''
   }
   - 위 활동 내용과 [소감] 어디에도 없는 일은 절대 지어내지 마.
6. 학생이 고른 성장 단계를 인정하고, 그 단계에 어울리는 따뜻한 응원 한 문장을 넣어 줘.
7. 평가·지적·조언은 최소화해. 점수나 순위는 말하지 마.
8. ${
    isHeavyEmotion
      ? '지금 학생이 힘든 마음이니, 해결책을 서두르지 말고 "그런 마음이 드는 것도 자연스러운 일입니다"처럼 먼저 안심시켜 줘.'
      : '학생이 오늘 보여준 작은 노력과 용기를 구체적으로 알아봐 줘.'
  }
9. 어려운 단어 없이, 중학생이 편하게 읽을 수 있게 써 줘. 반드시 한글로만 쓰고, 한자(漢字), 일본어, 영어는 절대 사용하지 마.
10. letter는 6~8문장 정도로, 짧고 진심 어린 편지처럼 작성해 줘. letter 안에는 질문을 넣지 마.
${questionRule}

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "letter": "편지 본문. 질문은 넣지 말 것",
  "reflectionQuestion": "성찰 질문 한 문장"
}`
}

// ─────────────────────────────────────────────────────────────
// 4. 호출 + 후처리
// ─────────────────────────────────────────────────────────────

export async function generateAchievementComment(params) {
  const raw = await callAi(achievementCommentPrompt(params))
  return {
    letter: cleanKoreanText(raw?.letter || ''),
    reflectionQuestion: cleanKoreanText(raw?.reflectionQuestion || ''),
  }
}
