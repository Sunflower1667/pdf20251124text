const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

const LEVEL_ADJUST = `- 학생이 어려워하면 더 쉬운 말과 일상 속 비유로 한 번 더 풀어서 설명해 줘.
- 학생이 이미 잘 이해하고 있으면 명세서의 조금 더 구체적인 내용까지 짚어 줘.`
const KOREAN_ONLY = '- 반드시 한국어로만 답해.'

/** 명세서 칸. 앞의 다섯 칸은 2차시에 남의 명세서를 읽을 때 쓴 다섯 칸과 같다. */
export const SPEC_FIELDS = [
  { id: 'title', label: '발명의 명칭' },
  { id: 'field', label: '기술분야' },
  { id: 'background', label: '배경이 되는 기술' },
  { id: 'problem', label: '해결하고자 하는 과제' },
  { id: 'solution', label: '과제를 해결하기 위한 수단' },
  { id: 'effect', label: '발명의 효과' },
  { id: 'figures', label: '도면·그림에 대한 간단한 설명' },
]

/** 이야기가 이어져야 하는 칸끼리 짝지은 것. */
export const SPEC_FLOW_PAIRS = [
  '배경이 되는 기술 → 해결하고자 하는 과제',
  '해결하고자 하는 과제 → 과제를 해결하기 위한 수단',
  '과제를 해결하기 위한 수단 → 발명의 효과',
]

export const REVIEW_LEVELS = ['괜찮아요', '조금 더', '다시 볼까요']

/**
 * 한자와 일본어 글자를 지우고 공백을 정리한다.
 * 괄호는 지우지 않는다. 후보 표현의 쉬운 뜻풀이가 괄호 안에 담기기 때문이다.
 */
export function cleanKoreanText(text) {
  if (text == null) return ''
  return String(text)
    .replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '')
    .replace(/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLevel(value) {
  const text = cleanKoreanText(value)
  return REVIEW_LEVELS.includes(text) ? text : '조금 더'
}

export function specBlock(spec) {
  return SPEC_FIELDS.map(
    (f) => `- ${f.label}: ${String(spec?.[f.id] || '').trim() || '(작성하지 않음)'}`
  ).join('\n')
}

export async function callAi(prompt) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const payload = await safeJson(response)
    throw new Error(payload?.error?.message || `AI 요청 오류 (${response.status})`)
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) throw new Error('AI 응답을 읽지 못했어요. 잠시 뒤 다시 눌러 주세요.')
  return parseAiJson(aiText)
}

// ─────────────────────────────────────────────────────────────
// 6-1. 개념적 — 일상어를 기술적·법적 표현으로 바꾸는 가이드
// ─────────────────────────────────────────────────────────────

/**
 * @param {string} p.fieldLabel  학생이 지금 쓰고 있는 항목 이름
 * @param {string} p.studentText 그 항목에 학생이 쓴 글
 * @param {string} p.ideaName    발명 이름
 */
