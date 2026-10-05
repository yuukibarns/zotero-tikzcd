import { renderTikzcd } from './renderer.mjs';
import rendererCSS from './renderer.css';

export function isTikzcd(source) {
  // Quiver exports can include a URL comment or optional display delimiters.
  return /^(?:\s|%[^\n]*(?:\n|$))*(?:\\\[(?:\s|%[^\n]*(?:\n|$))*)?\\begin\{tikzcd\}/.test(source);
}

/** A view-only integration with Zotero 10's MathView. Never edits a PM document
 * or replaces source DOM; native open/close, selection, undo and saving remain
 * Zotero's responsibility. Private API checks fail closed on unknown versions.
 */
export function installMathNodes(doc, { render = renderTikzcd, debounce = 120 } = {}) {
  const win = doc.defaultView;
  const states = new Map();
  let stopped = false;
  const style = doc.createElement('style');
  style.dataset.tikzcdStyle = '';
  style.textContent = rendererCSS + `
math-display[data-tikzcd] > .math-render { cursor:pointer; }
.tikzcd-note-surface { display:block; width:100%; overflow:auto; text-align:center; background:white; color:#171717; border:1px solid #8885; border-radius:4px; margin-top:8px; }
.tikzcd-note-output { display:block; min-height:36px; text-align:left; }
.tikzcd-note-status { display:block; text-align:left; font:12px/1.5 system-ui,sans-serif; padding:6px 10px; color:#7c3310; white-space:pre-wrap; }
.tikzcd-note-status:empty { display:none; }
/* LaTeX Suite's KaTeX source map and caret marker do not describe diagrams.
   Its equation preview is hidden only in a node owned by this renderer. */
math-display[data-tikzcd] #latex-suite-math-preview { display:none!important; }
`;
  doc.head.append(style);

  function attach(node) {
    const math = node.pmViewDesc?.spec;
    if (!math || states.has(math) || math.dom !== node || node.localName !== 'math-display' ||
      !math._mathRenderElt || !math._mathSrcElt || !math._outerView ||
      !['renderMath','update','openEditor','closeEditor','destroy'].every(k => typeof math[k] === 'function')) return;
    let alive = true, surface = null, output = null, status = null;
    let timer = null, controller = null, current = null, requested = null, revision = 0;
    const hooks = [];
    const source = () => math._innerView?.state.doc.textContent ?? math._node.textContent;
    const originalRender = math.renderMath;
    function cancel() {
      revision++;
      if (timer !== null) win.clearTimeout(timer);
      timer = null; controller?.abort(); controller = null; requested = null;
    }
    function clear() {
      cancel(); current?.dispose(); current = null;
      surface?.remove(); surface = output = status = null;
      node.removeAttribute('data-tikzcd');
    }
    function mount() {
      node.setAttribute('data-tikzcd', '');
      node.classList.remove('empty-math');
      math._mathRenderElt.classList.remove('parse-error');
      node.removeAttribute('title');
      if (!surface) {
        surface = doc.createElement('div'); surface.className = 'tikzcd-note-surface';
        surface.contentEditable = 'false';
        output = doc.createElement('div'); output.className = 'tikzcd-note-output';
        status = doc.createElement('div'); status.className = 'tikzcd-note-status';
        status.setAttribute('role', 'status');
        surface.append(output, status);
        // A read-only preview must not move the source caret. Leave native
        // scrollbars alone and let clicks on a CLOSED diagram open the node.
        surface.addEventListener('mousedown', event => {
          if (math._innerView && event.target.closest?.('.tikzcd-diagram')) {
            event.preventDefault(); event.stopPropagation();
          }
        });
      }
      const parent = math._innerView ? node : math._mathRenderElt;
      if (surface.parentNode !== parent) {
        if (parent === math._mathRenderElt) parent.replaceChildren(surface);
        else parent.append(surface);
      }
    }
    function refresh(immediate = false) {
      if (!alive || stopped) return false;
      const text = source();
      if (!isTikzcd(text)) {
        const wasDiagram = !!surface;
        clear();
        if (wasDiagram) originalRender.call(math);
        return false;
      }
      mount();
      if (requested === text) return true;
      cancel(); requested = text;
      const ticket = revision;
      status.textContent = current ? 'Updating diagram…' : 'Rendering diagram…';
      timer = win.setTimeout(async () => {
        timer = null;
        if (!alive || stopped || !node.isConnected || ticket !== revision) return;
        const job = new win.AbortController(); controller = job;
        try {
          const result = await render(output, text, { signal: job.signal });
          if (!alive || stopped || !node.isConnected || ticket !== revision || source() !== text) {
            result.dispose(); return;
          }
          current?.dispose(); current = result;
          status.textContent = result.diagnostics.map(d => d.message).join('\n');
          output.dataset.source = text;
        } catch (error) {
          if (ticket === revision && alive && !stopped && error.name !== 'AbortError') {
            status.textContent = (current ? 'Showing previous diagram. ' : '') + `Cannot render: ${error.message}`;
          }
        } finally { if (controller === job) controller = null; }
      }, immediate ? 0 : debounce);
      return true;
    }
    function hook(name, after) {
      const own = Object.getOwnPropertyDescriptor(math, name), previous = math[name];
      function wrapped(...args) {
        // Other plugins use renderMath with a detached facade. Never attach
        // state or a Quiver render to those temporary objects.
        if (this !== math || !alive || stopped) return previous.apply(this, args);
        if (name === 'renderMath' && refresh(!math._innerView)) return;
        if (name === 'destroy') release(false);
        const result = previous.apply(this, args);
        if (after && alive) refresh(!math._innerView);
        return result;
      }
      math[name] = wrapped;
      hooks.push(() => {
        if (math[name] === wrapped) {
          if (own) Object.defineProperty(math, name, own); else delete math[name];
        }
      });
    }
    function release(restoreNative) {
      if (!alive) return;
      alive = false;
      const wasDiagram = !!surface;
      clear();
      for (const unhook of hooks.reverse()) unhook();
      states.delete(math);
      if (restoreNative && wasDiagram && node.isConnected && math._mathRenderElt) originalRender.call(math);
    }
    hook('renderMath', false);
    hook('update', true);
    hook('openEditor', true);
    hook('closeEditor', true);
    hook('destroy', false);
    states.set(math, { node, release });
    refresh(true);
  }
  const scan = root => {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.matches?.('math-display')) attach(root);
    root.querySelectorAll('math-display').forEach(attach);
  };
  const observer = new win.MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && !node.closest('.tikzcd-note-surface')) scan(node);
    }
    for (const state of states.values()) if (!state.node.isConnected) state.release(false);
  });
  observer.observe(doc.body, { childList:true, subtree:true });
  scan(doc);
  function dispose() {
    if (stopped) return;
    stopped = true; observer.disconnect();
    for (const state of [...states.values()]) state.release(true);
    style.remove(); win.removeEventListener('unload', dispose);
  }
  win.addEventListener('unload', dispose, { once:true });
  return { dispose, get count() { return states.size; } };
}
