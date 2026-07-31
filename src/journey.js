import './reflection.css'
import './journey.css'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'
import {
  buildJourneySummaryText,
  collectJourneySteps,
  countRecordedSteps,
} from './journeySummary.js'
import {
  EMOTIONS,
  GROWTH_STAGES,
  generateAchievementComment,
} from './prompts/achievementComment.js'

/** 7차시 = 마지막 차시. 프롬프트가 일곱 시간 전체를 되돌아보는 모드로 동작합니다. */
const SESSION_NUMBER = 7
const JOURNEY_DRAFT_KEY = 'pro10-journey-draft'

const EMOTION_META = {
  깨달음: { id: 'insight', icon: '💡' },
  혼란: { id: 'confusion', icon: '😵' },
  열정: { id: 'passion', icon: '🔥' },
  고민: { id: 'worry', icon: '🧩' },
  성취: { id: 'achievement', icon: '✅' },
}

const GROWTH_META = {
  '이제 막 시작했어요': { id: 'seed', icon: '🌱', label: '씨앗' },
  '조금씩 자라고 있어요': { id: 'sprout', icon: '🌿', label: '싹' },
  '활짝 피어났어요': { id: 'flower', icon: '🌸', label: '꽃' },
  '훌륭하게 결실을 맺었어요': { id: 'fruit', icon: '🍎', label: '열매' },
}

const EMOTION_OPTIONS = EMOTIONS.map((label, index) => ({
  label,
  id: EMOTION_META[label]?.id || `emotion-${index + 1}`,
  icon: EMOTION_META[label]?.icon || '🙂',
}))

const GROWTH_OPTIONS = GROWTH_STAGES.map((description, index) => ({
  description,
  id: GROWTH_META[description]?.id || `growth-${index + 1}`,
  icon: GROWTH_META[description]?.icon || '🌱',
  label: GROWTH_META[description]?.label || `${index + 1}단계`,
}))

const journeySteps = collectJourneySteps()

const app = document.querySelector('#app')

