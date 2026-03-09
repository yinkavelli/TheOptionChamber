import { useState, useMemo, useRef, useCallback } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const OPTIONS_DATA = [
  { symbol:"AAPL", underlying:182.63, strike:175.0, bid:4.75,  ask:4.95,  vol:"12.4k",  delta:0.64, iv:24.1, change: 2.45, type:"C", oi:"89.2k",  strategy:"Single Option", expiry:"20-OCT-26", signal:"BUY"  },
  { symbol:"TSLA", underlying:248.90, strike:245.0, bid:12.10, ask:12.50, vol:"45.2k",  delta:0.58, iv:52.8, change:-1.12, type:"C", oi:"124.5k", strategy:"Call Spread",   expiry:"27-OCT-26", signal:"BUY"  },
  { symbol:"NVDA", underlying:467.20, strike:450.0, bid:21.20, ask:21.70, vol:"8.1k",   delta:0.71, iv:41.2, change: 4.18, type:"C", oi:"56.7k",  strategy:"Single Option", expiry:"03-NOV-26", signal:"BUY"  },
  { symbol:"META", underlying:307.45, strike:310.0, bid:8.70,  ask:9.10,  vol:"15.6k",  delta:0.52, iv:32.5, change: 0.85, type:"P", oi:"43.1k",  strategy:"Put Spread",    expiry:"17-NOV-26", signal:"SELL" },
  {
    symbol:"AMZN", underlying:133.80, strike:135.0,
    bid:2.85, ask:3.10, vol:"22.9k", delta:0.06, iv:28.7, change:-0.21,
    type:"C", oi:"67.8k", strategy:"Iron Condor", expiry:"20-OCT-26", signal:"SELL",
    legs:[
      { signal:"SELL", type:"P", strike:125.0, expiry:"20-OCT-26", bid:1.60, ask:1.80 },
      { signal:"BUY",  type:"P", strike:120.0, expiry:"20-OCT-26", bid:0.80, ask:0.95 },
      { signal:"SELL", type:"C", strike:143.0, expiry:"20-OCT-26", bid:1.70, ask:1.90 },
      { signal:"BUY",  type:"C", strike:148.0, expiry:"20-OCT-26", bid:0.55, ask:0.70 },
    ],
  },
  {
    symbol:"MSFT", underlying:384.10, strike:384.0,
    bid:18.50, ask:19.20, vol:"11.3k", delta:0.05, iv:22.4, change:1.33,
    type:"C", oi:"38.4k", strategy:"Straddle", expiry:"19-JAN-27", signal:"BUY",
    legs:[
      { signal:"BUY", type:"C", strike:384.0, expiry:"19-JAN-27", bid:9.45, ask:9.75 },
      { signal:"BUY", type:"P", strike:384.0, expiry:"19-JAN-27", bid:9.05, ask:9.45 },
    ],
  },
  {
    symbol:"SPY", underlying:438.60, strike:440.0,
    bid:3.20, ask:3.45, vol:"187.1k", delta:0.04, iv:17.8, change:0.44,
    type:"P", oi:"412.0k", strategy:"Iron Condor", expiry:"03-NOV-26", signal:"SELL",
    legs:[
      { signal:"SELL", type:"P", strike:425.0, expiry:"03-NOV-26", bid:2.10, ask:2.30 },
      { signal:"BUY",  type:"P", strike:418.0, expiry:"03-NOV-26", bid:1.05, ask:1.20 },
      { signal:"SELL", type:"C", strike:452.0, expiry:"03-NOV-26", bid:2.15, ask:2.35 },
      { signal:"BUY",  type:"C", strike:459.0, expiry:"03-NOV-26", bid:0.85, ask:1.00 },
    ],
  },
];

const MOCK_NEWS = {
  AAPL:[
    {headline:"Apple set to unveil new AI features at WWDC, analysts bullish on services revenue",source:"Bloomberg",time:"2h ago",sentiment:"positive"},
    {headline:"iPhone 16 demand tracking above expectations in Asia Pacific markets",source:"Reuters",time:"4h ago",sentiment:"positive"},
    {headline:"Apple faces EU antitrust scrutiny over App Store payment policies",source:"FT",time:"1d ago",sentiment:"negative"},
  ],
  TSLA:[
    {headline:"Tesla Cybertruck delivery ramp accelerating, production bottleneck resolved",source:"Electrek",time:"1h ago",sentiment:"positive"},
    {headline:"Morgan Stanley cuts Tesla price target citing softening EV demand",source:"CNBC",time:"3h ago",sentiment:"negative"},
    {headline:"Musk confirms Full Self-Driving v13 rollout begins next month",source:"Bloomberg",time:"6h ago",sentiment:"positive"},
  ],
  NVDA:[
    {headline:"NVIDIA Blackwell GPU supply tightening as hyperscaler orders surge",source:"WSJ",time:"30m ago",sentiment:"positive"},
    {headline:"NVIDIA to power next-gen AI clusters at Microsoft Azure data centers",source:"Reuters",time:"2h ago",sentiment:"positive"},
    {headline:"Chip export restrictions could crimp NVIDIA's China revenue growth",source:"Bloomberg",time:"5h ago",sentiment:"negative"},
  ],
  META:[
    {headline:"Meta's Llama 4 outperforms GPT-4o on key reasoning benchmarks",source:"TechCrunch",time:"1h ago",sentiment:"positive"},
    {headline:"Instagram ad revenue growth re-accelerates in Q4 preliminary data",source:"CNBC",time:"3h ago",sentiment:"positive"},
    {headline:"Meta facing renewed pressure over teen safety on Instagram platform",source:"FT",time:"8h ago",sentiment:"negative"},
  ],
  AMZN:[
    {headline:"AWS re:Invent announcements drive cloud growth optimism for 2025",source:"Bloomberg",time:"2h ago",sentiment:"positive"},
    {headline:"Amazon logistics network expansion cuts delivery times to same-day",source:"Reuters",time:"5h ago",sentiment:"positive"},
    {headline:"FTC probe into Amazon Prime auto-renewal practices widens",source:"WSJ",time:"1d ago",sentiment:"negative"},
  ],
  MSFT:[
    {headline:"Microsoft Copilot adoption hitting 100M daily active users milestone",source:"Bloomberg",time:"45m ago",sentiment:"positive"},
    {headline:"Azure OpenAI capacity expansion boosts cloud segment outlook",source:"CNBC",time:"2h ago",sentiment:"positive"},
    {headline:"Microsoft Teams faces antitrust split ruling from EU regulators",source:"Reuters",time:"6h ago",sentiment:"negative"},
  ],
  SPY:[
    {headline:"S&P 500 breadth improving as small-caps join large-cap rally",source:"Bloomberg",time:"1h ago",sentiment:"positive"},
    {headline:"Fed officials signal patience on rate cuts amid sticky core inflation",source:"WSJ",time:"3h ago",sentiment:"negative"},
    {headline:"Options market pricing in elevated volatility around FOMC decision",source:"Reuters",time:"4h ago",sentiment:"neutral"},
  ],
};

