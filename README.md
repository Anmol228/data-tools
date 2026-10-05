# Data Sector Tools

The Data Sector Tools page (3D tool logos, market trends, charts, profiles), packaged for
hosting on Netlify, with an eye counter showing how many people have opened the site.

## What's inside

A Node.js + React project built with Vite and hosted on Netlify. The page is React components;
the 3D stage is the original three.js code, mounted inside the React app.

| Path | What it is |
|---|---|
| `index.html` | The HTML shell React mounts into (`<div id="root">`). |
| `src/main.jsx`, `src/App.jsx` | Entry point and the page layout. |
| `src/store.js` | Shared state (current segment, open tool, tier filter, sound, open panels) and the actions that change it. |
| `src/components/` | React components: `Header` (title, tabs, eye counter), `TrendsSection` (Most widely used / Emerging, Market trends pop-up), `Stage` (3D stage controls and loader), `Card` (details card), `Connectors` (databases, warehouses and lakes), `Profile` (full profile page), `ChartsPage`, `HoverChart`, `Tooltip`. |
| `src/three/stageEngine.js` | The 3D stage (three.js): glass logos, lights, drag / scroll / keys, page switch animation. |
| `src/lib/` | Helpers: segments and tier filter (`categories.js`), ranking and number formats (`ranking.js`), flat logos (`logos.js`), sounds (`sfx.js`). |
| `src/data.js` | All data from the workbook: tools, pricing, market trends, monthly figures, connectors. Edit values here. |
| `src/styles.css` | All styling. |
| `public/*.glb` | The 3D glass logo models (8 files). |
| `netlify/functions/views.mjs` | The visitor counter behind the eye button (`/api/views`). |
| `scripts/test-views.mjs` | Checks the counter logic (`npm test`). |
| `netlify.toml`, `vite.config.js`, `package.json` | Build and hosting settings. |

Run it locally: `npm install`, then `npm run dev` (http://localhost:5173). Build: `npm run build` (output in `dist/`).

## How the eye counter works

- The first time a browser opens the site, it gets a random id (kept in that browser) and is counted once.
- Coming back later, refreshing, or opening another page in the same browser does not add to the count.
- Known bots and crawlers are ignored.
- Counts are stored in Netlify Blobs, which is built into Netlify. No database or extra account needed.
- The number is shown as "≈N". Someone who clears their browser data or uses another device or a private window counts again. That's normal for every visitor counter.
- Hovering the eye explains what the number means.

The eye only appears where the counter exists. It stays hidden in the Claude artifact preview and when you open `index.html` straight from disk.

## Put it online with GitHub + Netlify (no terminal needed)

1. On GitHub, click **New repository**, name it (for example `data-tools`), keep it Public or Private, and click **Create repository**. Don't add a README.
2. On the new repository page, click **uploading an existing file**. Drag in everything inside this folder except `node_modules` and `dist` (index.html, package.json, package-lock.json, netlify.toml, vite.config.js, README.md, .gitignore and the `src`, `public`, `netlify` and `scripts` folders), then click **Commit changes**.
3. On Netlify, click **Add new project → Import an existing project → GitHub**, allow access, and pick the repository.
4. Netlify reads `netlify.toml`, so the settings fill in by themselves (build command `npm run build`, publish directory `dist`, functions `netlify/functions`). Click **Deploy**.
5. After about a minute you get a live address like `https://your-site.netlify.app`. Every later commit to GitHub redeploys the site automatically.

## Put it online with the terminal (about 5 minutes)

You need Node.js 18 or newer and a free Netlify account.

```bash
npm install
npm test                      # optional: checks the counter logic
npx netlify-cli login         # opens the browser once to sign in
npx netlify-cli init          # choose "Create & configure a new site"
npx netlify-cli deploy --build --prod
```

Netlify prints the live address (for example `https://data-sector-tools.netlify.app`).
Open it: the eye shows ≈1, which is you.

Alternatively, push this folder to a GitHub repository and connect it in Netlify:
**Add new site → Import an existing project**. The settings in `netlify.toml` are picked up
automatically, and every push redeploys.

> Netlify's drag-and-drop deploy does not run functions, so the eye would stay hidden.
> Use the CLI or the GitHub route.

## Work on it locally

```bash
npm run dev           # page only, http://localhost:5173 (eye hidden: no counter locally)
npx netlify-cli dev   # page + counter, http://localhost:8888
```

## Resetting the count

In the Netlify dashboard, open **Blobs → site-views** and delete the store, or delete its
`visitor/…` entries and `summary`.

## Optional: full analytics

The eye shows a single number. For page-by-page stats, referrers and countries, add an
analytics snippet (for example Plausible or Google Analytics) to the `<head>` of `index.html`.
Those dashboards stay private to you; the eye keeps showing the public count.
