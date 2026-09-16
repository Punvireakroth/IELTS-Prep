import { mountMarkdown, renderOverviewStaticHtml, getPlanTitle } from '../content.js'
import { updateProfile } from '../data.js'
import { showToast } from '../toast.js'

let saveTimer

export function renderOverview (root, ctx) {
  const { user, state, setState } = ctx
  const p = state.profile || {}

  root.innerHTML = `
    <h1>${getPlanTitle()}</h1>
    <p class="view-sub">Your exam setup and score targets. Edit the fields — they sync to Supabase.</p>
    <div class="props" id="profileProps">
      <div class="prop"><span class="prop-key">Test</span><input data-field="test_label" value="${esc(p.test_label)}" /></div>
      <div class="prop"><span class="prop-key">Start</span><input data-field="start_date" type="date" value="${esc(p.start_date || '')}" /></div>
      <div class="prop"><span class="prop-key">Target window</span><input data-field="target_window" value="${esc(p.target_window)}" /></div>
      <div class="prop"><span class="prop-key">Current level</span><input data-field="current_level" value="${esc(p.current_level)}" /></div>
      <div class="prop"><span class="prop-key">Goal</span><input data-field="goal" value="${esc(p.goal)}" /></div>
      <div class="prop"><span class="prop-key">Daily time</span><input data-field="daily_time" value="${esc(p.daily_time)}" /></div>
    </div>
    <div id="overviewMd" class="md-body"></div>
  `

  mountMarkdown(root.querySelector('#overviewMd'), renderOverviewStaticHtml())

  root.querySelectorAll('#profileProps input').forEach((input) => {
    input.addEventListener('input', () => {
      const field = input.dataset.field
      const next = { ...state.profile, [field]: input.value }
      setState({ profile: next })
      clearTimeout(saveTimer)
      saveTimer = setTimeout(async () => {
        try {
          const saved = await updateProfile(user.id, {
            test_label: next.test_label,
            start_date: next.start_date || null,
            target_window: next.target_window,
            current_level: next.current_level,
            goal: next.goal,
            daily_time: next.daily_time
          })
          setState({ profile: saved })
        } catch (err) {
          console.error(err)
          showToast('Could not save profile')
        }
      }, 500)
    })
  })
}

function esc (v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}
