import { useSyncExternalStore } from "react";
import { CATEGORIES, catFromHash, passesTier, stepVisible } from "./lib/categories.js";
import { sfx } from "./lib/sfx.js";

// One small shared store for the whole page. React components read it with useStore();
// the 3D engine reads it with getState() and listens with subscribe().
let state = {
  activeCat: catFromHash(),
  selected: -1,            // index of the open tool on the active page, -1 = none
  tierFilter: "all",
  soundOn: true,
  profile: { open: false, index: -1, opener: null },
  trendsOpen: false,
  topPage: { open: false, view: "overall", opener: null },
  logosVersion: 0,         // bumped whenever a page's 3D textures finish loading (flat logos come from them)
  loading: { show: true, progress: 0, error: "" }
};
const listeners = new Set();
export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export function useStore(sel = (s) => s) { return useSyncExternalStore(subscribe, () => sel(state)); }

export const toolsOf = (s = state) => CATEGORIES[s.activeCat].tools;

// The 3D engine registers its own page switch (exit animation, loading) here once it is ready.
let engine = { switchCategory: null, spin: () => {}, boost: () => {} };
export function registerEngine(e) { engine = { ...engine, ...e }; }

// ---------- Actions ----------
export function setTierFilter(t, quiet) {
  if (t === state.tierFilter) return;
  const tools = toolsOf();
  const sel = state.selected >= 0 && !passesTier(tools[state.selected], t) ? -1 : state.selected;
  setState({ tierFilter: t, selected: sel });
  if (sel !== state.selected && !quiet) { /* closing is part of the filter change */ }
  if (!quiet) sfx.tab();
}

export function select(i, quiet) {
  const tools = toolsOf();
  if (i >= 0 && tools[i] && !passesTier(tools[i], state.tierFilter)) setTierFilter("all", true);
  const prev = state.selected;
  if (i === prev) return;
  if (i >= 0) { engine.spin(i); engine.boost(); }
  if (quiet) { /* page switch: no sound */ }
  else if (i >= 0 && prev < 0) sfx.open(i);
  else if (i >= 0) sfx.swap(i);
  else sfx.close();
  setState({ selected: i });
}

export const step = (from, dir) => stepVisible(toolsOf(), state.tierFilter, from, dir);

export async function switchCategory(key) {
  if (key === state.activeCat) return;
  if (engine.switchCategory) await engine.switchCategory(key);
  else changeCategory(key);
}
// Called by the engine in the middle of its switch animation (or directly when there is no 3D).
export function changeCategory(key) {
  const tools = CATEGORIES[key].tools;
  setState((s) => ({
    activeCat: key,
    selected: -1,
    trendsOpen: false,
    tierFilter: tools.some((t) => passesTier(t, s.tierFilter)) ? s.tierFilter : "all"
  }));
  try { history.replaceState(null, "", "#" + CATEGORIES[key].hash); } catch (e) { /* ignore */ }
}

export function setSound(on) { sfx.set(on); setState({ soundOn: on }); }

export function openProfile(i, opener) {
  sfx.expand();
  setState({ profile: { open: true, index: i, opener: opener || null } });
}
export function closeProfile() {
  sfx.close();
  setState((s) => ({ profile: { ...s.profile, open: false } }));
}
export function profileGo(dir) {
  const i = step(state.profile.index, dir);
  select(i);
  setState((s) => ({ profile: { ...s.profile, index: i } }));
}

export function openTrends() { setState({ trendsOpen: true }); sfx.tab(); }
export function closeTrends(quiet) {
  if (!state.trendsOpen) return;
  setState({ trendsOpen: false });
  if (!quiet) sfx.close();
}

export function openTopPage(opener) {
  closeTrends(true);
  setState((s) => ({ topPage: { ...s.topPage, open: true, opener: opener || null } }));
  sfx.expand();
}
export function closeTopPage() {
  const opener = state.topPage.opener;
  setState((s) => ({ topPage: { ...s.topPage, open: false } }));
  sfx.close();
  if (opener) opener.focus({ preventScroll: true });
}
export function setTopView(v) { setState((s) => ({ topPage: { ...s.topPage, view: v } })); sfx.tab(); }

// Clicking any ranked tool: bring it forward in 3D and open its full profile.
export function openTop(name, opener) {
  const i = toolsOf().findIndex((t) => t.name === name);
  if (i < 0) return;
  closeTrends(true);
  select(i);
  openProfile(i, opener);
}
