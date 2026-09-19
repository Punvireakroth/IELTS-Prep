import { insertLog, updateLog, deleteLog } from '../data.js'
import { renderMd, mountMarkdown } from '../markdown.js'
import { showToast } from '../toast.js'

export function renderLogs (root, ctx) {
  const { user, state, setState } = ctx
  let editingId = null

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

  function entryFields (entry) {
    return {
      date: entry.date || '',
      skill: entry.skill || 'L',
      source: entry.source || '',
      raw_score: entry.raw_score || '',
      band: entry.band || '',
      qtype: entry.qtype || '',
      why: entry.why || '',
      better: entry.better || '',
      word: entry.word || ''
    }
  }

  function renderEditForm (entry) {
    const f = entryFields(entry)
    return `
      <article class="log-entry log-entry-editing" data-id="${entry.id}">
        <header>
          <span><span class="skill-pill">${escapeHtml(entry.skill)}</span>Edit entry</span>
        </header>
        <form class="error-log-form log-edit-form" data-edit-form="${entry.id}">
          <div class="row">
            <label>Date <input name="date" type="date" value="${escapeHtml(f.date)}" required /></label>
            <label>Skill
              <select name="skill" required>
                ${['L', 'R', 'W', 'S'].map((s) => `
                  <option value="${s}" ${s === f.skill ? 'selected' : ''}>${skillLabel(s)}</option>
                `).join('')}
              </select>
            </label>
          </div>
          <label>Source + URL <input name="source" type="text" value="${escapeHtml(f.source)}" /></label>
          <div class="row">
            <label>Raw score (L/R) <input name="raw_score" type="text" value="${escapeHtml(f.raw_score)}" /></label>
            <label>Estimated band <input name="band" type="text" value="${escapeHtml(f.band)}" /></label>
          </div>
          <label>Question type missed <input name="qtype" type="text" value="${escapeHtml(f.qtype)}" /></label>
          <label>Why <input name="why" type="text" value="${escapeHtml(f.why)}" /></label>
          <label>
            Correct answer / feedback
            <span class="field-hint">Markdown supported</span>
            <textarea name="better" rows="8">${escapeHtml(f.better)}</textarea>
          </label>
          <label>Word to reuse <input name="word" type="text" value="${escapeHtml(f.word)}" /></label>
          <div class="log-edit-actions">
            <button type="submit" class="btn-primary">Save changes</button>
            <button type="button" class="btn-secondary" data-cancel-edit="${entry.id}">Cancel</button>
          </div>
        </form>
      </article>
    `
  }

  function renderEntry (entry) {
    return `
      <article class="log-entry" data-id="${entry.id}">
        <header>
          <span><span class="skill-pill">${escapeHtml(entry.skill)}</span>${escapeHtml(entry.date || '')}</span>
          <div class="log-actions">
            <button type="button" class="edit" data-edit="${entry.id}">Edit</button>
            <button type="button" class="delete" data-delete="${entry.id}">Delete</button>
          </div>
        </header>
        ${entry.source ? `<div class="log-meta"><strong>Source:</strong> ${linkifySource(entry.source)}</div>` : ''}
        ${entry.raw_score || entry.band ? `<div class="log-meta"><strong>Score:</strong> ${escapeHtml(entry.raw_score || '—')} · band ${escapeHtml(entry.band || '—')}</div>` : ''}
        ${entry.qtype ? `<div class="log-meta"><strong>Missed:</strong> ${escapeHtml(entry.qtype)}</div>` : ''}
        ${entry.why ? `<div class="log-meta"><strong>Why:</strong> ${escapeHtml(entry.why)}</div>` : ''}
        ${entry.better ? `
          <div class="log-body">
            <div class="log-body-label">Better</div>
            <div class="log-rich" data-rich="${entry.id}"></div>
          </div>
        ` : ''}
        ${entry.word ? `<div class="log-meta"><strong>Word:</strong> ${escapeHtml(entry.word)}</div>` : ''}
      </article>
    `
  }

  function mountRichBodies () {
    const logs = state.logs || []
    for (const entry of logs) {
      if (!entry.better) continue
      const el = root.querySelector(`[data-rich="${entry.id}"]`)
      if (el) mountMarkdown(el, renderMd(entry.better))
    }
  }

  function paint () {
    const box = root.querySelector('#logEntries')
    const logs = state.logs || []
    if (!logs.length) {
      box.innerHTML = '<p class="empty-hint">No entries yet. Log mistakes after each L/R test.</p>'
      return
    }
    box.innerHTML = logs.map((entry) => (
      editingId === entry.id ? renderEditForm(entry) : renderEntry(entry)
    )).join('')
    mountRichBodies()
  }

  paint()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const entry = formDataToEntry(fd)
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
    const editBtn = e.target.closest('[data-edit]')
    if (editBtn) {
      editingId = editBtn.getAttribute('data-edit')
      paint()
      return
    }

    const cancelBtn = e.target.closest('[data-cancel-edit]')
    if (cancelBtn) {
      editingId = null
      paint()
      return
    }

    const deleteBtn = e.target.closest('[data-delete]')
    if (!deleteBtn) return
    const id = deleteBtn.getAttribute('data-delete')
    try {
      await deleteLog(user.id, id)
      if (editingId === id) editingId = null
      setState({ logs: (state.logs || []).filter((l) => l.id !== id) })
      paint()
    } catch (err) {
      console.error(err)
      showToast('Could not delete entry')
    }
  })

  root.querySelector('#logEntries').addEventListener('submit', async (e) => {
    const editForm = e.target.closest('[data-edit-form]')
    if (!editForm) return
    e.preventDefault()
    const id = editForm.getAttribute('data-edit-form')
    const fd = new FormData(editForm)
    const entry = formDataToEntry(fd)
    try {
      const row = await updateLog(user.id, id, entry)
      setState({
        logs: (state.logs || []).map((l) => (l.id === id ? row : l))
      })
      editingId = null
      paint()
      showToast('Entry updated')
    } catch (err) {
      console.error(err)
      showToast('Could not update entry')
    }
  })
}

function formDataToEntry (fd) {
  return {
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
}

function skillLabel (skill) {
  return ({ L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' })[skill] || skill
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
