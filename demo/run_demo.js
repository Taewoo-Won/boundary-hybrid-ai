// Demo run used for the submitted video. Pasted into the app page (or run by an agent), then "● Record demo" is
// clicked; once recording starts it drives the real app — real Gemini Nano on device, real cloud call.
// It only adds presentation: title/end cards, a caption bar, a highlight ring, narration clips and a quiet music bed
// (public/voice: Kokoro TTS + a synthesised pad). The app itself is untouched. Nano's findings vary run to run;
// anything it misses is kept back on the review screen, as a user would.
// Flags (set before pasting): window._demoDry = true (rehearse without the recorder), window._demoMute = true (silent),
// window._demoZoom = 1.35 (scale the UI; default 1.35 when the window is at least 1600 px wide).
(() => {
  const $ = (id) => document.getElementById(id), sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = location.pathname.replace(/[^/]*$/, "");
  window._log = []; let t0 = 0;
  const L = (m) => _log.push(`${t0 ? ((performance.now() - t0) / 1000).toFixed(1) : "-"}s ${m}`);
  const zoom = window._demoZoom ?? (innerWidth >= 1600 ? 1.35 : 1);
  const css = document.createElement("style");
  css.textContent = `
  #demoCap{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:max-content;max-width:min(1120px,90vw);
    background:rgba(29,31,28,.9);color:#f6f4ef;font:500 18px/1.45 Inter,"Segoe UI",system-ui,sans-serif;padding:11px 20px;border-radius:10px;
    z-index:9998;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.22);transition:opacity .35s}#demoCap:empty{opacity:0}
  .demoRing{outline:3px solid #c2410c!important;outline-offset:5px;border-radius:8px}
  #demoCard{position:fixed;inset:0;z-index:9999;background:#f6f4ef;color:#1d1f1c;display:grid;place-items:center;transition:opacity .8s;opacity:0}
  #demoCard.on{opacity:1}#demoCard .in{max-width:900px;padding:0 48px}
  #demoCard .brand{display:flex;align-items:center;gap:18px}#demoCard .mk{width:54px;height:54px;border:6px solid #1f6f4a;border-right-color:#9a5b12;border-radius:50%}
  #demoCard h1{font:600 64px/1 Georgia,"Times New Roman",serif;letter-spacing:-.015em;margin:0}
  #demoCard .lead{font:400 26px/1.4 Inter,"Segoe UI",system-ui,sans-serif;margin:26px 0 0;max-width:780px}
  #demoCard .meta{font:500 15px/1.6 Inter,"Segoe UI",system-ui,sans-serif;color:#6b6e66;margin-top:30px;border-top:2px solid #1d1f1c;padding-top:14px;display:flex;gap:22px;flex-wrap:wrap}
  #demoCard .meta b{color:#1f6f4a;font-weight:600}#demoCard .meta i{color:#9a5b12;font-style:normal;font-weight:600}
  #demoCard .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px}
  #demoCard .st{border:1px solid #d9d5ca;background:#fff;border-radius:8px;padding:16px 18px}
  #demoCard .st .v{font:600 44px/1 Georgia,serif}#demoCard .st .k{font:500 14px/1.4 Inter,system-ui,sans-serif;color:#6b6e66;margin-top:8px}
  #demoCard .st.hi{background:#e3efe7;border-color:#b9d6c3}#demoCard .st.hi .v{color:#1f6f4a}
  #demoCard .fine{font:400 13px/1.5 Inter,system-ui,sans-serif;color:#6b6e66;margin-top:12px}
  #demoCard .links{font:500 17px/1.7 Inter,"Segoe UI",system-ui,sans-serif;margin-top:24px;color:#1d1f1c}
  html{scrollbar-width:none}`;
  document.head.append(css);
  if (zoom !== 1) document.body.style.zoom = String(zoom);
  // on <html>, not <body>, so the UI zoom does not scale the overlays
  const cap = Object.assign(document.createElement("div"), { id: "demoCap" }); document.documentElement.append(cap);
  const card = Object.assign(document.createElement("div"), { id: "demoCard" }); document.documentElement.append(card);
  const TITLE = `<div class="in"><div class="brand"><div class="mk"></div><h1>Boundary</h1></div>
    <p class="lead">Cloud AI help with case notes — while names, health details and contact data stay on this device.</p>
    <div class="meta"><span><b>Gemini Nano</b> · on device</span><span><i>Gemini</i> · in the cloud</span><span>Firebase AI Logic hybrid inference</span><span>Live run · Chrome desktop</span></div></div>`;
  const END = `<div class="in"><div class="brand"><div class="mk"></div><h1>Boundary</h1></div>
    <div class="stats"><div class="st"><div class="v">29.5%</div><div class="k">rules only</div></div>
    <div class="st"><div class="v">88.6%</div><div class="k">+ Gemini Nano on device</div></div>
    <div class="st hi"><div class="v">90.9%</div><div class="k">+ on-device re-check, then a person reviews</div></div></div>
    <p class="fine">Share of labelled personal-data spans kept back · 10 synthetic notes, 44 spans · measured on a Windows PC, Chrome 157, 22 Nov 2026</p>
    <div class="links">taewoo-won.github.io/boundary-hybrid-ai<br>github.com/Taewoo-Won/boundary-hybrid-ai · Apache-2.0</div></div>`;
  const showCard = async (html) => { card.innerHTML = html; card.style.display = "grid"; await sl(30); card.classList.add("on"); await sl(800); };
  const hideCard = async () => { card.classList.remove("on"); await sl(850); card.style.display = "none"; };
  card.style.display = "none";
  let lines = {};
  fetch(`${base}voice/lines.json`).then((r) => r.json()).then((j) => (lines = j)).catch(() => {});
  const bed = new Audio(`${base}voice/bed.mp3`); bed.volume = 0.6; bed.muted = !!window._demoMute;
  const fadeBed = async () => { for (let v = bed.volume; v > 0.02; v -= 0.05) { bed.volume = Math.max(0, v); await sl(120); } bed.pause(); };
  const say = (k, withCap = true) => new Promise((res) => {
    cap.textContent = withCap ? lines[k] || "" : ""; L(`say ${k}`);
    const a = new Audio(`${base}voice/${k}.mp3`);
    a.muted = !!window._demoMute; // silent rehearsal: the clip still runs its full length
    const done = () => res();
    a.onended = () => setTimeout(done, 450); a.onerror = () => setTimeout(done, 4000);
    a.play().catch(() => setTimeout(done, 6000));
  });
  const ring = (el) => { document.querySelectorAll(".demoRing").forEach((e) => e.classList.remove("demoRing")); el?.classList.add("demoRing"); };
  const show = async (el, block = "center") => { el.scrollIntoView({ behavior: "smooth", block }); await sl(700); };
  const until = async (f, ms) => { const e = performance.now() + ms; while (performance.now() < e) { if (f()) return true; await sl(250); } return false; };
  const stop = async () => { ring(null); cap.textContent = ""; await fadeBed(); await sl(500); if (/Stop/.test($("rec").textContent)) $("rec").click(); L("STOP " + $("recStatus").textContent); };
  const chip = (cls) => [...document.querySelectorAll("#chips li")].find((li) => li.querySelector(".cls").textContent === cls);

  window._demo = (async () => {
    if (!window._demoDry && !(await until(() => /^Recording/.test($("recStatus").textContent), 240000))) return L("no recording");
    t0 = performance.now(); L(`rec ${innerWidth}x${innerHeight} zoom ${zoom}`);
    window.scrollTo({ top: 0 });
    bed.play().catch(() => L("bed blocked"));
    await showCard(TITLE); await sl(3800); await hideCard();
    await say("s00");
    $("sample").click(); $("task").value = "reply"; $("task").dispatchEvent(new Event("change")); ring($("note"));
    await say("s01");
    ring($("prep")); await sl(400); $("prep").click(); L("prep");
    const det = until(() => /Checked on device|fail|unavailable|usable/i.test($("msg1").textContent), 90000);
    await say("s02"); ring(null);
    if (!(await det) || !/Checked on device/.test($("msg1").textContent)) { L("detect: " + $("msg1").textContent); return stop(); }
    L("detect: " + $("msg1").textContent);
    await show($("s2"), "start"); ring($("ledger"));
    await say("s03");
    await show($("outgoing")); ring($("outgoing"));
    await say("s04");
    await show($("addVal")); ring($("addVal").closest(".row") || $("addVal").parentElement);
    const missed = [["Hope Clinic", "ORG"], ["panic attacks", "HEALTH"], ["sertraline", "HEALTH"]]
      .filter(([v]) => $("outgoing").textContent.includes(v));
    const narr = say("s05");
    for (const [v, c] of missed) { $("addVal").value = v; $("addCls").value = c; await sl(1100); $("add").click(); L("add " + v); await sl(500); }
    await narr;
    const ph = chip("PHONE");
    if (ph) {
      await show(ph); ring(ph); ph.querySelector("input").click(); await sl(300); ring($("msg2"));
      await say("s06");
      chip("PHONE").querySelector("input").click(); await sl(500);
    }
    await show($("send")); ring($("send")); await sl(300);
    for (let i = 0; i < 3; i++) {
      $("send").click(); L("send " + i);
      const rc = until(() => /nothing more found|kept back|fail|Not sent/i.test($("msg2").textContent + " " + $("msg3").textContent), 90000);
      if (i === 0) { ring($("msg2")); await say("s07"); }
      if (!(await rc)) return stop();
      L("recheck: " + $("msg2").textContent);
      if (/kept back/.test($("msg2").textContent)) { await sl(2500); continue; }
      break;
    }
    ring(null);
    const ans = until(() => !$("s3").hidden && $("msg3").textContent.length > 5, 120000);
    await say("s08");
    if (!(await ans)) return stop();
    L("answer: " + $("msg3").textContent.slice(0, 80));
    await show($("s3"), "start"); ring($("final"));
    await say("s09");
    await show($("ledger"), "start"); ring($("ledger"));
    await say("s10");
    ring(null); cap.textContent = "";
    await showCard(END);
    await say("s11", false);
    await sl(1500);
    await stop();
  })().catch((e) => L("ERR " + e));
  return "armed";
})();
