/**
 * 프롬프트 모듈(`src/prompts/*.js`)이 공용으로 쓰는 OpenAI 호출 유틸.
 * 프롬프트는 JSON 한 덩어리만 출력하도록 작성하고, 여기서 파싱까지 끝냅니다.
 */

const OPENAI_URL = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

/** 한자·일본어를 지우고 줄바꿈은 살린 채 공백만 정리한다. */
export function cleanKoreanText(text) {
  if (text == null) return ''
  return String(text)
    .replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '')
    .replace(/[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractAiText(result) {
  if (!result) return null

  if (Array.isArray(result.output)) {
    for (const block of result.output) {
      if (!Array.isArray(block?.content)) continue
      for (const piece of block.content) {
        if (piece?.type === 'output_text') {
          return Array.isArray(piece.text) ? piece.text.join('') : piece.text
        }
      }
    }
  }

  if (Array.isArray(result.output_text) && result.output_text.length > 0) {
    return result.output_text[0]
  }

  return result?.choices?.[0]?.message?.content ?? null
}

/** 코드펜스나 앞뒤 설명이 붙어 와도 첫 JSON 객체만 골라 파싱한다. */
export function parseAiJson(rawText) {
  if (!rawText) return null
  const trimmed = String(rawText).trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const openIndex = candidate.indexOf('{')
  const closeIndex = candidate.lastIndexOf('}')
  const jsonSlice =
    openIndex !== -1 && closeIndex !== -1 && closeIndex > openIndex
      ? candidate.slice(openIndex, closeIndex + 1)
      : candidate
  try {
    return JSON.parse(jsonSlice)
  } catch (error) {
    console.error('AI JSON 파싱 실패', error, rawText)
    return null
  }
}

/** 프롬프트 한 개를 보내고 응답 원문(문자열)을 받는다. */
export async function callAiText(prompt) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('.env 파일에 VITE_OPENAI_API_KEY를 설정해 주세요.')
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || `AI 호출 오류 (${response.status})`)
  }

  const result = await response.json()
  const aiText = extractAiText(result)
  if (!aiText) throw new Error('AI 응답을 읽을 수 없어요.')
  return aiText
}

/**
 * 프롬프트 한 개를 보내고 JSON 객체로 받는다.
 * @param {string} prompt
 * @returns {Promise<object>}
 */
export async function callAi(prompt) {
  const aiText = await callAiText(prompt)
  const parsed = parseAiJson(aiText)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 응답을 JSON으로 해석하지 못했어요.')
  }
  return parsed
}
