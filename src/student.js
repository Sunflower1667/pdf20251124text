import './student.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="student-dashboard">
    <header class="dashboard-header">
      <h1>학생 활동 대시보드</h1>
      <p class="subtitle">세 가지 활동을 한눈에 확인하세요</p>
      <button id="back-btn" class="back-btn">← 메인으로 돌아가기</button>
    </header>

    <div class="pages-container">
      <div class="page-section">
        <div class="page-header">
          <h2>1. 명세서 쉽게 이해하기</h2>
          <button class="fullscreen-btn" data-page="student1" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="student1-frame"
          src="student1.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>

      <div class="page-section">
        <div class="page-header">
          <h2>2. 발명 아이디어 창출</h2>
          <button class="fullscreen-btn" data-page="idea" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="idea-frame"
          src="idea.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>

      <div class="page-section">
        <div class="page-header">
          <h2>3. 오늘 활동 소감</h2>
          <button class="fullscreen-btn" data-page="reflection" title="전체 화면">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <iframe 
          id="reflection-frame"
          src="reflection.html" 
          class="page-frame"
          frameborder="0"
          loading="lazy"
        ></iframe>
      </div>
    </div>
  </div>
`

const backBtn = document.querySelector('#back-btn')
const fullscreenBtns = document.querySelectorAll('.fullscreen-btn')

// 메인으로 돌아가기
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html'
})

// 전체 화면 버튼 클릭 이벤트
fullscreenBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.getAttribute('data-page')
    let url = ''
    
    switch(page) {
      case 'student1':
        url = 'student1.html'
        break
      case 'idea':
        url = 'idea.html'
        break
      case 'reflection':
        url = 'reflection.html'
        break
    }
    
    if (url) {
      window.open(url, '_blank')
    }
  })
})

