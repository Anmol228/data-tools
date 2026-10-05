import { Fragment, useEffect, useRef } from "react";
import { useStore, openTrends, closeTrends, openTopPage, openTop } from "../store.js";
import { CATEGORIES } from "../lib/categories.js";
import { segFor, rankSeg, widelyUsed, emergingTop, popShort, fmtPct, medianOf } from "../lib/ranking.js";
import { Icon, Logo, indexOfTool } from "./bits.jsx";
import { showHoverChart, hideHoverChart } from "./HoverChart.jsx";

// Small market-trends pop-up: the segment's trend line and the top tools' icons only.
function TrendPop({ cat, seg, rows }) {
  return (
    <>
      <div className="tp-seg">{`Market trends · ${CATEGORIES[cat].label}`}</div>
      {!rows.length ? (
        <p className="tp-line no-data">No market-trend data available for this segment.</p>
      ) : (
        <>
          <p className="tp-line">Median change <b>{fmtPct(medianOf(seg.tools.map((t) => t.growth)))}</b>{` across ${rows.length} tracked tools, Apr to Sep 2026 (${seg.cat === "etl" ? "search interest" : "downloads"}).`}</p>
          {[["Most widely used", widelyUsed(seg)], ["Emerging", emergingTop(seg)]].map(([label, list]) => (
            <Fragment key={label}>
              <div className="tp-seg">{label}</div>
              <div className="tp-icons">
                {list.map((r) => (
                  <button key={r.t.name} type="button" className="tp-icon" title={r.t.name} aria-label={`${label}: ${r.t.name}. Open full details`}
                    onClick={(e) => openTop(r.t.name, e.currentTarget)}>
                    <Logo cat={seg.cat} i={indexOfTool(seg.cat, r.t.name)} fallback={r.t.name.slice(0, 2)} />
                  </button>
                ))}
              </div>
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}

// Most widely used top 3 (popularity rank) and Emerging top 3 (growth rank).
function Group({ title, seg, rows, value }) {
  return (
    <div className="t5-group">
      <div className="t5-group-h"><b>{title}</b></div>
      <ol className="t5-mini">
        {!rows.length && <li className="no-data">No data available.</li>}
        {rows.map((r) => (
          <li key={r.t.name}>
            <button type="button" className="t5-chip" title={r.t.name} aria-label={`${title}: ${r.t.name}. Open full details`}
              onClick={(e) => { hideHoverChart(true); openTop(r.t.name, e.currentTarget); }}
              onMouseEnter={(e) => showHoverChart(e.currentTarget, seg, r.t.name)}
              onFocus={(e) => showHoverChart(e.currentTarget, seg, r.t.name)}
              onMouseLeave={() => hideHoverChart()}
              onBlur={() => hideHoverChart()}>
              <span className="tg-logo" aria-hidden="true"><Logo cat={seg.cat} i={indexOfTool(seg.cat, r.t.name)} fallback={r.t.name.slice(0, 2)} /></span>
              <span className="tg-name">{r.t.name}</span>
              <span className="t5-chip-v">{value(r)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TrendsSection() {
  const cat = useStore((s) => s.activeCat);
  const trendsOpen = useStore((s) => s.trendsOpen);
  const popRef = useRef(null);
  const btnRef = useRef(null);
  const seg = segFor(cat);
  const rows = seg ? rankSeg(seg) : [];

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
        {trendsOpen && <TrendPop cat={cat} seg={seg} rows={rows} />}
      </div>
      <ol className="t5-list" id="t5List" aria-live="polite">
        {!rows.length && <li className="t5-empty">No market-trend data available for this segment.</li>}
      </ol>
      <div className="t5-pair" id="t5Pair">
        {rows.length > 0 && (
          <>
            <Group title="Most widely used" seg={seg} rows={widelyUsed(seg)} value={(r) => <b>{popShort(seg, r.t.pop)}</b>} />
            <Group title="Emerging" seg={seg} rows={emergingTop(seg)} value={(r) => <b className={r.t.growth >= 0 ? "up" : "down"}>{fmtPct(r.t.growth)}</b>} />
          </>
        )}
      </div>
    </section>
  );
}
