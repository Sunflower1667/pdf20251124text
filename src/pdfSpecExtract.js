import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf'
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url'

GlobalWorkerOptions.workerSrc = pdfWorker

/**
 * @param {ArrayBuffer | Uint8Array} data
 * @returns {Promise<string>}
 */
export async function extractTextFromPdfBuffer(data) {
  const pdf = await getDocument({ data }).promise
  const chunks = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text) {
      chunks.push(`--- Page ${pageNumber} ---\n${text}`)
    }
  }

  if (typeof pdf.cleanup === 'function') {
    pdf.cleanup()
  }

  return chunks.join('\n\n')
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromPdfFile(file) {
  const buffer = await file.arrayBuffer()
  return extractTextFromPdfBuffer(buffer)
}
