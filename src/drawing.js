import './drawing.css'
import { saveStudentActivity } from './activityStorage.js'
import { listenForWorkbenchFlushRequest } from './workbenchFlush.js'

const DEFAULT_OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions'

function resolveOpenAiChatCompletionsUrl() {
  const u = (import.meta.env.VITE_OPENAI_API_URL || '').trim()
  if (!u) return DEFAULT_OPENAI_CHAT
  if (u.includes('/chat/completions')) return u
  const noTrail = u.replace(/\/$/, '')
  if (noTrail.endsWith('/responses')) {
    return `${noTrail.slice(0, -'/responses'.length)}/chat/completions`
  }
  if (noTrail.endsWith('/v1')) return `${noTrail}/chat/completions`
  return DEFAULT_OPENAI_CHAT
}

const VISION_MODEL =
  (import.meta.env.VITE_OPENAI_VISION_MODEL || '').trim() ||
  (import.meta.env.VITE_OPENAI_MODEL || '').trim() ||
  'gpt-4o-mini'

/** 4차시 「아이디어 만들기」에서 학생이 고르고 구체화한 발명 */
const IDEA_RESTORE_KEY = 'studentIdeaSessionRestore'
/** 이 화면에서 학생이 쓴 그림 설명과 점검 기록 */
const DRAWING_CHECK_KEY = 'pro10-drawing-check'

const KOREAN_ONLY = '- 반드시 한국어로만 답해.'
const IMAGE_QUALITY =
  '- 그림에서 흐릿하거나 잘려서 알아보기 어려운 부분은 짐작해서 단정하지 마. 무엇이 잘 안 보이는지만 짚어 줘.'
const SCOPE_GUARD =
  '- 발명과 관계없는 것(그림 솜씨, 색칠, 글씨체, 선의 깔끔함)은 말하지 마.'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="shell">
    <header>
      <h1>발명품 표현하기</h1>
      <p class="subtitle">만들고 싶은 발명품을 직접 그려보세요!</p>
    </header>

    <div class="drawing-layout">
    <div class="drawing-main">
    <section class="drawing-section">
      <div class="drawing-tools">
        <div class="tool-group">
          <label>도구</label>
          <div class="tool-buttons">
            <button id="upload-image-btn" class="tool-btn">📷 그림 업로드</button>
            <input type="file" id="image-upload-input" accept="image/*" style="display: none;" />
            <button id="pen-tool" class="tool-btn active" data-tool="pen">✏️ 펜</button>
            <button id="eraser-tool" class="tool-btn" data-tool="eraser">🧹 지우개</button>
            <button id="text-tool" class="tool-btn" data-tool="text">🅣 글씨</button>
            <button id="clear-btn" class="tool-btn danger">🗑️ 전체 지우기</button>
          </div>
        </div>

        <div class="tool-row">
          <div class="tool-group">
            <label>색상</label>
            <div class="color-picker">
              <input type="color" id="color-input" value="#000000" />
              <div class="color-presets">
                <button class="color-preset" data-color="#000000" style="background: #000000;"></button>
                <button class="color-preset" data-color="#2563eb" style="background: #2563eb;"></button>
                <button class="color-preset" data-color="#dc2626" style="background: #dc2626;"></button>
                <button class="color-preset" data-color="#16a34a" style="background: #16a34a;"></button>
                <button class="color-preset" data-color="#ca8a04" style="background: #ca8a04;"></button>
                <button class="color-preset" data-color="#9333ea" style="background: #9333ea;"></button>
              </div>
            </div>
          </div>

          <div class="tool-group">
            <label>선 두께</label>
            <input type="range" id="brush-size" min="1" max="20" value="5" />
            <span id="brush-size-value">5px</span>
          </div>
        </div>

        <div class="text-controls" id="text-controls" hidden>
          <div class="tool-group">
            <label for="text-font-size">글자 크기</label>
            <div class="text-size-row">
              <input type="range" id="text-font-size" min="12" max="96" value="28" />
              <span id="text-font-size-value">28px</span>
            </div>
          </div>
          <p class="text-controls-hint">
            글씨 도구가 켜져 있을 때 캔버스를 클릭하면 그 자리에 글씨가 생깁니다.
            글씨를 끌어서 위치를 옮길 수 있고, 두 번 클릭하면 내용을 고칠 수 있어요.
            선택된 글씨의 오른쪽 위 ✕ 버튼으로 삭제할 수 있습니다. 글씨체는 굴림체로 통일됩니다.
          </p>
        </div>

        <label class="pen-input-hint">
          <input type="checkbox" id="allow-touch-drawing" />
          <span>손가락(터치)으로도 그리기 — 끄면 애플펜슬·스타일러스·마우스만 인식해 손바닥 오인식을 줄입니다.</span>
        </label>
      </div>

      <div class="canvas-container">
        <canvas id="drawing-canvas"></canvas>
        <div id="text-overlay" class="text-overlay"></div>
        <div id="cursor-preview" class="cursor-preview"></div>
      </div>

      <div class="drawing-actions">
        <button id="save-drawing-btn" type="button" class="btn-secondary">그림 저장하기</button>
        <button id="download-drawing-btn" type="button" class="btn-secondary">그림 다운로드</button>
      </div>
    </section>

    <section class="drawing-desc" aria-labelledby="drawing-desc-title">
      <h2 id="drawing-desc-title">내 그림 설명 쓰기</h2>
      <p class="drawing-desc-hint">
        그림 속 부분들이 각각 무엇이고 어떻게 움직이는지 글로 써 보세요.
        아래 점검에서 이 설명과 그림을 나란히 놓고 견주어 봅니다.
      </p>
      <label class="sr-only" for="drawing-desc-input">내 그림 설명</label>
      <textarea
        id="drawing-desc-input"
        rows="4"
        placeholder="예: 위쪽 손잡이를 누르면 아래 집게가 벌어져요. 가운데 점선은 접히는 곳이에요."
      ></textarea>
    </section>

    <section class="drawing-check" aria-labelledby="drawing-check-title">
      <h2 id="drawing-check-title">그림과 설명 맞춰 보기</h2>

      <div class="drawing-check-step">
        <div class="drawing-check-step-head">
          <span class="drawing-check-step-num">1</span>
          <h3>스스로 살펴보기</h3>
        </div>
        <p class="drawing-check-hint">
          그림과 설명을 견주어 볼 수 있는 질문 3개를 받아, 스스로 답해 보세요.
        </p>
        <button type="button" id="drawing-crosscheck-btn" class="drawing-check-btn">점검 질문 받기</button>
        <p id="drawing-crosscheck-status" class="drawing-check-status" role="status" aria-live="polite" hidden></p>
        <div id="drawing-crosscheck-list" class="drawing-check-list"></div>
      </div>

      <div class="drawing-check-step" id="drawing-review-step" hidden>
        <div class="drawing-check-step-head">
          <span class="drawing-check-step-num">2</span>
          <h3>고친 도면 검토받기</h3>
        </div>
        <p class="drawing-check-hint">
          세 질문에 모두 답하고 도면을 고친 뒤에 눌러 주세요.
          자리 배치, 만들 수 있는 구조, 빠진 부품을 차례로 살펴봐 줍니다.
        </p>
        <button type="button" id="drawing-review-btn" class="drawing-check-btn">고친 도면 검토받기</button>
        <p id="drawing-review-status" class="drawing-check-status" role="status" aria-live="polite" hidden></p>
        <div id="drawing-review-result" class="drawing-review-result"></div>
      </div>
    </section>
    </div>

    <aside class="drawing-coach" aria-label="그림 도우미">
      <div class="drawing-coach-head">
        <h2>그림 도우미</h2>
        <p class="drawing-coach-lead">
          그리다가 막히는 곳이 있으면 물어보세요. 그림과 설명 점검은 왼쪽 아래 「그림과 설명 맞춰 보기」에서 할 수 있어요.
        </p>
      </div>
      <div id="drawing-coach-messages" class="drawing-coach-messages" role="log" aria-live="polite"></div>
      <div class="drawing-coach-compose">
        <label class="sr-only" for="drawing-coach-input">도우미에게 질문하기</label>
        <textarea
          id="drawing-coach-input"
          rows="3"
          placeholder="여기에 궁금한 질문을 입력해주세요. 예: 숫자로 부품 번호를 달면 좋을까요? 비율이나 크기가 괜찮을까요?"
        ></textarea>
        <button type="button" id="drawing-coach-send-btn" class="drawing-coach-send-btn">질문 보내기</button>
      </div>
    </aside>
    </div>
  </div>