const EXPIRATIONS = ["ALL","20-OCT-26","27-OCT-26","03-NOV-26","17-NOV-26","19-JAN-27"];
const STRATEGIES  = ["All","Single Option","Call Spread","Put Spread","Iron Condor","Straddle"];

// ─── THEME ────────────────────────────────────────────────────────────────────

const C = {
  bg:       "#111114",
  surface:  "#1e1e22",
  surfaceHi:"#2a2a2f",
  border:   "rgba(255,255,255,0.10)",
  borderHi: "rgba(255,255,255,0.20)",
  text:     "#f5f5f7",
  sub:      "#aeaeb2",
  muted:    "#6c6c70",
  green:    "#32d74b",
  greenBg:  "rgba(50,215,75,0.13)",
  red:      "#ff453a",
  redBg:    "rgba(255,69,58,0.13)",
  amber:    "#ffd60a",
  blue:     "#0a84ff",
  purple:   "#bf5af2",
};

const mid = r => (r.bid + r.ask) / 2;
const glass = (o={}) => ({
  background:"rgba(30,30,34,0.72)",
  backdropFilter:"blur(28px) saturate(180%)",
  WebkitBackdropFilter:"blur(28px) saturate(180%)",
  border:`1px solid ${C.border}`,
  ...o,
});
const fmt = new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
const TODAY = fmt.format(new Date());

// ─── DELTA RING ───────────────────────────────────────────────────────────────

function DeltaRing({delta}) {
  const r=13, circ=2*Math.PI*r, dash=circ*Math.abs(delta);
  const color = delta>=0.65?C.green:delta>=0.55?C.amber:delta>=0.45?C.blue:C.purple;
  const bg    = delta>=0.65?"rgba(50,215,75,0.15)":delta>=0.55?"rgba(255,214,10,0.15)":delta>=0.45?"rgba(10,132,255,0.15)":"rgba(191,90,242,0.15)";
  return (
    <svg width={34} height={34} viewBox="0 0 34 34">
      <circle cx={17} cy={17} r={r} fill={bg} stroke="rgba(255,255,255,0.05)" strokeWidth={1.5}/>
      <circle cx={17} cy={17} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x={17} y={21} textAnchor="middle" style={{fontFamily:"monospace",fontSize:8,fill:color,fontWeight:700}}>
        {delta.toFixed(2)}
      </text>
    </svg>
  );
}

// ─── IV BAR ───────────────────────────────────────────────────────────────────

function IVBar({iv}) {
  const pct=Math.min(iv/80*100,100);
  const color=iv>50?C.red:iv>35?C.amber:C.green;
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <div style={{width:26,height:2.5,background:C.surfaceHi,borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2}}/>
      </div>
      <span style={{fontSize:10,color,fontFamily:"monospace",fontWeight:600}}>{iv.toFixed(1)}%</span>
    </div>
  );
}

// ─── SIGNAL BADGE ─────────────────────────────────────────────────────────────

function SignalBadge({signal,size="sm"}) {
  const isBuy=signal==="BUY";
  return (
    <span style={{
      fontSize:size==="sm"?8:10,
      padding:size==="sm"?"1px 5px":"3px 9px",
      borderRadius:4,fontWeight:800,letterSpacing:0.8,
      background:isBuy?C.greenBg:C.redBg,
      color:isBuy?C.green:C.red,
      border:`1px solid ${isBuy?"rgba(50,215,75,0.28)":"rgba(255,69,58,0.28)"}`,
    }}>{signal}</span>
  );
}

// ─── RESULTS TABLE ───────────────────────────────────────────────────────────
// Layout: [Strategy fixed 108px] + [scrollable: ticker | expiry | last | bid/ask | IV | Δ | θ]

const STRATEGY_W = 112; // fixed left column width — never changes
const COL = {
  ticker:     { w: 90,  label: "TICKER",    align: "left",  sortKey: "symbol"     },
  expiry:     { w: 88,  label: "EXPIRY",    align: "left",  sortKey: "expiry"     },
  underlying: { w: 78,  label: "LAST",      align: "right", sortKey: "underlying" },
  bidask:     { w: 90,  label: "BID / ASK", align: "right", sortKey: "bid"        },
  delta:      { w: 54,  label: "Δ",         align: "right", sortKey: "delta"      },
  theta:      { w: 54,  label: "θ",         align: "right", sortKey: "theta"      },
};

const SCROLL_COLS = ["ticker","expiry","underlying","bidask","delta","theta"];
const SCROLL_W    = SCROLL_COLS.reduce((s,k) => s + COL[k].w, 0);

