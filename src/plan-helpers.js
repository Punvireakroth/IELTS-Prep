export function hashId (str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 't' + (h >>> 0).toString(16)
}

function parseTodayParts (d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    dayName: days[d.getDay()],
    day: d.getDate(),
    month: months[d.getMonth()],
    year: d.getFullYear()
  }
}

function headingMatchesToday (text, today) {
  const re = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/
  const m = text.trim().match(re)
  if (!m) return false
  return m[1] === today.dayName && Number(m[2]) === today.day && m[3] === today.month
}

export function hydrateTasks (root, checks) {
  let weekCtx = ''
  let dayCtx = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let node
  while ((node = walker.nextNode())) {
    if (/^H[23]$/.test(node.tagName)) weekCtx = node.textContent.trim()
    if (node.tagName === 'H4') dayCtx = node.textContent.trim()
    if (node.tagName === 'INPUT' && node.type === 'checkbox' && node.parentElement?.tagName === 'LI') {
      const li = node.parentElement
      li.classList.add('task-list-item')
      const ul = li.parentElement
      if (ul) {
        ul.classList.add('contains-task-list', 'task-list')
      }
      node.removeAttribute('disabled')
      const clone = li.cloneNode(true)
      clone.querySelector('input')?.remove()
      const text = clone.textContent.trim()
      const id = hashId(weekCtx + '|' + dayCtx + '|' + text)
      node.dataset.id = id
      node.checked = !!checks[id]
      if (node.checked) li.classList.add('checked')
      const span = document.createElement('span')
      span.className = 'task-text'
      while (node.nextSibling) span.appendChild(node.nextSibling)
      li.appendChild(span)
    }
  }
}

export function wrapWeeks (root) {
  const children = Array.from(root.children)
  const weekStarts = []
  children.forEach((el, i) => {
    if (el.tagName === 'H3') {
      const t = el.textContent.trim()
      if (/^Week\s+\d+/i.test(t) || /^Final stretch/i.test(t)) {
        weekStarts.push({ el, index: i, title: t })
      }
    }
  })

  for (let idx = weekStarts.length - 1; idx >= 0; idx--) {
    const start = weekStarts[idx]
    const endIndex = idx + 1 < weekStarts.length ? weekStarts[idx + 1].index : children.length
    let end = endIndex
    for (let i = start.index + 1; i < endIndex; i++) {
      if (children[i].tagName === 'H2') {
        end = i
        break
      }
    }

    const details = document.createElement('details')
    details.className = 'week-block'
    const summary = document.createElement('summary')
    summary.appendChild(document.createTextNode(start.title + ' '))
    const meta = document.createElement('span')
    meta.className = 'week-meta'
    summary.appendChild(meta)
    const body = document.createElement('div')
    body.className = 'week-body'
    details.appendChild(summary)
    details.appendChild(body)

    const nodes = children.slice(start.index + 1, end)
    start.el.replaceWith(details)
    nodes.forEach((n) => body.appendChild(n))
  }
}

export function markToday (root) {
  const today = parseTodayParts(new Date())
  let todayEl = null
  root.querySelectorAll('h4').forEach((h4) => {
    if (!headingMatchesToday(h4.textContent, today)) return
    const wrap = document.createElement('div')
    wrap.className = 'day-block is-today'
    wrap.id = 'today'
    h4.parentNode.insertBefore(wrap, h4)
    wrap.appendChild(h4)

    let next = wrap.nextSibling
    while (next) {
      if (next.nodeType === 1) {
        const tag = next.tagName
        if (tag === 'H4' || tag === 'H3' || tag === 'H2' || tag === 'HR' || tag === 'DETAILS') break
        if (next.classList?.contains('day-block')) break
      }
      const cur = next
      next = next.nextSibling
      wrap.appendChild(cur)
    }

    const badge = document.createElement('span')
    badge.className = 'today-badge'
    badge.textContent = 'Today'
    h4.appendChild(badge)
    todayEl = wrap
    const week = wrap.closest('details.week-block')
    if (week) week.open = true
  })

  if (!todayEl) {
    const first = root.querySelector('details.week-block')
    if (first) first.open = true
  }
  return todayEl
}

export function updateProgressUI (root, progressLabel, progressFill) {
  const boxes = root.querySelectorAll('input[type="checkbox"][data-id]')
  const total = boxes.length
  const done = Array.from(boxes).filter((b) => b.checked).length
  const pct = total ? (done === 0 ? 0 : Math.max(1, Math.round((done / total) * 100))) : 0
  if (progressLabel) progressLabel.textContent = `${done} / ${total} tasks · ${pct}%`
  if (progressFill) progressFill.style.width = `${pct}%`

  root.querySelectorAll('details.week-block').forEach((details) => {
    const weekBoxes = details.querySelectorAll('input[type="checkbox"][data-id]')
    const weekDone = Array.from(weekBoxes).filter((b) => b.checked).length
    const meta = details.querySelector('.week-meta')
    if (meta && weekBoxes.length) meta.textContent = `${weekDone}/${weekBoxes.length}`
  })
}

export function jumpToToday () {
  const el = document.getElementById('today') || document.querySelector('details.week-block')
  if (!el) return
  const week = el.closest('details.week-block')
  if (week) week.open = true
  const topbar = document.querySelector('.topbar')
  const offset = (topbar ? topbar.offsetHeight : 0) + 12
  const y = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
}
