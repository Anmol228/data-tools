import { ETL_TOOLS, ETL_MESH, ETL_FILES, ORCH_TOOLS, ORCH_MESH, ORCH_FILES, BI_TOOLS, BI_MESH, BI_FILES } from "../data.js";

// The three segments (pages) of the site. "mesh" = node name inside the GLB files.
export const CATEGORIES = {
  etl: { label: "ETL / ELT", hash: "etl", eyebrow: "Data tools · ETL / ELT", title: "Data integration platforms", tools: ETL_TOOLS, mesh: ETL_MESH, files: ETL_FILES },
  orch: { label: "Process orchestration", hash: "orchestration", eyebrow: "Data tools · Process orchestration", title: "Process orchestration tools", tools: ORCH_TOOLS, mesh: ORCH_MESH, files: ORCH_FILES },
  bi: { label: "Business intelligence", hash: "bi", eyebrow: "Data tools · Business intelligence", title: "Business intelligence tools", tools: BI_TOOLS, mesh: BI_MESH, files: BI_FILES }
};

export const catFromHash = () =>
  Object.keys(CATEGORIES).find((k) => "#" + CATEGORIES[k].hash === location.hash) || "etl";

// ---------- Tier filter: the 3D row shows only tools of the chosen tier ----------
export const passesTier = (t, tier) => tier === "all" || (t && t.tier === tier);
export function visibleList(tools, tier) {
  const v = [];
  tools.forEach((t, i) => { if (passesTier(t, tier)) v.push(i); });
  return v.length ? v : tools.map((_, i) => i);
}
export function stepVisible(tools, tier, from, dir) {
  const v = visibleList(tools, tier);
  if (from < 0) return v[0];
  const k = v.indexOf(from);
  if (k < 0) return v[0];
  return v[(k + dir + v.length) % v.length];
}

export const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const pad = (n) => String(n).padStart(2, "0");
export const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
export const MEDIA_BG = [
  ["#cfe0ff", "#eadbff"], ["#ffd8e8", "#ffe8cf"], ["#d2f4e6", "#d5e7ff"], ["#fff0c6", "#ffd5df"],
  ["#e2dbff", "#cdeeff"], ["#d6f6d2", "#fff2c2"], ["#ffdccf", "#e6dcff"]
];
