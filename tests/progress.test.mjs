import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('    const PAPERS ='), html.indexOf('    $("#homeButton").addEventListener'));
const key = 'ft-offline-practice-v1';
function app(storage = new Map()) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {innerHTML:'', dataset:{}, classList:{toggle(){}}, setAttribute(){}, removeAttribute(){}});
    return elements.get(selector);
  };
  const context = vm.createContext({
    localStorage: {getItem:k=>storage.get(k), setItem:(k,v)=>storage.set(k,v)},
    document: {querySelector:element, querySelectorAll:()=>[], body:element('body')},
    confirm:()=>true, alert:message=>{throw new Error(message);},
    fetch:async path=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'))}),
  });
  vm.runInContext(script + '\nrenderExam=()=>{}; renderResult=()=>{}; show=()=>{};', context);
  return {run:code=>vm.runInContext(code,context), storage, element};
}
const stored = instance => JSON.parse(instance.storage.get(key)||'{}');

test('only Paper 1 is completed after submitting, navigating, and repeated reloads', async()=>{
  let instance=app();
  await instance.run('startPaper("1",false)');
  instance.run('state.answers={...PAPER_META["1"].answerKey}; submitPaper(); goHome(); renderScores();');
  for(let i=0;i<5;i++) {
    assert.deepEqual(Object.keys(stored(instance)), ['1']);
    assert.match(instance.element('#scoreSummary').innerHTML, /1\/10/);
    instance=app(instance.storage);
    instance.run('renderHome(); renderScores();');
  }
  await instance.run('startPaper("4",false)');
  assert.equal(stored(instance)['4'].submitted,false);
  assert.deepEqual(stored(instance)['4'].answers,{});
  assert.equal(stored(instance)['1'].submitted,true);
});

test('mislabeled records are ignored; partial records cannot inherit completion',async()=>{
  const instance=app();
  await instance.run('startPaper("1",false)');
  instance.run('state.answers={1:0}; submitPaper();');
  const records=stored(instance);
  records['4']={...records['1']};
  records['8']={paper:8,answers:{1:1}};
  records['10']={paper:10,submitted:'true',answers:{1:2}};
  instance.storage.set(key,JSON.stringify(records));
  instance.run('renderScores()');
  assert.match(instance.element('#scoreSummary').innerHTML,/1\/10/);
  await instance.run('startPaper("8",false)');
  assert.equal(stored(instance)['8'].submitted,false);
  assert.deepEqual(stored(instance)['8'].answers,{'1':1});
  assert.equal(instance.run('state.order.length'),50);
  // Keep rejected legacy records untouched for recovery; never copy them to another paper.
  assert.equal(stored(instance)['4'].paper,1);
});

test('reset is not resurrected by navigating or saving stale state',async()=>{
  const instance=app();
  await instance.run('startPaper("1",false)');
  instance.run('state.answers={1:0}; writeStore(); goHome(); resetPaper("1"); openScores(); goHome(); writeStore();');
  assert.deepEqual(stored(instance),{});
});

test('last requested paper wins when loads resolve out of order',async()=>{
  const instance=app();
  instance.run('const pending={}; ensurePaper=id=>new Promise(resolve=>pending[id]=resolve); PAPERS["4"]=[{number:1}]; PAPERS["8"]=[{number:1}];');
  const first=instance.run('startPaper("4",false)');
  const second=instance.run('startPaper("8",false)');
  instance.run('pending["8"](true)'); await second;
  instance.run('pending["4"](true)'); await first;
  assert.equal(instance.run('state.paper'),8);
  assert.deepEqual(Object.keys(stored(instance)),['8']);
});

test('leaving the paper picker cancels pending navigation',async()=>{
  const instance=app();
  instance.run('let finish; ensurePaper=()=>new Promise(resolve=>finish=resolve);');
  const pending=instance.run('startPaper("4",false)');
  instance.run('goHome(); finish(true)'); await pending;
  assert.deepEqual(stored(instance),{});
});

test('malformed top-level storage does not break rendering',()=>{
  for(const value of ['null','[]','false','{']) {
    const instance=app(new Map([[key,value]]));
    instance.run('renderHome(); renderScores();');
    assert.match(instance.element('#scoreSummary').innerHTML,/0\/10/);
  }
});
