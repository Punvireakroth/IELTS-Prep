import {
  getPlanTitle,
  mountMarkdown,
  renderCalendarHtml
} from '../content.js'
import {
  hydrateTasks,
  wrapWeeks,
  markToday,
  updateProgressUI,
  jumpToToday
} from '../plan-helpers.js'
import { upsertCheck } from '../data.js'
import { showToast } from '../toast.js'

export function renderPlan (root, ctx) {
  const { user, state, setState } = ctx
  root.innerHTML = `
    <h1>${getPlanTitle()}</h1>
    <p class="view-sub">Tick blocks as you finish them. Progress syncs to your account.</p>
    <div id="planContent" class="md-body"></div>
  `

  const planContent = root.querySelector('#planContent')
  mountMarkdown(planContent, renderCalendarHtml())
  // Drop the section H2 title noise — keep body
  const firstH2 = planContent.querySelector('h2')
  if (firstH2) firstH2.remove()

  hydrateTasks(planContent, state.checks)
  wrapWeeks(planContent)
  markToday(planContent)

  const progressLabel = document.getElementById('progressLabel')
  const progressFill = document.getElementById('progressFill')
  updateProgressUI(planContent, progressLabel, progressFill)

  const jumpBtn = document.getElementById('jumpToday')
  if (jumpBtn) {
    jumpBtn.onclick = () => jumpToToday()
  }

  planContent.addEventListener('click', async (e) => {
    const li = e.target.closest('li.task-list-item')
    if (!li) return
    if (e.target.tagName === 'A') return
    const input = li.querySelector('input[type="checkbox"][data-id]')
    if (!input) return
    if (e.target !== input) {
      e.preventDefault()
      input.checked = !input.checked
    }
    await persist(input, li)
  })

  async function persist (input, li) {
    const id = input.dataset.id
    const done = input.checked
    li.classList.toggle('checked', done)
    const next = { ...state.checks }
    if (done) next[id] = true
    else delete next[id]
    setState({ checks: next })
    updateProgressUI(planContent, progressLabel, progressFill)
    try {
      await upsertCheck(user.id, id, done)
    } catch (err) {
      console.error(err)
      showToast('Could not save checkbox — check your connection')
    }
  }
}
