// Totals for your private Site Insights file (site-insights.html, kept on your own computer;
// it is NOT part of the website).
//
//   GET /api/insights?days=30     header: x-insights-key: <your INSIGHTS_KEY>
//
// The key is a password you choose and save in Netlify (Site configuration > Environment variables
// > INSIGHTS_KEY). Without the right key this address answers "Not found", exactly like a page
// that does not exist, so visitors cannot tell it is there.
// Finished days are added up once and saved, so the page stays quick as visits grow.
import { getStore } from "@netlify/blobs";
import { summarizeDay, combine, dayKey } from "../lib/engage.mjs";

// Your insights file runs from your computer, so the browser asks permission first (CORS).
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "x-insights-key", "access-control-allow-methods": "GET, OPTIONS" };
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", ...CORS } });
const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain", ...CORS } });

async function sameText(a, b) {
  const h = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  return x.every((v, i) => v === y[i]);
}

async function daySummary(store, date, today) {
  const cached = date < today ? await store.get(`s/${date}`, { type: "json" }) : null;
  if (cached) return cached;
  const records = [];
  for await (const page of store.list({ prefix: `v/${date}/`, paginate: true })) {
    const got = await Promise.all(page.blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)));
    got.forEach((r) => r && records.push(r));
  }
  const sum = summarizeDay(records);
  if (date < today) await store.setJSON(`s/${date}`, sum);   // finished day: save the totals
  return sum;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const key = (globalThis.Netlify && Netlify.env.get("INSIGHTS_KEY")) || process.env.INSIGHTS_KEY;
  const given = req.headers.get("x-insights-key") || "";
  if (!key || !given || !(await sameText(given, key))) return notFound();

  const url = new URL(req.url);
  const days = [7, 30, 90].includes(+url.searchParams.get("days")) ? +url.searchParams.get("days") : 30;
  const store = getStore("engagement");
  const now = new Date(), today = dayKey(now);
  const dates = Array.from({ length: days }, (_, k) => dayKey(new Date(now.getTime() - (days - 1 - k) * 86400000)));
  const list = [];
  for (const date of dates) list.push({ date, sum: await daySummary(store, date, today) });
  return json({ range: { from: dates[0], to: today, days }, updated: now.toISOString(), ...combine(list) });
};

export const config = { path: "/api/insights" };
