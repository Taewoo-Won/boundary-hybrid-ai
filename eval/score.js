// node eval/score.js                        → pattern layer only
// node eval/score.js eval/device_spans.json → pattern + device passes ({device:{caseId:[…]}, recheck:{…}} or the old {caseId:[…]})
import { readFileSync } from "node:fs";
import { score } from "./scoring.js";

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url)));
const raw = process.argv[2] ? JSON.parse(readFileSync(process.argv[2])) : {};
const device = raw.device ?? (raw.recheck ? {} : raw), recheck = raw.recheck ?? {};
console.log(JSON.stringify({ layer: process.argv[2] ? "pattern+device" : "pattern only", ...score(cases, device, recheck) }, null, 1));
