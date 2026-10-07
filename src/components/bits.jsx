import { useStore, getState } from "../store.js";
import { CATEGORIES } from "../lib/categories.js";
import { logoFor } from "../lib/logos.js";
import { fmtPct, noDataText, monthVal, periodOf } from "../lib/ranking.js";
import { tipProps } from "./Tooltip.jsx";

// Small shared pieces used by the card, the profile, the trends section and the charts page.

export function Icon({ d, className = "icon", children }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {children || (Array.isArray(d) ? d.map((p, k) => <path key={k} d={p} />) : <path d={d} />)}
    </svg>
  );
}

// Flat logo cut from the tile texture; shows `fallback` text until the 3D textures have loaded.
export function Logo({ cat, i, fallback }) {
  useStore((s) => s.logosVersion);
  const url = i >= 0 ? logoFor(cat, i) : null;
  return url ? <img src={url} alt="" /> : <>{fallback}</>;
}

export function TierBadge({ tier, className = "" }) {
  return <span className={`${className} ${/free/i.test(tier) ? "fp" : "paid"}`.trim()}>{tier}</span>;
}

function parsePlans(text) {
  return text.split(/\.\s+(?=[A-Z])/).map((seg) => seg.replace(/\.$/, "").trim()).filter(Boolean).map((seg) => {
    const k = seg.indexOf(": ");
    return k > 0 ? { plan: seg.slice(0, k), price: seg.slice(k + 2) } : { plan: "", price: seg };
  });
}
export function Plans({ text, className = "plans" }) {
  return (
    <ul className={className}>
      {parsePlans(text).map(({ plan, price }, k) => (
        <li key={k}>
          {plan && <span className="plan-name">{plan}</span>}
          <span className={"plan-price" + (/^free\b/i.test(price) ? " free" : "")}>{price}</span>
        </li>
      ))}
    </ul>
  );
}


// Monthly bar chart for one tool (charts page, hover card and profile).
export function MonthlyChart({ seg, name, big }) {
  const t = seg && seg.tools.find((x) => x.name === name);
  if (!t) return <p className="no-data viz-empty">{noDataText(seg, name)}</p>;
  const max = Math.max(...t.m) || 1;
  return (
    <>
      <div className={"mbars" + (big ? " big" : "")} role="img"
        aria-label={`${name}, ${seg.unit}: ` + t.m.map((v, k) => `${seg.months[k]} ${monthVal(seg, v)}`).join(", ")}>
        {t.m.map((v, k) => (
          <div className="mcol" key={k}>
            <span className={"mbar" + (k === t.m.length - 1 ? " last" : "")} style={{ height: Math.max(2, (v / max) * 100) + "%" }}
              tabIndex={big ? 0 : -1}
              {...tipProps(() => [`${seg.months[k]} ${periodOf(seg).yearOf(k)}`, `${monthVal(seg, v)} ${seg.cat === "etl" ? "search index" : "downloads"}`,
                k ? `${fmtPct(v / t.m[k - 1] - 1)} vs ${seg.months[k - 1]}` : "First month in the data"])} />
            <span className="mlab">{seg.months[k]}</span>
          </div>
        ))}
      </div>
      {big && (
        <div className="mvals">
          <span>{seg.months[0]} <b>{monthVal(seg, t.m[0])}</b></span><span>{seg.months[5]} <b>{monthVal(seg, t.m[5])}</b></span>
          <span>Change <b className={t.growth >= 0 ? "up" : "down"}>{fmtPct(t.growth)}</b></span>
        </div>
      )}
    </>
  );
}

export const indexOfTool = (cat, name) => CATEGORIES[cat].tools.findIndex((t) => t.name === name);
export const activeTools = () => CATEGORIES[getState().activeCat].tools;
