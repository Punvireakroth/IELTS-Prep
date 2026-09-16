import { isConfigured, supabase } from '../supabase.js'
import { showToast } from '../toast.js'

export function renderAuth (root, { onSession }) {
  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <h1>IELTS Prep</h1>
        <p class="hint">Sign in to sync progress across devices.</p>
        ${!isConfigured() ? '<p class="auth-error">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server.</p>' : ''}
        <form id="authForm">
          <label>Email <input name="email" type="email" required autocomplete="email" /></label>
          <label>Password <input name="password" type="password" required minlength="6" autocomplete="current-password" /></label>
          <p class="auth-error" id="authError"></p>
          <div class="actions">
            <button type="submit" class="primary" data-mode="signin">Sign in</button>
            <button type="button" class="secondary" id="signUpBtn">Sign up</button>
          </div>
        </form>
      </div>
    </div>
  `

  const form = root.querySelector('#authForm')
  const errEl = root.querySelector('#authError')
  const signUpBtn = root.querySelector('#signUpBtn')

  async function run (mode) {
    errEl.textContent = ''
    if (!isConfigured()) {
      errEl.textContent = 'Supabase is not configured.'
      return
    }
    const fd = new FormData(form)
    const email = String(fd.get('email') || '').trim()
    const password = String(fd.get('password') || '')

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        errEl.textContent = error.message
        return
      }
      if (data.session) {
        onSession(data.session)
        return
      }
      showToast('Check your email to confirm, or disable email confirmations in Supabase Auth settings')
      errEl.textContent = 'Account created. Confirm email if required, then sign in.'
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      errEl.textContent = error.message
      return
    }
    onSession(data.session)
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    run('signin')
  })

  signUpBtn.addEventListener('click', () => run('signup'))
}
