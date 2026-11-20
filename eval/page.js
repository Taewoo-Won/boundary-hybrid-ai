import { initHybrid, warmDevice } from "../src/hybrid.js";
import { deviceSpans } from "../src/deviceSpans.js";
import { patternSpans, applySpans } from "../src/redact.js";
import { score } from "./scoring.js";
import data from "./cases.json" with { type: "json" };
const log = (s) => (document.getElementById("log").textContent += s + "\n");
document.getElementById("go").onclick = async () => {
  const m = initHybrid();
  if (m.mock) { log("No Firebase config in this build — the eval needs the real build."); return; }
  await warmDevice((p) => log(`model download ${Math.round(p * 100)}%`));
  const device = {}, recheck = {};
  for (const c of data.cases) {
    try {
      const r = await deviceSpans(c.text); device[c.id] = r.spans;
      const red = applySpans(c.text, [...patternSpans(c.text), ...r.spans]).text;
      const r2 = await deviceSpans(red); recheck[c.id] = r2.spans.filter((s) => !/^\[[A-Z]+_\d+\]$/.test(s.value));
      log(`${c.id}: ${r.spans.length} spans (+${recheck[c.id].length} on re-check), ${r.ms}+${r2.ms} ms`);
    } catch (e) { device[c.id] = []; log(`${c.id}: FAILED ${e.message}`); }
  }
  const rules = score(data.cases), first = score(data.cases, device), both = score(data.cases, device, recheck);
  document.getElementById("res").textContent =
    `Recall (labelled spans kept back), ${data.cases.length} notes / ${rules.spans} spans:\n` +
    `  rules only          ${rules.recall}\n  rules + Nano        ${first.recall}\n  + Nano re-check     ${both.recall}\n` +
    `Per class (after re-check): ${JSON.stringify(both.per_class)}\nRole-hint leaks: ${both.role_hint_leaks}`;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify({ device, recheck, ua: navigator.userAgent }, null, 1)])), download: "device_spans.json" });
  a.click();
};
