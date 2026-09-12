"use client";

import { useEffect, useMemo, useState } from "react";
import { calculatePaidSocialOpportunity } from "@/lib/paid-social";
import type { MarketCode } from "@/lib/arbitra";
import { MARKETS, MARKET_BY_CODE } from "@/lib/markets";

type TargetMarket = "GLOBAL" | MarketCode;
type View = "opportunities" | "intelligence" | "sources";
type SourceStatus = {
  mode: "demo" | "partial" | "live-ready";
  connected: number;
  totalSignalGroups: number;
  persistence: boolean;
  sources: Record<string, { configured: boolean; role: string }>;
  note: string;
};

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

function scoreOpportunity(p:Opportunity,index:number,market:MarketCode){
  const marketDef=MARKET_BY_CODE[market];
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
  const sourceCount=[marketDef.google,marketDef.meta,marketDef.tiktok,marketDef.marketplaces.length>0].filter(Boolean).length;
  const coveragePenalty=(4-sourceCount)*3;
  const globalScore=clamp(paid.score-coveragePenalty);
  const route=[...p.upstream.filter((m)=>m!==market).slice(0,3),market].join(" → ");
  return {...p,market,marketDef,demand,tiktok,metaAds,advertisers,competition,paid:{...paid,score:globalScore},route,sourceCount};
}

