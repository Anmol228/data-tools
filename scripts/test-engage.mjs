// Checks the engagement counting (no network needed): node scripts/test-engage.mjs
import assert from "node:assert/strict";
import { clean, summarizeDay, combine } from "../netlify/lib/engage.mjs";
import { CATEGORIES } from "../src/lib/categories.js";

const bi = CATEGORIES.bi.tools[0].name, etl = CATEGORIES.etl.tools[0].name;
// 1. Unknown segments / tools are dropped, counts are capped, junk is refused.
const r = clean({ v: 1, vid: "abc12345", first: true, secs: 99999, device: "phone",
  seg: { bi: 2, hack: 5 }, tool: { [`bi/${bi}`]: 999, "bi/Not a tool": 1 }, social: { github: 1, x: 1 }, charts: 1 });
assert.equal(r.secs, 3600); assert.deepEqual(r.seg, { bi: 2 }); assert.deepEqual(r.tool, { [`bi/${bi}`]: 50 }); assert.deepEqual(r.social, { github: 1 });
assert.equal(clean({ v: 2 }), null); assert.equal(clean({ v: 1, vid: "<script>" }), null);

// 2. Messages from the same visit are joined; "engaged" means doing something beyond landing.
const m = (o) => clean({ v: 1, secs: 5, device: "desktop", seg: { etl: 1 }, ...o });
const day = summarizeDay([
  m({ vid: "visit-aaaa", first: true, secs: 8 }),                                          // landed and left: not engaged
  m({ vid: "visit-bbbb", first: true, secs: 20, tool: { [`etl/${etl}`]: 1 } }),            // clicked a tool
  m({ vid: "visit-bbbb", secs: 25, seg: { bi: 1 }, site: { [`bi/${bi}`]: 1 }, charts: 1 }) // came back, more actions
]);
assert.equal(day.visits, 2); assert.equal(day.engaged, 1);
assert.equal(day.buckets.under10, 1); assert.equal(day.buckets.s30to120, 1);   // 8s, and 20+25 = 45s
assert.equal(day.charts, 1); assert.equal(day.segSwitch, 1); assert.equal(day.seg.etl, 2); assert.equal(day.seg.bi, 1);

// 3. Days add up; tool rows carry the segment name.
const out = combine([{ date: "2026-10-06", sum: day }, { date: "2026-10-07", sum: day }]);
assert.equal(out.totals.visits, 4); assert.equal(out.totals.engaged, 2); assert.equal(out.totals.avgSecs, Math.round((53 * 2) / 4));
assert.deepEqual(out.tools[0], { segment: "ETL / ELT", tool: etl, visits: 2 });
assert.equal(out.websites[0].segment, "Business intelligence");
console.log("engagement: all checks passed");
