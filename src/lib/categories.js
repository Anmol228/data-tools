import {
  ETL_TOOLS, ETL_MESH, ETL_FILES, ORCH_TOOLS, ORCH_MESH, ORCH_FILES, BI_TOOLS, BI_MESH, BI_FILES,
  TRANSFORM_TOOLS, TRANSFORM_MESH, TRANSFORM_FILES, STREAM_TOOLS, STREAM_MESH, STREAM_FILES,
  STORE_TOOLS, STORE_MESH, STORE_FILES, DQ_TOOLS, DQ_MESH, DQ_FILES, CATALOG_TOOLS, CATALOG_MESH, CATALOG_FILES
} from "../data.js";

// The three segments (pages) of the site. "mesh" = node name inside the GLB files.
export const CATEGORIES = {
  etl: { label: "ETL / ELT", hash: "etl", eyebrow: "Data tools · ETL / ELT", title: "Data integration platforms", tools: ETL_TOOLS, mesh: ETL_MESH, files: ETL_FILES },
  orch: { label: "Process orchestration", hash: "orchestration", eyebrow: "Data tools · Process orchestration", title: "Process orchestration tools", tools: ORCH_TOOLS, mesh: ORCH_MESH, files: ORCH_FILES },
  bi: { label: "Business intelligence", hash: "bi", eyebrow: "Data tools · Business intelligence", title: "Business intelligence tools", tools: BI_TOOLS, mesh: BI_MESH, files: BI_FILES },
  transform: { label: "Transformation", short: "Transformation", hash: "transformation", eyebrow: "Data tools · Transformation", title: "Data transformation tools", tools: TRANSFORM_TOOLS, mesh: TRANSFORM_MESH, files: TRANSFORM_FILES },
  stream: { label: "Streaming", short: "Streaming", hash: "streaming", eyebrow: "Data tools · Streaming", title: "Streaming platforms", tools: STREAM_TOOLS, mesh: STREAM_MESH, files: STREAM_FILES },
  store: { label: "Storage / Warehouse / Query", short: "Storage / Query", hash: "storage", eyebrow: "Data tools · Storage / Warehouse / Query", title: "Warehouses, lakehouses and query engines", tools: STORE_TOOLS, mesh: STORE_MESH, files: STORE_FILES },
  dq: { label: "Data Quality / Observability", short: "Data quality", hash: "data-quality", eyebrow: "Data tools · Data Quality / Observability", title: "Data quality and observability tools", tools: DQ_TOOLS, mesh: DQ_MESH, files: DQ_FILES },
  catalog: { label: "Catalog / Governance", short: "Catalog / Governance", hash: "catalog", eyebrow: "Data tools · Catalog / Governance", title: "Data catalog and governance tools", tools: CATALOG_TOOLS, mesh: CATALOG_MESH, files: CATALOG_FILES }
};
// Short name for tabs and buttons (falls back to the full label).
export const shortLabel = (k) => CATEGORIES[k].short || CATEGORIES[k].label;

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
