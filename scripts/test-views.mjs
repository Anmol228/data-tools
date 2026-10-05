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
const req = (method, body, ua = "Mozilla/5.0") => new Request("https://x/api/views", { method, headers: { "user-agent": ua, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const s = memoryStore();

let r = await (await handle(req("GET"), s)).json();
assert.equal(r.people, 0);
r = await (await handle(req("POST", { id: "aaaaaaaa-1111" }), s)).json();
assert.equal(r.people, 1, "first visitor counted");
r = await (await handle(req("POST", { id: "aaaaaaaa-1111" }), s)).json();
assert.equal(r.people, 1, "same browser not counted twice");
r = await (await handle(req("POST", { id: "bbbbbbbb-2222" }), s)).json();
assert.equal(r.people, 2, "second visitor counted");
r = await (await handle(req("POST", { id: "cccccccc-3333" }, "Googlebot/2.1"), s)).json();
assert.equal(r.people, 2, "bots ignored");
r = await (await handle(req("POST", { id: "../../bad" }), s)).json();
assert.equal(r.people, 2, "bad ids ignored");
// Force a recount: summary age > 60 s; three pages of keys must be summed
for (const id of ["dddddddd-4", "eeeeeeee-5", "ffffffff-6"]) await s.set("visitor/" + id, "1");
const sum = JSON.parse((await s.get("summary")) ); sum.at = 0; await s.setJSON("summary", sum);
r = await (await handle(req("GET"), s)).json();
assert.equal(r.people, 5, "recount sums every page of keys");
assert.ok(r.since, "has a since date");
assert.equal((await handle(req("DELETE"), s)).status, 405);
console.log("views counter: all checks passed", r);
