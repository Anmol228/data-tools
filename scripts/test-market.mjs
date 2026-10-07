// Checks the daily refresh logic with made-up responses (no network needed): node scripts/test-market.mjs
import assert from "node:assert/strict";
import { lastFullMonths, bucketDaily, seriesFrom, buildMarket } from "../netlify/lib/market.mjs";
import { PACKAGES } from "../src/lib/packages.js";

// 1. Months: on 7 Oct 2026 the last 6 complete months are Apr to Sep; in January they cross the year.
const m = lastFullMonths(new Date("2026-10-07T12:00:00Z"));
assert.deepEqual(m.map((x) => x.label), ["Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
assert.equal(m[0].start, "2026-04-01"); assert.equal(m[5].end, "2026-09-30");
const j = lastFullMonths(new Date("2027-01-03T00:00:00Z"));
assert.deepEqual(j.map((x) => x.key), ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);

// 2. Per-day growth when the first month is partial: 25 days of 10 vs 30 days of 20 -> +100%.
const rows = [];
for (const mo of m) for (let d = 1; d <= mo.days; d++) {
  if (mo.label === "Apr" && d < 6) continue;
  rows.push({ date: `${mo.key}-${String(d).padStart(2, "0")}`, downloads: mo.label === "Apr" ? 10 : 20 });
}
const s = seriesFrom(bucketDaily(rows, m));
assert.equal(s.days[0], 25); assert.equal(s.m[0], 250); assert.equal(s.m[5], 600); assert.equal(s.growth, 1);
assert.equal(seriesFrom({ m: [0, 1, 1, 1, 1, 1], days: [30, 31, 30, 31, 31, 30] }), null);

// 3. Full build with a fake fetch; one failing npm package keeps BI's previous numbers.
const fake = async (url) => {
  if (url.includes("@qlik/embed-react")) return { ok: false, status: 500, json: async () => ({}) };
  if (url.includes("pypistats")) return { ok: true, json: async () => ({ data: rows.map((r) => ({ ...r, category: "without_mirrors" })).concat(rows.map((r) => ({ ...r, category: "with_mirrors", downloads: 999 }))) }) };
  return { ok: true, json: async () => ({ downloads: rows.map((r) => ({ day: r.date, downloads: r.downloads })) }) };
};
const previous = { segments: { bi: { source: "npm", months: ["x"], tools: [] } } };
const out = await buildMarket({ fetchImpl: fake, now: new Date("2026-10-07T00:00:00Z"), previous });
for (const cat of Object.keys(PACKAGES)) if (cat !== "bi") {
  const seg = out.segments[cat];
  assert.ok(seg, cat); assert.equal(seg.tools.length, Object.keys(PACKAGES[cat].tools).length);
  assert.equal(seg.tools[0].growth, 1); assert.equal(seg.firstDays, 25); assert.equal(seg.firstMonthDays, 30);
}
assert.equal(out.segments.bi, previous.segments.bi, "failed segment keeps its previous numbers");
assert.equal(out.errors.length, 1);
console.log("market refresh: all checks passed");
