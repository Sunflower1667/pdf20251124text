import { mountStudentPdfAnalysis } from './studentPdfAnalysisApp.js'

mountStudentPdfAnalysis(document.querySelector('#ai-app'), {
  heading: '명세서 탐색하기',
  subtitle:
    '오른쪽에서 PDF를 올린 뒤, 왼쪽에서 보조교사와 대화·생각 정리를 한 다음 [명세서 분석하기]로 AI 요약을 확인해 보세요.',
  showCoachPanel: true,
})