export function termGuidePrompt({ fieldLabel, studentText, ideaName }) {
  return `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 자기 발명품 명세서를 쓰고 있어. 명세서는 누가 읽어도 같은 뜻으로 읽혀야 해서,
평소에 쓰는 말보다 조금 더 또렷하고 정확한 말을 써야 해.
학생이 쓴 글에서 그런 말로 바꿔 보면 좋을 곳을 찾아서, 어떤 말이 있는지 알려 줘.

[학생의 발명 이름]
${ideaName || '(정보 없음)'}

[학생이 지금 쓰고 있는 항목]
${fieldLabel}

[학생이 쓴 글]
${studentText || '(작성하지 않음)'}

[안내 규칙 — 매우 중요]
- **학생의 문장을 대신 고쳐 쓰지 마.** 바꿔 쓴 문장을 통째로 보여 주면 안 돼.
  어떤 말을 쓸 수 있는지 후보만 알려 주고, 고쳐 쓰는 건 학생이 하도록 해.
- 바꿔 보면 좋을 표현을 최대 3개까지만 골라. 너무 많이 짚으면 학생이 지쳐.
- 표현마다 이렇게 알려 줘.
  · 학생이 쓴 말 그대로
  · 바꿔 쓸 수 있는 말 2~3개 (각각 괄호로 쉬운 뜻풀이를 달아 줘)
  · 왜 바꾸면 좋은지 한 문장 (누가 읽어도 같은 뜻이 되도록, 같은 뜻으로 읽히도록 등)
- 어려운 말을 쓰라고 강요하지 마. 중학생이 뜻을 아는 말 중에서 골라 줘.
  뜻을 모르는 말을 쓰면 오히려 명세서가 이상해진다는 것도 알려 줘.
- 명세서에서 자주 쓰는 말투(예: 무엇을 하는 부분을 "○○부"라고 부르기,
  마지막에 "~하는 것을 특징으로 한다"라고 맺기)가 이 항목에 어울리면 함께 알려 줘.
  다만 억지로 넣으라고 하지는 마.
- 학생이 쓴 글이 이미 또렷하면 억지로 바꿀 곳을 만들어 내지 마.
  그럴 때는 items를 빈 배열로 두고, encouragement에 그 점을 짚어 줘.
- 아직 아무것도 안 썼으면 items를 빈 배열로 두고, encouragement에
  먼저 편한 말로 써 본 뒤 다시 오라고 안내해 줘.
${LEVEL_ADJUST}
- 오늘 할 일은 "명세서 쓰기"까지야. 다른 활동 이야기는 하지 마.
${KOREAN_ONLY}
- 모든 문장은 존댓말 해요체("~예요", "~어요")로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "items": [
    {
      "studentPhrase": "학생이 쓴 말 그대로",
      "candidates": ["바꿔 쓸 수 있는 말(쉬운 뜻풀이)", "..."],
      "why": "왜 바꾸면 좋은지 한 문장"
    }
  ],
  "encouragement": "학생에게 건네는 한두 문장"
}`
}

export async function guideTerms(params) {
  const raw = await callAi(termGuidePrompt(params))
  return {
    items: (raw?.items || [])
      .slice(0, 3)
      .map((it) => ({
        studentPhrase: cleanKoreanText(it?.studentPhrase || ''),
        candidates: (it?.candidates || []).map(cleanKoreanText).filter(Boolean),
        why: cleanKoreanText(it?.why || ''),
      }))
      .filter((it) => it.studentPhrase && it.candidates.length),
    encouragement: cleanKoreanText(raw?.encouragement || ''),
  }
}

// ─────────────────────────────────────────────────────────────
// 6-2. 메타인지적 — 반박 질문
//
// 반박자를 '이 발명을 처음 보는 사람'으로 외재화한다.
// AI가 직접 공격하는 형태가 되면 학습자가 방어적으로 반응해 탐구가 닫힌다.
// ─────────────────────────────────────────────────────────────

/**
 * @param {object} p.spec       학생이 쓴 명세서 항목
 * @param {string} p.ideaName   발명 이름
 */
export function counterQuestionPrompt({ spec, ideaName }) {
  return `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 자기 발명품 명세서를 다 썼어. 이제 이 명세서를 처음 보는 사람이 읽는다고 생각하고,
그 사람이 고개를 갸웃하며 물어볼 만한 질문 3개를 만들어 줘.
학생이 그 질문에 답해 보면서 자기 글의 약한 곳을 스스로 찾게 하는 게 목적이야.

[학생의 발명 이름]
${ideaName || '(정보 없음)'}

[학생이 쓴 명세서]
${specBlock(spec)}

[질문 규칙 — 매우 중요]
- 반드시 질문만 만들어. 무엇이 틀렸다거나 무엇을 고치라고 네가 말하지 마.
  답, 예시 답안, 정답도 절대 알려 주지 마.
- **질문은 네가 묻는 것처럼 쓰지 말고, "이 발명을 처음 보는 사람이라면 이렇게 물을 거예요" 하는
  틀로 써.** 학생이 공격받는다고 느끼지 않고, 함께 대비한다고 느껴야 해.
- 3개 질문은 각각 다른 곳을 파고들게 해.
  1번은 과제와 수단이 이어지는지 — 정말 그 방법으로 그 불편함이 없어지는지
  2번은 근거 — 왜 그렇게 된다고 말할 수 있는지, 그렇게 되지 않는 경우는 없는지
  3번은 무엇이 다른지 — 배경이 되는 기술에 쓴 기존 방법과 견주어 이 발명만의 다른 점이 무엇인지
- 학생이 명세서에 쓴 말을 질문 안에 그대로 넣어서, 이 명세서에만 해당하는 질문으로 만들어.
  어떤 발명에나 쓸 수 있는 일반적인 질문은 안 돼.
- 비꼬거나 몰아붙이는 말투는 절대 쓰지 마. 궁금해서 묻는 말투로 써.
- 한 질문은 한 문장, 50자 이내로.
- "예/아니오"로 끝나는 질문 대신, 이유나 근거를 말하게 하는 질문으로 만들어.
- 아직 명세서가 거의 비어 있으면 questions를 빈 배열로 두고,
  note에 먼저 명세서 칸을 채운 뒤 다시 오라고 안내해 줘.
- 오늘 할 일은 "명세서 쓰기"까지야. 다른 활동 이야기는 하지 마.
${KOREAN_ONLY}
- 질문은 존댓말 해요체로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "questions": [
    { "focus": "정말 해결되나요", "question": "질문 한 문장" },
    { "focus": "근거가 있나요", "question": "질문 한 문장" },
    { "focus": "무엇이 다른가요", "question": "질문 한 문장" }
  ],
  "note": "명세서가 비어 있을 때만 안내 한 문장. 아니면 빈 문자열"
}`
}

