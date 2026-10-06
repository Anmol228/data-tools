import { Fragment, useLayoutEffect, useRef, useState, useSyncExternalStore, useEffect } from "react";
import { openTop } from "../store.js";
import { monthInsights, monthVal, fmtPct, noteFor } from "../lib/ranking.js";
import MarketStatus from "./MarketStatus.jsx";
import { MonthlyChart } from "./bits.jsx";
import { hideTip } from "./Tooltip.jsx";
import { scrollProfileTo } from "./Card.jsx";

// ---------- Hover a ranked tool: its monthly chart, each month, and insights ----------
let hc = null;   // { anchor, seg, name }
let hideTimer = 0;
const subs = new Set();
const emit = () => subs.forEach((l) => l());
const lastPtr = { x: -1, y: -1 };
let cardEl = null;
if (typeof document !== "undefined") {
  document.addEventListener("pointermove", (e) => { lastPtr.x = e.clientX; lastPtr.y = e.clientY; }, { passive: true });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && hc) hideHoverChart(true); });
  addEventListener("scroll", () => hideHoverChart(true), { passive: true });
}

export function showHoverChart(anchor, seg, name) {
  clearTimeout(hideTimer);
  hc = { anchor, seg, name, at: Date.now() };
  emit();
}
// Leaving the tool waits a moment so the pointer can move into the card and use its options.
export function hideHoverChart(now) {
  clearTimeout(hideTimer);
  if (!hc) return;
  if (now === true) { hc = null; hideTip(); emit(); return; }
  hideTimer = setTimeout(() => {
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    const inside = lastPtr.x >= r.left - 4 && lastPtr.x <= r.right + 4 && lastPtr.y >= r.top - 10 && lastPtr.y <= r.bottom + 4;
    if (!inside && !cardEl.contains(document.activeElement)) { hc = null; hideTip(); emit(); }
  }, 400);
}

const VIEWS = [["chart", "Chart"], ["months", "Each month"], ["insights", "Insights"]];

export default function HoverChart() {
  const cur = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => hc);
  const [view, setView] = useState("chart");
  const ref = useRef(null);
  useEffect(() => { cardEl = ref.current; }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!cur || !el) return;
    const r = cur.anchor.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    el.style.top = (r.bottom + 6 + hh > innerHeight ? Math.max(8, r.top - hh - 6) : r.bottom + 6) + "px";
  }, [cur, view]);

  let content = null;
  if (cur) {
    const { seg, name, anchor } = cur;
    const t = seg && seg.tools.find((x) => x.name === name);
    if (!t) content = (
      <>
        <div className="hv-status"><MarketStatus name={name} /></div>
        <button type="button" className="hv-open" onClick={() => { hideHoverChart(true); openTop(name, anchor); }}>Open full details</button>
      </>
    );
    else {
      const ins = monthInsights(seg, t);
      const note = noteFor(seg.cat, name);
      content = (
        <>
          <p className="hv-st"><MarketStatus name={name} compact /></p>
          <div className="hv-tabs" role="tablist">
            {VIEWS.map(([v, label]) => <button key={v} type="button" role="tab" data-v={v} aria-selected={String(v === view)} onClick={() => setView(v)}>{label}</button>)}
          </div>
          <div className="hv-body">
            {view === "chart" && <><MonthlyChart seg={seg} name={name} big /><p className="hv-hint">Hover a bar for that month's value and change.</p></>}
            {view === "months" && (
              <table className="hv-table">
                <thead><tr><th>Month</th><th>{seg.cat === "etl" ? "Index" : "Downloads"}</th><th>vs prev</th></tr></thead>
                <tbody>
                  {t.m.map((v, k) => {
                    const d = ins.mom[k];
                    return <tr key={k}><td>{seg.months[k]}</td><td>{monthVal(seg, v)}</td><td className={d == null ? "" : d >= 0 ? "up" : "down"}>{d == null ? "n/a" : fmtPct(d)}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
            {view === "insights" && (
              <>
                <dl className="hv-ins">{ins.lines.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
                {note && !/^Topic:/.test(note) && <p className="hv-note">{note}</p>}
              </>
            )}
          </div>
          <button type="button" className="hv-open" onClick={() => { hideHoverChart(true); openTop(name, anchor); scrollProfileTo(".pf-trend"); }}>Open full details and chart</button>
        </>
      );
    }
  }
  return (
    <div className="t5-hover" role="dialog" aria-label="Monthly chart and insights" hidden={!cur} ref={ref}
      onMouseEnter={() => clearTimeout(hideTimer)}
      onMouseLeave={() => hideHoverChart()}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hideHoverChart(); }}>
      {cur && <div className="t5-hover-name">{cur.name}</div>}
      {content}
    </div>
  );
}
