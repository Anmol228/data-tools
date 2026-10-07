// Builds the latest monthly download numbers for every tool that publishes a package.
// Used by the daily refresh job (netlify/functions/refresh-market.mjs) and checked by scripts/test-market.mjs.
//
// Sources (free, official, no key needed):
//   Python packages: https://pypistats.org/api/packages/<package>/overall?mirrors=false  (daily, last ~180 days)
//   npm packages:    https://api.npmjs.org/downloads/range/<start>:<end>/<package>       (daily)
//
// Rules, the same as the researched data:
//   - The last 6 complete calendar months.
//   - Change = last month vs first month, compared per day, because PyPI keeps only ~180 days,
//     so the first month can be partial.
//   - If any tool in a segment fails to load, the whole segment keeps its previous numbers.
//     Numbers are never estimated.
import { PACKAGES } from "../../src/lib/packages.js";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// The last `n` complete calendar months before `now` (UTC), oldest first.
export function lastFullMonths(now, n = 6) {
  const out = [];
  let y = now.getUTCFullYear(), m = now.getUTCMonth();   // current month (0-based), excluded
  for (let k = 0; k < n; k++) {
    m -= 1; if (m < 0) { m = 11; y -= 1; }
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    out.unshift({ key: `${y}-${pad(m + 1)}`, label: MON[m], year: y, days, start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(days)}` });
  }
  return out;
}

// Daily rows [{ date: "YYYY-MM-DD", downloads }] -> monthly totals and the number of days with data.
export function bucketDaily(rows, months) {
  const idx = Object.fromEntries(months.map((mo, k) => [mo.key, k]));
  const m = months.map(() => 0), days = months.map(() => new Set());
  for (const r of rows) {
    const k = idx[String(r.date).slice(0, 7)];
    if (k == null) continue;
    m[k] += Number(r.downloads) || 0;
    days[k].add(r.date);
  }
  return { m, days: days.map((s) => s.size) };
}

// Monthly totals -> the figures the page uses. Returns null when the series is unusable.
export function seriesFrom({ m, days }) {
  if (!days[0] || !days[days.length - 1] || m[0] <= 0) return null;
  const last = m.length - 1;
  const growth = (m[last] / days[last]) / (m[0] / days[0]) - 1;
  return { m, pop: m.reduce((a, b) => a + b, 0), growth: Math.round(growth * 10000) / 10000, days };
}

async function getJSON(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { "user-agent": "data-tools-site (monthly download stats)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function pypiDaily(fetchImpl, pkg) {
  const j = await getJSON(fetchImpl, `https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/overall?mirrors=false`);
  return (j.data || []).filter((r) => r.category === "without_mirrors").map((r) => ({ date: r.date, downloads: r.downloads }));
}

async function npmDaily(fetchImpl, pkg, months) {
  const j = await getJSON(fetchImpl, `https://api.npmjs.org/downloads/range/${months[0].start}:${months[months.length - 1].end}/${pkg}`);
  return (j.downloads || []).map((r) => ({ date: r.day, downloads: r.downloads }));
}

// Runs tasks with at most `limit` at a time (keeps the job well inside the function time limit).
async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const k = next++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export async function buildMarket({ fetchImpl = fetch, now = new Date(), previous = null } = {}) {
  const months = lastFullMonths(now);
  const segments = {}, errors = [];
  for (const [cat, def] of Object.entries(PACKAGES)) {
    const entries = Object.entries(def.tools);
    const results = await pool(entries, 6, async ([name, pkg]) => {
      try {
        const rows = def.source === "npm" ? await npmDaily(fetchImpl, pkg, months) : await pypiDaily(fetchImpl, pkg);
        const s = seriesFrom(bucketDaily(rows, months));
        if (!s) throw new Error(`no usable data for ${pkg}`);
        return { name, pkg, ...s };
      } catch (e) { errors.push(`${cat}/${name}: ${e.message}`); return null; }
    });
    if (results.every(Boolean)) {
      const firstDays = results.reduce((a, r) => Math.min(a, r.days[0]), months[0].days);
      segments[cat] = {
        source: def.source === "npm" ? "npm" : "pypi",
        monthKeys: months.map((mo) => mo.key),
        months: months.map((mo) => mo.label),
        firstDays,
        firstMonthDays: months[0].days,
        tools: results.map(({ name, pkg, m, pop, growth }) => ({ name, pkg, m, pop, growth }))
      };
    } else if (previous && previous.segments && previous.segments[cat]) {
      segments[cat] = previous.segments[cat];   // keep the last good numbers for this segment
    }
  }
  return { updated: now.toISOString(), segments, errors };
}
