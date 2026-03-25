import { mountStudentPdfAnalysis } from './studentPdfAnalysisApp.js'

mountStudentPdfAnalysis(document.querySelector('#app'), {
  heading: '명세서 쉽게 이해하기',
  subtitle: '명세서 파일을 받아 업로드 해주세요!',
})
