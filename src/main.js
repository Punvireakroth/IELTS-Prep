import './styles.css'
import { supabase, isConfigured } from './supabase.js'
import { loadAllUserData } from './data.js'
import { showToast } from './toast.js'
import { renderAuth } from './views/auth.js'
import { renderPlan } from './views/plan.js'
import { renderScores } from './views/scores.js'
import { renderLogs } from './views/logs.js'
import { renderOverview } from './views/overview.js'
import { renderResources } from './views/resources.js'
import { renderGuide } from './views/guide.js'

const VIEWS = [
  { id: 'plan', label: 'Plan' },
  { id: 'scores', label: 'Scores' },
  { id: 'logs', label: 'Error log' },
  { id: 'overview', label: 'Overview' },
  { id: 'resources', label: 'Resources' },
  { id: 'guide', label: 'Guide' }
]

const app = document.getElementById('app')

let session = null
let state = {
  profile: null,
  checks: {},
  scores: {},
  logs: []
}
let currentView = 'plan'

function setState (partial) {
  Object.assign(state, partial)
}

function routeFromHash () {
  const id = (location.hash || '#plan').slice(1)
  return VIEWS.some((v) => v.id === id) ? id : 'plan'
}

function renderShell () {
  if (app) app.dataset.booted = '1'
  const showProgress = currentView === 'plan'
  app.innerHTML = `
    <div class="app-shell">
      <nav class="app-nav" aria-label="Main">
        <div class="brand">IELTS Prep</div>
        ${VIEWS.map((v) => `
          <a href="#${v.id}" class="nav-link ${v.id === currentView ? 'active' : ''}" data-view="${v.id}">${v.label}</a>
        `).join('')}
        <div class="nav-spacer"></div>
        <div class="nav-user">${session?.user?.email || ''}</div>
        <button type="button" class="nav-link" id="signOutBtn">Sign out</button>
      </nav>
      <div class="app-main">
        <div class="topbar ${showProgress ? '' : 'hidden'}" id="planTopbar">
          <span class="progress-label" id="progressLabel">0 / 0 tasks</span>
          <div class="progress-track" aria-hidden="true"><div class="progress-fill" id="progressFill"></div></div>
          <button type="button" id="jumpToday">Jump to today</button>
        </div>
        <main class="page" id="viewRoot"></main>
      </div>
    </div>
  `

  app.querySelector('#signOutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut()
  })

  const viewRoot = app.querySelector('#viewRoot')
  const ctx = {
    user: session.user,
    state,
    setState: (partial) => {
      setState(partial)
    }
  }

  switch (currentView) {
    case 'scores':
      renderScores(viewRoot, ctx)
      break
    case 'logs':
      renderLogs(viewRoot, ctx)
      break
    case 'overview':
      renderOverview(viewRoot, ctx)
      break
    case 'resources':
      renderResources(viewRoot)
      break
    case 'guide':
      renderGuide(viewRoot)
      break
    default:
      renderPlan(viewRoot, ctx)
  }
}

async function enterApp (nextSession) {
  session = nextSession
  if (app) app.dataset.booted = '1'
  app.innerHTML = '<div class="loading">Loading your plan…</div>'
  try {
    const data = await loadAllUserData(session.user.id)
    state = {
      profile: data.profile,
      checks: data.checks,
      scores: data.scores,
      logs: data.logs
    }
    currentView = routeFromHash()
    renderShell()
  } catch (err) {
    console.error(err)
    app.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <h1>Could not load data</h1>
          <p class="hint">${err.message || err}</p>
          <p class="hint">Confirm you ran <code>supabase/schema.sql</code> and that Email auth is enabled.</p>
          <button type="button" class="primary" id="retryBtn" style="width:100%;margin-top:12px;background:var(--accent);color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer">Try again</button>
          <button type="button" class="secondary" id="outBtn" style="width:100%;margin-top:8px;background:transparent;border:1px solid #ccc;padding:10px;border-radius:6px;cursor:pointer">Sign out</button>
        </div>
      </div>
    `
    app.querySelector('#retryBtn').onclick = () => enterApp(session)
    app.querySelector('#outBtn').onclick = () => supabase.auth.signOut()
  }
}

function showAuth () {
  session = null
  if (app) app.dataset.booted = '1'
  renderAuth(app, {
    onSession: (s) => enterApp(s)
  })
}

window.addEventListener('hashchange', () => {
  if (!session) return
  currentView = routeFromHash()
  renderShell()
})

async function boot () {
  if (!isConfigured()) {
    showAuth()
    return
  }

  const { data: { session: existing } } = await supabase.auth.getSession()
  if (existing) await enterApp(existing)
  else showAuth()

  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'SIGNED_OUT') {
      showAuth()
      return
    }
    if (event === 'SIGNED_IN' && next && (!session || session.user.id !== next.user.id)) {
      enterApp(next)
    }
  })
}

boot().catch((err) => {
  console.error(err)
  showToast(err.message || 'Failed to start')
  showAuth()
})
