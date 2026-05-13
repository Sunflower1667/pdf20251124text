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

const COACH_ANALYZE_PROMPT =
  '이 그림을 발명품 도면으로 봤을 때, 다른 사람이 이해하거나 만들어 보기에 부족한 점을 항목으로 나눠 알려줘. (비난 없이 격려하는 존댓말로)'

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
        <button id="save-drawing-btn" type="button">그림 저장하기</button>
        <button id="download-drawing-btn" type="button">그림 다운로드</button>
      </div>
    </section>
    </div>

    <aside class="drawing-coach" aria-label="그림 도우미">
      <div class="drawing-coach-head">
        <h2>그림 도우미</h2>
        <p class="drawing-coach-lead">
          여러분이 그린 도면이 발명품을 이해하고 설명하기에 충분한지 확인해봅시다. 여러분이 어려워하는 부분, 놓친 부분을 알려줄께요
        </p>
      </div>
      <div id="drawing-coach-messages" class="drawing-coach-messages" role="log" aria-live="polite"></div>
      <div class="drawing-coach-actions">
        <button type="button" id="drawing-coach-analyze-btn" class="drawing-coach-primary-btn">
          나의 그림 확인하기
        </button>
      </div>
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
const coachAnalyzeBtn = document.getElementById('drawing-coach-analyze-btn')
const coachSendBtn = document.getElementById('drawing-coach-send-btn')
const coachInput = document.getElementById('drawing-coach-input')

/** @type {{ role: 'user' | 'assistant'; text: string; hideInUi?: boolean }[]} */
let coachThread = []
let coachBusy = false

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
    .filter((m) => !m.hideInUi)
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
  if (coachAnalyzeBtn) coachAnalyzeBtn.disabled = busy
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

/**
 * @param {string} userText
 * @param {{ hideUserMessage?: boolean }} [opts]
 */
async function runCoachTurn(userText, opts = {}) {
  if (!userText.trim() || coachBusy) return
  if (isCanvasEffectivelyBlank()) {
    alert('먼저 캔버스에 발명품을 그리거나 이미지를 올린 뒤 조언을 받아 보세요.')
    return
  }

  setCoachBusy(true)
  try {
    const reply = await requestDrawingCoachReply(userText.trim())
    const userEntry = { role: 'user', text: userText.trim() }
    if (opts.hideUserMessage) userEntry.hideInUi = true
    coachThread.push(userEntry, { role: 'assistant', text: reply })
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

if (coachAnalyzeBtn) {
  coachAnalyzeBtn.addEventListener('click', () => {
    void runCoachTurn(COACH_ANALYZE_PROMPT, { hideUserMessage: true })
  })
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

    // Firebase에 활동 저장
    await saveStudentActivity('drawing', { 
      image: imageData,
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
  try {
    localStorage.setItem('studentDrawingRestore', buildFlattenedImageDataUrl())
  } catch (_) {}
})