`

const canvas = document.querySelector('#drawing-canvas')
const ctx = canvas.getContext('2d')
const cursorPreview = document.querySelector('#cursor-preview')
const colorInput = document.querySelector('#color-input')
const brushSize = document.querySelector('#brush-size')
const brushSizeValue = document.querySelector('#brush-size-value')
const uploadImageBtn = document.querySelector('#upload-image-btn')
const imageUploadInput = document.querySelector('#image-upload-input')
const penTool = document.querySelector('#pen-tool')
const eraserTool = document.querySelector('#eraser-tool')
const clearBtn = document.querySelector('#clear-btn')
const saveDrawingBtn = document.querySelector('#save-drawing-btn')
const downloadDrawingBtn = document.querySelector('#download-drawing-btn')
const allowTouchDrawingInput = document.querySelector('#allow-touch-drawing')
const colorPresets = document.querySelectorAll('.color-preset')
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]')
const textOverlay = document.querySelector('#text-overlay')
const textControls = document.querySelector('#text-controls')
const textFontSizeInput = document.querySelector('#text-font-size')
const textFontSizeValue = document.querySelector('#text-font-size-value')

const TEXT_FONT_FAMILY = "'굴림', Gulim, '굴림체', GulimChe, sans-serif"
const TEXT_LINE_HEIGHT = 1.3
/** @type {{ id: number, el: HTMLElement, contentEl: HTMLElement, x: number, y: number, size: number, color: string }[]} */
const textItems = []
let textIdCounter = 0
/** @type {(typeof textItems)[number] | null} */
let selectedTextItem = null
let currentFontSize = 28
const coachMessagesEl = document.getElementById('drawing-coach-messages')
const coachSendBtn = document.getElementById('drawing-coach-send-btn')
const coachInput = document.getElementById('drawing-coach-input')
const drawingDescInput = document.getElementById('drawing-desc-input')
const crossCheckBtn = document.getElementById('drawing-crosscheck-btn')
const crossCheckStatusEl = document.getElementById('drawing-crosscheck-status')
const crossCheckListEl = document.getElementById('drawing-crosscheck-list')
const reviewStepEl = document.getElementById('drawing-review-step')
const reviewBtn = document.getElementById('drawing-review-btn')
const reviewStatusEl = document.getElementById('drawing-review-status')
const reviewResultEl = document.getElementById('drawing-review-result')

/** @type {{ role: 'user' | 'assistant'; text: string }[]} */
let coachThread = []
let coachBusy = false

/** @type {{ focus: string, question: string, answer: string }[]} */
let crossCheckQuestions = []
/** 1단계 질문을 받은 시점의 도면 지문 — 학생이 도면을 고쳤는지 견주는 데 쓴다. */
let crossCheckFingerprint = ''
let crossCheckBusy = false
/** @type {{ goodPoint: string, checks: { criterion: string, level: string, comment: string }[], whereToLook: string[], nextStep: string } | null} */
let reviewResult = null
let reviewBusy = false

let isDrawing = false
let activePointerId = null
let currentTool = 'pen'
let currentColor = '#000000'
let currentBrushSize = 5
let lastX = 0
let lastY = 0

function allowTouchDrawing() {
  return Boolean(allowTouchDrawingInput?.checked)
}

/**
 * 그리기에 사용할 포인터인지 판별.
 * - 애플펜슬은 보통 pointerType === 'pen'
 * - iPad Safari/WebKit 일부 버전에서는 펜이 touch로 올라오는 경우가 있어 width/height(접촉 면적)로 보조 판별
 * - 손가락만 쓸 땐 체크박스로 터치 허용
 */
function isStrokePointer(e) {
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') return true
  if (e.pointerType === 'touch') {
    if (allowTouchDrawing()) return true
    const w = typeof e.width === 'number' ? e.width : 0
    const h = typeof e.height === 'number' ? e.height : 0
    if (w === 0 && h === 0) return true
    const maxSide = Math.max(w, h)
    if (maxSide > 0 && maxSide < 42) return true
  }
  return false
}

let documentStrokeListenersBound = false

function bindDocumentStrokeListeners() {
  if (documentStrokeListenersBound) return
  documentStrokeListenersBound = true
  document.addEventListener('pointermove', onDocumentPointerMove, { capture: true, passive: false })
  document.addEventListener('pointerup', onDocumentPointerUp, { capture: true, passive: false })
  document.addEventListener('pointercancel', onDocumentPointerUp, { capture: true, passive: false })
}

function unbindDocumentStrokeListeners() {
  if (!documentStrokeListenersBound) return
  documentStrokeListenersBound = false
  document.removeEventListener('pointermove', onDocumentPointerMove, { capture: true })
  document.removeEventListener('pointerup', onDocumentPointerUp, { capture: true })
  document.removeEventListener('pointercancel', onDocumentPointerUp, { capture: true })
}

function onDocumentPointerMove(e) {
  if (!isDrawing || e.pointerId !== activePointerId) return
  e.preventDefault()
  paintFromPointerEvent(e)
}

function onDocumentPointerUp(e) {
  if (e.pointerId !== activePointerId) return
  e.preventDefault()
  finishStroke(e)
}

function finishStroke(e) {
  unbindDocumentStrokeListeners()
  if (e) {
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch (_) {}
  }
  activePointerId = null
  isDrawing = false
  if (currentTool === 'eraser' && cursorPreview) {
    cursorPreview.style.display = 'none'
  }
}

// 캔버스 크기 설정
function resizeCanvas() {
  const container = canvas.parentElement
  canvas.width = container.clientWidth - 40
  canvas.height = Math.max(400, window.innerHeight * 0.5)
  
  // 배경을 흰색으로 설정
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  syncTextOverlay()
}

function syncTextOverlay() {
  if (!textOverlay) return
  textOverlay.style.left = `${canvas.offsetLeft}px`
  textOverlay.style.top = `${canvas.offsetTop}px`
  textOverlay.style.width = `${canvas.offsetWidth}px`
  textOverlay.style.height = `${canvas.offsetHeight}px`
}

function tryRestoreDrawingFromStorage() {
  const dataUrl = localStorage.getItem('studentDrawingRestore')
  if (!dataUrl || !canvas || !ctx) return
  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    const x = (canvas.width - w) / 2
    const y = (canvas.height - h) / 2
    ctx.drawImage(img, x, y, w, h)
  }
  img.onerror = () => {}
  img.src = dataUrl
}

resizeCanvas()
tryRestoreDrawingFromStorage()
window.addEventListener('resize', () => {
  resizeCanvas()
  tryRestoreDrawingFromStorage()
})

// 초기 커서 상태 설정
updateCursor()

// 선 두께 업데이트
brushSize.addEventListener('input', (e) => {
  currentBrushSize = parseInt(e.target.value)
  brushSizeValue.textContent = `${currentBrushSize}px`
  updateCursor()
})

// 커서 업데이트
function updateCursor() {
  if (currentTool === 'eraser') {
    const size = currentBrushSize * 2
    cursorPreview.style.width = `${size}px`
    cursorPreview.style.height = `${size}px`
    cursorPreview.style.display = 'block'
    canvas.style.cursor = 'none'
  } else if (currentTool === 'text') {
    cursorPreview.style.display = 'none'
    canvas.style.cursor = 'text'
  } else {
    cursorPreview.style.display = 'none'
    canvas.style.cursor = 'crosshair'
  }
}

// 색상 선택
colorInput.addEventListener('input', (e) => {
  currentColor = e.target.value
})

// 색상 프리셋
colorPresets.forEach(preset => {
  preset.addEventListener('click', () => {
    const color = preset.dataset.color
    currentColor = color
    colorInput.value = color
  })
})

// 도구 선택
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    toolButtons.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentTool = btn.dataset.tool
    updateCursor()
    updateTextModeUI()
  })
})

function updateTextModeUI() {
  const isText = currentTool === 'text'
  if (textControls) textControls.hidden = !isText
  if (!isText) {
    selectTextItem(null)
  }
}

if (textFontSizeInput) {
  textFontSizeInput.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10)
    if (!Number.isFinite(v)) return
    currentFontSize = v
    if (textFontSizeValue) textFontSizeValue.textContent = `${v}px`
    if (selectedTextItem) {
      selectedTextItem.size = v
      applyTextItemStyle(selectedTextItem)
    }
  })
}

function applyTextItemStyle(item) {
  item.el.style.fontSize = `${item.size}px`
  item.el.style.color = item.color
  item.el.style.left = `${item.x}px`
  item.el.style.top = `${item.y}px`
}

function selectTextItem(item) {
  if (selectedTextItem && selectedTextItem !== item) {
    selectedTextItem.el.classList.remove('selected')
    exitEditMode(selectedTextItem)
  }
  selectedTextItem = item
  if (item) {
    item.el.classList.add('selected')
    if (textFontSizeInput) {
      textFontSizeInput.value = String(item.size)
      if (textFontSizeValue) textFontSizeValue.textContent = `${item.size}px`
    }
  }
}

function deleteTextItem(item) {
  const idx = textItems.indexOf(item)
  if (idx >= 0) textItems.splice(idx, 1)
  item.el.remove()
  if (selectedTextItem === item) selectedTextItem = null
}

function enterEditMode(item) {
  item.contentEl.setAttribute('contenteditable', 'true')
  item.el.classList.add('editing')
  item.contentEl.focus()
  const range = document.createRange()
  range.selectNodeContents(item.contentEl)
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

function exitEditMode(item) {
  item.contentEl.setAttribute('contenteditable', 'false')
  item.el.classList.remove('editing')
}

function createTextItem(x, y, options = {}) {
  const id = ++textIdCounter
  const size = options.size ?? currentFontSize
  const color = options.color ?? currentColor
  const initialText = options.text ?? ''

  const el = document.createElement('div')
  el.className = 'text-item'
  el.dataset.id = String(id)
  el.style.fontFamily = TEXT_FONT_FAMILY
  el.style.lineHeight = String(TEXT_LINE_HEIGHT)

  const contentEl = document.createElement('div')
  contentEl.className = 'text-content'
  contentEl.setAttribute('contenteditable', 'false')
  contentEl.setAttribute('spellcheck', 'false')
  contentEl.textContent = initialText

  const deleteBtn = document.createElement('button')
  deleteBtn.type = 'button'
  deleteBtn.className = 'text-delete'
  deleteBtn.setAttribute('aria-label', '글씨 삭제')
  deleteBtn.textContent = '✕'

  el.appendChild(contentEl)
  el.appendChild(deleteBtn)
  textOverlay.appendChild(el)

  const item = { id, el, contentEl, x, y, size, color }
  applyTextItemStyle(item)
  textItems.push(item)

  bindTextItemEvents(item)
  return item
}

function bindTextItemEvents(item) {
  const { el, contentEl } = item

  // 클릭/터치로 선택, 드래그로 이동
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.text-delete')) return
    if (el.classList.contains('editing') && e.target.closest('.text-content')) {
      // 편집 중 텍스트 영역 안의 포인터 동작은 캐럿 이동에 양보
      return
    }
    e.preventDefault()
    e.stopPropagation()
    selectTextItem(item)

    const overlayRect = textOverlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const baseX = item.x
    const baseY = item.y
    const pointerId = e.pointerId
    let moved = false

    function onMove(ev) {
      if (ev.pointerId !== pointerId) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < 2) return
      moved = true
      const maxX = Math.max(0, overlayRect.width - el.offsetWidth)
      const maxY = Math.max(0, overlayRect.height - el.offsetHeight)
      item.x = Math.min(maxX, Math.max(0, baseX + dx))
      item.y = Math.min(maxY, Math.max(0, baseY + dy))
      applyTextItemStyle(item)
    }
    function onUp(ev) {
      if (ev.pointerId !== pointerId) return
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  })

  el.addEventListener('dblclick', (e) => {
    e.stopPropagation()
    selectTextItem(item)
    enterEditMode(item)
  })

  contentEl.addEventListener('blur', () => {
    exitEditMode(item)
    if (contentEl.textContent.trim() === '') {
      deleteTextItem(item)
    }
  })

  contentEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      contentEl.blur()
      return
    }
    // Enter: 글씨 완성(편집 종료). Shift+Enter는 줄바꿈으로 둔다.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      contentEl.blur()
    }
  })

  el.querySelector('.text-delete').addEventListener('click', (e) => {
    e.stopPropagation()
    deleteTextItem(item)
  })
}

// 캔버스 빈 영역 클릭으로 선택 해제, 글씨 도구일 땐 새 텍스트 생성
function getCanvasPointFromEvent(e) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  }
}

// 그림 업로드
if (uploadImageBtn && imageUploadInput) {
  uploadImageBtn.addEventListener('click', () => {
    imageUploadInput.click()
  })

  imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // 캔버스에 이미지 그리기 (캔버스 크기에 맞게 조정)
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height,
          1 // 원본보다 크게 하지 않음
        )
        
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2

        // 기존 내용 위에 이미지 그리기
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
    
    // 같은 파일을 다시 선택할 수 있도록 input 초기화
    e.target.value = ''
  })
}

// 전체 지우기
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (confirm('정말로 그림을 모두 지우시겠습니까?')) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      for (const item of [...textItems]) deleteTextItem(item)
    }
  })
}

function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function baseBrushWidth() {
  return currentTool === 'eraser' ? currentBrushSize * 2 : currentBrushSize
}

/** 애플펜슬 등: pressure(0~1)로 선 굵기 변화 */
function lineWidthForPointerEvent(e) {
  const base = baseBrushWidth()
  if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0 && e.pressure <= 1) {
    return Math.max(0.5, base * (0.2 + 0.8 * e.pressure))
  }
  return base
}

function strokeLineTo(x, y, lineWidth) {
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.strokeStyle = currentTool === 'pen' ? currentColor : '#ffffff'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  lastX = x
  lastY = y
}

function paintFromPointerEvent(e) {
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
  const list = events.length > 0 ? events : [e]
  for (const pe of list) {
    const pos = getPointerPos(pe)
    strokeLineTo(pos.x, pos.y, lineWidthForPointerEvent(pe))
  }
}

function onPointerDown(e) {
  if (e.button != null && e.button !== 0) return

  if (currentTool === 'text') {
    e.preventDefault()
    const pt = getCanvasPointFromEvent(e)
    const item = createTextItem(pt.x, pt.y, { text: '글씨' })
    selectTextItem(item)
    enterEditMode(item)
    return
  }

  if (!isStrokePointer(e)) return

  // 펜/지우개로 캔버스를 누르면 선택된 글씨를 해제
  selectTextItem(null)

  e.preventDefault()
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch (_) {
    /* 일부 브라우저 */
  }
  beginStrokeTracking(e)
}

function beginStrokeTracking(e) {
  activePointerId = e.pointerId
  isDrawing = true
  const pos = getPointerPos(e)
  lastX = pos.x
  lastY = pos.y
  bindDocumentStrokeListeners()
}

function onPointerMove(e) {
  if (isDrawing && e.pointerId === activePointerId) {
    return
  }
  if (!isDrawing && isStrokePointer(e)) {
    const pos = getPointerPos(e)
    updateCursorPosition(pos.x, pos.y)
  }
}

// 커서 위치 업데이트
function updateCursorPosition(x, y) {
  if (currentTool === 'eraser' && cursorPreview) {
    const rect = canvas.getBoundingClientRect()
    const container = canvas.parentElement
    cursorPreview.style.left = `${rect.left - container.getBoundingClientRect().left + x - (currentBrushSize * 2) / 2}px`
    cursorPreview.style.top = `${rect.top - container.getBoundingClientRect().top + y - (currentBrushSize * 2) / 2}px`
  }
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
canvas.addEventListener('pointermove', onPointerMove, { passive: false })
canvas.addEventListener('lostpointercapture', (e) => {
  if (e.pointerId !== activePointerId) return
  finishStroke(null)
})
canvas.addEventListener('pointerleave', (e) => {
  if (!isDrawing && currentTool === 'eraser' && cursorPreview) {
    cursorPreview.style.display = 'none'
  }
})

function escapeHtmlCoach(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

/** 답변에 남는 마크다운 굵게 표기(**) 제거 */
function stripCoachBoldMarkers(s) {
  return s.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*\*/g, '')
}

function isCanvasEffectivelyBlank() {
  if (!canvas?.width || !canvas?.height) return true
  const w = canvas.width
  const h = canvas.height
  const step = Math.max(2, Math.floor(Math.min(w, h) / 40))
  let data
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return false
  }
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 240) return false
      if (r < 248 || g < 248 || b < 248) return false
    }
  }
  return true
}

function downscaleDataUrlIfNeeded(dataUrl, maxSide = 1280) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width <= maxSide && height <= maxSide) {
        resolve(dataUrl)
        return
      }
      const scale = maxSide / Math.max(width, height)
      const nw = Math.round(width * scale)
      const nh = Math.round(height * scale)
      const c = document.createElement('canvas')
      c.width = nw
      c.height = nh
      const cctx = c.getContext('2d')
      if (!cctx) {
        resolve(dataUrl)
        return
      }
      cctx.drawImage(img, 0, 0, nw, nh)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function extractChatCompletionText(data) {
  const c = data?.choices?.[0]?.message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((p) => {
        if (typeof p === 'string') return p
        if (p?.type === 'text' && p.text) return p.text
        return ''
      })
      .join('')
  }
  return ''
}

function renderCoachMessages() {
  if (!coachMessagesEl) return
  if (coachThread.length === 0) {
    coachMessagesEl.innerHTML = ''
    return
  }
  coachMessagesEl.innerHTML = coachThread
    .map((m) => {
      const cls =
        m.role === 'user'
          ? 'drawing-coach-msg drawing-coach-msg--user'
          : 'drawing-coach-msg drawing-coach-msg--assistant'
      const raw = m.role === 'assistant' ? stripCoachBoldMarkers(m.text) : m.text
      return `<div class="${cls}">${escapeHtmlCoach(raw)}</div>`
    })
    .join('')
  coachMessagesEl.scrollTop = coachMessagesEl.scrollHeight
}

function setCoachBusy(busy) {
  coachBusy = busy
  if (coachSendBtn) coachSendBtn.disabled = busy
}

async function requestDrawingCoachReply(userText) {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const rawUrl = canvas.toDataURL('image/png')
  const imageUrl = await downscaleDataUrlIfNeeded(rawUrl, 1280)

  const url = resolveOpenAiChatCompletionsUrl()
  const system =
    '너는 중학교 발명 교육을 돕는 도우미다. 학생이 그린 발명품 스케치·도면을 보고, 아이디어를 전달·발표·제작할 때 부족할 수 있는 점을 구체적으로 알려준다. ' +
    '부품 이름·번호, 비율, 동작 방향, 재료, 단면·확대, 전체와의 관계 등을 예시로 들 수 있다. 비난하지 않고 격려하며 한국어 존댓말로 답한다.'
    '해당 내용 중 발명과 관련없는 내용은 설명하거나 말하지 않는다.'

  const messages = [{ role: 'system', content: system }]
  for (const turn of coachThread) {
    messages.push({ role: turn.role, content: turn.text })
  }
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: imageUrl } },
    ],
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages,
      max_tokens: 1400,
      temperature: 0.55,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API 오류 (${res.status}): ${errText.slice(0, 280)}`)
  }

  const data = await res.json()
  const out = extractChatCompletionText(data)
  if (!out.trim()) throw new Error('도우미 응답을 읽지 못했습니다.')
  return out.trim()
}

