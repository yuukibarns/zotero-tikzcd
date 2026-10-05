import { renderTikzcd } from './renderer.mjs';
const example = String.raw`\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}`;
const source = document.getElementById('source');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const diagnostics = document.getElementById('diagnostics');
let controller;
let current;
let revision = 0;
async function render() {
  const thisRevision = ++revision;
  controller?.abort();
  controller = new AbortController();
  current?.dispose(); current = null;
  status.textContent = 'Rendering…';
  diagnostics.replaceChildren();
  try {
    const result = await renderTikzcd(preview, source.value, { signal: controller.signal });
    if (thisRevision !== revision) { result.dispose(); return; }
    current = result;
    status.textContent = `${result.vertices} objects, ${result.edges} arrows`;
    for (const diagnostic of result.diagnostics) {
      const li = document.createElement('li');
      li.textContent = diagnostic.message; diagnostics.append(li);
    }
  } catch (error) {
    if (thisRevision === revision && error.name !== 'AbortError') status.textContent = `Cannot render: ${error.message}`;
  }
}
document.getElementById('render').addEventListener('click', render);
document.getElementById('example').addEventListener('click', () => { source.value = example; render(); });
source.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); render(); }
});
window.addEventListener('unload', () => controller?.abort(), { once: true });
// Public prototype API, also exercised by the isolated native-browser test.
window.TikzcdPreview = { renderTikzcd, render };
source.value = example;
render();
