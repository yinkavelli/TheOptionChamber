import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Zap, WifiOff, Search, ScanLine, FlaskConical, SlidersHorizontal, Settings, TrendingUp, TrendingDown } from "lucide-react";

import { api } from "./api.js";
import { BottomNav } from "./components/BottomNav.jsx";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a14",
  surface: "#0f0f1f",
  surfaceHi: "#13132a",
  surfaceHi2: "#0d0d20",
  border: "#1e1e3f",
  borderHi: "#2a2a5a",
  text: "#e2e8f0",
  sub: "#94a3b8",
  muted: "#475569",
  green: "#10b981",
  greenBg: "rgba(16,185,129,0.12)",
  greenBorder: "rgba(16,185,129,0.25)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.12)",
  redBorder: "rgba(239,68,68,0.25)",
  amber: "#f59e0b",
  blue: "#818cf8",
  blueBg: "rgba(99,102,241,0.12)",
  blueBorder: "rgba(99,102,241,0.25)",
  purple: "#a78bfa",
  purpleBg: "rgba(139,92,246,0.12)",
  cyan: "#06b6d4",
  indigo: "#6366f1",
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
  if (strategy === "Iron Condor") return { label: "CONDOR", bg: C.purpleBg, fg: C.purple, border: "rgba(139,92,246,0.35)" };
  if (strategy === "Straddle") return { label: "STRADDLE", bg: C.blueBg, fg: C.blue, border: C.blueBorder };
  if (strategy === "Call Spread") return { label: "DEBIT C", bg: C.greenBg, fg: C.green, border: C.greenBorder };
  if (strategy === "Put Spread") return { label: "CREDIT P", bg: C.redBg, fg: C.red, border: C.redBorder };
  if (strategy === "Bear Call Spread") return { label: "BEAR C", bg: C.redBg, fg: C.red, border: C.redBorder };
  const t = type || "C";
  return t === "C"
    ? { label: "CALL", bg: C.greenBg, fg: C.green, border: C.greenBorder }
    : { label: "PUT", bg: C.redBg, fg: C.red, border: C.redBorder };
}