/** @param {string} userText */
async function runCoachTurn(userText) {
  if (!userText.trim() || coachBusy) return
  if (isCanvasEffectivelyBlank()) {
    alert('먼저 캔버스에 발명품을 그리거나 이미지를 올린 뒤 조언을 받아 보세요.')
    return
  }

  setCoachBusy(true)
  try {
    const reply = await requestDrawingCoachReply(userText.trim())
    coachThread.push({ role: 'user', text: userText.trim() }, { role: 'assistant', text: reply })
    renderCoachMessages()
  } catch (e) {
    const msg = e?.message || String(e)
    if (msg === 'NO_API_KEY') {
      alert('.env에 VITE_OPENAI_API_KEY를 설정해 주세요.')
    } else {
      console.error('drawing coach:', e)
      alert(msg.length > 400 ? `${msg.slice(0, 400)}…` : msg)
    }
  } finally {
    setCoachBusy(false)
  }
}

if (coachSendBtn && coachInput) {
  coachSendBtn.addEventListener('click', () => {
    const t = coachInput.value.trim()
    if (!t) {
      alert('질문을 입력해 주세요.')
      return
    }
    coachInput.value = ''
    void runCoachTurn(t)
  })
}

renderCoachMessages()

/* ── 그림과 설명 맞춰 보기 ───────────────────────────────────────────── */

