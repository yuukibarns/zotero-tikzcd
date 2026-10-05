function startup(){run().catch(e=>IOUtils.writeUTF8(CONFIG.result,JSON.stringify({done:true,error:String(e),stack:e.stack})));}
function shutdown(){}
function install(){}
function uninstall(){}
async function run(){
  await Zotero.initializationPromise;await Zotero.uiReadyPromise;
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const item=new Zotero.Item('note');item.setNote('<div data-schema-version="9"><p>test</p></div>');await item.saveTx();
  const instance=await Zotero.Notes.open(item.id,undefined,{openInWindow:true});
  const frame=instance._iframeWindow,w=frame.wrappedJSObject;
  frame.docShell.chromeEventHandler.ownerGlobal.resizeTo(1100,850);
  for(let i=0;i<100&&(!w.__tikzcdNotes||!w._currentEditorInstance?._editorCore?.view);i++)await Zotero.Promise.delay(100);
  check(w.__tikzcdNotes,'Note content integration injected');
  if(CONFIG.withLatex){for(let i=0;i<100&&!w.__latexSuite;i++)await Zotero.Promise.delay(100);check(w.__latexSuite,'LaTeX Suite also installed');}
  function inject(code){const script=frame.document.createElement('script');script.textContent=code;frame.document.head.append(script);script.remove();}
  const source=String.raw`\begin{tikzcd}
A \arrow[r,"f"] \arrow[d,"g"'] & B \arrow[d,"h"] \\
C \arrow[r,"k"'] & D
\end{tikzcd}`;
  inject(`var v=_currentEditorInstance._editorCore.view,sc=v.state.schema;
    var diagram=sc.nodes.math_display.create(null,sc.text(${JSON.stringify(source)}));
    v.dispatch(v.state.tr.replaceWith(0,v.state.doc.content.size,[sc.nodes.paragraph.create(null,sc.text('Diagram')),diagram,sc.nodes.math_display.create(null,sc.text('a+b')),sc.nodes.paragraph.create(null,sc.nodes.math_inline.create(null,sc.text('x^2'))),sc.nodes.paragraph.create(null,sc.text('after'))]));
    var S=Object.getPrototypeOf(v.state.selection.constructor);v.dispatch(v.state.tr.setSelection(S.fromJSON(v.state.doc,{type:'text',anchor:1,head:1})));v.focus();
    window.math=document.querySelector('math-display').pmViewDesc.spec;
    window.savedBefore=JSON.stringify(v.state.doc.toJSON());
  `);
  const doc=frame.document;
  async function waitFor(fn,message){for(let i=0;i<100&&!fn();i++)await Zotero.Promise.delay(50);check(fn(),message);}
  await waitFor(()=>doc.querySelector('math-display .math-render .tikzcd-diagram')?.style.visibility==='','Closed diagram renders');
  check(doc.querySelectorAll('math-display .tikzcd-diagram .vertex').length===4,'Four diagram vertices');
  check(doc.querySelectorAll('math-display')[1].querySelector('.katex'),'Ordinary display math unchanged');
  check(doc.querySelector('math-inline .katex'),'Inline math unchanged');
  inject('window.savedAfter=JSON.stringify(v.state.doc.toJSON());window.serialized=JSON.stringify(getDataSync());');
  check(w.savedBefore===w.savedAfter,'Rendering did not change note document');
  check(!w.serialized.includes('tikzcd-note-surface')&&!w.serialized.includes('tikzcd-diagram'),'Generated diagram is not serialized into source');
  // Open through native pointer events, not a direct call to openEditor.
  const rect=doc.querySelector('math-display .vertex .label').getBoundingClientRect();
  frame.windowUtils.sendMouseEvent('mousedown',rect.x+rect.width/2,rect.y+rect.height/2,0,1,0);
  frame.windowUtils.sendMouseEvent('mouseup',rect.x+rect.width/2,rect.y+rect.height/2,0,1,0);
  await waitFor(()=>!!w.math._innerView,'Click opens native source editor');
  await waitFor(()=>doc.querySelector('math-display > .tikzcd-note-surface .tikzcd-diagram'),'Preview below source while editing');
  if(CONFIG.withLatex){await Zotero.Promise.delay(300);const p=doc.getElementById('latex-suite-math-preview');check(!p||frame.getComputedStyle(p).display==='none','No duplicate LaTeX Suite preview');}
  inject(`var inner=math._innerView;inner.dispatch(inner.state.tr.insertText('X',0+${source.indexOf('A')},${source.indexOf('A')+1}));inner.focus();`);
  await waitFor(()=>doc.querySelector('.tikzcd-note-output')?.dataset.source?.includes('X \\arrow'),'Source edit refreshes diagram');
  check(w.math._innerView.state.doc.textContent.includes('X \\arrow'),'Native source edit kept');
  // Record the editing view for visual inspection.
  const canvas=doc.createElement('canvas');canvas.width=frame.innerWidth;canvas.height=frame.innerHeight;
  canvas.getContext('2d').drawWindow(frame,0,0,canvas.width,canvas.height,'white');
  await IOUtils.write(CONFIG.screenshot,Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)));
  // Close natively by moving the outer selection, then reopen the note.
  inject(`v.dispatch(v.state.tr.setSelection(S.fromJSON(v.state.doc,{type:'text',anchor:1,head:1})));v.focus();`);
  await waitFor(()=>!w.math._innerView&&doc.querySelector('.math-render .tikzcd-diagram'),'Closing preserves the rendered diagram');
  // Switch the same live node to ordinary source, then restore it.
  inject(`math.update(math._node.type.create(null,sc.text('a+b')));`);
  check(!doc.querySelector('math-display').hasAttribute('data-tikzcd'),'Ordinary source removes diagram routing');
  check(doc.querySelector('math-display .katex'),'Ordinary source restores KaTeX');
  inject(`math.update(diagram);`);
  await waitFor(()=>doc.querySelector('math-display .tikzcd-diagram')?.style.visibility==='','Switch back to diagram');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon=await AddonManager.getAddonByID('tikzcd-preview@yuukibarns');await addon.disable();
  check(!doc.querySelector('.tikzcd-note-surface'),'Disable removes custom rendering');
  check(!w.__tikzcdNotes,'Disable removes content controller');
  check(doc.querySelectorAll('math-display')[1].querySelector('.katex'),'Disable leaves normal equations intact');
  await addon.enable();
  await waitFor(()=>doc.querySelector('math-display .tikzcd-diagram')?.style.visibility==='','Re-enable attaches to existing editor');
  await IOUtils.writeUTF8(CONFIG.result,JSON.stringify({done:true,passed:true,zotero:Zotero.version,withLatex:CONFIG.withLatex,screenshot:CONFIG.screenshot}));
}
