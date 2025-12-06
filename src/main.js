import './main.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="main-container">
    <div class="main-card">
      <header>
        <h1>발명 아이디어 프로젝트 도우미</h1>
        <p class="subtitle">명세서 분석부터 아이디어 창출까지</p>
      </header>

      <div class="action-buttons">
        <button id="student-btn" class="action-btn student-btn">
          <div class="btn-icon">👨‍🎓</div>
          <div class="btn-content">
            <h2>학생활동</h2>
            <p>학생용 활동 페이지로 이동</p>
          </div>
        </button>

        <button id="teacher-btn" class="action-btn teacher-btn">
          <div class="btn-icon">👩‍🏫</div>
          <div class="btn-content">
            <h2>교사 모니터링</h2>
            <p>교사용 모니터링 페이지로 이동</p>
          </div>
        </button>
      </div>
    </div>
  </div>
`

const studentBtn = document.querySelector('#student-btn')
const teacherBtn = document.querySelector('#teacher-btn')

studentBtn.addEventListener('click', () => {
  localStorage.setItem('userRole', 'student')
  window.location.href = 'login.html?role=student'
})

teacherBtn.addEventListener('click', () => {
  localStorage.setItem('userRole', 'teacher')
  window.location.href = 'teacher.html'
})
