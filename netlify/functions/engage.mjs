// Receives one small anonymous message per visit (and one more each time the visitor comes back
// to the tab and leaves again). Saved one message per key, so visits arriving together never
// overwrite each other. Totals are worked out by insights-data.mjs.
//
//   POST /api/engage   body: { v, vid, first, secs, device, seg, tool, prof, site, price, social, charts }
//
// Nothing personal is kept: no IP address, no cookie, no user agent.
import { getStore } from "@netlify/blobs";
import { clean, BOT, dayKey } from "../lib/engage.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405, headers: { allow: "POST" } });
  if (BOT.test(req.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  const text = await req.text();
  if (text.length > 16000) return new Response("Too large", { status: 413 });
  let rec = null;
  try { rec = clean(JSON.parse(text)); } catch { rec = null; }
  if (!rec) return new Response("Bad message", { status: 400 });
  const now = new Date();
  const key = `v/${dayKey(now)}/${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await getStore("engagement").setJSON(key, rec);
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/engage" };
