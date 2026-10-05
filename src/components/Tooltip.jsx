import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

// ---------- Shared hover tooltip for every chart ----------
let tip = null;   // { lines, el, x }
const subs = new Set();
const emit = () => subs.forEach((l) => l());
export function showTip(el, lines, e) {
  const r = el.getBoundingClientRect();
  tip = { lines, rect: r, x: e && e.clientX != null ? e.clientX : r.left + r.width / 2 };
  emit();
}
export function hideTip() { if (tip) { tip = null; emit(); } }

// Props that make any element show the tooltip; `lines` is a function returning the text lines.
export function tipProps(lines) {
  return {
    onMouseEnter: (e) => showTip(e.currentTarget, lines(), e),
    onMouseMove: (e) => showTip(e.currentTarget, lines(), e),
    onFocus: (e) => showTip(e.currentTarget, lines()),
    onMouseLeave: hideTip,
    onBlur: hideTip
  };
}

export default function Tooltip() {
  const t = useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => tip);
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !t) return;
    const tw = el.offsetWidth, th = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - tw - 8, t.x - tw / 2)) + "px";
    el.style.top = Math.max(8, t.rect.top - th - 10) + "px";
  }, [t]);
  return (
    <div className="viz-tip" role="tooltip" hidden={!t} ref={ref}>
      {t && t.lines.map((l, k) => (k ? <div key={k}>{l}</div> : <b key={k}>{l}</b>))}
    </div>
  );
}