export async function generateCounterQuestions(params) {
  const raw = await callAi(counterQuestionPrompt(params))
  return {
    questions: (raw?.questions || [])
      .slice(0, 3)
      .map((q) => ({
        focus: cleanKoreanText(q?.focus || ''),
        question: cleanKoreanText(q?.question || ''),
      }))
      .filter((q) => q.question),
    note: cleanKoreanText(raw?.note || ''),
  }
}

// ─────────────────────────────────────────────────────────────
// 6-3. 절차적 — 각 항목 완성도·맞춤법·논리적 연결 점검
// ─────────────────────────────────────────────────────────────

/**
 * @param {object}   p.spec             학생이 쓴 명세서 (반박 질문 후 수정본)
 * @param {string}   p.ideaName         발명 이름
 * @param {object[]} p.counterAnswers   6-2 반박 질문에 학생이 쓴 답
 */
export function specReviewPrompt({ spec, ideaName, counterAnswers }) {
  const answerText =
    (counterAnswers || [])
      .filter((c) => c?.answer)
      .map((c) => `- ${c.question}\n  → 학생의 답: ${c.answer}`)
      .join('\n') || '(작성하지 않음)'

  const fieldChecksFormat = SPEC_FIELDS.map(
    (f) => `    { "field": "${f.label}", "level": "${REVIEW_LEVELS.join(' / ')} 중 하나", "comment": "한 문장 설명" }`
  ).join(',\n')
  const flowFormat = SPEC_FLOW_PAIRS.map(
    (pair) => `    { "between": "${pair}", "level": "${REVIEW_LEVELS.join(' / ')} 중 하나", "comment": "한 문장 설명" }`
  ).join(',\n')

  return `너는 대한민국 중학생의 발명품 명세서를 함께 살펴보는 발명 보조교사야.
학생이 스스로 먼저 쓴 명세서를 보고, 빠진 곳과 아직 흐릿한 곳을 짧고 구체적으로 알려 줘.

이 명세서의 앞 다섯 칸은 학생이 2차시에 다른 사람의 명세서를 읽을 때 썼던 것과 같은 다섯 칸이야.
그때 읽으면서 익힌 틀을 이번에는 자기 발명으로 채우는 거라고 알려 주면 좋아.

[학생의 발명 이름]
${ideaName || '(정보 없음)'}

[학생이 쓴 명세서]
${specBlock(spec)}

[학생이 반박 질문에 답한 내용]
${answerText}

[살펴볼 세 가지]
1. 칸 채움 — 각 칸이 비어 있지 않은지, 그 칸에 들어갈 내용이 맞게 들어갔는지
   (예: 배경이 되는 기술 칸에 자기 발명 자랑을 쓰지 않았는지)
2. 맞춤법과 띄어쓰기 — 틀린 곳이 있는지
3. 이야기가 이어지는지 — 배경이 되는 기술에서 아쉬웠던 점이 해결하고자 하는 과제로 이어지고,
   그 과제가 과제를 해결하기 위한 수단으로 이어지고, 그 수단이 발명의 효과로 이어지는지

[안내 규칙 — 매우 중요]
- 칸마다 "${REVIEW_LEVELS.join(' / ')}" 중 하나로 표시하고, 왜 그렇게 봤는지 한 문장으로 설명해.
- **학생의 문장을 대신 다시 써 주지 마.** 무엇이 흐릿한지, 어디에 무엇을 더 적으면 좋을지만 알려 줘.
  · 좋은 예: "과제를 해결하기 위한 수단 칸에 무엇으로 만드는지가 아직 없어요. 어떤 재료를 쓸지 적어 볼까요?"
  · 나쁜 예: "'본 발명은 단열 소재로 피복된 손잡이부를 포함하는 것을 특징으로 한다'로 쓰세요."
- 맞춤법은 틀린 말과 바른 말을 함께 알려 줘. 왜 그렇게 쓰는지도 아주 짧게 덧붙여.
  맞춤법은 최대 5개까지만 짚어. 너무 많으면 학생이 위축돼.
- 이야기가 이어지지 않으면 어느 칸과 어느 칸 사이가 끊겼는지 짚어 줘.
  이어 붙일 문장을 대신 만들어 주지는 마.
- 잘된 곳을 먼저 한 가지 짚어 주고 시작해. 비난하지 말고 격려하는 말투로 써.
- 점수, 등급, 순위, 몇 개 맞았는지는 말하지 마.
${LEVEL_ADJUST}
- 오늘 할 일은 "명세서 쓰기"까지야. 다른 활동 이야기는 하지 마.
${KOREAN_ONLY}
- 모든 문장은 존댓말 해요체로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "goodPoint": "이 명세서에서 잘된 곳 한 문장",
  "fieldChecks": [
${fieldChecksFormat}
  ],
  "spelling": [
    { "wrong": "틀린 말", "right": "바른 말", "why": "아주 짧은 설명" }
  ],
  "flow": [
${flowFormat}
  ],
  "nextStep": "다음에 할 일 한 문장"
}
fieldChecks는 위 ${SPEC_FIELDS.length}개 칸을 모두 넣어. 틀린 맞춤법이 없으면 spelling은 빈 배열로 둬.`
}

