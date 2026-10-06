import { ETL_CONNECTORS, TOOL_CONN } from "../data.js";
import { CATEGORIES } from "../lib/categories.js";

// Databases, warehouses and lakes for every tool (researched data, "DB Warehouse Lake Connectors")
// (key systems named from official docs, 2025-2026; not a full catalogue). "scope" is the official connector
// scope from the "Connector Counts" sheet, or the Tools sheet's "Supported Sources / Connectors" column.
export const dbFor = (cat, name) => (CATEGORIES[cat].tools.some((t) => t.name === name) ? TOOL_CONN[name] || null : null);
// Supported connector types for ETL / ELT tools ("ETL Connectors" sheet).
export const connectorsFor = (cat, name) => (cat === "etl" ? ETL_CONNECTORS.tools[name] || null : null);

const ICON = {
  db: <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></svg>,
  wh: <svg viewBox="0 0 24 24"><path d="M3 10l9-6 9 6" /><path d="M5 10v9h14v-9" /><path d="M9 19v-5h6v5" /></svg>,
  other: <svg viewBox="0 0 24 24"><path d="M10 14l4-4" /><path d="M8.5 16.5l-1 1a3 3 0 01-4.2-4.2l3-3a3 3 0 014.2 0" /><path d="M15.5 7.5l1-1a3 3 0 014.2 4.2l-3 3a3 3 0 01-4.2 0" /></svg>
};

const Chips = ({ items }) => items.map((t, k) => <span key={k}>{t}</span>);

// Database / warehouse / lake block (the card shows the first few names, the profile shows all).
export function DbBlock({ cat, name, max, children }) {
  const d = dbFor(cat, name);
  if (!d) return null;
  const tips = d.tips ? Object.entries(d.tips) : [];
  return (
    <div className="conn-db">
      {d.scope && <p className="db-scope"><b>Official connector scope: </b>{d.scope}</p>}
      {(d.noList || d.scopeMissing) && (
        <p className="db-scope no-data">
          {[d.scopeMissing ? "Official connector scope: not stated in the researched data (see the tool's official documentation)." : "",
            d.noList ? "Named databases, warehouses and lakes: not listed in the researched data for this tool." : ""].filter(Boolean).join(" ")}
        </p>
      )}
      {[["db", "Databases", d.db], ["wh", "Warehouses & lakes", d.wh], ["other", "Other access", d.other]].map(([k, title, list]) => {
        if (!list.length) return null;
        const names = max ? list.slice(0, max) : list;
        return (
          <div className={"db-group " + k} key={k}>
            <div className="db-line"><span className="db-icon" aria-hidden="true">{ICON[k]}</span><span className="db-title">{title}</span><b className="db-count">{k === "other" ? "" : `${list.length} named`}</b></div>
            <div className="conn-ex db-list">
              {names.map((n) => {
                const tip = d.tips && d.tips[n];
                return tip ? <span key={n} className="has-tip" title={tip}>{n}</span> : <span key={n}>{n}</span>;
              })}
              {max && list.length > max ? <span>{`+${list.length - max} more`}</span> : null}
            </div>
          </div>
        );
      })}
      {!max && tips.length > 0 && (
        <ul className="db-tips">{tips.map(([k, v]) => <li key={k}><b>{k + ": "}</b>{v}</li>)}</ul>
      )}
      {children}
    </div>
  );
}

// Short version for the details card.
export function ConnCard({ cat, t, onMore }) {
  const c = connectorsFor(cat, t.name);
  const d = dbFor(cat, t.name);
  if (!c) {
    // Orchestration and BI tools: no connector-type sheet, so only the database block shows.
    if (!d) return null;
    return (
      <section className="conn" style={{ "--i": 3 }}>
        <DbBlock cat={cat} name={t.name} max={10} />
        <button type="button" className="conn-more" onClick={onMore}>See all details</button>
      </section>
    );
  }
  const stated = ETL_CONNECTORS.cats.filter((_, k) => c.cats[k]);
  return (
    <section className="conn" style={{ "--i": 3 }}>
      <div className="conn-head"><h3>Supported connectors</h3><span className="conn-count">{d && d.scope ? "" : (c.count || "Not stated")}</span><span className="conn-sub">{`${stated.length} of ${ETL_CONNECTORS.cats.length} connector types stated`}</span></div>
      <DbBlock cat={cat} name={t.name} max={10} />
      <div className="conn-cats">
        {stated.map((n) => <span key={n} className="conn-cat yes">{n}</span>)}
        {!stated.length && <span className="conn-sub">No connector types stated on the page.</span>}
      </div>
      {c.examples.length > 0 && (
        <>
          <div className="conn-label">Named on the official page</div>
          <div className="conn-ex">
            <Chips items={c.examples.slice(0, 8)} />
            {c.examples.length > 8 && <span>{`+${c.examples.length - 8} more`}</span>}
          </div>
        </>
      )}
      <button type="button" className="conn-more" onClick={onMore}>See all connector details</button>
    </section>
  );
}

// Full version for the profile page.
export function ConnProfile({ cat, t }) {
  const c = connectorsFor(cat, t.name);
  const d = dbFor(cat, t.name);
  const hidden = !c && !d;
  return (
    <section className="pf-pricing pf-conn" aria-labelledby="pfConnTitle" hidden={hidden}>
      <div className="pf-pricing-head">
        <h2 id="pfConnTitle">{c ? "Supported connectors" : "Databases, warehouses & lakes"}</h2>
        <span className="conn-count pf-conn-count">{c && !(d && d.scope) ? (c.count ? `${c.count} (as stated)` : "Count not stated") : ""}</span>
      </div>
      <div className="pf-conn-body">
        {!hidden && (
          <div className="conn">
            <DbBlock cat={cat} name={t.name} max={0}>
              {d && !d.noList && <p className="conn-foot">{`How it connects: ${d.dir}${d.note ? " (" + d.note + ")" : ""}. Researched data: the key databases, warehouses and lakes named in official docs (2025-2026), not a full catalogue.`}</p>}
            </DbBlock>
            {c && (
              <>
                <div className="conn-label">Connector types (researched data)</div>
                <div className="pf-conn-grid">
                  {ETL_CONNECTORS.cats.map((n, k) => (
                    <span key={n} className={"conn-cat " + (c.cats[k] ? "yes" : "no")}>
                      {n}<small title={`${ETL_CONNECTORS.catTotals[k]} of 37 ETL tools state this`}>{c.cats[k] ? "Stated" : "Not stated"}</small>
                    </span>
                  ))}
                </div>
                {c.examples.length > 0 && (
                  <>
                    <div className="conn-label">Connectors named on the official page</div>
                    <div className="conn-ex"><Chips items={c.examples} /></div>
                  </>
                )}
                {c.note && <p className="conn-note">{c.note}</p>}
                <p className="conn-foot">
                  {"“Stated” means the tool's official connector or product page says so (checked 3 Oct 2026). “Not stated” means that page doesn't mention it, which doesn't prove the tool lacks it. "}
                  {c.src && <><a href={c.src} target="_blank" rel="noopener">Official connector page</a>.</>}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
