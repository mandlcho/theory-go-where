import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

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
  1: normalizeRaw(1, JSON.parse(await readText("final-theory-paper-1.json"))),
  2: normalizeRaw(2, JSON.parse(await readText("final-theory-paper-2.json"))),
  3: normalizeRaw(3, JSON.parse(await readText("final-theory-paper-3.json"))),
  4: normalizeRaw(4, JSON.parse(await readText("final-theory-paper-4.json"))),
  5: normalizeRaw(5, JSON.parse(await readText("final-theory-paper-5.json"))),
  6: parsePaper6(await readText("final-theory-paper-6.md")),
  7: normalizeRaw(7, JSON.parse(await readText("final-theory-paper-7.json"))),
  8: normalizeRaw(8, JSON.parse(await readText("final-theory-paper-8.json"))),
  9: normalizeRaw(9, JSON.parse(await readText("final-theory-paper-9.json"))),
  10: normalizeRaw(10, JSON.parse(await readText("final-theory-paper-10.json"))),
};

for (const questions of Object.values(rawPapers)) {
  if (questions.length !== 50) throw new Error(`Expected 50 questions, found ${questions.length}`);
  for (const question of questions) {
    if (question.options.length !== 3 || question.options.filter((option) => option.correct).length !== 1) {
      throw new Error(`Invalid answer key: Paper ${question.paper}, question ${question.number}`);
    }
  }
}

const optimizedPapers = structuredClone(rawPapers);
const embeddedPapers = structuredClone(rawPapers);
const optimizedAssetNames = new Set();

function imageDimensions(bytes) {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const sizeMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    for (let offset = 2; offset + 8 < bytes.length;) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01) { offset += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = bytes.readUInt16BE(offset + 2);
      if (sizeMarkers.has(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + length;
    }
  }
  throw new Error("Unsupported source diagram format");
}

for (const [paper, questions] of Object.entries(rawPapers)) {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question.image) continue;
    const filename = new URL(question.image.src, "https://local.invalid/").pathname.split("/").pop();
    const sourceBytes = await readFile(new URL(`offline-assets/${filename}`, here));
    const hash = createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
    const optimizedName = `${hash}.webp`;
    const optimizedBytes = await readFile(new URL(`optimized-assets/${optimizedName}`, here));
    const dimensions = imageDimensions(sourceBytes);
    optimizedAssetNames.add(optimizedName);
    Object.assign(optimizedPapers[paper][index].image, dimensions, { src: `optimized-assets/${optimizedName}` });
    Object.assign(embeddedPapers[paper][index].image, dimensions, { src: `data:image/webp;base64,${optimizedBytes.toString("base64")}` });
  }
}

const paperMeta = Object.fromEntries(
  Object.entries(rawPapers).map(([paper, questions]) => [paper, {
    count: questions.length,
    images: questions.filter((question) => question.image).length,
    answerKey: Object.fromEntries(questions.map((question) => [question.number, question.options.findIndex((option) => option.correct)])),
  }]),
);

const knowledgeTopicOrder = [
  "Licensing, offences & penalties",
  "Driver fitness & attitude",
  "Observation & communication",
  "Junctions, signs & signals",
  "Speed, distance & road conditions",
  "Overtaking & lane discipline",
  "Expressways & emergency vehicles",
  "Vulnerable road users",
  "Parking & reversing",
  "Vehicle control & maintenance",
  "Collisions & breakdowns",
  "General defensive driving",
];

const knowledgeSources = {
  "Licensing, offences & penalties": {
    title: "Traffic Police — Driver Improvement Point System",
    url: "https://www.police.gov.sg/Knowledge-Hub/Traffic/Traffic-Matters/Driver-Improvement-Point-Systems",
  },
  "Driver fitness & attitude": {
    title: "Traffic Police — Penalties for Traffic Offences",
    url: "https://www.police.gov.sg/Knowledge-Hub/Traffic/Traffic-Matters/Penalties-for-Traffic-Offences",
  },
  "Junctions, signs & signals": {
    title: "LTA — Driving Rules and Information",
    url: "https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-rules.html",
  },
  "Expressways & emergency vehicles": {
    title: "LTA — Driving on Expressways and in Tunnels",
    url: "https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-in-expressway-and-tunnel.html",
  },
  "Vulnerable road users": {
    title: "Traffic Police — Road Safety Tips for Drivers",
    url: "https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Drivers",
  },
};

function knowledgeTopic(question) {
  const text = `${question.question} ${question.options.map((option) => option.text).join(" ")}`.toLowerCase();
  if (/demerit|licen[cs]e|provisional|probation|suspend|revok|disqualif|fine|offence|driving test/.test(text)) return knowledgeTopicOrder[0];
  if (/alcohol|drink.?driv|drug|drows|tired|fatigue|sleep|angry|aggressive|attitude|concentration|reaction time/.test(text)) return knowledgeTopicOrder[1];
  if (/pedestrian|child|elderly|cyclist|bicycle|motorcycl|wheelchair|school children|visually handicapped/.test(text)) return knowledgeTopicOrder[7];
  if (/expressway|tunnel|road shoulder|emergency vehicle|ambulance|fire engine|siren/.test(text)) return knowledgeTopicOrder[6];
  if (/traffic light|amber|green light|junction|intersection|roundabout|give way|stop line|crossing|road sign|road marking|white line|yellow line|bus lane|no entry|no parking|no stopping/.test(text)) return knowledgeTopicOrder[3];
  if (/overtak|large vehicle|lorry|bus|right.?most lane|outer lane|keep left|lane discipline|change lane|filtering/.test(text)) return knowledgeTopicOrder[5];
  if (/revers|parking|park your car|parked vehicle|parked car/.test(text)) return knowledgeTopicOrder[8];
  if (/accident|collision|injur|fatal|breakdown/.test(text)) return knowledgeTopicOrder[10];
  if (/brake|skid|tyre|tire|puncture|engine|clutch|gear|radiator|steering|handbrake|headlight|high beam|windscreen|wiper|shock absorber|maintenance|oil|petrol/.test(text)) return knowledgeTopicOrder[9];
  if (/speed|following distance|three.second|safe gap|tailgat|wet road|rain|fog|weather|visibility|bend|curve|corner|slope|friction|stopping distance/.test(text)) return knowledgeTopicOrder[4];
  if (/blind spot|mirror|signal|horn|look|observe|moving off|open.*door/.test(text)) return knowledgeTopicOrder[2];
  return knowledgeTopicOrder[11];
}