export default function Home(){
  const [target,setTarget]=useState<TargetMarket>("GLOBAL");
  const [view,setView]=useState<View>("opportunities");
  const [runtime,setRuntime]=useState<SourceStatus|null>(null);
  const isGlobal=target==="GLOBAL";

  useEffect(()=>{
    fetch("/api/system-status",{cache:"no-store"}).then(r=>r.json()).then(setRuntime).catch(()=>setRuntime(null));
  },[]);

  const allRows=useMemo(()=>MARKETS.flatMap((marketDef)=>seeds.map((p,index)=>scoreOpportunity(p,index,marketDef.code))).sort((a,b)=>b.paid.score-a.paid.score),[]);
  const rows=useMemo(()=>isGlobal?allRows.slice(0,12):allRows.filter((row)=>row.market===target).slice(0,8),[allRows,isGlobal,target]);
  const top=rows[0];
  const selectedMarketDef=isGlobal?null:MARKET_BY_CODE[target as MarketCode];
  const sourceCount=isGlobal?4:top.sourceCount;
  const runtimeLabel=runtime?.mode==="live-ready"?"LIVE READY":runtime?.mode==="partial"?"PARTIAL DATA":"DEMO MODE";

  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">ARBITRA TERMINAL</div><div className="subtitle">Global Product Intelligence · Find demand before the market gets crowded.</div></div>
      <div className="headerRight"><span className={runtime?.mode==="live-ready"?"liveDot":"liveDot demoDot"}/> {runtimeLabel}<span className="badge">ENGINE v0.5</span></div>
    </header>

    <section className="navRow">
      <div className="viewTabs">
        <button className={view==="opportunities"?"viewTab active":"viewTab"} onClick={()=>setView("opportunities")}>Opportunities</button>
        <button className={view==="intelligence"?"viewTab active":"viewTab"} onClick={()=>setView("intelligence")}>Intelligence</button>
        <button className={view==="sources"?"viewTab active":"viewTab"} onClick={()=>setView("sources")}>Sources <span className="tabCount">{runtime?.connected??0}/4</span></button>
      </div>
      <div className="modeNote">{isGlobal?"GLOBAL SCAN · PRODUCT × MARKET":"MARKET VIEW · LOCAL OPPORTUNITY"}</div>
    </section>

    <section className="marketStrip">
      <span className="marketStripLabel">MARKET</span>
      <div className="marketTabs"><button className={isGlobal?"marketTab active":"marketTab"} onClick={()=>setTarget("GLOBAL")}>🌐 GLOBAL</button>{MARKETS.map((m)=><button key={m.code} className={m.code===target?"marketTab active":"marketTab"} onClick={()=>setTarget(m.code)}>{m.flag} {m.code}</button>)}</div>
    </section>

    <section className="controlBar">
      <div><span className="muted">TARGET</span><div className="selectWrap"><select value={target} onChange={(e)=>setTarget(e.target.value as TargetMarket)}><option value="GLOBAL">🌐 Global · Best market automatically</option>{MARKETS.map((m)=><option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}</select></div></div>
      <div><span className="muted">RANKING</span><strong>{isGlobal?"PRODUCT × COUNTRY":"PRODUCTS IN MARKET"}</strong></div>
      <div><span className="muted">DATA STATUS</span><strong>{runtime?`${runtime.connected}/4 SIGNAL GROUPS${runtime.persistence?" · DB ON":" · DB PENDING"}`:"CHECKING…"}</strong></div>
    </section>

    {view==="opportunities"&&<>
      <section className="hero compactHero">
        <div className="metric featured"><div className="label">#1 Opportunity</div><div className="value nameValue">{top.name}</div><div className="micro">{top.marketDef.flag} {top.marketDef.name} · {top.category}</div></div>
        <div className="metric"><div className="label">Opportunity</div><div className="value accent">{top.paid.score}</div><div className="micro">{top.paid.status}</div></div>
        <div className="metric"><div className="label">Demand</div><div className="value">{top.demand}%</div><div className="micro">confidence {top.confidence}%</div></div>
        <div className="metric"><div className="label">Window</div><div className="value">{top.window}</div><div className="micro">{top.marketDef.name}</div></div>
      </section>

      <section className="panel opportunityPanel">
        <div className="panelTitle"><div><h2>{isGlobal?"BEST GLOBAL OPPORTUNITIES":`TOP OPPORTUNITIES · ${top.marketDef.name.toUpperCase()}`}</h2><p>{isGlobal?"Best product-market combinations across active consumer markets.":"Products ranked for early commercial entry in the selected market."}</p></div><span className="status">{isGlobal?`${MARKETS.length} MARKETS`:`${sourceCount}/4 COVERAGE`}</span></div>
        <div className="tableWrap"><table className="table terminalTable"><thead><tr><th>#</th><th>Product</th>{isGlobal&&<th>Market</th>}<th>Demand</th><th>TikTok</th><th>Meta Ads</th><th>Competition</th><th>Margin</th><th>Score</th><th>Signal</th></tr></thead><tbody>
          {rows.map((p,i)=><tr key={`${p.name}-${p.market}`} className={i===0?"selected":""} onClick={()=>{setTarget(p.market);setView("intelligence")}}><td className="rank">{String(i+1).padStart(2,"0")}</td><td><strong>{p.name}</strong><span className="cellSub">{p.category}</span></td>{isGlobal&&<td><strong>{p.marketDef.flag} {p.market}</strong><span className="cellSub">{p.marketDef.name}</span></td>}<td>{p.demand}%</td><td className={p.marketDef.tiktok&&p.tiktok>=80?"positive":""}>{p.marketDef.tiktok?p.tiktok:"—"}</td><td>{p.marketDef.meta?p.metaAds:"—"}</td><td>{p.competition}</td><td>{p.margin}%</td><td><strong className="score">{p.paid.score}</strong></td><td><span className={`signal ${p.paid.status.replaceAll(" ","").toLowerCase()}`}>{p.paid.status}</span></td></tr>)}
        </tbody></table></div>
        <div className="tableHint">Click an opportunity to inspect its market intelligence.</div>
      </section>
    </>}

    {view==="intelligence"&&<section className="grid intelligenceGrid">
      <div className="panel"><div className="eyebrow">SELECTED OPPORTUNITY</div><h1 className="detailTitle">{top.name} <span>{top.marketDef.flag} {top.marketDef.name}</span></h1><div className="route bigRoute">{top.route.split(" → ").map((m,i,a)=><span key={`${m}-${i}`} className="routePart"><span className={`node ${i===a.length-1?"target":""}`}>{m}<small>{i===0?"BREAKOUT":i===a.length-1?"TARGET / EARLY":"ACCELERATING"}</small></span>{i<a.length-1&&<span className="arrow">→</span>}</span>)}</div><div className="intel"><div><span>Demand forecast</span><b>{top.demand}%</b></div><div><span>TikTok momentum</span><b>{top.marketDef.tiktok?`${top.paid.tiktokMomentum}/100`:"—"}</b></div><div><span>Meta saturation</span><b>{top.marketDef.meta?`${top.paid.metaSaturation}/100`:"—"}</b></div><div><span>Entry window</span><b>{top.window}</b></div></div><div className="explainBox"><strong>Why this matters</strong><p>ARBITRA compares demand acceleration, market propagation, paid-social saturation and marketplace competition to estimate whether this market is still early enough to test.</p></div></div>
      <aside className="panel actionPanel"><div className="eyebrow">ARBITRA DECISION</div><div className="actionLabel">{top.paid.status}</div><div className="actionScore">{top.paid.score}<small>/100</small></div><p>Current model output for {top.name} in {top.marketDef.name}. Scores remain demo/model seed data until real observations are connected.</p><div className="rule"><span>Demand</span><b>{top.demand}%</b></div><div className="rule"><span>Competition</span><b>{top.competition}/100</b></div><div className="rule"><span>Margin proxy</span><b>{top.margin}%</b></div><div className="rule"><span>Data coverage</span><b>{top.sourceCount}/4</b></div></aside>
    </section>}

    {view==="sources"&&<section className="sourcesLayout">
      <div className="panel sourceSummary"><div className="eyebrow">SYSTEM READINESS</div><div className="readinessNumber">{runtime?.connected??0}<small>/4</small></div><h2>SIGNAL GROUPS CONFIGURED</h2><p>{runtime?.persistence?"Supabase persistence is configured.":"Historical persistence still needs Supabase credentials/configuration."}</p></div>
      <div className="sourceGrid">
        {[
          ["Google","google","Demand formation + cross-market search momentum"],
          ["Meta","meta","Advertiser saturation + commercial competition"],
          ["TikTok","tiktok","Early cultural + creative acceleration"],
          ["bol.com","bol","NL/BE marketplace validation"],
          ["Amazon","amazon","International marketplace validation"],
        ].map(([label,key,role])=>{
          const configured=runtime?.sources?.[key]?.configured??false;
          return <div className="panel sourceCard" key={key}><div className="sourceCardTop"><strong>{label}</strong><span className={configured?"sourceState ready":"sourceState pending"}>{configured?"CONFIGURED":"NEEDS SETUP"}</span></div><p>{role}</p><div className="sourceFoot">{configured?"Credentials/settings detected":"No live credentials detected"}</div></div>;
        })}
      </div>
      <div className="panel nextSteps"><h2>NEXT TECHNICAL MILESTONE</h2><p>Connect Google first, persist observations, run the first historical backtest, then layer Meta/TikTok and marketplace validation on top. A source marked configured is not automatically proof that its upstream API is working.</p></div>
    </section>}

    <footer className="footer terminalFooter"><strong>DATA NOTICE</strong> · Global ranking and market switching are functional. Opportunity scores remain demo/model seed data until live observations and historical outcomes are connected and validated.</footer>
  </main>;
}
