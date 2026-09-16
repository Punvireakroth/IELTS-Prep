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
          <p class="auth-ok" id="authOk" hidden></p>
          <div class="actions">
            <button type="submit" class="primary" id="signInBtn">Sign in</button>
            <button type="button" class="secondary" id="signUpBtn">Sign up</button>
          </div>
        </form>
      </div>
    </div>
  `

  const form = root.querySelector('#authForm')
  const errEl = root.querySelector('#authError')
  const okEl = root.querySelector('#authOk')
  const signUpBtn = root.querySelector('#signUpBtn')
  const signInBtn = root.querySelector('#signInBtn')

  function setBusy (busy) {
    signInBtn.disabled = busy
    signUpBtn.disabled = busy
    signInBtn.textContent = busy ? 'Working…' : 'Sign in'
    signUpBtn.textContent = busy ? 'Working…' : 'Sign up'
  }

  function clearMessages () {
    errEl.textContent = ''
    okEl.hidden = true
    okEl.textContent = ''
  }

  async function run (mode) {
    clearMessages()
    if (!isConfigured()) {
      errEl.textContent = 'Supabase is not configured.'
      return
    }
    const fd = new FormData(form)
    const email = String(fd.get('email') || '').trim()
    const password = String(fd.get('password') || '')
    if (!email || !password) {
      errEl.textContent = 'Enter email and password.'
      return
    }

    setBusy(true)
    try {
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

        // Confirm-email is on: account exists but no session yet.
        // Try sign-in so we surface a clear "confirm your email" error if needed.
        const { data: signedIn, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signedIn?.session) {
          onSession(signedIn.session)
          return
        }

        const confirmHint =
          signInErr?.message?.toLowerCase().includes('confirm')
            ? signInErr.message
            : 'Check your inbox (and spam) for the confirmation link, then sign in.'

        okEl.hidden = false
        okEl.textContent =
          'Account created. ' + confirmHint +
          ' For solo use you can turn off “Confirm email” in Supabase → Authentication → Providers → Email.'
        showToast('Confirm your email, then sign in')
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        errEl.textContent = error.message
        return
      }
      onSession(data.session)
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong'
    } finally {
      setBusy(false)
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    run('signin')
  })

  signUpBtn.addEventListener('click', () => run('signup'))
}