function sanitize(value) {
  if (value == null) return ''
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

function renderJourneyStep(step) {
  const recorded = step.items.length > 0
  const body = recorded
    ? `<dl class="journey-step__items">
         ${step.items
           .map(
             (item) => `
           <div class="journey-step__item">
             <dt>${sanitize(item.label)}</dt>
             <dd>${sanitize(item.value)}</dd>
           </div>`
           )
           .join('')}
       </dl>
       ${
         step.image
           ? `<figure class="journey-step__figure">
                <img src="${step.image}" alt="${sanitize(step.title)}에서 그린 발명품 그림" />
                <figcaption>내가 그린 발명품</figcaption>
              </figure>`
           : ''
       }`
    : `<p class="journey-step__empty">
         이 단계에 남은 기록이 없어요. 대시보드 위쪽 [과거 활동 불러오기]를 누르면 지난 기록을 가져올 수 있어요.
       </p>`

  return `
    <li class="journey-step ${recorded ? 'is-recorded' : 'is-empty'}">
      <div class="journey-step__marker" aria-hidden="true">
        <span class="journey-step__icon">${step.icon}</span>
      </div>
      <div class="journey-step__body">
        <p class="journey-step__badge">${step.session}차시</p>
        <h3 class="journey-step__title">${sanitize(step.title)}</h3>
        ${body}
      </div>
    </li>
  `
}

app.innerHTML = `
  <div class="shell journey-shell">
    <header>
      <h1>나의 발명 여정 돌아보기</h1>
      <p class="subtitle">
        일곱 시간 동안 걸어온 나의 발명 여정을 한눈에 살펴보고, 마지막 소감을 남겨 보세요.
      </p>
    </header>

    <section class="journey-section">
      <div class="section-header">
        <h2>지금까지 걸어온 길</h2>
        <p class="section-hint">
          1차시부터 6차시까지 내가 고르고 적은 것들이에요. 천천히 읽으면서 처음과 지금이 어떻게 달라졌는지 떠올려 보세요.
        </p>
      </div>
      <p class="journey-progress" id="journey-progress" aria-live="polite"></p>
      <ol class="journey-timeline">
        ${journeySteps.map(renderJourneyStep).join('')}
      </ol>
    </section>

    <section class="emotion-section">
      <div class="section-header">
        <h2>일곱 시간을 마친 지금, 내 마음은?</h2>
        <p class="section-hint">발명 여정을 지나온 지금 가장 크게 남아 있는 감정을 하나 골라보세요.</p>
      </div>
      <div class="emotion-grid" id="emotion-grid">
        ${EMOTION_OPTIONS.map(
          (opt) => `
          <button type="button" class="emotion-chip" data-emotion="${opt.id}">
            <span class="emotion-icon">${opt.icon}</span>
            <span class="emotion-label">${sanitize(opt.label)}</span>
          </button>
        `
        ).join('')}
      </div>
    </section>

    <section class="growth-section">
      <div class="section-header">
        <h2>일곱 시간 동안 내 성장은 어디까지?</h2>
        <p class="section-hint">씨앗에서 열매까지, 이 여정 동안 내가 자란 만큼 골라보세요.</p>
      </div>
      <div class="growth-track" id="growth-track">
        ${GROWTH_OPTIONS.map(
          (opt, idx) => `
          <button type="button" class="growth-stage" data-growth="${opt.id}" data-step="${idx + 1}">
            <span class="growth-step">${idx + 1}단계</span>
            <span class="growth-icon">${opt.icon}</span>
            <span class="growth-label">${sanitize(opt.label)}</span>
            <span class="growth-desc">${sanitize(opt.description)}</span>
          </button>
          ${idx < GROWTH_OPTIONS.length - 1 ? '<span class="growth-arrow" aria-hidden="true">→</span>' : ''}
        `
        ).join('')}
      </div>
    </section>

    <section class="reflection-input">
      <div class="input-header">
        <h2>일곱 시간을 마친 지금의 소감</h2>
        <div class="char-count"><span id="char-count">0</span>자</div>
      </div>
      <textarea
        id="reflection-text"
        placeholder="일곱 시간 동안의 발명 여정을 돌아보며 떠오르는 생각을 자유롭게 적어보세요.&#10;&#10;예) 처음에는 불편한 점을 찾는 것도 어려웠는데, 명세서까지 써 보니 내 발명이 진짜가 된 것 같아요."
        rows="5"
      ></textarea>
    </section>

    <section class="actions-section">
      <div class="action-buttons">
        <button id="get-comment-btn" type="button" class="btn-primary" disabled>
          여정 소감 제출하고 코멘트 받기
        </button>
      </div>
      <p id="status-message" class="status-message" aria-live="polite"></p>
    </section>

    <section class="feedback-section" id="comment-section" style="display: none;">
      <h2>나의 발명 여정에 보내는 편지</h2>
      <div id="comment-content" class="feedback-content"></div>
      <p class="journey-finish-hint">
        여기까지 적었으면, 대시보드 위쪽 [활동 종료하기]를 눌러 일곱 시간의 활동을 마무리해 주세요.
      </p>
    </section>
  </div>
`

const journeyProgress = document.querySelector('#journey-progress')
const emotionGrid = document.querySelector('#emotion-grid')
const growthTrack = document.querySelector('#growth-track')
const reflectionText = document.querySelector('#reflection-text')
const charCount = document.querySelector('#char-count')
const getCommentBtn = document.querySelector('#get-comment-btn')
const statusMessage = document.querySelector('#status-message')
const commentSection = document.querySelector('#comment-section')
const commentContent = document.querySelector('#comment-content')

let selectedEmotion = null
let selectedGrowth = null
let letter = ''
let reflectionQuestion = ''
let reflectionAnswer = ''

const recordedCount = countRecordedSteps(journeySteps)
journeyProgress.textContent =
  recordedCount === journeySteps.length
    ? '여섯 단계 모두 기록이 남아 있어요. 내가 지나온 길을 확인해 보세요.'
    : `${journeySteps.length}단계 중 ${recordedCount}단계의 기록이 남아 있어요.`

function findEmotion(id) {
  return EMOTION_OPTIONS.find((o) => o.id === id) || null
}

function findGrowth(id) {
  return GROWTH_OPTIONS.find((o) => o.id === id) || null
}

/** 프롬프트에 넣을 성장 단계 표기: 씨앗 / 싹 / 꽃 / 열매 + 설명 */
function growthPromptLabel(growth) {
  if (!growth) return ''
  return `${growth.label} (${growth.description})`
}

function buildJourneyPayload() {
  const emotion = findEmotion(selectedEmotion)
  const growth = findGrowth(selectedGrowth)
  return {
    session: SESSION_NUMBER,
    reflection: reflectionText.value.trim(),
    letter,
    reflectionQuestion,
    reflectionAnswer,
    emotion: selectedEmotion,
    emotionLabel: emotion?.label || '',
    emotionIcon: emotion?.icon || '',
    growth: selectedGrowth,
    growthLabel: growth?.label || '',
    growthIcon: growth?.icon || '',
    growthDescription: growth?.description || '',
    journeySummary: buildJourneySummaryText(journeySteps),
    savedAt: new Date().toISOString(),
  }
}

function saveDraft() {
  try {
    localStorage.setItem(JOURNEY_DRAFT_KEY, JSON.stringify(buildJourneyPayload()))
  } catch {
    /* ignore */
  }
}

function setStatus(message, mode = 'info') {
  statusMessage.textContent = message || ''
  statusMessage.dataset.mode = mode
}

function markEmotionSelection() {
  emotionGrid.querySelectorAll('.emotion-chip').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.emotion === selectedEmotion)
  })
}

