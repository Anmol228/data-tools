import { STATUS } from "../data.js";
import { CATEGORIES } from "./categories.js";
import { segFor, rankSeg, byGrowth, byPop, medianOf } from "./ranking.js";

// ---------- Market status ----------
// 1. Tools WITH monthly numbers: trend, change, "Widely used" from volume, "Rising" only if Sep > Apr.
// 2. Tools WITHOUT monthly numbers: "Monthly numbers: Not publicly available", plus the researched
//    Status, Evidence and Rank in category. Monthly numbers are never invented.

export const NUMBER_SEGS = ["etl", "orch", "bi"];   // every ranked tool in these segments has monthly numbers
export const ST_LABEL = { widely: "Widely used", rising: "Rising", emerging: "Emerging" };
export const stClass = (s) => "st-chip " + ({ "Widely used": "widely", "Rising": "rising", "Emerging": "emerging" }[s] || "present");

export function numFor(cat, name) { const seg = segFor(cat); return (seg && seg.tools.find((t) => t.name === name)) || null; }
export function sheetStatus(cat, name) { const s = STATUS[cat]; return (s && s.tools[name]) || null; }

const listCache = {};
// Category lists shown in the trends bar, the pop-up and the Charts page.
export function statusLists(cat) {
  if (listCache[cat]) return listCache[cat];
  const seg = segFor(cat);
  let out;
  if (NUMBER_SEGS.includes(cat)) {
    const rows = seg ? rankSeg(seg) : [];
    out = {
      widely: seg ? byPop(seg).slice(0, 3).map((r) => ({ name: r.t.name, why: "Highest monthly volume" })) : [],
      // ETL / ELT: the researched Rising rank. Orchestration and BI: highest growth among tools that grew.
      rising: cat === "etl" && STATUS.etl && STATUS.etl.lists ? STATUS.etl.lists.rising
        : rows.length ? byGrowth(seg).filter((r) => r.t.growth > 0).slice(0, 3).map((r) => ({ name: r.t.name, why: "Highest growth, Apr to Sep" })) : [],
      emerging: []
    };
  } else {
    const L = (STATUS[cat] && STATUS[cat].lists) || { widely: [], rising: [], emerging: [] };
    out = {
      widely: L.widely,
      // Rising is shown only where the numbers (if any) confirm Sep is above Apr.
      rising: L.rising.filter((x) => { const t = numFor(cat, x.name); return !t || t.growth > 0; }),
      emerging: L.emerging
    };
  }
  return (listCache[cat] = out);
}

export function volRank(cat, name) {
  const seg = segFor(cat); if (!seg) return null;
  const list = byPop(seg); const k = list.findIndex((r) => r.t.name === name);
  return k < 0 ? null : { k: k + 1, n: list.length };
}

// What each segment's monthly number measures.
const METRIC = {
  etl: { name: "Search interest", lower: "search interest", short: "Search", what: "Google searches for the tool's name, not usage." },
  orch: { name: "Python downloads", lower: "Python downloads", short: "Downloads", what: "Package downloads by developers and automated systems, not users or revenue." },
  bi: { name: "SDK downloads", lower: "SDK downloads", short: "SDK downloads", what: "Downloads of the vendor's embedding SDK, not users or revenue." }
};
export const metricFor = (cat) => METRIC[cat] || { name: "Python downloads", lower: "Python downloads", short: "Downloads", what: "Package downloads by developers and automated systems, not users or revenue." };

