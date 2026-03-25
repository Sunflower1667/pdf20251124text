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
const colorPresets = document.querySelectorAll('.color-preset')
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]')

let isDrawing = false
let currentTool = 'pen'
let currentColor = '#000000'
let currentBrushSize = 5
let lastX = 0
let lastY = 0

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

// 마우스 이벤트
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

function startDrawing(e) {
  isDrawing = true
  const pos = getMousePos(e)
  lastX = pos.x
  lastY = pos.y
}

function draw(e) {
  if (!isDrawing) return

  const pos = getMousePos(e)
  updateCursorPosition(pos.x, pos.y)

  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  
  if (currentTool === 'pen') {
    ctx.strokeStyle = currentColor
    ctx.lineWidth = currentBrushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  } else if (currentTool === 'eraser') {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = currentBrushSize * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  
  ctx.stroke()

  lastX = pos.x
  lastY = pos.y
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

function stopDrawing() {
  isDrawing = false
}

// 터치 이벤트 지원
function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect()
  const touch = e.touches[0] || e.changedTouches[0]
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  }
}

function startDrawingTouch(e) {
  e.preventDefault()
  isDrawing = true
  const pos = getTouchPos(e)
  lastX = pos.x
  lastY = pos.y
}

function drawTouch(e) {
  e.preventDefault()
  if (!isDrawing) return

  const pos = getTouchPos(e)

  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  
  if (currentTool === 'pen') {
    ctx.strokeStyle = currentColor
    ctx.lineWidth = currentBrushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  } else if (currentTool === 'eraser') {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = currentBrushSize * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  
  ctx.stroke()

  lastX = pos.x
  lastY = pos.y
}

function stopDrawingTouch() {
  isDrawing = false
}

// 마우스 이벤트
canvas.addEventListener('mousedown', startDrawing)
canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) {
    const pos = getMousePos(e)
    updateCursorPosition(pos.x, pos.y)
  }
  draw(e)
})
canvas.addEventListener('mouseup', stopDrawing)
canvas.addEventListener('mouseleave', () => {
  stopDrawing()
  if (currentTool === 'eraser') {
    cursorPreview.style.display = 'none'
  }
})

// 터치 이벤트
canvas.addEventListener('touchstart', startDrawingTouch)
canvas.addEventListener('touchmove', drawTouch)
canvas.addEventListener('touchend', stopDrawingTouch)

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

