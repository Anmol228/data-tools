import { useEffect, useRef } from "react";
import { useStore, setTierFilter, setSound } from "../store.js";
import { CATEGORIES } from "../lib/categories.js";
import { initStage } from "../three/stageEngine.js";

const TIERS = [["all", "All", null], ["Free", "Free", "free"], ["Free + Paid", "Free + Paid", "fp"], ["Paid", "Paid", "paid"]];

// The 3D stage. React draws the controls on top; the three.js engine owns the canvas.
export default function Stage() {
  const stageRef = useRef(null);
  const labelRef = useRef(null);
  const soundOn = useStore((s) => s.soundOn);
  const tierFilter = useStore((s) => s.tierFilter);
  const loading = useStore((s) => s.loading);
  const tools = CATEGORIES[useStore((s) => s.activeCat)].tools;

  useEffect(() => initStage(stageRef.current, labelRef.current), []);

  return (
    <section className="stage" id="stage" tabIndex={0} ref={stageRef}
      aria-label="3D stage with selectable tool logos. Use left and right arrows to move, Enter to open the centre logo.">
      <button type="button" className="sound-btn" id="soundBtn" aria-pressed={String(soundOn)}
        aria-label={soundOn ? "Sound on. Turn sound off" : "Sound off. Turn sound on"} onClick={() => setSound(!soundOn)}>
        <span className="bars" aria-hidden="true"><i></i><i></i><i></i></span><span className="sound-text">{soundOn ? "Sound on" : "Sound off"}</span>
      </button>
      <div className="tier-filter" id="tierFilter" role="radiogroup" aria-label="Show tools by tier">
        {TIERS.map(([t, label, dot]) => {
          const n = t === "all" ? tools.length : tools.filter((x) => x.tier === t).length;
          return (
            <button key={t} type="button" role="radio" data-tier={t} disabled={n === 0} aria-checked={String(t === tierFilter)} onClick={() => setTierFilter(t)}>
              {dot && <i className={"tf-dot " + dot}></i>}{label} <span className="tf-n">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="hover-label" id="hoverLabel" aria-hidden="true" ref={labelRef}><span className="hl-name"></span><small>Click to open</small></div>
      <div className="status" id="status" role="status" aria-label="Loading" hidden={!loading.show}>
        {loading.error ? loading.error : (
          <div className="loader">
            <div className="loader-mark">
              <svg className="loader-ring" viewBox="0 0 112 112" aria-hidden="true">
                <defs><linearGradient id="loaderGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b8cff" /><stop offset="0.5" stopColor="#b48cff" /><stop offset="1" stopColor="#ff7eb6" /></linearGradient></defs>
                <circle className="track" cx="56" cy="56" r="52" />
                <circle className="fill" id="loaderFill" cx="56" cy="56" r="52" style={{ strokeDashoffset: String(327 * (1 - loading.progress)) }} />
              </svg>
              <div className="loader-tile" aria-hidden="true"><span>
                <svg viewBox="0 0 24 24"><path d="M12 3l8 4.5-8 4.5-8-4.5z" /><path d="M4 12l8 4.5 8-4.5" /><path d="M4 16.5L12 21l8-4.5" /></svg>
              </span></div>
            </div>
            <div className="loader-pct" id="loaderPct">{Math.round(loading.progress * 100) + "%"}</div>
          </div>
        )}
      </div>
    </section>
  );
}
