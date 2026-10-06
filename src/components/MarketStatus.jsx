import { useStore } from "../store.js";
import { segFor, fmtPct, monthVal } from "../lib/ranking.js";
import { statusInfo, stClass, ratedParts, cap } from "../lib/status.js";

// Small Apr -> Sep line, green when Sep is above Apr.
export function Sparkline({ m }) {
  const w = 96, h = 26, max = Math.max(...m), min = Math.min(...m), span = max - min || 1;
  const pts = m.map((v, k) => [4 + (k * (w - 8)) / (m.length - 1), h - 4 - ((v - min) / span) * (h - 8)]);
  const up = m[m.length - 1] >= m[0];
  const last = pts[pts.length - 1];
  return (
    <svg className={"spark " + (up ? "up" : "down")} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join(" ")} />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.6" />
    </svg>
  );
}

function Badge({ b, label, withRank }) {
  return (
    <span className="st-line">
      <span className={stClass(b.s)}>{b.s}</span> <span className="st-basis">· {b.basis}</span>
      {withRank && b.rank ? <span className="st-rank"> · #{b.rank} {b.s} in {label}</span> : null}
    </span>
  );
}

// Market status for one tool. compact = one short line (profile facts, hover header).
export default function MarketStatus({ name, compact }) {
  const cat = useStore((s) => s.activeCat);
  const seg = segFor(cat);
  const { t, S, vr, m, badges, label, notes } = statusInfo(cat, name);
  if (compact) {
    return (
      <>
        {badges.length ? badges.map((b) => <Badge key={b.s} b={b} label={label} />)
          : t ? <span className="st-rank">#{vr.k} of {vr.n} by {m.lower}</span> : <span className="no-data">Not rated in our research</span>}
        {t ? <span className="st-rank"> · {m.short} {fmtPct(t.growth)}, Apr to Sep</span> : <span className="no-data"> · monthly numbers not publicly available</span>}
      </>
    );
  }
  return (
    <dl className="mstat">
      <dt>Status</dt>
      <dd>{badges.length ? badges.map((b) => <Badge key={b.s} b={b} label={label} withRank />)
        : t ? <span className="st-rank">#{vr.k} of {vr.n} by {m.lower} in {label}</span> : <span className="no-data">Not rated in our research</span>}</dd>
      {S && S.evidence ? <><dt>Why</dt><dd className="st-ev">{S.evidence}</dd></> : null}
      {t ? (
        <>
          <dt>{m.name}<small>Apr → Sep</small></dt>
          <dd className="mstat-trend"><Sparkline m={t.m} /><b className={t.growth >= 0 ? "up" : "down"}>{fmtPct(t.growth)}</b><span className="st-rank">{monthVal(seg, t.m[0])} → {monthVal(seg, t.m[5])}</span></dd>
          <dt></dt><dd className="st-ctx">{notes.join(" ")}</dd>
        </>
      ) : (
        <><dt>Monthly numbers</dt><dd className="no-data">Not publicly available</dd></>
      )}
    </dl>
  );
}

// "How statuses are rated": one line per status this segment shows.
export function RatedBox({ cat, className }) {
  const r = ratedParts(cat);
  return (
    <div className={className}>
      <b className="rated-h">How statuses are rated</b>
      {r.note ? <span className="rated-note"> {r.note}</span> : null}
      <ul className="rated-list">
        {r.parts.map(([k, v]) => <li key={k}><span className={stClass(k)}>{k}</span> {cap(v)}</li>)}
      </ul>
    </div>
  );
}
