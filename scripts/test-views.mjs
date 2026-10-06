// Runs the counter logic against an in-memory stand-in for Netlify Blobs.
import assert from "node:assert/strict";
import { handle } from "../netlify/functions/views.mjs";

function memoryStore() {
  const m = new Map();
  return {
    async get(k, o) { const v = m.get(k); return v == null ? null : o?.type === "json" ? JSON.parse(v.value) : v.value; },
    async set(k, value, o) { m.set(k, { value, metadata: o?.metadata || {} }); },
    async setJSON(k, v) { m.set(k, { value: JSON.stringify(v), metadata: {} }); },
    async getMetadata(k) { const v = m.get(k); return v ? { metadata: v.metadata } : null; },
    async *list({ prefix }) { const blobs = [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })); for (let i = 0; i < blobs.length; i += 2) yield { blobs: blobs.slice(i, i + 2) }; }
  };
}
const req = (method, ip, ua = "Mozilla/5.0") => new Request("https://x/api/views", { method, headers: { "user-agent": ua, "x-nf-client-connection-ip": ip || "" } });
const s = memoryStore();
const keys = async () => { const k = []; for await (const p of s.list({ prefix: "" })) k.push(...p.blobs.map((b) => b.key)); return k; };

let r = await (await handle(req("GET"), s)).json();
assert.equal(r.people, 0);
r = await (await handle(req("POST", "203.0.113.5"), s)).json();
assert.equal(r.people, 1, "first person counted");
r = await (await handle(req("POST", "203.0.113.5"), s)).json();
assert.equal(r.people, 1, "same person again (refresh, private window) not counted twice");
r = await (await handle(req("POST", "203.0.113.5", "Mozilla/5.0 (iPhone)"), s)).json();
assert.equal(r.people, 1, "same connection, different browser: still one person");
r = await (await handle(req("POST", "198.51.100.7"), s)).json();
assert.equal(r.people, 2, "second person counted");
r = await (await handle(req("POST", "192.0.2.9", "Googlebot/2.1"), s)).json();
assert.equal(r.people, 2, "bots ignored");
r = await (await handle(req("POST", ""), s)).json();
assert.equal(r.people, 2, "no address: not counted");
assert.ok(!(await keys()).some((k) => k.includes("203.0.113.5")), "raw address never stored");
// Force a recount: summary age > 60 s; three pages of keys must be summed
for (const id of ["a", "b", "c"]) await s.set("person/" + id, "1");
const sum = JSON.parse(await s.get("people-summary")); sum.at = 0; await s.setJSON("people-summary", sum);
r = await (await handle(req("GET"), s)).json();
assert.equal(r.people, 5, "recount sums every page of keys");
assert.ok(r.since, "has a since date");
assert.equal((await handle(req("DELETE"), s)).status, 405);
console.log("views counter: all checks passed", r);
