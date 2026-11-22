// In-app recorder: captures this tab with getDisplayMedia + MediaRecorder and downloads a .webm.
// Lets the demo be recorded on any desktop Chrome without installing screen-recording software.
export function mountRecorder(btn, status) {
  let rec = null, chunks = [], t0 = 0, timer = null;
  const stop = () => rec && rec.state !== "inactive" && rec.stop();
  btn.onclick = async () => {
    if (rec && rec.state === "recording") return stop();
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", frameRate: 24 }, audio: false,   // 11/22: lighter capture — VP9 6 Mbps starved on-device Gemini Nano on a real PC
        preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude",
      });
    } catch (e) { status.textContent = `Recording not started (${e.name}).`; return; }
    const type = ["video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(timer); stream.getTracks().forEach((t) => t.stop());
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob(chunks, { type: "video/webm" })),
        download: `boundary-demo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`,
      });
      a.click(); btn.textContent = "● Record demo"; btn.classList.remove("on");
      status.textContent = `Saved ${(chunks.reduce((n, c) => n + c.size, 0) / 1e6).toFixed(1)} MB.`;
    };
    stream.getVideoTracks()[0].addEventListener("ended", stop);
    rec.start(1000); t0 = Date.now(); btn.textContent = "■ Stop"; btn.classList.add("on");
    timer = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      status.textContent = `Recording ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` + (s > 170 ? " — under 3:00 limit!" : "");
    }, 500);
  };
}