// How each status is decided, per segment, in plain words.
const RESEARCH = "our research into adoption (company reports, industry studies and other public evidence)";
const RATED = {
  etl: { widely: "the most searched tools on Google, April to September.",
         rising: `based on ${RESEARCH}. Google searches fell for every ETL tool in this period, so searches alone can't show growth.` },
  orch: { widely: "the most downloaded tools, April to September.", rising: "downloads grew from April to September." },
  bi: { widely: "the most downloaded SDKs, April to September.", rising: "downloads grew from April to September." },
  stream: { note: "None of these tools publish monthly download numbers.",
            widely: `the leading tools in ${RESEARCH}.`, rising: "the tools our research shows gaining adoption fastest.", emerging: "newer tools our research shows gaining early adoption." }
};
const RATED_MIXED = { note: "Some tools here publish download numbers; most commercial ones don't.",
  widely: `the leading tools in ${RESEARCH}.`,
  rising: "downloads grew from April to September. For tools that publish no download numbers, our research shows them gaining adoption. Tools whose downloads fell are not marked Rising.",
  emerging: "newer tools our research shows gaining early adoption." };
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// [label, meaning] pairs for the statuses this segment actually shows.
export function ratedParts(cat) {
  const R = RATED[cat] || RATED_MIXED, L = statusLists(cat), out = [];
  if (R.widely) out.push(["Widely used", R.widely]);
  if (R.rising && L.rising.length) out.push(["Rising", R.rising]);
  if (R.emerging && L.emerging.length) out.push(["Emerging", R.emerging]);
  return { note: R.note || "", parts: out };
}
export const ratedFor = (cat) => { const r = ratedParts(cat); return (r.note ? r.note + " " : "") + r.parts.map(([k, v]) => `${k}: ${cap(v)}`).join(" "); };

export function medianGrowth(cat) { const seg = segFor(cat); return seg && seg.tools.length ? medianOf(seg.tools.map((t) => t.growth)) : null; }

// Everything a status block shows for one tool. Each badge says what it is based on.
export function statusInfo(cat, name) {
  const t = numFor(cat, name), S = sheetStatus(cat, name), L = statusLists(cat), m = metricFor(cat);
  const basisNum = cat === "etl" ? "from search interest" : "from downloads";
  const badges = [];
  const wIdx = L.widely.findIndex((x) => x.name === name), rIdx = L.rising.findIndex((x) => x.name === name), eIdx = L.emerging.findIndex((x) => x.name === name);
  const vr = t ? volRank(cat, name) : null;
  if (wIdx >= 0) badges.push({ s: "Widely used", basis: t && vr && vr.k <= 3 && NUMBER_SEGS.includes(cat) ? basisNum : "from researched adoption evidence", rank: wIdx + 1 });
  if (rIdx >= 0 || (t && t.growth > 0)) badges.push({ s: "Rising", basis: t && t.growth > 0 ? basisNum : "from researched adoption evidence", rank: rIdx >= 0 ? rIdx + 1 : null });
  if (eIdx >= 0) badges.push({ s: "Emerging", basis: "from researched adoption evidence", rank: eIdx + 1 });
  if (!badges.length && S && S.status && !t) badges.push({ s: S.status, basis: "from researched adoption evidence", rank: S.rank || null });
  const label = CATEGORIES[cat].label;
  const notes = [];
  let rel = null;
  if (t) {
    const seg = segFor(cat), med = medianGrowth(cat);
    rel = med != null && seg.tools.length >= 3 ? (1 + t.growth) / (1 + med) - 1 : null;
    notes.push(m.what);
    if (cat === "orch") notes.push("Compared per day, because April covers 6-30 Apr only.");
    if (cat === "etl" && med < 0) notes.push(`Searches fell for every ETL tool in this period (typical tool ${fmtSigned(med)}).`);
    if (rel != null) notes.push(`Compared with the ${label} average: ${fmtSigned(rel)}.`);
    if (vr && !badges.some((b) => b.s === "Widely used")) notes.push(`#${vr.k} of ${vr.n} by ${m.lower} in this segment.`);
  }
  return { t, S, vr, m, badges, label, notes };
}
// Same format as ranking.js fmtPct, kept local to avoid a circular import.
const fmtSigned = (g) => (g >= 0 ? "+" : "-") + Math.abs(g * 100).toLocaleString("en-US", { maximumFractionDigits: Math.abs(g) >= 1 ? 0 : 1 }) + "%";