function TableHeader({sortKey, sortDir, onSort}) {
  const SI = ({colKey}) => {
    const active = sortKey === colKey;
    return (
      <span style={{fontSize:7,color:active?C.sub:C.muted,opacity:active?1:0.45,marginLeft:2}}>
        {active?(sortDir==="asc"?"▲":"▼"):"⇅"}
      </span>
    );
  };
  return (
    <div style={{display:"flex",position:"sticky",top:0,zIndex:8,background:C.surface,borderBottom:`1px solid ${C.border}`}}>
      {/* Fixed: Strategy */}
      <div style={{width:STRATEGY_W,flexShrink:0,padding:"9px 8px 9px 14px",display:"flex",alignItems:"center"}}>
        <span style={{fontSize:7.5,letterSpacing:1.5,fontWeight:700,color:C.muted}}>STRATEGY</span>
      </div>
      {/* Scrollable headers */}
      <div style={{flex:1,overflowX:"hidden",display:"flex"}}>
        <div style={{display:"flex",minWidth:SCROLL_W}}>
          {SCROLL_COLS.map(k=>{
            const col=COL[k];
            const canSort=!!col.sortKey;
            const active=sortKey===col.sortKey;
            return (
              <div key={k} onClick={()=>canSort&&onSort(col.sortKey)} style={{
                width:col.w,flexShrink:0,padding:"9px 8px 9px 0",
                display:"flex",alignItems:"center",
                justifyContent:col.align==="right"?"flex-end":"flex-start",
                cursor:canSort?"pointer":"default",gap:2,
              }}>
                <span style={{fontSize:7.5,letterSpacing:1.5,fontWeight:700,color:active?C.sub:C.muted}}>{col.label}</span>
                {canSort&&<SI colKey={col.sortKey}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OptionRow({row, idx, onAnalyze, scrollRef}) {
  const [hov,setHov]=useState(false);
  const pos=row.change>=0;
  const theta=(-(0.06+row.iv/400)).toFixed(4);
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={()=>onAnalyze(row)}
      style={{
        display:"flex", alignItems:"stretch",
        background:hov?C.surfaceHi:"transparent",
        borderBottom:`1px solid ${C.border}`,
        transition:"background 0.12s",cursor:"pointer",
        animation:"fadeUp 0.3s ease both",animationDelay:`${idx*0.04}s`,
      }}
    >
      {/* Fixed left: Strategy name + contextual badge + signal */}
      <div style={{width:STRATEGY_W,flexShrink:0,padding:"11px 8px 11px 14px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
        <div style={{fontSize:11,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:5}}>
          {row.strategy}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {(()=>{
            const s=row.strategy;
            let label,bg,fg;
            if(s==="Iron Condor"){label="CONDOR";bg="rgba(191,90,242,0.15)";fg=C.purple;}
            else if(s==="Straddle"){label="STRADDLE";bg="rgba(10,132,255,0.15)";fg=C.blue;}
            else if(s==="Call Spread"){label="DEBIT C";bg=C.greenBg;fg=C.green;}
            else if(s==="Put Spread"){label="CREDIT P";bg=C.redBg;fg=C.red;}
            else{label=row.type==="C"?"CALL":"PUT";bg=row.type==="C"?C.greenBg:C.redBg;fg=row.type==="C"?C.green:C.red;}
            return <span style={{fontSize:7.5,padding:"2px 5px",borderRadius:3,fontWeight:700,background:bg,color:fg,lineHeight:1}}>{label}</span>;
          })()}
          <SignalBadge signal={row.signal}/>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        style={{flex:1,overflowX:"auto",display:"flex",alignItems:"stretch"}}
        ref={el=>{if(el&&scrollRef){el.onscroll=()=>{ scrollRef.forEach(r=>{ if(r&&r!==el) r.scrollLeft=el.scrollLeft; }); }; scrollRef.push(el);}}}
      >
        <div style={{display:"flex",alignItems:"center",minWidth:SCROLL_W}}>

          {/* Ticker + strike */}
          <div style={{width:COL.ticker.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"left"}}>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:C.text,letterSpacing:0.5}}>{row.symbol}</div>
            <div style={{fontFamily:"monospace",fontSize:9,color:C.muted,marginTop:1}}>K ${row.strike.toFixed(0)}</div>
          </div>

          {/* Expiry */}
          <div style={{width:COL.expiry.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"left"}}>
            <div style={{fontFamily:"monospace",fontSize:10,fontWeight:600,color:C.sub,letterSpacing:0.3}}>{row.expiry}</div>
          </div>

          {/* Last / underlying */}
          <div style={{width:COL.underlying.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
            <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.text}}>${row.underlying.toFixed(2)}</div>
            <div style={{fontSize:9,fontWeight:600,color:pos?C.green:C.red}}>{pos?"▲":"▼"}{Math.abs(row.change).toFixed(2)}%</div>
          </div>

          {/* Bid / Ask — single column, stacked */}
          <div style={{width:COL.bidask.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
            <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.green}}>${row.bid.toFixed(2)}</div>
            <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.red  }}>${row.ask.toFixed(2)}</div>
          </div>

          {/* Delta ring */}
          <div style={{width:COL.delta.w,flexShrink:0,padding:"0 4px 0 0",display:"flex",justifyContent:"flex-end"}}>
            <DeltaRing delta={row.delta}/>
          </div>

          {/* Theta */}
          <div style={{width:COL.theta.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
            <div style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:C.red}}>{theta}</div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── INTERACTIVE PAYOFF ───────────────────────────────────────────────────────

function InteractivePayoff({row}) {
  const svgRef=useRef(null);
  const [cursor,setCursor]=useState(null);
  const W=320,H=130;
  const {strike,type}=row;
  const premium=mid(row);
  const isCall=type==="C";
  const minP=strike*0.83,maxP=strike*1.17;
  const steps=120;

  const pts=useMemo(()=>Array.from({length:steps+1},(_,i)=>{
    const p=minP+(maxP-minP)*(i/steps);
    const pnl=isCall?Math.max(0,p-strike)-premium:Math.max(0,strike-p)-premium;
    return {p,pnl};
  }),[strike,premium,isCall,minP,maxP]);

  const maxPnl=Math.max(...pts.map(x=>x.pnl));
  const minPnl=Math.min(...pts.map(x=>x.pnl));
  const range=maxPnl-minPnl||1;
  const pad={l:38,r:10,t:18,b:26};
  const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;

  const toX=v=>pad.l+((v-minP)/(maxP-minP))*cW;
  const toY=v=>pad.t+cH-((v-minPnl)/range)*cH;
  const z=toY(0);
  const bePrice=isCall?strike+premium:strike-premium;

  const pathD=pts.map((x,i)=>`${i===0?"M":"L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ");
  const profitPts=pts.filter(x=>x.pnl>=0);
  const lossPts=pts.filter(x=>x.pnl<0);
  const fillD=ps=>ps.length<2?"":
    ps.map((x,i)=>`${i===0?"M":"L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ")+
    ` L${toX(ps.at(-1).p).toFixed(1)},${z.toFixed(1)} L${toX(ps[0].p).toFixed(1)},${z.toFixed(1)} Z`;

  const handleMove=useCallback((clientX)=>{
    const svg=svgRef.current; if(!svg) return;
    const rect=svg.getBoundingClientRect();
    const scaleX=W/rect.width;
    const rawX=(clientX-rect.left)*scaleX;
    const cx=Math.max(pad.l,Math.min(pad.l+cW,rawX));
    const price=minP+((cx-pad.l)/cW)*(maxP-minP);
    const pnl=isCall?Math.max(0,price-strike)-premium:Math.max(0,strike-price)-premium;
    setCursor({x:cx,price,pnl});
  },[W,cW,pad.l,isCall,strike,premium,minP,maxP]);

  return (
    <div style={{position:"relative"}}>
      {cursor&&(
        <div style={{
          position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
          ...glass({borderRadius:8}),padding:"5px 12px",
          display:"flex",gap:14,fontSize:10,fontFamily:"monospace",
          pointerEvents:"none",zIndex:10,whiteSpace:"nowrap",
        }}>
          <span style={{color:C.sub}}>Price <span style={{color:C.text,fontWeight:700}}>${cursor.price.toFixed(2)}</span></span>
          <span style={{color:cursor.pnl>=0?C.green:C.red,fontWeight:700}}>
            P&L {cursor.pnl>=0?"+":""}{cursor.pnl.toFixed(2)}
          </span>
        </div>
      )}
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{overflow:"visible",cursor:"crosshair"}}
        onMouseMove={e=>handleMove(e.clientX)} onMouseLeave={()=>setCursor(null)}
        onTouchMove={e=>{e.preventDefault();handleMove(e.touches[0].clientX);}} onTouchEnd={()=>setCursor(null)}
      >
        <defs>
          <linearGradient id="gpP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.green} stopOpacity="0.28"/>
            <stop offset="100%" stopColor={C.green} stopOpacity="0.02"/>
          </linearGradient>
          <linearGradient id="gpL" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.red} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={C.red} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <text x={pad.l-4} y={pad.t+5}   textAnchor="end" fill={C.muted} fontSize="7.5" fontFamily="monospace">+{maxPnl.toFixed(0)}</text>
        <text x={pad.l-4} y={H-pad.b+2} textAnchor="end" fill={C.muted} fontSize="7.5" fontFamily="monospace">{minPnl.toFixed(0)}</text>
        <text x={pad.l-4} y={z+3}        textAnchor="end" fill={C.muted} fontSize="6.5" fontFamily="monospace">0</text>
        <line x1={pad.l} y1={z} x2={W-pad.r} y2={z} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3"/>
        {isCall&&<text x={W-pad.r-2} y={pad.t-4} textAnchor="end" fill={C.green} fontSize="7" fontFamily="monospace">MAX PROFIT: ∞</text>}
        <text x={pad.l+2} y={H-pad.b+18} textAnchor="start" fill={C.red} fontSize="7" fontFamily="monospace">MAX LOSS: -${premium.toFixed(2)}</text>
        <line x1={toX(strike)} y1={pad.t} x2={toX(strike)} y2={H-pad.b} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3"/>
        <text x={toX(strike)} y={H-pad.b+10} textAnchor="middle" fill={C.sub} fontSize="7.5" fontFamily="monospace">K={strike}</text>
        {bePrice>minP&&bePrice<maxP&&(
          <>
            <line x1={toX(bePrice)} y1={pad.t} x2={toX(bePrice)} y2={H-pad.b} stroke="rgba(255,214,10,0.4)" strokeWidth="1" strokeDasharray="2 3"/>
            <text x={toX(bePrice)} y={pad.t-5} textAnchor="middle" fill={C.amber} fontSize="7" fontFamily="monospace">BE ${bePrice.toFixed(1)}</text>
          </>
        )}
        {profitPts.length>1&&<path d={fillD(profitPts)} fill="url(#gpP)"/>}
        {lossPts.length>1&&<path d={fillD(lossPts)} fill="url(#gpL)"/>}
        <path d={pathD} fill="none" stroke="rgba(245,245,247,0.72)" strokeWidth="1.8" strokeLinejoin="round"/>
        {cursor&&(()=>{
          const cy=toY(cursor.pnl);
          return (
            <>
              <line x1={cursor.x} y1={pad.t} x2={cursor.x} y2={H-pad.b} stroke="rgba(255,255,255,0.28)" strokeWidth="1"/>
              <line x1={pad.l} y1={cy} x2={W-pad.r} y2={cy} stroke="rgba(255,255,255,0.14)" strokeWidth="1"/>
              <circle cx={cursor.x} cy={cy} r={4} fill={cursor.pnl>=0?C.green:C.red} stroke="rgba(17,17,20,0.8)" strokeWidth={1.5}/>
              <rect x={cursor.x-18} y={H-pad.b+3} width={36} height={13} rx={3} fill={C.surfaceHi}/>
              <text x={cursor.x} y={H-pad.b+12} textAnchor="middle" fill={C.text} fontSize="7" fontFamily="monospace" fontWeight="700">${cursor.price.toFixed(1)}</text>
              <rect x={2} y={cy-7} width={34} height={13} rx={3} fill={C.surfaceHi}/>
              <text x={19} y={cy+3} textAnchor="middle" fill={cursor.pnl>=0?C.green:C.red} fontSize="7" fontFamily="monospace" fontWeight="700">{cursor.pnl>=0?"+":""}{cursor.pnl.toFixed(1)}</text>
            </>
          );
        })()}
      </svg>
      <div style={{display:"flex",gap:16,marginTop:5,paddingLeft:2}}>
        {[{color:C.green,label:"Profit"},{color:C.red,label:`Max loss $${premium.toFixed(2)}`},{color:C.amber,label:`BE $${bePrice.toFixed(2)}`}].map(({color,label})=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:color}}/>
            <span style={{fontSize:8.5,color:C.muted}}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NEWS CARD ────────────────────────────────────────────────────────────────

function NewsCard({symbol}) {
  const news=MOCK_NEWS[symbol]||[];
  const sentColor=s=>s==="positive"?C.green:s==="negative"?C.red:C.amber;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {news.length===0?(
        <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:"16px 0"}}>No recent news found.</p>
      ):news.map((item,i)=>(
        <div key={i} style={{...glass({borderRadius:12}),padding:"12px 14px",animation:"fadeUp 0.25s ease both",animationDelay:`${i*0.06}s`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:sentColor(item.sentiment),boxShadow:`0 0 5px ${sentColor(item.sentiment)}`}}/>
              <span style={{fontSize:8.5,fontWeight:700,color:C.sub,letterSpacing:0.5}}>{item.source}</span>
            </div>
            <span style={{fontSize:8,color:C.muted}}>{item.time}</span>
          </div>
          <p style={{fontSize:11.5,color:C.text,lineHeight:1.5,margin:0}}>{item.headline}</p>
        </div>
      ))}
    </div>
  );
}

// ─── RATIONALE ────────────────────────────────────────────────────────────────

function getRationale(row) {
  const isCall=row.type==="C",pos=row.change>=0;
  const sigs=[
    row.delta>0.6?`Strong delta (${row.delta.toFixed(2)}) reflects high directional conviction`:`Delta of ${row.delta.toFixed(2)} offers balanced risk exposure`,
    row.iv>40?`Elevated IV (${row.iv.toFixed(1)}%) — market pricing in a sizeable move`:`Contained IV (${row.iv.toFixed(1)}%) keeps entry cost efficient`,
    pos&&isCall?`Bullish momentum (+${row.change.toFixed(2)}%) aligns with the call thesis`:!pos&&!isCall?`Softening price (${row.change.toFixed(2)}%) supports the put thesis`:`Mixed momentum — defined-risk exposure via ${row.strategy}`,
    `Open interest ${row.oi} confirms strong institutional activity at this strike`,
  ];
  const score=Math.min(95,Math.round(48+row.delta*30+(pos&&isCall?8:3)+(row.iv<35?6:0)));
  return {sigs,score};
}

// ─── COLLAPSIBLE SECTION ──────────────────────────────────────────────────────

function Section({title,subtitle,children,defaultOpen=false,icon=null}) {
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div style={{...glass({borderRadius:14}),overflow:"hidden",marginBottom:10}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",background:"none",border:"none",cursor:"pointer",
        padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {icon&&<div style={{width:26,height:26,borderRadius:7,background:C.surfaceHi,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>}
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{title}</div>
            {subtitle&&<div style={{fontSize:9,color:C.muted,marginTop:2}}>{subtitle}</div>}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
          style={{transition:"transform 0.25s",transform:open?"rotate(180deg)":"rotate(0deg)",flexShrink:0}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open&&(
        <div style={{padding:"0 16px 16px",animation:"fadeUp 0.2s ease"}}>
          <div style={{height:1,background:C.border,marginBottom:14}}/>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── ANALYZE PANEL ────────────────────────────────────────────────────────────

function AnalyzePanel({row,onClose}) {
  const [watched,setWatched]=useState(false);
  const {sigs,score}=getRationale(row);
  const scoreColor=score>=80?C.green:score>=65?C.amber:C.red;
  const pos=row.change>=0;
  const midPrice=mid(row);

  const greeks={
    Delta:row.delta.toFixed(3),
    Gamma:(0.031+row.delta*0.015).toFixed(4),
    Theta:(-(0.06+row.iv/400)).toFixed(4),
    Vega:(0.12+row.iv/500).toFixed(4),
    Rho:(0.04+row.delta*0.06).toFixed(4),
  };

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,zIndex:60,
      background:"rgba(0,0,0,0.6)",
      backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      animation:"fadeIn 0.18s ease",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%",maxWidth:448,
        background:"rgba(13,13,16,0.97)",
        border:`1px solid ${C.border}`,borderBottom:"none",
        borderRadius:"22px 22px 0 0",
        padding:"0 20px 40px",
        maxHeight:"94dvh",overflowY:"auto",
        animation:"slideUp 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Drag handle */}
        <div style={{width:36,height:4,background:C.surfaceHi,borderRadius:2,margin:"12px auto 10px"}}/>

        {/* Strategy name — very top, centered */}
        <div style={{textAlign:"center",marginBottom:10}}>
          <span style={{fontSize:9,letterSpacing:2,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{row.strategy}</span>
        </div>

        {/* Line 1: SYMBOL (left) + underlying price + change (right) */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontFamily:"monospace",fontSize:20,fontWeight:700,color:C.text,letterSpacing:0.3}}>{row.symbol}</span>
            <button onClick={e=>{e.stopPropagation();setWatched(w=>!w);}} style={{
              background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0,
              transform:watched?"scale(1.2)":"scale(1)",transition:"transform 0.15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24"
                fill={watched?C.text:"none"} stroke={watched?C.text:C.muted}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
          <div style={{textAlign:"right"}}>
            <span style={{fontFamily:"monospace",fontSize:15,fontWeight:600,color:C.sub}}>${row.underlying.toFixed(2)}</span>
            <span style={{fontSize:10,color:pos?C.green:C.red,fontWeight:600,marginLeft:6}}>{pos?"+":""}{row.change.toFixed(2)}%</span>
          </div>
        </div>

        {/* Hairline */}
        <div style={{height:1,background:"rgba(255,255,255,0.07)",marginBottom:7}}/>

        {/* Leg rows — one row per leg */}
        <div style={{marginBottom:10}}>
          {(row.legs||[{signal:row.signal,type:row.type,strike:row.strike,expiry:row.expiry,bid:row.bid,ask:row.ask}]).map((leg,i,arr)=>(
            <div key={i} style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"5px 0",
              borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <SignalBadge signal={leg.signal} size="sm"/>
                <span style={{fontFamily:"monospace",fontSize:11,color:C.sub,whiteSpace:"nowrap"}}>{leg.expiry}</span>
                <span style={{fontSize:11,color:C.sub}}>{leg.type==="C"?"Call":"Put"}</span>
                <span style={{fontFamily:"monospace",fontSize:11,color:C.sub}}>{leg.strike}</span>
              </div>
              <span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:C.text,whiteSpace:"nowrap",marginLeft:6}}>
                ${leg.bid.toFixed(2)} <span style={{color:C.muted,fontWeight:400}}>/</span> ${leg.ask.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Net premium */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:9,letterSpacing:1.5,fontWeight:600,color:C.muted}}>NET PREMIUM</span>
          <span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:C.text}}>${row.bid.toFixed(2)} / ${row.ask.toFixed(2)}</span>
        </div>

        {/* ══ DATA TABLE ══
            Two columns of label+value, one vertical divider, zero grid lines.
            Layout mirrors Apple Stocks:  label  value  |  label  value
        */}
        {(()=>{
          const open_ = (row.underlying * 0.994).toFixed(2);
          const high_ = (row.underlying * 1.011).toFixed(2);
          const low_  = (row.underlying * 0.987).toFixed(2);

          const left  = [
            { label:"Delta",  value: greeks.Delta },
            { label:"Gamma",  value: greeks.Gamma },
            { label:"Theta",  value: greeks.Theta },
            { label:"Vega",   value: greeks.Vega  },
          ];
          const right = [
            { label:"Open",  value: `$${open_}` },
            { label:"High",  value: `$${high_}` },
            { label:"Low",   value: `$${low_}`  },
            { label:"Last",  value: `$${row.underlying.toFixed(2)}` },
          ];

          return (
            <div style={{
              borderRadius:14, background:"rgba(26,26,30,0.95)",
              marginBottom:14, display:"grid",
              gridTemplateColumns:"1fr 1px 1fr",
            }}>
              {/* Left column */}
              <div style={{padding:"6px 16px 8px 16px"}}>
                {left.map((item,i)=>(
                  <div key={i} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"baseline",
                    padding:"7px 0",
                  }}>
                    <span style={{fontSize:13, color:"rgba(235,235,245,0.45)", fontWeight:400}}>{item.label}</span>
                    <span style={{fontFamily:"monospace", fontSize:13, fontWeight:500, color:C.text, letterSpacing:-0.3}}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Single vertical divider */}
              <div style={{background:"rgba(255,255,255,0.08)", margin:"12px 0"}}/>

              {/* Right column */}
              <div style={{padding:"6px 16px 8px 16px"}}>
                {right.map((item,i)=>(
                  <div key={i} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"baseline",
                    padding:"7px 0",
                  }}>
                    <span style={{fontSize:13, color:"rgba(235,235,245,0.45)", fontWeight:400}}>{item.label}</span>
                    <span style={{fontFamily:"monospace", fontSize:13, fontWeight:500, color:C.text, letterSpacing:-0.3}}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Payoff section */}
        <Section
          title="Payoff"
          subtitle={`Score ${score}% · ${row.strategy}`}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        >
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:8,letterSpacing:2,color:C.muted,fontWeight:700}}>PROBABILITY SCORE</span>
              <span style={{fontSize:11,fontFamily:"monospace",color:scoreColor,fontWeight:700}}>{score}%</span>
            </div>
            <div style={{height:3,background:C.surfaceHi,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${score}%`,background:scoreColor,borderRadius:2,transition:"width 0.8s ease"}}/>
            </div>
          </div>
          <div style={{background:"rgba(0,0,0,0.3)",borderRadius:12,padding:"10px 8px 6px",marginBottom:12}}>
            <InteractivePayoff row={row}/>
          </div>
          <div style={{fontSize:8,letterSpacing:2,color:C.muted,fontWeight:700,marginBottom:10}}>WHY HIGH PROBABILITY</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {sigs.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:15,height:15,borderRadius:"50%",flexShrink:0,marginTop:1,background:C.greenBg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{fontSize:11,color:C.sub,lineHeight:1.55}}>{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* News section */}
        <Section
          title={`News · ${row.symbol}`}
          subtitle="Recent headlines"
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>}
        >
          <NewsCard symbol={row.symbol}/>
        </Section>
      </div>
    </div>
  );
}

// ─── SORT LOGIC ───────────────────────────────────────────────────────────────

const SORT_KEYS=["underlying","bid","ask","iv","oi","delta"];

// ─── SCREENING CARD ───────────────────────────────────────────────────────────

function ScreeningCard({ search, setSearch, strategy, setStrategy, activeExp, setActiveExp, onRun, running }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{...glass({borderRadius:14}),overflow:"hidden",marginBottom:0}}>
      {/* Header row — always visible: [icon+title] [run btn] [chevron] */}
      <div style={{display:"flex",alignItems:"center",padding:"11px 12px 11px 14px",gap:8}}>

        {/* Left: icon + title — tappable to expand */}
        <button onClick={()=>setOpen(o=>!o)} style={{
          flex:1,background:"none",border:"none",cursor:"pointer",
          display:"flex",alignItems:"center",gap:10,textAlign:"left",padding:0,
        }}>
          <div style={{width:26,height:26,borderRadius:7,background:C.surfaceHi,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          </div>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Screening Criteria</span>
        </button>

        {/* Right: Run button + chevron */}
        <button onClick={onRun} disabled={running} style={{
          ...glass({borderRadius:9}),
          background:running?"rgba(30,30,34,0.7)":"rgba(245,245,247,0.10)",
          border:`1px solid ${running?C.border:C.borderHi}`,
          color:running?C.sub:C.text,
          padding:"7px 14px",fontWeight:700,fontSize:10,letterSpacing:1.5,
          cursor:running?"default":"pointer",transition:"all 0.18s",
          display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
          flexShrink:0,
        }}>
          {running
            ? <><span style={{width:9,height:9,border:`1.5px solid ${C.muted}`,borderTopColor:C.text,borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>SCANNING…</>
            : "RUN SCREENER"
          }
        </button>

        <button onClick={()=>setOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",padding:2,lineHeight:0,flexShrink:0}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
            style={{transition:"transform 0.25s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* Expanded body — compact layout: everything in 2 rows */}
      {open && (
        <div style={{padding:"0 12px 12px",animation:"fadeUp 0.18s ease"}}>
          <div style={{height:1,background:C.border,marginBottom:10}}/>

          {/* Row 1: Symbol search + Strategy dropdown side by side */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {/* Symbol */}
            <div style={{position:"relative"}}>
              <span style={{fontSize:8,letterSpacing:1.5,color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>SYMBOL</span>
              <div style={{position:"relative"}}>
                <span className="material-symbols-outlined" style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>search</span>
                <input type="text" placeholder="AAPL…" value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{width:"100%",...glass({borderRadius:8}),padding:"7px 8px 7px 26px",fontSize:12,color:C.text}}
                />
              </div>
            </div>
            {/* Strategy */}
            <div>
              <span style={{fontSize:8,letterSpacing:1.5,color:C.muted,fontWeight:700,display:"block",marginBottom:4}}>STRATEGY</span>
              <div style={{position:"relative"}}>
                <select value={strategy} onChange={e=>setStrategy(Number(e.target.value))}
                  style={{width:"100%",...glass({borderRadius:8}),padding:"7px 24px 7px 8px",fontSize:12,color:C.text,appearance:"none",cursor:"pointer"}}
                >
                  {STRATEGIES.map((s,i)=><option key={i} value={i}>{s}</option>)}
                </select>
                <span className="material-symbols-outlined" style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>expand_more</span>
              </div>
            </div>
          </div>

          {/* Row 2: Expiry pills + min criteria inline */}
          <div style={{marginBottom:8}}>
            <span style={{fontSize:8,letterSpacing:1.5,color:C.muted,fontWeight:700,display:"block",marginBottom:5}}>EXPIRY</span>
            <div style={{display:"flex",gap:5,overflowX:"auto"}}>
              {EXPIRATIONS.map((exp,i)=>{
                const active=i===activeExp;
                return (
                  <button key={i} onClick={()=>setActiveExp(i)} style={{
                    flexShrink:0,padding:"4px 9px",borderRadius:16,
                    fontSize:9,fontWeight:600,letterSpacing:0.3,fontFamily:"monospace",
                    background:active?C.text:"transparent",
                    color:active?C.bg:C.sub,
                    border:active?`1px solid ${C.text}`:`1px solid ${C.border}`,
                    cursor:"pointer",transition:"all 0.14s",
                  }}>{exp}</button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Min criteria — compact inline chips */}
          <div style={{display:"flex",gap:6}}>
            {[
              {label:"Vol",value:"≥$1M"},
              {label:"Cap",value:"≥$10B"},
              {label:"IVR",value:"10–70%"},
            ].map(c=>(
              <div key={c.label} style={{
                ...glass({borderRadius:7}),
                padding:"4px 8px",display:"flex",alignItems:"center",gap:5,flex:1,
              }}>
                <span style={{fontSize:7.5,color:C.muted}}>{c.label}</span>
                <span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:C.text}}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function OptionChamber() {
  const [activeExp, setActiveExp] = useState(0);
  const [strategy,  setStrategy]  = useState(0);
  const [search,    setSearch]    = useState("");
  const [selected,  setSelected]  = useState(null);
  const [running,   setRunning]   = useState(false);
  const [ran,       setRan]       = useState(true);
  const [sortKey,   setSortKey]   = useState("underlying");
  const [sortDir,   setSortDir]   = useState("desc");

  const handleRun=()=>{ setRunning(true); setRan(false); setTimeout(()=>{setRunning(false);setRan(true);},900); };

  const handleSort=key=>{
    setSortDir(d=>sortKey===key?(d==="asc"?"desc":"asc"):"desc");
    setSortKey(key);
  };

  const filtered=useMemo(()=>{
    const rows=OPTIONS_DATA.filter(r=>{
      const mS=!search||r.symbol.includes(search.toUpperCase());
      const mE=activeExp===0||r.expiry===EXPIRATIONS[activeExp];
      const mT=strategy===0||r.strategy===STRATEGIES[strategy];
      return mS&&mE&&mT;
    });
    const getVal=(r,key)=>{
      if(key==="theta") return -(0.06+r.iv/400);
      if(key==="strategy") return r.strategy.toLowerCase();
      const v=r[key];
      if(typeof v==="string") return parseFloat(v.replace(/[k$,]/gi,""))||v.toLowerCase();
      return v??0;
    };
    return [...rows].sort((a,b)=>{
      const av=getVal(a,sortKey), bv=getVal(b,sortKey);
      return sortDir==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });
  },[search,activeExp,strategy,sortKey,sortDir]);



  return (
    <>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        input,select{outline:none}
        input::placeholder{color:${C.muted}}
        option{background:#1e1e22;color:${C.text}}
        button{font-family:inherit}
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>

      <div style={{
        minHeight:"100dvh",background:C.bg,color:C.text,
        fontFamily:"-apple-system,'Helvetica Neue',Arial,sans-serif",
        display:"flex",flexDirection:"column",
        maxWidth:448,margin:"0 auto",position:"relative",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          padding:"52px 18px 0",
          background:"rgba(17,17,20,0.92)",
          backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",
          position:"sticky",top:0,zIndex:20,
        }}>
          {/* Title + date */}
          <div style={{marginBottom:14}}>
            <h1 style={{fontSize:26,fontWeight:700,letterSpacing:-0.5,lineHeight:1.1}}>
              <span style={{color:C.text}}>Options </span>
              <span style={{color:C.muted}}>Chamber</span>
            </h1>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>{TODAY}</div>
          </div>

          {/* ── SCREENING CARD — collapsible, contains all filters ── */}
          <ScreeningCard
            search={search} setSearch={setSearch}
            strategy={strategy} setStrategy={setStrategy}
            activeExp={activeExp} setActiveExp={setActiveExp}
            onRun={handleRun} running={running}
          />

        </header>

        {/* ── RESULTS ── */}
        {ran && (
          <main style={{flex:1,overflowY:"auto",paddingBottom:20,paddingTop:12,display:"flex",flexDirection:"column",minWidth:0}}>

            {/* TABLE: fixed Strategy col + single shared horizontal scroll for header+rows */}
            <div style={{display:"flex",flex:1,minWidth:0}}>

              {/* ── LEFT: Fixed Strategy column (header + all rows) ── */}
              <div style={{width:STRATEGY_W,flexShrink:0}}>
                {/* Strategy header */}
                <button onClick={()=>handleSort("strategy")} style={{
                  width:"100%",padding:"9px 8px 9px 14px",
                  display:"flex",alignItems:"center",gap:3,
                  background:"none",border:"none",borderBottom:`1px solid ${C.border}`,
                  cursor:"pointer",position:"sticky",top:0,zIndex:8,backgroundColor:C.bg,
                }}>
                  <span style={{fontSize:7.5,letterSpacing:1.5,fontWeight:800,color:sortKey==="strategy"?C.text:C.sub}}>STRATEGY</span>
                  <span style={{fontSize:7,color:sortKey==="strategy"?C.text:C.muted,opacity:sortKey==="strategy"?1:0.4}}>
                    {sortKey==="strategy"?(sortDir==="asc"?"▲":"▼"):"⇅"}
                  </span>
                </button>
                {/* Strategy rows */}
                {filtered.length===0?(
                  <div style={{padding:"40px 14px",color:C.muted,fontSize:12}}>No results</div>
                ):filtered.map((row,i)=>(
                  <div key={row.symbol} onClick={()=>setSelected(row)}
                    style={{
                      padding:"11px 8px 11px 14px",borderBottom:`1px solid ${C.border}`,
                      cursor:"pointer",animation:"fadeUp 0.3s ease both",animationDelay:`${i*0.04}s`,
                    }}>
                    <div style={{fontSize:11,fontWeight:600,color:C.text,lineHeight:1.3,marginBottom:5}}>{row.strategy}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      {(()=>{
                        const s=row.strategy;
                        let label,bg,fg;
                        if(s==="Iron Condor"){label="CONDOR";bg="rgba(191,90,242,0.15)";fg=C.purple;}
                        else if(s==="Straddle"){label="STRADDLE";bg="rgba(10,132,255,0.15)";fg=C.blue;}
                        else if(s==="Call Spread"){label="DEBIT C";bg=C.greenBg;fg=C.green;}
                        else if(s==="Put Spread"){label="CREDIT P";bg=C.redBg;fg=C.red;}
                        else{label=row.type==="C"?"CALL":"PUT";bg=row.type==="C"?C.greenBg:C.redBg;fg=row.type==="C"?C.green:C.red;}
                        return <span style={{fontSize:7.5,padding:"2px 5px",borderRadius:3,fontWeight:700,background:bg,color:fg,lineHeight:1}}>{label}</span>;
                      })()}
                      <SignalBadge signal={row.signal}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── RIGHT: Single horizontal scroll container for ALL header+row data ── */}
              <div style={{flex:1,overflowX:"auto",minWidth:0}}>
                {/* Sticky scrollable header */}
                <div style={{
                  display:"flex",minWidth:SCROLL_W,
                  position:"sticky",top:0,zIndex:8,backgroundColor:C.bg,
                  borderBottom:`1px solid ${C.border}`,
                }}>
                  {SCROLL_COLS.map(k=>{
                    const col=COL[k];
                    const active=sortKey===col.sortKey;
                    return (
                      <button key={k} onClick={()=>col.sortKey&&handleSort(col.sortKey)} style={{
                        width:col.w,flexShrink:0,padding:"9px 8px 9px 0",
                        background:"none",border:"none",cursor:col.sortKey?"pointer":"default",
                        display:"flex",alignItems:"center",
                        justifyContent:col.align==="right"?"flex-end":"flex-start",gap:2,
                      }}>
                        <span style={{fontSize:7.5,letterSpacing:1.5,fontWeight:800,color:active?C.text:C.sub}}>{col.label}</span>
                        {col.sortKey&&<span style={{fontSize:7,color:active?C.text:C.muted,opacity:active?1:0.4}}>{active?(sortDir==="asc"?"▲":"▼"):"⇅"}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable data rows — same container, no sync needed */}
                {filtered.length===0?null:filtered.map((row,i)=>{
                  const pos=row.change>=0;
                  const theta=(-(0.06+row.iv/400)).toFixed(4);
                  return (
                    <div key={row.symbol} onClick={()=>setSelected(row)}
                      style={{
                        display:"flex",minWidth:SCROLL_W,
                        borderBottom:`1px solid ${C.border}`,
                        cursor:"pointer",alignItems:"center",
                        minHeight:58,  /* match left column row height */
                        animation:"fadeUp 0.3s ease both",animationDelay:`${i*0.04}s`,
                      }}>

                      <div style={{width:COL.ticker.w,flexShrink:0,padding:"11px 8px 11px 0"}}>
                        <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:C.text,letterSpacing:0.5}}>{row.symbol}</div>
                        <div style={{fontFamily:"monospace",fontSize:9,color:C.muted,marginTop:1}}>K ${row.strike.toFixed(0)}</div>
                      </div>

                      <div style={{width:COL.expiry.w,flexShrink:0,padding:"0 8px 0 0"}}>
                        <div style={{fontFamily:"monospace",fontSize:10,fontWeight:600,color:C.sub,letterSpacing:0.3}}>{row.expiry}</div>
                      </div>

                      <div style={{width:COL.underlying.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
                        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.text}}>${row.underlying.toFixed(2)}</div>
                        <div style={{fontSize:9,fontWeight:600,color:pos?C.green:C.red}}>{pos?"▲":"▼"}{Math.abs(row.change).toFixed(2)}%</div>
                      </div>

                      <div style={{width:COL.bidask.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
                        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.green}}>${row.bid.toFixed(2)}</div>
                        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.red  }}>${row.ask.toFixed(2)}</div>
                      </div>

                      <div style={{width:COL.delta.w,flexShrink:0,padding:"0 4px 0 0",display:"flex",justifyContent:"flex-end",alignItems:"center"}}>
                        <DeltaRing delta={row.delta}/>
                      </div>

                      <div style={{width:COL.theta.w,flexShrink:0,padding:"0 8px 0 0",textAlign:"right"}}>
                        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:C.red}}>{theta}</div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          </main>
        )}

        {selected&&<AnalyzePanel row={selected} onClose={()=>setSelected(null)}/>}
      </div>
    </>
  );
}