const IDEA_DETAIL_FIELDS = [
  ['description', '상세 설명'],
  ['structureOrPrinciple', '구조·작동 원리'],
  ['features', '특징'],
  ['howToUse', '사용 방법'],
  ['materials', '준비물'],
  ['tools', '필요한 도구'],
  ['manufacturingSteps', '제작 순서'],
  ['manufacturing', '제작 방법'],
  ['expectedEffect', '기대 효과'],
]

function buildIdeaDetailText(idea) {
  if (!idea || typeof idea !== 'object') return ''
  const lines = []
  for (const [key, label] of IDEA_DETAIL_FIELDS) {
    const value = idea[key]
    if (Array.isArray(value)) {
      const items = value.map((v) => String(v).trim()).filter(Boolean)
      if (items.length) lines.push(`- ${label}: ${items.join(' / ')}`)
    } else if (value != null && String(value).trim()) {
      lines.push(`- ${label}: ${String(value).trim()}`)
    }
  }
  return stripCoachBoldMarkers(lines.join('\n'))
}

/** 4차시에서 고르고 구체화한 발명 이름과 내용을 읽어 온다. */
function readIdeaContext() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDEA_RESTORE_KEY) || 'null')
    if (!saved) return { ideaName: '', myIdea: '' }
    const selected = saved.selectedIdea || null
    const refinedList = Array.isArray(saved.refinedIdea)
      ? saved.refinedIdea
      : saved.refinedIdea
        ? [saved.refinedIdea]
        : []
    const refined = refinedList.length ? refinedList[refinedList.length - 1] : null
    return {
      ideaName: String(refined?.name || selected?.name || '').trim(),
      myIdea: buildIdeaDetailText(refined) || String(selected?.description || '').trim(),
    }
  } catch {
    return { ideaName: '', myIdea: '' }
  }
}

