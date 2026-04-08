import { useState, useMemo, useRef, useCallback, useEffect } from "react";

import { api } from "./api.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#050506",
  surface: "#0c0c0e",
  surfaceHi: "#111114",
  surfaceHi2: "#18181c",
  border: "rgba(255,255,255,0.06)",
  borderHi: "rgba(255,255,255,0.12)",
  text: "#e8e8ed",
  sub: "#8a8a9a",
  muted: "#4a4a58",
  green: "#10B981",
  greenBg: "rgba(16,185,129,0.10)",
  greenBorder: "rgba(16,185,129,0.22)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.10)",
  redBorder: "rgba(239,68,68,0.22)",
  amber: "#f59e0b",
  blue: "#3b82f6",
  blueBg: "rgba(59,130,246,0.10)",
  blueBorder: "rgba(59,130,246,0.22)",
  purple: "#8b5cf6",
  purpleBg: "rgba(139,92,246,0.10)",
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

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const TODAY = fmt.format(new Date());

function parseFilterValue(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.kKmMbBtT]/g, '');
  const num = parseFloat(cleaned) || 0;
  const suffix = cleaned.slice(-1).toUpperCase();
  if (suffix === 'K') return num * 1e3;
  if (suffix === 'M') return num * 1e6;
  if (suffix === 'B') return num * 1e9;
  return num;
}

function formatExpiry(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  } catch { return dateStr; }
}

// ─── STRATEGY BADGE CONFIG ────────────────────────────────────────────────────
function getStrategyBadge(strategy, type) {
  if (strategy === "Iron Condor") return { label: "CONDOR", bg: "rgba(139,92,246,0.18)", fg: C.purple, border: "rgba(139,92,246,0.35)" };
  if (strategy === "Straddle") return { label: "STRADDLE", bg: "rgba(59,130,246,0.18)", fg: C.blue, border: "rgba(59,130,246,0.35)" };
  if (strategy === "Call Spread") return { label: "DEBIT C", bg: C.greenBg, fg: C.green, border: C.greenBorder };
  if (strategy === "Put Spread") return { label: "CREDIT P", bg: C.redBg, fg: C.red, border: C.redBorder };
  if (strategy === "Bear Call Spread") return { label: "BEAR C", bg: C.redBg, fg: C.red, border: C.redBorder };
  const t = type || "C";
  return t === "C"
    ? { label: "CALL", bg: C.greenBg, fg: C.green, border: C.greenBorder }
    : { label: "PUT", bg: C.redBg, fg: C.red, border: C.redBorder };
}

// ─── FILTER PILL (interactive summary cards top-right) ───────────────────────
function FilterPill({ label, value, color, bg, border, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: bg,
      border: `1.5px solid ${active ? color : border}`,
      borderRadius: 8, padding: "5px 9px", cursor: "pointer",
      transition: "all 0.15s", flexShrink: 0, flexGrow: 1,
      boxShadow: active ? `0 0 12px ${border}` : "none",
      opacity: active ? 1 : 0.72,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 8, letterSpacing: 1, color, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 800, color, letterSpacing: -0.3, whiteSpace: "nowrap" }}>{value}</span>
    </button>
  );
}

// ─── SCORE RING ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 16, circ = 2 * Math.PI * r, dash = circ * (score / 100);
  const color = score >= 80 ? C.green : score >= 65 ? C.amber : C.red;
  return (
    <svg width={40} height={40} viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <text x={20} y={24} textAnchor="middle" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fill: color, fontWeight: 800 }}>{score}</text>
    </svg>
  );
}

// ─── DELTA RING ────────────────────────────────────────────────────────────────
function DeltaRing({ delta }) {
  const d = Math.abs(delta || 0);
  const r = 11, circ = 2 * Math.PI * r, dash = circ * d;
  const color = d >= 0.65 ? C.green : d >= 0.55 ? C.amber : d >= 0.45 ? C.blue : C.purple;
  return (
    <svg width={28} height={28} viewBox="0 0 28 28">
      <circle cx={14} cy={14} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <text x={14} y={18} textAnchor="middle" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 7, fill: color, fontWeight: 700 }}>{d.toFixed(2)}</text>
    </svg>
  );
}

