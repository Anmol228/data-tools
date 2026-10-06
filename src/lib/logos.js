import { CATEGORIES } from "./categories.js";
import { LOGO_OVERRIDES } from "../data.js";

// Each page's 3D tiles, filled in by the 3D engine as pages load. The flat logos used
// across the page are cut from these tiles' textures.
export const tileSets = {};

// Replacement logos supplied by the user (drawn onto the tile face at load time).
const overrideImgs = {};
export function loadOverride(name) {
  if (!LOGO_OVERRIDES[name]) return Promise.resolve(null);
  if (!overrideImgs[name]) overrideImgs[name] = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = LOGO_OVERRIDES[name]; });
  return overrideImgs[name];
}

// ---------- Logo images cut from the GLB textures (upright copy = right half of each texture) ----------
const logoCache = {};
export function logoFor(cat, i) {
  if (i < 0) return null;
  const key = CATEGORIES[cat].mesh[i];
  if (logoCache[key]) return logoCache[key];
  const set = tileSets[cat];   // never the active page's tiles mid-switch: they may belong to the previous page
  const t = set && set[i];
  const img = t && t.material.map && t.material.map.image;
  if (!img || !img.width) return null;
  const c = document.createElement("canvas");
  c.width = c.height = 384;
  const w = img.width, h = img.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 384, 384);
  // The five newer segments' models place the tile edge slightly further in, so trim a little more there.
  const trim = ["etl", "orch", "bi"].includes(cat) ? 0 : 0.02;
  ctx.drawImage(img, w * (0.5 + trim), h * (0.215 + trim), w * (0.47 - 2 * trim), h * (0.69 - 2 * trim), 34, 34, 316, 316);
  try { logoCache[key] = c.toDataURL("image/png"); } catch (err) { return null; }
  return logoCache[key];
}
