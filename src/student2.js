import { mountStudentPdfAnalysis } from './studentPdfAnalysisApp.js'

mountStudentPdfAnalysis(document.querySelector('#ai-app'), {
  heading: '명세서 탐색하기',
  subtitle: '명세서 PDF를 업로드하면 [명세서 분석하기]로 요약 정리를 받을 수 있어요.',
})
