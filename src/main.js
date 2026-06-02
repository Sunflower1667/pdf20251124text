import './main.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="main-container">
    <div class="main-card">
      <header>
        <h1>스마트 팅커(Smart Tinker)</h1>
        <p class="subtitle">나만의 발명 아이디어, 같이 찾아보자!</p>
      </header>

      <div class="action-buttons">
        <div class="action-group">
          <div class="action-icon" aria-hidden="true">👨‍🎓</div>
          <button id="student-btn" class="action-btn student-btn">
            학생으로 시작하기
          </button>
        </div>

        <div class="action-group">
          <div class="action-icon" aria-hidden="true">👩‍🏫</div>
          <button id="teacher-btn" class="action-btn teacher-btn">
            선생님 화면으로 가기
          </button>
        </div>
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
