function startup() { run().catch(e => IOUtils.writeUTF8(CONFIG.result, JSON.stringify({done:true,error:String(e),stack:e.stack}))); }
function shutdown() {}
function install() {}
function uninstall() {}
async function run() {
  await Zotero.initializationPromise;
  await Zotero.uiReadyPromise;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const doc = Zotero.getMainWindow().document;
  for(let i=0;i<100&&!doc.getElementById('tikzcd-preview-open');i++) await Zotero.Promise.delay(100);
  const menu = doc.getElementById('tikzcd-preview-open');
  check(menu, 'Plugin installs and adds Tools menu'); menu.doCommand();
  let win;
  for(let i=0;i<100;i++) {
    win = [...Services.wm.getEnumerator(null)].find(w=>w.location.href==='chrome://tikzcd-preview/content/index.html');
    if(win?.TikzcdPreview && win.document.querySelector('.tikzcd-diagram')?.style.visibility==='') break;
    await Zotero.Promise.delay(100);
  }
  check(win?.TikzcdPreview, 'Preview window loads its offline bundle');
  const preview = win.document.getElementById('preview');
  check(preview.querySelectorAll('.vertex').length===4, 'Example renders four objects');
  check(preview.querySelectorAll('.arrow').length===4, 'Example renders four arrows');
  check(!preview.querySelector('.arrow.invalid'), 'No invalid example arrows');
  const boxes = [...preview.querySelectorAll('.vertex .label')].map(n=>n.getBoundingClientRect());
  check(boxes.every(r=>r.width>0 && r.height>0), 'Labels measured with real font metrics');
  check(boxes[1].left>boxes[0].right && boxes[2].top>boxes[0].bottom, 'Grid places labels without overlap');
  const canvas = win.document.createElement('canvas');
  canvas.width=win.innerWidth; canvas.height=win.innerHeight;
  canvas.getContext('2d').drawWindow(win,0,0,canvas.width,canvas.height,'white');
  const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), c=>c.charCodeAt(0));
  await IOUtils.write(CONFIG.screenshot, bytes);
  const tests = [
    String.raw`\begin{tikzcd} A \arrow[r,bend left,"f"] \arrow[r,bend right,"g"'] & B \end{tikzcd}`,
    String.raw`\begin{tikzcd} A \arrow[loop,in=55,out=125,"f"] \end{tikzcd}`,
    String.raw`\begin{tikzcd} A \arrow[r,hook] & B \arrow[r,two heads] & C \end{tikzcd}`,
    String.raw`\begin{tikzcd} {\frac{\mathbb{E}[X]}{\sum_{i=1}^n x_i}} \arrow[r,"\alpha"] & {\int_0^1 f(x)\,dx} \end{tikzcd}`,
  ];
  const samples=[];
  for (const source of tests) {
    const host=win.document.createElement('div'); win.document.body.append(host);
    const start=Date.now();
    const result=await win.TikzcdPreview.renderTikzcd(host,source);
    check(result.edges>0,'Fixture has arrows');
    check(!result.element.querySelector('.arrow.invalid'),'Fixture arrows valid');
    check(result.element.querySelectorAll('.katex').length>=result.vertices,'Fixture math labels rendered');
    check(result.width>32 && result.height>32,'Fixture has real dimensions');
    check(!/NaN|Infinity/.test(result.element.innerHTML),'Finite geometry');
    samples.push({ms:Date.now()-start,width:result.width,height:result.height});
    result.dispose(); host.remove();
  }
  const source=win.document.getElementById('source');
  for(let i=0;i<8;i++) await win.TikzcdPreview.render();
  check(preview.querySelectorAll('.tikzcd-diagram').length===1,'Repeated rendering does not accumulate roots');
  source.value='invalid'; await win.TikzcdPreview.render();
  check(!preview.querySelector('.tikzcd-diagram'),'Malformed input clears stale output');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  await (await AddonManager.getAddonByID('tikzcd-preview@yuukibarns')).disable();
  check(!doc.getElementById('tikzcd-preview-open'),'Disable removes menu');
  for(let i=0;i<20&&!win.closed;i++) await Zotero.Promise.delay(50);
  check(win.closed,'Disable closes preview');
  await IOUtils.writeUTF8(CONFIG.result,JSON.stringify({done:true,passed:true,zotero:Zotero.version,samples,screenshot:CONFIG.screenshot}));
}
