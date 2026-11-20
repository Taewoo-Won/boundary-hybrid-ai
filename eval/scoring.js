// Pure scoring for the boundary eval (node CLI and the in-browser eval page share it).
// device[caseId] = spans from pass 1; recheck[caseId] = spans from the on-device re-check of the redacted text.
import { patternSpans, applySpans, safeRole } from "../src/redact.js";

export function score(cases, device = {}, recheck = {}) {
  const per = {};
  let total = 0, leaked = 0, leakCases = 0, roleLeaks = 0;
  for (const c of cases) {
    const first = [...patternSpans(c.text), ...(device[c.id] ?? [])];
    let r = applySpans(c.text, first);
    if (recheck[c.id]?.length) r = applySpans(r.text, recheck[c.id].filter((s) => r.text.includes(s.value)), r.map);
    let caseLeak = 0;
    for (const s of c.spans) {
      per[s.cls] ??= { n: 0, leaked: 0 };
      per[s.cls].n++; total++;
      if (r.text.includes(s.value)) { per[s.cls].leaked++; leaked++; caseLeak++; }
    }
    // a role hint that survives safeRole must not contain any labelled value
    for (const s of device[c.id] ?? []) {
      const role = safeRole(s.role, [...r.map.values()]);
      if (role && c.spans.some((l) => role.toLowerCase().includes(l.value.toLowerCase()))) roleLeaks++;
    }
    if (caseLeak) leakCases++;
  }
  return { cases: cases.length, spans: total, recall: +(1 - leaked / total).toFixed(3), cases_with_leak: leakCases, role_hint_leaks: roleLeaks,
    per_class: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, `${v.n - v.leaked}/${v.n}`])) };
}
