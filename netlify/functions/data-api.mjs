// Data API for the site (and anyone else who wants the data).
//
//   GET /api/market                 Latest monthly download numbers per segment (refreshed daily).
//   GET /api/segments               The 8 segments with tool counts.
//   GET /api/tools?segment=etl      Every tool in a segment: summary, pricing, tier, market status,
//                                   connectors and monthly numbers (latest if available).
//
// Responses are JSON. Monthly numbers come from the daily refresh job when it has run; until then,
// and for anything it could not refresh, the built-in researched numbers are returned.
import { getStore } from "@netlify/blobs";
import { CATEGORIES } from "../../src/lib/categories.js";
import { MONTHLY, STATUS, TOOL_CONN, ETL_CONNECTORS } from "../../src/data.js";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
});

async function latestMarket() {
  try { return await getStore("market-data").get("latest", { type: "json" }); } catch { return null; }
}

// Monthly numbers for one segment: latest refreshed series if present, otherwise the built-in ones.
function monthlyFor(cat, live) {
  const base = MONTHLY[cat];
  const l = live && live.segments && live.segments[cat];
  if (l) return { months: l.months, monthKeys: l.monthKeys, source: l.source === "npm" ? "api.npmjs.org" : "pypistats.org", updated: live.updated, tools: l.tools };
  if (base) return { months: base.months, source: base.source, updated: null, tools: base.tools };
  return null;
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, "");
  if (req.method !== "GET") return json({ error: "Use GET" }, 405);

  if (route === "/api/market") {
    const live = await latestMarket();
    return json({ updated: live ? live.updated : null, live: !!live, segments: live ? live.segments : {} });
  }

  if (route === "/api/segments") {
    return json(Object.entries(CATEGORIES).map(([id, c]) => ({
      id, label: c.label, title: c.title, tools: c.tools.length, hasMonthlyNumbers: !!MONTHLY[id]
    })));
  }

  if (route === "/api/tools") {
    const id = url.searchParams.get("segment");
    const c = CATEGORIES[id];
    if (!c) return json({ error: "Unknown segment. Use one of: " + Object.keys(CATEGORIES).join(", ") }, 400);
    const mon = monthlyFor(id, await latestMarket());
    const status = STATUS[id] || { tools: {}, lists: null };
    return json({
      segment: id, label: c.label,
      months: mon ? mon.months : null, monthlyUpdated: mon ? mon.updated : null,
      lists: status.lists,
      tools: c.tools.map((t) => ({
        name: t.name, url: t.url, summary: t.sum, tier: t.tier, price: t.price, pricingUrl: t.priceUrl,
        status: status.tools[t.name] || null,
        monthly: (mon && mon.tools.find((x) => x.name === t.name)) || null,
        connectors: TOOL_CONN[t.name] || null,
        connectorTypes: id === "etl" ? (ETL_CONNECTORS.tools[t.name] || null) : null
      }))
    });
  }

  return json({ error: "Not found. Try /api/segments, /api/tools?segment=etl or /api/market" }, 404);
};

export const config = { path: ["/api/market", "/api/segments", "/api/tools"] };
