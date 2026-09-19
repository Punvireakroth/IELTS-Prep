import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

export function renderMd (md) {
  if (!md) return ''
  const html = marked.parse(String(md))
  return typeof html === 'string' ? html : ''
}

export function enhanceLinks (root) {
  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
}

export function mountMarkdown (el, html) {
  if (!el) return
  el.innerHTML = html
  el.classList.add('md-body')
  enhanceLinks(el)
}
