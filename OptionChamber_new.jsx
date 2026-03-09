import { useState, useMemo, useRef, useCallback, useEffect } from "react";

// ─── MOCK API ─────────────────────────────────────────────────────────────────
const MOCK_DB = {
  AAPL: { underlying: 182.63, change: 2.45, iv: 24.1, quote: { open: 179.80, high: 183.90, low: 178.50 } },
  TSLA: { underlying: 248.90, change: -1.12, iv: 52.8, quote: { open: 252.10, high: 255.40, low: 245.30 } },
  NVDA: { underlying: 467.20, change: 4.18, iv: 41.2, quote: { open: 448.50, high: 470.80, low: 445.10 } },
  META: { underlying: 307.45, change: 0.85, iv: 32.5, quote: { open: 304.20, high: 310.80, low: 302.90 } },
  AMZN: { underlying: 133.80, change: -0.21, iv: 28.7, quote: { open: 134.20, high: 135.60, low: 132.40 } },
  MSFT: { underlying: 384.10, change: 1.33, iv: 22.4, quote: { open: 379.50, high: 386.20, low: 378.80 } },
  SPY:  { underlying: 438.60, change: 0.44, iv: 17.8, quote: { open: 436.80, high: 440.10, low: 435.20 } },
  GOOGL:{ underlying: 141.20, change: 1.65, iv: 26.3, quote: { open: 139.40, high: 142.50, low: 138.90 } },
  AMD:  { underlying: 156.80, change: -2.30, iv: 48.6, quote: { open: 160.20, high: 161.40, low: 154.30 } },
  COIN: { underlying: 218.40, change: 3.72, iv: 78.4, quote: { open: 210.50, high: 222.80, low: 208.90 } },
};
const STRATEGY_TEMPLATES = [
  { strategy:"Single Option", signal:"BUY", type:"C", mkLegs:(sym,d)=>([{signal:"BUY",type:"C",strike:Math.round(d.underlying*0.97/5)*5,expiry:"20-OCT-26",bid:+(d.underlying*0.03).toFixed(2),ask:+(d.underlying*0.031).toFixed(2)}]), mkBidAsk:(d)=>({bid:+(d.underlying*0.03).toFixed(2),ask:+(d.underlying*0.031).toFixed(2)}), delta:0.64,oi:"89.2k",vol:"12.4k" },
  { strategy:"Call Spread", signal:"BUY", type:"C", mkLegs:(sym,d)=>{const s1=Math.round(d.underlying*0.97/5)*5,s2=Math.round(d.underlying*1.07/5)*5,p1=+(d.underlying*0.03).toFixed(2),p2=+(d.underlying*0.01).toFixed(2);return[{signal:"BUY",type:"C",strike:s1,expiry:"27-OCT-26",bid:p1,ask:+(p1*1.04).toFixed(2)},{signal:"SELL",type:"C",strike:s2,expiry:"27-OCT-26",bid:p2,ask:+(p2*1.04).toFixed(2)}];}, mkBidAsk:(d)=>({bid:+(d.underlying*0.02).toFixed(2),ask:+(d.underlying*0.021).toFixed(2)}), delta:0.28,oi:"45.2k",vol:"18.1k" },
  { strategy:"Iron Condor", signal:"SELL", type:"P", mkLegs:(sym,d)=>{const sp=Math.round(d.underlying*0.93/5)*5,sl=Math.round(d.underlying*0.89/5)*5,sc=Math.round(d.underlying*1.07/5)*5,sh=Math.round(d.underlying*1.11/5)*5;return[{signal:"SELL",type:"P",strike:sp,expiry:"03-NOV-26",bid:+(d.underlying*0.015).toFixed(2),ask:+(d.underlying*0.017).toFixed(2)},{signal:"BUY",type:"P",strike:sl,expiry:"03-NOV-26",bid:+(d.underlying*0.007).toFixed(2),ask:+(d.underlying*0.009).toFixed(2)},{signal:"SELL",type:"C",strike:sc,expiry:"03-NOV-26",bid:+(d.underlying*0.015).toFixed(2),ask:+(d.underlying*0.017).toFixed(2)},{signal:"BUY",type:"C",strike:sh,expiry:"03-NOV-26",bid:+(d.underlying*0.006).toFixed(2),ask:+(d.underlying*0.008).toFixed(2)}];}, mkBidAsk:(d)=>({bid:+(d.underlying*0.018).toFixed(2),ask:+(d.underlying*0.022).toFixed(2)}), delta:0.06,oi:"67.8k",vol:"22.9k" },
  { strategy:"Put Spread", signal:"SELL", type:"P", mkLegs:(sym,d)=>{const s1=Math.round(d.underlying*0.97/5)*5,s2=Math.round(d.underlying*0.90/5)*5,p1=+(d.underlying*0.025).toFixed(2),p2=+(d.underlying*0.012).toFixed(2);return[{signal:"SELL",type:"P",strike:s1,expiry:"17-NOV-26",bid:p1,ask:+(p1*1.04).toFixed(2)},{signal:"BUY",type:"P",strike:s2,expiry:"17-NOV-26",bid:p2,ask:+(p2*1.04).toFixed(2)}];}, mkBidAsk:(d)=>({bid:+(d.underlying*0.013).toFixed(2),ask:+(d.underlying*0.015).toFixed(2)}), delta:-0.22,oi:"43.1k",vol:"15.6k" },
  { strategy:"Straddle", signal:"BUY", type:"C", mkLegs:(sym,d)=>{const s=Math.round(d.underlying/5)*5,p=+(d.underlying*0.04).toFixed(2);return[{signal:"BUY",type:"C",strike:s,expiry:"19-JAN-27",bid:p,ask:+(p*1.04).toFixed(2)},{signal:"BUY",type:"P",strike:s,expiry:"19-JAN-27",bid:+(p*0.95).toFixed(2),ask:+(p*0.98).toFixed(2)}];}, mkBidAsk:(d)=>({bid:+(d.underlying*0.078).toFixed(2),ask:+(d.underlying*0.082).toFixed(2)}), delta:0.05,oi:"38.4k",vol:"11.3k" },
];
const MOCK_NEWS = {
  AAPL:[{headline:"Apple set to unveil new AI features at WWDC, analysts bullish on services revenue",source:"Bloomberg",time:"2h ago",sentiment:"positive"},{headline:"iPhone 17 demand tracking above expectations in Asia Pacific markets",source:"Reuters",time:"4h ago",sentiment:"positive"},{headline:"Apple faces EU antitrust scrutiny over App Store payment policies",source:"FT",time:"1d ago",sentiment:"negative"}],
  NVDA:[{headline:"NVIDIA Blackwell GPU supply tightening as hyperscaler orders surge",source:"WSJ",time:"30m ago",sentiment:"positive"},{headline:"NVIDIA to power next-gen AI clusters at Microsoft Azure data centers",source:"Reuters",time:"2h ago",sentiment:"positive"},{headline:"Chip export restrictions could crimp NVIDIA's China revenue",source:"Bloomberg",time:"5h ago",sentiment:"negative"}],
  TSLA:[{headline:"Tesla Full Self-Driving v14 rollout begins next month across fleet",source:"Bloomberg",time:"1h ago",sentiment:"positive"},{headline:"Morgan Stanley cuts Tesla price target citing softening EV demand",source:"CNBC",time:"3h ago",sentiment:"negative"},{headline:"Cybertruck delivery ramp accelerating, production bottleneck resolved",source:"Electrek",time:"6h ago",sentiment:"positive"}],
  default:[{headline:"Fed officials signal patience on rate cuts amid sticky core inflation",source:"WSJ",time:"3h ago",sentiment:"negative"},{headline:"S&P 500 breadth improving as small-caps join large-cap rally",source:"Bloomberg",time:"1h ago",sentiment:"positive"},{headline:"Options market pricing in elevated volatility around FOMC decision",source:"Reuters",time:"4h ago",sentiment:"neutral"}],
};
function mkScore(d,tmpl){return Math.min(95,Math.round(48+Math.abs(tmpl.delta)*30+(d.change>0&&tmpl.type==="C"?8:3)+(d.iv<35?6:0)));}
const api={
  async scanSingle(ticker){await new Promise(r=>setTimeout(r,700));const sym=ticker.toUpperCase();const d=MOCK_DB[sym]||{underlying:150+Math.random()*100,change:(Math.random()-0.5)*4,iv:20+Math.random()*40,quote:{open:148,high:155,low:145}};const strategies=STRATEGY_TEMPLATES.map(tmpl=>{const legs=tmpl.mkLegs(sym,d);const ba=tmpl.mkBidAsk(d);return{symbol:sym,strategy:tmpl.strategy,signal:tmpl.signal,type:tmpl.type,underlying:d.underlying,change:d.change,iv:d.iv,strike:legs[0].strike,expiry:legs[0].expiry,bid:ba.bid,ask:ba.ask,delta:tmpl.delta,oi:tmpl.oi,vol:tmpl.vol,score:mkScore(d,tmpl),legs,rationale:[]};});return{quote:d.quote,strategies};},
  async scanMarketWide(){await new Promise(r=>setTimeout(r,1100));const syms=["NVDA","AAPL","TSLA","META","AMZN","MSFT","SPY","GOOGL","AMD","COIN"];const strategies=[];for(const sym of syms){const d=MOCK_DB[sym];const tmpl=STRATEGY_TEMPLATES[Math.floor(Math.random()*STRATEGY_TEMPLATES.length)];const legs=tmpl.mkLegs(sym,d);const ba=tmpl.mkBidAsk(d);strategies.push({symbol:sym,strategy:tmpl.strategy,signal:tmpl.signal,type:tmpl.type,underlying:d.underlying,change:d.change,iv:d.iv,strike:legs[0].strike,expiry:legs[0].expiry,bid:ba.bid,ask:ba.ask,delta:tmpl.delta+(Math.random()-0.5)*0.1,oi:tmpl.oi,vol:tmpl.vol,score:mkScore(d,tmpl)+Math.floor(Math.random()*10-5),legs,rationale:[]});}strategies.sort((a,b)=>b.score-a.score);return{quote:{},strategies};},
  async getNews(symbol){await new Promise(r=>setTimeout(r,400));return MOCK_NEWS[symbol]||MOCK_NEWS.default;},
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0d10",
  surface: "#16161a",
  surfaceHi: "#1e1e24",
  surfaceHi2: "#26262e",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",
  text: "#f0f0f5",
  sub: "#9898a6",
  muted: "#5a5a6a",
  green: "#2ecc71",
  greenBg: "rgba(46,204,113,0.12)",
  greenBorder: "rgba(46,204,113,0.25)",
  red: "#e74c3c",
  redBg: "rgba(231,76,60,0.12)",
  redBorder: "rgba(231,76,60,0.25)",
  amber: "#f39c12",
  blue: "#3b82f6",
  blueBg: "rgba(59,130,246,0.12)",
  blueBorder: "rgba(59,130,246,0.30)",
  purple: "#8b5cf6",
  purpleBg: "rgba(139,92,246,0.12)",
  cyan: "#06b6d4",
};

