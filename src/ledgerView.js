// Ledger panel: one row per model call — where it ran, what left the device, how long it took.
const BADGE = { on_device: ["On this device", "b-dev"], in_cloud: ["Cloud", "b-cloud"], mock: ["Demo (no model)", "b-mock"], unknown: ["?", "b-mock"] };

export function mountLedger(el, ledger) {
  el.innerHTML = `<header><h2>What left this device</h2><p class="tot"></p></header><ol class="rows"></ol>
    <button class="export" type="button">Export ledger (JSON)</button>`;
  const rows = el.querySelector(".rows"), tot = el.querySelector(".tot");
  ledger.onChange((r) => {
    const [label, cls] = BADGE[r.source] ?? BADGE.unknown;
    const li = document.createElement("li");
    li.innerHTML = `<span class="badge ${cls}">${label}</span><span class="lstep"></span>
      <span class="lout">${r.charsOut ? (r.source === "mock" ? `${r.charsOut} chars would be sent` : `${r.charsOut} chars sent`) : "nothing sent"}</span>
      <span class="cls"></span><span class="ms">${r.ms} ms</span>`;
    li.querySelector(".lstep").textContent = r.step;
    li.querySelector(".cls").textContent = r.classesOut.length ? `kept back: ${r.classesOut.join(", ")}` : "";
    rows.prepend(li);
    const t = ledger.totals();
    const demo = ledger.rows.some((x) => x.source === "mock");
    tot.textContent = `${t.requests} calls · ${t.cloud} to cloud · ${t.charsOut} characters ${demo ? "would leave (demo — nothing sent)" : "left the device"}`;
  });
  el.querySelector(".export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ledger.export()], { type: "application/json" }));
    a.download = "ledger.json"; a.click();
  };
}
