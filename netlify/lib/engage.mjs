// Engagement counts: checking what a page sends, and adding visits up for the insights page.
// Used by netlify/functions/engage.mjs and netlify/functions/insights-data.mjs,
// and checked by scripts/test-engage.mjs.
import { CATEGORIES } from "../../src/lib/categories.js";

export const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests/i;
const TOOL_KEYS = new Set(Object.entries(CATEGORIES).flatMap(([cat, c]) => c.tools.map((t) => `${cat}/${t.name}`)));
const SEGS = new Set(Object.keys(CATEGORIES));
const SOCIAL = new Set(["github", "linkedin"]);
const DEVICES = new Set(["phone", "tablet", "desktop"]);
const clampInt = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

// Keeps only known segments, tools and links, with sensible caps. Returns null for junk.
export function clean(body) {
  if (!body || typeof body !== "object" || body.v !== 1) return null;
  const vid = typeof body.vid === "string" && /^[A-Za-z0-9-]{8,36}$/.test(body.vid) ? body.vid : null;
  if (!vid) return null;
  const pick = (o, ok) => {
    const out = {};
    if (o && typeof o === "object") {
      for (const [k, n] of Object.entries(o).slice(0, 300)) if (ok.has(k)) { const c = clampInt(n, 0, 50); if (c) out[k] = c; }
    }
    return out;
  };
  return {
    vid,
    first: body.first === true,
    secs: clampInt(body.secs, 0, 3600),
    device: DEVICES.has(body.device) ? body.device : "desktop",
    seg: pick(body.seg, SEGS),
    tool: pick(body.tool, TOOL_KEYS),
    prof: pick(body.prof, TOOL_KEYS),
    site: pick(body.site, TOOL_KEYS),
    price: pick(body.price, TOOL_KEYS),
    social: pick(body.social, SOCIAL),
    charts: clampInt(body.charts, 0, 50)
  };
}

// Time-on-page groups shown on the insights page.
export const BUCKETS = [["under10", 0, 10], ["s10to30", 10, 30], ["s30to120", 30, 120], ["m2to5", 120, 300], ["over5", 300, Infinity]];
const bucketOf = (s) => BUCKETS.find(([, lo, hi]) => s >= lo && s < hi)[0];

// One day's messages -> that day's totals. A visit can send more than one message (each time
// the tab is hidden), so messages are first joined by visit id. Counts are "visits that did it".
export function summarizeDay(records) {
  const visits = new Map();
  for (const r of records) {
    const v = visits.get(r.vid) || { secs: 0, device: r.device, seg: new Set(), tool: new Set(), prof: new Set(), site: new Set(), price: new Set(), social: new Set(), charts: false };
    v.secs += r.secs;
    for (const k of ["seg", "tool", "prof", "site", "price", "social"]) Object.keys(r[k] || {}).forEach((x) => v[k].add(x));
    if (r.charts) v.charts = true;
    visits.set(r.vid, v);
  }
  const day = { visits: 0, engaged: 0, secs: 0, buckets: Object.fromEntries(BUCKETS.map(([b]) => [b, 0])), devices: {}, charts: 0,
    seg: {}, segSwitch: 0, tool: {}, prof: {}, site: {}, price: {}, social: {} };
  for (const v of visits.values()) {
    day.visits += 1;
    day.secs += Math.min(v.secs, 3600);
    day.buckets[bucketOf(v.secs)] += 1;
    day.devices[v.device] = (day.devices[v.device] || 0) + 1;
    if (v.charts) day.charts += 1;
    if (v.seg.size > 1) day.segSwitch += 1;
    for (const k of ["seg", "tool", "prof", "site", "price", "social"]) v[k].forEach((x) => { day[k][x] = (day[k][x] || 0) + 1; });
    // Engaged = did something beyond landing: opened another segment, a tool, a profile, the charts, or a link.
    if (v.seg.size > 1 || v.tool.size || v.prof.size || v.site.size || v.price.size || v.social.size || v.charts) day.engaged += 1;
  }
  return day;
}

// Several days -> the numbers the insights page shows.
export function combine(daysList) {
  const add = (a, b) => { for (const [k, n] of Object.entries(b || {})) a[k] = (a[k] || 0) + n; return a; };
  const t = { visits: 0, engaged: 0, secs: 0, buckets: {}, devices: {}, charts: 0, segSwitch: 0, seg: {}, tool: {}, prof: {}, site: {}, price: {}, social: {} };
  for (const { sum } of daysList) {
    for (const k of ["visits", "engaged", "secs", "charts", "segSwitch"]) t[k] += sum[k] || 0;
    for (const k of ["buckets", "devices", "seg", "tool", "prof", "site", "price", "social"]) add(t[k], sum[k]);
  }
  const label = (id) => (CATEGORIES[id] ? CATEGORIES[id].label : id);
  const toolRows = (o, n = 15) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, c]) => { const i = k.indexOf("/"); return { segment: label(k.slice(0, i)), tool: k.slice(i + 1), visits: c }; });
  return {
    days: daysList.map(({ date, sum }) => ({ date, visits: sum.visits || 0, engaged: sum.engaged || 0 })),
    totals: { visits: t.visits, engaged: t.engaged, avgSecs: t.visits ? Math.round(t.secs / t.visits) : 0, charts: t.charts, segSwitch: t.segSwitch },
    buckets: BUCKETS.map(([b]) => ({ id: b, visits: t.buckets[b] || 0 })),
    devices: t.devices,
    segments: Object.keys(CATEGORIES).map((id) => ({ id, label: label(id), visits: t.seg[id] || 0 })),
    tools: toolRows(t.tool), profiles: toolRows(t.prof), websites: toolRows(t.site), pricing: toolRows(t.price),
    social: { github: t.social.github || 0, linkedin: t.social.linkedin || 0 }
  };
}

export const dayKey = (d) => d.toISOString().slice(0, 10);
