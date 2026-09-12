"use client";

import { useMemo, useState } from "react";
import { calculatePaidSocialOpportunity } from "@/lib/paid-social";
import type { MarketCode } from "@/lib/arbitra";
import { MARKETS, MARKET_BY_CODE } from "@/lib/markets";

type Opportunity = {
  name:string; category:string; demand:number; confidence:number; metaAds:number; advertisers:number;
  tiktok:number; competition:number; margin:number; upstream:string[]; window:string;
};

const seeds: Opportunity[] = [
  { name:"Portable Cold Plunge", category:"Fitness & Recovery", demand:82, confidence:79, metaAds:11, advertisers:4, tiktok:88, competition:24, margin:67, upstream:["US","UK","DE"], window:"12–27d" },
  { name:"Walking Pad", category:"Home Fitness", demand:76, confidence:83, metaAds:24, advertisers:9, tiktok:79, competition:38, margin:54, upstream:["US","DE","UK"], window:"8–21d" },
  { name:"LED Scalp Massager", category:"Beauty", demand:71, confidence:68, metaAds:7, advertisers:3, tiktok:91, competition:18, margin:72, upstream:["US","UK","JP"], window:"14–32d" },
  { name:"Mini Thermal Printer", category:"Electronics", demand:63, confidence:74, metaAds:42, advertisers:16, tiktok:64, competition:57, margin:46, upstream:["US","JP","DE"], window:"21–40d" },
];

const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));

