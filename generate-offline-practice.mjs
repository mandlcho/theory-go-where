import { readFile, writeFile } from "node:fs/promises";

const here = new URL("./", import.meta.url);
const readText = (name) => readFile(new URL(name, here), "utf8");

function normalizeRaw(paper, rows) {
  return rows.map((row) => ({
    paper,
    number: Number(row.number),
    question: row.question,
    image: row.media?.[0]
      ? { alt: `Paper ${paper}, question ${row.number} diagram`, src: row.media[0].src }
      : null,
    options: row.options.map((option, index) => ({
      label: "ABC"[index],
      text: option.text,
      correct: Boolean(option.correct),
    })),
  }));
}

function parsePaper6(markdown) {
  return markdown
    .split(/^##\s+/m)
    .slice(1)
    .map((section) => {
      const lines = section.split("\n");
      const heading = lines.shift()?.trim() ?? "";
      const match = heading.match(/^(\d+)\.\s+(.+)$/);
      const number = Number(match?.[1] ?? 0);
      const imageLine = lines.find((line) => line.startsWith("!["));
      const imageMatch = imageLine?.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const options = lines
        .filter((line) => /^- [A-C]\./.test(line))
        .map((line) => {
          const option = line.match(/^- ([A-C])\. (.*?)(?: — \*\*(?:✓ Correct|Your answer)\*\*)?$/);
          return {
            label: option?.[1] ?? "",
            text: option?.[2] ?? line,
            correct: line.includes("**✓ Correct**"),
          };
        });
      return {
        paper: 6,
        number,
        question: match?.[2] ?? heading,
        image: imageMatch ? { alt: imageMatch[1], src: imageMatch[2] } : null,
        options,
      };
    });
}

const rawPapers = {
  2: normalizeRaw(2, JSON.parse(await readText("final-theory-paper-2.json"))),
  4: normalizeRaw(4, JSON.parse(await readText("final-theory-paper-4.json"))),
  5: normalizeRaw(5, JSON.parse(await readText("final-theory-paper-5.json"))),
  6: parsePaper6(await readText("final-theory-paper-6.md")),
  9: normalizeRaw(9, JSON.parse(await readText("final-theory-paper-9.json"))),
};

for (const questions of Object.values(rawPapers)) {
  if (questions.length !== 50) throw new Error(`Expected 50 questions, found ${questions.length}`);
  for (const question of questions) {
    if (question.options.length !== 3 || question.options.filter((option) => option.correct).length !== 1) {
      throw new Error(`Invalid answer key: Paper ${question.paper}, question ${question.number}`);
    }
    if (question.image) {
      const filename = new URL(question.image.src).pathname.split("/").pop();
      const bytes = await readFile(new URL(`offline-assets/${filename}`, here));
      question.image.src = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    }
  }
}

const appData = JSON.stringify(rawPapers).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Offline Final Theory practice papers">
  <title>Final Theory · Offline Practice</title>
  <style>
    :root {
      color-scheme: light;
      --navy:#092a44; --blue:#075985; --sky:#e8f3f9; --ink:#15202b; --muted:#607080;
      --paper:#f3f5f7; --card:#fff; --line:#d9e0e6; --green:#16824b; --green-bg:#e8f7ef;
      --red:#b42318; --red-bg:#fcebea; --amber:#a15c00; --amber-bg:#fff3d6;
      --shadow:0 18px 45px rgba(9,42,68,.10);
    }
    *{box-sizing:border-box} html{scroll-behavior:smooth}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    button,input{font:inherit} button{cursor:pointer}
    button:focus-visible,input:focus-visible{outline:3px solid rgba(7,89,133,.25);outline-offset:2px}
    .topbar{background:linear-gradient(135deg,var(--navy),var(--blue));color:#fff;padding:18px 20px;box-shadow:0 3px 16px rgba(9,42,68,.18)}
    .topbar-inner{width:min(1160px,100%);margin:auto;display:flex;align-items:center;justify-content:space-between;gap:18px}
    .brand{display:flex;align-items:center;gap:12px}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(255,255,255,.12);font-weight:900}
    .brand h1{margin:0;font-size:1.08rem;letter-spacing:-.015em}.brand p{margin:1px 0 0;color:rgba(255,255,255,.68);font-size:.78rem}
    .ghost-light{border:1px solid rgba(255,255,255,.35);border-radius:9px;background:transparent;color:#fff;padding:9px 13px;font-weight:750}
    main{width:min(1160px,calc(100% - 28px));margin:30px auto 64px}
    .hero{padding:28px 0 16px}.kicker{margin:0 0 8px;color:var(--blue);font-size:.77rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
    .hero h2{margin:0;max-width:720px;font-size:clamp(2rem,5vw,3.6rem);line-height:1.02;letter-spacing:-.05em}.hero-copy{max-width:650px;margin:14px 0 0;color:var(--muted);font-size:1.02rem}
    .status-strip{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.chip{padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:.82rem;font-weight:750}
    .paper-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:14px;margin-top:24px}
    .paper-card{display:flex;min-height:210px;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:0 8px 25px rgba(9,42,68,.05)}
    .paper-card:hover{border-color:#9bb9cb;transform:translateY(-1px)}.paper-no{color:var(--blue);font-size:.76rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .paper-card.placeholder{border-style:dashed;background:#f8fafb;box-shadow:none}.paper-card.placeholder:hover{border-color:var(--line);transform:none}.paper-card.placeholder .paper-no,.paper-card.placeholder h3{color:#71808d}
    .paper-card h3{margin:7px 0 3px;font-size:1.55rem;letter-spacing:-.03em}.paper-meta{margin:0;color:var(--muted);font-size:.87rem}
    .paper-progress{height:7px;margin:18px 0 8px;overflow:hidden;border-radius:999px;background:#e8edf1}.paper-progress i{display:block;height:100%;background:var(--blue)}
    .progress-label{margin:0;color:var(--muted);font-size:.78rem}.card-actions{display:flex;gap:8px;margin-top:auto;padding-top:16px}
    .btn{min-height:42px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);padding:0 14px;font-weight:800}.btn:hover{border-color:#99aab7}
    .btn.primary{border-color:var(--blue);background:var(--blue);color:#fff}.btn.primary:hover{background:var(--navy)}.btn.danger{color:var(--red)}.btn.small{min-height:36px;padding:0 10px;font-size:.82rem}.btn:disabled{cursor:not-allowed;border-color:#dce2e7;background:#edf1f4;color:#7a8791}
    .exam-shell{display:grid;grid-template-columns:minmax(0,1fr) 285px;gap:20px;align-items:start}
    .exam-main,.sidebar{border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:var(--shadow)}
    .exam-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid var(--line)}
    .exam-head h2{margin:0;font-size:1.15rem}.exam-sub{margin:2px 0 0;color:var(--muted);font-size:.82rem}.answered-count{font-size:.82rem;font-weight:800;color:var(--blue)}
    .bar{height:5px;background:#e6edf1}.bar i{display:block;height:100%;background:var(--blue);transition:width .25s}
    .question{padding:26px 28px 30px}.q-label{margin:0 0 9px;color:var(--blue);font-size:.76rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .question h3{margin:0;font-size:clamp(1.16rem,2.4vw,1.52rem);line-height:1.4;letter-spacing:-.02em}
    .diagram{display:block;width:min(100%,620px);max-height:390px;object-fit:contain;margin:22px auto 4px;border:1px solid var(--line);border-radius:13px;background:#f8fafb}
    .choices{display:grid;gap:11px;margin-top:24px}.choice{display:grid;grid-template-columns:auto 34px 1fr auto;gap:11px;align-items:center;padding:14px 15px;border:1px solid var(--line);border-radius:12px;background:#fff;transition:.12s}
    .choice:hover{border-color:#9bb9cb;background:#fafcfd}.choice input{width:18px;height:18px;margin:0;accent-color:var(--blue)}.choice-letter{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#edf3f7;color:var(--blue);font-weight:900}
    .choice.correct{border-color:#89caa6;background:var(--green-bg)}.choice.wrong{border-color:#e8a39d;background:var(--red-bg)}.choice .answer-tag{font-size:.76rem;font-weight:900}.correct .answer-tag{color:var(--green)}.wrong .answer-tag{color:var(--red)}
    .exam-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:17px 22px;border-top:1px solid var(--line)}.exam-actions .spacer{flex:1}
    .sidebar{position:sticky;top:18px;padding:18px}.sidebar h3{margin:0 0 4px;font-size:.95rem}.sidebar-note{margin:0 0 13px;color:var(--muted);font-size:.78rem}
    .palette{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.q-dot{display:grid;place-items:center;aspect-ratio:1;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--muted);font-size:.76rem;font-weight:850}
    .q-dot:hover{border-color:#8caabd}.q-dot.active{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue);color:var(--blue)}.q-dot.answered{background:var(--sky);color:var(--blue)}.q-dot.flagged{background:var(--amber-bg);color:var(--amber)}
    .q-dot.review-correct{background:var(--green-bg);border-color:#8bc9a6;color:var(--green)}.q-dot.review-wrong{background:var(--red-bg);border-color:#e5a39d;color:var(--red)}
    .legend{display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;margin-top:15px;color:var(--muted);font-size:.72rem}.legend span{display:flex;align-items:center;gap:6px}.swatch{width:11px;height:11px;border-radius:3px;border:1px solid var(--line);background:#fff}.swatch.done{background:var(--sky)}.swatch.flag{background:var(--amber-bg)}
    .result-panel{padding:30px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:var(--shadow);text-align:center}.score-ring{display:grid;place-items:center;width:138px;height:138px;margin:6px auto 18px;border-radius:50%;background:conic-gradient(var(--green) var(--score),#e6ecef 0);position:relative}.score-ring:after{content:"";position:absolute;inset:12px;border-radius:50%;background:#fff}.score-value{position:relative;z-index:1}.score-value strong{display:block;font-size:2rem;line-height:1}.score-value span{color:var(--muted);font-size:.75rem}
    .result-panel h2{margin:0;font-size:2rem;letter-spacing:-.04em}.result-panel p{color:var(--muted)}.result-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:9px;margin-top:20px}
    .notice{margin:18px 0 0;padding:12px 14px;border-radius:10px;background:var(--amber-bg);color:#6c4705;font-size:.87rem}
    .teaching{margin-top:18px;padding:16px 17px;border:1px solid #b8d4e3;border-radius:13px;background:#eef7fb;color:#18384b;text-align:left}
    .teaching-label{display:block;margin-bottom:6px;color:var(--blue);font-size:.72rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}
    .teaching p{margin:0;line-height:1.62}.teaching strong{color:var(--navy)}
    .source-link{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:7px 10px;border:1px solid #a8c9da;border-radius:8px;background:#fff;color:var(--blue);font-size:.78rem;font-weight:850;text-decoration:none}.source-link:hover{text-decoration:underline;border-color:var(--blue)}
    [hidden]{display:none!important}.empty{padding:50px 20px;text-align:center;color:var(--muted)}
    footer{text-align:center;color:var(--muted);font-size:.75rem;padding:0 20px 30px}
    @media(max-width:860px){.exam-shell{grid-template-columns:1fr}.sidebar{position:static;order:-1}.palette{grid-template-columns:repeat(10,1fr)}}
    @media(max-width:600px){main{width:min(100% - 18px,1160px);margin-top:18px}.topbar{padding:13px 12px}.brand p{display:none}.hero{padding-top:16px}.paper-grid{grid-template-columns:1fr 1fr}.paper-card{min-height:190px;padding:15px}.paper-card h3{font-size:1.25rem}.card-actions{flex-direction:column}.question{padding:20px 16px}.choice{grid-template-columns:auto 30px 1fr;padding:12px 10px}.choice .answer-tag{grid-column:3}.exam-actions{padding:14px}.palette{grid-template-columns:repeat(10,1fr);gap:4px}.sidebar{padding:13px}.q-dot{border-radius:5px}.topbar .ghost-light{display:none}}
    @media print{.topbar,.sidebar,.exam-actions{display:none!important}body{background:#fff}.exam-shell{display:block}.exam-main{box-shadow:none}.question{break-inside:avoid}}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><span class="brand-mark">FT</span><div><h1>Final Theory Practice</h1><p>Personal offline study copy</p></div></div>
      <button id="homeButton" class="ghost-light" type="button" hidden>All papers</button>
    </div>
  </header>
  <main>
    <section id="homeView">
      <div class="hero">
        <p class="kicker">Offline practice library</p>
        <h2>Build confidence, one paper at a time.</h2>
        <p class="hero-copy">Choose a completed CDC e-Trial paper. Answers stay hidden until you submit, progress is saved on this device, and every diagram works without internet.</p>
        <div id="statusStrip" class="status-strip"></div>
      </div>
      <div id="paperGrid" class="paper-grid"></div>
    </section>

    <section id="examView" hidden>
      <div class="exam-shell">
        <article class="exam-main">
          <header class="exam-head"><div><h2 id="examTitle"></h2><p id="examSub" class="exam-sub"></p></div><span id="answeredCount" class="answered-count"></span></header>
          <div class="bar"><i id="progressBar"></i></div>
          <div id="questionArea" class="question"></div>
          <nav class="exam-actions" aria-label="Question navigation">
            <button id="prevButton" class="btn" type="button">Previous</button>
            <button id="flagButton" class="btn" type="button">Flag</button>
            <span class="spacer"></span>
            <button id="nextButton" class="btn primary" type="button">Next</button>
            <button id="submitButton" class="btn primary" type="button">Submit paper</button>
          </nav>
        </article>
        <aside class="sidebar">
          <h3>Question palette</h3><p class="sidebar-note">Jump to any question.</p>
          <div id="palette" class="palette"></div>
          <div class="legend"><span><i class="swatch done"></i>Answered</span><span><i class="swatch flag"></i>Flagged</span><span><i class="swatch"></i>Unanswered</span></div>
        </aside>
      </div>
    </section>

    <section id="resultView" hidden></section>
  </main>
  <footer>Questions captured from completed CDC e-Trial review pages on 31 August 2026. Teaching notes link to official Singapore Traffic Police and LTA guidance; source links require internet access. For personal study use.</footer>

  <script>
    const PAPERS = ${appData};
    const STORAGE_KEY = "ft-offline-practice-v1";
    const PASS_MARK = 45;
    const $ = (selector) => document.querySelector(selector);
    const homeView = $("#homeView"), examView = $("#examView"), resultView = $("#resultView");
    const state = { paper:null, index:0, order:[], answers:{}, flags:[], submitted:false, startedAt:null };

    function esc(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
    function readStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
    function writeStore(update) { const all=readStore(); all[String(state.paper)] = update || snapshot(); localStorage.setItem(STORAGE_KEY,JSON.stringify(all)); }
    function snapshot() { return {paper:state.paper,index:state.index,order:state.order,answers:state.answers,flags:state.flags,submitted:state.submitted,startedAt:state.startedAt}; }
    function shuffle(list) { const copy=[...list]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; }
    function paperQuestions() { return PAPERS[String(state.paper)]; }
    function currentQuestion() { return paperQuestions().find((q)=>q.number===state.order[state.index]); }
    function answerCount() { return Object.keys(state.answers).length; }

    function show(view) { homeView.hidden=view!=="home"; examView.hidden=view!=="exam"; resultView.hidden=view!=="result"; $("#homeButton").hidden=view==="home"; window.scrollTo({top:0,behavior:"smooth"}); }
    function goHome() { if(state.paper && !state.submitted) writeStore(); renderHome(); show("home"); }

    function renderHome() {
      const store=readStore(); const readyIds=Object.keys(PAPERS).sort((a,b)=>Number(a)-Number(b)); const ids=Array.from({length:10},(_,i)=>String(i+1));
      const total=readyIds.reduce((sum,id)=>sum+PAPERS[id].length,0); const images=readyIds.reduce((sum,id)=>sum+PAPERS[id].filter(q=>q.image).length,0);
      $("#statusStrip").innerHTML='<span class="chip">'+readyIds.length+' of 10 papers ready</span><span class="chip">'+total+' questions</span><span class="chip">'+images+' offline diagrams</span><span class="chip">Pass mark '+PASS_MARK+'/50</span>';
      $("#paperGrid").innerHTML=ids.map((id)=>{
        if(!PAPERS[id]) return '<article class="paper-card placeholder"><span class="paper-no">Final Theory · Pending</span><h3>Paper '+id+'</h3><p class="paper-meta">Questions not captured yet</p><div class="paper-progress"><i style="width:0%"></i></div><p class="progress-label">Add this paper in a future session</p><div class="card-actions"><button class="btn" type="button" disabled>Not added yet</button></div></article>';
        const saved=store[id]||{}; const answered=Object.keys(saved.answers||{}).length; const score=saved.submitted ? scoreFor(id,saved.answers||{}) : null; const pct=Math.round(answered/50*100);
        const label=saved.submitted ? score+'/50 last score' : answered ? answered+'/50 answered' : 'Not started';
        return '<article class="paper-card"><span class="paper-no">Final Theory</span><h3>Paper '+id+'</h3><p class="paper-meta">50 questions · '+PAPERS[id].filter(q=>q.image).length+' diagrams</p><div class="paper-progress"><i style="width:'+pct+'%"></i></div><p class="progress-label">'+label+'</p><div class="card-actions"><button class="btn primary" data-start="'+id+'">'+(answered&&!saved.submitted?'Resume':'Start')+'</button><button class="btn" data-shuffle="'+id+'">Shuffle</button>'+(answered?'<button class="btn small danger" data-reset="'+id+'" title="Clear saved progress">Reset</button>':'')+'</div></article>';
      }).join("");
      document.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startPaper(b.dataset.start,false)));
      document.querySelectorAll("[data-shuffle]").forEach(b=>b.addEventListener("click",()=>startPaper(b.dataset.shuffle,true)));
      document.querySelectorAll("[data-reset]").forEach(b=>b.addEventListener("click",()=>resetPaper(b.dataset.reset)));
    }

    function resetPaper(id) { if(!confirm("Clear saved progress for Paper "+id+"?")) return; const all=readStore(); delete all[id]; localStorage.setItem(STORAGE_KEY,JSON.stringify(all)); renderHome(); }
    function startPaper(id,randomize) {
      state.paper=Number(id); const saved=readStore()[id]; const numbers=PAPERS[id].map(q=>q.number);
      if(saved && !randomize && !saved.submitted) Object.assign(state,{...saved,paper:Number(id)});
      else Object.assign(state,{paper:Number(id),index:0,order:randomize?shuffle(numbers):numbers,answers:{},flags:[],submitted:false,startedAt:Date.now()});
      writeStore(); renderExam(); show("exam");
    }

    function scoreFor(id,answers) { return PAPERS[String(id)].reduce((sum,q)=>sum+(q.options[Number(answers[q.number])]?.correct?1:0),0); }

    function teachingPrinciple(q) {
      const s=(q.question+" "+q.options.map(o=>o.text).join(" ")).toLowerCase();
      if(/alcohol|drug|drows|tired|fatigue|sleep/.test(s)) return "alcohol, drugs and fatigue reduce judgement and reaction time before a driver may feel seriously impaired; the safe response is to avoid driving or stop and rest";
      if(/stationary vehicle|parked vehicle|parked car|driver in it|move out suddenly/.test(s)) return "a stationary vehicle may pull out, open a door or hide another road user without much warning, so reduce speed and prepare to stop before passing it";
      if(/changing gear.*look|when changing gear|look.*road ahead|attention.*road/.test(s)) return "your eyes should remain on the traffic scene while your hands operate familiar controls; looking down delays hazard detection even for a moment";
      if(/blind spot|mirror|change lane|changing lane|move off|moving off|open.*door|signal/.test(s)) return "safe movement starts with mirrors, a signal and a direct blind-spot check; mirrors alone cannot show every cyclist, motorcycle or vehicle beside you";
      if(/three.second|following distance|follow.*clos|vehicle in front|tailgat|safe gap|time gap/.test(s)) return "a time gap gives you room to perceive, react and brake, and unlike a fixed car-length estimate it grows naturally with speed";
      if(/pedestrian|zebra|elderly|child|cyclist|bicycle|motorcycl/.test(s)) return "vulnerable road users have little physical protection and may move unexpectedly, so a driver should reduce speed, create space and be ready to stop";
      if(/ambulance|emergency vehicle|siren|fire engine|police vehicle/.test(s)) return "emergency vehicles need a clear, predictable path; slow down, keep left and stop if necessary instead of racing them or making a sudden move";
      if(/expressway|tunnel|road shoulder|missed.*exit|break.*down|puncture.*expressway/.test(s)) return "expressway traffic is fast and expects one-way, predictable movement; use the shoulder only for an emergency, never reverse for a missed exit, and continue to the next safe exit";
      if(/brake|braking|skid|slippery|wet road|flood|tyre|tire|puncture|friction/.test(s)) return "traction is limited, especially on wet surfaces or damaged tyres; smooth steering and progressive braking preserve grip while harsh inputs can start a skid";
      if(/bend|curve|centrifugal|corner/.test(s)) return "speed should be reduced before the bend, while the vehicle is straight; entering slowly preserves tyre grip and leaves steering capacity for the curve";
      if(/engine brake|down.*slope|upward slope|downward slope|steep slope|gear|free.?wheel|clutch/.test(s)) return "the correct gear keeps the engine connected to the wheels, giving controlled engine braking and preventing the vehicle from gathering speed";
      if(/traffic light|amber|green light|junction|intersection|roundabout|give way|stop line|crossing/.test(s)) return "a signal or priority rule does not remove the need to observe; approach at a controllable speed, obey the stop or give-way requirement and proceed only when the conflict area is clear";
      if(/overtak|pass.*lorry|pass.*vehicle|large vehicle|lorry|bus|right.*lane|outer.*lane|keep left|lane discipline/.test(s)) return "safe overtaking depends on a clear view, enough space and a legal passing zone; staying back improves visibility and the right lane should not be used as a default cruising lane";
      if(/revers|parking|park your car|parked vehicle|side road/.test(s)) return "reversing and parking create large blind areas and make the front of the car swing out, so move slowly, check all around and give way before committing";
      if(/headlight|high beam|glare|night|dark|dim/.test(s)) return "night safety depends on seeing without dazzling others; dip high beams for oncoming traffic and use the left road edge as a guide if glare affects your vision";
      if(/horn|sound.*horn/.test(s)) return "the horn is a warning device, not a way to claim priority; use it only to prevent danger and still slow down or give way as the situation requires";
      if(/engine oil|over.?heat|radiator|maintenance|vehicle defect|shock absorber|windscreen wiper/.test(s)) return "vehicle defects reduce braking, steering or visibility; stop safely and correct the mechanical problem rather than continuing until control is lost";
      if(/accident|collision|injur|fatal/.test(s)) return "after a collision, protect life and the scene first: stop, obtain help and avoid actions that create another hazard or interfere with an injury investigation";
      if(/speed limit|stopping distance|speed of your vehicle|high speed/.test(s)) return "higher speed increases both reaction distance and braking distance, and it also raises the energy released in a collision";
      if(/demerit|driving test|licen[cs]e|disqualif|suspend/.test(s)) return "this is an exact licensing or demerit-point rule, so the stated threshold in the answer key must be learned precisely rather than estimated";
      if(/sign|road marking|white line|yellow line|bus lane|no entry|no parking|no stopping/.test(s)) return "traffic signs and road markings communicate mandatory priorities, prohibitions and hazards; following them makes every driver's movement predictable";
      if(/seat|seatbelt|seat belt|shoe|pedal|steering|driving position|restraint/.test(s)) return "a stable seating position, suitable footwear and correctly adjusted controls let the driver steer and brake accurately without delay";
      if(/rain|fog|weather|visibility|wind/.test(s)) return "poor weather reduces visibility and grip, so the driver needs lower speed, a larger safety margin and smoother control inputs";
      if(/angry|calm|gesture|aggressive|inconvenience/.test(s)) return "calm, predictable driving prevents one mistake from escalating into road rage or a second unsafe manoeuvre";
      return "the safest option is the one that improves observation, preserves vehicle control and creates time or space before the hazard develops";
    }

    function distractorContrast(choice,q) {
      const s=choice.toLowerCase();
      if(/speed up|drive faster|accelerat|quickly|same speed|maintain.*speed/.test(s)) return "That choice reduces reaction time and increases stopping distance or impact severity instead of creating a safety margin.";
      if(/brake hard|hard.*brake|sudden|immediately.*stop|stop immediately|handbrake/.test(s)) return "That abrupt input can lock the wheels, start a skid or surprise following traffic when a controlled response is available.";
      if(/sound.*horn|horn|flash.*headlight|wave/.test(s)) return "A warning or gesture does not give you right of way and does not remove the physical conflict, so it cannot replace slowing or giving way.";
      if(/overtak|pass on|pass.*vehicle|pass.*lorry/.test(s)) return "That move enters the conflict area with less visibility and less escape space, which is exactly where another road user may appear.";
      if(/mirror.*only|rear window.*only|look.*only|side mirror.*only/.test(s)) return "That check leaves a blind area unobserved; a direct look is needed before the vehicle changes position.";
      if(/assum|as long as you think|expect.*wait|safe.*because/.test(s)) return "It relies on an assumption about another road user rather than confirming that the path is safe.";
      if(/reverse|road shoulder/.test(s)) return "That is an unexpected—and on an expressway generally prohibited—movement that exposes you to fast approaching traffic.";
      if(/neutral|free.?wheel|press.*clutch|clutch.*down/.test(s)) return "It disconnects engine braking and reduces control, allowing speed to build when you most need restraint.";
      if(/high beam/.test(s)) return "It can dazzle the other driver and worsen the danger instead of improving everyone's view.";
      if(/radiator.*cap|cap immediately|pour water/.test(s)) return "A hot cooling system can release scalding steam or be damaged by sudden cooling; allow it to cool before checking it.";
      if(/keep close|drive closer|move close|follow close/.test(s)) return "It removes the space and view needed to react if the situation changes suddenly.";
      if(/one car|two car|metre from/.test(s) && /gap|distance/.test((q.question+" "+q.options.map(o=>o.text).join(" ")).toLowerCase())) return "A fixed distance does not scale with speed, whereas a time gap preserves reaction time at different speeds.";
      if(/right lane|outer lane|centre lane/.test(s)) return "That lane choice can obstruct traffic or place the vehicle in the overtaking path when there is no need to be there.";
      if(/continue|carry on|do nothing|not change.*speed/.test(s)) return "Continuing unchanged leaves no extra time or space for the identified hazard to develop.";
      return "That option does not follow the safe sequence for this situation and leaves the stated risk less controlled than the correct answer.";
    }

    function officialSource(q) {
      const s=(q.question+" "+q.options.map(o=>o.text).join(" ")).toLowerCase();
      if(/demerit|probationary|driving test|licen[cs]e|suspend|revok/.test(s)) return {title:"Traffic Police — Driver Improvement Point System",url:"https://www.police.gov.sg/Knowledge-Hub/Traffic/Traffic-Matters/Driver-Improvement-Point-Systems"};
      if(/alcohol|drink.driv|blood alcohol|disqualif|traffic offence|penalt/.test(s)) return {title:"Traffic Police — Penalties for Traffic Offences",url:"https://www.police.gov.sg/Knowledge-Hub/Traffic/Traffic-Matters/Penalties-for-Traffic-Offences"};
      if(/expressway|tunnel|road shoulder|missed.*exit|break.*down.*expressway|puncture.*expressway/.test(s)) return {title:"LTA — Driving on Expressways and in Tunnels",url:"https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-in-expressway-and-tunnel.html"};
      if(/pedestrian|zebra|elderly|child|visually handicapped/.test(s)) return {title:"Traffic Police — Road Safety Tips for Pedestrians",url:"https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Pedestrians"};
      if(/motorcycl|bicycle|cyclist/.test(s)) return {title:"Traffic Police — Road Safety Tips for Drivers",url:"https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Drivers"};
      if(/traffic sign|road marking|white line|yellow line|bus lane|traffic light|stop line|speed limit|no entry|no parking|no stopping|roundabout|junction/.test(s)) return {title:"LTA — Driving Rules and Information",url:"https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-rules.html"};
      if(/drows|tired|fatigue|blind spot|following distance|tailgat|overtak|emergency vehicle|siren|seatbelt|seat belt/.test(s)) return {title:"Traffic Police — Road Safety Tips for Drivers",url:"https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Drivers"};
      return {title:"Traffic Police — Official Final Driving Theory Handbook",url:"https://www.police.gov.sg/-/media/SPF/Knowledge-Hub/Traffic/FT-ENG-2126-Revised.pdf"};
    }

    function teachingFeedback(q,selected) {
      const correct=q.options.find(o=>o.correct); const chosen=selected===undefined?null:q.options[Number(selected)];
      if(chosen?.correct) return "";
      const opening=chosen?'<strong>Your choice: “'+esc(chosen.text)+'”</strong><br>':'<strong>You left this question unanswered.</strong> ';
      const contrast=chosen?" "+distractorContrast(chosen.text,q):"";
      const source=officialSource(q);
      return '<aside class="teaching"><span class="teaching-label">Learn from this one</span><p>'+opening+'The correct answer is <strong>“'+esc(correct.text)+'”</strong> because '+teachingPrinciple(q)+'.'+contrast+'</p><a class="source-link" href="'+source.url+'" target="_blank" rel="noopener noreferrer">Official source: '+esc(source.title)+' ↗</a></aside>';
    }

    function renderExam() {
      const q=currentQuestion(); const review=state.submitted; const selected=state.answers[q.number];
      $("#examTitle").textContent="Final Theory Paper "+state.paper; $("#examSub").textContent=review?"Answer review":"Choose the best answer. Your progress saves automatically.";
      $("#answeredCount").textContent=answerCount()+" / 50 answered"; $("#progressBar").style.width=(answerCount()/50*100)+"%";
      const image=q.image?'<img class="diagram" src="'+q.image.src+'" alt="'+esc(q.image.alt)+'">':"";
      const choices=q.options.map((option,i)=>{
        let cls="choice", tag=""; if(review&&option.correct){cls+=" correct";tag="Correct";} else if(review&&String(i)===String(selected)&&!option.correct){cls+=" wrong";tag="Your answer";}
        return '<label class="'+cls+'"><input type="radio" name="answer" value="'+i+'" '+(String(i)===String(selected)?'checked':'')+' '+(review?'disabled':'')+'><span class="choice-letter">'+option.label+'</span><span>'+esc(option.text)+'</span><span class="answer-tag">'+tag+'</span></label>';
      }).join("");
      const feedback=review?teachingFeedback(q,selected):"";
      $("#questionArea").innerHTML='<p class="q-label">Question '+q.number+' · '+(state.index+1)+' of 50</p><h3>'+esc(q.question)+'</h3>'+image+'<div class="choices">'+choices+'</div>'+feedback;
      if(!review) document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener("change",()=>{state.answers[q.number]=Number(input.value);writeStore();renderExam();}));
      $("#prevButton").disabled=state.index===0; $("#nextButton").hidden=state.index===49; $("#submitButton").hidden=state.index!==49||review; $("#flagButton").hidden=review;
      $("#flagButton").textContent=state.flags.includes(q.number)?"Unflag":"Flag"; renderPalette();
    }

    function renderPalette() {
      $("#palette").innerHTML=state.order.map((number,index)=>{
        let cls="q-dot"; if(index===state.index) cls+=" active";
        if(state.submitted){const q=paperQuestions().find(x=>x.number===number);cls+=q.options[Number(state.answers[number])]?.correct?" review-correct":" review-wrong";}
        else if(state.flags.includes(number)) cls+=" flagged"; else if(state.answers[number]!==undefined) cls+=" answered";
        return '<button class="'+cls+'" data-index="'+index+'" type="button" aria-label="Question '+number+'">'+number+'</button>';
      }).join("");
      document.querySelectorAll("[data-index]").forEach(b=>b.addEventListener("click",()=>{state.index=Number(b.dataset.index);writeStore();renderExam();window.scrollTo({top:0,behavior:"smooth"});}));
    }

    function submitPaper() {
      const unanswered=50-answerCount(); if(unanswered && !confirm("You still have "+unanswered+" unanswered question"+(unanswered===1?"":"s")+". Submit anyway?")) return;
      state.submitted=true; writeStore(); renderResult(); show("result");
    }
    function renderResult() {
      const score=scoreFor(state.paper,state.answers), pct=score*2, passed=score>=PASS_MARK, missed=50-score;
      resultView.innerHTML='<div class="result-panel"><div class="score-ring" style="--score:'+pct+'%"><div class="score-value"><strong>'+score+'/50</strong><span>'+pct+'%</span></div></div><p class="kicker">Paper '+state.paper+' complete</p><h2>'+(passed?'Pass — well done':'Keep practising')+'</h2><p>You answered '+score+' correctly and have '+missed+' question'+(missed===1?'':'s')+' to review. The pass mark is '+PASS_MARK+'/50.</p><div class="result-actions"><button id="reviewButton" class="btn primary">Review answers</button><button id="retryButton" class="btn">Retry paper</button><button id="resultHome" class="btn">All papers</button></div></div>';
      $("#reviewButton").addEventListener("click",()=>{state.index=0;renderExam();show("exam");});
      $("#retryButton").addEventListener("click",()=>startPaper(String(state.paper),false)); $("#resultHome").addEventListener("click",goHome);
    }

    $("#homeButton").addEventListener("click",goHome); $("#prevButton").addEventListener("click",()=>{if(state.index>0){state.index--;writeStore();renderExam();}});
    $("#nextButton").addEventListener("click",()=>{if(state.index<49){state.index++;writeStore();renderExam();}}); $("#submitButton").addEventListener("click",submitPaper);
    $("#flagButton").addEventListener("click",()=>{const n=currentQuestion().number;state.flags=state.flags.includes(n)?state.flags.filter(x=>x!==n):[...state.flags,n];writeStore();renderExam();});
    document.addEventListener("keydown",(event)=>{if(examView.hidden||event.target.matches("input"))return;if(event.key==="ArrowLeft")$("#prevButton").click();if(event.key==="ArrowRight"&&!$("#nextButton").hidden)$("#nextButton").click();});
    renderHome();
  </script>
</body>
</html>`;

await Promise.all([
  writeFile(new URL("final-theory-offline-practice.html", here), html),
  writeFile(new URL("index.html", here), html),
]);
console.log(`Built index.html and final-theory-offline-practice.html with ${Object.keys(rawPapers).length} papers and ${Object.values(rawPapers).flat().length} questions.`);
