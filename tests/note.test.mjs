import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installMathNodes, isTikzcd } from '../build/note-integration.mjs';
const source = String.raw`\begin{tikzcd} A \arrow[r] & B \end{tikzcd}`;
const pause = () => new Promise(r => setTimeout(r, 10));
function setup(text = source) {
  const dom = new JSDOM('<!doctype html><head></head><body></body>');
  const doc = dom.window.document;
  const node = doc.createElement('math-display'); doc.body.append(node);
  const rendered = doc.createElement('span'), src = doc.createElement('span'); node.append(rendered,src);
  class MathView {
    constructor() { this.dom=node; this._mathRenderElt=rendered; this._mathSrcElt=src; this._outerView={}; this._node={textContent:text}; this.calls=0; }
    renderMath() { this.calls++; rendered.textContent='native:'+this._node.textContent; }
    update(value) { this._node={textContent:value}; if(this._innerView)this._innerView.state.doc=this._node; else this.renderMath(); return true; }
    openEditor() { this._innerView={state:{doc:this._node}}; }
    closeEditor() { this._innerView=null; this.renderMath(); }
    destroy() { node.remove(); }
  }
  const math=new MathView(); node.pmViewDesc={spec:math}; math.renderMath();
  const jobs=[];
  const render=(host,text,{signal})=>new Promise((resolve,reject)=>jobs.push({host,text,signal,resolve,reject}));
  function finish(job=jobs.at(-1)) {
    const element=doc.createElement('div');element.className='tikzcd-diagram';element.textContent=job.text;job.host.append(element);
    job.resolve({element,diagnostics:[],dispose:()=>element.remove()}); return element;
  }
  const controller=installMathNodes(doc,{render,debounce:0});
  return {dom,doc,node,math,jobs,finish,controller};
}
test('recognises only standalone tikzcd starts', () => {
  assert.ok(isTikzcd(source)); assert.ok(isTikzcd('% quiver URL\n'+source));
  assert.ok(isTikzcd('\\[\n'+source+'\\]'));
  assert.ok(!isTikzcd('x + '+source)); assert.ok(!isTikzcd('\\begin{matrix}a\\end{matrix}'));
});
test('closed render and editing preview reuse output without touching source', async () => {
  const x=setup();await pause();x.finish();await pause();
  assert.ok(x.math._mathRenderElt.querySelector('.tikzcd-diagram'));
  assert.equal(x.math._node.textContent,source);
  x.math.openEditor();assert.equal(x.node.querySelector('.tikzcd-note-surface').parentNode,x.node);
  x.math.closeEditor();assert.equal(x.jobs.length,1);
  assert.equal(x.node.querySelector('.tikzcd-note-surface').parentNode,x.math._mathRenderElt);
  x.controller.dispose();assert.equal(x.node.getAttribute('data-tikzcd'),null);
  assert.equal(x.math._mathRenderElt.textContent,'native:'+source);x.dom.window.close();
});
test('late async completion cannot overwrite a newer source', async () => {
  const x=setup();await pause();const first=x.jobs[0];
  x.math.update(source.replace('A','X'));await pause();
  assert.ok(first.signal.aborted);x.finish(x.jobs[1]);await pause();
  const stale=x.finish(first);await pause();assert.ok(!stale.isConnected);
  assert.equal(x.node.querySelectorAll('.tikzcd-diagram').length,1);
  assert.ok(x.node.querySelector('.tikzcd-diagram').textContent.includes('X'));
  x.controller.dispose();x.dom.window.close();
});
test('typing an ordinary equation restores native rendering', async () => {
  const x=setup();await pause();x.finish();await pause();
  x.math.openEditor();x.math.update('a+b');
  assert.ok(!x.node.hasAttribute('data-tikzcd'));assert.equal(x.math._mathRenderElt.textContent,'native:a+b');
  x.controller.dispose();x.dom.window.close();
});
test('ordinary equations and detached preview facades delegate unchanged', async () => {
  const x=setup('a+b');x.math.renderMath();await pause();assert.equal(x.jobs.length,0);
  assert.equal(x.math.calls,2);
  const facade={calls:0,_node:{textContent:'facade'}};
  x.math.renderMath.call(facade);assert.equal(facade.calls,1);assert.equal(x.jobs.length,0);
  x.controller.dispose();x.dom.window.close();
});
test('destroy aborts render and removes retained state', async () => {
  const x=setup();await pause();x.math.destroy();
  assert.ok(x.jobs[0].signal.aborted);assert.equal(x.controller.count,0);
  const late=x.finish();await pause();assert.ok(!late.isConnected);
  x.controller.dispose();x.dom.window.close();
});
test('syntax errors retain the previous diagram with an explicit message', async () => {
  const x=setup();await pause();x.finish();await pause();
  x.math.openEditor();x.math.update('\\begin{tikzcd} A');await pause();x.jobs.at(-1).reject(new Error('Missing end'));await pause();
  assert.equal(x.node.querySelectorAll('.tikzcd-diagram').length,1);
  assert.match(x.node.querySelector('.tikzcd-note-status').textContent,/Showing previous diagram.*Missing end/);
  x.controller.dispose();x.dom.window.close();
});
test('disable does not overwrite a newer third-party wrapper', async () => {
  const x=setup();await pause();const old=x.math.renderMath;
  function other(){return old.call(this);}x.math.renderMath=other;
  x.controller.dispose();assert.equal(x.math.renderMath,other);
  x.math.renderMath();assert.equal(x.math._mathRenderElt.textContent,'native:'+source);
  x.finish();await pause();x.dom.window.close();
});
