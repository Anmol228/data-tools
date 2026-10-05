import { useLayoutEffect, useRef } from "react";
import { useStore, closeTopPage, setTopView, switchCategory, openTop } from "../store.js";
import { CATEGORIES } from "../lib/categories.js";
import { sfx } from "../lib/sfx.js";
import { segFor, rankSeg, byGrowth, byPop, emergingTop, fmtPct, popShort, popText, noteFor, gapsFor } from "../lib/ranking.js";
import { Icon, Logo, MonthlyChart, indexOfTool } from "./bits.jsx";
import { tipProps, hideTip } from "./Tooltip.jsx";

const VIEW_TEXT = {
  overall: ["Overall", "Average of the growth rank and the popularity rank."],
  growth: ["By growth", "Change from Apr to Sep 2026."],
  popularity: ["By popularity", "6-month volume."]
};

function ToolButton({ seg, name, cls }) {
  return (
    <button type="button" className={cls} aria-label={`${name}: open full details`} onClick={(e) => openTop(name, e.currentTarget)}>
      <span className="tg-logo" aria-hidden="true"><Logo cat={seg.cat} i={indexOfTool(seg.cat, name)} fallback={name.slice(0, 2)} /></span>
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

function ListCard({ seg, title, desc, items, valueOf, extra }) {
  return (
    <section className="tpg-card">
      <h2>{title}</h2>
      <p className="tpg-sub">{desc}</p>
      {!items.length ? <p className="no-data">No data available.</p> : (
        <>
          <ol className="tlist">
            {items.map((r, k) => {
              const note = noteFor(seg.cat, r.t.name);
              return (
                <li key={r.t.name}>
                  <span className="hrank">{k + 1}</span>
                  <ToolButton seg={seg} name={r.t.name} cls="hwho" />
                  <span className="tl-val">{valueOf(r)}</span>
                  {note && !/^Topic:/.test(note) && <span className="tl-note">{note}</span>}
                </li>
              );
            })}
          </ol>
          {extra && <p className="tpg-note">{extra}</p>}
        </>
      )}
    </section>
  );
}

function Body({ cat, view }) {
  const seg = segFor(cat);
  const rows = seg ? rankSeg(seg) : [];
  if (!rows.length) return null;
  const list = view === "growth" ? byGrowth(seg) : view === "popularity" ? byPop(seg) : rows;
  const top = list.slice(0, 5);
  const gs = seg.tools.map((t) => t.growth);
  const lo = Math.min(0, ...top.map((r) => r.t.growth)), hi = Math.max(0, ...top.map((r) => r.t.growth));
  const pmax = Math.max(...top.map((r) => r.t.pop)) || 1;
  const cautions = top.map((r) => [r.t.name, noteFor(seg.cat, r.t.name)]).filter(([, n]) => n && !/^Topic:/.test(n));
  const wide = byPop(seg).slice(0, 3);
  const emerging = emergingTop(seg);
  const { noFigure, untracked } = gapsFor(seg);
  return (
    <>
      {/* 1. Bar chart for the chosen view */}
      <section className="tpg-card">
        <h2>{`${VIEW_TEXT[view][0]}: top 5`}</h2>
        <p className="tpg-sub">{VIEW_TEXT[view][1] + (view === "popularity" || view === "overall" ? ` Popularity = ${seg.popLabel}${seg.cat === "etl" ? " (Fivetran = 100)" : ""}.` : "")}</p>
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
          <p className="tpg-note">Every ETL / ELT tool in the sheet had lower search interest in Sep than in Apr, so the growth bars all point left of zero.</p>
        )}
        {cautions.length > 0 && <ul className="tpg-cautions">{cautions.map(([nm, n]) => <li key={nm}><b>{nm + ": "}</b>{n}</li>)}</ul>}
      </section>

      {/* 2. Month by month for the same five tools */}
      <section className="tpg-card">
        <h2>Month by month, Apr to Sep 2026</h2>
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

      {/* 3. Most widely used vs emerging */}
      <div className="tpg-pair">
        <ListCard seg={seg} title="Most widely used: top 3" desc={`Highest popularity (${seg.popLabel}).`} items={wide}
          valueOf={(r) => <><b>{popShort(seg, r.t.pop)}</b> <small>{seg.cat === "etl" ? "index" : "downloads"}</small></>} />
        <ListCard seg={seg} title="Emerging: top 3" desc="Top 3 by growth rank (change from Apr to Sep 2026)." items={emerging}
          valueOf={(r) => <><b className={r.t.growth >= 0 ? "up" : "down"}>{fmtPct(r.t.growth)}</b> <small>Apr to Sep</small></>}
          extra={emerging.length && emerging.every((r) => r.t.growth < 0) ? "No tool in this segment grew, so these are the smallest declines." : ""} />
      </div>

      {/* 4. Data notes and gaps, stated plainly */}
      <section className="tpg-card tpg-notes">
        <h2>About this data</h2>
        {[seg.source,
          noFigure.length ? `Not enough data in the sheet: ${noFigure.join(", ")}.` : "",
          untracked.length ? `No data available for ${untracked.length} tools not tracked in the sheet: ${untracked.join(", ")}.` : ""
        ].filter(Boolean).map((t, k) => <p key={k}>{t}</p>)}
      </section>
    </>
  );
}

// ---------- Charts page: one page per segment, separate from the 3D page of all tools ----------
export default function ChartsPage() {
  const cat = useStore((s) => s.activeCat);
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
                onClick={() => { if (k === cat) return; sfx.tab(); switchCategory(k); }}>{CATEGORIES[k].label}</button>
            ))}
          </nav>
        </div>
        <header className="tpg-head">
          <div className="eyebrow">Market trends · Monthly sheets</div>
          <h1 id="tpTitle">{`Top 5 · ${c.label}`}</h1>
          <p className="tpg-lede">{rows.length
            ? `${seg.unit}, Apr to Sep 2026. ${seg.method} ${rows.length} of ${c.tools.length} tools on this page have data.`
            : "No market-trend data available for this segment."}</p>
          <div className="tpg-views" role="radiogroup" aria-label="Rank by">
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
