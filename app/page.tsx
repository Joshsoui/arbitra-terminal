"use client";

import { useEffect, useMemo, useState } from "react";
import { MARKETS, MARKET_BY_CODE } from "@/lib/markets";
import type { Forecast, MarketCode } from "@/lib/arbitra";

type View = "radar" | "opportunity" | "tests" | "research" | "sources";
type SourceStatus = { mode: "demo" | "partial" | "live-ready"; connected: number; persistence: boolean; sources: Record<string, { configured: boolean }> };
type Opportunity = {
  product: { id: string; name: string; category: string };
  market: MarketCode;
  route: MarketCode[];
  signal: { momentum: number; acceleration: number; saturation: number };
  forecast: Forecast;
};
type OpportunitiesResponse = { mode: "live" | "demo"; model: string; opportunities: Opportunity[] };

const STAGES: Array<{ status: Forecast["status"]; label: string; note: string }> = [
  { status: "WATCH", label: "WATCH", note: "weak or unconfirmed movement" },
  { status: "EMERGING", label: "EMERGING", note: "breakout probability crossing 50%" },
  { status: "EARLY ENTRY", label: "EARLY ENTRY", note: "high probability, saturation still low" },
  { status: "SATURATED", label: "SATURATED", note: "target market already crowded" },
];

