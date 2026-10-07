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

// ---------- The period the monthly numbers cover ----------
// Built-in numbers cover Apr to Sep 2026; numbers from the daily refresh carry their own months.
const LONG = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
export function periodOf(seg) {
  const months = (seg && seg.months) || ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const keys = seg && seg.monthKeys;
  const yearOf = (k) => (keys ? +keys[k].slice(0, 4) : 2026);
  const from = months[0], to = months[months.length - 1], y0 = yearOf(0), y1 = yearOf(months.length - 1);
  return { from, to, fromLong: LONG[from], toLong: LONG[to], yearOf,
    short: `${from} to ${to}`, label: y0 === y1 ? `${from} to ${to} ${y1}` : `${from} ${y0} to ${to} ${y1}` };
}
// When the first month is only partly covered, change is compared per day.
export function perDayNote(seg) {
  if (!seg) return "";
  if (seg.monthKeys) return seg.firstDays < seg.firstMonthDays ? `Compared per day, because ${LONG[seg.months[0]]} covers ${seg.firstDays} days only.` : "";
  return seg.cat === "orch" ? "Compared per day, because April covers 6-30 Apr only." : "";
}
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
    [periodOf(seg).short, fmtPct(t.growth) + (perDayNote(seg) ? " (compared per day)" : "")]
  ];
  return { mom, lines };
}

// Most widely used = top 3 by popularity rank; Emerging = top 3 by growth rank.
export const widelyUsed = (seg) => byPop(seg).slice(0, 3);
export const emergingTop = (seg) => byGrowth(seg).slice(0, 3);
