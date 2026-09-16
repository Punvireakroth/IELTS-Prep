let timer

export function showToast (message, ms = 3200) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.hidden = false
  clearTimeout(timer)
  timer = setTimeout(() => { el.hidden = true }, ms)
}
