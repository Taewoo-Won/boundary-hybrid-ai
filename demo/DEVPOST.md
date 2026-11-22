# Devpost text

## Inspiration
People who write case notes — caseworkers, counsellors, small-clinic coordinators — could save hours with cloud AI, but their notes are full of names, diagnoses and addresses that must not leave their hands. Most of them have no enterprise AI contract. We wanted the cloud's writing ability without the cloud ever seeing the person.

## What it does
Boundary takes a case note and a task (draft a reply, summarize for a handover, translate). Gemini Nano, running in Chrome through Firebase AI Logic in **only-on-device** mode, finds the personal data and swaps it for placeholders. You review exactly what will leave the device and add anything it missed; Nano re-checks that text once more, then the **only-in-cloud** model does the task on placeholder text. A **prefer-on-device** check reads the answer for personal data the cloud invented, and the page puts the real details back locally. A ledger records every call, where it ran, and how many characters left the device.

## How we built it
- Firebase AI Logic web SDK (firebase 13.3.0): one `getGenerativeModel` per mode — `ONLY_ON_DEVICE` for detection and re-check, `ONLY_IN_CLOUD` for the task, `PREFER_ON_DEVICE` for checking the answer; `initializeDeviceModel` starts the download from a user click; the SDK's `inferenceSource` feeds the ledger badges. App Check (score-based reCAPTCHA Enterprise on the deployed page).
- Two detection layers: deterministic rules (e-mail, phone, ID, date of birth) and Nano asked for JSON spans. Spans must match the note verbatim, so hallucinated spans are dropped. Nano also writes a short generic role hint per placeholder ("the client", "the daughter") so the cloud writes natural text; hints that repeat any kept-back word, contain digits or match a rule are dropped.
- Fail closed: if Nano is unavailable, returns unusable JSON, is plain Chromium's echo stub, or the SDK does not report the answer as on-device, Boundary stops. Before sending, rules lock the button on phone/e-mail/ID/date patterns and a second Nano pass over the outgoing text keeps back anything it still finds.
- A small on-device compatibility layer (`src/promptShim.js`), from testing on a real Windows PC with Chrome 157: text-only session options, one shared session per page with calls in sequence, prompts read as a stream — see Challenges.
- Vite, plain JavaScript, node:test tests (21).

## Challenges
- Rules alone are not enough: on our 10-note synthetic set (44 labelled spans) they keep back only 29.5% — no names, addresses or health details. So the rules layer can never clear a note on its own.
- With Gemini Nano on device (Windows PC, Chrome 157, measured 22 Nov 2026): rules + Nano **88.6%**, plus the Nano re-check **90.9%** (40 of 44: names 13/15, health 7/9, everything else complete), and 0 role hints leaked a kept-back word. Detection still varies run to run — in our demo run Nano missed the clinic, diagnosis and medication — which is exactly why a person reviews the outgoing text before anything is sent.
- Getting Nano to answer reliably on an ordinary PC took most of a day. Prompts under a JSON-schema `responseConstraint` stalled for minutes in most of our runs and blocked every later call until Chrome restarted; the same prompts without the constraint always returned. We dropped the schema (the verbatim-span check and fail-closed parsing already do that job), ask for text-only sessions and share one session per page — since then every call has returned: 20 of 20 in the eval, 3 of 3 in the demo run.
- In-tab screen recording (getDisplayMedia) froze Nano on the same PC, so the demo video is stitched from screenshots taken step by step during a live run.

## Accomplishments
A hybrid split where each side does what it is good at, with three modes each chosen for a reason. The raw note is never sent: if the device model fails, nothing goes out. What does go out is placeholder text that has been checked twice on device and reviewed by a person.

## What we learned
"Prefer on device" is the wrong default for a private step — falling back to the cloud is exactly the failure you must prevent. Choosing the mode per step, and failing closed, is the real design decision. And on-device AI has to be tested on the machines people actually have.

## What's next
Richer on-device role hints (relationships between people in a note); a Chrome extension for web forms and e-mail; per-organization rules via Remote Config.

## Try it
Live: **https://taewoo-won.github.io/boundary-hybrid-ai/** · Code: **https://github.com/Taewoo-Won/boundary-hybrid-ai** (Apache-2.0) · Demo video: **https://youtu.be/-FGMXgGOFYs**. Needs desktop Google Chrome with Gemini Nano; without a Firebase config the app runs in a clearly labelled demo mode.
