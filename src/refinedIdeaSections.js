/** 채팅·구체화 본문에 남는 마크다운 굵게(**) 제거 */
export function stripMarkdownBoldMarkers(s) {
  return String(s).replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*\*/g, '')
}

export function normalizeRefinedList(val) {
  if (val == null) return []
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean)
  }
  const t = String(val).trim()
  return t ? [t] : []
}

/**
 * 구체화된 아이디어 객체 → 표시용 섹션 배열 (이름 제외).
 * @param {Record<string, unknown>} idea
 * @param {(value: string) => string} sanitize
 * @returns {{ title: string, html: string }[]}
 */
export function collectRefinedSections(idea, sanitize) {
  const para = (s) =>
    sanitize(stripMarkdownBoldMarkers(s == null ? '' : String(s))).replace(/\n/g, '<br>')

  const sections = []
  const add = (title, inner) => {
    if (inner == null || inner === '') return
    sections.push({ title, html: inner })
  }

  const chatSummary = idea.chatSummary ?? idea.highlightsFromChat
  if (chatSummary) {
    if (Array.isArray(chatSummary)) {
      const items = normalizeRefinedList(chatSummary)
      if (items.length) {
        add(
          '챗봇 대화에서 정리한 내용',
          `<ul>${items.map((x) => `<li>${para(x)}</li>`).join('')}</ul>`
        )
      }
    } else {
      const t = String(chatSummary).trim()
      if (t) add('챗봇 대화에서 정리한 내용', `<p>${para(t)}</p>`)
    }
  }

  if (idea.description != null && String(idea.description).trim()) {
    add('상세 설명', `<p>${para(idea.description)}</p>`)
  }

  if (idea.structureOrPrinciple != null && String(idea.structureOrPrinciple).trim()) {
    add('구조·작동 원리', `<p>${para(idea.structureOrPrinciple)}</p>`)
  }

  const feats = normalizeRefinedList(idea.features)
  if (feats.length) {
    add('특징', `<ul>${feats.map((f) => `<li>${para(f)}</li>`).join('')}</ul>`)
  }

  if (idea.howToUse != null && String(idea.howToUse).trim()) {
    add('사용 방법', `<p>${para(idea.howToUse)}</p>`)
  }

  const mats = normalizeRefinedList(idea.materials)
  if (mats.length) {
    add('준비물', `<ul>${mats.map((m) => `<li>${para(m)}</li>`).join('')}</ul>`)
  }

  const tools = normalizeRefinedList(idea.tools)
  if (tools.length) {
    add('필요한 도구', `<ul>${tools.map((t) => `<li>${para(t)}</li>`).join('')}</ul>`)
  }

  const steps = normalizeRefinedList(idea.manufacturingSteps)
  if (steps.length) {
    add(
      '제작 순서',
      `<ol>${steps.map((st) => `<li>${para(st)}</li>`).join('')}</ol>`
    )
  }

  if (idea.manufacturing != null && String(idea.manufacturing).trim()) {
    add(
      steps.length ? '제작 방법 (보충)' : '제작 방법',
      `<p>${para(idea.manufacturing)}</p>`
    )
  }

  if (idea.expectedEffect != null && String(idea.expectedEffect).trim()) {
    add('기대 효과', `<p>${para(idea.expectedEffect)}</p>`)
  }

  if (idea.notes != null && String(idea.notes).trim()) {
    add('유의사항', `<p>${para(idea.notes)}</p>`)
  }

  return sections
}