const DESKTOP_BP = 1024;
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= DESKTOP_BP);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BP}px)`);
    const h = e => setIsDesktop(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return isDesktop;
}

const fmt = new Intl.DateTimeFormat("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
const TODAY = fmt.format(new Date());

function parseFilterValue(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.kKmMbBtT]/g,'');
  const num = parseFloat(cleaned)||0;
  const suffix = cleaned.slice(-1).toUpperCase();
  if (suffix==='K') return num*1e3;
  if (suffix==='M') return num*1e6;
  if (suffix==='B') return num*1e9;
  return num;
}

function formatExpiry(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2,'0');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  } catch { return dateStr; }
}

// ─── STRATEGY BADGE CONFIG ────────────────────────────────────────────────────
function getStrategyBadge(strategy, type) {
  if (strategy==="Iron Condor")  return { label:"CONDOR",   bg:"rgba(139,92,246,0.18)",  fg:C.purple,  border:"rgba(139,92,246,0.35)" };
  if (strategy==="Straddle")     return { label:"STRADDLE", bg:"rgba(59,130,246,0.18)",  fg:C.blue,    border:"rgba(59,130,246,0.35)" };
  if (strategy==="Call Spread")  return { label:"DEBIT C",  bg:C.greenBg,                fg:C.green,   border:C.greenBorder };
  if (strategy==="Put Spread")   return { label:"CREDIT P", bg:C.redBg,                  fg:C.red,     border:C.redBorder };
  if (strategy==="Bear Call Spread") return { label:"BEAR C", bg:C.redBg,                fg:C.red,     border:C.redBorder };
  const t = type||"C";
  return t==="C"
    ? { label:"CALL",   bg:C.greenBg,   fg:C.green,  border:C.greenBorder }
    : { label:"PUT",    bg:C.redBg,     fg:C.red,    border:C.redBorder };
}

// ─── FILTER PILL (interactive summary cards top-right) ───────────────────────
function FilterPill({ label, value, color, bg, border, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      background: bg,
      border:`1.5px solid ${active ? color : border}`,
      borderRadius:8, padding:"5px 9px", cursor:"pointer",
      transition:"all 0.15s", flexShrink:0, flexGrow:1,
      boxShadow: active ? `0 0 12px ${border}` : "none",
      opacity: active ? 1 : 0.72,
      minWidth: 0,
    }}>
      <span style={{ fontSize:8, letterSpacing:1, color, fontWeight:700, whiteSpace:"nowrap" }}>{label}</span>
      <span style={{ fontSize:13, fontFamily:"monospace", fontWeight:800, color, letterSpacing:-0.3, whiteSpace:"nowrap" }}>{value}</span>
    </button>
  );
}

// ─── SCORE RING ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 16, circ = 2*Math.PI*r, dash = circ*(score/100);
  const color = score>=80 ? C.green : score>=65 ? C.amber : C.red;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3}/>
      <circle cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x={20} y={24} textAnchor="middle" style={{fontFamily:"monospace",fontSize:9,fill:color,fontWeight:800}}>{score}</text>
    </svg>
  );
}

// ─── DELTA RING ────────────────────────────────────────────────────────────────
function DeltaRing({ delta }) {
  const d = Math.abs(delta||0);
  const r = 11, circ = 2*Math.PI*r, dash = circ*d;
  const color = d>=0.65 ? C.green : d>=0.55 ? C.amber : d>=0.45 ? C.blue : C.purple;
  return (
    <svg width={28} height={28} viewBox="0 0 28 28">
      <circle cx={14} cy={14} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2}/>
      <circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x={14} y={18} textAnchor="middle" style={{fontFamily:"monospace",fontSize:7,fill:color,fontWeight:700}}>{d.toFixed(2)}</text>
    </svg>
  );
}

// ─── PAYOFF CHART ─────────────────────────────────────────────────────────────
function InteractivePayoff({ row }) {
  const svgRef = useRef(null);
  const [cursor, setCursor] = useState(null);
  const W=320, H=140;
  const legs = row.legs||[{signal:row.signal||'BUY',type:row.type||'C',strike:row.strike||0,bid:row.bid||0,ask:row.ask||0}];
  const calcPnL = useCallback((price) => {
    let pnl=0;
    for(const leg of legs){
      const legMid=((leg.bid||0)+(leg.ask||0))/2;
      const isCall=leg.type==='C';
      const intrinsic=isCall?Math.max(0,price-leg.strike):Math.max(0,leg.strike-price);
      pnl+=leg.signal==='BUY'?intrinsic-legMid:legMid-intrinsic;
    }
    return pnl;
  },[legs]);
  const strikes=legs.map(l=>l.strike).filter(s=>s>0);
  const minStrike=Math.min(...strikes), maxStrike=Math.max(...strikes);
  const spread=maxStrike-minStrike||maxStrike*0.1||10;
  const pad2=Math.max(spread*1.5,maxStrike*0.08);
  const minP=minStrike-pad2, maxP=maxStrike+pad2;
  const pts=useMemo(()=>Array.from({length:161},(_,i)=>{const p=minP+(maxP-minP)*(i/160);return{p,pnl:calcPnL(p)};}),[calcPnL,minP,maxP]);
  const maxPnl=Math.max(...pts.map(x=>x.pnl)), minPnl=Math.min(...pts.map(x=>x.pnl));
  const range=maxPnl-minPnl||1;
  const pad={l:36,r:8,t:16,b:32};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const toX=v=>pad.l+((v-minP)/(maxP-minP))*cW;
  const toY=v=>pad.t+cH-((v-minPnl)/range)*cH;
  const z=toY(0);
  const breakevens=useMemo(()=>{const bes=[];for(let i=1;i<pts.length;i++){if((pts[i-1].pnl<0&&pts[i].pnl>=0)||(pts[i-1].pnl>=0&&pts[i].pnl<0)){const r=Math.abs(pts[i-1].pnl)/(Math.abs(pts[i-1].pnl)+Math.abs(pts[i].pnl));bes.push(pts[i-1].p+(pts[i].p-pts[i-1].p)*r);}}return bes;},[pts]);
  const pathD=pts.map((x,i)=>`${i===0?"M":"L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ");
  const profitPts=pts.filter(x=>x.pnl>=0), lossPts=pts.filter(x=>x.pnl<0);
  const fillD=ps=>ps.length<2?"":(ps.map((x,i)=>`${i===0?"M":"L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ")+` L${toX(ps.at(-1).p).toFixed(1)},${z.toFixed(1)} L${toX(ps[0].p).toFixed(1)},${z.toFixed(1)} Z`);
  const handleMove=useCallback((clientX)=>{const svg=svgRef.current;if(!svg)return;const rect=svg.getBoundingClientRect();const cx=Math.max(pad.l,Math.min(pad.l+cW,(clientX-rect.left)*(W/rect.width)));const price=minP+((cx-pad.l)/cW)*(maxP-minP);setCursor({x:cx,price,pnl:calcPnL(price)});},[W,cW,pad.l,calcPnL,minP,maxP]);
  return (
    <div style={{position:"relative"}}>
      {cursor&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",background:"rgba(22,22,26,0.95)",border:`1px solid ${C.borderHi}`,borderRadius:8,padding:"4px 12px",display:"flex",gap:12,fontSize:10,fontFamily:"monospace",pointerEvents:"none",zIndex:10,whiteSpace:"nowrap"}}>
        <span style={{color:C.sub}}>Price <span style={{color:C.text,fontWeight:700}}>${cursor.price.toFixed(2)}</span></span>
        <span style={{color:cursor.pnl>=0?C.green:C.red,fontWeight:700}}>P&L {cursor.pnl>=0?"+":""}{cursor.pnl.toFixed(2)}</span>
      </div>}
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible",cursor:"crosshair"}}
        onMouseMove={e=>handleMove(e.clientX)} onMouseLeave={()=>setCursor(null)}
        onTouchMove={e=>{e.preventDefault();handleMove(e.touches[0].clientX);}} onTouchEnd={()=>setCursor(null)}>
        <defs>
          <linearGradient id="gP2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity="0.3"/><stop offset="100%" stopColor={C.green} stopOpacity="0.02"/></linearGradient>
          <linearGradient id="gL2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={C.red} stopOpacity="0.25"/><stop offset="100%" stopColor={C.red} stopOpacity="0.02"/></linearGradient>
        </defs>
        <text x={pad.l-4} y={pad.t+5} textAnchor="end" fill={C.muted} fontSize="7" fontFamily="monospace">+{maxPnl.toFixed(0)}</text>
        <text x={pad.l-4} y={H-pad.b+2} textAnchor="end" fill={C.muted} fontSize="7" fontFamily="monospace">{minPnl.toFixed(0)}</text>
        <line x1={pad.l} y1={z} x2={W-pad.r} y2={z} stroke="rgba(255,255,255,0.20)" strokeWidth="1.5"/>
        {strikes.map((s,i)=>(
          <g key={i}><line x1={toX(s)} y1={pad.t} x2={toX(s)} y2={H-pad.b} stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3 3"/>
          <text x={toX(s)} y={H-pad.b+(i%2===0?10:20)} textAnchor="middle" fill={C.sub} fontSize="6.5" fontFamily="monospace">${s}</text></g>
        ))}
        {breakevens.map((be,i)=>be>minP&&be<maxP&&(
          <g key={`be${i}`}><line x1={toX(be)} y1={pad.t} x2={toX(be)} y2={H-pad.b} stroke="rgba(243,156,18,0.5)" strokeWidth="1" strokeDasharray="2 3"/>
          <text x={toX(be)} y={pad.t-4} textAnchor="middle" fill={C.amber} fontSize="6.5" fontFamily="monospace">BE</text></g>
        ))}
        {profitPts.length>1&&<path d={fillD(profitPts)} fill="url(#gP2)"/>}
        {lossPts.length>1&&<path d={fillD(lossPts)} fill="url(#gL2)"/>}
        <path d={pathD} fill="none" stroke="rgba(240,240,245,0.80)" strokeWidth="1.8" strokeLinejoin="round"/>
        {cursor&&(()=>{const cy=toY(cursor.pnl);return(<>
          <line x1={cursor.x} y1={pad.t} x2={cursor.x} y2={H-pad.b} stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
          <circle cx={cursor.x} cy={cy} r={4} fill={cursor.pnl>=0?C.green:C.red} stroke="rgba(13,13,16,0.9)" strokeWidth={1.5}/>
        </>);})()}
      </svg>
      <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
        <span style={{fontSize:8,color:C.muted,display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block"}}/>{maxPnl>10000?"Max profit ∞":`Max profit $${maxPnl.toFixed(2)}`}</span>
        <span style={{fontSize:8,color:C.muted,display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:C.red,display:"inline-block"}}/>{`Max loss $${Math.abs(minPnl).toFixed(2)}`}</span>
        {breakevens.map((be,i)=><span key={i} style={{fontSize:8,color:C.muted,display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:C.amber,display:"inline-block"}}/>BE ${be.toFixed(2)}</span>)}
      </div>
    </div>
  );
}

// ─── DAILY INTELLIGENCE NEWS CARD ─────────────────────────────────────────────
function NewsCard({ symbol }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.getNews(symbol).then(d=>setNews(d||[])).catch(()=>setNews([])).finally(()=>setLoading(false));
  }, [symbol]);

  if (loading) return <div style={{padding:"16px 0",textAlign:"center",fontSize:11,color:C.muted}}>Loading intelligence…</div>;

  return (
    <div>

      {news.length===0
        ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"12px 0"}}>No recent news.</p>
        : news.slice(0,4).map((item,i)=>{
          const sentColor = item.sentiment==="positive"?C.green:item.sentiment==="negative"?C.red:C.amber;
          const sentBg = item.sentiment==="positive"?C.greenBg:item.sentiment==="negative"?C.redBg:"rgba(243,156,18,0.1)";
          const sentLabel = item.sentiment==="positive"?"BULLISH":item.sentiment==="negative"?"BEARISH":"NEUTRAL";
          return (
            <div key={i} style={{marginBottom:i<news.length-1?8:0,padding:"10px 12px",background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:10,animation:`fadeUp 0.2s ease ${i*0.06}s both`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:8,fontWeight:800,letterSpacing:1,color:sentColor,background:sentBg,padding:"2px 6px",borderRadius:4}}>{sentLabel}</span>
                  <span style={{fontSize:8,color:C.muted,fontWeight:600}}>{item.source}</span>
                </div>
                <span style={{fontSize:8,color:C.muted}}>{item.time}</span>
              </div>
              <p style={{fontSize:11.5,color:C.text,lineHeight:1.55,margin:0,fontWeight:500}}>{item.headline}</p>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── RATIONALE ────────────────────────────────────────────────────────────────
function getRationale(row) {
  if (row.rationale&&row.rationale.length>0) return {sigs:row.rationale,score:row.score||70};
  const isCall=(row.type||row.legs?.[0]?.type)==="C", pos=(row.change||0)>=0;
  const delta=Math.abs(row.delta||0), iv=row.iv||0;
  const sigs=[
    delta>0.6?`Strong delta (${delta.toFixed(2)}) reflects high directional conviction`:`Delta of ${delta.toFixed(2)} offers balanced risk exposure`,
    iv>40?`Elevated IV (${(iv>1?iv:iv*100).toFixed(1)}%) — market pricing in a sizeable move`:`Contained IV (${(iv>1?iv:iv*100).toFixed(1)}%) keeps entry cost efficient`,
    pos&&isCall?`Bullish momentum aligns with the call thesis`:!pos&&!isCall?`Softening price supports the put thesis`:`Mixed momentum — defined-risk exposure via ${row.strategy}`,
    `Open interest ${row.oi||'N/A'} confirms institutional activity at this strike`,
  ];
  const score=row.score||Math.min(95,Math.round(48+delta*30+(pos&&isCall?8:3)+(iv<35?6:0)));
  return {sigs,score};
}

// ─── RESULT ACCORDION CARD ────────────────────────────────────────────────────
function ResultCard({ row, index, isDesktop, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayoff, setShowPayoff] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const badge = getStrategyBadge(row.strategy, row.type||row.legs?.[0]?.type);
  const { sigs, score } = getRationale(row);
  const pos = (row.change||0) >= 0;
  const scoreColor = score>=80?C.green:score>=65?C.amber:C.red;
  const theta = row.theta||(-(0.06+(row.iv||0)/400));
  const strike = row.strike||row.legs?.[0]?.strike||0;
  const expiry = row.expiry||row.legs?.[0]?.expiry||'';

  const greeks = {
    Delta: (row.delta||0).toFixed(3),
    Gamma: (row.gamma||(0.031+Math.abs(row.delta||0)*0.015)).toFixed(4),
    Theta: theta.toFixed(4),
    Vega: (row.vega||(0.12+(row.iv||0)/500)).toFixed(4),
  };

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${expanded ? C.borderHi : C.border}`,
      borderRadius: 14,
      marginBottom: 8,
      overflow: "hidden",
      animation: `fadeUp 0.3s ease ${index*0.04}s both`,
      transition: "border-color 0.2s",
    }}>
      {/* ── Collapsed row header ── */}
      <div onClick={() => setExpanded(e=>!e)}
        style={{ display:"flex", alignItems:"center", padding:"12px 14px", cursor:"pointer", gap:10,
          background: expanded ? C.surfaceHi : "transparent", transition:"background 0.2s" }}>

        {/* Score ring */}
        <div style={{flexShrink:0}}>
          <ScoreRing score={score}/>
        </div>

        {/* Symbol + strategy — takes all remaining space, no badges/frames */}
        <div style={{flex:1, minWidth:0}}>
          {/* Line 1: symbol */}
          <div style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:C.text,letterSpacing:0.3,marginBottom:3,textDecoration:"none"}}>
            {row.symbol}
          </div>
          {/* Line 2: strategy · signal in colour */}
          <div style={{fontSize:11,fontWeight:700,marginBottom:2,textDecoration:"none"}}>
            <span style={{color:badge.fg}}>{row.strategy}</span>
            <span style={{color:C.muted}}> · </span>
            <span style={{color:row.signal==="BUY"?C.green:C.red}}>{row.signal}</span>
          </div>
          {/* Line 3: expiry — using a zero-width space prefix to prevent canvas markdown parsing */}
          <div style={{fontSize:10,color:C.muted,fontWeight:400,textDecoration:"none"}}>
            {"\u200B"}Exp {formatExpiry(expiry)}
          </div>
        </div>

        {/* Right: price stack — fixed width, no flex squash */}
        <div style={{textAlign:"right",flexShrink:0,minWidth:72}}>
          <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>${(row.underlying||0).toFixed(2)}</div>
          <div style={{fontSize:10,fontWeight:600,color:pos?C.green:C.red,whiteSpace:"nowrap"}}>{pos?"▲":"▼"}{Math.abs(row.change||0).toFixed(2)}%</div>
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
          style={{transition:"transform 0.25s",transform:expanded?"rotate(180deg)":"rotate(0deg)",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div style={{borderTop:`1px solid ${C.border}`,padding:"14px 16px",animation:"fadeUp 0.18s ease"}}>

          {/* Legs */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:8}}>POSITION LEGS</div>
            {(row.legs||[{signal:row.signal,type:row.type||"C",strike:row.strike||0,expiry:row.expiry,bid:row.bid,ask:row.ask}]).map((leg,i,arr)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",
                background:C.surfaceHi2,borderRadius:8,marginBottom:i<arr.length-1?5:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:8,fontWeight:800,color:leg.signal==="BUY"?C.green:C.red,
                    background:leg.signal==="BUY"?C.greenBg:C.redBg,padding:"2px 5px",borderRadius:4}}>{leg.signal}</span>
                  <span style={{fontFamily:"monospace",fontSize:10,color:C.sub}}>{leg.type==="C"?"Call":"Put"} {Number(leg.strike).toFixed(0)}</span>
                  <span style={{fontSize:9,color:C.muted}}>{leg.expiry}</span>
                </div>
                <span style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:C.text}}>
                  <span style={{color:C.green}}>${(leg.bid||0).toFixed(2)}</span>
                  <span style={{color:C.muted}}> / </span>
                  <span style={{color:C.red}}>${(leg.ask||0).toFixed(2)}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Net premium row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"7px 10px",background:C.surfaceHi2,borderRadius:8,marginBottom:14}}>
            <span style={{fontSize:9,letterSpacing:1,fontWeight:700,color:C.muted}}>NET PREMIUM</span>
            <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:C.text}}>
              ${(row.bid||0).toFixed(2)} <span style={{color:C.muted}}>/ </span>${(row.ask||0).toFixed(2)}
            </span>
          </div>

          {/* 2×2 data grid — Greeks left, Price right */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr",background:C.surfaceHi,borderRadius:10,marginBottom:14,overflow:"hidden"}}>
            <div style={{padding:"8px 12px"}}>
              <div style={{fontSize:7.5,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:6}}>GREEKS</div>
              {Object.entries(greeks).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:11,color:C.sub}}>{k}</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:C.text,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{background:C.border}}/>
            <div style={{padding:"8px 12px"}}>
              <div style={{fontSize:7.5,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:6}}>MARKET</div>
              {[
                {label:"Open",  value:`$${(row._quote?.open||0).toFixed(2)}`},
                {label:"High",  value:`$${(row._quote?.high||0).toFixed(2)}`},
                {label:"Low",   value:`$${(row._quote?.low||0).toFixed(2)}`},
                {label:"IV",    value:`${(row.iv||0).toFixed(1)}%`},
                {label:"OI",    value:row.oi||"—"},
                {label:"Vol",   value:row.vol||"—"},
              ].map(({label,value})=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:11,color:C.sub}}>{label}</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:C.text,fontWeight:600}}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Probability score bar */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted}}>PROBABILITY SCORE</span>
              <span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,color:scoreColor}}>{score}%</span>
            </div>
            <div style={{height:3,background:C.surfaceHi2,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${score}%`,background:scoreColor,borderRadius:2,transition:"width 0.8s ease"}}/>
            </div>
          </div>

          {/* Rationale bullets */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:8}}>WHY HIGH PROBABILITY</div>
            {sigs.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:6}}>
                <div style={{width:14,height:14,borderRadius:"50%",flexShrink:0,marginTop:1,
                  background:C.greenBg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{fontSize:11,color:C.sub,lineHeight:1.55}}>{s}</span>
              </div>
            ))}
          </div>

          {/* Payoff toggle */}
          <button onClick={()=>setShowPayoff(p=>!p)} style={{
            width:"100%",background:C.surfaceHi2,border:`1px solid ${C.border}`,borderRadius:10,
            padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,
          }}>
            <span style={{fontSize:11,fontWeight:600,color:C.text}}>Payoff Diagram</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{transition:"transform 0.22s",transform:showPayoff?"rotate(180deg)":"rotate(0)"}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showPayoff&&(
            <div style={{background:"rgba(0,0,0,0.25)",borderRadius:12,padding:"10px 8px 6px",marginBottom:8,animation:"fadeUp 0.18s ease"}}>
              <InteractivePayoff row={row}/>
            </div>
          )}

          {/* News toggle */}
          <button onClick={()=>setShowNews(p=>!p)} style={{
            width:"100%",background:C.surfaceHi2,border:`1px solid ${showNews?C.blueBorder:C.border}`,borderRadius:10,
            padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span style={{fontSize:11,fontWeight:600,color:showNews?C.blue:C.text}}>Daily Intelligence · {row.symbol}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{transition:"transform 0.22s",transform:showNews?"rotate(180deg)":"rotate(0)"}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showNews&&(
            <div style={{animation:"fadeUp 0.18s ease",marginBottom:4}}>
              <NewsCard symbol={row.symbol}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FILTER / SORT MODAL ──────────────────────────────────────────────────────
const STRATEGIES = ["All","Single Option","Call Spread","Put Spread","Iron Condor","Straddle","Bear Call Spread"];
const SORT_OPTIONS = [
  {key:"score",label:"Score"},
  {key:"symbol",label:"Symbol"},
  {key:"underlying",label:"Last Price"},
  {key:"delta",label:"Delta"},
  {key:"change",label:"% Change"},
  {key:"iv",label:"IV"},
];

function FilterModal({ open, onClose, strategy, setStrategy, sortKey, setSortKey, sortDir, setSortDir, filters, setFilters }) {
  if (!open) return null;
  const inputStyle = {
    width:"100%", background:C.surfaceHi2, border:`1px solid ${C.border}`,
    borderRadius:8, padding:"7px 10px", fontSize:12, color:C.text, fontFamily:"monospace",
  };
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:80,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn 0.18s ease"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:480,background:"#13131a",
        border:`1px solid ${C.borderHi}`,borderBottom:"none",
        borderRadius:"20px 20px 0 0",padding:"0 20px 40px",
        maxHeight:"88dvh",overflowY:"auto",animation:"slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Handle */}
        <div style={{width:36,height:4,background:C.surfaceHi,borderRadius:2,margin:"12px auto 18px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>Filter & Sort</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:22,lineHeight:1}}>×</button>
        </div>

        {/* Strategy */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:10}}>STRATEGY TYPE</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {STRATEGIES.map((s,i)=>(
              <button key={i} onClick={()=>setStrategy(i)} style={{
                padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
                background:strategy===i?C.blue:"transparent",
                color:strategy===i?"#fff":C.sub,
                border:`1px solid ${strategy===i?C.blue:C.border}`,
                transition:"all 0.15s",
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:10}}>SORT BY</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
            {SORT_OPTIONS.map(o=>(
              <button key={o.key} onClick={()=>setSortKey(o.key)} style={{
                padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
                background:sortKey===o.key?C.surfaceHi2:"transparent",
                color:sortKey===o.key?C.text:C.sub,
                border:`1px solid ${sortKey===o.key?C.borderHi:C.border}`,
                transition:"all 0.15s",
              }}>{o.label}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            {["desc","asc"].map(d=>(
              <button key={d} onClick={()=>setSortDir(d)} style={{
                flex:1,padding:"7px",borderRadius:10,fontSize:11,fontWeight:600,cursor:"pointer",
                background:sortDir===d?C.surfaceHi2:"transparent",
                color:sortDir===d?C.text:C.muted,
                border:`1px solid ${sortDir===d?C.borderHi:C.border}`,
              }}>{d==="desc"?"↓ High to Low":"↑ Low to High"}</button>
            ))}
          </div>
        </div>

        {/* Numeric filters */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:8,letterSpacing:1.5,fontWeight:700,color:C.muted,marginBottom:10}}>FILTERS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {key:"minVolume",label:"MIN VOLUME"},
              {key:"minMarketCap",label:"MIN MCAP"},
              {key:"ivRange",label:"IV RANGE"},
            ].map(f=>(
              <div key={f.key}>
                <div style={{fontSize:8,color:C.muted,fontWeight:700,marginBottom:5,letterSpacing:0.8}}>{f.label}</div>
                <input value={filters[f.key]} onChange={e=>setFilters(p=>({...p,[f.key]:e.target.value}))} style={inputStyle}/>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} style={{
          width:"100%",padding:"13px",borderRadius:14,
          background:C.blue,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:0.5,
        }}>Apply</button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const STRATEGIES_LIST = ["All","Single Option","Call Spread","Put Spread","Iron Condor","Straddle","Bear Call Spread"];

export default function OptionChamber() {
  const isDesktop = useIsDesktop();
  const [strategy, setStrategy] = useState(0);
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [ran, setRan] = useState(false);
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [error, setError] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ minVolume:"1M", minMarketCap:"10B", ivRange:"10-70%" });
  const [chipFilter, setChipFilter] = useState(null); // "bull" | "bear" | "highScore" | "topMove" | null

  const handleRun = async () => {
    setRunning(true); setError(null); setChipFilter(null);
    try {
      let data;
      const ticker = search.trim().toUpperCase();
      if (ticker) { data = await api.scanSingle(ticker); }
      else { data = await api.scanMarketWide({ minVolume:parseFilterValue(filters.minVolume), minMarketCap:parseFilterValue(filters.minMarketCap) }); }
      const quote = data.quote||{};
      const strategies = (data.strategies||[]).map(s=>({...s,_quote:quote}));
      setResults(strategies); setRan(true);
    } catch(err) { setError(err.message||"Scan failed."); setResults([]); setRan(true); }
    finally { setRunning(false); }
  };

  const filtered = useMemo(() => {
    let rows = strategy>0 ? results.filter(r=>r.strategy===STRATEGIES_LIST[strategy]) : results;
    if (chipFilter==="bull")      rows = rows.filter(r=>(r.change||0)>0);
    if (chipFilter==="bear")      rows = rows.filter(r=>(r.change||0)<0);
    if (chipFilter==="highScore") rows = rows.filter(r=>(r.score||0)>=75);
    if (chipFilter==="topMove")   rows = rows.filter(r=>Math.abs(r.change||0)===Math.max(...results.map(x=>Math.abs(x.change||0))));
    return [...rows].sort((a,b)=>{
      const av=a[sortKey]??0, bv=b[sortKey]??0;
      if (typeof av==='string') return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
      return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });
  }, [results, strategy, sortKey, sortDir]);

  // Summary stats for pills
  const bullishCount = results.filter(r=>(r.change||0)>0).length;
  const bearishCount = results.filter(r=>(r.change||0)<0).length;
  const avgScore = results.length ? Math.round(results.reduce((s,r)=>s+(r.score||0),0)/results.length) : null;
  const topMover = results.length ? results.reduce((best,r)=>Math.abs(r.change||0)>Math.abs(best.change||0)?r:best, results[0]) : null;

  return (
    <>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        input,select { outline:none; }
        input::placeholder { color:#5a5a6a; }
        option { background:#16161a; color:#f0f0f5; }
        button { font-family:inherit; }
      `}</style>

      <div style={{
        minHeight:"100dvh", background:C.bg, color:C.text,
        fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif",
        maxWidth: isDesktop?1100:448, margin:"0 auto",
        display:"flex", flexDirection:"column",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          padding: isDesktop?"32px 28px 0":"52px 16px 0",
          background:"rgba(13,13,16,0.94)",
          backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
          position:"sticky", top:0, zIndex:20,
          borderBottom:`1px solid ${C.border}`,
        }}>
          {/* Title row */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom: ran && results.length>0 ? 10 : 14}}>
            <div>
              <h1 style={{fontSize:isDesktop?28:24,fontWeight:800,letterSpacing:-0.8,lineHeight:1}}>
                <span style={{color:C.text}}>Option</span><span style={{color:C.muted}}> Chamber</span>
              </h1>
              <div style={{fontSize:10,color:C.muted,marginTop:4,fontWeight:500}}>{TODAY}</div>
            </div>
            {/* Desktop pills — inline right of title */}
            {isDesktop && ran && results.length>0 && (
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                <FilterPill label="BULL"  value={bullishCount}
                  color={C.green} bg="rgba(46,204,113,0.15)" border="rgba(46,204,113,0.30)"
                  active={chipFilter==="bull"} onClick={()=>setChipFilter(f=>f==="bull"?null:"bull")}/>
                <FilterPill label="BEAR"  value={bearishCount}
                  color={C.red}   bg="rgba(231,76,60,0.15)"  border="rgba(231,76,60,0.30)"
                  active={chipFilter==="bear"} onClick={()=>setChipFilter(f=>f==="bear"?null:"bear")}/>
                {avgScore!=null && <FilterPill label="AVG" value={`${avgScore}%`}
                  color={avgScore>=65?C.green:C.amber}
                  bg={avgScore>=65?"rgba(46,204,113,0.15)":"rgba(255,214,10,0.15)"}
                  border={avgScore>=65?"rgba(46,204,113,0.30)":"rgba(255,214,10,0.30)"}
                  active={chipFilter==="highScore"} onClick={()=>setChipFilter(f=>f==="highScore"?null:"highScore")}/>}
                {topMover && <FilterPill label="TOP" value={`${(topMover.change||0)>0?"+":""}${(topMover.change||0).toFixed(1)}%`}
                  color={(topMover.change||0)>0?C.green:C.red}
                  bg={(topMover.change||0)>0?"rgba(46,204,113,0.15)":"rgba(231,76,60,0.15)"}
                  border={(topMover.change||0)>0?"rgba(46,204,113,0.30)":"rgba(231,76,60,0.30)"}
                  active={chipFilter==="topMove"} onClick={()=>setChipFilter(f=>f==="topMove"?null:"topMove")}/>}
              </div>
            )}
          </div>

          {/* Mobile pills — 4-column grid beneath title, always fully visible */}
          {!isDesktop && ran && results.length>0 && (
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, marginBottom:12}}>
              <FilterPill label="BULL"  value={bullishCount}
                color={C.green} bg="rgba(46,204,113,0.15)" border="rgba(46,204,113,0.35)"
                active={chipFilter==="bull"} onClick={()=>setChipFilter(f=>f==="bull"?null:"bull")}/>
              <FilterPill label="BEAR"  value={bearishCount}
                color={C.red}   bg="rgba(231,76,60,0.15)"  border="rgba(231,76,60,0.35)"
                active={chipFilter==="bear"} onClick={()=>setChipFilter(f=>f==="bear"?null:"bear")}/>
              <FilterPill label="AVG" value={avgScore!=null?`${avgScore}%`:"—"}
                color={avgScore!=null&&avgScore>=65?C.green:C.amber}
                bg={avgScore!=null&&avgScore>=65?"rgba(46,204,113,0.15)":"rgba(255,214,10,0.15)"}
                border={avgScore!=null&&avgScore>=65?"rgba(46,204,113,0.35)":"rgba(255,214,10,0.35)"}
                active={chipFilter==="highScore"} onClick={()=>setChipFilter(f=>f==="highScore"?null:"highScore")}/>
              <FilterPill label="TOP" value={topMover?`${(topMover.change||0)>0?"+":""}${(topMover.change||0).toFixed(1)}%`:"—"}
                color={topMover&&(topMover.change||0)>0?C.green:C.red}
                bg={topMover&&(topMover.change||0)>0?"rgba(46,204,113,0.15)":"rgba(231,76,60,0.15)"}
                border={topMover&&(topMover.change||0)>0?"rgba(46,204,113,0.35)":"rgba(231,76,60,0.35)"}
                active={chipFilter==="topMove"} onClick={()=>setChipFilter(f=>f==="topMove"?null:"topMove")}/>
            </div>
          )}

          {/* Search + action row */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
            {/* Search input */}
            <div style={{flex:1,position:"relative"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"
                style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" placeholder="Enter ticker (or leave blank for market scan)"
                value={search} onChange={e=>setSearch(e.target.value.toUpperCase())}
                style={{
                  width:"100%",background:C.surfaceHi,border:`1px solid ${C.border}`,
                  borderRadius:10,padding:"9px 10px 9px 30px",
                  fontSize:12,fontFamily:"monospace",fontWeight:700,color:C.text,
                }}
              />
            </div>

            {/* Filter button */}
            <button onClick={()=>setShowFilter(true)} style={{
              background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:10,
              padding:"0 14px",height:38,cursor:"pointer",color:C.sub,
              display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,flexShrink:0,
              transition:"border-color 0.15s",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              {!isDesktop && "Filter"}
              {isDesktop && "Filter & Sort"}
            </button>

            {/* Run button */}
            <button onClick={handleRun} disabled={running} style={{
              background: running?"rgba(30,30,34,0.7)":"rgba(59,130,246,0.85)",
              border:`1px solid ${running?C.border:"rgba(59,130,246,0.5)"}`,
              borderRadius:10,padding:"0 18px",height:38,
              color:running?C.sub:"#fff",fontWeight:700,fontSize:11,letterSpacing:1,
              cursor:running?"default":"pointer",transition:"all 0.18s",
              display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",flexShrink:0,
            }}>
              {running
                ? <><span style={{width:10,height:10,border:`1.5px solid ${C.muted}`,borderTopColor:C.text,borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>SCANNING…</>
                : <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    RUN SCREENER
                  </>
              }
            </button>
          </div>

          {/* Active filter chips */}
          {ran && (
            <div style={{display:"flex",gap:6,paddingBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:9,color:C.muted,fontWeight:600}}>{filtered.length} result{filtered.length!==1?"s":""}</span>
              {strategy>0 && (
                <span style={{fontSize:9,background:C.blueBg,color:C.blue,border:`1px solid ${C.blueBorder}`,padding:"2px 8px",borderRadius:20,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  {STRATEGIES_LIST[strategy]}
                  <button onClick={()=>setStrategy(0)} style={{background:"none",border:"none",cursor:"pointer",color:C.blue,fontSize:12,lineHeight:1,padding:0}}>×</button>
                </span>
              )}
              <span style={{fontSize:9,background:C.surfaceHi,color:C.sub,border:`1px solid ${C.border}`,padding:"2px 8px",borderRadius:20,fontWeight:600}}>
                {SORT_OPTIONS.find(o=>o.key===sortKey)?.label||"Score"} {sortDir==="desc"?"↓":"↑"}
              </span>
            </div>
          )}
        </header>

        {/* ── RESULTS ── */}
        <main style={{flex:1,overflowY:"auto",padding:isDesktop?"20px 28px 40px":"12px 14px 40px"}}>

          {error && (
            <div style={{padding:"12px 16px",background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:12,marginBottom:12}}>
              <div style={{fontSize:11,color:C.red,fontWeight:600}}>{error}</div>
              <button onClick={handleRun} style={{marginTop:6,fontSize:10,color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Try Again</button>
            </div>
          )}

          {!ran && !running && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 24px",textAlign:"center"}}>
              <div style={{fontSize:52,marginBottom:18}}>🏛️</div>
              <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:10,letterSpacing:-0.5}}>The Option Chamber</h2>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.7,maxWidth:300}}>
                Enter a ticker and tap <strong style={{color:C.text}}>RUN SCREENER</strong> to scan a single stock, or leave blank to scan the full market.
              </p>
            </div>
          )}

          {ran && filtered.length===0 && !error && (
            <div style={{padding:"60px 18px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:10}}>🔍</div>
              <div style={{fontSize:14,color:C.sub,fontWeight:700,marginBottom:6}}>No strategies found</div>
              <div style={{fontSize:11,color:C.muted}}>Try a different symbol or adjust your filters</div>
            </div>
          )}

          {/* Accordion cards */}
          {filtered.map((row,i)=>(
            <ResultCard key={`${row.symbol}-${row.strategy}-${i}`} row={row} index={i} isDesktop={isDesktop}/>
          ))}
        </main>
      </div>

      {/* Filter modal */}
      <FilterModal
        open={showFilter} onClose={()=>setShowFilter(false)}
        strategy={strategy} setStrategy={setStrategy}
        sortKey={sortKey} setSortKey={setSortKey}
        sortDir={sortDir} setSortDir={setSortDir}
        filters={filters} setFilters={setFilters}
      />
    </>
  );
}
