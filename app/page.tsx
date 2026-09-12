import { calculateForecast, ProductSnapshot } from "@/lib/arbitra";

const demoProduct: ProductSnapshot = {
  id: "demo-001",
  name: "Portable Cold Plunge",
  category: "Fitness & Recovery",
  signals: [
    { market: "US", momentum: 92, acceleration: 88, saturation: 68, adActivity: 76, marketplaceCompetition: 72, breakoutAt: "2026-08-09" },
    { market: "UK", momentum: 78, acceleration: 73, saturation: 54, adActivity: 59, marketplaceCompetition: 57, breakoutAt: "2026-08-22" },
    { market: "DE", momentum: 61, acceleration: 66, saturation: 39, adActivity: 41, marketplaceCompetition: 43 },
    { market: "NL", momentum: 32, acceleration: 46, saturation: 22, adActivity: 19, marketplaceCompetition: 26, retailPrice: 119, landedCost: 39 },
  ],
};

export default function Home() {
  const forecast = calculateForecast(demoProduct, "NL");
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">ARBITRA TERMINAL</div>
          <div className="subtitle">Global Product Intelligence · See demand before it reaches your market.</div>
        </div>
        <div className="badge">DATA ENGINE v0.1 · DEMO SIGNALS</div>
      </header>

      <section className="hero">
        <div className="metric"><div className="label">Opportunity Score</div><div className="value accent">{forecast.opportunityScore}</div></div>
        <div className="metric"><div className="label">NL Breakout Probability</div><div className="value">{forecast.breakoutProbability}%</div></div>
        <div className="metric"><div className="label">Forecast Confidence</div><div className="value">{forecast.confidence}%</div></div>
        <div className="metric"><div className="label">Signal</div><div className="value" style={{fontSize:18}}>{forecast.status}</div></div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>MARKET PROPAGATION · {demoProduct.name}</h2>
          <div className="route">
            <div className="node">🇺🇸 US · BREAKOUT</div><span className="arrow">→ 13d →</span>
            <div className="node">🇬🇧 UK · BREAKOUT</div><span className="arrow">→</span>
            <div className="node">🇩🇪 DE · ACCELERATING</div><span className="arrow">→ ? →</span>
            <div className="node">🇳🇱 NL · EARLY</div>
          </div>
          <div style={{marginTop:20}}>
            <span className="status">EARLY ENTRY CANDIDATE</span>
          </div>
          <table className="table" style={{marginTop:16}}>
            <thead><tr><th>Market</th><th>Momentum</th><th>Acceleration</th><th>Saturation</th><th>Ads</th></tr></thead>
            <tbody>
              {demoProduct.signals.map((s)=><tr key={s.market}><td>{s.market}</td><td>{s.momentum}</td><td>{s.acceleration}</td><td>{s.saturation}</td><td>{s.adActivity}</td></tr>)}
            </tbody>
          </table>
        </div>

        <aside className="panel">
          <h2>WHY ARBITRA IS FLAGGING THIS</h2>
          {forecast.reasons.map((reason)=><div className="reason" key={reason}>{reason}</div>)}
          <div className="footer">Demo values are clearly marked and must be replaced by historical and live source adapters before production use.</div>
        </aside>
      </section>
    </main>
  );
}