// ─── PAYOFF CHART ─────────────────────────────────────────────────────────────
function InteractivePayoff({ row }) {
  const svgRef = useRef(null);
  const [cursor, setCursor] = useState(null);
  const W = 320, H = 110;
  const legs = row.legs || [{ signal: row.signal || 'BUY', type: row.type || 'C', strike: row.strike || 0, bid: row.bid || 0, ask: row.ask || 0 }];
  const calcPnL = useCallback((price) => {
    let pnl = 0;
    for (const leg of legs) {
      const legMid = ((leg.bid || 0) + (leg.ask || 0)) / 2;
      const isCall = leg.type === 'C';
      const intrinsic = isCall ? Math.max(0, price - leg.strike) : Math.max(0, leg.strike - price);
      pnl += leg.signal === 'BUY' ? intrinsic - legMid : legMid - intrinsic;
    }
    return pnl;
  }, [legs]);
  const strikes = legs.map(l => l.strike).filter(s => s > 0);
  const uPrice = row.underlying || 0;
  const minStrike = Math.min(...strikes, uPrice || Infinity), maxStrike = Math.max(...strikes, uPrice || 0);
  const spread = maxStrike - minStrike || maxStrike * 0.1 || 10;
  const pad2 = Math.max(spread * 0.8, maxStrike * 0.04);
  const minP = minStrike - pad2, maxP = maxStrike + pad2;
  const pts = useMemo(() => Array.from({ length: 161 }, (_, i) => { const p = minP + (maxP - minP) * (i / 160); return { p, pnl: calcPnL(p) }; }), [calcPnL, minP, maxP]);
  const maxPnl = Math.max(...pts.map(x => x.pnl)), minPnl = Math.min(...pts.map(x => x.pnl));
  const range = maxPnl - minPnl || 1;
  const pad = { l: 36, r: 8, t: 16, b: 32 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const toX = v => pad.l + ((v - minP) / (maxP - minP)) * cW;
  const toY = v => pad.t + cH - ((v - minPnl) / range) * cH;
  const z = toY(0);
  const breakevens = useMemo(() => { const bes = []; for (let i = 1; i < pts.length; i++) { if ((pts[i - 1].pnl < 0 && pts[i].pnl >= 0) || (pts[i - 1].pnl >= 0 && pts[i].pnl < 0)) { const r = Math.abs(pts[i - 1].pnl) / (Math.abs(pts[i - 1].pnl) + Math.abs(pts[i].pnl)); bes.push(pts[i - 1].p + (pts[i].p - pts[i - 1].p) * r); } } return bes; }, [pts]);
  const pathD = pts.map((x, i) => `${i === 0 ? "M" : "L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ");
  const profitPts = pts.filter(x => x.pnl >= 0), lossPts = pts.filter(x => x.pnl < 0);
  const fillD = ps => ps.length < 2 ? "" : (ps.map((x, i) => `${i === 0 ? "M" : "L"}${toX(x.p).toFixed(1)},${toY(x.pnl).toFixed(1)}`).join(" ") + ` L${toX(ps.at(-1).p).toFixed(1)},${z.toFixed(1)} L${toX(ps[0].p).toFixed(1)},${z.toFixed(1)} Z`);
  const handleMove = useCallback((clientX) => { const svg = svgRef.current; if (!svg) return; const rect = svg.getBoundingClientRect(); const cx = Math.max(pad.l, Math.min(pad.l + cW, (clientX - rect.left) * (W / rect.width))); const price = minP + ((cx - pad.l) / cW) * (maxP - minP); setCursor({ x: cx, price, pnl: calcPnL(price) }); }, [W, cW, pad.l, calcPnL, minP, maxP]);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", padding: "0 4px" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, display: "inline-block" }} />{maxPnl > 10000 ? "Max profit ∞" : `Max profit $${maxPnl.toFixed(2)}`}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: C.red, display: "inline-block" }} />{`Max loss $${Math.abs(minPnl).toFixed(2)}`}</span>
        {breakevens.map((be, i) => <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: C.amber, display: "inline-block" }} />BE ${be.toFixed(2)}</span>)}
      </div>
      {cursor && <div style={{ position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", background: "rgba(22,22,26,0.95)", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "4px 12px", display: "flex", gap: 12, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap" }}>
        <span style={{ color: C.sub }}>Price <span style={{ color: C.text, fontWeight: 700 }}>${cursor.price.toFixed(2)}</span></span>
        <span style={{ color: cursor.pnl >= 0 ? C.green : C.red, fontWeight: 700 }}>P&L {cursor.pnl >= 0 ? "+" : ""}{cursor.pnl.toFixed(2)}</span>
      </div>}
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={e => handleMove(e.clientX)} onMouseLeave={() => setCursor(null)}
        onTouchMove={e => { e.preventDefault(); handleMove(e.touches[0].clientX); }} onTouchEnd={() => setCursor(null)}>
        <defs>
          <linearGradient id="gP2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity="0.3" /><stop offset="100%" stopColor={C.green} stopOpacity="0.02" /></linearGradient>
          <linearGradient id="gL2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={C.red} stopOpacity="0.25" /><stop offset="100%" stopColor={C.red} stopOpacity="0.02" /></linearGradient>
        </defs>
        <text x={pad.l - 4} y={pad.t + 5} textAnchor="end" fill={C.muted} fontSize="7" fontFamily="monospace">+{maxPnl.toFixed(0)}</text>
        <text x={pad.l - 4} y={H - pad.b + 2} textAnchor="end" fill={C.muted} fontSize="7" fontFamily="monospace">{minPnl.toFixed(0)}</text>
        <line x1={pad.l} y1={z} x2={W - pad.r} y2={z} stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" />
        {strikes.map((s, i) => (
          <g key={i}><line x1={toX(s)} y1={pad.t} x2={toX(s)} y2={H - pad.b} stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={toX(s)} y={H - pad.b + (i % 2 === 0 ? 10 : 20)} textAnchor="middle" fill={C.sub} fontSize="6.5" fontFamily="monospace">${s}</text></g>
        ))}
        {breakevens.map((be, i) => be > minP && be < maxP && (
          <g key={`be${i}`}><line x1={toX(be)} y1={pad.t} x2={toX(be)} y2={H - pad.b} stroke="rgba(243,156,18,0.5)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={toX(be)} y={pad.t - 4} textAnchor="middle" fill={C.amber} fontSize="6.5" fontFamily="monospace">BE</text></g>
        ))}
        {uPrice > 0 && (() => {
          const uX = toX(uPrice);
          const uPnl = calcPnL(uPrice);
          const uY = toY(uPnl);
          return (
            <g opacity={cursor ? 0.3 : 1} style={{ transition: "opacity 0.2s" }}>
              <line x1={uX} y1={pad.t} x2={uX} y2={H - pad.b} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="2 4" />
              <circle cx={uX} cy={uY} r={3.5} fill={C.surfaceHi} stroke={uPnl >= 0 ? C.green : C.red} strokeWidth="1.5" />
              <text x={uX} y={pad.t - 10} textAnchor="middle" fill={C.text} fontSize="6.5" fontFamily="monospace" fontWeight="800">CURRENT</text>
              <text x={uX} y={uY > z ? uY - 8 : uY + 12} textAnchor="middle" fill={uPnl >= 0 ? C.green : C.red} fontSize="7.5" fontFamily="monospace" fontWeight="800" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{uPnl >= 0 ? "+" : "-"}${Math.abs(uPnl).toFixed(2)}</text>
            </g>
          );
        })()}
        {profitPts.length > 1 && <path d={fillD(profitPts)} fill="url(#gP2)" />}
        {lossPts.length > 1 && <path d={fillD(lossPts)} fill="url(#gL2)" />}
        <path d={pathD} fill="none" stroke="rgba(240,240,245,0.80)" strokeWidth="1.8" strokeLinejoin="round" />
        {cursor && (() => {
          const cy = toY(cursor.pnl); return (<>
            <line x1={cursor.x} y1={pad.t} x2={cursor.x} y2={H - pad.b} stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
            <circle cx={cursor.x} cy={cy} r={4} fill={cursor.pnl >= 0 ? C.green : C.red} stroke="rgba(13,13,16,0.9)" strokeWidth={1.5} />
          </>);
        })()}
      </svg>
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
    api.getNews(symbol).then(d => setNews(d || [])).catch(() => setNews([])).finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <div style={{ padding: "16px 0", textAlign: "center", fontSize: 11, color: C.muted }}>Loading intelligence…</div>;

  return (
    <div>

      {news.length === 0
        ? <p style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "12px 0" }}>No recent news.</p>
        : news.slice(0, 4).map((item, i) => {
          const sentColor = item.sentiment === "positive" ? C.green : item.sentiment === "negative" ? C.red : C.amber;
          const sentBg = item.sentiment === "positive" ? C.greenBg : item.sentiment === "negative" ? C.redBg : "rgba(243,156,18,0.1)";
          const sentLabel = item.sentiment === "positive" ? "BULLISH" : item.sentiment === "negative" ? "BEARISH" : "NEUTRAL";
          return (
            <div key={i} style={{ marginBottom: i < news.length - 1 ? 8 : 0, padding: "10px 12px", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 10, animation: `fadeUp 0.2s ease ${i * 0.06}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, color: sentColor, background: sentBg, padding: "2px 6px", borderRadius: 4 }}>{sentLabel}</span>
                  <span style={{ fontSize: 8, color: C.muted, fontWeight: 600 }}>{item.source}</span>
                </div>
                <span style={{ fontSize: 8, color: C.muted }}>{item.time}</span>
              </div>
              <p style={{ fontSize: 11.5, color: C.text, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>{item.headline}</p>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── RATIONALE ────────────────────────────────────────────────────────────────
function getRationale(row) {
  if (row.rationale && row.rationale.length > 0) return { sigs: row.rationale, score: row.score || 70 };
  const isCall = (row.type || row.legs?.[0]?.type) === "C", pos = (row.change || 0) >= 0;
  const delta = Math.abs(row.delta || 0), iv = row.iv || 0;
  const sigs = [
    delta > 0.6 ? `Strong delta (${delta.toFixed(2)}) reflects high directional conviction` : `Delta of ${delta.toFixed(2)} offers balanced risk exposure`,
    iv > 40 ? `Elevated IV (${(iv > 1 ? iv : iv * 100).toFixed(1)}%) — market pricing in a sizeable move` : `Contained IV (${(iv > 1 ? iv : iv * 100).toFixed(1)}%) keeps entry cost efficient`,
    pos && isCall ? `Bullish momentum aligns with the call thesis` : !pos && !isCall ? `Softening price supports the put thesis` : `Mixed momentum — defined-risk exposure via ${row.strategy}`,
    `Open interest ${row.oi || 'N/A'} confirms institutional activity at this strike`,
  ];
  const score = row.score || Math.min(95, Math.round(48 + delta * 30 + (pos && isCall ? 8 : 3) + (iv < 35 ? 6 : 0)));
  return { sigs, score };
}

// ─── RESULT ACCORDION CARD ────────────────────────────────────────────────────
function ResultCard({ row, index, isDesktop, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayoff, setShowPayoff] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const badge = getStrategyBadge(row.strategy, row.type || row.legs?.[0]?.type);
  const { sigs, score } = getRationale(row);
  const pos = (row.change || 0) >= 0;
  const scoreColor = score >= 80 ? C.green : score >= 65 ? C.amber : C.red;
  const theta = row.theta || (-(0.06 + (row.iv || 0) / 400));
  const strike = row.strike || row.legs?.[0]?.strike || 0;
  const expiry = row.expiry || row.legs?.[0]?.expiry || '';

  // Risk / Reward calculations
  const maxProfit = row.maxProfit || 0;
  const maxRisk = row.maxRisk || row.debit || 0;
  const rr = row.riskReward || (maxRisk > 0 ? Math.round((maxProfit === Infinity ? 999 : maxProfit / maxRisk) * 100) / 100 : 0);
  const rrColor = rr >= 2 ? C.green : rr >= 1 ? C.amber : C.red;
  const fmtPnL = (v) => v === Infinity ? '∞' : `$${Math.abs(v).toFixed(0)}`;

  // Margin & scenario fields
  const margin = row.estimatedMargin || 0;
  const rom = row.returnOnMargin || 0;
  const romColor = rom >= 1.5 ? C.green : rom >= 1 ? C.amber : C.red;
  const hasScenario = row.scenarioPnL != null;
  const scenPnL = row.scenarioPnL || 0;

  const greeks = {
    Delta: (row.delta || 0).toFixed(3),
    Gamma: (row.gamma || (0.031 + Math.abs(row.delta || 0) * 0.015)).toFixed(4),
    Theta: theta.toFixed(4),
    Vega: (row.vega || (0.12 + (row.iv || 0) / 500)).toFixed(4),
  };

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${expanded ? C.borderHi : C.border}`,
      borderRadius: 14,
      marginBottom: 8,
      overflow: "hidden",
      animation: `fadeUp 0.3s ease ${index * 0.04}s both`,
      transition: "border-color 0.2s",
    }}>
      {/* ── Collapsed row header ── */}
      <div onClick={() => setExpanded(e => !e)}
        style={{
          padding: "12px 14px", cursor: "pointer",
          background: expanded ? C.surfaceHi : "transparent", transition: "background 0.2s"
        }}>

        {/* Top row: Score · Symbol · Price · Chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Score ring */}
          <div style={{ flexShrink: 0 }}>
            <ScoreRing score={score} />
          </div>

          {/* Symbol + strategy */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: 0.3, marginBottom: 3 }}>
              {row.symbol}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
              <span style={{ color: badge.fg }}>{row.strategy}</span>
              <span style={{ color: C.muted }}> · </span>
              <span style={{ color: row.signal === "BUY" ? C.green : C.red }}>{row.signal}</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>
              {"\u200B"}Exp {formatExpiry(expiry)}
            </div>
          </div>

          {/* Right: price stack */}
          <div style={{ textAlign: "right", flexShrink: 0, minWidth: 72 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>${(row.underlying || 0).toFixed(2)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: pos ? C.green : C.red, whiteSpace: "nowrap" }}>{pos ? "▲" : "▼"}{Math.abs(row.change || 0).toFixed(2)}%</div>
          </div>

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
            style={{ transition: "transform 0.25s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Bottom row: Key stats strip — always visible */}
        <div style={{
          display: "flex", gap: isDesktop ? 12 : 6, marginTop: 10, paddingTop: 8,
          borderTop: `1px solid ${C.border}`, flexWrap: "wrap",
        }}>
          {/* Max Profit */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Profit</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: C.green }}>{fmtPnL(maxProfit)}</span>
          </div>
          {/* Max Loss */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Risk</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: C.red }}>{fmtPnL(maxRisk)}</span>
          </div>
          {/* R:R Ratio */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={rrColor} strokeWidth="3" strokeLinecap="round"><path d="M4 14l8-8 8 8" /></svg>
            <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>R:R</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: rrColor }}>{rr >= 999 ? '∞' : rr.toFixed(2) + 'x'}</span>
          </div>
          {/* POP */}
          {row.pop > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="8" /></svg>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>POP</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: C.blue }}>{row.pop}%</span>
            </div>
          )}
          {/* Margin */}
          {margin > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Margin</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: C.cyan }}>${margin.toLocaleString()}</span>
            </div>
          )}
          {/* ROM */}
          {rom > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>ROM</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: romColor }}>{rom >= 999 ? '∞' : rom.toFixed(2) + 'x'}</span>
            </div>
          )}
          {/* Scenario P&L */}
          {hasScenario && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Scen</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: scenPnL >= 0 ? C.green : C.red }}>{scenPnL >= 0 ? '+' : ''}${scenPnL.toFixed(2)}</span>
            </div>
          )}
          {/* DTE */}
          {row.dte > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>DTE</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700, color: C.sub }}>{row.dte}d</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", animation: "fadeUp 0.18s ease" }}>

          {/* Legs */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>POSITION LEGS</div>
            {(row.legs || [{ signal: row.signal, type: row.type || "C", strike: row.strike || 0, expiry: row.expiry, bid: row.bid, ask: row.ask }]).map((leg, i, arr) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px",
                background: C.surfaceHi2, borderRadius: 8, marginBottom: i < arr.length - 1 ? 5 : 0
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 800, color: leg.signal === "BUY" ? C.green : C.red,
                    background: leg.signal === "BUY" ? C.greenBg : C.redBg, padding: "2px 5px", borderRadius: 4
                  }}>{leg.signal}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.sub }}>{leg.type === "C" ? "Call" : "Put"} {Number(leg.strike).toFixed(0)}</span>
                  <span style={{ fontSize: 9, color: C.muted }}>{leg.expiry}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: C.text }}>
                  <span style={{ color: C.green }}>${(leg.bid || 0).toFixed(2)}</span>
                  <span style={{ color: C.muted }}> / </span>
                  <span style={{ color: C.red }}>${(leg.ask || 0).toFixed(2)}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Net premium row */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 10px", background: C.surfaceHi2, borderRadius: 8, marginBottom: 14
          }}>
            <span style={{ fontSize: 9, letterSpacing: 1, fontWeight: 700, color: C.muted }}>NET PREMIUM</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: 700, color: C.text }}>
              ${(row.bid || 0).toFixed(2)} <span style={{ color: C.muted }}>/ </span>${(row.ask || 0).toFixed(2)}
            </span>
          </div>

          {/* Margin & Capital section */}
          {margin > 0 && (
            <div style={{
              background: C.surfaceHi, borderRadius: 10, padding: "10px 12px", marginBottom: 14,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 7.5, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>MARGIN & CAPITAL</div>
              {[
                { label: "Est. Initial Margin", value: `$${margin.toLocaleString()}`, color: C.cyan },
                { label: "Return on Margin", value: rom >= 999 ? '∞' : `${rom.toFixed(2)}x`, color: romColor },
                ...(hasScenario ? [
                  { label: `Scenario P&L (@$${(row.targetPrice || 0).toFixed(0)})`, value: `${scenPnL >= 0 ? '+' : ''}$${scenPnL.toFixed(2)}`, color: scenPnL >= 0 ? C.green : C.red },
                  { label: "Scenario Score", value: `${row.scenarioScore || 0}`, color: (row.scenarioScore || 0) >= 65 ? C.green : (row.scenarioScore || 0) >= 45 ? C.amber : C.red },
                ] : []),
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>{label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
              {/* Capital efficiency bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Capital Efficiency</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, fontWeight: 700, color: romColor }}>{Math.min(100, Math.round(rom * 50))}%</span>
                </div>
                <div style={{ height: 3, background: C.surfaceHi2, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.round(rom * 50))}%`, background: romColor, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
              </div>
            </div>
          )}

          {/* 2×2 data grid — Greeks left, Price right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", background: C.surfaceHi, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px" }}>
              <div style={{ fontSize: 7.5, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 6 }}>GREEKS</div>
              {Object.entries(greeks).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>{k}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: C.border }} />
            <div style={{ padding: "8px 12px" }}>
              <div style={{ fontSize: 7.5, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 6 }}>MARKET</div>
              {[
                { label: "Open", value: `$${(row._quote?.open || 0).toFixed(2)}` },
                { label: "High", value: `$${(row._quote?.high || 0).toFixed(2)}` },
                { label: "Low", value: `$${(row._quote?.low || 0).toFixed(2)}` },
                { label: "IV", value: `${(row.iv || 0).toFixed(1)}%` },
                { label: "Math.Edge", value: row.edge !== undefined ? `${row.edge > 0 ? "+" : ""}$${row.edge.toFixed(2)}` : "—" },
                { label: "Vol", value: row.vol || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: C.sub }}>{label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.text, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Probability score bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>PROBABILITY SCORE</span>
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: scoreColor }}>{score}%</span>
            </div>
            <div style={{ height: 3, background: C.surfaceHi2, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${score}%`, background: scoreColor, borderRadius: 2, transition: "width 0.8s ease" }} />
            </div>
          </div>

          {/* Rationale bullets */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>WHY HIGH PROBABILITY</div>
            {sigs.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 11, color: C.sub, lineHeight: 1.55 }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Payoff toggle */}
          <button onClick={() => setShowPayoff(p => !p)} style={{
            width: "100%", background: C.surfaceHi2, border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Payoff Diagram</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ transition: "transform 0.22s", transform: showPayoff ? "rotate(180deg)" : "rotate(0)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showPayoff && (
            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "10px 8px 6px", marginBottom: 8, animation: "fadeUp 0.18s ease" }}>
              <InteractivePayoff row={row} />
            </div>
          )}

          {/* News toggle */}
          <button onClick={() => setShowNews(p => !p)} style={{
            width: "100%", background: C.surfaceHi2, border: `1px solid ${showNews ? C.blueBorder : C.border}`, borderRadius: 10,
            padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: showNews ? C.blue : C.text }}>Daily Intelligence · {row.symbol}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ transition: "transform 0.22s", transform: showNews ? "rotate(180deg)" : "rotate(0)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showNews && (
            <div style={{ animation: "fadeUp 0.18s ease", marginBottom: 4 }}>
              <NewsCard symbol={row.symbol} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SCENARIO PANEL ───────────────────────────────────────────────────────────