// ─── FILTER PILL ──────────────────────────────────────────────────────────────
function FilterPill({ label, value, color, bg, border, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: bg, border: `1.5px solid ${active ? color : border}`,
      borderRadius: 8, padding: "5px 4px", cursor: "pointer",
      transition: "all 0.15s", flexShrink: 0, flexGrow: 1,
      boxShadow: active ? `0 0 12px ${border}` : "none",
      opacity: active ? 1 : 0.72, minWidth: 0,
    }}>
      <span style={{ fontSize: 8, letterSpacing: 0.5, color, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
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
      <text x={20} y={24} textAnchor="middle" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fill: color, fontWeight: 800 }}>{score}</text>
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
      {cursor && <div style={{ position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", background: "rgba(13,13,32,0.95)", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "4px 12px", display: "flex", gap: 12, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap" }}>
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
          <g key={i}><line x1={toX(s)} y1={pad.t} x2={toX(s)} y2={H - pad.b} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={toX(s)} y={H - pad.b + (i % 2 === 0 ? 10 : 20)} textAnchor="middle" fill={C.sub} fontSize="6.5" fontFamily="monospace">${s}</text></g>
        ))}
        {breakevens.map((be, i) => be > minP && be < maxP && (
          <g key={`be${i}`}><line x1={toX(be)} y1={pad.t} x2={toX(be)} y2={H - pad.b} stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={toX(be)} y={pad.t - 4} textAnchor="middle" fill={C.amber} fontSize="6.5" fontFamily="monospace">BE</text></g>
        ))}
        {uPrice > 0 && (() => {
          const uX = toX(uPrice), uPnl = calcPnL(uPrice), uY = toY(uPnl);
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
        <path d={pathD} fill="none" stroke="rgba(224,231,255,0.85)" strokeWidth="1.8" strokeLinejoin="round" />
        {cursor && (() => {
          const cy = toY(cursor.pnl); return (<>
            <line x1={cursor.x} y1={pad.t} x2={cursor.x} y2={H - pad.b} stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
            <circle cx={cursor.x} cy={cy} r={4} fill={cursor.pnl >= 0 ? C.green : C.red} stroke="rgba(13,13,32,0.9)" strokeWidth={1.5} />
          </>);
        })()}
      </svg>
    </div>
  );
}

// ─── NEWS CARD ─────────────────────────────────────────────────────────────────
function NewsCard({ symbol }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.getNews(symbol).then(d => setNews(d || [])).catch(() => setNews([])).finally(() => setLoading(false));
  }, [symbol]);

  if (loading) return <div className="py-4 text-center text-xs text-slate-500">Loading intelligence…</div>;
  if (news.length === 0) return <p className="text-xs text-slate-500 text-center py-3">No recent news.</p>;

  return (
    <div className="space-y-2">
      {news.slice(0, 4).map((item, i) => {
        const sentColor = item.sentiment === "positive" ? C.green : item.sentiment === "negative" ? C.red : C.amber;
        const sentBg = item.sentiment === "positive" ? C.greenBg : item.sentiment === "negative" ? C.redBg : "rgba(245,158,11,0.1)";
        const sentLabel = item.sentiment === "positive" ? "BULLISH" : item.sentiment === "negative" ? "BEARISH" : "NEUTRAL";
        return (
          <div key={i} className="gradient-card rounded-xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, color: sentColor, background: sentBg, padding: "2px 6px", borderRadius: 4 }}>{sentLabel}</span>
                <span style={{ fontSize: 8, color: C.muted, fontWeight: 600 }}>{item.source}</span>
              </div>
              <span style={{ fontSize: 8, color: C.muted }}>{item.time}</span>
            </div>
            <p style={{ fontSize: 11.5, color: C.text, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>{item.headline}</p>
          </div>
        );
      })}
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

// ─── RESULT CARD ──────────────────────────────────────────────────────────────
function ResultCard({ row, index, hideSymbol }) {
  const [expanded, setExpanded] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const badge = getStrategyBadge(row.strategy, row.type || row.legs?.[0]?.type);
  const { sigs, score } = getRationale(row);
  const pos = (row.change || 0) >= 0;
  const scoreColor = score >= 80 ? C.green : score >= 65 ? C.amber : C.red;
  const theta = row.theta || (-(0.06 + (row.iv || 0) / 400));
  const expiry = row.expiry || row.legs?.[0]?.expiry || '';
  const maxProfit = row.maxProfit || 0;
  const maxRisk = row.maxRisk || row.debit || 0;
  const rr = row.riskReward || (maxRisk > 0 ? Math.round((maxProfit === Infinity ? 999 : maxProfit / maxRisk) * 100) / 100 : 0);
  const rrColor = rr >= 2 ? C.green : rr >= 1 ? C.amber : C.red;
  const fmtPnL = (v) => v === Infinity ? '∞' : `$${Math.abs(v).toFixed(2)}`;
  const margin = row.estimatedMargin || 0;
  const rom = row.returnOnMargin || 0;
  const romColor = rom >= 1.5 ? C.green : rom >= 1 ? C.amber : C.red;
  const hasScenario = row.scenarioPnL != null;
  const scenPnL = row.scenarioPnL || 0;
  const greeks = {
    Delta: (row.delta || 0).toFixed(3),
    Theta: theta.toFixed(4),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="gradient-card rounded-2xl overflow-hidden"
      style={{ borderColor: expanded ? C.borderHi : C.border }}
    >
      {/* Collapsed header */}
      <div onClick={() => setExpanded(e => !e)}
        className="px-4 py-3 cursor-pointer transition-colors"
        style={{ background: expanded ? C.surfaceHi : "transparent" }}>

        <div className="flex items-center gap-2.5">
          <div className="shrink-0"><ScoreRing score={score} /></div>

          <div className="flex-1 min-w-0">
            {!hideSymbol && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                {row.symbol}
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg }}>{row.strategy}</span>
              <span style={{ fontSize: 10, color: C.muted }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: row.signal === "BUY" ? C.green : C.red }}>{row.signal}</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Exp {formatExpiry(expiry)}</div>
          </div>

          <div className="text-right shrink-0 min-w-[68px]">
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: C.text }}>${(row.underlying || 0).toFixed(2)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: pos ? C.green : C.red }}>{pos ? "▲" : "▼"}{Math.abs(row.change || 0).toFixed(2)}%</div>
          </div>

          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
            style={{ transition: "transform 0.25s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { dot: C.green, label: "Profit", val: fmtPnL(maxProfit), valColor: C.green },
            { dot: C.red, label: "Risk", val: fmtPnL(maxRisk), valColor: C.red },
            { dot: rrColor, label: "R:R", val: rr >= 999 ? '∞' : rr.toFixed(2) + 'x', valColor: rrColor },
            ...(row.pop > 0 ? [{ dot: C.blue, label: "POP", val: `${row.pop}%`, valColor: C.blue }] : []),
            ...(margin > 0 ? [{ dot: C.cyan, label: "Margin", val: `$${margin.toLocaleString()}`, valColor: C.cyan }] : []),
            ...(hasScenario ? [{ dot: scenPnL >= 0 ? C.green : C.red, label: "Scen", val: `${scenPnL >= 0 ? '+' : ''}$${scenPnL.toFixed(2)}`, valColor: scenPnL >= 0 ? C.green : C.red }] : []),
            ...(row.dte > 0 ? [{ dot: null, label: "DTE", val: `${row.dte}d`, valColor: C.sub }] : []),
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              {s.dot && <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />}
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: s.valColor }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="px-4 pb-4 pt-3 space-y-4"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          {/* Payoff & Structure */}
          <div className="gradient-card rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-3.5 py-2.5" style={{ background: C.surfaceHi, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Payoff & Structure</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: C.text }}>
                Net: ${(row.bid || 0).toFixed(2)} <span style={{ color: C.muted }}>/ </span>${(row.ask || 0).toFixed(2)}
              </span>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px 10px 6px" }}>
              <InteractivePayoff row={row} />
            </div>
            <div className="px-3.5 py-2.5" style={{ background: C.surfaceHi, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>POSITION LEGS</div>
              {(row.legs || [{ signal: row.signal, type: row.type || "C", strike: row.strike || 0, expiry: row.expiry, bid: row.bid, ask: row.ask }]).map((leg, i, arr) => (
                <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: i < arr.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 8, fontWeight: 800, color: leg.signal === "BUY" ? C.green : C.red }}>{leg.signal}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.text }}>{leg.type === "C" ? "Call" : "Put"} {Number(leg.strike).toFixed(0)}</span>
                    <span style={{ fontSize: 9, color: C.muted }}>{leg.expiry}</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.sub }}>${(leg.bid || 0).toFixed(2)} / ${(leg.ask || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Greeks & stats grid */}
          <div className="gradient-card rounded-xl p-3.5 flex flex-wrap gap-x-6 gap-y-3">
            {[
              { label: "DELTA", value: greeks.Delta },
              { label: "THETA", value: greeks.Theta },
              { label: "IMPLIED VOL", value: `${(row.iv || 0).toFixed(1)}%` },
              ...(margin > 0 ? [{ label: "MARGIN REQ", value: `$${margin.toLocaleString()}`, color: C.cyan }] : []),
              { label: "PROB OF PROFIT", value: `${row.pop}%`, color: C.blue },
              ...(hasScenario ? [{ label: "SCENARIO P&L", value: `${scenPnL >= 0 ? '+' : ''}$${scenPnL.toFixed(2)}`, color: scenPnL >= 0 ? C.green : C.red }] : []),
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span style={{ fontSize: 8, color: C.muted, fontWeight: 700, letterSpacing: 0.5 }}>{stat.label}</span>
                <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: stat.color || C.text, fontWeight: 600 }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Score bar + rationale */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>PROB SCORE & RATIONALE</span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: scoreColor }}>{score}%</span>
            </div>
            <div style={{ height: 3, background: C.surfaceHi2, borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${score}%`, background: scoreColor, borderRadius: 2, transition: "width 0.8s ease" }} />
            </div>
            <div className="space-y-1.5">
              {sigs.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <span style={{ fontSize: 11, color: C.sub, lineHeight: 1.55 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* News toggle */}
          <button onClick={() => setShowNews(p => !p)}
            className="w-full gradient-card rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors"
            style={{ borderColor: showNews ? C.blueBorder : C.border }}>
            <div className="flex items-center gap-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: showNews ? C.blue : C.text }}>Daily Intelligence · {row.symbol}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
              style={{ transition: "transform 0.22s", transform: showNews ? "rotate(180deg)" : "rotate(0)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showNews && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <NewsCard symbol={row.symbol} />
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── SYMBOL GROUP ─────────────────────────────────────────────────────────────
function SymbolGroup({ group, index }) {
  const [expanded, setExpanded] = useState(false);
  const rows = group.rows;
  const primaryRow = rows[0];
  const pos = (primaryRow.change || 0) >= 0;
  const avgScore = Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length);
  const highestRR = Math.max(...rows.map(r => r.riskReward || 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="mb-3"
    >
      <div onClick={() => setExpanded(e => !e)}
        className="gradient-card rounded-2xl px-4 py-3 cursor-pointer flex items-center justify-between transition-all"
        style={{ borderColor: expanded ? C.borderHi : C.border, background: expanded ? C.surfaceHi : C.surface }}>
        <div className="flex items-center gap-3">
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 800, color: '#fff' }}>{group.symbol}</div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700 }}>
            <span style={{ color: C.green }}>{rows.length}</span>
            <span style={{ color: C.sub }}>STRATEGIES</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right min-w-[60px]">
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: C.text }}>${(primaryRow.underlying || 0).toFixed(2)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: pos ? C.green : C.red }}>{pos ? "▲" : "▼"}{Math.abs(primaryRow.change || 0).toFixed(2)}%</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.25s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {expanded && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="pt-2 space-y-2">
          {rows.map((row, i) => <ResultCard key={`${row.strategy}-${i}`} row={row} index={i} hideSymbol />)}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── SCENARIO PANEL ───────────────────────────────────────────────────────────
const DIRECTIONS = [
  { key: "bullish", label: "Bullish", icon: "▲", color: C.green, bg: C.greenBg, border: C.greenBorder },
  { key: "bearish", label: "Bearish", icon: "▼", color: C.red, bg: C.redBg, border: C.redBorder },
  { key: "neutral", label: "Neutral", icon: "◆", color: C.purple, bg: C.purpleBg, border: "rgba(139,92,246,0.30)" },
];
const TIMEFRAMES = [
  { days: 7, label: "1 Week" }, { days: 14, label: "2 Weeks" }, { days: 30, label: "30 Days" }, { days: 45, label: "45 Days" }, { days: 60, label: "60 Days" },
];
const CONFIDENCES = [{ key: "low", label: "Low" }, { key: "medium", label: "Medium" }, { key: "high", label: "High" }];

function ScenarioPanel({ scenario, setScenario, isActive }) {
  const dirColor = DIRECTIONS.find(d => d.key === scenario.direction);
  return (
    <div className="gradient-card rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Expected Scenario</span>
          {isActive && <span style={{ fontSize: 8, fontWeight: 800, color: C.cyan, background: "rgba(6,182,212,0.12)", padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>ACTIVE</span>}
        </div>
        {isActive && (
          <button onClick={() => setScenario({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" })}
            style={{ fontSize: 9, color: C.muted, background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}>Clear</button>
        )}
      </div>

      <div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>DIRECTION</div>
        <div className="flex gap-2">
          {DIRECTIONS.map(d => (
            <button key={d.key} onClick={() => setScenario(s => ({ ...s, direction: s.direction === d.key ? null : d.key }))}
              className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              style={{ fontSize: 11, fontWeight: 700, background: scenario.direction === d.key ? d.bg : "transparent", color: scenario.direction === d.key ? d.color : C.muted, border: `1.5px solid ${scenario.direction === d.key ? d.border : C.border}` }}>
              <span style={{ fontSize: 10 }}>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted }}>EXPECTED MOVE</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, color: dirColor?.color || C.text }}>{scenario.magnitude}%</span>
        </div>
        <input type="range" min="0.5" max="30" step="0.5" value={scenario.magnitude}
          onChange={e => setScenario(s => ({ ...s, magnitude: parseFloat(e.target.value) }))}
          className="w-full" style={{ height: 4, accentColor: dirColor?.color || C.indigo }} />
        <div className="flex justify-between mt-1">
          <span style={{ fontSize: 8, color: C.muted }}>0.5%</span>
          <span style={{ fontSize: 8, color: C.muted }}>30%</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>TIMEFRAME</div>
        <div className="flex flex-wrap gap-1.5">
          {TIMEFRAMES.map(tf => (
            <button key={tf.days} onClick={() => setScenario(s => ({ ...s, timeframeDays: tf.days }))}
              className="px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              style={{ fontSize: 10, fontWeight: 600, background: scenario.timeframeDays === tf.days ? C.surfaceHi : "transparent", color: scenario.timeframeDays === tf.days ? C.text : C.muted, border: `1px solid ${scenario.timeframeDays === tf.days ? C.borderHi : C.border}` }}>{tf.label}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 7 }}>CONFIDENCE</div>
        <div className="flex gap-2">
          {CONFIDENCES.map(c => (
            <button key={c.key} onClick={() => setScenario(s => ({ ...s, confidence: c.key }))}
              className="flex-1 py-1.5 rounded-lg cursor-pointer transition-all"
              style={{ fontSize: 10, fontWeight: 600, background: scenario.confidence === c.key ? C.surfaceHi : "transparent", color: scenario.confidence === c.key ? C.text : C.muted, border: `1px solid ${scenario.confidence === c.key ? C.borderHi : C.border}` }}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FILTER TAB CONTENT ───────────────────────────────────────────────────────
const STRATEGY_LIST = ["All", "Single Option", "Call Spread", "Put Spread", "Iron Condor", "Straddle", "Bear Call Spread"];
const SORT_OPTIONS = [
  { key: "score", label: "Score" }, { key: "riskReward", label: "R:R Ratio" }, { key: "estimatedMargin", label: "Margin" },
  { key: "returnOnMargin", label: "ROM" }, { key: "symbol", label: "Symbol" }, { key: "underlying", label: "Last Price" },
  { key: "delta", label: "Delta" }, { key: "change", label: "% Change" }, { key: "iv", label: "IV" }, { key: "scenarioPnL", label: "Scenario P&L" },
];

function FiltersTab({ strategy, setStrategy, sortKey, setSortKey, sortDir, setSortDir, filters, setFilters, onReset }) {
  const inputCls = "w-full rounded-lg px-3 py-1.5 text-xs font-mono outline-none";
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white mb-0.5">Filter & Sort</h2>
        <p className="text-xs text-slate-500">Refine your screening results</p>
      </div>

      <div className="gradient-card rounded-2xl p-4 space-y-4">
        <div>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>STRATEGY TYPE</div>
          <div className="flex flex-wrap gap-2">
            {STRATEGY_LIST.map((s, i) => (
              <button key={i} onClick={() => setStrategy(i)}
                className="px-3 py-1.5 rounded-full cursor-pointer transition-all text-xs font-semibold"
                style={{ background: strategy === i ? C.indigo : "transparent", color: strategy === i ? "#fff" : C.sub, border: `1px solid ${strategy === i ? C.indigo : C.border}` }}>{s}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>SORT BY</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {SORT_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setSortKey(o.key)}
                className="px-3 py-1.5 rounded-full cursor-pointer transition-all text-xs font-semibold"
                style={{ background: sortKey === o.key ? C.surfaceHi : "transparent", color: sortKey === o.key ? C.text : C.sub, border: `1px solid ${sortKey === o.key ? C.borderHi : C.border}` }}>{o.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {["desc", "asc"].map(d => (
              <button key={d} onClick={() => setSortDir(d)}
                className="flex-1 py-2 rounded-xl cursor-pointer transition-all text-xs font-semibold"
                style={{ background: sortDir === d ? C.surfaceHi : "transparent", color: sortDir === d ? C.text : C.muted, border: `1px solid ${sortDir === d ? C.borderHi : C.border}` }}>
                {d === "desc" ? "↓ High to Low" : "↑ Low to High"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>NUMERIC FILTERS</div>
          <div className="grid grid-cols-3 gap-3">
            {[{ key: "minVolume", label: "MIN VOLUME" }, { key: "minMarketCap", label: "MIN MCAP" }, { key: "ivRange", label: "IV RANGE" }].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 700, marginBottom: 5, letterSpacing: 0.8 }}>{f.label}</div>
                <input value={filters[f.key]} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls} style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'JetBrains Mono',monospace" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={onReset}
        className="w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
        style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, color: C.sub }}>
        Reset to Defaults
      </button>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const prefs = [
    { label: "Auto-Refresh", sub: "Refresh scan data on interval", on: false },
    { label: "IV Alerts", sub: "Notify when IVR spikes on scanned symbols", on: true },
    { label: "Dark Mode", sub: "Always on", on: true },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white mb-0.5">Settings</h2>
        <p className="text-xs text-slate-500">Preferences & about</p>
      </div>
      <div className="space-y-2">
        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: "uppercase", padding: "0 4px" }}>Preferences</p>
        {prefs.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="gradient-card rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{s.label}</div>
              <div className="text-xs text-slate-500">{s.sub}</div>
            </div>
            <div className={`w-11 h-6 rounded-full cursor-pointer relative ${s.on ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${s.on ? 'left-6' : 'left-1'}`} />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="gradient-card rounded-2xl p-4">
        <div className="text-sm font-medium text-white mb-1">Version</div>
        <div style={{ fontSize: 12, color: C.blue, fontFamily: "'JetBrains Mono',monospace" }}>Option Chamber v2.0.0 ⇢ OChain skin</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function OptionChamber() {
  const [activeTab, setActiveTab] = useState("screener");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [ran, setRan] = useState(false);
  const [strategy, setStrategy] = useState(0);
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" });
  const [chipFilter, setChipFilter] = useState(null);
  const [scenario, setScenario] = useState({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" });
  const scenarioActive = scenario.direction != null;
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleReset = () => {
    setSearch(""); setResults([]); setRan(false); setRunning(false); setError(null);
    setStrategy(0); setSortKey("score"); setSortDir("desc");
    setFilters({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" });
    setChipFilter(null);
    setScenario({ direction: null, magnitude: 3, timeframeDays: 14, confidence: "medium" });
  };

  const handleRun = async (marketWide = false) => {
    setRunning(true); setError(null); setChipFilter(null);
    try {
      const ticker = marketWide ? "" : search.trim().toUpperCase();
      const scenarioPayload = scenarioActive ? {
        direction: scenario.direction, magnitude: scenario.magnitude / 100,
        timeframeDays: scenario.timeframeDays, confidence: scenario.confidence,
      } : null;
      let data;
      if (ticker) { data = await api.scanSingle(ticker, scenarioPayload); }
      else { data = await api.scanMarketWide({ minVolume: parseFilterValue(filters.minVolume), minMarketCap: parseFilterValue(filters.minMarketCap) }, scenarioPayload); }
      const quote = data.quote || {};
      setResults((data.strategies || []).map(s => ({ ...s, _quote: quote })));
      setRan(true); setLastRefresh(new Date());
    } catch (err) { setError(err.message || "Scan failed."); setResults([]); setRan(true); }
    finally { setRunning(false); }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    handleRun(false).finally(() => setTimeout(() => setRefreshing(false), 1200));
  };

  const filtered = useMemo(() => {
    let rows = strategy > 0 ? results.filter(r => r.strategy === STRATEGY_LIST[strategy]) : results;
    if (chipFilter === "bull") rows = rows.filter(r => (r.change || 0) > 0);
    if (chipFilter === "bear") rows = rows.filter(r => (r.change || 0) < 0);
    if (chipFilter === "highScore") rows = rows.filter(r => ((r.scenarioScore != null ? r.scenarioScore : r.score) || 0) >= 75);
    if (chipFilter === "topMove") rows = rows.filter(r => Math.abs(r.change || 0) === Math.max(...results.map(x => Math.abs(x.change || 0))));
    return [...rows].sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === "score") { av = a.scenarioScore != null ? a.scenarioScore : (a.score || 0); bv = b.scenarioScore != null ? b.scenarioScore : (b.score || 0); }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [results, strategy, sortKey, sortDir, chipFilter]);

  const bullishCount = results.filter(r => (r.change || 0) > 0).length;
  const bearishCount = results.filter(r => (r.change || 0) < 0).length;
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + (r.scenarioScore != null ? r.scenarioScore : (r.score || 0)), 0) / results.length) : null;
  const topMover = results.length ? results.reduce((best, r) => Math.abs(r.change || 0) > Math.abs(best.change || 0) ? r : best, results[0]) : null;

  // Groups for results display
  const groups = useMemo(() => {
    const map = new Map();
    const arr = [];
    filtered.forEach(row => {
      if (!map.has(row.symbol)) { const g = { symbol: row.symbol, rows: [], quote: row._quote }; map.set(row.symbol, g); arr.push(g); }
      map.get(row.symbol).rows.push(row);
    });
    return arr;
  }, [filtered]);

  return (
    <div className="min-h-svh" style={{ background: C.bg, color: C.text }}>
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b" style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(20px)', borderColor: C.border }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <button onClick={handleReset} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
              <Zap className="w-4 h-4 text-white" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight cursor-pointer" onClick={handleReset}>Option Chamber</h1>
              <p className="text-[9px] font-medium leading-tight" style={{ color: C.blue }}>Options Intelligence</p>
            </div>
          </div>

          {/* Right: status + refresh */}
          <div className="flex items-center gap-2">
            <div className="text-right text-[10px]">
              <div className="flex items-center gap-1 justify-end mb-0.5">
                {ran ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="font-medium text-emerald-400">Live</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-slate-600" /><span className="font-medium text-slate-500">Idle</span></>
                )}
              </div>
              <div className="text-slate-500">
                {lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
            </div>
            <button onClick={handleRefresh} disabled={!ran || running}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, color: (ran && !running) ? C.sub : C.muted }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || running ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter pills — shown when results exist */}
        {ran && results.length > 0 && (
          <div className="px-4 pb-2.5 max-w-lg mx-auto">
            <div className="grid grid-cols-4 gap-1.5">
              <FilterPill label="BULL" value={bullishCount} color={C.green} bg={C.greenBg} border={C.greenBorder} active={chipFilter === "bull"} onClick={() => setChipFilter(f => f === "bull" ? null : "bull")} />
              <FilterPill label="BEAR" value={bearishCount} color={C.red} bg={C.redBg} border={C.redBorder} active={chipFilter === "bear"} onClick={() => setChipFilter(f => f === "bear" ? null : "bear")} />
              <FilterPill label="AVG" value={avgScore != null ? `${avgScore}%` : "—"} color={avgScore != null && avgScore >= 65 ? C.green : C.amber} bg={avgScore != null && avgScore >= 65 ? C.greenBg : "rgba(245,158,11,0.10)"} border={avgScore != null && avgScore >= 65 ? C.greenBorder : "rgba(245,158,11,0.22)"} active={chipFilter === "highScore"} onClick={() => setChipFilter(f => f === "highScore" ? null : "highScore")} />
              <FilterPill label="TOP" value={topMover ? `${(topMover.change || 0) > 0 ? "+" : ""}${(topMover.change || 0).toFixed(1)}%` : "—"} color={topMover && (topMover.change || 0) > 0 ? C.green : C.red} bg={topMover && (topMover.change || 0) > 0 ? C.greenBg : C.redBg} border={topMover && (topMover.change || 0) > 0 ? C.greenBorder : C.redBorder} active={chipFilter === "topMove"} onClick={() => setChipFilter(f => f === "topMove" ? null : "topMove")} />
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN ── */}
      <main className="px-4 pt-4 pb-24 max-w-lg mx-auto">
        <AnimatePresence mode="wait">

          {/* ── SCREENER TAB ── */}
          {activeTab === "screener" && (
            <motion.div key="screener" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
              {/* Search row */}
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: C.muted }} />
                  <input type="text" placeholder="Ticker or blank for market scan"
                    value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleRun(false)}
                    className="w-full rounded-xl pl-8 pr-3 py-2 text-xs outline-none"
                    style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'JetBrains Mono',monospace" }} />
                </div>
                <button onClick={() => handleRun(false)} disabled={running}
                  className="px-4 py-2 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer transition-all"
                  style={{ background: running ? C.surfaceHi : scenarioActive ? "rgba(6,182,212,0.85)" : C.indigo, color: running ? C.muted : "#fff", border: `1px solid ${running ? C.border : scenarioActive ? "rgba(6,182,212,0.4)" : "rgba(99,102,241,0.4)"}` }}>
                  {running
                    ? <><span style={{ width: 10, height: 10, border: `1.5px solid ${C.muted}`, borderTopColor: C.text, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Scanning…</>
                    : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>{scenarioActive ? "Run Scenario" : "Scan"}</>
                  }
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl px-4 py-3" style={{ background: C.redBg, border: `1px solid ${C.redBorder}` }}>
                  <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{error}</div>
                  <button onClick={() => handleRun(false)} style={{ marginTop: 4, fontSize: 10, color: C.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Try Again</button>
                </div>
              )}

              {/* Active filter bar */}
              {ran && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                  {strategy > 0 && (
                    <span style={{ fontSize: 9, background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}`, padding: "2px 8px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {STRATEGY_LIST[strategy]}
                      <button onClick={() => setStrategy(0)} style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  )}
                  <span style={{ fontSize: 9, background: C.surfaceHi, color: C.sub, border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                    {SORT_OPTIONS.find(o => o.key === sortKey)?.label || "Score"} {sortDir === "desc" ? "↓" : "↑"}
                  </span>
                </div>
              )}

              {/* Empty state */}
              {!ran && !running && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 0 24px rgba(99,102,241,0.3)" }}>
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-white mb-2">Option Chamber</h2>
                  <p className="text-xs leading-relaxed max-w-[260px]" style={{ color: C.muted }}>
                    Enter a ticker and tap <strong style={{ color: C.indigo }}>Scan</strong> for a single stock, or leave blank to screen the full market.
                  </p>
                </div>
              )}

              {ran && filtered.length === 0 && !error && (
                <div className="py-16 text-center">
                  <div className="text-3xl mb-3">🔍</div>
                  <div className="text-sm font-bold mb-1" style={{ color: C.sub }}>No strategies found</div>
                  <div className="text-xs" style={{ color: C.muted }}>Try a different symbol or adjust filters</div>
                </div>
              )}

              {/* Results */}
              <div className="space-y-2">
                {groups.map((g, i) => <SymbolGroup key={g.symbol} group={g} index={i} />)}
              </div>
            </motion.div>
          )}

          {/* ── SCANNER TAB ── */}
          {activeTab === "scanner" && (
            <motion.div key="scanner" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Market Scanner</h2>
                <p className="text-xs text-slate-500">Scan the full market for top options setups</p>
              </div>

              {/* Scan controls */}
              <div className="gradient-card rounded-2xl p-4 space-y-3">
                <div style={{ fontSize: 11, color: C.sub }}>Leave the ticker blank to scan all liquid stocks matching your volume and market cap filters. Results are sorted by strategy score.</div>
                <button onClick={() => { handleRun(true); setActiveTab("screener"); }} disabled={running}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                  style={{ background: running ? C.surfaceHi : C.indigo, color: running ? C.muted : "#fff", border: `1px solid ${running ? C.border : "rgba(99,102,241,0.4)"}` }}>
                  <ScanLine className="w-4 h-4" />
                  {running ? "Scanning market…" : "Launch Market Scan"}
                </button>
              </div>

              {/* Top movers if results exist */}
              {ran && results.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>Last Scan · {results.length} strategies</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="gradient-card rounded-2xl p-3">
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>BULLISH</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: C.green }}>{bullishCount}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>strategies</div>
                    </div>
                    <div className="gradient-card rounded-2xl p-3">
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>BEARISH</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: C.red }}>{bearishCount}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>strategies</div>
                    </div>
                    {avgScore != null && (
                      <div className="gradient-card rounded-2xl p-3">
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>AVG SCORE</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: avgScore >= 65 ? C.green : C.amber }}>{avgScore}%</div>
                      </div>
                    )}
                    {topMover && (
                      <div className="gradient-card rounded-2xl p-3">
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>TOP MOVER</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: (topMover.change || 0) > 0 ? C.green : C.red }}>{topMover.symbol}</div>
                        <div style={{ fontSize: 10, color: (topMover.change || 0) > 0 ? C.green : C.red }}>{(topMover.change || 0) > 0 ? "+" : ""}{(topMover.change || 0).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setActiveTab("screener")}
                    className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, color: C.sub }}>
                    View Results in Screener →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SCENARIO TAB ── */}
          {activeTab === "scenario" && (
            <motion.div key="scenario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-0.5">Scenario Builder</h2>
                <p className="text-xs text-slate-500">Model a directional thesis and re-rank results</p>
              </div>
              <ScenarioPanel scenario={scenario} setScenario={setScenario} isActive={scenarioActive} />
              {scenarioActive && (
                <button onClick={() => { handleRun(false); setActiveTab("screener"); }} disabled={running}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  style={{ background: C.cyan, color: "#fff", border: "1px solid rgba(6,182,212,0.4)" }}>
                  <FlaskConical className="w-4 h-4" />
                  {running ? "Running…" : "Run Scenario Scan"}
                </button>
              )}
            </motion.div>
          )}

          {/* ── FILTERS TAB ── */}
          {activeTab === "filters" && (
            <motion.div key="filters" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <FiltersTab
                strategy={strategy} setStrategy={setStrategy}
                sortKey={sortKey} setSortKey={setSortKey}
                sortDir={sortDir} setSortDir={setSortDir}
                filters={filters} setFilters={setFilters}
                onReset={() => { setStrategy(0); setSortKey("score"); setSortDir("desc"); setFilters({ minVolume: "1M", minMarketCap: "10B", ivRange: "10-70%" }); }}
              />
            </motion.div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <SettingsTab />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
