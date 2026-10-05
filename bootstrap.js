var chromeHandle;
var windows = new Map();
var previews = new Set();
var stopped = true;
var generation = 0;

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
  const startupService = Components.classes['@mozilla.org/addons/addon-manager-startup;1'].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = startupService.registerChrome(Services.io.newURI(rootURI + 'manifest.json'), [['content', 'tikzcd-preview', 'content/']]);
  for (const win of Zotero.getMainWindows()) attach(win);
}
function onMainWindowLoad({ window }) { if (chromeHandle) attach(window); }
function onMainWindowUnload({ window }) { windows.get(window)?.(); }
function shutdown() {
  stopped = true; generation++;
  for (const cleanup of [...windows.values()]) cleanup();
  for (const preview of previews) if (!preview.closed) preview.close();
  previews.clear(); chromeHandle?.destruct(); chromeHandle = null;
}
function install() {}
function uninstall() {}
