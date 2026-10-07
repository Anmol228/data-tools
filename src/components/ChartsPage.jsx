import { useLayoutEffect, useRef } from "react";
import { useStore, closeTopPage, setTopView, switchCategory, openTop } from "../store.js";
import { CATEGORIES, shortLabel } from "../lib/categories.js";
import { sfx } from "../lib/sfx.js";
import { segFor, rankSeg, byGrowth, byPop, fmtPct, popShort, popText, noteFor, gapsFor, periodOf } from "../lib/ranking.js";
import { statusLists, numFor, sheetStatus, metricFor, ratedFor, NUMBER_SEGS, ST_LABEL } from "../lib/status.js";
import { Icon, Logo, MonthlyChart, indexOfTool } from "./bits.jsx";
import { tipProps, hideTip } from "./Tooltip.jsx";

const VIEW_TEXT = {
  overall: ["Overall", "Average of the growth rank and the popularity rank."],
  growth: ["By growth", ""],   // text depends on the months in the data, see viewText()
  popularity: ["By popularity", "6-month volume."]
};
const viewText = (view, seg) => view === "growth" ? `Change from ${periodOf(seg).label}.` : VIEW_TEXT[view][1];

function ToolButton({ seg, cat, name, cls }) {
  const c = cat || seg.cat;
  return (
    <button type="button" className={cls} aria-label={`${name}: open full details`} onClick={(e) => openTop(name, e.currentTarget)}>
      <span className="tg-logo" aria-hidden="true"><Logo cat={c} i={indexOfTool(c, name)} fallback={name.slice(0, 2)} /></span>
      <span className="tg-name">{name}</span>
    </button>
  );
}

function GrowthBar({ g, lo, hi }) {
  const span = hi - lo || 1;
  const zero = ((0 - lo) / span) * 100;
  const end = ((g - lo) / span) * 100;
  return (
    <>
      <span className="hzero" style={{ left: zero + "%" }} />
      <i className={"hbar " + (g >= 0 ? "pos" : "neg")} style={{ left: Math.min(zero, end) + "%", width: Math.max(0.6, Math.abs(end - zero)) + "%" }} />
    </>
  );
}

