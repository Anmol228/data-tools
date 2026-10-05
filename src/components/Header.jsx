import { useEffect, useRef, useState } from "react";
import { useStore, switchCategory } from "../store.js";
import { CATEGORIES, reduceMotion } from "../lib/categories.js";
import { sfx } from "../lib/sfx.js";
import { Icon } from "./bits.jsx";
import ViewsPill from "./ViewsPill.jsx";

const TAB_ICONS = {
  etl: <Icon d={["M4 7h11M12 4l3 3-3 3", "M20 17H9M12 14l-3 3 3 3"]} />,
  orch: <Icon><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.5 6h7M7.3 8.2l3.5 7.6M16.7 8.2l-3.5 7.6" /></Icon>,
  bi: <Icon d={["M4 20h16", "M7 16v-5M12 16V6M17 16v-8"]} />
};

export default function Header() {
  const activeCat = useStore((s) => s.activeCat);
  const [shown, setShown] = useState(activeCat);       // title text fades out, swaps, fades back in
  const [swapping, setSwapping] = useState(false);
  const [pending, setPending] = useState(null);         // the clicked tab lights up at once
  const tabRefs = useRef({});

  useEffect(() => {
    setPending(null);
    if (activeCat === shown) return;
    setSwapping(true);
    const id = setTimeout(() => { setShown(activeCat); setSwapping(false); document.title = "Data Sector Tools"; }, reduceMotion ? 0 : 220);
    return () => clearTimeout(id);
  }, [activeCat]);

  const current = pending || activeCat;
  const keys = Object.keys(CATEGORIES);
  const choose = (k) => {
    if (k === activeCat) return;
    setPending(k);
    sfx.tab();
    switchCategory(k);
  };
  const onKey = (e, k) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = keys[(keys.indexOf(k) + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
    tabRefs.current[next].focus();
    choose(next);
  };

  return (
    <header className={swapping ? "swapping" : undefined}>
      <ViewsPill />
      <div>
        <div className="eyebrow" id="pageEyebrow">{CATEGORIES[shown].eyebrow}</div>
        <h1 id="pageTitle">{CATEGORIES[shown].title}</h1>
      </div>
      <nav className="cat-nav" role="tablist" aria-label="Tool categories">
        <span className="nav-logo" aria-hidden="true">
          <Icon d={["M12 3l8 4.5-8 4.5-8-4.5z", "M4 12l8 4.5 8-4.5", "M4 16.5L12 21l8-4.5"]} />
        </span>
        {keys.map((k) => (
          <button key={k} type="button" role="tab" className="tab" id={"tab-" + k} data-cat={k} aria-selected={String(k === current)}
            ref={(el) => { tabRefs.current[k] = el; }} onClick={() => choose(k)} onKeyDown={(e) => onKey(e, k)}>
            {TAB_ICONS[k]}
            <span>{CATEGORIES[k].label}</span><span className="tab-count">{CATEGORIES[k].tools.length}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
