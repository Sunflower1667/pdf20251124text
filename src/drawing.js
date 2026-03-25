import './drawing.css'
import { saveStudentActivity } from './activityStorage.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="shell">
    <header>
      <h1>발명품 표현하기</h1>
      <p class="subtitle">만들고 싶은 발명품을 직접 그려보세요!</p>
    </header>

    <section class="drawing-section">
      <div class="drawing-tools">
        <div class="tool-group">
          <label>도구</label>
          <div class="tool-buttons">
            <button id="upload-image-btn" class="tool-btn">📷 그림 업로드</button>
            <input type="file" id="image-upload-input" accept="image/*" style="display: none;" />
            <button id="pen-tool" class="tool-btn active" data-tool="pen">✏️ 펜</button>
            <button id="eraser-tool" class="tool-btn" data-tool="eraser">🧹 지우개</button>
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

        <label class="pen-input-hint">
          <input type="checkbox" id="allow-touch-drawing" />
          <span>손가락(터치)으로도 그리기 — 끄면 애플펜슬·스타일러스·마우스만 인식해 손바닥 오인식을 줄입니다.</span>
        </label>
      </div>

      <div class="canvas-container">
        <canvas id="drawing-canvas"></canvas>
        <div id="cursor-preview" class="cursor-preview"></div>
      </div>

      <div class="drawing-actions">
        <button id="save-drawing-btn" type="button">그림 저장하기</button>
        <button id="download-drawing-btn" type="button">그림 다운로드</button>
      </div>
    </section>
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

/** 펜·마우스는 항상 허용. 손/손가락은 옵션 켰을 때만 (애플펜슬은 pointerType === 'pen'). */
function isStrokePointer(e) {
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') return true
  if (e.pointerType === 'touch' && allowTouchDrawing()) return true
  return false
}

// 캔버스 크기 설정
function resizeCanvas() {
  const container = canvas.parentElement
  canvas.width = container.clientWidth - 40
  canvas.height = Math.max(400, window.innerHeight * 0.5)
  
  // 배경을 흰색으로 설정
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
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
  })
})

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
  if (!isStrokePointer(e)) return
  if (e.button != null && e.button !== 0) return
  e.preventDefault()
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch (_) {
    /* 일부 브라우저 */
  }
  activePointerId = e.pointerId
  isDrawing = true
  const pos = getPointerPos(e)
  lastX = pos.x
  lastY = pos.y
}

function onPointerMove(e) {
  if (!isDrawing || e.pointerId !== activePointerId) {
    if (!isDrawing && isStrokePointer(e)) {
      const pos = getPointerPos(e)
      updateCursorPosition(pos.x, pos.y)
    }
    return
  }
  e.preventDefault()
  paintFromPointerEvent(e)
}

function endStroke(e) {
  if (activePointerId == null) return
  if (e && e.pointerId !== activePointerId) return
  try {
    if (e) canvas.releasePointerCapture(e.pointerId)
  } catch (_) {}
  activePointerId = null
  isDrawing = false
  if (currentTool === 'eraser' && cursorPreview) {
    cursorPreview.style.display = 'none'
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

canvas.addEventListener('pointerdown', onPointerDown)
canvas.addEventListener('pointermove', onPointerMove)
canvas.addEventListener('pointerup', endStroke)
canvas.addEventListener('pointercancel', endStroke)
canvas.addEventListener('lostpointercapture', () => {
  activePointerId = null
  isDrawing = false
  if (currentTool === 'eraser' && cursorPreview) cursorPreview.style.display = 'none'
})
canvas.addEventListener('pointerleave', (e) => {
  if (!canvas.hasPointerCapture(e.pointerId)) {
    endStroke(e)
  }
  if (!isDrawing && currentTool === 'eraser' && cursorPreview) {
    cursorPreview.style.display = 'none'
  }
})

// 그림 저장하기
saveDrawingBtn.addEventListener('click', async () => {
  try {
    const imageData = canvas.toDataURL('image/png')
    
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
  const link = document.createElement('a')
  link.download = `발명품-그림-${new Date().toISOString().split('T')[0]}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
})

