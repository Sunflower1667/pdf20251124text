/**
 * 7차시 「나의 발명 여정 돌아보기」가 쓰는 1~6차시 활동 요약.
 *
 * 각 활동 화면이 남겨 둔 localStorage 드래프트를 읽어
 *  · 화면에 보여 줄 단계 카드(collectJourneySteps)
 *  · AI 프롬프트에 넣을 텍스트 요약(buildJourneySummaryText)
 * 두 가지 형태로 만듭니다. (대시보드가 로그인 직후 최신 활동 세트를 이 키들에 복원해 둡니다.)
 */

const SEED_DRAFT_KEY = 'pro10-seed-draft'
const ANALYSIS_KEY = 'analysisData'
const SPEC_EXPLORE_REFLECTION_KEY = 'specExploreReflection'
const SPEC_SELF_CHECK_KEY = 'specSelfCheck'
const IDEA_RESTORE_KEY = 'studentIdeaSessionRestore'
const DRAWING_RESTORE_KEY = 'studentDrawingRestore'
const DRAWING_CHECK_KEY = 'pro10-drawing-check'
const INVENTION_SPEC_KEY = 'myInventionSpecDraft'

const SPEC_FIELD_LABELS = [
  ['title', '발명의 명칭'],
  ['field', '기술분야'],
  ['background', '배경이 되는 기술'],
  ['problem', '해결하고자 하는 과제'],
  ['solution', '과제를 해결하기 위한 수단'],
  ['effect', '발명의 효과'],
  ['figures', '도면·그림에 대한 설명'],
]

const EXPLORE_REFLECTION_LABELS = [
  ['name', '발명품의 이름'],
  ['materials', '발명품의 재료'],
  ['merits', '발명품의 장점'],
  ['improvements', '발명품의 아쉬운 점'],
]

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw || !raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function text(value) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function clamp(value, maxChars) {
  const t = text(value)
  if (!t) return ''
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t
}

function joinList(value, maxItems, maxChars) {
  if (!Array.isArray(value)) return ''
  const items = value.map((v) => text(v)).filter(Boolean).slice(0, maxItems)
  return items.length ? clamp(items.join(', '), maxChars) : ''
}

/** 이름이 있는 항목만 남긴 items 배열을 만든다. */
function itemList(entries) {
  return entries.filter((entry) => entry && entry.value)
}

function answeredQuestions(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((q) => ({ question: text(q?.question), answer: text(q?.answer) }))
    .filter((q) => q.question && q.answer)
}

function seedStep() {
  const seed = readJson(SEED_DRAFT_KEY) || {}
  const patent = seed.selectedPatent || {}
  return {
    session: 1,
    icon: '🌱',
    title: '나의 발명 씨앗 찾기',
    items: itemList([
      { label: '고른 관심사', value: joinList(seed.interests, 8, 120) },
      { label: '내가 느낀 불편함', value: clamp(seed.discomfort, 220) },
      { label: '검색한 키워드', value: clamp(patent.searchedKeyword, 80) },
      { label: '골라 본 발명', value: clamp(patent.patentTitle, 120) },
      { label: '내가 이해한 내용', value: clamp(patent.patentSummary, 220) },
    ]),
  }
}

function exploreStep() {
  const analysis = readJson(ANALYSIS_KEY) || {}
  const reflection = readJson(SPEC_EXPLORE_REFLECTION_KEY) || {}
  const selfCheck = answeredQuestions(readJson(SPEC_SELF_CHECK_KEY))

  const reflectionItems = EXPLORE_REFLECTION_LABELS.map(([key, label]) => ({
    label,
    value: clamp(reflection[key], 200),
  }))

  return {
    session: 2,
    icon: '🔍',
    title: '명세서 탐색하기',
    items: itemList([
      { label: '분석한 명세서', value: clamp(analysis.patentName, 120) },
      { label: '출원·등록번호', value: clamp(analysis.applicationNumber, 60) },
      { label: '명세서에서 찾은 특징', value: joinList(analysis.features, 3, 220) },
      { label: '명세서에서 찾은 재료', value: joinList(analysis.materials, 3, 160) },
      ...reflectionItems,
      {
        label: '스스로 따져 보기',
        value: selfCheck.length ? `질문 ${selfCheck.length}개에 내 생각을 적었어요` : '',
      },
    ]),
    selfCheck,
  }
}

function ideaGenerationStep() {
  const idea = readJson(IDEA_RESTORE_KEY) || {}
  const ideas = Array.isArray(idea.ideas) ? idea.ideas : []
  const ideaNames = ideas.map((i) => text(i?.name)).filter(Boolean)

  return {
    session: 3,
    icon: '💡',
    title: '아이디어 창출하기',
    items: itemList([
      { label: '사용한 키워드', value: joinList(idea.keywords, 8, 120) },
      { label: '바꾸고 싶던 점', value: clamp(idea.drawbacks, 220) },
      { label: '만들어 본 아이디어', value: ideas.length ? `${ideas.length}개` : '' },
      { label: '아이디어 이름', value: clamp(ideaNames.join(', '), 220) },
    ]),
  }
}

