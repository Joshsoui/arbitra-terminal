import type { MarketCode } from "./arbitra";

export type MarketDefinition = {
  code: MarketCode;
  name: string;
  flag: string;
  currency: string;
  region: "North America" | "Latin America" | "Europe" | "Asia Pacific" | "South Asia";
  meta: boolean;
  tiktok: boolean;
  google: boolean;
  marketplaces: string[];
  demoFactor: number;
};

export const MARKETS: MarketDefinition[] = [
  { code:"US", name:"United States", flag:"🇺🇸", currency:"USD", region:"North America", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:1.08 },
  { code:"CA", name:"Canada", flag:"🇨🇦", currency:"CAD", region:"North America", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.96 },
  { code:"MX", name:"Mexico", flag:"🇲🇽", currency:"MXN", region:"North America", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.92 },
  { code:"BR", name:"Brazil", flag:"🇧🇷", currency:"BRL", region:"Latin America", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:1.01 },
  { code:"UK", name:"United Kingdom", flag:"🇬🇧", currency:"GBP", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:1.03 },
  { code:"DE", name:"Germany", flag:"🇩🇪", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.98 },
  { code:"FR", name:"France", flag:"🇫🇷", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.97 },
  { code:"NL", name:"Netherlands", flag:"🇳🇱", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["bol.com","Amazon"], demoFactor:1 },
  { code:"BE", name:"Belgium", flag:"🇧🇪", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["bol.com","Amazon"], demoFactor:.91 },
  { code:"ES", name:"Spain", flag:"🇪🇸", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.94 },
  { code:"IT", name:"Italy", flag:"🇮🇹", currency:"EUR", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.95 },
  { code:"SE", name:"Sweden", flag:"🇸🇪", currency:"SEK", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.89 },
  { code:"PL", name:"Poland", flag:"🇵🇱", currency:"PLN", region:"Europe", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.93 },
  { code:"AU", name:"Australia", flag:"🇦🇺", currency:"AUD", region:"Asia Pacific", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:1.02 },
  { code:"JP", name:"Japan", flag:"🇯🇵", currency:"JPY", region:"Asia Pacific", meta:true, tiktok:true, google:true, marketplaces:["Amazon"], demoFactor:.99 },
  { code:"KR", name:"South Korea", flag:"🇰🇷", currency:"KRW", region:"Asia Pacific", meta:true, tiktok:true, google:true, marketplaces:[], demoFactor:1.04 },
  { code:"IN", name:"India", flag:"🇮🇳", currency:"INR", region:"South Asia", meta:true, tiktok:false, google:true, marketplaces:["Amazon"], demoFactor:1.06 },
];

export const MARKET_BY_CODE = Object.fromEntries(MARKETS.map((market) => [market.code, market])) as Record<MarketCode, MarketDefinition>;