function markGrowthSelection() {
  const selected = growthTrack.querySelector(`[data-growth="${selectedGrowth}"]`)
  const step = selected ? Number(selected.dataset.step) : 0
  growthTrack.querySelectorAll('.growth-stage').forEach((el) => {
    el.classList.toggle('is-selected', el === selected)
    el.classList.toggle('is-passed', Number(el.dataset.step) < step)
  })
}

function updateSubmitState() {
  const hasText = reflectionText.value.trim().length > 0
  const ready = hasText && !!selectedEmotion && !!selectedGrowth
  getCommentBtn.disabled = !ready

  if (!selectedEmotion) {
    setStatus('지금 남아 있는 감정을 한 가지 골라 주세요.')
    return
  }
  if (!selectedGrowth) {
    setStatus('일곱 시간 동안의 성장 단계를 골라 주세요.')
    return
  }
  if (!hasText) {
    setStatus('일곱 시간을 마친 소감을 한두 문장 적어 주세요.')
    return
  }
  setStatus('준비 완료! 제출하면 나의 여정에 보내는 편지를 받을 수 있어요.', 'success')
}

/** 위쪽에 여정 편지, 아래쪽에 성찰 질문과 내 생각 칸을 그립니다. */
function renderAchievementComment() {
  const questionBlock = reflectionQuestion
    ? `<div class="reflect-block">
         <p class="reflect-question">💭 ${sanitize(reflectionQuestion)}</p>
         <textarea id="reflect-answer" class="reflect-answer" maxlength="300"
           placeholder="떠오르는 대로 한두 줄만 적어 봐도 좋아요">${sanitize(reflectionAnswer)}</textarea>
         <div class="reflect-actions">
           <button type="button" class="btn-secondary" id="reflect-save">이 생각 저장하기</button>
         </div>
         <p class="reflect-hint">안 써도 괜찮아요. 생각만 해 봐도 충분해요.</p>
       </div>`
    : ''

  commentContent.innerHTML = `
    <div class="comment-letter">${sanitize(letter).replace(/\n/g, '<br />')}</div>
    ${questionBlock}
  `

  if (!reflectionQuestion) return

  const answerInput = commentContent.querySelector('#reflect-answer')
  const saveAnswerBtn = commentContent.querySelector('#reflect-save')
  const hint = commentContent.querySelector('.reflect-hint')

  answerInput.addEventListener('input', () => {
    reflectionAnswer = answerInput.value
    saveDraft()
  })

  saveAnswerBtn.addEventListener('click', async () => {
    reflectionAnswer = answerInput.value.trim()
    saveDraft()
    saveAnswerBtn.disabled = true
    saveAnswerBtn.textContent = '저장 중...'
    try {
      await saveJourneyActivity()
      hint.textContent = '생각을 저장했어요. 언제든 다시 고쳐 써도 괜찮아요.'
      hint.dataset.mode = 'success'
    } catch (error) {
      console.error('여정 성찰 답변 저장 오류:', error)
      hint.textContent = '저장 중 문제가 생겼어요. 잠시 후 다시 눌러 주세요.'
      hint.dataset.mode = 'error'
    } finally {
      saveAnswerBtn.disabled = false
      saveAnswerBtn.textContent = '이 생각 저장하기'
    }
  })
}

