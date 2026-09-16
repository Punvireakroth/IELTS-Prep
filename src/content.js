import { marked } from 'marked'
import planMd from '../IELTS-Academic-6.5-Study-Plan.md?raw'

marked.setOptions({ gfm: true, breaks: false })

const SCORE_ROWS = [
  { key: 'diagnostic', label: '17–18 Sep diagnostic' },
  { key: 'week3', label: 'Week 3' },
  { key: 'week4', label: 'Week 4' },
  { key: 'mockA', label: 'Mock A (14–15 Oct)' },
  { key: 'mockB', label: 'Mock B (17–18 Oct)' },
  { key: 'peak', label: 'Peak (24–25 Oct)' }
]

export { SCORE_ROWS }

function splitByH2 (md) {
  const lines = md.split('\n')
  const preamble = []
  const sections = []
  let current = null

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      if (current) sections.push(current)
      current = { title: m[1].trim(), body: [] }
      continue
    }
    if (!current) preamble.push(line)
    else current.body.push(line)
  }
  if (current) sections.push(current)

  return {
    preamble: preamble.join('\n').trim(),
    sections: sections.map((s) => ({
      title: s.title,
      markdown: s.body.join('\n').trim()
    }))
  }
}

function findSection (sections, re) {
  return sections.find((s) => re.test(s.title))
}

function extractSubsections (markdown, names) {
  const parts = markdown.split(/\n(?=###\s+)/)
  const intro = []
  const wanted = []
  for (const part of parts) {
    const m = part.match(/^###\s+(.+)/)
    if (!m) {
      intro.push(part)
      continue
    }
    const title = m[1].trim()
    if (names.some((n) => n.test(title))) wanted.push(part)
  }
  return { intro: intro.join('\n').trim(), blocks: wanted.join('\n\n').trim() }
}

const parsed = splitByH2(planMd)

const howTo = findSection(parsed.sections, /How to use/i)
const resources = findSection(parsed.sections, /Resource hub/i)
const doneMeans = findSection(parsed.sections, /What .+done.+means/i)
const calendar = findSection(parsed.sections, /Day-by-day calendar/i)
const testWeek = findSection(parsed.sections, /Test week/i)
const rules = findSection(parsed.sections, /Rules that actually/i)

const howToParts = howTo
  ? extractSubsections(howTo.markdown, [/Daily template/i, /Weekend template/i, /Score targets/i])
  : { intro: '', blocks: '' }

function renderMd (md) {
  if (!md) return ''
  return marked.parse(md)
}

function enhanceLinks (root) {
  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
}

export function getPlanTitle () {
  const m = planMd.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : 'IELTS Study Plan'
}

export function renderOverviewStaticHtml () {
  const booking = parsed.preamble
    .replace(/^#.*$/m, '')
    .replace(/\*\*Test:\*\*.*\n?/g, '')
    .replace(/\*\*Start:\*\*.*\n?/g, '')
    .replace(/\*\*Target test window:\*\*.*\n?/g, '')
    .replace(/\*\*Current level:\*\*.*\n?/g, '')
    .replace(/\*\*Goal:\*\*.*\n?/g, '')
    .replace(/\*\*Daily time:\*\*.*\n?/g, '')
    .trim()

  const templates = howToParts.blocks
  return renderMd([booking, templates].filter(Boolean).join('\n\n---\n\n'))
}

export function renderResourcesHtml () {
  return renderMd(resources ? `## ${resources.title}\n\n${resources.markdown}` : '')
}

export function renderGuideHtml () {
  const chunks = []
  if (howTo) {
    chunks.push(`## ${howTo.title}\n\n${howToParts.intro}`)
  }
  if (doneMeans) chunks.push(`## ${doneMeans.title}\n\n${doneMeans.markdown}`)
  if (testWeek) chunks.push(`## ${testWeek.title}\n\n${testWeek.markdown}`)
  if (rules) chunks.push(`## ${rules.title}\n\n${rules.markdown}`)
  return renderMd(chunks.join('\n\n'))
}

export function renderCalendarHtml () {
  if (!calendar) return ''
  return renderMd(`## ${calendar.title}\n\n${calendar.markdown}`)
}

export function mountMarkdown (el, html) {
  el.innerHTML = html
  el.classList.add('md-body')
  enhanceLinks(el)
}

export { enhanceLinks }