export async function reviewSpec(params) {
  const raw = await callAi(specReviewPrompt(params))
  const cleanList = (arr, keys, limit) =>
    (arr || []).slice(0, limit).map((o) => {
      const out = {}
      for (const k of keys) out[k] = k === 'level' ? normalizeLevel(o?.[k]) : cleanKoreanText(o?.[k] || '')
      return out
    })
  return {
    goodPoint: cleanKoreanText(raw?.goodPoint || ''),
    fieldChecks: cleanList(raw?.fieldChecks, ['field', 'level', 'comment'], SPEC_FIELDS.length).filter(
      (o) => o.field
    ),
    spelling: cleanList(raw?.spelling, ['wrong', 'right', 'why'], 5).filter((o) => o.wrong && o.right),
    flow: cleanList(raw?.flow, ['between', 'level', 'comment'], SPEC_FLOW_PAIRS.length).filter(
      (o) => o.between
    ),
    nextStep: cleanKoreanText(raw?.nextStep || ''),
  }
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractAiText(result) {
  if (!result) return ''
  if (Array.isArray(result.output)) {
    for (const block of result.output) {
      if (!Array.isArray(block?.content)) continue
      for (const piece of block.content) {
        if (piece?.type !== 'output_text') continue
        if (Array.isArray(piece.text)) return piece.text.join('')
        return String(piece.text || '')
      }
    }
  }
  if (Array.isArray(result.output_text) && result.output_text.length) {
    return String(result.output_text[0] || '')
  }
  return String(result?.choices?.[0]?.message?.content || '')
}

function parseAiJson(rawText) {
  const trimmed = String(rawText || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(extractFirstJson(candidate))
}

function extractFirstJson(text) {
  const openIndex = text.indexOf('{')
  const closeIndex = text.lastIndexOf('}')
  if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) return text
  return text.slice(openIndex, closeIndex + 1)
}
