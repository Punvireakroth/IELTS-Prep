import { insertLog, deleteLog } from '../data.js'
import { renderMd, enhanceLinks } from '../content.js'
import { showToast } from '../toast.js'

export function renderLogs (root, ctx) {
  const { user, state, setState } = ctx

  root.innerHTML = `
    <h1>Error log</h1>
    <p class="view-sub">After every Listening/Reading test, log misses here. Week 6 is built from this.</p>
    <div class="error-log-panel">
      <h3>Add an entry</h3>
      <form class="error-log-form" id="errorLogForm">
        <div class="row">
          <label>Date <input name="date" type="date" required /></label>
          <label>Skill
            <select name="skill" required>
              <option value="L">Listening</option>
              <option value="R">Reading</option>
              <option value="W">Writing</option>
              <option value="S">Speaking</option>
            </select>
          </label>
        </div>
        <label>Source + URL <input name="source" type="text" placeholder="Test name or link" /></label>
        <div class="row">
          <label>Raw score (L/R) <input name="raw_score" type="text" placeholder="e.g. 24 / 40" /></label>
          <label>Estimated band <input name="band" type="text" placeholder="e.g. 6.0" /></label>
        </div>
        <label>Question type missed <input name="qtype" type="text" placeholder="TFNG, headings…" /></label>
        <label>Why <input name="why" type="text" placeholder="word trap / time / grammar…" /></label>
        <label>
          Correct answer / feedback
          <span class="field-hint">Markdown supported — **bold**, lists, links</span>
          <textarea name="better" rows="6" placeholder="Write feedback with headings, bullet lists, and emphasis…"></textarea>
        </label>
        <label>Word to reuse <input name="word" type="text" /></label>
        <button type="submit">Save entry</button>
      </form>
    </div>
    <div class="log-entries" id="logEntries"></div>
  `

  const form = root.querySelector('#errorLogForm')
  const dateInput = form.querySelector('[name="date"]')
  dateInput.value = new Date().toISOString().slice(0, 10)

  function paint () {
    const box = root.querySelector('#logEntries')
    const logs = state.logs || []
    if (!logs.length) {
      box.innerHTML = '<p class="empty-hint">No entries yet. Log mistakes after each L/R test.</p>'
      return
    }
    box.innerHTML = logs.map((entry) => `
      <article class="log-entry" data-id="${entry.id}">
        <header>
          <span><span class="skill-pill">${escapeHtml(entry.skill)}</span>${escapeHtml(entry.date || '')}</span>
          <button type="button" class="delete" data-delete="${entry.id}">Delete</button>
        </header>
        ${entry.source ? `<div class="log-meta"><strong>Source:</strong> ${linkifySource(entry.source)}</div>` : ''}
        ${entry.raw_score || entry.band ? `<div class="log-meta"><strong>Score:</strong> ${escapeHtml(entry.raw_score || '—')} · band ${escapeHtml(entry.band || '—')}</div>` : ''}
        ${entry.qtype ? `<div class="log-meta"><strong>Missed:</strong> ${escapeHtml(entry.qtype)}</div>` : ''}
        ${entry.why ? `<div class="log-meta"><strong>Why:</strong> ${escapeHtml(entry.why)}</div>` : ''}
        ${entry.better ? `
          <div class="log-body">
            <div class="log-body-label">Better</div>
            <div class="log-rich md-body">${renderMd(entry.better)}</div>
          </div>
        ` : ''}
        ${entry.word ? `<div class="log-meta"><strong>Word:</strong> ${escapeHtml(entry.word)}</div>` : ''}
      </article>
    `).join('')

    box.querySelectorAll('.log-rich').forEach((el) => enhanceLinks(el))
  }

  paint()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const entry = {
      date: fd.get('date') || null,
      skill: fd.get('skill'),
      source: fd.get('source') || null,
      raw_score: fd.get('raw_score') || null,
      band: fd.get('band') || null,
      qtype: fd.get('qtype') || null,
      why: fd.get('why') || null,
      better: fd.get('better') || null,
      word: fd.get('word') || null
    }
    try {
      const row = await insertLog(user.id, entry)
      setState({ logs: [row, ...(state.logs || [])] })
      form.reset()
      dateInput.value = new Date().toISOString().slice(0, 10)
      paint()
    } catch (err) {
      console.error(err)
      showToast('Could not save error log entry')
    }
  })

  root.querySelector('#logEntries').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete]')
    if (!btn) return
    const id = btn.getAttribute('data-delete')
    try {
      await deleteLog(user.id, id)
      setState({ logs: (state.logs || []).filter((l) => l.id !== id) })
      paint()
    } catch (err) {
      console.error(err)
      showToast('Could not delete entry')
    }
  })
}

function escapeHtml (s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkifySource (source) {
  const value = String(source ?? '').trim()
  if (/^https?:\/\//i.test(value)) {
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`
  }
  return escapeHtml(value)
}
