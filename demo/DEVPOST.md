# Devpost text (draft — fill the two marked values after the recorded run)

## Inspiration
People who write case notes — caseworkers, counsellors, small-clinic coordinators — could save hours with cloud AI, but their notes are full of names, diagnoses and addresses that must not leave their hands. Most of them have no enterprise AI contract. We wanted the cloud's writing ability without the cloud ever seeing the person.

## What it does
Boundary takes a case note and a task (draft a reply, summarize for a handover, translate). Gemini Nano, running in Chrome through Firebase AI Logic in **only-on-device** mode, finds the personal data and swaps it for placeholders. You review exactly what will leave the device; Nano re-checks that text once more, then the **only-in-cloud** model does the task on placeholder text. A **prefer-on-device** check reads the answer for personal data the cloud invented, and the page puts the real details back locally. A ledger records every call, where it ran, and how many characters left the device.

## How we built it
- Firebase AI Logic web SDK (firebase 13.3.0): one `getGenerativeModel` per mode — `ONLY_ON_DEVICE` for detection, `ONLY_IN_CLOUD` for the task; `initializeDeviceModel` starts the download from a user click; the SDK's `inferenceSource` feeds the ledger badges. App Check (reCAPTCHA v3, debug tokens in testing).
- Two detection layers: deterministic rules (e-mail, phone, ID, date of birth) and Nano with a JSON span schema. Spans must match the note verbatim, so hallucinated spans are dropped. Nano also writes a short generic role hint per placeholder ("the client, she", "a medication") so the cloud writes natural text; hints that repeat any kept-back word, contain digits or match a rule are dropped.
- Fail closed: if Nano is unavailable, returns unusable JSON, is plain Chromium's echo stub, or the SDK does not report the answer as on-device, Boundary stops. Before sending, rules lock the button on phone/e-mail/ID/date patterns and a second Nano pass over the outgoing text keeps back anything it still finds.
- Vite, plain JavaScript, node:test tests; an in-app recorder (getDisplayMedia + MediaRecorder) made the demo video.

## Challenges
Rules alone are not enough: on our 10-note synthetic set (44 labelled spans) they find only 29.5% — no names, addresses or health details. So the rules layer can never clear a note on its own; the on-device model has to succeed first. Nano recall on the same set: **[fill from eval run]**.

## Accomplishments
A hybrid split where each side does what it is good at, with three modes each chosen for a reason. The raw note is never sent: if the device model fails, nothing goes out. What does go out is placeholder text that has been checked twice on device and reviewed by a person — detection is still best effort, which is why the review screen exists.

## What we learned
"Prefer on device" is the wrong default for a private step — falling back to the cloud is exactly the failure you must prevent. Choosing the mode per step, and failing closed, is the real design decision.

## What's next
Richer on-device role hints (relationships between people in a note); a Chrome extension for web forms and e-mail; per-organization rules via Remote Config.

## Try it
Live: **[test URL]** · Code: **[GitHub URL]** (Apache-2.0). Without a Firebase config the app runs in a clearly labelled demo mode.
