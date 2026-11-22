// Demo run used for the submitted video (22 Nov 2026). Pasted into the app page's console (or run by an agent),
// then "● Record demo" is clicked; once recording starts it drives the real app: real Gemini Nano, real cloud call.
// It only adds a caption bar, a highlight ring and the narration clips (public/voice, Kokoro TTS) — the app itself
// is untouched. Nano's findings vary run to run; anything it misses is kept back on the review screen, as a user would.
(() => {
  const $ = (id) => document.getElementById(id), sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = location.pathname.replace(/[^/]*$/, "");
  window._log = []; let t0 = 0;
  const L = (m) => _log.push(`${t0 ? ((performance.now() - t0) / 1000).toFixed(1) : "-"}s ${m}`);
  const css = document.createElement("style");
  css.textContent = `#demoCap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(1040px,92vw);
    background:rgba(20,20,18,.88);color:#faf8f2;font:500 19px/1.45 Inter,system-ui,sans-serif;padding:12px 20px;border-radius:12px;
    z-index:9999;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .3s}#demoCap:empty{opacity:0}
    .demoRing{outline:3px solid #c2410c!important;outline-offset:5px;border-radius:10px;transition:outline-color .3s}`;
  document.head.append(css);
  const cap = Object.assign(document.createElement("div"), { id: "demoCap" }); document.body.append(cap);
  let lines = {};
  fetch(`${base}voice/lines.json`).then((r) => r.json()).then((j) => (lines = j)).catch(() => {});
  const say = (k) => new Promise((res) => {
    cap.textContent = lines[k] || ""; L(`say ${k}`);
    const a = new Audio(`${base}voice/${k}.mp3`);
    a.muted = !!window._demoMute; // silent rehearsal: the clip still runs its full length
    const done = () => { res(); };
    a.onended = () => setTimeout(done, 450); a.onerror = () => setTimeout(done, 4000);
    a.play().catch(() => setTimeout(done, 6000));
  });
  const ring = (el) => { document.querySelectorAll(".demoRing").forEach((e) => e.classList.remove("demoRing")); el?.classList.add("demoRing"); };
  const show = async (el, block = "center") => { el.scrollIntoView({ behavior: "smooth", block }); await sl(700); };
  const until = async (f, ms) => { const e = performance.now() + ms; while (performance.now() < e) { if (f()) return true; await sl(250); } return false; };
  const stop = async () => { ring(null); await sl(1200); cap.textContent = ""; await sl(600); if (/Stop/.test($("rec").textContent)) $("rec").click(); L("STOP " + $("recStatus").textContent); };
  const chip = (cls) => [...document.querySelectorAll("#chips li")].find((li) => li.querySelector(".cls").textContent === cls);

  window._demo = (async () => {
    // window._demoDry = true before pasting: a rehearsal without the recorder
    if (!window._demoDry && !(await until(() => /^Recording/.test($("recStatus").textContent), 240000))) return L("no recording");
    t0 = performance.now(); L("rec");
    window.scrollTo({ top: 0, behavior: "smooth" }); await sl(900);
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
    ring(null); window.scrollTo({ top: 0, behavior: "smooth" }); await sl(600);
    await say("s11");
    await stop();
  })().catch((e) => L("ERR " + e));
  return "armed";
})();
