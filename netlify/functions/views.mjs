// Counts how many different people (browsers) have opened the site.
//
// POST /api/views  { id }  registers one visitor id (generated in the browser and kept in
//                          localStorage), then returns the current count.
// GET  /api/views          returns the current count only.
//
// Response: { people: number, since: ISO date of the first visit, updated: ISO date }
//
// Storage: Netlify Blobs (built into Netlify, no extra account). Each visitor is its own key,
// so two people arriving at the same moment can never overwrite each other's visit. The total
// is the number of keys; it is cached in a small summary blob and recounted at most once a minute.

import { getStore } from "@netlify/blobs";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests/i;
const ID = /^[A-Za-z0-9-]{8,64}$/;
const RECOUNT_MS = 60_000;

export async function handle(req, store) {
  const now = Date.now();
  let summary = (await store.get("summary", { type: "json" })) || { people: 0, since: null, at: 0 };

  if (req.method === "POST") {
    const ua = req.headers.get("user-agent") || "";
    let id = null;
    try { ({ id } = await req.json()); } catch { /* empty or bad body: just report the count */ }
    if (!BOT.test(ua) && typeof id === "string" && ID.test(id)) {
      const key = "visitor/" + id;
      const seen = await store.getMetadata(key);
      if (!seen) {
        await store.set(key, String(now), { metadata: { first: now } });
        // Show the new visitor straight away; the periodic recount corrects any race.
        summary = { people: summary.people + 1, since: summary.since || now, at: summary.at };
        await store.setJSON("summary", summary);
      }
    }
  } else if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST" } });
  }

  if (now - summary.at > RECOUNT_MS) {
    let people = 0;
    let since = summary.since;
    for await (const page of store.list({ prefix: "visitor/", paginate: true })) {
      people += page.blobs.length;
    }
    summary = { people, since: since || (people ? now : null), at: now };
    await store.setJSON("summary", summary);
  }

  return Response.json(
    { people: summary.people, since: summary.since ? new Date(summary.since).toISOString() : null, updated: new Date(summary.at || now).toISOString() },
    { headers: { "cache-control": "no-store" } }
  );
}

export default async (req) => handle(req, getStore({ name: "site-views", consistency: "strong" }));

export const config = { path: "/api/views" };