function canonicalKnowledge(value) {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const knowledgeByKey = new Map();
for (const questions of Object.values(rawPapers)) {
  for (const question of questions) {
    const correct = question.options.find((option) => option.correct);
    const key = `${canonicalKnowledge(question.question)}|${canonicalKnowledge(correct.text)}`;
    const reference = { paper: question.paper, number: question.number };
    const existing = knowledgeByKey.get(key);
    if (existing) existing.references.push(reference);
    else {
      knowledgeByKey.set(key, {
        topic: knowledgeTopic(question),
        question: question.question,
        answer: correct.text,
        references: [reference],
      });
    }
  }
}

const knowledgeItems = [...knowledgeByKey.values()].sort((a, b) => {
  const topicDifference = knowledgeTopicOrder.indexOf(a.topic) - knowledgeTopicOrder.indexOf(b.topic);
  return topicDifference || a.question.localeCompare(b.question);
});

const knowledgeData = JSON.stringify(knowledgeItems).replaceAll("<", "\\u003c");
const knowledgeSourcesData = JSON.stringify(knowledgeSources).replaceAll("<", "\\u003c");
const paperMetaData = JSON.stringify(paperMeta).replaceAll("<", "\\u003c");

function buildHtml(papers, progressive = false) {
  const appData = JSON.stringify(papers).replaceAll("<", "\\u003c");
  const progressiveHead = progressive
    ? '<link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes">'
    : "";
  const serviceWorkerRegistration = progressive
    ? 'if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));'
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="Offline Final Theory practice papers">
  <meta id="themeColor" name="theme-color" content="#f3f5f7">
  <title>Final Theory · Offline Practice</title>
  ${progressiveHead}
  <script>try{const savedTheme=localStorage.getItem("ft-theme-v1");if(savedTheme==="dark"||(!savedTheme&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.theme="dark";}catch{}</script>
  <style>
    :root {
      color-scheme: light;
      --navy:#092a44; --blue:#075985; --sky:#e8f3f9; --ink:#15202b; --muted:#607080;
      --paper:#f3f5f7; --card:#fff; --line:#d9e0e6; --green:#16824b; --green-bg:#e8f7ef;
      --red:#b42318; --red-bg:#fcebea; --amber:#a15c00; --amber-bg:#fff3d6;
      --shadow:0 18px 45px rgba(9,42,68,.10); --surface:#fff; --surface-subtle:#f8fafb;
      --surface-hover:#fafcfd; --surface-soft:#edf3f7; --surface-disabled:#edf1f4;
      --track:#e8edf1; --bar:#e6edf1; --top-start:#092a44; --top-end:#075985;
      --primary-hover:#092a44; --on-accent:#fff; --glass:rgba(255,255,255,.96); --tab-glass:rgba(255,255,255,.97);
      --info-bg:#eef7fb; --info-border:#b8d4e3; --info-ink:#18384b; --tab-muted:#6a7883;
    }
    :root[data-theme="dark"] {
      color-scheme: dark;
      --navy:#d8effc; --blue:#70c9f5; --sky:#123448; --ink:#e5edf3; --muted:#9eabb7;
      --paper:#070a0d; --card:#10161c; --line:#2b3741; --green:#70d99a; --green-bg:#102b1d;
      --red:#ff8a80; --red-bg:#351816; --amber:#ffc65f; --amber-bg:#38290d;
      --shadow:0 18px 48px rgba(0,0,0,.34); --surface:#10161c; --surface-subtle:#0c1116;
      --surface-hover:#151d24; --surface-soft:#17242d; --surface-disabled:#151b20;
      --track:#202a33; --bar:#1d2730; --top-start:#090d11; --top-end:#102d3c;
      --primary-hover:#0b6e99; --on-accent:#fff; --glass:rgba(16,22,28,.96); --tab-glass:rgba(10,14,18,.97);
      --info-bg:#0d2836; --info-border:#2c6078; --info-ink:#d5e9f3; --tab-muted:#9ba8b3;
    }
    *{box-sizing:border-box} html{scroll-behavior:smooth}
    body{margin:0;background:var(--paper);color:var(--ink);font:400 15px/1.55 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
    button,input,select{font:inherit} button{cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    button:focus-visible,input:focus-visible{outline:3px solid rgba(7,89,133,.25);outline-offset:2px}
    .topbar{position:relative;z-index:30;background:linear-gradient(135deg,var(--top-start),var(--top-end));color:var(--on-accent);padding:18px 20px;box-shadow:0 3px 16px rgba(9,42,68,.18)}
    .topbar-inner{width:min(1160px,100%);margin:auto;display:flex;align-items:center;justify-content:space-between;gap:18px}.top-actions{display:flex;align-items:center;gap:8px}
    .brand{display:flex;align-items:center;gap:12px}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.3);border-radius:12px;background:rgba(255,255,255,.12);font-weight:900}
    .brand h1{margin:0;font-size:1.08rem;letter-spacing:-.015em}.brand p{margin:1px 0 0;color:rgba(255,255,255,.68);font-size:.78rem}
    .ghost-light{border:1px solid rgba(255,255,255,.35);border-radius:9px;background:transparent;color:var(--on-accent);padding:9px 13px;font-weight:750}.theme-toggle{display:grid;width:42px;min-width:42px;height:42px;place-items:center;padding:0;font-size:1.25rem;line-height:1}
    main{width:min(1160px,calc(100% - 28px));margin:30px auto 64px}
    .hero{padding:28px 0 16px}.kicker{margin:0 0 8px;color:var(--blue);font-size:.77rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
    .hero h2{margin:0;max-width:720px;font-size:clamp(2rem,5vw,3.6rem);line-height:1.02;letter-spacing:-.05em}.hero-copy{max-width:650px;margin:14px 0 0;color:var(--muted);font-size:1.02rem}
    .status-strip{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.chip{padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font-size:.82rem;font-weight:750}
    .paper-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:14px;margin-top:24px}
    .paper-card{display:flex;min-height:210px;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:0 8px 25px rgba(9,42,68,.05)}
    .paper-card:hover{border-color:var(--blue);transform:translateY(-1px)}.paper-no{color:var(--blue);font-size:.76rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .paper-card.placeholder{border-style:dashed;background:var(--surface-subtle);box-shadow:none}.paper-card.placeholder:hover{border-color:var(--line);transform:none}.paper-card.placeholder .paper-no,.paper-card.placeholder h3{color:var(--muted)}
    .paper-card h3{margin:7px 0 3px;font-size:1.55rem;letter-spacing:-.03em}.paper-meta{margin:0;color:var(--muted);font-size:.87rem}
    .paper-progress{height:7px;margin:18px 0 8px;overflow:hidden;border-radius:999px;background:var(--track)}.paper-progress i{display:block;height:100%;background:var(--blue)}
    .progress-label{margin:0;color:var(--muted);font-size:.78rem}.card-actions{display:flex;gap:8px;margin-top:auto;padding-top:16px}
    .btn{min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:0 14px;font-weight:800}.btn:hover{border-color:var(--blue)}
    .btn.primary{border-color:var(--blue);background:var(--blue);color:var(--on-accent)}.btn.primary:hover{background:var(--primary-hover)}.btn.danger{color:var(--red)}.btn.small{min-height:36px;padding:0 10px;font-size:.82rem}.btn:disabled{cursor:not-allowed;border-color:var(--line);background:var(--surface-disabled);color:var(--muted)}
    .exam-shell{display:grid;grid-template-columns:minmax(0,1fr) 285px;gap:20px;align-items:start}
    .exam-main,.sidebar{border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:var(--shadow)}
    .exam-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid var(--line)}
    .exam-head h2{margin:0;font-size:1.15rem}.exam-sub{margin:2px 0 0;color:var(--muted);font-size:.82rem}.answered-count{font-size:.82rem;font-weight:800;color:var(--blue)}
    .exam-status{display:flex;align-items:center;gap:10px}.palette-toggle,.sidebar-close{display:none}
    .bar{height:5px;background:var(--bar)}.bar i{display:block;height:100%;background:var(--blue);transition:width .25s}
    .question{padding:26px 28px 30px}.q-label{margin:0 0 9px;color:var(--blue);font-size:.76rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .question h3{margin:0;font-size:clamp(1.16rem,2.4vw,1.52rem);line-height:1.4;letter-spacing:-.02em}
    .diagram{display:block;width:auto;max-width:100%;height:auto;max-height:390px;object-fit:contain;margin:22px auto 4px;border:1px solid var(--line);border-radius:13px;background:var(--surface-subtle)}
    .choices{display:grid;gap:11px;margin-top:24px}.choice{display:grid;grid-template-columns:auto 34px 1fr auto;gap:11px;align-items:center;padding:14px 15px;border:1px solid var(--line);border-radius:12px;background:var(--surface);transition:.12s}
    .choice:hover{border-color:var(--blue);background:var(--surface-hover)}.choice input{width:18px;height:18px;margin:0;accent-color:var(--blue)}.choice-letter{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--surface-soft);color:var(--blue);font-weight:900}
    .choice.correct{border-color:var(--green);background:var(--green-bg)}.choice.wrong{border-color:var(--red);background:var(--red-bg)}.choice .answer-tag{font-size:.76rem;font-weight:900}.correct .answer-tag{color:var(--green)}.wrong .answer-tag{color:var(--red)}
    .exam-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:17px 22px;border-top:1px solid var(--line)}.exam-actions .spacer{flex:1}
    .sidebar{position:sticky;top:18px;padding:18px}.sidebar-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.sidebar h3{margin:0 0 4px;font-size:.95rem}.sidebar-note{margin:0 0 13px;color:var(--muted);font-size:.78rem}
    .palette-backdrop{display:none}
    .palette{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.q-dot{display:grid;place-items:center;aspect-ratio:1;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--muted);font-size:.76rem;font-weight:850}
    .q-dot:hover{border-color:var(--blue)}.q-dot.active{border-color:var(--blue);box-shadow:inset 0 0 0 2px var(--blue);color:var(--blue)}.q-dot.answered{background:var(--sky);color:var(--blue)}.q-dot.flagged{background:var(--amber-bg);color:var(--amber)}
    .q-dot.review-correct{background:var(--green-bg);border-color:var(--green);color:var(--green)}.q-dot.review-wrong{background:var(--red-bg);border-color:var(--red);color:var(--red)}
    .legend{display:grid;grid-template-columns:1fr 1fr;gap:7px 10px;margin-top:15px;color:var(--muted);font-size:.72rem}.legend span{display:flex;align-items:center;gap:6px}.swatch{width:11px;height:11px;border-radius:3px;border:1px solid var(--line);background:var(--surface)}.swatch.done{background:var(--sky)}.swatch.flag{background:var(--amber-bg)}
    .result-panel{padding:30px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:var(--shadow);text-align:center}.score-ring{display:grid;place-items:center;width:138px;height:138px;margin:6px auto 18px;border-radius:50%;background:conic-gradient(var(--green) var(--score),var(--track) 0);position:relative}.score-ring:after{content:"";position:absolute;inset:12px;border-radius:50%;background:var(--surface)}.score-value{position:relative;z-index:1}.score-value strong{display:block;font-size:2rem;line-height:1}.score-value span{color:var(--muted);font-size:.75rem}
    .result-panel h2{margin:0;font-size:2rem;letter-spacing:-.04em}.result-panel p{color:var(--muted)}.result-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:9px;margin-top:20px}
    .notice{margin:18px 0 0;padding:12px 14px;border-radius:10px;background:var(--amber-bg);color:var(--amber);font-size:.87rem}
    .teaching{margin-top:18px;padding:16px 17px;border:1px solid var(--info-border);border-radius:13px;background:var(--info-bg);color:var(--info-ink);text-align:left}
    .teaching.is-correct{border-color:var(--green);background:var(--green-bg);color:var(--green)}.teaching.is-correct .teaching-label{color:var(--green)}
    .teaching-label{display:block;margin-bottom:6px;color:var(--blue);font-size:.72rem;font-weight:950;letter-spacing:.11em;text-transform:uppercase}
    .teaching p{margin:0;line-height:1.62}.teaching strong{color:var(--navy)}
    .feedback-extra p{margin-top:8px}.feedback-mobile{display:none}
    .source-link{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:7px 10px;border:1px solid var(--info-border);border-radius:8px;background:var(--surface);color:var(--blue);font-size:.78rem;font-weight:850;text-decoration:none}.source-link:hover{text-decoration:underline;border-color:var(--blue)}
    .cheat-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;padding:20px 0 10px}.cheat-hero h2{max-width:760px;margin:0;font-size:clamp(2.2rem,5vw,4rem);line-height:1;letter-spacing:-.055em}.cheat-intro{max-width:670px;margin:15px 0 0;color:var(--muted);font-size:1.02rem}
    .shortcut-box{min-width:220px;padding:16px 18px;border:1px solid var(--info-border);border-radius:14px;background:var(--info-bg)}.shortcut-box strong{display:block;margin-bottom:8px;color:var(--navy);font-size:.82rem}.shortcut-box span{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:.78rem}.shortcut-box kbd{display:inline-grid;min-width:27px;height:27px;place-items:center;border:1px solid var(--info-border);border-bottom-width:3px;border-radius:6px;background:var(--surface);color:var(--navy);font:800 .75rem ui-monospace,SFMono-Regular,Menlo,monospace}
    .cheat-jumps{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.cheat-jumps a{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--blue);font-size:.78rem;font-weight:850;text-decoration:none}.cheat-jumps a:hover{border-color:var(--blue);background:var(--surface-hover)}
    .cheat-alert{margin:0 0 16px;padding:14px 16px;border:1px solid var(--amber);border-radius:13px;background:var(--amber-bg);color:var(--amber)}.cheat-alert strong{color:inherit}.cheat-alert a{color:inherit;font-weight:850}
    .cheat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.cheat-card{scroll-margin-top:22px;padding:21px;border:1px solid var(--line);border-radius:17px;background:var(--surface);box-shadow:0 8px 25px rgba(9,42,68,.05)}.cheat-card.featured{grid-column:1/-1}.cheat-topic{color:var(--blue);font-size:.7rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.cheat-card h3{margin:5px 0 7px;font-size:1.35rem;letter-spacing:-.025em}.memory-hook{margin:0 0 15px;color:var(--navy);font-weight:850}.rule-list{display:grid;gap:0;border-top:1px solid var(--line)}.rule{display:grid;grid-template-columns:minmax(110px,155px) 1fr;gap:14px;padding:11px 0;border-bottom:1px solid var(--line)}.rule strong{color:var(--navy)}.rule span{color:var(--muted)}
    .future-note{margin-top:15px;padding:12px 14px;border-radius:11px;background:var(--surface-soft);color:var(--muted);font-size:.85rem}.future-note strong{color:var(--ink)}.cheat-sources{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.cheat-sources a{display:inline-flex;align-items:center;min-height:38px;padding:0 10px;border:1px solid var(--info-border);border-radius:8px;color:var(--blue);font-size:.76rem;font-weight:850;text-decoration:none}.cheat-sources a:hover{text-decoration:underline;border-color:var(--blue)}
    .distance-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.distance-item{padding:12px;border:1px solid var(--info-border);border-radius:12px;background:var(--info-bg)}.distance-item strong{display:block;color:var(--blue);font-size:1.55rem;line-height:1}.distance-item span{display:block;margin-top:6px;color:var(--muted);font-size:.75rem;font-weight:750;line-height:1.35}
    .knowledge-bank{scroll-margin-top:22px;margin-top:17px;padding:23px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:0 8px 25px rgba(9,42,68,.05)}.knowledge-bank-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.knowledge-bank h3{margin:5px 0 6px;font-size:1.55rem;letter-spacing:-.03em}.knowledge-bank-intro{max-width:720px;margin:0;color:var(--muted)}.knowledge-total{flex:0 0 auto;padding:10px 13px;border-radius:11px;background:var(--sky);color:var(--blue);font-size:.78rem;font-weight:900}
    .knowledge-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,280px);gap:10px;margin:20px 0 9px}.knowledge-controls input,.knowledge-controls select{width:100%;min-height:48px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--ink);padding:0 13px}.knowledge-controls input:focus,.knowledge-controls select:focus{border-color:var(--blue);outline:3px solid rgba(7,89,133,.14)}.knowledge-count{margin:0 0 13px;color:var(--muted);font-size:.8rem;font-weight:750}
    .knowledge-groups{display:grid;gap:9px}.knowledge-group{overflow:hidden;border:1px solid var(--line);border-radius:13px;background:var(--surface)}.knowledge-group>summary{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;background:var(--surface-subtle);color:var(--navy);font-weight:900;cursor:pointer;list-style:none}.knowledge-group>summary::-webkit-details-marker{display:none}.knowledge-group>summary:after{content:"＋";color:var(--blue);font-size:1.15rem}.knowledge-group[open]>summary:after{content:"−"}.knowledge-group>summary small{color:var(--muted);font-size:.73rem;font-weight:800}
    .knowledge-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px;padding:2px 15px 14px}.knowledge-item{padding:13px 0;border-bottom:1px solid var(--line)}.knowledge-question{margin:0 0 5px;color:var(--ink);font-size:.87rem;line-height:1.45}.knowledge-answer{display:block;color:var(--green);font-size:.88rem;line-height:1.45}.knowledge-ref{display:block;margin-top:6px;color:var(--muted);font-size:.67rem;font-weight:750}.knowledge-source{display:inline-flex;margin:13px 15px 15px;color:var(--blue);font-size:.74rem;font-weight:850;text-decoration:none}.knowledge-source:hover{text-decoration:underline}.knowledge-empty{padding:30px 16px;text-align:center;color:var(--muted)}
    .scores-hero{padding:20px 0 12px}.scores-hero h2{margin:0;font-size:clamp(2.2rem,5vw,4rem);line-height:1;letter-spacing:-.055em}.scores-hero p:last-child{max-width:650px;margin:14px 0 0;color:var(--muted)}
    .score-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:20px 0}.score-stat{padding:15px 17px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.score-stat strong{display:block;color:var(--navy);font-size:1.55rem;line-height:1}.score-stat span{color:var(--muted);font-size:.77rem;font-weight:750}
    .score-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:13px}.score-card{display:flex;min-height:205px;flex-direction:column;padding:19px;border:1px solid var(--line);border-radius:17px;background:var(--surface);box-shadow:0 8px 25px rgba(9,42,68,.05)}.score-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.score-card h3{margin:4px 0 1px;font-size:1.35rem}.score-status{padding:5px 8px;border-radius:999px;background:var(--surface-disabled);color:var(--muted);font-size:.68rem;font-weight:900}.score-status.pass{background:var(--green-bg);color:var(--green)}.score-status.retry{background:var(--red-bg);color:var(--red)}.score-big{margin:19px 0 2px;color:var(--navy);font-size:2rem;font-weight:950;letter-spacing:-.04em}.score-detail{margin:0;color:var(--muted);font-size:.82rem}.score-card .paper-progress{margin:13px 0 7px}.score-card .card-actions{padding-top:14px}.score-empty{grid-column:1/-1;padding:38px 20px;border:1px dashed var(--line);border-radius:16px;background:var(--surface-subtle);text-align:center;color:var(--muted)}
    .mobile-tabs{display:none}
    [hidden]{display:none!important}.empty{padding:50px 20px;text-align:center;color:var(--muted)}
    footer{text-align:center;color:var(--muted);font-size:.75rem;padding:0 20px 30px}
    body *{font-weight:400!important}
    body :is(h1,h2,h3,strong,button,.brand-mark,.kicker,.paper-no,.answered-count,.choice-letter,.answer-tag,.teaching-label,.knowledge-total,.knowledge-ref,.cheat-topic,.score-status){font-weight:500!important}
    .hero h2{font-size:clamp(1.8rem,4vw,3rem)}.cheat-hero h2,.scores-hero h2{font-size:clamp(1.9rem,4vw,3.2rem)}
    .paper-card h3{font-size:1.35rem}.question h3{font-size:clamp(1.08rem,2vw,1.35rem)}.cheat-card h3,.score-card h3{font-size:1.2rem}.knowledge-bank h3{font-size:1.35rem}.result-panel h2{font-size:1.7rem}
    .hero h2,.cheat-hero h2,.scores-hero h2{letter-spacing:-.025em}.paper-card h3,.question h3,.cheat-card h3,.knowledge-bank h3,.score-card h3,.result-panel h2{letter-spacing:-.012em}
    @media(max-width:860px){
      body.palette-open{overflow:hidden}.exam-shell{display:block}.palette-toggle,.sidebar-close{display:inline-flex;align-items:center;justify-content:center}
      .palette-toggle{min-height:40px;border:1px solid var(--info-border);border-radius:9px;background:var(--info-bg);color:var(--blue);padding:0 11px;font-size:.78rem;font-weight:900}
      .sidebar{position:fixed;z-index:60;inset:auto 0 0;top:auto;max-height:min(78dvh,650px);overflow:auto;padding:20px max(18px,env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));border:0;border-radius:24px 24px 0 0;box-shadow:0 -22px 70px rgba(9,42,68,.26);transform:translateY(105%);visibility:hidden;transition:transform .22s ease,visibility .22s}
      .sidebar.mobile-open{transform:translateY(0);visibility:visible}.sidebar-close{min-width:72px;min-height:40px;border:1px solid var(--line);border-radius:9px;background:var(--surface-soft);color:var(--ink);font-size:.8rem;font-weight:850}
      .palette-backdrop{position:fixed;z-index:50;inset:0;display:block;border:0;background:rgba(7,25,39,.48);backdrop-filter:blur(2px)}
      .palette{grid-template-columns:repeat(10,1fr)}
    }
    @media(max-width:600px){
      .topbar{position:sticky;top:0;padding:calc(11px + env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 11px max(12px,env(safe-area-inset-left))}.topbar-inner{gap:7px}.top-actions{gap:6px}.brand{gap:8px}.brand-mark{width:38px;height:38px;border-radius:10px}.brand h1{font-size:.94rem}.brand p{display:none}.ghost-light{min-height:38px;padding:0 8px;font-size:.72rem;white-space:nowrap}.theme-toggle{width:38px;min-width:38px;height:38px;padding:0;font-size:1.12rem}body:not([data-view="home"]) .brand-mark{display:none}#cheatButton{display:none!important}body:not([data-view="cheat"]) #homeButton{display:none!important}
      main{width:min(100% - 18px,1160px);margin-top:18px;padding-bottom:calc(74px + env(safe-area-inset-bottom))}.hero{padding:12px 0 10px}.hero h2{font-size:1.9rem}.hero-copy{font-size:.9rem}.status-strip{gap:7px;margin-top:17px}.chip{padding:6px 9px;font-size:.74rem}
      .paper-grid{grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.paper-card{min-height:180px;padding:14px;border-radius:15px}.paper-card h3{font-size:1.2rem}.paper-no{font-size:.68rem}.paper-meta{font-size:.8rem}.paper-progress{margin-top:13px}.card-actions{flex-direction:column;gap:7px;padding-top:12px}.card-actions .btn{width:100%}
      body[data-view="exam"]{overflow:hidden}body[data-view="exam"] .topbar{display:none}body[data-view="exam"] main{width:100%;height:calc(100dvh - 60px - env(safe-area-inset-bottom));margin:0;padding:0;overflow:hidden}body[data-view="exam"] footer{display:none}body[data-view="exam"] #examView,body[data-view="exam"] .exam-shell{height:100%}.exam-main{display:grid;grid-template-rows:auto 3px minmax(0,1fr) auto;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none}
      .exam-head{position:static;z-index:20;min-height:44px;padding:7px 11px;background:var(--glass)}.exam-head h2{font-size:.9rem;white-space:nowrap}.exam-prefix{display:none}.exam-sub{display:none}.exam-status{gap:7px}.answered-count{font-size:.66rem;white-space:nowrap}.palette-toggle{min-height:34px;padding-inline:8px;font-size:.68rem}.bar{height:3px}
      .question{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 12px 8px;scroll-padding-bottom:10px}.q-label{margin-bottom:4px;font-size:.62rem}.question h3{font-size:.98rem;line-height:1.26}.diagram{width:auto;max-width:100%;max-height:clamp(70px,17dvh,145px);margin-top:8px;border-radius:9px}.question.revealed .diagram{max-height:min(14dvh,110px)}.question.revealed:not(.reviewing) .diagram,.question.revealed:not(.reviewing) .compact-hidden,.question.revealed:not(.reviewing) .q-label{display:none}.question.revealed:not(.reviewing)>h3{margin-bottom:6px;overflow:hidden;color:var(--muted);font-size:.72rem;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
      .choices{gap:6px;margin-top:9px}.choice{min-height:46px;grid-template-columns:18px 30px minmax(0,1fr);gap:7px;padding:6px 8px;border-radius:9px;font-size:.82rem;line-height:1.25}.choice input{width:18px;height:18px}.choice-letter{width:30px;height:30px;border-radius:7px}.choice .answer-tag{grid-column:3;font-size:.64rem}
      .exam-actions{position:static;z-index:40;display:grid;grid-template-columns:auto auto 1fr;gap:6px;padding:6px max(9px,env(safe-area-inset-right)) 6px max(9px,env(safe-area-inset-left));border-top:1px solid var(--line);background:var(--glass);box-shadow:0 -5px 16px rgba(0,0,0,.1)}.exam-actions .spacer{display:none}.exam-actions .btn{min-height:44px;padding-inline:11px;font-size:.8rem}.exam-actions #nextButton,.exam-actions #submitButton{width:100%}
      .palette{grid-template-columns:repeat(5,1fr);gap:8px}.q-dot{min-height:48px;aspect-ratio:auto;border-radius:9px;font-size:.82rem}.legend{margin-bottom:2px}
      .teaching{margin-top:8px;padding:9px 10px;border-radius:10px;font-size:.76rem}.teaching.is-correct{padding-block:7px}.teaching-label{margin-bottom:3px;font-size:.62rem}.teaching p{line-height:1.38}.feedback-extra{display:none}.feedback-mobile{display:block;margin-top:6px}.feedback-mobile summary{color:var(--blue);cursor:pointer}.feedback-mobile p{margin-top:7px}.source-link{display:flex;min-height:36px;width:100%;justify-content:center;margin-top:7px;padding:4px 7px;text-align:center;font-size:.68rem}.result-panel{padding:28px 18px;border:0;border-radius:0;box-shadow:none}.result-actions{display:grid}.result-actions .btn{width:100%;min-height:50px}
      .cheat-hero{display:block;padding-top:8px}.cheat-hero h2{font-size:2rem}.cheat-intro{font-size:.9rem}.shortcut-box{margin-top:17px}.cheat-jumps{margin:16px 0}.cheat-jumps a{padding:8px 10px;font-size:.73rem}.cheat-grid{grid-template-columns:1fr;gap:11px}.cheat-card,.cheat-card.featured{grid-column:auto;padding:17px;border-radius:15px}.cheat-card h3{font-size:1.15rem}.rule{display:block;padding:10px 0}.rule strong{display:block;margin-bottom:3px}.cheat-sources a{min-height:44px}.cheat-alert{font-size:.84rem}
      .distance-strip{gap:6px}.distance-item{padding:10px 8px}.distance-item strong{font-size:1.3rem}.distance-item span{font-size:.68rem}
      .knowledge-bank{margin-top:12px;padding:17px;border-radius:15px}.knowledge-bank-head{display:block}.knowledge-bank h3{font-size:1.25rem}.knowledge-total{display:inline-block;margin-top:12px}.knowledge-controls{grid-template-columns:1fr;margin-top:15px}.knowledge-controls input,.knowledge-controls select{min-height:50px}.knowledge-items{grid-template-columns:1fr;padding-inline:13px}.knowledge-group>summary{padding:14px 13px}.knowledge-item{padding:12px 0}.knowledge-question,.knowledge-answer{font-size:.84rem}
      .scores-hero{padding-top:8px}.scores-hero h2{font-size:2rem}.score-summary{gap:7px;margin:16px 0}.score-stat{padding:12px 9px}.score-stat strong{font-size:1.2rem}.score-stat span{font-size:.68rem}.score-grid{grid-template-columns:1fr;gap:10px}.score-card{min-height:190px;padding:16px}.score-card .card-actions .btn{width:100%}
      .mobile-tabs{position:fixed;z-index:45;inset:auto 0 0;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:5px max(8px,env(safe-area-inset-right)) calc(5px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid var(--line);background:var(--tab-glass);box-shadow:0 -8px 24px rgba(0,0,0,.18);backdrop-filter:blur(15px)}.mobile-tab{display:grid;min-height:50px;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--tab-muted);font-size:.72rem;font-weight:850}.mobile-tab.active{background:var(--sky);color:var(--blue)}.mobile-tab:active{background:var(--surface-soft)}footer{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
    }
    @media(max-width:360px){.palette-label{display:none}.exam-head{gap:8px}.exam-status{gap:6px}}
    @media(max-width:600px) and (min-height:720px){.question{padding:14px 15px 10px}.q-label{margin-bottom:6px;font-size:.67rem}.question h3{font-size:1.08rem;line-height:1.32}.diagram{max-height:min(22dvh,185px);margin-top:11px}.question.revealed .diagram{max-height:min(16dvh,135px)}.choices{gap:8px;margin-top:12px}.choice{min-height:54px;grid-template-columns:20px 34px minmax(0,1fr);gap:9px;padding:9px 10px;font-size:.9rem;line-height:1.3}.choice input{width:20px;height:20px}.choice-letter{width:34px;height:34px}.teaching{padding:12px;font-size:.82rem}.source-link{min-height:42px;font-size:.72rem}.exam-actions{padding-block:8px}.exam-actions .btn{min-height:48px}}
    @media(max-width:600px) and (max-height:650px){.exam-head{min-height:40px;padding-block:5px}.question h3{font-size:.94rem}.diagram{max-height:90px}.question.revealed .diagram{max-height:70px}.choice{min-height:44px;padding-block:5px}.exam-actions .btn{min-height:42px}}
    @media print{.topbar,.sidebar,.exam-actions,.mobile-tabs{display:none!important}body{background:#fff}.exam-shell{display:block}.exam-main{box-shadow:none}.question{break-inside:avoid}}
  </style>
</head>
<body data-view="home">
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><span class="brand-mark">FT</span><div><h1>Final Theory Practice</h1><p>Personal offline study copy</p></div></div>
      <div class="top-actions"><button id="cheatButton" class="ghost-light" type="button">Cheat sheet</button><button id="homeButton" class="ghost-light" type="button" hidden>Papers</button><button id="themeButton" class="ghost-light theme-toggle" type="button" aria-pressed="false" aria-label="Switch to night mode"><span aria-hidden="true">☾</span></button></div>
    </div>
  </header>
  <main>
    <section id="homeView">
      <div class="hero">
        <p class="kicker">Offline practice library</p>
        <h2>Build confidence, one paper at a time.</h2>
        <p class="hero-copy">Choose a completed CDC e-Trial paper. Get instant feedback after every answer, keep the final score and review, and practise with every diagram even without internet.</p>
        <div id="statusStrip" class="status-strip"></div>
      </div>
      <div id="paperGrid" class="paper-grid"></div>
    </section>

    <section id="cheatView" hidden>
      <div class="cheat-hero">
        <div>
          <p class="kicker">Final Theory cheat sheet</p>
          <h2>The tricky bits, made memorable.</h2>
          <p class="cheat-intro">Start with the memory hooks for recurring traps, then search the complete knowledge index for every distinct fact tested across all ten papers.</p>
        </div>
        <aside class="shortcut-box" aria-label="Practice keyboard shortcuts"><strong>Practice faster</strong><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> choose an answer</span><span><kbd>Space</kbd> next question</span><span><kbd>←</kbd><kbd>→</kbd> move between questions</span></aside>
      </div>
      <nav class="cheat-jumps" aria-label="Cheat sheet topics"><a href="#cheat-points">Demerit points</a><a href="#cheat-observation">Observation</a><a href="#cheat-distance">Distance & grip</a><a href="#cheat-overtaking">Overtaking</a><a href="#cheat-expressway">Expressways</a><a href="#cheat-people">People</a><a href="#cheat-control">Vehicle control</a><a href="#cheat-bank">All unique facts</a></nav>
      <p class="cheat-alert"><strong>Date-sensitive:</strong> The demerit-point answers in these 2026 mock papers use the rules in force on 31 August 2026. New thresholds begin on 1 January 2027.</p>

      <div class="cheat-grid">
        <article id="cheat-points" class="cheat-card featured">
          <span class="cheat-topic">Exact numbers</span><h3>Demerit points: identify the driver first</h3><p class="memory-hook">Memory hook: 13–1, 24–24, 12–12.</p>
          <div class="rule-list">
            <div class="rule"><strong>13 in 1</strong><span>A new driver who reaches 13 points during the one-year probation period has the licence revoked.</span></div>
            <div class="rule"><strong>24 in 24</strong><span>A non-probationary driver with no previous suspension becomes liable for the first suspension at 24 points within 24 months.</span></div>
            <div class="rule"><strong>12 in 12</strong><span>After a previous suspension, 12 points within 12 months triggers a subsequent suspension.</span></div>
            <div class="rule"><strong>12-month suspension</strong><span>A suspension lasting 12 months or more means the licence is revoked and the theory and practical tests must be retaken.</span></div>
            <div class="rule"><strong>Clean for 12 months</strong><span>No new point-carrying offence for 12 months removes the previous demerit points. A 24-month clean record removes previous suspension records.</span></div>
          </div>
          <p class="future-note"><strong>Mock wording warning:</strong> Papers 2 and 9 expect “13 points”, but the official meaning is probationary-licence revocation—not a general test-booking rule. From <strong>1 January 2027</strong>, 13 becomes 12 for probationary drivers, while the first-suspension threshold changes from 24 to 18.</p>
          <div class="cheat-sources"><a href="https://www.police.gov.sg/Knowledge-Hub/Traffic/Traffic-Matters/Driver-Improvement-Point-Systems" target="_blank" rel="noopener noreferrer">Current Traffic Police rules ↗</a><a href="https://www.police.gov.sg/media-hub/news/2026/07/20260731_tightening_of_the_driver_improvement_points" target="_blank" rel="noopener noreferrer">Changes from 2027 ↗</a></div>
        </article>

        <article id="cheat-observation" class="cheat-card">
          <span class="cheat-topic">Hazard routine</span><h3>Observation before movement</h3><p class="memory-hook">Mirrors → signal → blind spot → move only when clear.</p>
          <div class="rule-list">
            <div class="rule"><strong>Lane change</strong><span>Mirrors cannot show every motorcycle or cyclist. Make a direct blind-spot check before moving sideways.</span></div>
            <div class="rule"><strong>Moving off</strong><span>Use mirrors, check the blind spot, signal, then move when the path is clear.</span></div>
            <div class="rule"><strong>Green light</strong><span>Green gives permission, not a guarantee. Approach under control and check that the junction is clear.</span></div>
            <div class="rule"><strong>Parked vehicle</strong><span>Slow down: it may pull out, open a door or hide another road user.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Drivers" target="_blank" rel="noopener noreferrer">Traffic Police driver tips ↗</a></div>
        </article>

        <article id="cheat-distance" class="cheat-card">
          <span class="cheat-topic">Time and traction</span><h3>Following distance, braking and bends</h3><p class="memory-hook">Create time first; make every control input smooth.</p>
          <div class="rule-list">
            <div class="rule"><strong>Three seconds</strong><span>Use the three-second rule at every normal driving speed, and increase the gap when grip or visibility is poor.</span></div>
            <div class="rule"><strong>Wet road</strong><span>Less grip means a longer stopping distance. Brake gently and earlier.</span></div>
            <div class="rule"><strong>Heavy load</strong><span>More mass needs more braking distance.</span></div>
            <div class="rule"><strong>Bend</strong><span>Reduce speed before entering, while the vehicle is straight—not halfway around the bend.</span></div>
            <div class="rule"><strong>Downhill</strong><span>Select a lower gear for engine braking; never coast in neutral or with the clutch held down.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://www.police.gov.sg/-/media/SPF/Knowledge-Hub/Traffic/FT-ENG-2126-Revised.pdf" target="_blank" rel="noopener noreferrer">Official Final Theory handbook ↗</a></div>
        </article>

        <article id="cheat-overtaking" class="cheat-card">
          <span class="cheat-topic">Lane discipline</span><h3>Overtaking and large vehicles</h3><p class="memory-hook">See clearly, leave space, and always keep an escape route.</p>
          <div class="rule-list">
            <div class="rule"><strong>Rightmost lane</strong><span>Use it for overtaking, not as the default cruising lane.</span></div>
            <div class="rule"><strong>Behind a lorry</strong><span>Stay well back for a wider view. A long vehicle may swing opposite its signal before turning.</span></div>
            <div class="rule"><strong>Do not pass</strong><span>Avoid overtaking at bends, junctions, pedestrian crossings or where the view ahead is restricted.</span></div>
            <div class="rule"><strong>Pass goes wrong</strong><span>If the other vehicle speeds up, abandon the attempt and return safely—do not race.</span></div>
            <div class="rule"><strong>Being passed</strong><span>Do not accelerate. Ease off if needed and let the other road user complete the manoeuvre.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-rules.html" target="_blank" rel="noopener noreferrer">LTA driving rules ↗</a></div>
        </article>

        <article id="cheat-expressway" class="cheat-card">
          <span class="cheat-topic">Fast roads</span><h3>Expressways and emergency vehicles</h3><p class="memory-hook">Be predictable: keep left, never reverse, stop only where safe.</p>
          <div class="rule-list">
            <div class="rule"><strong>Missed exit</strong><span>Continue to the next exit. Never stop or reverse on the expressway.</span></div>
            <div class="rule"><strong>Breakdown or puncture</strong><span>Move to the road shoulder if possible, use hazard lights and seek assistance.</span></div>
            <div class="rule"><strong>Road shoulder</strong><span>It is for emergencies, not overtaking or bypassing a queue.</span></div>
            <div class="rule"><strong>Siren behind</strong><span>Keep left, slow down and stop if necessary, while avoiding a sudden dangerous move.</span></div>
            <div class="rule"><strong>Direction unclear</strong><span>Slow down and move left so the emergency vehicle has a predictable path.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road_safety_and_vehicle_rules/driving-in-expressway-and-tunnel.html" target="_blank" rel="noopener noreferrer">LTA expressway and tunnel guide ↗</a></div>
        </article>

        <article id="cheat-people" class="cheat-card">
          <span class="cheat-topic">Vulnerable road users</span><h3>Pedestrians, children and two-wheelers</h3><p class="memory-hook">Distance hook: face = 1 metre; back or bike = 1.5 metres.</p>
          <div class="distance-strip" aria-label="Minimum passing distances"><div class="distance-item"><strong>1 m</strong><span>Pedestrian facing traffic</span></div><div class="distance-item"><strong>1.5 m</strong><span>Pedestrian turned away from traffic</span></div><div class="distance-item"><strong>1.5 m</strong><span>Passing a cyclist, where practicable</span></div></div>
          <div class="rule-list">
            <div class="rule"><strong>Why the difference?</strong><span>A pedestrian facing traffic can see you approaching. Someone turned away may step sideways without seeing you, so leave the larger gap.</span></div>
            <div class="rule"><strong>Passing cyclists</strong><span>Allow at least 1.5 metres where practicable. If there is not enough safe room, slow down and wait instead of squeezing past.</span></div>
            <div class="rule"><strong>Turning</strong><span>Give way to pedestrians who have started crossing the side road you are entering.</span></div>
            <div class="rule"><strong>Reversing</strong><span>Move slowly, check all around and give way to anyone crossing behind.</span></div>
            <div class="rule"><strong>Children</strong><span>A ball, distraction or sudden movement can turn a potential hazard into an immediate one.</span></div>
            <div class="rule"><strong>Elderly people</strong><span>Expect slower movement or misjudgement of your speed; reduce speed and be ready to stop.</span></div>
            <div class="rule"><strong>Motorcycles</strong><span>Expect filtering beside queues and check the blind spot before changing lane or opening a door.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://www.police.gov.sg/-/media/SPF/Knowledge-Hub/Traffic/BT-ENG-24126.pdf" target="_blank" rel="noopener noreferrer">Official distance rules ↗</a><a href="https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Pedestrians" target="_blank" rel="noopener noreferrer">Pedestrian tips ↗</a><a href="https://www.police.gov.sg/Knowledge-Hub/Traffic/Road-Safety-Tips/Road-Safety-Tips-for-Drivers" target="_blank" rel="noopener noreferrer">Driver tips ↗</a></div>
        </article>

        <article id="cheat-control" class="cheat-card">
          <span class="cheat-topic">Loss of control</span><h3>Lights, tyres and mechanical trouble</h3><p class="memory-hook">Slow, smooth and stable beats a sudden reaction.</p>
          <div class="rule-list">
            <div class="rule"><strong>Headlight glare</strong><span>Slow down, look toward the left edge of the road and never retaliate with high beam.</span></div>
            <div class="rule"><strong>High beam</strong><span>Dip it when facing oncoming traffic so the other driver is not dazzled.</span></div>
            <div class="rule"><strong>Tyre puncture</strong><span>Grip the wheel, keep the vehicle stable, brake progressively and stop safely at the side.</span></div>
            <div class="rule"><strong>Overheating</strong><span>Stop safely and let the engine cool. Never remove a hot radiator cap immediately.</span></div>
            <div class="rule"><strong>Pulls while braking</strong><span>Treat it as a defect and have it checked; do not continue normal driving.</span></div>
          </div>
          <div class="cheat-sources"><a href="https://www.police.gov.sg/-/media/SPF/Knowledge-Hub/Traffic/FT-ENG-2126-Revised.pdf" target="_blank" rel="noopener noreferrer">Official Final Theory handbook ↗</a></div>
        </article>
      </div>

      <article id="cheat-bank" class="knowledge-bank">
        <div class="knowledge-bank-head">
          <div><span class="cheat-topic">All ten papers, de-duplicated</span><h3>Complete knowledge index</h3><p class="knowledge-bank-intro">Each item pairs a tested question with its correct answer. Exact duplicates across papers are merged, and the paper references show where the fact appeared.</p></div>
          <span class="knowledge-total">${knowledgeItems.length} distinct facts</span>
        </div>
        <div class="knowledge-controls">
          <input id="knowledgeSearch" type="search" placeholder="Search facts: skid, cyclist, demerit points…" aria-label="Search the complete knowledge index">
          <select id="knowledgeTopic" aria-label="Filter knowledge index by topic">
            <option value="">All topics</option>
            <option>Licensing, offences &amp; penalties</option>
            <option>Driver fitness &amp; attitude</option>
            <option>Observation &amp; communication</option>
            <option>Junctions, signs &amp; signals</option>
            <option>Speed, distance &amp; road conditions</option>
            <option>Overtaking &amp; lane discipline</option>
            <option>Expressways &amp; emergency vehicles</option>
            <option>Vulnerable road users</option>
            <option>Parking &amp; reversing</option>
            <option>Vehicle control &amp; maintenance</option>
            <option>Collisions &amp; breakdowns</option>
            <option>General defensive driving</option>
          </select>
        </div>
        <p id="knowledgeCount" class="knowledge-count"></p>
        <div id="knowledgeList" class="knowledge-groups"></div>
      </article>
    </section>

    <section id="scoresView" hidden>
      <div class="scores-hero"><p class="kicker">Saved on this device</p><h2>Your scores.</h2><p>See the latest saved attempt for every available paper. Resume an unfinished paper or review the answers from a completed one.</p></div>
      <div id="scoreSummary" class="score-summary"></div>
      <div id="scoreGrid" class="score-grid"></div>
    </section>

    <section id="examView" hidden>
      <div class="exam-shell">
        <article class="exam-main">
          <header class="exam-head">
            <div><h2 id="examTitle"></h2><p id="examSub" class="exam-sub"></p></div>
            <div class="exam-status">
              <span id="answeredCount" class="answered-count"></span>
              <button id="paletteToggle" class="palette-toggle" type="button" aria-expanded="false" aria-controls="questionSidebar">Questions</button>
            </div>
          </header>
          <div class="bar"><i id="progressBar"></i></div>
          <div id="questionArea" class="question"></div>
          <nav class="exam-actions" aria-label="Question navigation">
            <button id="prevButton" class="btn" type="button">Previous</button>
            <button id="flagButton" class="btn" type="button">Flag</button>
            <button id="nextWrongButton" class="btn danger" type="button" hidden>Next wrong</button>
            <span class="spacer"></span>
            <button id="nextButton" class="btn primary" type="button" aria-keyshortcuts="Space" title="Press Space for next question">Next</button>
            <button id="submitButton" class="btn primary" type="button">Submit paper</button>
          </nav>
        </article>
        <aside id="questionSidebar" class="sidebar" aria-label="Question palette">
          <div class="sidebar-head">
            <div><h3>Question palette</h3><p class="sidebar-note">Jump to any question.</p></div>
            <button id="paletteClose" class="sidebar-close" type="button">Close</button>
          </div>
          <div id="palette" class="palette"></div>
          <div class="legend"><span><i class="swatch done"></i>Answered</span><span><i class="swatch flag"></i>Flagged</span><span><i class="swatch"></i>Unanswered</span></div>
        </aside>
        <button id="paletteBackdrop" class="palette-backdrop" type="button" hidden aria-label="Close question palette"></button>
      </div>
    </section>

    <section id="resultView" hidden></section>
  </main>
  <footer>Questions captured from completed CDC e-Trial review pages. Teaching notes link to official Singapore Traffic Police and LTA guidance; source links require internet access. For personal study use.</footer>
  <nav class="mobile-tabs" aria-label="Primary navigation">
    <button id="tabPapers" class="mobile-tab active" type="button">Papers</button>
    <button id="tabCheats" class="mobile-tab" type="button">Cheatsheets</button>
    <button id="tabScores" class="mobile-tab" type="button">Scores</button>
  </nav>

  <script>
    const PAPERS = ${appData};
    const PAPER_META = ${paperMetaData};
    let KNOWLEDGE_ITEMS = ${progressive ? "null" : knowledgeData};
    const KNOWLEDGE_SOURCES = ${knowledgeSourcesData};
    const STORAGE_KEY = "ft-offline-practice-v1";
    const THEME_KEY = "ft-theme-v1";
    const PASS_MARK = 45;
    const $ = (selector) => document.querySelector(selector);
    const homeView = $("#homeView"), cheatView = $("#cheatView"), scoresView = $("#scoresView"), examView = $("#examView"), resultView = $("#resultView");
    const questionSidebar = $("#questionSidebar"), paletteBackdrop = $("#paletteBackdrop"), paletteToggle = $("#paletteToggle");
    const state = { paper:null, index:0, order:[], answers:{}, flags:[], submitted:false, startedAt:null };
    const paperLoads = {};
    let paperRequest = 0;
    let knowledgeLoad;
    let viewBeforeCheat="home";

    function esc(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
    function setTheme(theme,persist=true) {
      const dark=theme==="dark"; document.documentElement.dataset.theme=dark?"dark":"light";
      const button=$("#themeButton"); button.innerHTML='<span aria-hidden="true">'+(dark?"☼":"☾")+'</span>'; button.setAttribute("aria-pressed",String(dark)); button.setAttribute("aria-label",dark?"Switch to light mode":"Switch to night mode");
      $("#themeColor").setAttribute("content",dark?"#070a0d":"#f3f5f7");
      if(persist) try{localStorage.setItem(THEME_KEY,dark?"dark":"light");}catch{}
    }
    function readRawStore() { try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return value && typeof value==="object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
    function newAttempt(id,order=Object.keys(PAPER_META[String(id)].answerKey).map(Number)) { return {paper:Number(id),index:0,order:[...order],answers:{},flags:[],submitted:false,startedAt:Date.now()}; }
    function readStore() {
      const store={};
      for(const [id,saved] of Object.entries(readRawStore())) {
        // Never relabel a saved attempt as a different paper or inherit another attempt's fields.
        if(!PAPER_META[id] || !saved || typeof saved!=="object" || Array.isArray(saved) || Number(saved.paper)!==Number(id))continue;
        const clean=newAttempt(id), numbers=clean.order;
        clean.answers=Object.fromEntries(Object.entries(saved.answers||{}).filter(([number,answer])=>numbers.includes(Number(number)) && Number.isInteger(answer) && answer>=0 && answer<=2));
        if(Array.isArray(saved.order) && saved.order.length===numbers.length && new Set(saved.order).size===numbers.length && saved.order.every(number=>numbers.includes(number)))clean.order=[...saved.order];
        clean.index=Number.isInteger(saved.index)?Math.max(0,Math.min(saved.index,numbers.length-1)):0;
        clean.flags=Array.isArray(saved.flags)?saved.flags.filter(number=>numbers.includes(number)):[];
        clean.submitted=saved.submitted===true;
        clean.startedAt=Number.isFinite(saved.startedAt)?saved.startedAt:null;
        store[id]=clean;
      }
      return store;
    }
    function writeStore() { if(!PAPER_META[String(state.paper)])return; const saved=snapshot(), all=readRawStore(); all[String(saved.paper)]=saved; localStorage.setItem(STORAGE_KEY,JSON.stringify(all)); }
    function snapshot() { return {paper:state.paper,index:state.index,order:state.order,answers:state.answers,flags:state.flags,submitted:state.submitted,startedAt:state.startedAt}; }
    async function loadPaper(id) {
      const key=String(id); if(PAPERS[key])return PAPERS[key];
      if(!paperLoads[key]) paperLoads[key]=fetch("paper-data/paper-"+key+".json").then(response=>{if(!response.ok)throw new Error("Paper "+key+" could not be loaded");return response.json();}).then(questions=>{if(questions.length!==PAPER_META[key].count)throw new Error("Paper "+key+" is incomplete");PAPERS[key]=questions;return questions;});
      return paperLoads[key];
    }
    async function ensurePaper(id) { try{document.body.setAttribute("aria-busy","true");await loadPaper(id);return true;}catch{alert("This paper is not available offline yet. Connect once and reload the site to finish offline setup.");return false;}finally{document.body.removeAttribute("aria-busy");} }
    async function ensureKnowledge() {
      if(KNOWLEDGE_ITEMS)return true;
      if(!knowledgeLoad)knowledgeLoad=fetch("knowledge-data.json").then(response=>{if(!response.ok)throw new Error("Knowledge index could not be loaded");return response.json();}).then(items=>KNOWLEDGE_ITEMS=items);
      try{document.body.setAttribute("aria-busy","true");await knowledgeLoad;return true;}catch{alert("The detailed knowledge index is not available offline yet. Connect once and reload the site to finish offline setup.");return false;}finally{document.body.removeAttribute("aria-busy");}
    }
    function shuffle(list) { const copy=[...list]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; }
    function paperQuestions() { return PAPERS[String(state.paper)]; }
    function currentQuestion() { return paperQuestions().find((q)=>q.number===state.order[state.index]); }
    function answerCount() { return Object.keys(state.answers).length; }

    function renderKnowledge() {
      const query=$("#knowledgeSearch").value.trim().toLowerCase(), selectedTopic=$("#knowledgeTopic").value;
      const matches=KNOWLEDGE_ITEMS.filter(item=>(!selectedTopic||item.topic===selectedTopic)&&(!query||(item.question+" "+item.answer+" "+item.topic).toLowerCase().includes(query)));
      $("#knowledgeCount").textContent="Showing "+matches.length+" of "+KNOWLEDGE_ITEMS.length+" distinct facts";
      if(!matches.length){$("#knowledgeList").innerHTML='<div class="knowledge-empty">No facts match that search. Try a shorter word or choose all topics.</div>';return;}
      const topics=[...new Set(matches.map(item=>item.topic))];
      const fallback={title:"Traffic Police — Official Final Driving Theory Handbook",url:"https://www.police.gov.sg/-/media/SPF/Knowledge-Hub/Traffic/FT-ENG-2126-Revised.pdf"};
      $("#knowledgeList").innerHTML=topics.map((topic)=>{
        const facts=matches.filter(item=>item.topic===topic), source=KNOWLEDGE_SOURCES[topic]||fallback, expanded=query||selectedTopic?" open":"";
        const items=facts.map(item=>{
          const references=item.references.map(ref=>"P"+ref.paper+" Q"+ref.number).join(" · ");
          return '<article class="knowledge-item"><p class="knowledge-question">'+esc(item.question)+'</p><strong class="knowledge-answer">Correct: '+esc(item.answer)+'</strong><span class="knowledge-ref">'+esc(references)+'</span></article>';
        }).join("");
        return '<details class="knowledge-group"'+expanded+'><summary><span>'+esc(topic)+'</span><small>'+facts.length+' fact'+(facts.length===1?"":"s")+'</small></summary><div class="knowledge-items">'+items+'</div><a class="knowledge-source" href="'+source.url+'" target="_blank" rel="noopener noreferrer">Official source: '+esc(source.title)+' ↗</a></details>';
      }).join("");
    }

    function setPaletteOpen(open,restoreFocus=false) {
      const shouldOpen=Boolean(open)&&window.matchMedia("(max-width:860px)").matches;
      questionSidebar.classList.toggle("mobile-open",shouldOpen); paletteBackdrop.hidden=!shouldOpen; document.body.classList.toggle("palette-open",shouldOpen); paletteToggle.setAttribute("aria-expanded",String(shouldOpen));
      if(shouldOpen) $("#paletteClose").focus(); else if(restoreFocus) paletteToggle.focus();
    }
    function updateTabs(view) { const active=view==="cheat"?"cheats":view==="scores"||view==="result"?"scores":"papers"; [["#tabPapers","papers"],["#tabCheats","cheats"],["#tabScores","scores"]].forEach(([selector,name])=>{const button=$(selector),selected=name===active;button.classList.toggle("active",selected);if(selected)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");}); }
    function show(view) { if(view==="scores")renderScores(); homeView.hidden=view!=="home"; cheatView.hidden=view!=="cheat"; scoresView.hidden=view!=="scores"; examView.hidden=view!=="exam"; resultView.hidden=view!=="result"; document.body.dataset.view=view; $("#homeButton").hidden=view==="home"; $("#homeButton").textContent=view==="cheat"?"Back":"Papers"; $("#cheatButton").hidden=view==="cheat"; updateTabs(view); setPaletteOpen(false); window.scrollTo({top:0,behavior:"smooth"}); }
    function goHome() { paperRequest++; if(state.paper && !state.submitted) writeStore(); renderHome(); show("home"); }
    async function openCheat() { viewBeforeCheat=document.body.dataset.view||"home"; if(!await ensureKnowledge())return; renderKnowledge(); show("cheat"); }
    function openScores() { paperRequest++; if(state.paper&&!state.submitted)writeStore(); show("scores"); }

    function renderHome() {
      const store=readStore(); const readyIds=Object.keys(PAPER_META).sort((a,b)=>Number(a)-Number(b)); const ids=Array.from({length:10},(_,i)=>String(i+1));
      const total=readyIds.reduce((sum,id)=>sum+PAPER_META[id].count,0); const images=readyIds.reduce((sum,id)=>sum+PAPER_META[id].images,0);
      $("#statusStrip").innerHTML='<span class="chip">'+readyIds.length+' of 10 papers ready</span><span class="chip">'+total+' questions</span><span class="chip">'+images+' offline diagrams</span><span class="chip">Pass mark '+PASS_MARK+'/50</span>';
      $("#paperGrid").innerHTML=ids.map((id)=>{
        if(!PAPER_META[id]) return '<article class="paper-card placeholder"><span class="paper-no">Final Theory · Pending</span><h3>Paper '+id+'</h3><p class="paper-meta">Questions not captured yet</p><div class="paper-progress"><i style="width:0%"></i></div><p class="progress-label">Add this paper in a future session</p><div class="card-actions"><button class="btn" type="button" disabled>Not added yet</button></div></article>';
        const saved=store[id]||{}; const answered=Object.keys(saved.answers||{}).length; const score=saved.submitted ? scoreFor(id,saved.answers||{}) : null; const pct=Math.round(answered/50*100);
        const label=saved.submitted ? score+'/50 last score' : answered ? answered+'/50 answered' : 'Not started';
        return '<article class="paper-card"><span class="paper-no">Final Theory</span><h3>Paper '+id+'</h3><p class="paper-meta">'+PAPER_META[id].count+' questions · '+PAPER_META[id].images+' diagrams</p><div class="paper-progress"><i style="width:'+pct+'%"></i></div><p class="progress-label">'+label+'</p><div class="card-actions"><button class="btn primary" data-start="'+id+'">'+(answered&&!saved.submitted?'Resume':'Start')+'</button><button class="btn" data-shuffle="'+id+'">Shuffle</button>'+(answered||saved.submitted?'<button class="btn small danger" data-reset="'+id+'" title="Clear saved progress">Reset</button>':'')+'</div></article>';
      }).join("");
      document.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startPaper(b.dataset.start,false)));
      document.querySelectorAll("[data-shuffle]").forEach(b=>b.addEventListener("click",()=>startPaper(b.dataset.shuffle,true)));
      document.querySelectorAll("[data-reset]").forEach(b=>b.addEventListener("click",()=>resetPaper(b.dataset.reset)));
    }

    function renderScores() {
      const store=readStore(), ids=Object.keys(PAPER_META).sort((a,b)=>Number(a)-Number(b));
      const completed=ids.filter(id=>store[id]?.submitted);
      const best=completed.length?Math.max(...completed.map(id=>scoreFor(id,store[id].answers||{}))):null;
      const totalAnswered=ids.reduce((sum,id)=>sum+Object.keys(store[id]?.answers||{}).length,0);
      $("#scoreSummary").innerHTML='<div class="score-stat"><strong>'+completed.length+'/'+ids.length+'</strong><span>Papers completed</span></div><div class="score-stat"><strong>'+(best===null?'—':best+'/50')+'</strong><span>Best latest score</span></div><div class="score-stat"><strong>'+totalAnswered+'</strong><span>Answers saved</span></div>';
      $("#scoreGrid").innerHTML=ids.map(id=>{
        const saved=store[id], answered=Object.keys(saved?.answers||{}).length;
        if(!saved||(!answered&&!saved.submitted)) return '<article class="score-card"><div class="score-card-head"><div><span class="paper-no">Final Theory</span><h3>Paper '+id+'</h3></div><span class="score-status">Not started</span></div><p class="score-big">—</p><p class="score-detail">No saved attempt yet</p><div class="paper-progress"><i style="width:0%"></i></div><div class="card-actions"><button class="btn primary" type="button" data-score-paper="'+id+'">Start paper</button></div></article>';
        if(saved.submitted){const score=scoreFor(id,saved.answers||{}),passed=score>=PASS_MARK;return '<article class="score-card"><div class="score-card-head"><div><span class="paper-no">Final Theory</span><h3>Paper '+id+'</h3></div><span class="score-status '+(passed?'pass':'retry')+'">'+(passed?'Passed':'Keep practising')+'</span></div><p class="score-big">'+score+'/50</p><p class="score-detail">Latest saved attempt · '+(score*2)+'%</p><div class="paper-progress"><i style="width:'+(score*2)+'%"></i></div><div class="card-actions"><button class="btn primary" type="button" data-score-paper="'+id+'">Review answers</button></div></article>';}
        const pct=Math.round(answered/50*100);return '<article class="score-card"><div class="score-card-head"><div><span class="paper-no">Final Theory</span><h3>Paper '+id+'</h3></div><span class="score-status">In progress</span></div><p class="score-big">'+answered+'/50</p><p class="score-detail">Questions answered</p><div class="paper-progress"><i style="width:'+pct+'%"></i></div><div class="card-actions"><button class="btn primary" type="button" data-score-paper="'+id+'">Resume paper</button></div></article>';
      }).join("");
      document.querySelectorAll("[data-score-paper]").forEach(button=>button.addEventListener("click",()=>openStoredPaper(button.dataset.scorePaper)));
    }

    async function openStoredPaper(id) { const request=++paperRequest; if(!await ensurePaper(id) || request!==paperRequest)return; const saved=readStore()[id]; if(!saved)return startPaper(id,false); Object.assign(state,saved); if(state.submitted)state.index=wrongIndexes()[0]??0; writeStore(); renderExam(); show("exam"); }

    function resetPaper(id) { if(!confirm("Clear saved progress for Paper "+id+"?")) return; paperRequest++; const all=readRawStore(); delete all[id]; localStorage.setItem(STORAGE_KEY,JSON.stringify(all)); if(String(state.paper)===String(id))Object.assign(state,{paper:null,index:0,order:[],answers:{},flags:[],submitted:false,startedAt:null}); renderHome(); }
    async function startPaper(id,randomize) {
      const request=++paperRequest;
      if(!await ensurePaper(id) || request!==paperRequest)return;
      const saved=readStore()[id]; const numbers=PAPERS[id].map(q=>q.number);
      Object.assign(state,saved && !randomize && !saved.submitted ? saved : newAttempt(id,randomize?shuffle(numbers):numbers));
      writeStore(); renderExam(); show("exam");
    }

    function scoreFor(id,answers) { return Object.entries(PAPER_META[String(id)].answerKey).reduce((sum,[number,correct])=>sum+(Number(answers[number])===correct?1:0),0); }
    function wrongIndexes() { return state.order.reduce((indexes,number,index)=>{const q=paperQuestions().find(item=>item.number===number);if(!q.options[Number(state.answers[number])]?.correct)indexes.push(index);return indexes;},[]); }
    function goToNextWrong() { const wrong=wrongIndexes(); if(!wrong.length)return; const next=wrong.find(index=>index>state.index)??wrong[0]; state.index=next; writeStore(); renderExam(); window.scrollTo({top:0,behavior:"smooth"}); }

    function teachingPrinciple(q) {
      const s=(q.question+" "+q.options.map(o=>o.text).join(" ")).toLowerCase();
      if(/alcohol|drug|drows|tired|fatigue|sleep/.test(s)) return "alcohol, drugs and fatigue reduce judgement and reaction time before a driver may feel seriously impaired; the safe response is to avoid driving or stop and rest";
      if(/stationary vehicle|parked vehicle|parked car|driver in it|move out suddenly/.test(s)) return "a stationary vehicle may pull out, open a door or hide another road user without much warning, so reduce speed and prepare to stop before passing it";
      if(/changing gear.*look|when changing gear|look.*road ahead|attention.*road/.test(s)) return "your eyes should remain on the traffic scene while your hands operate familiar controls; looking down delays hazard detection even for a moment";
      if(/blind spot|mirror|change lane|changing lane|move off|moving off|open.*door|signal/.test(s)) return "safe movement starts with mirrors, a signal and a direct blind-spot check; mirrors alone cannot show every cyclist, motorcycle or vehicle beside you";
      if(/three.second|following distance|follow.*clos|vehicle in front|tailgat|safe gap|time gap/.test(s)) return "a time gap gives you room to perceive, react and brake, and unlike a fixed car-length estimate it grows naturally with speed";
      if(/pedestrian|zebra|elderly|child|cyclist|bicycle|motorcycl/.test(s)) return "vulnerable road users have little physical protection and may move unexpectedly, so a driver should reduce speed, create space and be ready to stop";
      if(/right.?most outer lane.*expressway/.test(s)) return "the wording means the outermost right lane: it is for overtaking and emergency vehicles, while normal traffic keeps left and slower vehicles use the leftmost lane";
      if(/ambulance|emergency vehicle|siren|fire engine|police vehicle/.test(s)) return "emergency vehicles need a clear, predictable path; slow down, keep left and stop if necessary instead of racing them or making a sudden move";
      if(/expressway|tunnel|road shoulder|missed.*exit|break.*down|puncture.*expressway/.test(s)) return "expressway traffic is fast and expects one-way, predictable movement; use the shoulder only for an emergency, never reverse for a missed exit, and continue to the next safe exit";
      if(/bend|curve|centrifugal|corner/.test(s)) return "speed should be reduced before the bend, while the vehicle is straight; entering slowly preserves tyre grip and leaves steering capacity for the curve";
      if(/brake|braking|skid|slippery|wet road|flood|tyre|tire|puncture|friction/.test(s)) return "traction is limited, especially on wet surfaces or damaged tyres; smooth steering and progressive braking preserve grip while harsh inputs can start a skid";
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
      const s=choice.toLowerCase(), context=q.question.toLowerCase();
      if(/right.?most outer lane.*expressway/.test(context)&&/maximum speed limit/.test(s)) return "Reaching the speed limit does not make the right lane a cruising lane; after overtaking, move back left when it is safe.";
      if(/right.?most outer lane.*expressway/.test(context)&&/slow moving/.test(s)) return "Slow-moving vehicles should use the leftmost lane, not the rightmost overtaking lane.";
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
      if(chosen?.correct) return '<aside class="teaching is-correct" role="status"><span class="teaching-label">Correct</span></aside>';
      const opening=chosen?'<strong>'+chosen.label+' → '+correct.label+':</strong> ':'<strong>Unanswered → '+correct.label+':</strong> ';
      const contrast=chosen?distractorContrast(chosen.text,q):"Review the correct option and connect it to the safety principle above.";
      const source=officialSource(q);
      const extra='<p>'+esc(contrast)+'</p><a class="source-link" href="'+source.url+'" target="_blank" rel="noopener noreferrer">Official source: '+esc(source.title)+' ↗</a>';
      return '<aside class="teaching" role="status"><span class="teaching-label">Wrong — learn this one</span><p>'+opening+'Choose <strong>“'+esc(correct.text)+'”</strong> because '+teachingPrinciple(q)+'.</p><div class="feedback-extra">'+extra+'</div><details class="feedback-mobile"><summary>Compare your answer + source</summary>'+extra+'</details></aside>';
    }

    function renderExam() {
      const q=currentQuestion(); const review=state.submitted; const selected=state.answers[q.number]; const answered=selected!==undefined; const reveal=review||answered; const wrong=review?wrongIndexes():[];
      $("#examTitle").innerHTML='<span class="exam-prefix">Final Theory </span>Paper '+state.paper; $("#examSub").textContent=review?"Answer review · Press Space for next":"Choose with 1, 2, or 3. Feedback appears immediately; press Space for next.";
      $("#answeredCount").textContent=review?wrong.length+" wrong":answerCount()+" / 50 answered"; paletteToggle.innerHTML='<span class="palette-label">Questions · </span>'+(state.index+1)+"/50"; paletteToggle.setAttribute("aria-label","Questions, "+(state.index+1)+" of 50"); $("#progressBar").style.width=(answerCount()/50*100)+"%";
      const image=q.image?'<img class="diagram" src="'+q.image.src+'" alt="'+esc(q.image.alt)+'" width="'+q.image.width+'" height="'+q.image.height+'" loading="lazy" decoding="async" fetchpriority="high">':"";
      const choices=q.options.map((option,i)=>{
        let cls="choice", tag=""; if(reveal&&option.correct){cls+=" correct";tag="Correct";} else if(reveal&&String(i)===String(selected)&&!option.correct){cls+=" wrong";tag="Your answer";}
        if(reveal&&!review&&!option.correct&&String(i)!==String(selected))cls+=" compact-hidden";
        return '<label class="'+cls+'"><input type="radio" name="answer" value="'+i+'" aria-keyshortcuts="'+(i+1)+'" title="Press '+(i+1)+' to select" '+(String(i)===String(selected)?'checked':'')+' '+(reveal?'disabled':'')+'><span class="choice-letter">'+option.label+'</span><span>'+esc(option.text)+'</span><span class="answer-tag">'+tag+'</span></label>';
      }).join("");
      const feedback=reveal?teachingFeedback(q,selected):"";
      const questionArea=$("#questionArea"); questionArea.classList.toggle("has-diagram",Boolean(q.image)); questionArea.classList.toggle("revealed",reveal); questionArea.classList.toggle("reviewing",review);
      questionArea.innerHTML='<p class="q-label">Question '+q.number+' · '+(state.index+1)+' of 50</p><h3>'+esc(q.question)+'</h3>'+image+'<div class="choices">'+choices+'</div>'+feedback;
      if(!reveal) document.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener("change",()=>{state.answers[q.number]=Number(input.value);writeStore();renderExam();}));
      $("#prevButton").disabled=state.index===0; $("#nextButton").hidden=state.index===49; $("#submitButton").hidden=state.index!==49||review; $("#flagButton").hidden=review;
      $("#nextWrongButton").hidden=!review||!wrong.length; $("#nextWrongButton").disabled=wrong.length===1&&wrong[0]===state.index; $("#nextWrongButton").textContent=$("#nextWrongButton").disabled?"Only wrong":"Next wrong";
      $("#flagButton").textContent=state.flags.includes(q.number)?"Unflag":"Flag"; renderPalette();
    }

    function renderPalette() {
      $("#palette").innerHTML=state.order.map((number,index)=>{
        let cls="q-dot"; if(index===state.index) cls+=" active";
        if(state.submitted){const q=paperQuestions().find(x=>x.number===number);cls+=q.options[Number(state.answers[number])]?.correct?" review-correct":" review-wrong";}
        else if(state.flags.includes(number)) cls+=" flagged"; else if(state.answers[number]!==undefined) cls+=" answered";
        return '<button class="'+cls+'" data-index="'+index+'" type="button" aria-label="Question '+number+'">'+number+'</button>';
      }).join("");
      document.querySelectorAll("[data-index]").forEach(b=>b.addEventListener("click",()=>{state.index=Number(b.dataset.index);writeStore();renderExam();setPaletteOpen(false);window.scrollTo({top:0,behavior:"smooth"});}));
    }

    function submitPaper() {
      const unanswered=50-answerCount(); if(unanswered && !confirm("You still have "+unanswered+" unanswered question"+(unanswered===1?"":"s")+". Submit anyway?")) return;
      state.submitted=true; writeStore(); renderResult(); show("result");
    }
    function renderResult() {
      const score=scoreFor(state.paper,state.answers), pct=score*2, passed=score>=PASS_MARK, missed=50-score;
      const reviewLabel=missed?'Review '+missed+' missed':'Review answers';
      resultView.innerHTML='<div class="result-panel"><div class="score-ring" style="--score:'+pct+'%"><div class="score-value"><strong>'+score+'/50</strong><span>'+pct+'%</span></div></div><p class="kicker">Paper '+state.paper+' complete</p><h2>'+(passed?'Pass — well done':'Keep practising')+'</h2><p>You answered '+score+' correctly and have '+missed+' question'+(missed===1?'':'s')+' to review. The pass mark is '+PASS_MARK+'/50.</p><div class="result-actions"><button id="reviewButton" class="btn primary">'+reviewLabel+'</button><button id="retryButton" class="btn">Retry paper</button><button id="resultHome" class="btn">All papers</button></div></div>';
      $("#reviewButton").addEventListener("click",()=>{state.index=wrongIndexes()[0]??0;writeStore();renderExam();show("exam");});
      $("#retryButton").addEventListener("click",()=>startPaper(String(state.paper),false)); $("#resultHome").addEventListener("click",goHome);
    }

    $("#homeButton").addEventListener("click",()=>{if(document.body.dataset.view==="cheat")show(viewBeforeCheat);else goHome();}); $("#cheatButton").addEventListener("click",openCheat); $("#themeButton").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark")); $("#tabPapers").addEventListener("click",goHome); $("#tabCheats").addEventListener("click",()=>{if(document.body.dataset.view!=="cheat")openCheat();}); $("#tabScores").addEventListener("click",openScores); $("#prevButton").addEventListener("click",()=>{if(state.index>0){state.index--;writeStore();renderExam();}});
    $("#nextButton").addEventListener("click",()=>{if(state.index<49){state.index++;writeStore();renderExam();}}); $("#submitButton").addEventListener("click",submitPaper);
    $("#flagButton").addEventListener("click",()=>{const n=currentQuestion().number;state.flags=state.flags.includes(n)?state.flags.filter(x=>x!==n):[...state.flags,n];writeStore();renderExam();});
    $("#nextWrongButton").addEventListener("click",goToNextWrong);
    paletteToggle.addEventListener("click",()=>setPaletteOpen(!questionSidebar.classList.contains("mobile-open"))); $("#paletteClose").addEventListener("click",()=>setPaletteOpen(false,true)); paletteBackdrop.addEventListener("click",()=>setPaletteOpen(false,true));
    window.addEventListener("resize",()=>{if(!window.matchMedia("(max-width:860px)").matches)setPaletteOpen(false);});
    document.addEventListener("keydown",(event)=>{
      if(event.key==="Escape"&&questionSidebar.classList.contains("mobile-open")){setPaletteOpen(false,true);return;}
      if(examView.hidden||questionSidebar.classList.contains("mobile-open")||event.ctrlKey||event.metaKey||event.altKey||event.target.matches("textarea,select,input:not([type=radio])"))return;
      if(!state.submitted&&/^[123]$/.test(event.key)){const input=document.querySelector('input[name="answer"][value="'+(Number(event.key)-1)+'"]');if(input&&!input.disabled){event.preventDefault();input.click();}return;}
      if(event.code==="Space"||event.key===" "){event.preventDefault();if(!$("#nextButton").hidden)$("#nextButton").click();return;}
      if(event.key==="ArrowLeft")$("#prevButton").click();if(event.key==="ArrowRight"&&!$("#nextButton").hidden)$("#nextButton").click();
    });
    $("#knowledgeSearch").addEventListener("input",renderKnowledge); $("#knowledgeTopic").addEventListener("change",renderKnowledge);
    setTheme(document.documentElement.dataset.theme==="dark"?"dark":"light",false); if(KNOWLEDGE_ITEMS)renderKnowledge(); renderHome(); show("home");
    ${serviceWorkerRegistration}
  </script>
</body>
</html>`.replace(/[ \t]+$/gm, "");
}

const optimizedHtml = buildHtml({}, true);
const standaloneHtml = buildHtml(embeddedPapers, false);
const paperDataEntries = Object.entries(optimizedPapers);
const optimizedAssets = [...optimizedAssetNames].sort().map((name) => `./optimized-assets/${name}`);
const paperAssets = paperDataEntries.map(([paper]) => `./paper-data/paper-${paper}.json`);
const buildVersion = createHash("sha256")
  .update(optimizedHtml)
  .update(JSON.stringify(optimizedPapers))
  .update(knowledgeData)
  .digest("hex")
  .slice(0, 12);

const manifest = JSON.stringify({
  id: "./",
  name: "Theory Go Where",
  short_name: "Theory",
  description: "Offline Singapore Final Theory practice",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#070a0d",
  theme_color: "#102d3c",
  icons: [{ src: "app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
}, null, 2);

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#102d3c"/><rect x="76" y="76" width="360" height="360" rx="72" fill="none" stroke="#70c9f5" stroke-width="18"/><text x="256" y="310" fill="#e5edf3" font-family="ui-monospace,monospace" font-size="152" font-weight="500" text-anchor="middle">FT</text></svg>`;

const precache = ["./", "./index.html", "./manifest.webmanifest", "./app-icon.svg", "./knowledge-data.json", ...paperAssets, ...optimizedAssets];
const serviceWorker = `const CACHE="theory-go-where-${buildVersion}";
const PRECACHE=${JSON.stringify(precache)};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("theory-go-where-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==="navigate")event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;}).catch(()=>caches.match(request).then(hit=>hit||caches.match("./index.html"))));
  else event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;})));
});`;

await mkdir(new URL("paper-data/", here), { recursive: true });
await Promise.all([
  writeFile(new URL("final-theory-offline-practice.html", here), standaloneHtml),
  writeFile(new URL("index.html", here), optimizedHtml),
  writeFile(new URL("manifest.webmanifest", here), manifest),
  writeFile(new URL("app-icon.svg", here), iconSvg),
  writeFile(new URL("sw.js", here), serviceWorker),
  writeFile(new URL("knowledge-data.json", here), knowledgeData),
  ...paperDataEntries.map(([paper, questions]) => writeFile(new URL(`paper-data/paper-${paper}.json`, here), JSON.stringify(questions).replaceAll("<", "\\u003c"))),
]);
console.log(`Built optimized index.html (${buildVersion}) and standalone practice with ${Object.keys(rawPapers).length} papers, ${Object.values(rawPapers).flat().length} questions, and ${optimizedAssetNames.size} unique diagrams.`);
