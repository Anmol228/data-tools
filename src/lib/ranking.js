import { CATEGORIES } from "./categories.js";
import { TRENDS, MONTHLY } from "../data.js";

// ---------- Ranking from the monthly sheets (Apr to Sep 2026): growth AND popularity ----------
// Growth     = the sheet's "Change Apr to Sep" column.
// Popularity = the sheet's 6-month volume (average search index for ETL / ELT, total downloads otherwise).
// Overall    = average of the growth rank and the popularity rank inside the segment (ties: better growth).
// Tools with no figure in the sheet are never ranked or estimated.
export const fmtPct = (g) => (g >= 0 ? "+" : "-") + Math.abs(g * 100).toLocaleString("en-US", { maximumFractionDigits: Math.abs(g) >= 1 ? 0 : 1 }) + "%";
export const fmtNum = (v) => v == null ? "n/a" : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : (Math.round(v * 100) / 100).toString());
export function toolRecord(seg, name) {
  const list = CATEGORIES[seg.cat].tools;
  const i = list.findIndex((t) => t.name === name);
  return { i, tool: i >= 0 ? list[i] : null };
}

export const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const segFor = (cat) => (MONTHLY[cat] ? Object.assign({ cat, label: CATEGORIES[cat].label }, MONTHLY[cat]) : null);
export const noteFor = (cat, name) => { const s = TRENDS.find((x) => x.cat === cat); const t = s && s.tools.find((x) => x.name === name); return t ? t.note : null; };
export const rankCache = {};
export function rankSeg(seg) {
  if (rankCache[seg.cat]) return rankCache[seg.cat];
  const have = seg.tools;
  const byG = [...have].sort((a, b) => b.growth - a.growth);
  const byP = [...have].sort((a, b) => b.pop - a.pop);
  const rows = have.map((t) => ({ t, gR: byG.indexOf(t) + 1, pR: byP.indexOf(t) + 1 }));
  rows.forEach((r) => { r.score = (r.gR + r.pR) / 2; });
  rows.sort((a, b) => a.score - b.score || a.gR - b.gR);
  rows.forEach((r, k) => { r.rank = k + 1; });
  return (rankCache[seg.cat] = rows);
}
export const byGrowth = (seg) => [...rankSeg(seg)].sort((a, b) => a.gR - b.gR);
export const byPop = (seg) => [...rankSeg(seg)].sort((a, b) => a.pR - b.pR);
export const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString("en-US");
export const popShort = (seg, v) => (seg.cat === "etl" ? fmt1(v) : compactNum.format(v));
export const popText = (seg, t) => (seg.cat === "etl" ? `${fmt1(t.pop)} search index` : `${compactNum.format(t.pop)} downloads`);
export const monthVal = (seg, v) => (seg.cat === "etl" ? fmtNum(v) : Math.round(v).toLocaleString("en-US"));
export function medianOf(arr) { const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
export function gapsFor(seg) {
  const noFigure = seg.missing.map((t) => t.name);
  const untracked = CATEGORIES[seg.cat].tools.filter((t) => !seg.tools.some((x) => x.name === t.name) && !noFigure.includes(t.name)).map((t) => t.name);
  return { noFigure, untracked };
}
export function noDataText(seg, name) {
  const miss = seg && seg.missing.find((t) => t.name === name);
  if (miss) return `Monthly trend: not publicly available (${miss.note.charAt(0).toLowerCase() + miss.note.slice(1)}).`;
  return "Monthly trend: not publicly available.";
}

// Month-by-month insights computed only from the sheet's six monthly values.
export function monthInsights(seg, t) {
  const M = seg.months, m = t.m;
  let hi = 0, lo = 0, up = 1, down = 1;
  const mom = m.map((v, k) => (k ? v / m[k - 1] - 1 : null));
  m.forEach((v, k) => { if (v > m[hi]) hi = k; if (v < m[lo]) lo = k; });
  for (let k = 2; k < m.length; k++) { if (mom[k] > mom[up]) up = k; if (mom[k] < mom[down]) down = k; }
  const lines = [
    ["Peak month", `${M[hi]} (${monthVal(seg, m[hi])})`],
    ["Lowest month", `${M[lo]} (${monthVal(seg, m[lo])})`],
    ["Biggest monthly rise", mom[up] > 0 ? `${M[up - 1]} to ${M[up]} (${fmtPct(mom[up])})` : "None: every month fell"],
    ["Biggest monthly drop", mom[down] < 0 ? `${M[down - 1]} to ${M[down]} (${fmtPct(mom[down])})` : "None: every month rose"],
    ["Apr to Sep", fmtPct(t.growth) + (seg.cat === "orch" ? " (per day; April covers 6-30 Apr)" : "")]
  ];
  return { mom, lines };
}

// Most widely used = top 3 by popularity rank; Emerging = top 3 by growth rank.
export const widelyUsed = (seg) => byPop(seg).slice(0, 3);
export const emergingTop = (seg) => byGrowth(seg).slice(0, 3);
