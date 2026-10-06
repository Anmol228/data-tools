import { useEffect, useState } from "react";
import { Icon } from "./bits.jsx";

// ---------- Eye: how many people have opened the site ----------
// Talks to the small /api/views Netlify function, which counts each person once.
// Where that function does not exist (local dev without Netlify, the Claude artifact preview)
// the eye stays hidden.
export default function ViewsPill() {
  const [people, setPeople] = useState(null);
  useEffect(() => {
    if (location.protocol === "file:" || /(^|\.)(claude\.ai|claudeusercontent\.com|anthropic\.com)$/.test(location.hostname)) return;
    let session = null;
    try { session = window.sessionStorage; } catch (e) { /* storage blocked */ }
    const already = (() => { try { return session && session.getItem("dst-counted") === "1"; } catch (e) { return false; } })();
    fetch("/api/views", { method: already ? "GET" : "POST", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((res) => {
        if (typeof res.people !== "number") return;
        try { if (session) session.setItem("dst-counted", "1"); } catch (e) { /* ignore */ }
        setPeople(res.people);
      })
      .catch(() => { /* no backend here: keep the eye hidden */ });
  }, []);

  return (
    <span className="views-pill" id="viewsPill" role="note" hidden={people == null}
      aria-label={people != null ? `${people} people have opened this site` : undefined}>
      <Icon><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
      <span id="viewsCount">{people != null ? people.toLocaleString("en-US") : ""}</span>
    </span>
  );
}
