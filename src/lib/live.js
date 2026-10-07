import { MONTHLY } from "../data.js";
import { rankCache } from "./ranking.js";
import { resetStatusCache } from "./status.js";
import { setState } from "../store.js";

// ---------- Latest monthly numbers from the data API ----------
// The page first shows the built-in numbers (instant), then swaps in the latest figures from
// /api/market, which a daily job refreshes from pypistats.org and api.npmjs.org.
// Search trends (ETL / ELT), pricing and researched statuses are not refreshed automatically.

const SOURCE = {
  pypi: "Source: pypistats.org (official Python package downloads, excluding mirrors)",
  npm: "Source: api.npmjs.org (official npm download counts)"
};
const LONG = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };

export function applyMarket(data) {
  if (!data || !data.segments) return false;
  const when = data.updated ? new Date(data.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  let changed = false;
  for (const [cat, l] of Object.entries(data.segments)) {
    const base = MONTHLY[cat];
    if (!base || !l || !Array.isArray(l.tools) || !l.tools.length || !Array.isArray(l.months) || l.months.length !== 6) continue;
    const partial = l.firstDays < l.firstMonthDays;
    MONTHLY[cat] = {
      ...base,
      months: l.months, monthKeys: l.monthKeys, firstDays: l.firstDays, firstMonthDays: l.firstMonthDays,
      tools: l.tools.map((t) => ({ name: t.name, m: t.m, pop: t.pop, growth: t.growth })),
      source: cat === "orch" || cat === "bi"
        ? `${SOURCE[l.source] || SOURCE.pypi}, refreshed automatically${when ? ` (last update ${when})` : ""}.`
        : `${base.source} Numbers refreshed automatically${when ? `, last update ${when}` : ""}.`,
      method: cat === "orch" || cat === "bi"
        ? (partial ? `${LONG[l.months[0]]} covers ${l.firstDays} days only, so change is compared per day.` : "Full calendar months.")
        : base.method,
      live: true
    };
    changed = true;
  }
  if (changed) {
    Object.keys(rankCache).forEach((k) => delete rankCache[k]);
    resetStatusCache();
    setState((s) => ({ dataVersion: s.dataVersion + 1, marketUpdated: data.updated || null }));
  }
  return changed;
}

export function loadLiveMarket() {
  if (location.protocol === "file:" || /(^|\.)(claude\.ai|claudeusercontent\.com|anthropic\.com)$/.test(location.hostname)) return;
  fetch("/api/market", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then(applyMarket)
    .catch(() => { /* no API here: keep the built-in numbers */ });
}
