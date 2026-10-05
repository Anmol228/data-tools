import { useEffect, useState } from "react";
import { Icon } from "./bits.jsx";

// ---------- Eye: unique people who have opened the site ----------
// Talks to the small /api/views Netlify function. Where that function does not exist
// (local dev without Netlify, the Claude artifact preview) the eye stays hidden.
export default function ViewsPill() {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (location.protocol === "file:" || /(^|\.)(claude\.ai|claudeusercontent\.com|anthropic\.com)$/.test(location.hostname)) return;
    const store = (kind) => { try { return window[kind]; } catch (e) { return null; } };
    const local = store("localStorage"), session = store("sessionStorage");
    const get = (s, k) => { try { return s ? s.getItem(k) : null; } catch (e) { return null; } };
    const put = (s, k, v) => { try { if (s) s.setItem(k, v); } catch (e) { /* storage blocked: still counted once per load */ } };
    let id = get(local, "dst-visitor");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
      put(local, "dst-visitor", id);
    }
    const already = get(session, "dst-counted") === "1";
    fetch("/api/views", already ? { cache: "no-store" } : {
      method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ id })
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((res) => {
        if (typeof res.people !== "number") return;
        put(session, "dst-counted", "1");
        setD(res);
      })
      .catch(() => { /* no backend here: keep the eye hidden */ });
  }, []);

  const n = d ? d.people.toLocaleString("en-US") : "";
  const since = d && d.since ? new Date(d.since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "launch";
  return (
    <span className="views-pill" id="viewsPill" tabIndex={0} role="note" hidden={!d} aria-label={d ? `About ${d.people} people have opened this site` : undefined}>
      <Icon><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
      <span id="viewsCount">{d ? "≈" + n : ""}</span>
      <span className="views-tip" id="viewsTip" role="tooltip">
        {d ? `≈${n} people have opened this site since ${since}. Counted once per browser; known bots are excluded. Updates about every minute.` : ""}
      </span>
    </span>
  );
}