function refinedIdeaText(refinedIdea) {
  const source = Array.isArray(refinedIdea)
    ? refinedIdea[refinedIdea.length - 1]
    : refinedIdea
  if (!source) return { name: '', detail: '' }
  if (typeof source === 'string') return { name: '', detail: clamp(source, 300) }
  const detail = [source.description, source.structureOrPrinciple, source.expectedEffect]
    .map((v) => text(v))
    .filter(Boolean)
    .join(' / ')
  return { name: text(source.name), detail: clamp(detail, 300) }
}

function ideaConcretizeStep() {
  const idea = readJson(IDEA_RESTORE_KEY) || {}
  const selected = idea.selectedIdea || null
  const refined = refinedIdeaText(idea.refinedIdea)
  const chatTurns = Array.isArray(idea.chatHistory)
    ? idea.chatHistory.filter((m) => m?.role === 'user').length
    : 0
  const selfCheck = answeredQuestions(idea.selfCheck)

  return {
    session: 4,
    icon: '🎯',
    title: '발명품 선정·구체화하기',
    items: itemList([
      { label: '고른 발명 아이디어', value: clamp(selected?.name, 120) },
      { label: '아이디어 설명', value: clamp(selected?.description, 220) },
      { label: '이걸 고른 이유', value: clamp(idea.selectionReason, 220) },
      { label: '도우미와 나눈 질문', value: chatTurns ? `${chatTurns}번` : '' },
      { label: '구체화한 이름', value: clamp(refined.name, 120) },
      { label: '구체화한 내용', value: refined.detail },
      {
        label: '골라 놓고 따져 보기',
        value: selfCheck.length ? `질문 ${selfCheck.length}개에 내 생각을 적었어요` : '',
      },
    ]),
    selfCheck,
  }
}

function drawingStep() {
  const check = readJson(DRAWING_CHECK_KEY) || {}
  const selfCheck = answeredQuestions(check.selfCheck)
  let image = ''
  try {
    const raw = localStorage.getItem(DRAWING_RESTORE_KEY)
    // 그림은 캔버스가 만든 base64 데이터 URL만 받는다 (속성값으로 그대로 넣기 때문)
    if (typeof raw === 'string' && /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/i.test(raw)) {
      image = raw
    }
  } catch {
    /* ignore */
  }

  return {
    session: 5,
    icon: '✏️',
    title: '발명품 표현하기',
    image,
    items: itemList([
      { label: '그림', value: image ? '내 발명품을 그려서 저장했어요' : '' },
      { label: '그림 설명', value: clamp(check.description, 220) },
      {
        label: '도면 대조 점검',
        value: selfCheck.length ? `질문 ${selfCheck.length}개에 내 생각을 적었어요` : '',
      },
      { label: '고친 도면 검토', value: clamp(check.review?.nextStep, 200) },
    ]),
    selfCheck,
  }
}

function inventionSpecStep() {
  const spec = readJson(INVENTION_SPEC_KEY) || {}
  const filled = SPEC_FIELD_LABELS.filter(([key]) => text(spec[key]))
  const counterAnswers = answeredQuestions(spec.counterAnswers)

  return {
    session: 6,
    icon: '📄',
    title: '나만의 발명품 명세서 완성하기',
    items: itemList([
      { label: '발명의 명칭', value: clamp(spec.title, 120) },
      { label: '해결하고자 하는 과제', value: clamp(spec.problem, 220) },
      { label: '과제를 해결하기 위한 수단', value: clamp(spec.solution, 220) },
      { label: '발명의 효과', value: clamp(spec.effect, 220) },
      {
        label: '채운 칸',
        value: filled.length ? `${filled.map(([, label]) => label).join(', ')}` : '',
      },
      {
        label: '처음 보는 사람의 질문',
        value: counterAnswers.length ? `질문 ${counterAnswers.length}개에 답했어요` : '',
      },
    ]),
    counterAnswers,
  }
}

/**
 * 1~6차시 단계별 활동 카드.
 * @returns {{ session: number, icon: string, title: string, items: {label: string, value: string}[], image?: string }[]}
 */
export function collectJourneySteps() {
  return [
    seedStep(),
    exploreStep(),
    ideaGenerationStep(),
    ideaConcretizeStep(),
    drawingStep(),
    inventionSpecStep(),
  ]
}

/** 기록이 하나라도 남아 있는 단계 수 */
export function countRecordedSteps(steps = collectJourneySteps()) {
  return steps.filter((step) => step.items.length > 0).length
}

/**
 * AI 프롬프트의 activitySummary 로 넣을 1~6차시 전체 이력 요약.
 * @param {ReturnType<typeof collectJourneySteps>} [steps]
 * @returns {string}
 */
export function buildJourneySummaryText(steps = collectJourneySteps()) {
  const blocks = steps
    .filter((step) => step.items.length > 0)
    .map((step) => {
      const lines = step.items.map((item) => `- ${item.label}: ${item.value}`)
      const extras = []
      const answers = step.selfCheck || step.counterAnswers
      if (Array.isArray(answers) && answers.length) {
        for (const qa of answers.slice(0, 3)) {
          extras.push(`- 질문 "${clamp(qa.question, 80)}"에 대한 내 답: ${clamp(qa.answer, 160)}`)
        }
      }
      return [`[${step.session}차시 ${step.title}]`, ...lines, ...extras].join('\n')
    })

  return blocks.join('\n\n')
}
