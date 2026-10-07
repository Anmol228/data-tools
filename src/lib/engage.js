import { subscribe, getState } from "../store.js";
import { CATEGORIES } from "./categories.js";

// ---------- Engagement: what visitors do on the site ----------
// Anonymous counts only: no cookies, no names, no IP addresses, nothing typed.
// The page collects a few counters while it is open (segments viewed, tools clicked, profiles and
// the charts page opened, links followed, time the tab was visible) and sends them in ONE small
// message when the visitor leaves or switches tab. Totals are shown only in your private
// site-insights.html file (kept on your computer, not on the website).

const SKIP_HOST = /(^|\.)(claude\.ai|claudeusercontent\.com|anthropic\.com|localhost)$/;
const vid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 36);
const fresh = () => ({ seg: {}, tool: {}, prof: {}, site: {}, price: {}, social: {}, charts: 0 });
let v = fresh(), first = true, activeMs = 0, visibleSince = null, started = false;

const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const device = () => (innerWidth < 700 ? "phone" : innerWidth < 1100 ? "tablet" : "desktop");
const toolKey = (cat, i) => { const t = CATEGORIES[cat] && CATEGORIES[cat].tools[i]; return t ? `${cat}/${t.name}` : null; };

function addVisible() {
  if (visibleSince != null) { activeMs += performance.now() - visibleSince; visibleSince = null; }
}

function send() {
  addVisible();
  const any = first || v.charts || ["seg", "tool", "prof", "site", "price", "social"].some((k) => Object.keys(v[k]).length);
  if (!any && activeMs < 1000) return;
  const body = JSON.stringify({ v: 1, vid, first, secs: Math.round(activeMs / 1000), device: device(), ...v });
  v = fresh(); first = false; activeMs = 0;
  try {
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/engage", new Blob([body], { type: "text/plain" })))) {
      fetch("/api/engage", { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
    }
  } catch (e) { /* analytics must never break the page */ }
}

// Which link was followed: the tool's website, its pricing page, or the GitHub / LinkedIn links.
function onClick(e) {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  const href = a.href;
  if (/github\.com\/Anmol228/i.test(href)) return inc(v.social, "github");
  if (/linkedin\.com\/in\//i.test(href)) return inc(v.social, "linkedin");
  const cat = getState().activeCat;
  const tools = CATEGORIES[cat].tools;
  const same = (u) => u && u.replace(/\/+$/, "") === href.replace(/\/+$/, "");
  const t = tools.find((x) => same(x.url));
  if (t) return inc(v.site, `${cat}/${t.name}`);
  const p = tools.find((x) => same(x.priceUrl));
  if (p) return inc(v.price, `${cat}/${p.name}`);
}

export function startEngagement() {
  if (started || location.protocol === "file:" || SKIP_HOST.test(location.hostname)) return;
  started = true;
  let prev = getState();
  inc(v.seg, prev.activeCat);            // the segment the visitor landed on
  if (document.visibilityState === "visible") visibleSince = performance.now();

  subscribe(() => {
    const s = getState();
    if (s.activeCat !== prev.activeCat) inc(v.seg, s.activeCat);
    if (s.selected >= 0 && (s.selected !== prev.selected || s.activeCat !== prev.activeCat)) {
      const k = toolKey(s.activeCat, s.selected); if (k) inc(v.tool, k);
    }
    if (s.profile.open && (!prev.profile.open || s.profile.index !== prev.profile.index)) {
      const k = toolKey(s.activeCat, s.profile.index); if (k) inc(v.prof, k);
    }
    if (s.topPage.open && !prev.topPage.open) v.charts += 1;
    prev = s;
  });

  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
    else visibleSince = performance.now();
  });
  addEventListener("pagehide", send);
}