async function saveJourneyActivity() {
  saveDraft()
  if (!localStorage.getItem('userId')) return
  const { saveStudentActivity } = await import('./activityStorage.js')
  await saveStudentActivity('journey', buildJourneyPayload())
}

function restoreDraft() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(JOURNEY_DRAFT_KEY) || 'null')
  } catch {
    saved = null
  }
  if (!saved || typeof saved !== 'object') return

  if (typeof saved.reflection === 'string') reflectionText.value = saved.reflection
  if (findEmotion(saved.emotion)) selectedEmotion = saved.emotion
  if (findGrowth(saved.growth)) selectedGrowth = saved.growth
  letter = typeof saved.letter === 'string' ? saved.letter : ''
  reflectionQuestion =
    typeof saved.reflectionQuestion === 'string' ? saved.reflectionQuestion : ''
  reflectionAnswer = typeof saved.reflectionAnswer === 'string' ? saved.reflectionAnswer : ''

  markEmotionSelection()
  markGrowthSelection()
  charCount.textContent = reflectionText.value.trim().length

  if (letter) {
    renderAchievementComment()
    commentSection.style.display = 'block'
  }
}

reflectionText.addEventListener('input', () => {
  charCount.textContent = reflectionText.value.trim().length
  updateSubmitState()
  saveDraft()
})

emotionGrid.addEventListener('click', (event) => {
  const chip = event.target.closest('.emotion-chip')
  if (!chip) return
  selectedEmotion = chip.dataset.emotion
  markEmotionSelection()
  updateSubmitState()
  saveDraft()
})

growthTrack.addEventListener('click', (event) => {
  const stage = event.target.closest('.growth-stage')
  if (!stage) return
  selectedGrowth = stage.dataset.growth
  markGrowthSelection()
  updateSubmitState()
  saveDraft()
})

getCommentBtn.addEventListener('click', async () => {
  const reflection = reflectionText.value.trim()
  const emotion = findEmotion(selectedEmotion)
  const growth = findGrowth(selectedGrowth)
  if (!reflection || !emotion || !growth) {
    updateSubmitState()
    return
  }

  getCommentBtn.disabled = true
  const prevLabel = getCommentBtn.textContent
  getCommentBtn.textContent = '코멘트 생성 중...'
  setStatus('일곱 시간의 여정을 읽고 편지를 쓰고 있어요...')

  try {
    const result = await generateAchievementComment({
      studentName: localStorage.getItem('userName') || '',
      activitySummary: buildJourneySummaryText(journeySteps),
      emotionLabel: emotion.label,
      growthLabel: growthPromptLabel(growth),
      reflection,
      session: SESSION_NUMBER,
    })

    letter = result.letter
    reflectionQuestion = result.reflectionQuestion
    reflectionAnswer = ''

    renderAchievementComment()
    commentSection.style.display = 'block'

    await saveJourneyActivity()
    setStatus('여정 소감과 편지를 저장했어요.', 'success')
  } catch (error) {
    console.error('여정 코멘트 생성 오류:', error)
    setStatus(error.message || '코멘트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.', 'error')
  } finally {
    getCommentBtn.textContent = prevLabel
    updateSubmitState()
  }
})

listenForWorkbenchFlushRequest(() => {
  if (!selectedEmotion && !selectedGrowth && !reflectionText.value.trim()) return
  saveDraft()
})

restoreDraft()
updateSubmitState()