function readDrawingDesc() {
  return String(drawingDescInput?.value || '').trim()
}

/** 도면이 1단계 이후로 바뀌었는지 견주기 위한 값 */
function drawingFingerprint(dataUrl) {
  let hash = 5381
  for (let i = 0; i < dataUrl.length; i += 1) {
    hash = ((hash << 5) + hash + dataUrl.charCodeAt(i)) | 0
  }
  return `${dataUrl.length}:${hash}`
}

function setCheckStatus(el, message, mode = 'info') {
  if (!el) return
  el.textContent = message || ''
  el.dataset.mode = mode
  el.hidden = !message
}

function parseJsonFromAiText(text) {
  if (!text) return null
  let t = String(text).trim()
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const open = t.indexOf('{')
  const close = t.lastIndexOf('}')
  if (open >= 0 && close > open) t = t.slice(open, close + 1)
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

async function requestDrawingVisionJson(prompt) {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('NO_API_KEY')

  const imageUrl = await downscaleDataUrlIfNeeded(buildFlattenedImageDataUrl(), 1280)

  const res = await fetch(resolveOpenAiChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 1400,
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API 오류 (${res.status}): ${errText.slice(0, 200)}`)
  }

  const parsed = parseJsonFromAiText(extractChatCompletionText(await res.json()))
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 응답을 읽지 못했어요. 버튼을 다시 눌러 주세요.')
  }
  return parsed
}

function buildCrossCheckPrompt({ ideaName, myIdea, drawingDesc }) {
  return `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 자기 발명품을 직접 그리고, 그 그림에 대한 설명도 글로 썼어.
너는 그림과 글을 나란히 놓고 견주어 본 다음, 학생이 스스로 다시 살펴볼 수 있도록 질문 3개를 만들어 줘.

[학생의 발명 이름]
${ideaName || '(정보 없음)'}

[학생이 4차시에 자세히 쓴 발명 내용]
${myIdea || '(정보 없음)'}

[학생이 자기 그림에 대해 쓴 설명]
${drawingDesc || '(작성하지 않음)'}

함께 보낸 이미지가 학생이 직접 그린 도면이야.

[질문 규칙 — 매우 중요]
- 반드시 질문만 만들어. 무엇이 빠졌다거나 무엇이 잘못됐다고 네가 직접 말하지 마.
  답, 예시 답안, 고쳐야 할 것도 절대 알려 주지 마. 학생이 스스로 찾아야 해.
- 가장 중요한 일은 **글과 그림을 견주는 것**이야.
  글에는 있는데 그림에는 안 보이는 것, 그림에는 있는데 글에 설명이 없는 것,
  글과 그림이 서로 다르게 말하는 것을 찾아서 질문으로 만들어.
  · 예시 질문 형태: "설명에는 접어서 넣는다고 썼는데, 그림에서 접히는 곳은 어디일까요?"
- 3개 질문은 각각 다른 것을 살피게 해.
  1번은 글에 있는데 그림에서 찾기 어려운 부분
  2번은 그림에 있는데 글에서 설명하지 않은 부분
  3번은 다른 사람이 이 그림만 보고도 알 수 있을지
- 글과 그림이 잘 맞는다면, 억지로 어긋난 곳을 만들어 내지 마.
  대신 "다른 사람이 처음 봤을 때 무엇을 가장 궁금해할까요?"처럼
  한 걸음 더 나아가게 하는 질문으로 만들어.
- 학생이 쓴 표현을 질문 안에 그대로 넣어서, 이 발명에만 해당하는 질문으로 만들어.
- 한 질문은 한 문장, 45자 이내로 짧게.
- "예/아니오"로 끝나는 질문 대신, 어디인지 무엇인지 말하게 하는 질문으로 만들어.
${IMAGE_QUALITY}
${SCOPE_GUARD}
- 오늘 할 일은 "발명품 그리고 표현하기"까지야. 명세서를 쓰라는 이야기는 하지 마.
${KOREAN_ONLY}
- 질문은 존댓말 해요체로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "readable": true,
  "readNote": "그림이 잘 안 보이면 무엇이 안 보이는지 한 문장. 잘 보이면 빈 문자열",
  "questions": [
    { "focus": "글에는 있는데", "question": "질문 한 문장" },
    { "focus": "그림에는 있는데", "question": "질문 한 문장" },
    { "focus": "처음 보는 사람에게", "question": "질문 한 문장" }
  ]
}
그림이 흐려서 견주어 보기 어려우면 readable을 false로 두고, readNote에 이유를 적고, questions는 빈 배열로 둬.`
}

function buildDrawingReviewPrompt({ ideaName, myIdea, drawingDesc, answerText }) {
  return `너는 대한민국 중학생의 발명 학습을 돕는 발명 보조교사야.
학생이 자기 발명품을 그리고 한 번 고쳤어. 이제 이 도면으로 다른 사람에게 아이디어를 전하고
실제로 만들어 볼 수 있을지, 세 가지를 차례로 살펴보고 어디를 어떻게 손보면 좋을지 알려 줘.

[학생의 발명 이름]
${ideaName || '(정보 없음)'}

[학생이 4차시에 자세히 쓴 발명 내용]
${myIdea || '(정보 없음)'}

[학생이 자기 그림에 대해 쓴 설명]
${drawingDesc || '(작성하지 않음)'}

[학생이 앞서 스스로 살펴본 내용]
${answerText}

함께 보낸 이미지가 학생이 그린 도면이야.

[살펴볼 세 가지]
1. 자리 배치 — 부품들이 놓인 자리가 서로 이치에 맞는가
   (예: 손으로 잡는 곳과 뜨거워지는 곳이 붙어 있지는 않은지)
2. 만들 수 있는 구조인가 — 실제로는 그렇게 될 수 없는 모양은 없는가
   (예: 지지하는 것 없이 공중에 떠 있거나, 서로 통과해 지나가는 부분)
3. 빠진 부품 — 이 발명이 설명대로 움직이려면 있어야 하는데 그림에 없는 것은 무엇인가

[안내 규칙 — 매우 중요]
- 세 가지마다 "괜찮아요 / 다시 볼까요" 중 하나로 표시하고, 왜 그렇게 봤는지 한 문장으로 설명해.
- "다시 볼까요"일 때는 **어디를** 살펴보면 좋을지와 **무엇을 정해야 하는지**만 알려 줘.
  어떻게 그리라고 대신 정해 주거나, 완성된 모양을 제시하지 마. 고쳐 그리는 건 학생이 할 일이야.
  · 좋은 예: "손잡이와 뜨거워지는 부분이 붙어 있어요. 둘 사이를 어떻게 떼어 놓을지 생각해 볼까요?"
  · 나쁜 예: "손잡이를 오른쪽으로 3센티미터 옮기고 나무로 감싸세요."
- 예로 들 수 있는 것: 부품 이름과 번호, 크기 비율, 움직이는 방향, 재료, 잘라 본 모습이나 확대한 모습,
  부분과 전체의 관계. 이 중 이 도면에 필요한 것만 골라서 말해.
- 비난하지 말고 격려하는 말투로 써. 잘된 곳이 있으면 먼저 짚어 줘.
- 학생이 쓴 설명이 짧고 단순하면 안내도 짧고 쉽게, 자세하면 그만큼 자세하게 맞춰서 써.
- 점수, 등급, 순위는 말하지 마.
${IMAGE_QUALITY}
${SCOPE_GUARD}
- 오늘 할 일은 "발명품 그리고 표현하기"까지야. 명세서를 쓰라는 이야기는 하지 마.
${KOREAN_ONLY}
- 모든 문장은 존댓말 해요체로 써.

[응답 형식 — 아래 JSON만 출력, 한글만 사용]
{
  "readable": true,
  "readNote": "그림이 잘 안 보이면 이유 한 문장. 잘 보이면 빈 문자열",
  "goodPoint": "이 도면에서 잘된 곳 한 문장",
  "checks": [
    { "criterion": "자리 배치", "level": "괜찮아요", "comment": "한 문장 설명" },
    { "criterion": "만들 수 있는 구조", "level": "다시 볼까요", "comment": "한 문장 설명" },
    { "criterion": "빠진 부품", "level": "다시 볼까요", "comment": "한 문장 설명" }
  ],
  "whereToLook": ["어디를 살펴보고 무엇을 정하면 좋을지 한 문장", "..."],
  "nextStep": "다음에 할 일 한 문장"
}
그림이 흐려서 살펴보기 어려우면 readable을 false로 두고 readNote에 이유를 적어.`
}

function isCrossCheckAnswered() {
  return (
    crossCheckQuestions.length > 0 &&
    crossCheckQuestions.every((q) => String(q.answer || '').trim())
  )
}

function handleCrossCheckAnswerInput(event) {
  const index = Number.parseInt(event.target.dataset.index, 10)
  if (!Number.isInteger(index) || !crossCheckQuestions[index]) return
  crossCheckQuestions[index].answer = event.target.value
  refreshReviewStep()
  persistDrawingCheck()
}

function renderCrossCheckQuestions() {
  if (!crossCheckListEl) return
  crossCheckListEl.innerHTML = crossCheckQuestions
    .map(
      (q, i) => `
        <div class="drawing-check-item">
          <span class="drawing-check-index">${i + 1}</span>
          <div class="drawing-check-body">
            ${q.focus ? `<span class="drawing-check-focus">${escapeHtmlCoach(q.focus)}</span>` : ''}
            <p class="drawing-check-question">${escapeHtmlCoach(q.question)}</p>
            <label class="sr-only" for="drawing-check-answer-${i}">${escapeHtmlCoach(q.question)}에 대한 내 생각</label>
            <textarea
              id="drawing-check-answer-${i}"
              class="drawing-check-answer"
              data-index="${i}"
              rows="3"
              placeholder="그림에서 찾아본 내용을 적어 보세요."
            >${escapeHtmlCoach(q.answer || '')}</textarea>
          </div>
        </div>
      `
    )
    .join('')

  for (const el of crossCheckListEl.querySelectorAll('.drawing-check-answer')) {
    el.addEventListener('input', handleCrossCheckAnswerInput)
  }

  if (crossCheckBtn) {
    crossCheckBtn.textContent = crossCheckQuestions.length > 0 ? '질문 다시 받기' : '점검 질문 받기'
  }
  refreshReviewStep()
}

function refreshReviewStep() {
  if (reviewStepEl) reviewStepEl.hidden = crossCheckQuestions.length === 0
  if (reviewBtn) reviewBtn.disabled = reviewBusy || !isCrossCheckAnswered()
  if (crossCheckQuestions.length === 0 || reviewBusy || reviewResult) return
  setCheckStatus(
    reviewStatusEl,
    isCrossCheckAnswered()
      ? '답한 내용을 살려 도면을 고친 뒤에 [고친 도면 검토받기]를 눌러 주세요.'
      : '세 질문에 모두 답하면 검토를 받을 수 있어요.',
    isCrossCheckAnswered() ? 'info' : 'warn'
  )
}

function renderReviewResult() {
  if (!reviewResultEl) return
  if (!reviewResult) {
    reviewResultEl.innerHTML = ''
    return
  }

  const { goodPoint, checks, whereToLook, nextStep } = reviewResult
  const checksHtml = checks
    .map((c) => {
      const again = c.level === '다시 볼까요'
      return `
        <li class="drawing-review-check${again ? ' is-again' : ''}">
          <div class="drawing-review-check-head">
            <span class="drawing-review-criterion">${escapeHtmlCoach(c.criterion)}</span>
            <span class="drawing-review-level">${escapeHtmlCoach(c.level)}</span>
          </div>
          <p class="drawing-review-comment">${escapeHtmlCoach(c.comment)}</p>
        </li>
      `
    })
    .join('')

  reviewResultEl.innerHTML = `
    ${goodPoint ? `<p class="drawing-review-good">잘된 곳: ${escapeHtmlCoach(goodPoint)}</p>` : ''}
    ${checksHtml ? `<ul class="drawing-review-checks">${checksHtml}</ul>` : ''}
    ${
      whereToLook.length
        ? `<div class="drawing-review-where">
            <h4>어디를 살펴볼까요</h4>
            <ul>${whereToLook.map((w) => `<li>${escapeHtmlCoach(w)}</li>`).join('')}</ul>
          </div>`
        : ''
    }
    ${nextStep ? `<p class="drawing-review-next">다음 할 일: ${escapeHtmlCoach(nextStep)}</p>` : ''}
  `
}

async function generateCrossCheckQuestions() {
  if (crossCheckBusy) return

  if (isCanvasEffectivelyBlank()) {
    setCheckStatus(crossCheckStatusEl, '먼저 캔버스에 발명품을 그려 주세요.', 'warn')
    return
  }
  const drawingDesc = readDrawingDesc()
  if (!drawingDesc) {
    setCheckStatus(
      crossCheckStatusEl,
      '먼저 위에 내 그림 설명을 써 주세요. 그 설명과 그림을 견주어 질문을 만들어요.',
      'warn'
    )
    drawingDescInput?.focus()
    return
  }
  if (
    crossCheckQuestions.some((q) => String(q.answer || '').trim()) &&
    !confirm('질문을 새로 받으면 지금 적은 답변이 지워져요. 계속할까요?')
  ) {
    return
  }

  crossCheckBusy = true
  if (crossCheckBtn) crossCheckBtn.disabled = true
  setCheckStatus(crossCheckStatusEl, '그림과 설명을 견주어 보는 중입니다…', 'info')

  try {
    const { ideaName, myIdea } = readIdeaContext()
    const parsed = await requestDrawingVisionJson(
      buildCrossCheckPrompt({ ideaName, myIdea, drawingDesc })
    )

    if (parsed.readable === false) {
      setCheckStatus(
        crossCheckStatusEl,
        String(parsed.readNote || '').trim() ||
          '그림이 잘 보이지 않아요. 선을 더 진하게 그린 뒤 다시 눌러 주세요.',
        'warn'
      )
      return
    }

    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .filter((q) => q && typeof q.question === 'string' && q.question.trim())
      .slice(0, 3)
      .map((q) => ({
        focus: String(q.focus || '').trim(),
        question: q.question.trim(),
        answer: '',
      }))

    if (questions.length === 0) {
      throw new Error('질문을 받지 못했어요. 버튼을 다시 눌러 주세요.')
    }

    crossCheckQuestions = questions
    crossCheckFingerprint = drawingFingerprint(buildFlattenedImageDataUrl())
    reviewResult = null
    renderReviewResult()
    renderCrossCheckQuestions()
    setCheckStatus(
      crossCheckStatusEl,
      '질문이 도착했어요. 그림을 보면서 천천히 답해 보세요.',
      'success'
    )
    persistDrawingCheck()
  } catch (error) {
    console.error('도면 대조 점검 질문 생성 오류:', error)
    setCheckStatus(
      crossCheckStatusEl,
      error?.message === 'NO_API_KEY'
        ? '.env에 VITE_OPENAI_API_KEY를 설정해 주세요.'
        : error?.message || '질문을 만들지 못했어요. 다시 시도해 주세요.',
      'error'
    )
  } finally {
    crossCheckBusy = false
    if (crossCheckBtn) crossCheckBtn.disabled = false
  }
}

async function requestRevisedDrawingReview() {
  if (reviewBusy) return

  if (!isCrossCheckAnswered()) {
    setCheckStatus(reviewStatusEl, '세 질문에 모두 답한 뒤에 검토를 받을 수 있어요.', 'warn')
    return
  }
  if (isCanvasEffectivelyBlank()) {
    setCheckStatus(reviewStatusEl, '캔버스가 비어 있어요. 도면을 먼저 그려 주세요.', 'warn')
    return
  }
  if (
    crossCheckFingerprint &&
    drawingFingerprint(buildFlattenedImageDataUrl()) === crossCheckFingerprint
  ) {
    setCheckStatus(
      reviewStatusEl,
      '도면이 아직 그대로예요. 답한 내용을 살려 한 번 고친 뒤에 눌러 주세요.',
      'warn'
    )
    return
  }

  reviewBusy = true
  if (reviewBtn) reviewBtn.disabled = true
  setCheckStatus(reviewStatusEl, '고친 도면을 살펴보는 중입니다…', 'info')

  try {
    const { ideaName, myIdea } = readIdeaContext()
    const answerText = crossCheckQuestions
      .map((q, i) => `${i + 1}. ${q.question}\n→ ${String(q.answer || '').trim()}`)
      .join('\n')

    const parsed = await requestDrawingVisionJson(
      buildDrawingReviewPrompt({
        ideaName,
        myIdea,
        drawingDesc: readDrawingDesc(),
        answerText,
      })
    )

    if (parsed.readable === false) {
      setCheckStatus(
        reviewStatusEl,
        String(parsed.readNote || '').trim() ||
          '그림이 잘 보이지 않아요. 선을 더 진하게 그린 뒤 다시 눌러 주세요.',
        'warn'
      )
      return
    }

    reviewResult = {
      goodPoint: String(parsed.goodPoint || '').trim(),
      checks: (Array.isArray(parsed.checks) ? parsed.checks : [])
        .filter((c) => c && typeof c.criterion === 'string' && c.criterion.trim())
        .slice(0, 3)
        .map((c) => ({
          criterion: c.criterion.trim(),
          level: String(c.level || '').trim() === '다시 볼까요' ? '다시 볼까요' : '괜찮아요',
          comment: String(c.comment || '').trim(),
        })),
      whereToLook: (Array.isArray(parsed.whereToLook) ? parsed.whereToLook : [])
        .map((w) => String(w).trim())
        .filter(Boolean),
      nextStep: String(parsed.nextStep || '').trim(),
    }

    renderReviewResult()
    setCheckStatus(reviewStatusEl, '검토가 도착했어요. 아래 내용을 보고 도면을 다듬어 보세요.', 'success')
    persistDrawingCheck()
  } catch (error) {
    console.error('고친 도면 검토 오류:', error)
    setCheckStatus(
      reviewStatusEl,
      error?.message === 'NO_API_KEY'
        ? '.env에 VITE_OPENAI_API_KEY를 설정해 주세요.'
        : error?.message || '검토를 받지 못했어요. 다시 시도해 주세요.',
      'error'
    )
  } finally {
    reviewBusy = false
    if (reviewBtn) reviewBtn.disabled = !isCrossCheckAnswered()
  }
}

function buildDrawingCheckPayload() {
  return {
    description: readDrawingDesc(),
    selfCheck: crossCheckQuestions.map((q) => ({
      focus: q.focus,
      question: q.question,
      answer: String(q.answer || '').trim(),
    })),
    review: reviewResult,
  }
}

function persistDrawingCheck() {
  try {
    localStorage.setItem(DRAWING_CHECK_KEY, JSON.stringify(buildDrawingCheckPayload()))
  } catch (_) {}
}

function restoreDrawingCheck() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(DRAWING_CHECK_KEY) || 'null')
  } catch (_) {
    saved = null
  }
  if (!saved || typeof saved !== 'object') {
    renderCrossCheckQuestions()
    return
  }

  if (drawingDescInput && typeof saved.description === 'string') {
    drawingDescInput.value = saved.description
  }
  crossCheckQuestions = (Array.isArray(saved.selfCheck) ? saved.selfCheck : [])
    .filter((q) => q && typeof q.question === 'string' && q.question.trim())
    .map((q) => ({
      focus: String(q.focus || '').trim(),
      question: q.question.trim(),
      answer: typeof q.answer === 'string' ? q.answer : '',
    }))
  reviewResult =
    saved.review && typeof saved.review === 'object'
      ? {
          goodPoint: String(saved.review.goodPoint || ''),
          checks: Array.isArray(saved.review.checks) ? saved.review.checks : [],
          whereToLook: Array.isArray(saved.review.whereToLook) ? saved.review.whereToLook : [],
          nextStep: String(saved.review.nextStep || ''),
        }
      : null

  renderCrossCheckQuestions()
  renderReviewResult()
}

if (drawingDescInput) {
  drawingDescInput.addEventListener('input', persistDrawingCheck)
}

if (crossCheckBtn) {
  crossCheckBtn.addEventListener('click', () => {
    void generateCrossCheckQuestions()
  })
}

if (reviewBtn) {
  reviewBtn.addEventListener('click', () => {
    void requestRevisedDrawingReview()
  })
}

restoreDrawingCheck()

/**
 * 캔버스 그림 + 텍스트 오버레이를 합쳐 PNG 데이터 URL을 만든다.
 * 텍스트는 굴림체로 통일해서 그립니다.
 */
function buildFlattenedImageDataUrl() {
  const merged = document.createElement('canvas')
  merged.width = canvas.width
  merged.height = canvas.height
  const mctx = merged.getContext('2d')
  if (!mctx) return canvas.toDataURL('image/png')

  mctx.drawImage(canvas, 0, 0)

  const scaleX = canvas.width / Math.max(1, canvas.offsetWidth)
  const scaleY = canvas.height / Math.max(1, canvas.offsetHeight)
  const scale = (scaleX + scaleY) / 2

  for (const item of textItems) {
    const text = item.contentEl.textContent || ''
    if (!text.trim()) continue
    const px = Math.round(item.size * scale)
    mctx.fillStyle = item.color || '#000000'
    mctx.font = `${px}px ${TEXT_FONT_FAMILY}`
    mctx.textBaseline = 'top'
    const lines = text.split('\n')
    const lineHeight = px * TEXT_LINE_HEIGHT
    // .text-content 패딩(2px 4px)을 보정
    const padX = 4 * scaleX
    const padY = 2 * scaleY
    const baseX = item.x * scaleX + padX
    const baseY = item.y * scaleY + padY
    lines.forEach((line, i) => {
      mctx.fillText(line, baseX, baseY + i * lineHeight)
    })
  }
  return merged.toDataURL('image/png')
}

// 그림 저장하기
saveDrawingBtn.addEventListener('click', async () => {
  try {
    selectTextItem(null)
    const imageData = buildFlattenedImageDataUrl()

    const check = buildDrawingCheckPayload()

    // Firebase에 활동 저장
    await saveStudentActivity('drawing', {
      image: imageData,
      description: check.description,
      selfCheck: check.selfCheck,
      review: check.review,
      timestamp: new Date().toISOString()
    })
    
    alert('그림이 저장되었습니다!')
  } catch (error) {
    console.error('그림 저장 오류:', error)
    alert('그림 저장 중 오류가 발생했습니다.')
  }
})

// 그림 다운로드
downloadDrawingBtn.addEventListener('click', () => {
  selectTextItem(null)
  const link = document.createElement('a')
  link.download = `발명품-그림-${new Date().toISOString().split('T')[0]}.png`
  link.href = buildFlattenedImageDataUrl()
  link.click()
})

listenForWorkbenchFlushRequest(() => {
  if (!canvas || !ctx) return
  persistDrawingCheck()
  try {
    localStorage.setItem('studentDrawingRestore', buildFlattenedImageDataUrl())
  } catch (_) {}
})

