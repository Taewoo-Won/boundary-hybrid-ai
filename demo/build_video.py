#!/usr/bin/env python3
"""Build the demo video from real screenshots of a live run (main 11/22).

Why: on the recording PC, any in-Chrome screen capture (getDisplayMedia, even VP8 2.5 Mbps) froze on-device
Gemini Nano three times out of three, while the same flow without capture finished in seconds. So the run is
captured step by step (Claude in Chrome screenshots, full viewport) and stitched here. Every frame is a real
screen of the real app; holds follow the run order. The video says so in a corner label.

  python3 build_video.py <frames_dir>        # frames_dir/manifest.json → frames_dir/boundary-demo.mp4 (+ .srt)

manifest.json: [{"file": "f01.jpg", "hold": 10, "sub": "caption text", "focus": [x, y, w, h] (optional, viewport px)}]
"""
import json
import pathlib
import subprocess
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

W, H, BAR = 1920, 1080, 190
BG, INK, BARBG = (243, 241, 236), (28, 28, 26), (24, 24, 22)
FONT = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
FONT_B = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
LABEL = "Live run · Chrome desktop · Gemini Nano on device · screens captured step by step"
XF = 0.45


def font(p, s):
    try:
        return ImageFont.truetype(p, s)
    except OSError:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s)


def fit(img, box_w, box_h):
    r = min(box_w / img.width, box_h / img.height)
    return img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)


def compose(shot, sub, focus=None, vw=None):
    c = Image.new("RGB", (W, H), BG)
    area_h = H - BAR - 40
    src = shot
    if focus:
        k = shot.width / vw if vw else 1  # focus is in viewport px; the screenshot may be scaled
        x, y, w, h = (v * k for v in focus)
        aspect = (W - 80) / area_h
        cx, cy = x + w / 2, y + h / 2
        if w / h < aspect:
            w = h * aspect
        else:
            h = w / aspect
        w, h = min(w * 1.12, shot.width), min(h * 1.12, shot.height)
        l = max(0, min(shot.width - w, cx - w / 2))
        t = max(0, min(shot.height - h, cy - h / 2))
        src = shot.crop((round(l), round(t), round(l + w), round(t + h)))
    im = fit(src, W - 80, area_h)
    c.paste(im, ((W - im.width) // 2, 20 + (area_h - im.height) // 2))
    d = ImageDraw.Draw(c)
    d.rectangle([0, H - BAR, W, H], fill=BARBG)
    f = font(FONT, 40)
    lines = textwrap.wrap(sub, 78)[:3]
    y = H - BAR + (BAR - len(lines) * 52) // 2
    for ln in lines:
        tw = d.textlength(ln, font=f)
        d.text(((W - tw) / 2, y), ln, font=f, fill=(250, 248, 242))
        y += 52
    fl = font(FONT_B, 22)
    tw = d.textlength(LABEL, font=fl)
    d.rounded_rectangle([W - tw - 52, 14, W - 18, 52], 8, fill=(255, 255, 255))
    d.text((W - tw - 35, 20), LABEL, font=fl, fill=(70, 70, 64))
    return c


def srt_time(s):
    ms = round(s * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main(d):
    d = pathlib.Path(d)
    man = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    out = d / "_frames"
    out.mkdir(exist_ok=True)
    stills = []
    for i, m in enumerate(man):
        shot = Image.open(d / m["file"]).convert("RGB")
        p = out / f"s{i:02d}.png"
        compose(shot, m["sub"], m.get("focus"), m.get("vw")).save(p)
        stills.append((p, float(m["hold"]), m["sub"]))
    # one clip per still, then xfade chain
    args, flt = ["ffmpeg", "-y", "-loglevel", "error"], []
    for p, hold, _ in stills:
        args += ["-loop", "1", "-t", f"{hold + XF:.2f}", "-framerate", "30", "-i", str(p)]
    prev, t, starts = "0:v", 0.0, [0.0]
    for i in range(1, len(stills)):
        t += stills[i - 1][1]
        starts.append(t)
        lab = f"x{i}"
        flt.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={t:.2f}[{lab}]")
        prev = lab
    total = t + stills[-1][1]
    flt.append(f"[{prev}]format=yuv420p,fade=t=out:st={total - 0.6:.2f}:d=0.6[v]")
    mp4 = d / "boundary-demo.mp4"
    args += ["-filter_complex", ";".join(flt), "-map", "[v]", "-t", f"{total:.2f}", "-r", "30",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", str(mp4)]
    subprocess.run(args, check=True)
    srt = [f"{i + 1}\n{srt_time(s)} --> {srt_time(s + st[1])}\n{st[2]}\n" for i, (s, st) in enumerate(zip(starts, stills))]
    (d / "boundary-demo.srt").write_text("\n".join(srt), encoding="utf-8")
    print(mp4, f"{total:.1f}s", len(stills), "stills")


if __name__ == "__main__":
    main(sys.argv[1])
