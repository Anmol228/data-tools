import { useEffect, useRef } from "react";
import { useStore, select, step, openProfile } from "../store.js";
import { CATEGORIES, MEDIA_BG, host, reduceMotion } from "../lib/categories.js";
import { Icon, Logo, TierBadge, Plans, RankText } from "./bits.jsx";
import { ConnCard } from "./Connectors.jsx";

// Scrolls the profile to one of its sections after the open animation.
export function scrollProfileTo(sel) {
  setTimeout(() => {
    const sec = document.querySelector("#profile " + sel);
    if (sec && !sec.hidden) sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, 450);
}

function Card({ cat, i, swap }) {
  const t = CATEGORIES[cat].tools[i];
  const [c1, c2] = MEDIA_BG[i % MEDIA_BG.length];
  const ref = useRef(null);
  const openRef = useRef(null);
  useEffect(() => {
    if (swap || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (r.bottom > innerHeight) ref.current.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, []);
  const open = () => openProfile(i, openRef.current);
  return (
    <article className={"card" + (swap ? " swap" : "")} id="card" aria-live="polite" aria-labelledby="cardTitle" ref={ref}>
      <button type="button" className="round card-x" aria-label="Close details" style={{ "--i": 0 }} onClick={() => select(-1)}>
        <Icon d="M6 6l12 12M18 6L6 18" />
      </button>
      <div className="card-head" style={{ "--i": 0 }}>
        <h2 id="cardTitle">{t.name}</h2>
      </div>
      <div className="media" style={{ "--i": 1, "--media-bg": `linear-gradient(135deg, ${c1}, ${c2})` }}>
        <button type="button" className="media-hit" aria-label={`Open the full profile for ${t.name}`} onClick={open}>
          <span className="media-logo" aria-hidden="true"><Logo cat={cat} i={i} fallback={t.code} /></span>
        </button>
        <button type="button" className="round media-open" aria-label="Open the full profile" aria-haspopup="dialog" ref={openRef} onClick={open}>
          <Icon d="M7 17L17 7M9 7h8v8" />
        </button>
      </div>
      <p className="summary" style={{ "--i": 2 }}>{t.sum}</p>
      <dl className="meta" style={{ "--i": 3 }}>
        <dt>Website</dt><dd><a target="_blank" rel="noopener" href={t.url}>{host(t.url)}</a></dd>
        <dt>Tier</dt><dd><TierBadge className="tier-badge" tier={t.tier} /></dd>
        <dt>Market rank</dt><dd className="card-rank rank-line"><RankText name={t.name} /></dd>
        <dt>Pricing</dt><dd><Plans text={t.price} /></dd>
        <dt>Source</dt><dd><a className="price-src" target="_blank" rel="noopener" href={t.priceUrl}>Official pricing page</a> <span className="src-note price-note">{"· " + (t.priceNote || "prices as listed in the sheet")}</span></dd>
      </dl>
      <ConnCard cat={cat} t={t} onMore={() => { open(); scrollProfileTo(".pf-conn"); }} />
      <div className="card-nav" style={{ "--i": 4 }}>
        <button type="button" className="btn" aria-label="Previous tool" onClick={() => select(step(i, -1))}>
          <Icon d="M15 5l-7 7 7 7" />Prev
        </button>
        <button type="button" className="btn" aria-label="Next tool" onClick={() => select(step(i, 1))}>
          Next<Icon d="M9 5l7 7-7 7" />
        </button>
        <button type="button" className="btn primary pf-link" aria-haspopup="dialog" onClick={open}>Full profile
          <Icon d="M7 17L17 7M9 7h8v8" />
        </button>
      </div>
    </article>
  );
}

// The details card under the stage. A new card animates in; moving between tools swaps it without the entrance.
export default function CardSlot() {
  const cat = useStore((s) => s.activeCat);
  const selected = useStore((s) => s.selected);
  const info = useRef({ sel: -1, swap: false });
  if (info.current.sel !== selected) info.current = { sel: selected, swap: info.current.sel >= 0 && selected >= 0 };
  const t = selected >= 0 ? CATEGORIES[cat].tools[selected] : null;
  return <div id="cardSlot">{t && <Card key={cat + ":" + selected} cat={cat} i={selected} swap={info.current.swap} />}</div>;
}
