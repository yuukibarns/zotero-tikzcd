var chromeHandle;
var windows = new Map();
var previews = new Set();
var stopped = true;
var generation = 0;
var noteScript;
var noteObserver;
var noteDocuments = new Map();

function attachNote(doc) {
  if (stopped || !noteScript || !doc || doc.documentURI.split('?')[0] !== 'resource://zotero/note-editor/editor.html' || noteDocuments.has(doc)) return;
  const win = doc.defaultView;
  if (!win) return;
  function inject() {
    if (stopped || !doc.body) return;
    const script = doc.createElement('script');
    script.textContent = noteScript; doc.documentElement.append(script); script.remove();
  }
  function unload() { noteDocuments.delete(doc); }
  function cleanup() {
    doc.removeEventListener('DOMContentLoaded', inject);
    win.removeEventListener('unload', unload);
    try { win.wrappedJSObject.__tikzcdNotes?.dispose(); } catch (error) { Zotero.debug('TikZ-CD cleanup: ' + error); }
  }
  noteDocuments.set(doc, cleanup);
  win.addEventListener('unload', unload, { once:true });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', inject, { once:true });
  else inject();
}

function attach(win) {
  if (stopped || windows.has(win)) return;
  const doc = win.document;
  const popup = doc.getElementById('menu_ToolsPopup');
  if (!popup) return;
  const item = doc.createXULElement('menuitem');
  item.id = 'tikzcd-preview-open';
  item.setAttribute('label', 'TikZ-CD Preview…');
  function open() {
    const preview = win.openDialog('chrome://tikzcd-preview/content/index.html', '', 'chrome,centerscreen,resizable,width=1100,height=720');
    previews.add(preview);
    // openDialog can first unload about:blank. Only unregister the real page.
    preview.addEventListener('unload', event => {
      if (event.target.documentURI === 'chrome://tikzcd-preview/content/index.html') previews.delete(preview);
    });
  }
  function cleanup() {
    item.removeEventListener('command', open); item.remove();
    win.removeEventListener('unload', cleanup); windows.delete(win);
  }
  item.addEventListener('command', open); popup.append(item);
  win.addEventListener('unload', cleanup, { once: true }); windows.set(win, cleanup);
}
async function startup({ rootURI }) {
  const revision = ++generation;
  stopped = false;
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;
  if (stopped || revision !== generation) return;
  noteScript = await Zotero.File.getResourceAsync(rootURI + 'content/note.js');
  if (stopped || revision !== generation) return;
  const startupService = Components.classes['@mozilla.org/addons/addon-manager-startup;1'].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = startupService.registerChrome(Services.io.newURI(rootURI + 'manifest.json'), [['content', 'tikzcd-preview', 'content/']]);
  for (const win of Zotero.getMainWindows()) attach(win);
  // Observe note documents directly; do not stack/replace Zotero.Notes hooks
  // used by other plugins such as LaTeX Suite.
  noteObserver = { observe(doc) { try { attachNote(doc); } catch (error) { Zotero.logError(error); } } };
  Services.obs.addObserver(noteObserver, 'document-element-inserted');
  for (const instance of Zotero.Notes._editorInstances || []) attachNote(instance._iframeWindow?.document);
}
function onMainWindowLoad({ window }) { if (chromeHandle) attach(window); }
function onMainWindowUnload({ window }) { windows.get(window)?.(); }
function shutdown() {
  stopped = true; generation++;
  if (noteObserver) Services.obs.removeObserver(noteObserver, 'document-element-inserted');
  noteObserver = null;
  for (const cleanup of noteDocuments.values()) cleanup();
  noteDocuments.clear(); noteScript = null;
  for (const cleanup of [...windows.values()]) cleanup();
  for (const preview of previews) if (!preview.closed) preview.close();
  previews.clear(); chromeHandle?.destruct(); chromeHandle = null;
}
function install() {}
function uninstall() {}