export default function Home(){
  const [market,setMarket]=useState<MarketCode>("NL");
  const marketDef=MARKET_BY_CODE[market];

  const rows=useMemo(()=>seeds.map((p,index)=>{
    const factor=marketDef.demoFactor;
    const demand=clamp(p.demand*factor-index*1.2);
    const tiktok=clamp(p.tiktok*(.92+factor*.08));
    const metaAds=Math.max(1,Math.round(p.metaAds*(.7+factor*.3)));
    const advertisers=Math.max(1,Math.round(p.advertisers*(.75+factor*.25)));
    const competition=clamp(p.competition*(.85+factor*.15));
    const paid=calculatePaidSocialOpportunity({
      demandProbability:demand,
      meta:marketDef.meta?{source:"meta",market,observedAt:"demo",activeAds:metaAds,uniqueAdvertisers:advertisers,confidence:.8}:undefined,
      tiktok:marketDef.tiktok?{source:"tiktok",market,observedAt:"demo",trendVelocity:tiktok,creatorGrowth:tiktok-8,engagementVelocity:tiktok+4,confidence:.8}:undefined,
      marketplaceCompetition:competition,
      marginPercent:p.margin,
    });
    const route=[...p.upstream.filter((m)=>m!==market).slice(0,3),market].join(" → ");
    return {...p,demand,tiktok,metaAds,advertisers,competition,paid,route};
  }).sort((a,b)=>b.paid.score-a.paid.score),[market,marketDef]);

  const top=rows[0];
  const sourceCount=[marketDef.google,marketDef.meta,marketDef.tiktok,marketDef.marketplaces.length>0].filter(Boolean).length;

  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">ARBITRA TERMINAL</div><div className="subtitle">Global Product Intelligence · See demand before it reaches your market.</div></div>
      <div className="headerRight"><span className="liveDot"/> {market} MARKET <span className="badge">PAID SOCIAL ENGINE v0.3 · DEMO DATA</span></div>
    </header>

    <section className="marketStrip">
      <span className="marketStripLabel">TARGET MARKET</span>
      <div className="marketTabs">{MARKETS.map((m)=><button key={m.code} className={m.code===market?"marketTab active":"marketTab"} onClick={()=>setMarket(m.code)}>{m.flag} {m.code}</button>)}</div>
    </section>

    <section className="commandbar"><div><span className="muted">TARGET MARKET</span><div className="selectWrap"><select value={market} onChange={(e)=>setMarket(e.target.value as MarketCode)}>{MARKETS.map((m)=><option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}</select></div></div><div><span className="muted">CHANNEL</span><strong>{marketDef.tiktok?"META + TIKTOK":"META"}</strong></div><div><span className="muted">SOURCE COVERAGE</span><strong>{sourceCount}/4 · {marketDef.marketplaces.length?marketDef.marketplaces.join(" + "):"NO MARKETPLACE YET"}</strong></div><div className="command">TOP OPPORTUNITIES ↓</div></section>

    <section className="hero">
      <div className="metric"><div className="label">#1 Opportunity · {market}</div><div className="value nameValue">{top.name}</div><div className="micro">{top.category}</div></div>
      <div className="metric"><div className="label">Paid Social Score</div><div className="value accent">{top.paid.score}</div><div className="micro">{top.paid.status}</div></div>
      <div className="metric"><div className="label">Demand Forecast</div><div className="value">{top.demand}%</div><div className="micro">confidence {top.confidence}%</div></div>
      <div className="metric"><div className="label">Expected Window</div><div className="value">{top.window}</div><div className="micro">target: {marketDef.name}</div></div>
    </section>

    <section className="panel opportunityPanel">
      <div className="panelTitle"><div><h2>TOP OPPORTUNITIES · {marketDef.name.toUpperCase()}</h2><p>Ranked for early paid-social entry. Market selection changes the target-market score and available data sources.</p></div><span className="status">{sourceCount}/4 SOURCES</span></div>
      <div className="tableWrap"><table className="table terminalTable"><thead><tr><th>#</th><th>Product</th><th>Demand</th><th>TikTok</th><th>Meta ads</th><th>Advertisers</th><th>Competition</th><th>Margin</th><th>Paid Social</th><th>Action</th></tr></thead><tbody>
        {rows.map((p,i)=><tr key={p.name} className={i===0?"selected":""}><td className="rank">0{i+1}</td><td><strong>{p.name}</strong><span className="cellSub">{p.category}</span></td><td>{p.demand}%</td><td className={marketDef.tiktok&&p.tiktok>=80?"positive":""}>{marketDef.tiktok?p.tiktok:"N/A"}</td><td>{marketDef.meta?p.metaAds:"N/A"}</td><td>{marketDef.meta?p.advertisers:"N/A"}</td><td>{p.competition}</td><td>{p.margin}%</td><td><strong className="score">{p.paid.score}</strong></td><td><span className={`signal ${p.paid.status.replaceAll(" ","").toLowerCase()}`}>{p.paid.status}</span></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="grid lowerGrid">
      <div className="panel"><h2>MARKET PROPAGATION · {top.name.toUpperCase()}</h2><div className="route bigRoute">{top.route.split(" → ").map((m,i,a)=><span key={`${m}-${i}`} className="routePart"><span className={`node ${i===a.length-1?"target":""}`}>{m}<small>{i===0?"BREAKOUT":i===a.length-1?"TARGET / EARLY":"ACCELERATING"}</small></span>{i<a.length-1&&<span className="arrow">→</span>}</span>)}</div><div className="intel"><div><span>Demand forecast</span><b>{top.demand}%</b></div><div><span>TikTok momentum</span><b>{marketDef.tiktok?`${top.paid.tiktokMomentum}/100`:"N/A"}</b></div><div><span>Meta saturation</span><b>{marketDef.meta?`${top.paid.metaSaturation}/100`:"N/A"}</b></div><div><span>Entry window</span><b>{top.window}</b></div></div></div>
      <aside className="panel actionPanel"><h2>ARBITRA SIGNAL · {market}</h2><div className="actionLabel">{top.paid.status}</div><div className="actionScore">{top.paid.score}<small>/100</small></div><p>Demand is propagating toward {marketDef.name}. ARBITRA scores the local entry window against available paid-social and marketplace competition signals.</p><div className="rule"><span>Google demand</span><b>{marketDef.google?"AVAILABLE":"PENDING"}</b></div><div className="rule"><span>Meta intelligence</span><b>{marketDef.meta?"AVAILABLE":"PENDING"}</b></div><div className="rule"><span>TikTok intelligence</span><b>{marketDef.tiktok?"AVAILABLE":"NOT AVAILABLE"}</b></div><div className="rule"><span>Marketplace</span><b>{marketDef.marketplaces.length?marketDef.marketplaces.join(", "):"PENDING"}</b></div></aside>
    </section>

    <footer className="footer terminalFooter">DEMO MODE · Country switching is functional, but displayed product scores are interface seed data until live source credentials and persisted observations are connected. Source coverage differs by market.</footer>
  </main>;
}