export default function Home() {
  const [view, setView] = useState<View>("radar");
  const [selected, setSelected] = useState(0);
  const [market, setMarket] = useState<"GLOBAL" | MarketCode>("GLOBAL");
  const [runtime, setRuntime] = useState<SourceStatus | null>(null);
  const [engine, setEngine] = useState<OpportunitiesResponse | null>(null);
  const [engineError, setEngineError] = useState(false);

  useEffect(() => {
    fetch("/api/system-status", { cache: "no-store" }).then((r) => r.json()).then(setRuntime).catch(() => null);
    fetch("/api/opportunities", { cache: "no-store" })
      .then((r) => r.json())
      .then(setEngine)
      .catch(() => setEngineError(true));
  }, []);

  const opportunities = useMemo(
    () => (engine?.opportunities ?? []).filter((o) => market === "GLOBAL" || o.market === market).slice(0, 10),
    [engine, market],
  );
  const active = opportunities[selected] ?? opportunities[0];
  const status = runtime?.mode === "live-ready" ? "LIVE READY" : runtime?.mode === "partial" ? "PARTIAL DATA" : "DEMO / VALIDATION MODE";

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">ARBITRA TERMINAL</div>
          <div className="subtitle">Global Product Intelligence · detect commercial windows before they become obvious.</div>
        </div>
        <div className="headerRight">
          <span className={runtime?.mode === "live-ready" ? "liveDot" : "liveDot demoDot"} />
          {status}
          <span className="badge">RADAR v0.8</span>
        </div>
      </header>

      <nav className="navRow">
        <div className="viewTabs">
          {([["radar", "Opportunity Radar"], ["opportunity", "Deep Dive"], ["tests", "Test & Scale"], ["research", "Research"], ["sources", "Sources"]] as const).map(([k, l]) => (
            <button key={k} className={view === k ? "viewTab active" : "viewTab"} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <div className="modeNote">PRODUCT × MARKET × TIMING</div>
      </nav>

      <section className="marketStrip">
        <span className="marketStripLabel">RADAR SCOPE</span>
        <div className="marketTabs">
          <button className={market === "GLOBAL" ? "marketTab active" : "marketTab"} onClick={() => { setMarket("GLOBAL"); setSelected(0); }}>🌐 WORLDWIDE</button>
          {MARKETS.map((m) => (
            <button key={m.code} className={market === m.code ? "marketTab active" : "marketTab"} onClick={() => { setMarket(m.code); setSelected(0); }}>{m.flag} {m.code}</button>
          ))}
        </div>
      </section>

      {view === "radar" && (
        <>
          <section className="radarHero">
            <div>
              <div className="eyebrow">GLOBAL OPPORTUNITY RADAR</div>
              <h1>What is emerging <em>before</em> it becomes obvious?</h1>
              <p>ARBITRA ranks product × market entry windows by demand momentum, acceleration, saturation and estimated commercial margin, computed by the {engine?.model ?? "arbitra-forecast"} engine.</p>
            </div>
            <div className="radarStats">
              <div><b>{opportunities.length}</b><span>TOP WINDOWS</span></div>
              <div><b>{MARKETS.length}</b><span>MARKETS</span></div>
              <div><b>{runtime?.connected ?? 0}/4</b><span>LIVE SIGNAL GROUPS</span></div>
            </div>
          </section>
          <section className="stageRail">
            {STAGES.map((s, i) => <div key={s.status}><span>0{i + 1}</span><b>{s.label}</b><small>{s.note}</small></div>)}
          </section>
          <section className="panel opportunityPanel">
            <div className="panelTitle">
              <div>
                <h2>RANKED ENTRY WINDOWS</h2>
                <p>Not "winning products": markets where modeled demand is moving faster than saturation. Engine data: {engine ? engine.mode.toUpperCase() : "LOADING…"}.</p>
              </div>
            </div>
            <div className="tableWrap">
              <table className="table terminalTable">
                <thead><tr><th>#</th><th>Opportunity</th><th>Market</th><th>Phase</th><th>Demand</th><th>Acceleration</th><th>Saturation</th><th>Confidence</th><th>Radar score</th></tr></thead>
                <tbody>
                  {!engine && !engineError && <tr><td colSpan={9}>Loading opportunities…</td></tr>}
                  {engineError && <tr><td colSpan={9}>Could not reach the forecast engine.</td></tr>}
                  {opportunities.map((o, i) => (
                    <tr key={`${o.product.id}-${o.market}`} onClick={() => { setSelected(i); setView("opportunity"); }}>
                      <td>{String(i + 1).padStart(2, "0")}</td>
                      <td><strong>{o.product.name}</strong><span className="cellSub">{o.product.category}</span></td>
                      <td>{MARKET_BY_CODE[o.market].flag} {o.market}</td>
                      <td><span className="phase">{o.forecast.status}</span></td>
                      <td>{Math.round(o.signal.momentum)}%</td>
                      <td className="positive">↑ {Math.round(o.signal.acceleration)}</td>
                      <td>{Math.round(o.signal.saturation)}</td>
                      <td>{o.forecast.confidence}%</td>
                      <td><strong className="score">{o.forecast.opportunityScore}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {view === "opportunity" && active && (
        <section className="deepGrid">
          <div className="panel">
            <div className="eyebrow">OPPORTUNITY THESIS</div>
            <h1 className="detailTitle">{active.product.name} <span>{MARKET_BY_CODE[active.market].flag} {MARKET_BY_CODE[active.market].name}</span></h1>
            <div className="decisionRow"><span className="phase large">{active.forecast.status}</span><strong>{active.forecast.opportunityScore}<small>/100 RADAR</small></strong></div>
            <p className="thesis">
              Modeled breakout probability into {MARKET_BY_CODE[active.market].name} is {active.forecast.breakoutProbability}%, with an estimated {active.forecast.commercialScore}/100 commercial headroom (margin + competition space). Confidence in this read is {active.forecast.confidence}%.
            </p>
            <h2>WHY THE ENGINE FLAGGED IT</h2>
            <div className="signalGrid">
              {active.forecast.reasons.length
                ? active.forecast.reasons.map((r) => <div key={r}>↗ <b>{r}</b><small>{engine?.mode === "demo" ? "demo snapshot signal" : "live market signal"}</small></div>)
                : <div>No strong signals cleared threshold<small>score reflects a cautious read</small></div>}
            </div>
            <h2>GEOGRAPHIC PROPAGATION</h2>
            <div className="route bigRoute">
              {active.route.map((r, i) => (
                <span className="routePart" key={r}>
                  <span className={`node ${r === active.market ? "target" : ""}`}>{r}<small>{i === 0 ? "ORIGIN" : r === active.market ? "TARGET" : "UPSTREAM"}</small></span>
                  {i < active.route.length - 1 && <span className="arrow">→</span>}
                </span>
              ))}
            </div>
          </div>
          <aside className="panel evidence">
            <div className="eyebrow">DECISION SUPPORT</div>
            <div className="evidenceMetric"><span>CONFIDENCE</span><b>{active.forecast.confidence}%</b></div>
            <div className="evidenceMetric"><span>SATURATION</span><b>{Math.round(active.signal.saturation)}/100</b></div>
            <div className="evidenceMetric"><span>EST. MARGIN</span><b>{active.forecast.marginPercent}%</b></div>
            <div className="evidenceMetric"><span>COMMERCIAL SCORE</span><b>{active.forecast.commercialScore}/100</b></div>
            <button className="primaryAction wide" onClick={() => setView("tests")}>BUILD TEST PLAN →</button>
            <p className="warning">
              {engine?.mode === "demo"
                ? "Demo snapshot data — the ranking engine (arbitra-forecast-v0.1) is real, but these input signals are not sourced from live markets yet."
                : "Computed from live Supabase market snapshots. Entry-window date estimates require the historical propagation/backtest model once enough breakout history has accumulated."}
            </p>
          </aside>
        </section>
      )}

      {view === "tests" && (
        <section className="panel emptyState">
          <div className="eyebrow">TEST → VALIDATE → SCALE → BRAND</div>
          <h1>Turn an opportunity into a controlled experiment.</h1>
          <p>This workspace will track test spend, CPA/ROAS, margin, kill/scale criteria and the next geographic expansion window. It becomes actionable after live ad/outcome integrations are connected.</p>
          <div className="flow"><b>OPPORTUNITY</b><span>→</span><b>TEST</b><span>→</span><b>VALIDATE</b><span>→</span><b>SCALE</b><span>→</span><b>BRAND</b></div>
        </section>
      )}

      {view === "research" && (
        <section className="panel emptyState">
          <div className="eyebrow">POWER USER RESEARCH</div>
          <h1>Evidence behind the recommendation.</h1>
          <p>Search, social, creator, ad, marketplace, pricing and supply signals live here. Research supports the decision; it is not the primary product experience.</p>
        </section>
      )}

      {view === "sources" && (
        <section className="sourcesLayout">
          <div className="panel sourceSummary">
            <div className="eyebrow">INTELLIGENCE COVERAGE</div>
            <div className="readinessNumber">{runtime?.connected ?? 0}<small>/4</small></div>
            <h2>LIVE SIGNAL GROUPS CONFIGURED</h2>
          </div>
          <div className="sourceGrid">
            {([["Google", "google", "Search demand + historical backtests"], ["Meta", "meta", "Advertiser saturation"], ["TikTok", "tiktok", "Social / creative acceleration"], ["bol.com", "bol", "Marketplace demand & supply"], ["Amazon", "amazon", "Global marketplace validation"]] as const).map(([label, key, role]) => {
              const ok = runtime?.sources?.[key]?.configured ?? false;
              return (
                <div className="panel sourceCard" key={key}>
                  <div className="sourceCardTop"><strong>{label}</strong><span className={ok ? "sourceState ready" : "sourceState pending"}>{ok ? "CONFIGURED" : "NEEDS SETUP"}</span></div>
                  <p>{role}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="footer terminalFooter">
        <strong>VALIDATION NOTICE</strong> · Opportunity scores are computed by the {engine?.model ?? "arbitra-forecast"} engine from {engine?.mode === "demo" ? "demo product snapshots" : "live Supabase market data"}, not from a static lookup table. The next milestone is running the historical walk-forward backtest against real ingested data before any commercial decision should rely on these scores.
      </footer>
    </main>
  );
}
