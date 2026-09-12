import { calculatePaidSocialOpportunity } from "@/lib/paid-social";

type Opportunity = {
  name:string; category:string; demand:number; confidence:number; metaAds:number; advertisers:number;
  tiktok:number; competition:number; margin:number; route:string; window:string;
};

// UI seed data only. Live rows will replace these as source credentials and persisted observations come online.
const seeds: Opportunity[] = [
  { name:"Portable Cold Plunge", category:"Fitness & Recovery", demand:82, confidence:79, metaAds:11, advertisers:4, tiktok:88, competition:24, margin:67, route:"US → UK → DE → NL", window:"12–27d" },
  { name:"Walking Pad", category:"Home Fitness", demand:76, confidence:83, metaAds:24, advertisers:9, tiktok:79, competition:38, margin:54, route:"US → DE → NL", window:"8–21d" },
  { name:"LED Scalp Massager", category:"Beauty", demand:71, confidence:68, metaAds:7, advertisers:3, tiktok:91, competition:18, margin:72, route:"US → UK → NL", window:"14–32d" },
  { name:"Mini Thermal Printer", category:"Electronics", demand:63, confidence:74, metaAds:42, advertisers:16, tiktok:64, competition:57, margin:46, route:"US → UK → DE", window:"21–40d" },
];

const rows = seeds.map((p) => ({
  ...p,
  paid: calculatePaidSocialOpportunity({
    demandProbability:p.demand,
    meta:{source:"meta",market:"NL",observedAt:"demo",activeAds:p.metaAds,uniqueAdvertisers:p.advertisers,confidence:.8},
    tiktok:{source:"tiktok",market:"NL",observedAt:"demo",trendVelocity:p.tiktok,creatorGrowth:p.tiktok-8,engagementVelocity:p.tiktok+4,confidence:.8},
    marketplaceCompetition:p.competition,
    marginPercent:p.margin,
  }),
})).sort((a,b)=>b.paid.score-a.paid.score);

export default function Home(){
  const top=rows[0];
  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">ARBITRA TERMINAL</div><div className="subtitle">Global Product Intelligence · See demand before it reaches your market.</div></div>
      <div className="headerRight"><span className="liveDot"/> NL MARKET <span className="badge">PAID SOCIAL ENGINE v0.2 · DEMO DATA</span></div>
    </header>

    <section className="commandbar"><div><span className="muted">TARGET MARKET</span><strong>🇳🇱 NETHERLANDS</strong></div><div><span className="muted">CHANNEL</span><strong>META + TIKTOK</strong></div><div><span className="muted">MODEL</span><strong>DEMAND × SATURATION</strong></div><div className="command">TOP OPPORTUNITIES ↓</div></section>

    <section className="hero">
      <div className="metric"><div className="label">#1 Opportunity</div><div className="value nameValue">{top.name}</div><div className="micro">{top.category}</div></div>
      <div className="metric"><div className="label">Paid Social Score</div><div className="value accent">{top.paid.score}</div><div className="micro">{top.paid.status}</div></div>
      <div className="metric"><div className="label">Demand Forecast</div><div className="value">{top.demand}%</div><div className="micro">confidence {top.confidence}%</div></div>
      <div className="metric"><div className="label">Expected Window</div><div className="value">{top.window}</div><div className="micro">target: NL</div></div>
    </section>

    <section className="panel opportunityPanel">
      <div className="panelTitle"><div><h2>TOP OPPORTUNITIES · NETHERLANDS</h2><p>Ranked for early paid-social entry. Higher score = stronger demand with more commercial headroom.</p></div><span className="status">EARLY SIGNALS</span></div>
      <div className="tableWrap"><table className="table terminalTable"><thead><tr><th>#</th><th>Product</th><th>Demand</th><th>TikTok</th><th>Meta ads</th><th>Advertisers</th><th>Competition</th><th>Margin</th><th>Paid Social</th><th>Action</th></tr></thead><tbody>
        {rows.map((p,i)=><tr key={p.name} className={i===0?"selected":""}><td className="rank">0{i+1}</td><td><strong>{p.name}</strong><span className="cellSub">{p.category}</span></td><td>{p.demand}%</td><td className={p.tiktok>=80?"positive":""}>{p.tiktok}</td><td>{p.metaAds}</td><td>{p.advertisers}</td><td>{p.competition}</td><td>{p.margin}%</td><td><strong className="score">{p.paid.score}</strong></td><td><span className={`signal ${p.paid.status.replace(" ","").toLowerCase()}`}>{p.paid.status}</span></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="grid lowerGrid">
      <div className="panel"><h2>MARKET PROPAGATION · {top.name.toUpperCase()}</h2><div className="route bigRoute">{top.route.split(" → ").map((m,i,a)=><span key={m} className="routePart"><span className={`node ${i===a.length-1?"target":""}`}>{m}<small>{i===0?"BREAKOUT":i===a.length-1?"EARLY":"ACCELERATING"}</small></span>{i<a.length-1&&<span className="arrow">→</span>}</span>)}</div><div className="intel"><div><span>Demand forecast</span><b>{top.demand}%</b></div><div><span>TikTok momentum</span><b>{top.paid.tiktokMomentum}/100</b></div><div><span>Meta saturation</span><b>{top.paid.metaSaturation}/100</b></div><div><span>Entry window</span><b>{top.window}</b></div></div></div>
      <aside className="panel actionPanel"><h2>ARBITRA SIGNAL</h2><div className="actionLabel">{top.paid.status}</div><div className="actionScore">{top.paid.score}<small>/100</small></div><p>Demand is moving toward NL while paid-social saturation remains relatively low. Validate product economics and creative fit before spend.</p><div className="rule"><span>Meta saturation</span><b>{top.paid.metaSaturation}</b></div><div className="rule"><span>TikTok momentum</span><b>{top.paid.tiktokMomentum}</b></div><div className="rule"><span>Marketplace competition</span><b>{top.competition}</b></div></aside>
    </section>

    <footer className="footer terminalFooter">DEMO MODE · Scores above are interface seed data, not live market claims. Production rows will be generated from persisted Google, Meta, TikTok and marketplace observations.</footer>
  </main>;
}
