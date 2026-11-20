// "What left the device" ledger: for each request, how many characters were sent to the cloud
// and which data classes were present. Kept in IndexedDB-free memory + optional export (JSON).
export class Ledger {
  constructor() { this.rows = []; this.listeners = []; }
  add(rec, parts) {
    const text = parts.filter((p) => typeof p === "string").join("\n");
    const leaves = rec.source === "in_cloud" || (rec.source === "mock" && rec.which === "cloud");
    const row = {
      t: new Date().toISOString(), step: rec.step ?? rec.which, source: rec.source,
      charsOut: leaves ? text.length : 0,
      classesOut: leaves ? (rec.classesOut ?? []) : [],
      ms: rec.ms,
    };
    this.rows.push(row); this.listeners.forEach((f) => f(row, this.rows));
    return row;
  }
  onChange(f) { this.listeners.push(f); }
  totals() {
    return this.rows.reduce((a, r) => ({ requests: a.requests + 1, cloud: a.cloud + (r.charsOut > 0),
      charsOut: a.charsOut + r.charsOut }), { requests: 0, cloud: 0, charsOut: 0 });
  }
  export() { return JSON.stringify({ rows: this.rows, totals: this.totals() }, null, 2); }
}
