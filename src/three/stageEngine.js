import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CATEGORIES, reduceMotion, passesTier as passes, visibleList as visibleOf } from "../lib/categories.js";
import { tileSets, loadOverride } from "../lib/logos.js";
import { sfx } from "../lib/sfx.js";
import { getState, setState, subscribe, select, step, changeCategory, registerEngine } from "../store.js";

// ---------- The 3D stage (three.js), unchanged from the original page ----------
// React mounts this once into the stage element. It reads the shared store (page, selection,
// tier filter) and reports back through store actions (select, page change, loading progress).
export function initStage(stage, hoverLabel) {
  const ac = new AbortController();
  const signal = ac.signal;
  const on = (el, ev, fn, o = {}) => el.addEventListener(ev, fn, { ...o, signal });
  let TOOLS = CATEGORIES[getState().activeCat].tools;
  let selected = getState().selected;
  let tierFilter = getState().tierFilter;
  let hovered = -1;
  let lightBoost = 0;
  let tiles = [];     // the active page's tiles: { group, mesh, material, label, x, y, z, rotY, scale, opacity, spin }
  const unsub = subscribe(() => {
    const s = getState();
    if (s.tierFilter !== tierFilter) hovered = -1;
    selected = s.selected; tierFilter = s.tierFilter;
    TOOLS = CATEGORIES[s.activeCat].tools;
  });
  const passesTier = (t) => passes(t, tierFilter);
  const visibleList = () => visibleOf(TOOLS, tierFilter);
  const setLoad = (f) => setState((s) => ({ loading: { ...s.loading, progress: Math.max(0, Math.min(1, f || 0)) } }));
  const showStatus = (show) => setState((s) => ({ loading: { ...s.loading, show, error: show ? s.loading.error : "" } }));
  const showError = (msg) => setState({ loading: { show: true, progress: 0, error: msg } });
  const logosReady = () => setTimeout(() => setState((s) => ({ logosVersion: s.logosVersion + 1 })), 0);
  registerEngine({
    spin: (i) => { if (tiles[i]) tiles[i].spin = Math.PI * 2; },
    boost: () => { lightBoost = 1; }
  });

  // Transparent canvas: the bright animated gradient behind it (CSS) shows through.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(26, 2, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 0.62, 0);

  // Lights: soft white fill plus coloured rims that tint the glass edges.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3e8ff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(2.5, 7, 5);
  scene.add(key);
  const rimCool = new THREE.PointLight(0x5aa9ff, 0.9, 30);
  rimCool.position.set(-6, 3, -1.5);
  const rimWarm = new THREE.PointLight(0xff7eb6, 0.75, 30);
  rimWarm.position.set(6, 2.6, -1.5);
  scene.add(rimCool, rimWarm);
  // Fill from below and both sides so the lower and side bevels catch light like the top edge.
  const under = new THREE.DirectionalLight(0xffffff, 0.45);
  under.position.set(0, -6, 4);
  const sideL = new THREE.DirectionalLight(0xdfe8ff, 0.3);
  sideL.position.set(-6, 0.5, 3);
  const sideR = new THREE.DirectionalLight(0xffe6f2, 0.3);
  sideR.position.set(6, 0.5, 3);
  scene.add(under, sideL, sideR);

  // ---------- Rising lights: soft coloured glows floating upward behind the logos ----------
  function glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const GLOW = glowTexture();
  const LIGHT_COLORS = [0x3b82f6, 0x8b5cf6, 0xec4899, 0xf59e0b, 0x10b981, 0x06b6d4].map((h) => new THREE.Color(h));
  const Y_MIN = -2.6, Y_MAX = 4.4;
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  const lights = [];
  for (let k = 0; k < 70; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color: LIGHT_COLORS[k % LIGHT_COLORS.length], transparent: true, depthWrite: false, opacity: 0.8
    }));
    const size = rnd(0.12, 0.55);
    sp.scale.setScalar(size);
    const l = { sp, size, x: rnd(-9, 9), y: rnd(Y_MIN, Y_MAX), z: rnd(-7, -1.2), speed: rnd(0.12, 0.42), sway: rnd(0.05, 0.25), phase: rnd(0, Math.PI * 2) };
    sp.position.set(l.x, l.y, l.z);
    scene.add(sp);
    lights.push(l);
  }

  // ---------- Name labels under each logo ----------
  function makeLabel(text, tier) {
    const c = document.createElement("canvas");
    c.width = 640; c.height = 200;
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    function paint() {
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      // Split long names onto two lines, shrinking the type until both fit.
      const words = text.split(" ");
      let size = 46, lines = [text];
      const fits = () => lines.every((ln) => g.measureText(ln).width <= 560);
      for (; size >= 28; size -= 2) {
        g.font = `600 ${size}px "Instrument Sans", "Segoe UI", system-ui, sans-serif`;
        lines = [text];
        if (fits()) break;
        let best = null;
        for (let k = 1; k < words.length; k++) {
          const cand = [words.slice(0, k).join(" "), words.slice(k).join(" ")];
          const w = Math.max(g.measureText(cand[0]).width, g.measureText(cand[1]).width);
          if (!best || w < best.w) best = { cand, w };
        }
        if (best) { lines = best.cand; if (fits()) break; }
      }
      const lh = size * 1.18;
      const textW = Math.max(...lines.map((ln) => g.measureText(ln).width));
      const tierH = tier ? 34 : 0;
      const boxW = Math.max(textW, 150) + 56, boxH = lh * lines.length + 26 + tierH;
      const x0 = (c.width - boxW) / 2, y0 = (c.height - boxH) / 2, r = Math.min(30, boxH / 2);
      pillW = boxW / c.width * 1.36; pillH = boxH / c.height * 0.425;
      g.fillStyle = "#1f221d";
      g.textAlign = "center"; g.textBaseline = "middle";
      const top = c.height / 2 - tierH / 2;
      lines.forEach((ln, k) => g.fillText(ln, c.width / 2, top + (k - (lines.length - 1) / 2) * lh));
      if (tier) {
        g.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
        g.fillStyle = /free/i.test(tier) ? "#0b6b47" : "#9a4507";
        g.fillText("● " + tier.toUpperCase(), c.width / 2, top + (lines.length * lh) / 2 + 22);
      }
      tex.needsUpdate = true;
    }
    // Glass pill behind the text: a rounded, bevelled slab with a clear-coat finish.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
      reflectivity: 0.7, envMapIntensity: 1.3, transparent: true, opacity: 0, depthWrite: false
    });
    const glass = new THREE.Mesh(new THREE.BufferGeometry(), glassMat);
    function buildPill() {
      const w = pillW, h = pillH, r = Math.min(h / 2, 0.11), d = 0.035, bv = 0.018;
      const sh = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
      sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
      sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 4, curveSegments: 10 });
      geo.translate(0, 0, -d - bv);
      glass.geometry.dispose();
      glass.geometry = geo;
    }
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
    const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.425), textMat);
    textMesh.position.z = 0.012;
    let pillW = 0.6, pillH = 0.2;
    paint(); buildPill();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paint(); buildPill(); });
    const group = new THREE.Group();
    group.add(glass, textMesh);
    group.userData = { glassMat, textMat };
    scene.add(group);
    return group;
  }

  // Glowing glass outline that wraps all four sides of the hovered (or open) logo,
  // with a band of light travelling around the border.
  const RING_W = 384, RING_H = 376;           // canvas size; plane is 1.5 x 1.47 units, tile ~1 x 0.97
  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = RING_W; ringCanvas.height = RING_H;
  const rctx = ringCanvas.getContext("2d");
  const ringTex = new THREE.CanvasTexture(ringCanvas);
  ringTex.encoding = THREE.sRGBEncoding;
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.47),
    new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0 })
  );
  ring.position.set(0, -0.005, 0.07);
  ring.renderOrder = 5;
  let ringHost = null;
  function paintRing(angle) {
    const g = rctx;
    g.clearRect(0, 0, RING_W, RING_H);
    const x = 62, y = 62, w = RING_W - 124, h = RING_H - 124, r = 58;
    const path = () => {
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, r);
      else {
        g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
    };
    // Soft white glass edge, even on all sides.
    g.save();
    g.shadowColor = "rgba(255,255,255,0.95)"; g.shadowBlur = 16;
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 5;
    path(); g.stroke();
    g.restore();
    // Travelling band of colour.
    let grad;
    if (g.createConicGradient) {
      grad = g.createConicGradient(angle, RING_W / 2, RING_H / 2);
      grad.addColorStop(0.00, "rgba(91,140,255,0)");
      grad.addColorStop(0.10, "rgba(91,140,255,0.95)");
      grad.addColorStop(0.20, "rgba(255,255,255,1)");
      grad.addColorStop(0.30, "rgba(255,126,182,0.95)");
      grad.addColorStop(0.42, "rgba(255,126,182,0)");
      grad.addColorStop(0.55, "rgba(91,140,255,0)");
      grad.addColorStop(0.65, "rgba(91,140,255,0.8)");
      grad.addColorStop(0.75, "rgba(255,200,120,0.85)");
      grad.addColorStop(0.86, "rgba(255,200,120,0)");
      grad.addColorStop(1.00, "rgba(91,140,255,0)");
    } else {
      grad = g.createLinearGradient(0, 0, RING_W, RING_H);
      grad.addColorStop(0, "#5b8cff"); grad.addColorStop(0.5, "#ffffff"); grad.addColorStop(1, "#ff7eb6");
    }
    g.save();
    g.shadowColor = "rgba(140,160,255,0.9)"; g.shadowBlur = 22;
    g.strokeStyle = grad; g.lineWidth = 7;
    path(); g.stroke();
    g.restore();
    ringTex.needsUpdate = true;
  }
  paintRing(0);

  // Halo behind the selected logo.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 256;
  const gl2 = glowCanvas.getContext("2d");
  const rg = gl2.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  rg.addColorStop(0.35, "rgba(255, 170, 215, 0.55)");
  rg.addColorStop(0.7, "rgba(120, 170, 255, 0.25)");
  rg.addColorStop(1, "rgba(120, 170, 255, 0)");
  gl2.fillStyle = rg; gl2.fillRect(0, 0, 256, 256);
  const selGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, opacity: 0 })
  );
  scene.add(selGlow);

  // ---------- Load both GLB files ----------
  // Each model is read as raw bytes: the plain .glb when it sits next to this page,
  // otherwise a base64 text copy (<name>.b64.txt) for hosts that can't serve .glb files.
  const loader = new GLTFLoader();
  const meshes = {};
  let progress = [0];
  const showProgress = () => setLoad(progress.reduce((a, b) => a + b, 0) / progress.length);

  async function readWithProgress(res, k) {
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !total) { progress[k] = 1; showProgress(); return new Uint8Array(await res.arrayBuffer()); }
    const reader = res.body.getReader();
    const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      progress[k] = Math.min(1, got / total); showProgress();
    }
    const out = new Uint8Array(got); let pos = 0;
    parts.forEach((p) => { out.set(p, pos); pos += p.length; });
    return out;
  }

  async function loadModel(file, k) {
    let bytes;
    const glb = await fetch(file).catch(() => null);
    if (glb && glb.ok) {
      bytes = await readWithProgress(glb, k);
    } else {
      // One text copy, or for very large models several numbered parts joined back together.
      let b64 = "";
      const txt = await fetch(file + ".b64.txt").catch(() => null);
      if (txt && txt.ok) {
        b64 = new TextDecoder().decode(await readWithProgress(txt, k));
      } else {
        for (let part = 1; ; part++) {
          const r = await fetch(`${file}.b64.${part}.txt`).catch(() => null);
          if (!r || !r.ok) break;
          b64 += new TextDecoder().decode(await readWithProgress(r, k));
        }
        if (!b64) throw new Error("missing " + file);
      }
      b64 = b64.replace(/\s+/g, "");
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    }
    const gltf = await new Promise((resolve, reject) => loader.parse(bytes.buffer, "", resolve, reject));
    gltf.scene.traverse((o) => { if (o.isMesh) meshes[o.name] = o; });
  }

  // Logo textures arrive at up to 2048px; 1024px is plenty on screen and uses a quarter of the memory.
  const mapCache = {};
  function smallMap(key, tex) {
    if (mapCache[key]) return mapCache[key];
    const img = tex && tex.image;
    if (!img || !img.width || img.width <= 1024) return (mapCache[key] = tex);
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    c.getContext("2d").drawImage(img, 0, 0, 1024, 1024);
    const t = new THREE.CanvasTexture(c);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.dispose();
    return (mapCache[key] = t);
  }

  // Paints a replacement logo onto the tile's front face. The face shows the texture region
  // (0.5w, 0.215h, 0.47w, 0.69h) stretched to a square, so the logo is drawn square first and then
  // stretched into that region, which makes it look right on the tile.
  function overrideMap(key, tex, logo) {
    const ck = key + "#override";
    if (mapCache[ck]) return mapCache[ck];
    const img = tex && tex.image;
    if (!img || !img.width) return tex;
    const W = img.width, H = img.height;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, W, H);
    const sq = document.createElement("canvas"); sq.width = sq.height = 512;
    const q = sq.getContext("2d");
    const pad = 70, box = 512 - pad * 2;
    const k = Math.min(box / logo.width, box / logo.height);
    const lw = logo.width * k, lh = logo.height * k;
    q.drawImage(logo, (512 - lw) / 2, (512 - lh) / 2, lw, lh);
    const inset = 0.035;
    g.fillStyle = "#ffffff";
    // Right half: the copy the flat icons are cut from (upright).
    { const rx = W * 0.5, ry = H * 0.215, rw = W * 0.47, rh = H * 0.69;
      g.fillRect(rx + rw * inset, ry + rh * inset, rw * (1 - 2 * inset), rh * (1 - 2 * inset));
      g.drawImage(sq, rx, ry, rw, rh); }
    // The visible (left) copy is rebuilt from this one by faceMap, lined up with the tile's geometry.
    const t = new THREE.CanvasTexture(c);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return (mapCache[ck] = t);
  }

  // ---------- Clean the logo face ----------
  // In every tile model a few small triangles on the front face point at the wrong part of the
  // texture (the bevel strip and stray marks), which shows up as little hearts, ticks and flecks
  // on the logo. The front face's texture coordinates are a flat projection of its x/y position,
  // so fit that projection from the triangles that are right and recompute it for the ones that
  // are not. Wrong triangles get their own copies of their corners, so the rest of the mesh,
  // including the smooth bevel shading, is untouched.
  function fixFaceUVs(geo) {
    const pos = geo.attributes.position, uv = geo.attributes.uv, index = geo.index;
    if (!uv || !index) return geo;
    geo.computeBoundingBox();
    const zTop = geo.boundingBox.max.z;
    const tri = index.array, nTri = tri.length / 3;
    const isFront = new Uint8Array(nTri);
    const S = [0, 0, 0, 0, 0, 0, 0, 0, 0], Bu = [0, 0, 0], Bv = [0, 0, 0];
    const at = (k) => [pos.getX(k), pos.getY(k), pos.getZ(k)];
    for (let t = 0; t < nTri; t++) {
      const a = at(tri[3 * t]), b = at(tri[3 * t + 1]), c = at(tri[3 * t + 2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      if (nz / len < 0.9 || (a[2] + b[2] + c[2]) / 3 < zTop - 0.03) continue;
      isFront[t] = 1;
      let cu = 0, cv = 0;
      for (let j = 0; j < 3; j++) { cu += uv.getX(tri[3 * t + j]); cv += uv.getY(tri[3 * t + j]); }
      cu /= 3; cv /= 3;
      if (cu < 0.03 || cu > 0.46 || cv < 0.28 || cv > 0.93) continue;   // only clearly-inside triangles train the fit
      for (let j = 0; j < 3; j++) {
        const k = tri[3 * t + j], x = pos.getX(k), y = pos.getY(k), r = [x, y, 1];
        for (let m = 0; m < 3; m++) { for (let n = 0; n < 3; n++) S[m * 3 + n] += r[m] * r[n]; Bu[m] += r[m] * uv.getX(k); Bv[m] += r[m] * uv.getY(k); }
      }
    }
    const solve = (A, B) => {
      const M = [[A[0], A[1], A[2], B[0]], [A[3], A[4], A[5], B[1]], [A[6], A[7], A[8], B[2]]];
      for (let i = 0; i < 3; i++) {
        let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
        [M[i], M[p]] = [M[p], M[i]];
        if (Math.abs(M[i][i]) < 1e-12) return null;
        for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]; }
      }
      return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
    };
    const fu = solve(S, Bu), fv = solve(S, Bv);
    if (!fu || !fv) return geo;
    // Back face (the upright copy the flat icons use): same fit, for rebuilding the front texture.
    const zBot = geo.boundingBox.min.z;
    const S2 = [0, 0, 0, 0, 0, 0, 0, 0, 0], Bu2 = [0, 0, 0], Bv2 = [0, 0, 0];
    for (let t = 0; t < nTri; t++) {
      const a = at(tri[3 * t]), b = at(tri[3 * t + 1]), c = at(tri[3 * t + 2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nz = ux * vy - uy * vx, len = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nz) || 1;
      if (nz / len > -0.9 || (a[2] + b[2] + c[2]) / 3 > zBot + 0.03) continue;
      let cu = 0, cv = 0;
      for (let j = 0; j < 3; j++) { cu += uv.getX(tri[3 * t + j]); cv += uv.getY(tri[3 * t + j]); }
      cu /= 3; cv /= 3;
      if (cu < 0.54 || cu > 0.95 || cv < 0.25 || cv > 0.88) continue;
      for (let j = 0; j < 3; j++) {
        const k = tri[3 * t + j], r = [pos.getX(k), pos.getY(k), 1];
        for (let m = 0; m < 3; m++) { for (let n = 0; n < 3; n++) S2[m * 3 + n] += r[m] * r[n]; Bu2[m] += r[m] * uv.getX(k); Bv2[m] += r[m] * uv.getY(k); }
      }
    }
    const bu = solve(S2, Bu2), bv = solve(S2, Bv2);
    const fits = { front: [fu, fv], back: bu && bv ? [bu, bv] : null };
    geo.userData.fits = fits;
    const predict = (k) => [fu[0] * pos.getX(k) + fu[1] * pos.getY(k) + fu[2], fv[0] * pos.getX(k) + fv[1] * pos.getY(k) + fv[2]];
    const bad = [];
    for (let t = 0; t < nTri; t++) {
      if (!isFront[t]) continue;
      for (let j = 0; j < 3; j++) {
        const k = tri[3 * t + j], [pu, pv] = predict(k);
        if (Math.abs(pu - uv.getX(k)) > 0.012 || Math.abs(pv - uv.getY(k)) > 0.012) { bad.push(t); break; }
      }
    }
    if (!bad.length) return geo;
    const nOld = pos.count, nNew = nOld + bad.length * 3;
    const out = new THREE.BufferGeometry();
    for (const name in geo.attributes) {
      const src = geo.attributes[name], size = src.itemSize;
      const arr = new Float32Array(nNew * size);
      for (let k = 0; k < nOld; k++) for (let c = 0; c < size; c++) arr[k * size + c] = src.getComponent ? src.getComponent(k, c) : src.array[k * size + c];
      out.setAttribute(name, new THREE.BufferAttribute(arr, size, src.normalized));
    }
    const newIndex = (nNew > 65535 ? Uint32Array : Uint16Array).from(tri);
    const outUV = out.attributes.uv;
    bad.forEach((t, b) => {
      for (let j = 0; j < 3; j++) {
        const k = tri[3 * t + j], nk = nOld + b * 3 + j;
        for (const name in out.attributes) {
          const A = out.attributes[name], size = A.itemSize;
          for (let c = 0; c < size; c++) A.array[nk * size + c] = A.array[k * size + c];
        }
        const [pu, pv] = predict(k);
        outUV.setXY(nk, pu, pv);
        newIndex[3 * t + j] = nk;
      }
    });
    out.setIndex(new THREE.BufferAttribute(newIndex, 1));
    out.userData.fixedTriangles = bad.length;
    out.userData.fits = fits;
    return out;
  }

  // Rebuilds the visible face of a tile from the clean upright copy of the logo in the same texture.
  // Both faces' texture coordinates are flat projections of x/y (fitted in fixFaceUVs), so one affine
  // transform maps the upright copy onto the visible face exactly. The back copy is drawn for a viewer
  // behind the tile, so it is mirrored left to right relative to the front (checked on every tile).
  function faceMap(key, tex, fits) {
    const ck = key + "#face";
    if (mapCache[ck]) return mapCache[ck];
    const img = tex && tex.image;
    if (!img || !img.width || !fits || !fits.back) return tex;
    const W = img.width, H = img.height;
    const aff = ([fu, fv]) => [W * fu[0], H * fv[0], W * fu[1], H * fv[1], W * fu[2], H * fv[2]];   // object x/y -> pixels
    const inv = ([a, b, c, d, e, f]) => { const det = a * d - b * c; return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]; };
    const mul = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
    const F = aff(fits.front), Bi = inv(aff(fits.back));
    const R = 0.4;   // rebuild the face inside x, y in [-0.4, 0.4]: the whole logo area, clear of the rounded edge
    const corners = [[-R, -R], [R, -R], [R, R], [-R, R]].map(([x, y]) => [F[0] * x + F[2] * y + F[4], F[1] * x + F[3] * y + F[5]]);
    const draw = (mirror) => {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, W, H);
      g.save();
      g.beginPath(); corners.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
      const M = mul(F, mul(mirror ? [-1, 0, 0, 1, 0, 0] : [1, 0, 0, 1, 0, 0], Bi));
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      g.drawImage(img, 0, 0, W, H);
      g.restore();
      return c;
    };
    const out = draw(true);
    const t = new THREE.CanvasTexture(out);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return (mapCache[ck] = t);
  }

  async function buildCategory(key) {
    if (tileSets[key]) return tileSets[key];
    const cat = CATEGORIES[key];
    progress = cat.files.map(() => 0); showProgress();
    await Promise.all(cat.files.map(loadModel));
    const overrides = {};
    await Promise.all(cat.tools.map(async (t) => { const im = await loadOverride(t.name); if (im) overrides[t.name] = im; }));
    const set = [];
    cat.tools.forEach((t, i) => {
      const meshName = cat.mesh[i];
      const src = meshes[meshName] || meshes[meshName.replace(/_/g, " ")];
      if (!src) return;
      // Glass finish: keep the baked logo texture, add clearcoat and environment reflections.
      if (!src.geometry.attributes.normal) src.geometry.computeVertexNormals();   // the GLB ships without normals
      const geometry = fixFaceUVs(src.geometry);
      const baseMap = overrides[t.name] ? overrideMap(meshName, smallMap(meshName, src.material.map), overrides[t.name]) : smallMap(meshName, src.material.map);
      const material = new THREE.MeshPhysicalMaterial({
        map: faceMap(meshName, baseMap, geometry.userData.fits),
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        reflectivity: 0.6,
        envMapIntensity: 0.55,
        transparent: true,
        opacity: 1,
        side: THREE.FrontSide
      });
      // Glass rim on all four sides: a fresnel highlight that brightens every edge that turns away
      // from the viewer, so the bevel reads as glass top, bottom, left and right alike.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          float facing = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
          float rim = pow(1.0 - facing, 1.9);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), rim * 0.8);
          gl_FragColor.rgb += vec3(0.55, 0.65, 1.0) * pow(rim, 3.0) * 0.25;`
        );
      };
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.index = i;
      const group = new THREE.Group();
      group.add(mesh);
      scene.add(group);
      const label = makeLabel(t.name, t.tier);
      set[i] = { group, mesh, material, label, x: 0, y: 0.6, z: 0, rotY: 0, rotX: 0, scale: reduceMotion ? 1 : 0.2, opacity: reduceMotion ? 1 : 0, spin: reduceMotion ? 0 : Math.PI, ready: false };
    });
    tileSets[key] = set;
    logosReady();
    return set;
  }

  buildCategory(getState().activeCat).then((set) => {
    if (signal.aborted) return;
    tiles = set;
    showStatus(false);
    start();
  }).catch(() => showError("The 3D logo files couldn't load. Keep both .glb files next to this page."));

  // ---------- Motion constants ----------
  const S = 1.32;                       // spacing between tiles (tiles are 1 unit wide)
  const STATIC_MAX = 6;                 // this few visible tools sit centred instead of looping
  const DRIFT = 0.32;                   // drift speed, units per second
  let offset = 0, speed = 0;
  const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  // ---------- Picking ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerInside = false;

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(tiles.filter((t, i) => t && passesTier(TOOLS[i])).map((t) => t.mesh), false)[0];
    return hit ? hit.object.userData.index : -1;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    const prev = hovered;
    hovered = pick(ev);
    stage.classList.toggle("over-logo", hovered >= 0);
    const isMouse = ev.pointerType === "mouse" || ev.pointerType === "pen";
    if (hovered >= 0 && isMouse && !drag) {
      const r = stage.getBoundingClientRect();
      hoverLabel.querySelector(".hl-name").textContent = TOOLS[hovered].name;
      hoverLabel.querySelector("small").textContent = hovered === selected ? "Click to close" : "Click to open";
      hoverLabel.style.left = (ev.clientX - r.left) + "px";
      hoverLabel.style.top = (ev.clientY - r.top) + "px";
      hoverLabel.classList.add("show");
      if (hovered !== prev) sfx.hover(hovered);
    } else {
      hoverLabel.classList.remove("show");
    }
  });
  renderer.domElement.addEventListener("pointerenter", () => { pointerInside = true; });
  renderer.domElement.addEventListener("pointerleave", () => {
    pointerInside = false; hovered = -1;
    stage.classList.remove("over-logo");
    hoverLabel.classList.remove("show");
  });
  renderer.domElement.addEventListener("click", (ev) => {
    if (suppressClick) { suppressClick = false; return; }
    const i = pick(ev);
    if (i >= 0) select(i === selected ? -1 : i);
  });

  // ---------- Scroll interaction: wheel / trackpad, drag / swipe, keys, buttons ----------
  let pending = 0;          // scroll distance still to apply (smoothed)
  let vel = 0;              // fling momentum from a drag
  let userUntil = 0;        // auto drift waits until this time after the user moves the row
  let lastStep = 0;
  let drag = null;
  let suppressClick = false;
  const pause = () => { userUntil = performance.now() + 2500; };
  const stepSelection = (dir) => select(step(selected, dir));
  const nudge = (dir) => {
    if (selected >= 0) { stepSelection(dir); return; }
    pending += dir * S; pause();
  };

  on(stage, "wheel", (e) => {
    if (e.target.closest(".card")) return;   // let the card scroll normally
    e.preventDefault();
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const d = raw * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    if (selected >= 0) {
      const now = performance.now();
      if (Math.abs(d) > 6 && now - lastStep > 380) { stepSelection(Math.sign(d)); lastStep = now; }
      return;
    }
    pending += d * worldPerPx * 0.6;
    pause();
  }, { passive: false, signal });

  renderer.domElement.addEventListener("pointerdown", (e) => {
    drag = { startX: e.clientX, lastX: e.clientX, lastT: performance.now(), moved: false };
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const now = performance.now();
    const dx = e.clientX - drag.lastX;
    if (Math.abs(e.clientX - drag.startX) > 6) drag.moved = true;
    if (drag.moved && selected < 0) {
      offset -= dx * worldPerPx;
      vel = (-dx * worldPerPx) / Math.max(0.008, (now - drag.lastT) / 1000);
      pause();
    }
    drag.lastX = e.clientX; drag.lastT = now;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const total = e.clientX - drag.startX;
    if (drag.moved) {
      suppressClick = true;
      if (selected >= 0 && Math.abs(total) > 40) stepSelection(total < 0 ? 1 : -1);
    }
    if (performance.now() - drag.lastT > 80) vel = 0;   // released after holding still
    drag = null;
  };
  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointercancel", endDrag);

  on(stage, "keydown", (e) => {
    if (e.target.closest(".card")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); nudge(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-1); }
    else if ((e.key === "Enter" || e.key === " ") && e.target === stage) {
      e.preventDefault();
      const vis = visibleList(), n = vis.length, L = n * S;
      const centre = n <= STATIC_MAX ? vis[Math.floor((n - 1) / 2)] : vis[((Math.round((offset + L / 2) / S) % n) + n) % n];
      select(selected >= 0 ? -1 : centre);
    }
  });


  // ---------- Layout ----------
  let worldPerPx = 0.006;
  const camBase = new THREE.Vector3();
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  on(stage, "pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    parallax.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    parallax.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  on(stage, "pointerleave", () => { parallax.tx = 0; parallax.ty = 0; });
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep about 8.5 tiles across on wide screens, fewer on narrow ones.
    const wantWidth = Math.max(4.6, Math.min(11.5, 8.5 * (camera.aspect / 2.4)));
    const dist = wantWidth / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
    worldPerPx = wantWidth / Math.max(1, w);
    camBase.set(0, 0.62 + dist * 0.16, dist);
    camera.position.copy(camBase);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  signal.addEventListener("abort", () => { ro.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); renderer.domElement.remove(); });
  resize();

  // World x where a point at depth z appears at a given fraction of the stage width.
  const tmp = new THREE.Vector3();
  function worldXAt(fraction, z) {
    tmp.set(fraction * 2 - 1, 0, 0.5).unproject(camera).sub(camera.position).normalize();
    const t = (z - camera.position.z) / tmp.z;
    return camera.position.x + tmp.x * t;
  }


  let born = performance.now();
  let exiting = false, switching = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function switchCategory(key) {
    if (key === getState().activeCat || switching) return;
    switching = true;
    if (selected >= 0) select(-1, true);
    hovered = -1;
    exiting = true;                                   // current logos shrink and fade out
    await wait(reduceMotion ? 0 : 420);
    tiles.forEach((t) => { if (t) { t.group.visible = false; t.label.visible = false; } });
    exiting = false;
    changeCategory(key);                              // header, tabs, tier filter, trends follow in React
    if (!tileSets[key]) { setLoad(0); showStatus(true); }
    try {
      const set = await buildCategory(key);
      set.forEach((t) => { if (!t) return; t.group.visible = true; t.label.visible = true; t.scale = reduceMotion ? 1 : 0.2; t.opacity = reduceMotion ? 1 : 0; t.spin = reduceMotion ? 0 : Math.PI; });
      tiles = set;
      offset = 0; pending = 0; vel = 0;
      born = performance.now();                       // new logos pop in one by one
      showStatus(false);
    } catch (err) {
      showError("These 3D logos couldn't load. Keep all .glb files next to this page.");
    }
    switching = false;
  }
  registerEngine({ switchCategory });

  function start() {
    let last = performance.now();
    born = last;
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      const vis = visibleList();
      const slotOf = new Array(TOOLS.length).fill(-1);
      vis.forEach((idx, k) => { slotOf[idx] = k; });
      const n = vis.length;
      const L = n * S;
      const isStatic = n <= STATIC_MAX;

      if (isStatic) {
        speed = 0; vel = 0; pending = 0;
      } else if (selected >= 0 && slotOf[selected] >= 0) {
        // Glide the loop so the chosen logo lands beside the card.
        const zSel = 1.4;
        const targetX = 0;   // the card sits below the stage, so the chosen logo comes to the centre
        const want = slotOf[selected] * S - L / 2 - targetX;
        const diff = ((((want - offset) % L) + L * 1.5) % L) - L / 2;
        offset += reduceMotion ? diff : diff * (1 - Math.exp(-5 * dt));
        speed = 0;
      } else {
        const target = reduceMotion || now < userUntil || drag ? 0 : DRIFT;
        speed = damp(speed, target, 2.5, dt);
        offset += speed * dt;
        const step = reduceMotion ? pending : pending * (1 - Math.exp(-12 * dt));
        offset += step; pending -= step;
        if (!drag) { offset += vel * dt; vel = damp(vel, 0, 3.2, dt); }
      }

      tiles.forEach((tile, i) => {
        if (!tile) return;
        const slot = slotOf[i];
        const shown = slot >= 0;
        const baseX = !shown ? tile.x : isStatic ? (slot - (n - 1) / 2) * S : ((((slot * S - offset) % L) + L) % L) - L / 2;
        const isSel = i === selected;
        const isHover = i === hovered && !isSel;
        const bob = reduceMotion ? 0 : Math.sin(time * 1.1 + i * 0.9) * 0.05;

        // Idle 3D motion: each glass tile slowly turns and tilts on its own phase.
        let tRotY = reduceMotion ? 0 : Math.sin(time * 0.55 + i * 1.3) * 0.42;
        let tRotX = reduceMotion ? 0 : Math.sin(time * 0.8 + i) * 0.06;
        let tY = 0.6 + bob, tZ = 0, tScale = 1, tOpacity = 1;

        // Hover: the logo turns to face you, lifts and steps forward.
        if (isHover) { tRotY = 0; tRotX = 0; tY += 0.12; tZ = 0.35; tScale = 1.12; }
        if (isSel) { tRotY = 0; tRotX = 0; tY = 0.86 + bob * 0.5; tZ = 1.4; tScale = 1.38; }
        if (selected >= 0 && !isSel) tOpacity = 0.4;
        // Entrance: logos rise out of the floor one after another.
        if (!reduceMotion && (now - born) / 1000 < 0.25 + i * 0.06) { tScale = 0.2; tOpacity = 0; }
        if (exiting || !shown) { tScale = 0.2; tOpacity = 0; tY -= 0.15; }

        tile.spin = damp(tile.spin, 0, reduceMotion ? 50 : 2.6, dt);
        tile.x = baseX;
        tile.y = damp(tile.y, tY, 6, dt);
        tile.z = damp(tile.z, tZ, 6, dt);
        tile.rotY = damp(tile.rotY, tRotY, 4, dt);
        tile.rotX = damp(tile.rotX, tRotX, 4, dt);
        tile.scale = damp(tile.scale, tScale, 6, dt);
        tile.opacity = damp(tile.opacity, tOpacity, shown ? 6 : 14, dt);

        tile.group.position.set(tile.x, tile.y + (tile.scale - 1) * 0.49, tile.z);
        tile.group.rotation.set(tile.rotX, tile.rotY + tile.spin, 0);
        tile.group.scale.setScalar(tile.scale);
        tile.material.opacity = tile.opacity;
        if (!exiting && !switching) { const v = shown || tile.opacity > 0.02; tile.group.visible = v; tile.label.visible = v; }
        tile.label.position.set(tile.x, tile.y + (tile.scale - 1) * 0.49 - 0.5 * tile.scale - 0.29, tile.z + 0.05);
        tile.label.scale.setScalar(0.9 + 0.1 * tile.scale);
        tile.label.userData.textMat.opacity = tile.opacity;
        tile.label.userData.glassMat.opacity = 0.55 * tile.opacity;
        tile.label.rotation.y = tile.rotY * 0.35;
      });

      // Glass outline: follows the hovered logo (or the open one), turning and scaling with it.
      const ringIdx = hovered >= 0 ? hovered : selected;
      const rTile = ringIdx >= 0 ? tiles[ringIdx] : null;
      if (rTile && ringHost !== rTile.group) { rTile.group.add(ring); ringHost = rTile.group; }
      ring.material.opacity = damp(ring.material.opacity, rTile ? 1 : 0, 9, dt);
      if (ring.material.opacity > 0.02) paintRing(reduceMotion ? 0 : time * 1.6);

      // Rising lights: float upward and wrap around; a burst of speed when a tool opens.
      lightBoost = damp(lightBoost, 0, 1.6, dt);
      lights.forEach((l) => {
        if (!reduceMotion) {
          l.y += l.speed * (1 + lightBoost * 5) * dt;
          if (l.y > Y_MAX) { l.y = Y_MIN; l.x = rnd(-9, 9); }
        }
        const tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(time * 1.6 + l.phase);
        l.sp.position.set(l.x + Math.sin(time * 0.6 + l.phase) * l.sway, l.y, l.z);
        l.sp.material.opacity = tw * Math.min(1, (l.y - Y_MIN) / 0.8, (Y_MAX - l.y) / 0.8);
        l.sp.scale.setScalar(l.size * (1 + lightBoost * 0.4));
      });
      // Glow follows the selected logo.
      const selTile = selected >= 0 ? tiles[selected] : null;
      if (selTile) selGlow.position.set(selTile.x, selTile.y + 0.3, selTile.z - 0.35);
      selGlow.lookAt(camera.position);

      selGlow.material.opacity = damp(selGlow.material.opacity, selTile ? 1 : 0, 5, dt);

      // Gentle camera parallax with the pointer.
      if (!reduceMotion) {
        parallax.x = damp(parallax.x, parallax.tx, 3, dt);
        parallax.y = damp(parallax.y, parallax.ty, 3, dt);
      }
      camera.position.set(camBase.x + parallax.x * 0.45, camBase.y - parallax.y * 0.2, camBase.z);
      camera.lookAt(LOOK);

      renderer.render(scene, camera);
    });
  }

  return () => {
    ac.abort(); unsub();
    registerEngine({ switchCategory: null, spin: () => {}, boost: () => {} });
  };
}
