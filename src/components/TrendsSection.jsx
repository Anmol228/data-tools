import { Fragment, useEffect, useRef } from "react";
import { useStore, openTrends, closeTrends, openTopPage, openTop } from "../store.js";
import { CATEGORIES } from "../lib/categories.js";
import { segFor, rankSeg, popShort, fmtPct, medianOf, periodOf } from "../lib/ranking.js";
import { statusLists, numFor, metricFor, ST_LABEL } from "../lib/status.js";
import { Icon, Logo, indexOfTool } from "./bits.jsx";
import { RatedBox } from "./MarketStatus.jsx";
import { showHoverChart, hideHoverChart } from "./HoverChart.jsx";

const KEYS = ["widely", "rising", "emerging"];

// Small market-trends pop-up: the segment's typical change, the status lists' icons and how statuses are rated.
function TrendPop({ cat }) {
  const seg = segFor(cat), L = statusLists(cat);
  const rows = seg ? rankSeg(seg) : [];
  return (
    <>
      <div className="tp-seg">{`Market trends · ${CATEGORIES[cat].label}`}</div>
      {rows.length ? (
        <p className="tp-line">{`Typical change in ${metricFor(cat).lower}: `}<b>{fmtPct(medianOf(seg.tools.map((t) => t.growth)))}</b>{` across ${rows.length} tools with monthly numbers, ${periodOf(seg).label}.`}</p>
      ) : (
        <p className="tp-line no-data">Monthly trend: not publicly available for this segment. Statuses below come from our research into adoption.</p>
      )}
      {KEYS.filter((k) => L[k].length).map((k) => (
        <Fragment key={k}>
          <div className="tp-seg">{ST_LABEL[k]}</div>
          <div className="tp-icons">
            {L[k].map((x) => (
              <button key={x.name} type="button" className="tp-icon" title={x.name} aria-label={`${ST_LABEL[k]}: ${x.name}. Open full details`}
                onClick={(e) => openTop(x.name, e.currentTarget)}>
                <Logo cat={cat} i={indexOfTool(cat, x.name)} fallback={x.name.slice(0, 2)} />
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      <RatedBox cat={cat} className="tp-line tp-rated" />
    </>
  );
}

// One status list (Widely used / Rising / Emerging) as a full-width row of chips.
function Group({ cat, k }) {
  const seg = segFor(cat), L = statusLists(cat), title = ST_LABEL[k];
  const value = (x, idx) => {
    const t = numFor(cat, x.name);
    if (t && k === "widely") return <b>{popShort(seg, t.pop)}</b>;
    if (t) return <>{cat === "etl" ? <><small className="st-basis">Search</small> </> : null}<b className={t.growth >= 0 ? "up" : "down"}>{fmtPct(t.growth)}</b></>;
    return <b className="st-rank">#{idx + 1}</b>;
  };
  return (
    <div className="t5-group">
      <div className="t5-group-h"><b>{title}</b></div>
      <ol className="t5-mini">
        {L[k].map((x, idx) => (
          <li key={x.name}>
            <button type="button" className="t5-chip" title={x.name} aria-label={`${title}: ${x.name}. Open full details`}
              onClick={(e) => { hideHoverChart(true); openTop(x.name, e.currentTarget); }}
              onMouseEnter={(e) => showHoverChart(e.currentTarget, seg, x.name)}
              onFocus={(e) => showHoverChart(e.currentTarget, seg, x.name)}
              onMouseLeave={() => hideHoverChart()}
              onBlur={() => hideHoverChart()}>
              <span className="tg-logo" aria-hidden="true"><Logo cat={cat} i={indexOfTool(cat, x.name)} fallback={x.name.slice(0, 2)} /></span>
              <span className="tg-name">{x.name}</span>
              <span className="t5-chip-v">{value(x, idx)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TrendsSection() {
  const cat = useStore((s) => s.activeCat);
  useStore((s) => s.dataVersion);   // redraw when the latest numbers arrive
  const trendsOpen = useStore((s) => s.trendsOpen);
  const popRef = useRef(null);
  const btnRef = useRef(null);
  const L = statusLists(cat);
  const keys = KEYS.filter((k) => L[k].length);

  useEffect(() => {
    if (!trendsOpen) return;
    const onDoc = (e) => {
      if (!popRef.current.contains(e.target) && !btnRef.current.contains(e.target)) closeTrends(true);
    };
    const id = setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => { clearTimeout(id); document.removeEventListener("click", onDoc); };
  }, [trendsOpen]);

  return (
    <section className="top5" id="top5" aria-labelledby="t5Title">
      <div className="t5-head">
        <h2 className="t5-title" id="t5Title">{CATEGORIES[cat].label}</h2>
        <button type="button" className="t5-trends t5-open" id="t5Open" aria-haspopup="dialog" onClick={(e) => openTopPage(e.currentTarget)}>
          <Icon d={["M4 20h16", "M7 16v-5M12 16V6M17 16v-8"]} />Charts
        </button>
        <button type="button" className="t5-trends" id="trendsBtn" aria-expanded={String(trendsOpen)} aria-controls="trendPop" ref={btnRef}
          onClick={() => (trendsOpen ? closeTrends() : openTrends())}>
          <Icon d={["M3 17l6-6 4 4 8-8", "M15 7h6v6"]} />Market trends
        </button>
      </div>
      <div className="trend-pop" id="trendPop" role="dialog" aria-label="Market trends" hidden={!trendsOpen} ref={popRef}>
        {trendsOpen && <TrendPop cat={cat} />}
      </div>
      <ol className="t5-list" id="t5List" aria-live="polite">
        {!keys.length && <li className="t5-empty">No market status available for this segment in our research.</li>}
      </ol>
      {/* One full-width row per list, so tool names never break. */}
      <div className="t5-pair t5-three" id="t5Pair">
        {keys.map((k) => <Group key={k} cat={cat} k={k} />)}
        {keys.length > 0 && <RatedBox cat={cat} className="t5-note t5-rated" />}
      </div>
    </section>
  );
}
