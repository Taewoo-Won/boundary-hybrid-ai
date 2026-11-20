# Demo video — script and click order (target 2:40, limit 3:00)

Record with the in-app **● Record demo** button (choose "This tab"). Chrome desktop with Gemini Nano, Firebase config set (header shows "Firebase AI Logic · hybrid", not "Demo mode").
Before recording: open the app, click **Turn on on-device AI** once so the model is downloaded (the download should not be in the video), reload.
Voice: read the lines below, or record silent and use `demo/subtitles.srt` (English subtitles are allowed by the rules).

| Time | On screen (click) | Line |
|---|---|---|
| 0:00–0:15 | App header | "Caseworkers write notes full of personal data. Cloud AI could turn them into emails or handovers in seconds — but pasting a note sends a client's name and diagnosis to a server. Boundary splits that job in two." |
| 0:15–0:30 | Click **Load sample note** | "Here is a note about a client: her name, date of birth, address, her clinic, panic attacks, a medication, her phone and e-mail." |
| 0:30–0:55 | Choose task **Draft a reply email** → click **Find personal data on device** | "Step one runs only on this device. Gemini Nano, through Firebase AI Logic in only-on-device mode, finds the personal data. Simple rules catch phone numbers and e-mails; the model catches names, places and health details." |
| 0:55–1:20 | Point at chips (rule / Nano) and the ledger row 'On this device · nothing sent' | "Each item shows who found it. The ledger on the right confirms: this call ran on the device and sent nothing." |
| 1:20–1:40 | Point at **Exactly what will leave this device** (Placeholders list on top) | "This is exactly what the cloud will see — placeholders, each with a short hint Nano wrote on device, like 'the client, she', so the cloud can still write naturally." |
| 1:40–1:55 | Untick the PHONE chip → red 'Blocked' message → tick it again | "If anything still looks personal, the send button locks. And right before sending, Nano re-checks the outgoing text on device." |
| 1:55–2:20 | Click **Send to cloud model** → step 3 | "Step two runs only in the cloud, where a bigger model writes a better email. It never saw her name. Back on the page, the real details are put back locally — no model involved." |
| 2:20–2:35 | Ledger totals | "A prefer-on-device check reads the answer for personal data the cloud invented — safe to fall back, because it only holds placeholders. The ledger shows every call, where it ran, and how many characters left the device." |
| 2:35–2:45 | Stop recording | "If the on-device model is not available, Boundary stops instead of falling back to the cloud. Boundary — cloud help, with the boundary on your side." |

Fail-closed shot (optional, if time remains): in a Chrome profile without Nano, click **Find personal data on device** → red message "On-device check failed … Nothing was sent."
After recording: upload the .webm to YouTube as **Public**, title "Boundary — hybrid on-device + cloud AI with Firebase AI Logic", add `subtitles.srt`.
