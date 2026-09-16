import { mountMarkdown, renderGuideHtml } from '../content.js'

export function renderGuide (root) {
  root.innerHTML = `
    <h1>Guide</h1>
    <p class="view-sub">How to use the plan, what “done” means, booking notes, and the rules that move 5.5–6 toward 6.5.</p>
    <div id="guideMd" class="md-body"></div>
  `
  mountMarkdown(root.querySelector('#guideMd'), renderGuideHtml())
}
