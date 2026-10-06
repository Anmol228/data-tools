import { useLayoutEffect, useRef, useState } from "react";
import { useStore, getState, closeProfile, profileGo, step } from "../store.js";
import { CATEGORIES, pad, host, reduceMotion } from "../lib/categories.js";
import { segFor } from "../lib/ranking.js";
import { Icon, Logo, TierBadge, Plans, MonthlyChart } from "./bits.jsx";
import MarketStatus from "./MarketStatus.jsx";
import { ConnProfile } from "./Connectors.jsx";

const insetFor = (r) => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 18px)`;
const sentences = (text) => text.split(/(?<=\.)\s+(?=[A-Z])/);

// ---------- Full profile: the peek button expands into a full-page view ----------
export default function Profile() {
  const cat = useStore((s) => s.activeCat);
  const { open, index, opener } = useStore((s) => s.profile);
  const [shown, setShown] = useState(false);
  const ref = useRef(null);
  const scrollRef = useRef(null);
  const backRef = useRef(null);

  // Opening grows the page out of the button that opened it; closing shrinks it back into the card.
  useLayoutEffect(() => {
    const el = ref.current;
    if (open) {
      setShown(true);
      el.hidden = false;
      document.documentElement.style.overflow = "hidden";
      if (!reduceMotion && opener && opener.isConnected) {
        el.classList.remove("open");
        el.style.clipPath = insetFor(opener.getBoundingClientRect());
        el.getBoundingClientRect();           // commit the start shape
        el.classList.add("open");
        el.style.clipPath = "inset(0px 0px 0px 0px round 0px)";
      } else {
        el.style.clipPath = "none";
      }
      backRef.current.focus({ preventScroll: true });
    } else if (shown) {
      const back = document.querySelector(".card .media-open");
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        el.hidden = true;
        el.classList.remove("open");
        setShown(false);
        document.documentElement.style.overflow = getState().topPage.open ? "hidden" : "";
        if (back) back.focus({ preventScroll: true });
      };
      if (!reduceMotion && back) {
        el.style.clipPath = insetFor(back.getBoundingClientRect());
        el.addEventListener("transitionend", done, { once: true });
        setTimeout(done, 700);
      } else done();
    }
  }, [open]);

  useLayoutEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [index, open]);

  const tools = CATEGORIES[cat].tools;
  const t = index >= 0 ? tools[index] : null;
  let body = null;
  if (t) {
    const parts = sentences(t.sum);
    const sections = [
      ["What it is", parts[0] || ""],
      ["What it solves", parts[1] || ""],
      ["What teams use it for", parts.slice(2).join(" ")]
    ].filter(([, b]) => b);
    const nextI = step(index, 1);
    const next = tools[nextI];
    const seg = segFor(cat);
    const hasTrend = !!(seg && seg.tools.find((x) => x.name === t.name));
    body = (
      <>
        <div className="pf-bar">
          <button type="button" className="pf-btn pf-back" ref={backRef} onClick={closeProfile}>
            <Icon d="M15 5l-7 7 7 7" />Back to stage
          </button>
          <div className="pf-bar-right">
            <span className="pf-count count">{`Tool ${pad(index + 1)} of ${pad(tools.length)}`}</span>
            <button type="button" className="pf-btn pf-icon pf-prev" aria-label="Previous tool" onClick={() => profileGo(-1)}>
              <Icon d="M15 5l-7 7 7 7" />
            </button>
            <button type="button" className="pf-btn pf-icon pf-nextbtn" aria-label="Next tool" onClick={() => profileGo(1)}>
              <Icon d="M9 5l7 7-7 7" />
            </button>
          </div>
        </div>

        <header className="pf-hero">
          <div className="pf-logo" aria-hidden="true"><Logo cat={cat} i={index} fallback={t.code} /></div>
          <div className="pf-head">
            <span className="chip pf-chip">{t.cat}</span>
            <h1 id="profileTitle">{t.name}</h1>
            <p className="pf-lede">{parts[0] || t.sum}</p>
            <a className="pf-site" target="_blank" rel="noopener" href={t.url}>
              <span>{`Visit ${host(t.url)}`}</span><Icon d="M7 17L17 7M9 7h8v8" />
            </a>
          </div>
        </header>

        <div className="pf-sections">
          {sections.map(([title, b]) => <section className="pf-section" key={title}><h2>{title}</h2><p>{b}</p></section>)}
        </div>

        <section className="pf-pricing pf-trend" aria-labelledby="pfTrendTitle">
          <div className="pf-pricing-head">
            <h2 id="pfTrendTitle">Market status and trend, Apr to Sep 2026</h2>
            <span className="src-note pf-trend-rank"></span>
          </div>
          <div className="pf-trend-chart"><div className="pf-status"><MarketStatus name={t.name} /></div>{hasTrend && <MonthlyChart seg={seg} name={t.name} big />}</div>
          <p className="src-note pf-trend-src" style={{ margin: 0 }}>{hasTrend ? `${seg.unit}. ${seg.source}` : ""}</p>
        </section>

        <ConnProfile cat={cat} t={t} />
        <section className="pf-pricing" aria-labelledby="pfPricingTitle">
          <div className="pf-pricing-head">
            <h2 id="pfPricingTitle">Plans and pricing</h2>
            <TierBadge className="tier-badge pf-tier" tier={t.tier} />
          </div>
          <Plans className="plans pf-plans" text={t.price} />
          <p className="src-note" style={{ margin: 0 }}><span className="pf-price-note">{t.priceNote ? t.priceNote + "." : "Prices from our research."}</span> Check the <a className="pf-price-src" target="_blank" rel="noopener" href={t.priceUrl}>official pricing page</a> for current rates.</p>
        </section>

        <dl className="pf-facts">
          <div><dt>Category</dt><dd className="pf-cat">{t.cat}</dd></div>
          <div><dt>Website</dt><dd><a className="pf-fact-site" target="_blank" rel="noopener" href={t.url}>{host(t.url)}</a></dd></div>
          <div><dt>Tier</dt><dd className="pf-tier-text">{t.tier}</dd></div>
          <div><dt>Market status</dt><dd className="pf-rank"><MarketStatus name={t.name} compact /></dd></div>
        </dl>

        <button type="button" className="pf-next" onClick={() => profileGo(1)}>
          <span className="pf-next-logo" aria-hidden="true"><Logo cat={cat} i={nextI} fallback={next.code} /></span>
          <span className="pf-next-text"><span className="pf-next-kicker">Next tool</span><span className="pf-next-name">{next.name}</span></span>
          <Icon d="M9 5l7 7-7 7" />
        </button>
      </>
    );
  }
  return (
    <div className="profile" id="profile" role="dialog" aria-modal="true" aria-labelledby="profileTitle" hidden ref={ref}>
      <div className="pf-scroll" ref={scrollRef}>{body}</div>
    </div>
  );
}