const DIRECTIONS = [
  { key: "bullish", label: "Bullish", icon: "▲", color: C.green, bg: C.greenBg, border: C.greenBorder },
  { key: "bearish", label: "Bearish", icon: "▼", color: C.red, bg: C.redBg, border: C.redBorder },
  { key: "neutral", label: "Neutral", icon: "◆", color: C.purple, bg: C.purpleBg, border: "rgba(139,92,246,0.30)" },
];
const TIMEFRAMES = [
  { days: 7, label: "1 Week" },
  { days: 14, label: "2 Weeks" },
  { days: 30, label: "30 Days" },
  { days: 45, label: "45 Days" },
  { days: 60, label: "60 Days" },
];
const CONFIDENCES = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

function ScenarioPanel({ scenario, setScenario, isActive }) {
  const dirColor = DIRECTIONS.find(d => d.key === scenario.direction);

  return (
    <div style={{
      background: C.surfaceHi,
      border: `1px solid ${isActive ? (dirColor?.border || C.borderHi) : C.border}`,
      borderRadius: 14,
      padding: "14px 14px 16px",
      animation: "fadeUp 0.22s ease",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: 0.3 }}>Expected Scenario</span>
          {isActive && <span style={{ fontSize: 8, fontWeight: 800, color: C.cyan, background: "rgba(6,182,212,0.12)", padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>ACTIVE</span>}
        </div>
        {isActive && (
          <button
            onClick={() => setScenario({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" })}
            style={{ fontSize: 9, color: C.muted, background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}
          >Clear</button>
        )}
      </div>

      {/* Direction */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>DIRECTION</div>
        <div style={{ display: "flex", gap: 7 }}>
          {DIRECTIONS.map(d => (
            <button key={d.key} onClick={() => setScenario(s => ({ ...s, direction: s.direction === d.key ? null : d.key }))}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: scenario.direction === d.key ? d.bg : "transparent",
                color: scenario.direction === d.key ? d.color : C.muted,
                border: `1.5px solid ${scenario.direction === d.key ? d.border : C.border}`,
                transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
              <span style={{ fontSize: 10 }}>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Magnitude */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>EXPECTED MOVE</span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 800, color: dirColor?.color || C.text }}>{scenario.magnitude}%</span>
        </div>
        <input type="range" min="0.5" max="30" step="0.5" value={scenario.magnitude}
          onChange={e => setScenario(s => ({ ...s, magnitude: parseFloat(e.target.value) }))}
          style={{
            width: "100%", height: 4, appearance: "none", background: C.surfaceHi2,
            borderRadius: 2, outline: "none", cursor: "pointer",
            accentColor: dirColor?.color || C.blue,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 8, color: C.muted }}>0.5%</span>
          <span style={{ fontSize: 8, color: C.muted }}>30%</span>
        </div>
      </div>

      {/* Timeframe */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>TIMEFRAME</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf.days} onClick={() => setScenario(s => ({ ...s, timeframeDays: tf.days }))}
              style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
                background: scenario.timeframeDays === tf.days ? C.surfaceHi2 : "transparent",
                color: scenario.timeframeDays === tf.days ? C.text : C.muted,
                border: `1px solid ${scenario.timeframeDays === tf.days ? C.borderHi : C.border}`,
                transition: "all 0.15s",
              }}>{tf.label}</button>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>CONFIDENCE</div>
        <div style={{ display: "flex", gap: 6 }}>
          {CONFIDENCES.map(c => (
            <button key={c.key} onClick={() => setScenario(s => ({ ...s, confidence: c.key }))}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
                background: scenario.confidence === c.key ? C.surfaceHi2 : "transparent",
                color: scenario.confidence === c.key ? C.text : C.muted,
                border: `1px solid ${scenario.confidence === c.key ? C.borderHi : C.border}`,
                transition: "all 0.15s",
              }}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FILTER / SORT MODAL ──────────────────────────────────────────────────────
const STRATEGIES = ["All", "Single Option", "Call Spread", "Put Spread", "Iron Condor", "Straddle", "Bear Call Spread"];
const SORT_OPTIONS = [
  { key: "score", label: "Score" },
  { key: "riskReward", label: "R:R Ratio" },
  { key: "estimatedMargin", label: "Margin" },
  { key: "returnOnMargin", label: "ROM" },
  { key: "symbol", label: "Symbol" },
  { key: "underlying", label: "Last Price" },
  { key: "delta", label: "Delta" },
  { key: "change", label: "% Change" },
  { key: "iv", label: "IV" },
  { key: "scenarioPnL", label: "Scenario P&L" },
];

function FilterModal({ open, onClose, strategy, setStrategy, sortKey, setSortKey, sortDir, setSortDir, filters, setFilters }) {
  if (!open) return null;
  const inputStyle = {
    width: "100%", background: C.surfaceHi2, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "7px 10px", fontSize: 12, color: C.text, fontFamily: "'IBM Plex Mono',monospace",
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "fadeIn 0.18s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, background: "#0a0a0c",
        border: `1px solid ${C.borderHi}`, borderBottom: "none",
        borderRadius: "20px 20px 0 0", padding: "0 20px 40px",
        maxHeight: "88dvh", overflowY: "auto", animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: C.surfaceHi, borderRadius: 2, margin: "12px auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Filter & Sort</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button
              onClick={() => {
                setStrategy(0);
                setSortKey("score");
                setSortDir("desc");
                setFilters({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" });
              }}
              style={{ background: C.surfaceHi, color: C.sub, padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.border}`, alignSelf: "center", marginBottom: 2 }}
            >
              RESET
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Strategy */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>STRATEGY TYPE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {STRATEGIES.map((s, i) => (
              <button key={i} onClick={() => setStrategy(i)} style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: strategy === i ? C.green : "transparent",
                color: strategy === i ? "#fff" : C.sub,
                border: `1px solid ${strategy === i ? C.green : C.border}`,
                transition: "all 0.15s",
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>SORT BY</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {SORT_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setSortKey(o.key)} style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: sortKey === o.key ? C.surfaceHi2 : "transparent",
                color: sortKey === o.key ? C.text : C.sub,
                border: `1px solid ${sortKey === o.key ? C.borderHi : C.border}`,
                transition: "all 0.15s",
              }}>{o.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["desc", "asc"].map(d => (
              <button key={d} onClick={() => setSortDir(d)} style={{
                flex: 1, padding: "7px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: sortDir === d ? C.surfaceHi2 : "transparent",
                color: sortDir === d ? C.text : C.muted,
                border: `1px solid ${sortDir === d ? C.borderHi : C.border}`,
              }}>{d === "desc" ? "↓ High to Low" : "↑ Low to High"}</button>
            ))}
          </div>
        </div>

        {/* Numeric filters */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>FILTERS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { key: "minVolume", label: "MIN VOLUME" },
              { key: "minMarketCap", label: "MIN MCAP" },
              { key: "ivRange", label: "IV RANGE" },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 700, marginBottom: 5, letterSpacing: 0.8 }}>{f.label}</div>
                <input value={filters[f.key]} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} style={{
          width: "100%", padding: "11px", borderRadius: 10,
          background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3,
        }}>Apply</button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const STRATEGIES_LIST = ["All", "Single Option", "Call Spread", "Put Spread", "Iron Condor", "Straddle", "Bear Call Spread"];

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
  const [filters, setFilters] = useState({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" });
  const [chipFilter, setChipFilter] = useState(null); // "bull" | "bear" | "highScore" | "topMove" | null
  const [showScenario, setShowScenario] = useState(false);
  const [scenario, setScenario] = useState({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" });
  const scenarioActive = scenario.direction != null;

  const handleReset = () => {
    setSearch("");
    setResults([]);
    setRan(false);
    setRunning(false);
    setError(null);
    setStrategy(0);
    setSortKey("score");
    setSortDir("desc");
    setFilters({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" });
    setChipFilter(null);
    setShowScenario(false);
    setScenario({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" });
  };

  const handleRun = async () => {
    setRunning(true); setError(null); setChipFilter(null);
    try {
      let data;
      const ticker = search.trim().toUpperCase();
      const scenarioPayload = scenarioActive ? {
        direction: scenario.direction,
        magnitude: scenario.magnitude / 100, // convert % to decimal
        timeframeDays: scenario.timeframeDays,
        confidence: scenario.confidence,
      } : null;
      if (ticker) { data = await api.scanSingle(ticker, scenarioPayload); }
      else { data = await api.scanMarketWide({ minVolume: parseFilterValue(filters.minVolume), minMarketCap: parseFilterValue(filters.minMarketCap) }, scenarioPayload); }
      const quote = data.quote || {};
      const strategies = (data.strategies || []).map(s => ({ ...s, _quote: quote }));
      setResults(strategies); setRan(true);
    } catch (err) { setError(err.message || "Scan failed."); setResults([]); setRan(true); }
    finally { setRunning(false); }
  };

  const filtered = useMemo(() => {
    let rows = strategy > 0 ? results.filter(r => r.strategy === STRATEGIES_LIST[strategy]) : results;
    if (chipFilter === "bull") rows = rows.filter(r => (r.change || 0) > 0);
    if (chipFilter === "bear") rows = rows.filter(r => (r.change || 0) < 0);
    if (chipFilter === "highScore") rows = rows.filter(r => (r.score || 0) >= 75);
    if (chipFilter === "topMove") rows = rows.filter(r => Math.abs(r.change || 0) === Math.max(...results.map(x => Math.abs(x.change || 0))));
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [results, strategy, sortKey, sortDir, chipFilter]);

  // Summary stats for pills
  const bullishCount = results.filter(r => (r.change || 0) > 0).length;
  const bearishCount = results.filter(r => (r.change || 0) < 0).length;
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + (r.score || 0), 0) / results.length) : null;
  const topMover = results.length ? results.reduce((best, r) => Math.abs(r.change || 0) > Math.abs(best.change || 0) ? r : best, results[0]) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        input,select { outline:none; }
        input::placeholder { color:#4a4a58; }
        option { background:#0c0c0e; color:#e8e8ed; }
        button { font-family:inherit; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#10B981; cursor:pointer; border:2px solid #050506; }
        input[type=range]::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:#10B981; cursor:pointer; border:2px solid #050506; }
      `}</style>

      <div style={{
        minHeight: "100dvh", background: C.bg, color: C.text,
        fontFamily: "'IBM Plex Sans',-apple-system,'Helvetica Neue',Arial,sans-serif",
        maxWidth: isDesktop ? 1100 : 448, margin: "0 auto",
        display: "flex", flexDirection: "column",
        fontSize: 13, letterSpacing: "-0.01em",
      }}>

        {/* ── HEADER ── */}
        <header style={{
          padding: isDesktop ? "14px 24px 0" : "40px 14px 0",
          background: "rgba(5,5,6,0.92)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 20,
          borderBottom: `1px solid ${C.border}`,
        }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ran && results.length > 0 ? 8 : 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Home / Reset button — visible once a scan has been run */}
              {ran && (
                <button
                  onClick={handleReset}
                  title="Back to home"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.borderColor = C.borderHi; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = C.border; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </button>
              )}
              <div>
                <h1
                  onClick={handleReset}
                  style={{ fontSize: isDesktop ? 18 : 16, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1, cursor: "pointer", userSelect: "none" }}
                  title="Reset to home"
                >
                  <span style={{ color: C.text }}>Option</span><span style={{ color: C.muted }}> Chamber</span>
                </h1>
              </div>
            </div>
            {/* Desktop pills — inline right of title */}
            {isDesktop && ran && results.length > 0 && (
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                <FilterPill label="BULL" value={bullishCount}
                  color={C.green} bg={C.greenBg} border={C.greenBorder}
                  active={chipFilter === "bull"} onClick={() => setChipFilter(f => f === "bull" ? null : "bull")} />
                <FilterPill label="BEAR" value={bearishCount}
                  color={C.red} bg={C.redBg} border={C.redBorder}
                  active={chipFilter === "bear"} onClick={() => setChipFilter(f => f === "bear" ? null : "bear")} />
                {avgScore != null && <FilterPill label="AVG" value={`${avgScore}%`}
                  color={avgScore >= 65 ? C.green : C.amber}
                  bg={avgScore >= 65 ? C.greenBg : "rgba(245,158,11,0.10)"}
                  border={avgScore >= 65 ? C.greenBorder : "rgba(245,158,11,0.22)"}
                  active={chipFilter === "highScore"} onClick={() => setChipFilter(f => f === "highScore" ? null : "highScore")} />}
                {topMover && <FilterPill label="TOP" value={`${(topMover.change || 0) > 0 ? "+" : ""}${(topMover.change || 0).toFixed(1)}%`}
                  color={(topMover.change || 0) > 0 ? C.green : C.red}
                  bg={(topMover.change || 0) > 0 ? C.greenBg : C.redBg}
                  border={(topMover.change || 0) > 0 ? C.greenBorder : C.redBorder}
                  active={chipFilter === "topMove"} onClick={() => setChipFilter(f => f === "topMove" ? null : "topMove")} />}
              </div>
            )}
          </div>

          {/* Mobile pills — 4-column grid beneath title, always fully visible */}
          {!isDesktop && ran && results.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
              <FilterPill label="BULL" value={bullishCount}
                color={C.green} bg={C.greenBg} border={C.greenBorder}
                active={chipFilter === "bull"} onClick={() => setChipFilter(f => f === "bull" ? null : "bull")} />
              <FilterPill label="BEAR" value={bearishCount}
                color={C.red} bg={C.redBg} border={C.redBorder}
                active={chipFilter === "bear"} onClick={() => setChipFilter(f => f === "bear" ? null : "bear")} />
              <FilterPill label="AVG" value={avgScore != null ? `${avgScore}%` : "—"}
                color={avgScore != null && avgScore >= 65 ? C.green : C.amber}
                bg={avgScore != null && avgScore >= 65 ? C.greenBg : "rgba(245,158,11,0.10)"}
                border={avgScore != null && avgScore >= 65 ? C.greenBorder : "rgba(245,158,11,0.22)"}
                active={chipFilter === "highScore"} onClick={() => setChipFilter(f => f === "highScore" ? null : "highScore")} />
              <FilterPill label="TOP" value={topMover ? `${(topMover.change || 0) > 0 ? "+" : ""}${(topMover.change || 0).toFixed(1)}%` : "—"}
                color={topMover && (topMover.change || 0) > 0 ? C.green : C.red}
                bg={topMover && (topMover.change || 0) > 0 ? C.greenBg : C.redBg}
                border={topMover && (topMover.change || 0) > 0 ? C.greenBorder : C.redBorder}
                active={chipFilter === "topMove"} onClick={() => setChipFilter(f => f === "topMove" ? null : "topMove")} />
            </div>
          )}

          {/* Search + action row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
            {/* Search input */}
            <div style={{ flex: 1, position: "relative" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Ticker or blank for market scan"
                value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
                style={{
                  width: "100%", background: C.surfaceHi, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "8px 10px 8px 30px",
                  fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, color: C.text,
                }}
              />
            </div>

            {/* Filter button */}
            <button onClick={() => setShowFilter(true)} style={{
              background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "0 12px", height: 34, cursor: "pointer", color: C.sub,
              display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, flexShrink: 0,
              transition: "border-color 0.15s",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              {!isDesktop && "Filter"}
              {isDesktop && "Filter & Sort"}
            </button>

            {/* Scenario toggle */}
            <button onClick={() => setShowScenario(s => !s)} style={{
              background: scenarioActive ? "rgba(6,182,212,0.10)" : C.surfaceHi,
              border: `1px solid ${scenarioActive ? "rgba(6,182,212,0.25)" : showScenario ? C.borderHi : C.border}`,
              borderRadius: 8, padding: "0 10px", height: 34, cursor: "pointer",
              color: scenarioActive ? C.cyan : C.sub,
              display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, flexShrink: 0,
              transition: "all 0.15s",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
              {!isDesktop ? (scenarioActive ? "✓" : "") : (scenarioActive ? "Scenario ✓" : "Scenario")}
            </button>

            {/* Run button */}
            <button onClick={handleRun} disabled={running} style={{
              background: running ? "rgba(18,18,20,0.7)" : scenarioActive ? "rgba(6,182,212,0.85)" : C.green,
              border: `1px solid ${running ? C.border : scenarioActive ? "rgba(6,182,212,0.4)" : "rgba(16,185,129,0.4)"}`,
              borderRadius: 8, padding: "0 16px", height: 34,
              color: running ? C.sub : "#fff", fontWeight: 600, fontSize: 11, letterSpacing: 0.5,
              cursor: running ? "default" : "pointer", transition: "all 0.18s",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {running
                ? <><span style={{ width: 10, height: 10, border: `1.5px solid ${C.muted}`, borderTopColor: C.text, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Scanning…</>
                : <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  {scenarioActive ? "Run Scenario" : "Run Screener"}
                </>
              }
            </button>
          </div>

          {/* Scenario Panel */}
          {showScenario && (
            <div style={{ marginBottom: 14, animation: "fadeUp 0.18s ease" }}>
              <ScenarioPanel scenario={scenario} setScenario={setScenario} isActive={scenarioActive} />
            </div>
          )}

          {/* Active filter chips */}
          {ran && (
            <div style={{ display: "flex", gap: 6, paddingBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
              {strategy > 0 && (
                <span style={{ fontSize: 9, background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}`, padding: "2px 8px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  {STRATEGIES_LIST[strategy]}
                  <button onClick={() => setStrategy(0)} style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              )}
              <span style={{ fontSize: 9, background: C.surfaceHi, color: C.sub, border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                {SORT_OPTIONS.find(o => o.key === sortKey)?.label || "Score"} {sortDir === "desc" ? "↓" : "↑"}
              </span>
            </div>
          )}
        </header>

        {/* ── RESULTS ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: isDesktop ? "20px 28px 40px" : "12px 14px 40px" }}>

          {error && (
            <div style={{ padding: "12px 16px", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{error}</div>
              <button onClick={handleRun} style={{ marginTop: 6, fontSize: 10, color: C.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Try Again</button>
            </div>
          )}

          {!ran && !running && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🏛️</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: -0.3 }}>The Option Chamber</h2>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, maxWidth: 280 }}>
                Enter a ticker and tap <strong style={{ color: C.green }}>Run Screener</strong> to scan a single stock, or leave blank to scan the full market.
              </p>
            </div>
          )}

          {ran && filtered.length === 0 && !error && (
            <div style={{ padding: "60px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, color: C.sub, fontWeight: 700, marginBottom: 6 }}>No strategies found</div>
              <div style={{ fontSize: 11, color: C.muted }}>Try a different symbol or adjust your filters</div>
            </div>
          )}

          {/* Accordion cards */}
          {filtered.map((row, i) => (
            <ResultCard key={`${row.symbol}-${row.strategy}-${i}`} row={row} index={i} isDesktop={isDesktop} />
          ))}
        </main>
      </div>

      {/* Filter modal */}
      <FilterModal
        open={showFilter} onClose={() => setShowFilter(false)}
        strategy={strategy} setStrategy={setStrategy}
        sortKey={sortKey} setSortKey={setSortKey}
        sortDir={sortDir} setSortDir={setSortDir}
        filters={filters} setFilters={setFilters}
      />
    </>
  );
}
