import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('    const REVIEWED_EXPLANATIONS'),html.indexOf('    function renderExam()'));
const context=vm.createContext({});
vm.runInContext('const esc=value=>String(value);\n'+source,context);
const question=(paper,number)=>JSON.parse(readFileSync(new URL('../paper-data/paper-'+paper+'.json',import.meta.url),'utf8')).find(q=>q.number===number);
function feedback(q,selected){context.q=q;context.selected=selected;return vm.runInContext('teachingFeedback(q,selected)',context);}

test('demerit feedback distinguishes first and repeat suspension, with dated rules',()=>{
  const q=question(4,15);
  assert.match(feedback(q,0),/repeat-suspension threshold/);
  assert.match(feedback(q,0),/no previous suspension/);
  assert.match(feedback(q,2),/do not wait until 36/);
  assert.match(feedback(q,1),/Correct — why/);
  assert.match(feedback(q,1),/1 January 2027/);
});
test('hill-start feedback explains the brake transition and apply versus release',()=>{
  assert.match(feedback(question(4,24),1),/Moving that foot to the accelerator can let the car roll backwards/);
  assert.match(feedback(question(4,24),0),/keeping the foot brake pressed prevents/);
  assert.match(feedback(question(3,25),1),/Releasing only the foot brake leaves the handbrake holding/);
  assert.match(feedback(question(3,25),2),/RELEASE/);
  assert.match(feedback(question(1,24),0),/foot brake first/);
});
test('one-year answers distinguish revocation from new-driver probation',()=>{
  assert.match(feedback(question(5,15),2),/revocation date/);
  assert.match(feedback(question(5,15),2),/must pass them/);
  assert.match(feedback(question(5,15),1),/Two years is longer/);
  assert.match(feedback(question(6,16),2),/licence is issued/);
  assert.match(feedback(question(6,16),2),/36 months/);
  assert.match(feedback(question(6,16),0),/Correct — why/);
});
test('reversing explanation contrasts each viewing direction',()=>{
  assert.match(feedback(question(6,29),1),/Looking ahead and at the side leaves the area behind the car unobserved/);
  assert.match(feedback(question(6,29),0),/judge clearance, but misses the path directly behind/);
  assert.match(feedback(question(6,29),2),/Also check around the car periodically/);
});
test('all choices render without fabricated keyword reasons or missing contrast text',()=>{
  for(let paper=1;paper<=10;paper++) {
    const questions=JSON.parse(readFileSync(new URL('../paper-data/paper-'+paper+'.json',import.meta.url),'utf8'));
    for(const q of questions) for(const selected of [undefined,0,1,2]) {
      assert.doesNotMatch(feedback(q,selected),/undefined|safe sequence|must be learned precisely|mirrors alone/);
    }
  }
  assert.match(feedback(question(2,15),1),/reviewed explanation is not available/);
});
