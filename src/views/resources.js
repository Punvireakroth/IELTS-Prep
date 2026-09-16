import { mountMarkdown, renderResourcesHtml } from '../content.js'

export function renderResources (root) {
  root.innerHTML = `
    <h1>Resource hub</h1>
    <p class="view-sub">Official materials first. Teacher sites for method. Cambridge tools for feedback.</p>
    <div id="resourcesMd" class="md-body"></div>
  `
  const html = renderResourcesHtml()
  mountMarkdown(root.querySelector('#resourcesMd'), html)
  const h2 = root.querySelector('#resourcesMd h2')
  if (h2) h2.remove()
}