// Widely used / Rising / Emerging, each with the researched evidence for every tool.
function StatusCards({ cat }) {
  const seg = segFor(cat), L = statusLists(cat), m = metricFor(cat), P = periodOf(seg);
  const DESC = NUMBER_SEGS.includes(cat)
    ? { widely: `Highest volume (${seg ? seg.popLabel : ""}).`,
        rising: cat === "etl" ? `Ranked from our research into adoption. Google searches fell for every ETL / ELT tool from ${P.short}, so the search change shown is still negative.` : `Highest growth from ${P.short}, counting only tools that grew.`,
        emerging: "" }
    : { widely: "Ranked from our research into adoption.", rising: "Ranked from our research into adoption. Tools whose downloads fell are left out.", emerging: "Ranked from our research into adoption." };
  return (
    <div className="tpg-pair">
      {["widely", "rising", "emerging"].map((k) => {
        const items = L[k];
        if (!items.length && !(k === "rising" && NUMBER_SEGS.includes(cat) && seg)) return null;
        return (
          <section className="tpg-card" key={k}>
            <h2>{`${ST_LABEL[k]}: top ${items.length || 3}`}</h2>
            <p className="tpg-sub">{DESC[k]}</p>
            {!items.length ? <p className="no-data">{`No tool rose from ${P.short}, so there is no Rising list.`}</p> : (
              <ol className="tlist">
                {items.map((x, idx) => {
                  const t = numFor(cat, x.name), S = sheetStatus(cat, x.name);
                  const note = (S && S.evidence) || x.why;
                  return (
                    <li key={x.name}>
                      <span className="hrank">{idx + 1}</span>
                      <ToolButton cat={cat} name={x.name} cls="hwho" />
                      <span className="tl-val">{t
                        ? (k === "widely" ? <><b>{popShort(seg, t.pop)}</b> <small>{cat === "etl" ? "index" : "downloads"}</small></>
                          : <><b className={t.growth >= 0 ? "up" : "down"}>{fmtPct(t.growth)}</b> <small>{`${m.lower}, ${P.short}`}</small></>)
                        : <small>No public monthly numbers</small>}</span>
                      {note && <span className="tl-note">{note}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

function StatusNotes({ cat }) {
  const seg = segFor(cat), lines = [];
  if (seg) {
    lines.push(seg.source);
    if (!NUMBER_SEGS.includes(cat) && seg.method) lines.push(seg.method);
    const { noFigure, untracked } = gapsFor(seg);
    if (noFigure.length) lines.push(`Not enough public data: ${noFigure.join(", ")}.`);
    if (untracked.length) lines.push(`Monthly trend not publicly available for ${untracked.length} tools: ${untracked.join(", ")}. Their status, evidence and rank come from our research instead.`);
  } else {
    lines.push("No tool in this segment publishes monthly download numbers, so none are shown. Status, evidence and rank come from our research into adoption.");
  }
  lines.push("How statuses are rated: " + ratedFor(cat));
  if (seg) lines.push(`${metricFor(cat).name}: ${metricFor(cat).what}`);
  lines.push("Numbers are never estimated. Where a tool has no public monthly numbers, the page says so.");
  return (
    <section className="tpg-card tpg-notes">
      <h2>About this data</h2>
      {lines.map((t, k) => <p key={k}>{t}</p>)}
    </section>
  );
}

function Body({ cat, view }) {
  const seg = segFor(cat);
  const rows = seg ? rankSeg(seg) : [];
  if (!rows.length) return <><StatusCards cat={cat} /><StatusNotes cat={cat} /></>;
  const list = view === "growth" ? byGrowth(seg) : view === "popularity" ? byPop(seg) : rows;
  const top = list.slice(0, 5);
  const gs = seg.tools.map((t) => t.growth);
  const lo = Math.min(0, ...top.map((r) => r.t.growth)), hi = Math.max(0, ...top.map((r) => r.t.growth));
  const pmax = Math.max(...top.map((r) => r.t.pop)) || 1;
  const cautions = top.map((r) => [r.t.name, noteFor(seg.cat, r.t.name)]).filter(([, n]) => n && !/^Topic:/.test(n));
  return (
    <>
      {/* 1. Bar chart for the chosen view */}
      <section className="tpg-card">
        <h2>{`${VIEW_TEXT[view][0]}: top 5`}</h2>
        <p className="tpg-sub">{viewText(view, seg) + (view === "popularity" || view === "overall" ? ` Popularity = ${seg.popLabel}${seg.cat === "etl" ? " (Fivetran = 100)" : ""}.` : "")}</p>
        {view === "overall" && <div className="hkey"><span><i className="hsw g"></i>Growth</span><span><i className="hsw p"></i>Popularity</span></div>}
        <ol className="hchart">
          {top.map((r) => (
            <li key={r.t.name} className={"hrow" + (view === "overall" ? " dual" : "")}>
              <span className="hrank">{view === "growth" ? r.gR : view === "popularity" ? r.pR : r.rank}</span>
              <ToolButton seg={seg} name={r.t.name} cls="hwho" />
              <div className="hbars" {...tipProps(() => [r.t.name, `Growth ${fmtPct(r.t.growth)} (rank #${r.gR})`, `Popularity ${popText(seg, r.t)} (rank #${r.pR})`, `Overall rank #${r.rank} of ${rows.length}`])}>
                {view !== "popularity" && <div className="htrack"><GrowthBar g={r.t.growth} lo={lo} hi={hi} /></div>}
                {view !== "growth" && <div className="htrack"><i className="hbar pop" style={{ left: 0, width: Math.max(0.6, (r.t.pop / pmax) * 100) + "%" }} /></div>}
              </div>
              <div className="hvals">
                {view !== "popularity" && <span className={r.t.growth >= 0 ? "up" : "down"}>{fmtPct(r.t.growth)}</span>}
                {view !== "growth" && <span className="">{popShort(seg, r.t.pop)}</span>}
              </div>
            </li>
          ))}
        </ol>
        {seg.cat === "etl" && view !== "popularity" && Math.max(...gs) < 0 && (
          <p className="tpg-note">{`Every ETL / ELT tool had lower search interest in ${periodOf(seg).to} than in ${periodOf(seg).from}, so the growth bars all point left of zero.`}</p>
        )}
        {cautions.length > 0 && <ul className="tpg-cautions">{cautions.map(([nm, n]) => <li key={nm}><b>{nm + ": "}</b>{n}</li>)}</ul>}
      </section>

      {/* 2. Month by month for the same five tools */}
      <section className="tpg-card">
        <h2>{`Month by month, ${periodOf(seg).label}`}</h2>
        <p className="tpg-sub">{`${seg.unit}. Each small chart has its own scale; hover a bar for the exact value.`}</p>
        <div className="mgrid">
          {top.map((r) => (
            <div className="mcell" key={r.t.name}>
              <ToolButton seg={seg} name={r.t.name} cls="mwho" />
              <div><MonthlyChart seg={seg} name={r.t.name} big /></div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Status lists: Widely used / Rising / Emerging */}
      <StatusCards cat={cat} />

      {/* 4. Data notes and gaps, stated plainly */}
      <StatusNotes cat={cat} />
    </>
  );
}

// ---------- Charts page: one page per segment, separate from the 3D page of all tools ----------
export default function ChartsPage() {
  const cat = useStore((s) => s.activeCat);
  useStore((s) => s.dataVersion);   // redraw when the latest numbers arrive
  const { open, view } = useStore((s) => s.topPage);
  const scrollRef = useRef(null);
  const backRef = useRef(null);
  const seg = segFor(cat);
  const rows = seg ? rankSeg(seg) : [];
  const c = CATEGORIES[cat];

  useLayoutEffect(() => {
    if (!open) { hideTip(); document.documentElement.style.overflow = ""; return; }
    document.documentElement.style.overflow = "hidden";
    scrollRef.current.scrollTop = 0;
    const id = setTimeout(() => backRef.current && backRef.current.focus({ preventScroll: true }), 30);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <div className="profile tpage" id="tpage" role="dialog" aria-modal="true" aria-labelledby="tpTitle" hidden={!open}>
      <div className="pf-scroll tpg-scroll" ref={scrollRef}>
        <div className="pf-bar">
          <button type="button" className="pf-btn tpg-back" ref={backRef} onClick={closeTopPage}>
            <Icon d="M15 5l-7 7 7 7" />All 3D tools
          </button>
          <nav className="tpg-cats" aria-label="Segment">
            {Object.keys(CATEGORIES).map((k) => (
              <button key={k} type="button" className="tpg-cat" data-cat={k} aria-current={String(k === cat)}
                onClick={() => { if (k === cat) return; sfx.tab(); switchCategory(k); }}>{shortLabel(k)}</button>
            ))}
          </nav>
        </div>
        <header className="tpg-head">
          <div className="eyebrow">Market trends · Researched data</div>
          <h1 id="tpTitle">{`Top 5 · ${c.label}`}</h1>
          <p className="tpg-lede">{rows.length
            ? `${seg.unit}, ${periodOf(seg).label}. ${seg.method} ${rows.length} of ${c.tools.length} tools on this page have data.`
            : "Monthly trend: not publicly available for this segment. The lists below are ranked from our research into adoption."}</p>
          <div className="tpg-views" role="radiogroup" aria-label="Rank by" hidden={!rows.length}>
            {Object.keys(VIEW_TEXT).map((v) => (
              <button key={v} type="button" role="radio" className="tpg-view" data-view={v} aria-checked={String(v === view)} onClick={() => setTopView(v)}>{VIEW_TEXT[v][0]}</button>
            ))}
          </div>
        </header>
        <div className="tpg-body">{open && <Body cat={cat} view={view} />}</div>
      </div>
    </div>
  );
}
