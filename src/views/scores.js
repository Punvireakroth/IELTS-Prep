import { SCORE_ROWS } from '../content.js'
import { upsertScore } from '../data.js'
import { showToast } from '../toast.js'

let saveTimer

export function renderScores (root, ctx) {
  const { user, state, setState } = ctx
  const scores = state.scores || {}

  root.innerHTML = `
    <h1>Weekly score tracker</h1>
    <p class="view-sub">Log raw scores and estimated bands after each timed full paper.</p>
    <table class="score-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>L /40</th>
          <th>R /40</th>
          <th>W est.</th>
          <th>S est.</th>
          <th>Overall est.</th>
          <th>Worst problem</th>
        </tr>
      </thead>
      <tbody>
        ${SCORE_ROWS.map((row) => {
          const s = scores[row.key] || {}
          return `
            <tr data-key="${row.key}">
              <td>${row.label}</td>
              <td class="score-cell"><input class="score-input" data-field="l" value="${esc(s.l)}" /></td>
              <td class="score-cell"><input class="score-input" data-field="r" value="${esc(s.r)}" /></td>
              <td class="score-cell"><input class="score-input" data-field="w" value="${esc(s.w)}" /></td>
              <td class="score-cell"><input class="score-input" data-field="s" value="${esc(s.s)}" /></td>
              <td class="score-cell"><input class="score-input" data-field="overall" value="${esc(s.overall)}" /></td>
              <td class="score-cell"><input class="score-input wide" data-field="worst_problem" value="${esc(s.worst_problem)}" /></td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
  `

  root.querySelectorAll('tr[data-key]').forEach((tr) => {
    tr.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        const key = tr.dataset.key
        const field = input.dataset.field
        const nextRow = {
          ...(state.scores[key] || { row_key: key }),
          [field]: input.value
        }
        setState({
          scores: { ...state.scores, [key]: nextRow }
        })
        clearTimeout(saveTimer)
        saveTimer = setTimeout(async () => {
          try {
            await upsertScore(user.id, key, {
              l: nextRow.l || null,
              r: nextRow.r || null,
              w: nextRow.w || null,
              s: nextRow.s || null,
              overall: nextRow.overall || null,
              worst_problem: nextRow.worst_problem || null
            })
          } catch (err) {
            console.error(err)
            showToast('Could not save score')
          }
        }, 400)
      })
    })
  })
}

function esc (v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}
