// Daily job: fetches the latest monthly download numbers and saves them for the data API.
// Runs automatically once a day on Netlify (scheduled function). It can also be started by hand
// from the Netlify dashboard: Logs & metrics > Functions > refresh-market > Run now.
import { getStore } from "@netlify/blobs";
import { buildMarket } from "../lib/market.mjs";

export default async () => {
  const store = getStore("market-data");
  const previous = await store.get("latest", { type: "json" }).catch(() => null);
  const next = await buildMarket({ previous });
  if (Object.keys(next.segments).length) await store.setJSON("latest", next);
  console.log(`refresh-market: ${Object.keys(next.segments).length} segments saved, ${next.errors.length} errors`, next.errors.slice(0, 10));
  return new Response("ok");
};

export const config = { schedule: "@daily" };
