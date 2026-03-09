# Project Specification: The Option Chamber

> **Status:** ✅ APPROVED
> **Created:** 2026-02-27
> **Last Updated:** 2026-03-06

---

## Executive Summary

**The Option Chamber** is a mobile-first progressive web application that provides institutional-grade options strategy identification and stock screening. It screens stocks by configurable criteria (volume, market cap, IV rank), scans their full option chains, and recommends high-probability strategies with clear, novice-friendly explainers detailing *why* each strategy, strike, and maturity was chosen using Greeks and probability metrics. No naked short strategies are ever recommended.

**Core Capabilities:**
- **Screener:** Filter the market dynamically by volume, market cap, IV rank, strategy type, and expiration.
- **Direct Symbol Scanning:** Search bar logic allowing users to immediately run the strategy generation algorithm on any specific stock's entire options chain.
- **Market-Wide Scanner:** A "Market-Wide" scan mode that programmatically iterates through the day's Top 20 most active options stocks, delivering an aggregated, unified list of the absolute highest-scoring strategies available across the board.

**Target Users:** Both novice and experienced options traders seeking data-driven, high-probability strategy recommendations with educational context.

---

## UI Design Source of Truth

> **⚠️ CRITICAL: All visual design, layout, component styling, color values, typography, spacing, animations, and UI component structure are defined exclusively in [`OptionChamber2.jsx`](./OptionChamber2.jsx).**
>
> This specification does NOT define visual design tokens. The React file is the single, authoritative source for how the application looks and feels. Any developer building or modifying the UI MUST reference `OptionChamber2.jsx` directly for:
>
> - **Color palette** → `const C = { ... }` (lines 86-102)
> - **Glass morphism effect** → `const glass = (o={}) => ...` (lines 105-111)
> - **Typography** → Inline `fontFamily` values throughout components
> - **Spacing & layout** → Inline style objects on every component
> - **Animation keyframes** → `<style>` block in the main `OptionChamber` component (lines 863-874)
> - **Component design patterns** → Each named function component (`DeltaRing`, `IVBar`, `SignalBadge`, `TableHeader`, `OptionRow`, `InteractivePayoff`, `NewsCard`, `Section`, `AnalyzePanel`, `ScreeningCard`, `OptionChamber`)
>
> **Do NOT introduce any visual values (hex colors, font sizes, padding, border radii, etc.) that are not already present in `OptionChamber2.jsx`. When in doubt, match the React file exactly.**

### UI Architecture Summary (from React file)

The application is a **single-screen layout** with three visual layers:

1. **Sticky Header** — App title ("Options Chamber"), current date, and a collapsible `ScreeningCard` for filters
2. **Results Table** — Split-column layout with fixed Strategy column (left) + horizontally scrollable data columns (right): Ticker, Expiry, Last, Bid/Ask, Delta (ring visualization), Theta
3. **Analyze Panel (Bottom Sheet)** — Full-detail modal that slides up from the bottom when a row is tapped. Contains: symbol header, leg breakdown, net premium, Greeks/OHLC data table, interactive payoff diagram, probability rationale, and news section

This is NOT a multi-page app. There is no router. There is no bottom nav. The entire experience lives on one screen with expand/collapse and bottom-sheet interaction patterns.

---

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|------------|----------|
| 1 | Any trader | Filter options by symbol, strategy type, and expiration | I can narrow results to what interests me | MUST |
| 2 | Any trader | See a sortable results table of options strategies | I can compare strategies at a glance | MUST |
| 3 | Any trader | Tap a strategy row to see full analysis | I can understand the strategy in depth before trading | MUST |
| 4 | Any trader | View an interactive payoff diagram for any strategy | I can visualize profit/loss scenarios before trading | MUST |
| 5 | Any trader | See Greeks (Delta, Gamma, Theta, Vega, Rho) for each strategy | I can assess risk characteristics | MUST |
| 6 | Any trader | Read plain-English rationale explaining WHY a strategy scores well | I can learn options concepts while using the app | MUST |
| 7 | Any trader | View news headlines relevant to the symbol being analyzed | I can factor sentiment into my decision | MUST |
| 8 | Experienced trader | Set custom screening criteria (volume, market cap, IV rank) | I can filter for stocks that match my trading style | MUST |
| 9 | Any trader | Search for a specific symbol to instantly pull its strategies | I can bypass the screener if I already know what I want to trade | MUST |
| 10 | Any trader | Run a "Market-Wide Scan" across the top 20 most active stocks | I can see the best setups across the market without checking stocks one by one | MUST |
| 11 | Any trader | See multi-leg strategy breakdowns (Iron Condors, Straddles, Spreads) | I can understand complex strategies with clear per-leg detail | MUST |

---

## Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | React (Vite or CRA) | Single-page app, no SSR needed |
| **State Management** | React `useState` + `useMemo` | Lightweight, no external state library required |
| **Styling** | Inline styles (JS objects) | As defined in `OptionChamber2.jsx` — no CSS framework |
| **Charts** | Custom SVG (inline) | Payoff diagrams built with raw SVG, no chart library needed |
| **Icons** | Google Material Symbols (CDN) + inline SVGs | As specified in the React file |
| **Backend** | Express.js (Node.js) | API proxy layer for all external data sources |
| **Deployment** | Vercel / local Node.js | Simple deployment target |

### Application Structure

```
TheOptionChamber/
├── src/
│   ├── OptionChamber2.jsx        # ★ UI Source of Truth — all components
│   ├── App.jsx                   # Entry point, renders OptionChamber
│   └── main.jsx                  # React DOM mount
├── server/
│   ├── server.js                 # Express server entry point
│   ├── routes/
│   │   ├── market.js             # Market data endpoints (Yahoo Finance + Alpha Vantage)
│   │   ├── options.js            # Options chain endpoints (Massive.com)
│   │   └── screener.js           # Stock screening (Yahoo Finance + Alpha Vantage + Massive.com)
│   └── lib/
│       ├── yahoo.js              # Yahoo Finance API client
│       ├── alphavantage.js       # Alpha Vantage API client
│       └── massive.js            # Massive.com API client
├── OptionChamber2.jsx            # Reference copy (UI source of truth)
├── SPEC.md                       # This file
├── package.json
└── .env                          # API keys (never committed)
```

---

## Screen Specifications

> **Visual details for all screens are defined in [`OptionChamber2.jsx`](./OptionChamber2.jsx). This section describes FUNCTIONAL behavior only.**

### Screen 1: Main View (Single Screen)

The entire application lives on one screen with three functional zones:

#### Zone A: Header + Screening Card

**Functional behavior:**
- Header displays app name and current date (formatted: "Monday, March 6, 2026")
- `ScreeningCard` is a collapsible accordion containing:
  - **Symbol search input** — Filters results by ticker symbol (case-insensitive match)
  - **Strategy dropdown** — Filter by: All, Single Option, Call Spread, Put Spread, Iron Condor, Straddle
  - **Expiration pills** — Horizontal scrollable row of date filters: ALL + specific dates
  - **Min criteria chips** — Display current Vol ≥ $1M, Cap ≥ $10B, IVR 10-70%
  - **"RUN SCREENER" button** — Triggers scan with loading state (spinner + "SCANNING…" text)
- Collapse/expand toggles via chevron icon or header area tap
- RUN SCREENER button is always visible in collapsed state

#### Zone B: Results Table

**Functional behavior:**
- Split-panel table layout:
  - **Fixed left column**: Strategy name + type badge (CALL/PUT/DEBIT C/CREDIT P/CONDOR/STRADDLE) + signal badge (BUY/SELL)
  - **Scrollable right columns**: Ticker (+ strike), Expiry, Last Price (+ % change), Bid/Ask, Delta (ring visualization), Theta
- All column headers are sortable (ascending/descending toggle)
- Sort indicator shows active column direction (▲/▼) vs inactive (⇅)
- Rows animate in with staggered `fadeUp` animation
- Empty state: "No results" message when filters return nothing
- **Tapping any row** opens the Analyze Panel (Zone C)

#### Zone C: Analyze Panel (Bottom Sheet Modal)

**Functional behavior:**
- Full-screen bottom sheet slides up from bottom with backdrop blur
- Dismissed by tapping backdrop or drag handle
- **Content sections (top to bottom):**

  1. **Strategy Label** — Centered, uppercase (e.g., "IRON CONDOR")
  2. **Symbol Header** — Symbol (left) + watchlist star toggle + underlying price + % change (right)
  3. **Leg Breakdown** — One row per leg showing: Signal badge, Expiry, Call/Put type, Strike, Bid/Ask
  4. **Net Premium** — Label + bid/ask display
  5. **Data Table** — Two-column grid with vertical divider:
     - Left: Delta, Gamma, Theta, Vega
     - Right: Open, High, Low, Last
  6. **Payoff Section (Collapsible)** — Contains:
     - Probability score bar (0-100%, color-coded: ≥80 green, ≥65 amber, <65 red)
     - Interactive SVG payoff diagram with:
       - Crosshair cursor tracking (mouse + touch)
       - Profit zone (green gradient fill)
       - Loss zone (red gradient fill)
       - Strike price marker (vertical dashed line, labeled "K=X")
       - Breakeven marker (amber dashed line, labeled "BE X")
       - Max profit / max loss annotations
       - Legend dots: Profit, Max loss $X, BE $X
     - "WHY HIGH PROBABILITY" rationale bullets with checkmark icons
  7. **News Section (Collapsible)** — Symbol-specific headlines with:
     - Sentiment indicator dot (green/red/amber)
     - Source + time ago
     - Headline text

---

## Strategy Intelligence Engine

### Eligible Strategies

| # | Strategy | Type | Min POP | Delta Range (Short) | DTE Range |
|---|----------|------|---------|---------------------|-----------| 
| 1 | Single Option (Long Call) | Debit/Directional | 40% | ≥0.70 (deep ITM) OR gamma/theta>3 | 60-90 |
| 2 | Single Option (Long Put) | Debit/Directional | 40% | ≥0.70 (deep ITM) OR gamma/theta>3 | 60-90 |
| 3 | Call Spread (Bull Call) | Debit Vertical | 40% | 0.40-0.55 (long leg) | 20-45 |
| 4 | Put Spread (Bear Put / Bull Put) | Credit Vertical | 60% | 0.15-0.30 | 20-45 |
| 5 | Iron Condor | Credit Neutral | 60% | 0.15-0.20 (both sides) | 30-45 |
| 6 | Straddle | Debit Neutral | 50% | ATM | 30-45 |
| 7 | Bear Call Spread | Credit Vertical | 60% | 0.15-0.30 | 20-45 |
| 8 | Iron Butterfly | Credit Neutral | 50% | ATM (short), OTM (long) | 30-45 |
| 9 | Calendar Spread | Time Decay | 50% | ATM | Front: 20-30, Back: 45-60 |
| 10 | Diagonal Spread | Directional+Decay | 50% | Near: OTM, Far: ITM | Near: 20-30, Far: 45-60 |
| 11 | Ratio Backspread | Debit Directional | 40% | Backspreads only | 30-60 |

**Strict Exclusion:** Naked short calls, naked short puts, ratio spreads with net short exposure.

### Scoring Algorithm

Each qualifying strategy is scored 0-100 based on:

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Probability of Profit | 30% | Higher POP = higher score |
| Risk/Reward Ratio | 25% | Better ratio = higher score |
| Theta Efficiency | 15% | Theta per dollar of risk |
| Liquidity | 15% | Bid-ask spread tightness + volume |
| IV Environment | 15% | How well IV rank matches strategy type |

Only strategies scoring ≥ 65/100 are shown, sorted by score descending.

### Strategy-Specific Criteria

**Vertical Spreads:**
- Strike width: 2.5-10 points (must be liquid strikes)
- Credit spreads: credit received ≥ 30% of max risk
- Debit spreads: max risk ≤ 3x max reward
- Both legs must have bid-ask spread ≤ $0.15 or 10% of mid price

**Iron Condors:**
- Short delta: 0.15-0.20 on both puts and calls
- Wing width: equal or 2:1 ratio (body:wings)
- Breakeven width: ≥ 10% of underlying price
- Net credit received: ≥ 30% of max risk

**Long Options:**
- Deep ITM (delta ≥ 0.70) for high probability directional
- OR high gamma/theta ratio (>3) for explosive move potential
- Must have sufficient volume (>100 contracts)
- Bid-ask spread ≤ $0.20

**Straddles:**
- Both legs must be ATM (closest strike to underlying)
- Combined premium must be ≤ 5% of underlying price
- IV rank should be below 40% (buying cheap volatility)

---

## API / Data Contract

### Data Source Strategy

The backend uses a **three-API mix** with **Yahoo Finance as the primary source** for all market data. Alpha Vantage enriches with fundamentals and sentiment. Massive.com provides options-specific data.

**Priority order: Yahoo Finance → Alpha Vantage → Massive.com**

| Priority | API | Role | Key Data Points | Rate Limits |
|----------|-----|------|----------------|-------------|
| 🥇 PRIMARY | **Yahoo Finance** | Main data source for all market data, quotes, news, search, screening | Indices, quotes, chart data, OHLC, most actives, gainers/losers, news headlines, screener universe | Unofficial — respectful throttling required |
| 🥈 SECONDARY | **Alpha Vantage** | Enrichment layer for fundamentals, sentiment, and historical data | P/E ratio, PEG, EPS, dividend yield, analyst target, 52W high/low, beta, earnings calendar, news sentiment scores, historical prices | 25 requests/day (free), 75 req/min (premium) |
| 🥉 TERTIARY | **Massive.com** | Options chain specialist — Greeks and chain data | Full option chains, Greeks (Δ, Γ, Θ, V), IV, **bid/ask quotes**, OI, volume, fair market value | Unlimited calls (Options Starter $29/month), 15-min delay |

> **⚠️ CRITICAL: Bid/Ask Data on Option Chains**
>
> Bid and ask prices on option contracts are **essential** for strategy scoring, premium calculations, and the Analyze Panel display. The backend MUST ensure that every option contract returned includes `bid` and `ask` values (from `last_quote.bid` and `last_quote.ask` in the Massive.com response). Contracts without bid/ask data should be flagged or excluded from strategy recommendations.

### API Key Configuration

```env
# .env (never committed to version control)
ALPHAVANTAGE_API_KEY=6W488TJ7J0PHX0KU
MASSIVE_API_KEY=zmjdCY4rhyGaskT0xujfjWz1afp8nOR4
# Yahoo Finance — no API key needed (unofficial API)
```

### Backend Proxy Endpoints

| Route | Method | Primary Source | Fallback Source | Purpose |
|-------|--------|---------------|----------------|---------|
| `/api/market/indices` | GET | Yahoo Finance | — | Major indices (S&P 500, NASDAQ, DOW, VIX) |
| `/api/market/search?q=` | GET | Yahoo Finance | — | Symbol search autocomplete |
| `/api/market/quote/:ticker` | GET | Yahoo Finance | Alpha Vantage `GLOBAL_QUOTE` | Stock quote (price, change, volume, OHLC) |
| `/api/market/chart/:ticker?range=` | GET | Yahoo Finance | Alpha Vantage `TIME_SERIES_DAILY` | Price chart data (1D, 1W, 1M, 3M, 6M, 1Y) |
| `/api/market/trending` | GET | Yahoo Finance | — | Most active stocks, top gainers/losers |
| `/api/market/news/:ticker` | GET | Yahoo Finance | Alpha Vantage `NEWS_SENTIMENT` | News headlines + sentiment for a symbol |
| `/api/fundamentals/:ticker` | GET | Alpha Vantage `OVERVIEW` | Yahoo Finance summary | P/E, dividend yield, analyst target, 52W range, beta, earnings |
| `/api/options/chain/:ticker` | GET | Massive.com | — | Full option chain with Greeks + **bid/ask** |
| `/api/options/contracts/:ticker` | GET | Massive.com | — | Available contracts reference |
| `/api/screener/scan` | POST | Yahoo Finance (universe) + Massive.com (chains) | Alpha Vantage (enrichment) | Stock screen + IV enrichment + chain scan |

### Data Flow: Enriched Quote

When a user taps a row and the Analyze Panel opens, the backend combines data from all three APIs:

```
Client taps row → GET /api/market/quote/AAPL
                     └─ Yahoo Finance (PRIMARY) → price, change, volume, market cap, OHLC
                     └─ If Yahoo fails → Alpha Vantage GLOBAL_QUOTE (FALLBACK)

              → GET /api/fundamentals/AAPL
                     └─ Alpha Vantage OVERVIEW → P/E, dividend yield, 52W range, analyst target, beta
                     └─ If Alpha Vantage rate-limited → Yahoo Finance summary (FALLBACK)

              → GET /api/options/chain/AAPL
                     └─ Massive.com → full chain with Greeks, IV, bid/ask, OI
                     └─ ⚠️ MUST validate: last_quote.bid and last_quote.ask are present

              → GET /api/market/news/AAPL
                     └─ Yahoo Finance (PRIMARY) → headline feeds
                     └─ Alpha Vantage NEWS_SENTIMENT (ENRICHMENT) → sentiment scores
```

### Data Flow: Market-Wide Scan

```
Client clicks "RUN SCREENER" in Market-Wide mode
  → POST /api/screener/scan { mode: "market-wide" }
     1. Yahoo Finance (PRIMARY) → fetch top 20 most active options stocks
     2. For each of 20 tickers (parallelized, batched in 5s):
        a. Yahoo Finance → quote + OHLC data
        b. Alpha Vantage → fundamentals enrichment (cached, rate-limit aware)
        c. Massive.com → full option chain + Greeks + bid/ask
     3. Strategy engine scores all candidate strategies
        ⚠️ Strategies where ANY leg is missing bid/ask data are excluded
     4. Return top strategies sorted by score (≥ 65 threshold)
     5. Client receives: unified ranked list with progress updates
```

### 🥇 Yahoo Finance API Integration (PRIMARY)

**Method:** Direct HTTP requests to Yahoo Finance endpoints (no API key required)
**Role:** Primary data source for all market data, quotes, news, search, and screening

**Key Endpoints:**

| Purpose | URL Pattern | Data Points |
|---------|-------------|-------------|
| Quote | `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}` | Price, volume, OHLC, market cap |
| Search | `https://query1.finance.yahoo.com/v1/finance/search?q={query}` | Symbol autocomplete |
| Trending | `https://query1.finance.yahoo.com/v1/finance/trending/US` | Most active, gainers, losers |
| Screener | `https://query1.finance.yahoo.com/v1/finance/screener/...` | Filter by volume, market cap |
| News | `https://query1.finance.yahoo.com/v1/finance/...` | Headlines, news feeds per symbol |

**Important:** Yahoo Finance is unofficial. Implement retry logic with exponential backoff and graceful degradation if endpoints change.

### 🥈 Alpha Vantage API Integration (SECONDARY — Enrichment & Fallback)

**Base URL:** `https://www.alphavantage.co/query`
**Auth:** Query parameter `apikey=<ALPHAVANTAGE_API_KEY>`
**Role:** Enrichment layer for fundamentals, sentiment analysis, and fallback when Yahoo Finance is unavailable

**Key Endpoints:**

| Function | Endpoint | Data Points | Use Case |
|----------|----------|-------------|----------|
| `OVERVIEW` | `?function=OVERVIEW&symbol=AAPL` | P/E, PEG, EPS, dividend yield, market cap, analyst target, 52W high/low, beta, sector, industry | Fundamentals enrichment |
| `GLOBAL_QUOTE` | `?function=GLOBAL_QUOTE&symbol=AAPL` | Price, change, volume, open, high, low, prev close | Fallback when Yahoo quote fails |
| `NEWS_SENTIMENT` | `?function=NEWS_SENTIMENT&tickers=AAPL` | News with sentiment scores (bullish/bearish/neutral), relevance ranking | Enriches Yahoo Finance news with sentiment analysis |
| `TIME_SERIES_DAILY` | `?function=TIME_SERIES_DAILY&symbol=AAPL` | Historical daily prices (OHLCV) | IV rank calculation, fallback chart data |
| `EARNINGS` | `?function=EARNINGS&symbol=AAPL` | Quarterly/annual earnings, EPS estimates | Earnings calendar awareness for strategies |

**Tier Constraints (Free Tier):**
- 25 requests per day
- Must cache aggressively — cache Alpha Vantage responses for **15+ minutes minimum**
- If rate limited → gracefully skip enrichment, serve Yahoo Finance data alone
- Consider upgrading to premium ($49.99/month) for 75 req/min if needed

### 🥉 Massive.com API Integration (TERTIARY — Options Specialist)

**Base URL:** `https://api.massive.com`
**Auth:** `Authorization: Bearer <MASSIVE_API_KEY>` (server-side only)
**Role:** Sole source for options chain data, Greeks, and the critical **bid/ask quotes** on option contracts

**Primary Endpoint — Option Chain Snapshot:**
```
GET /v3/snapshot/options/{ticker}
```

Query Parameters: `strike_price`, `expiration_date`, `contract_type`, `order`, `limit` (max 1000), `sort`

Response fields used:
```json
{
  "results": [{
    "ticker": "O:AAPL250321C00180000",
    "contract_type": "call",
    "strike_price": 180.0,
    "expiration_date": "2025-03-21",
    "shares_per_contract": 100,
    "greeks": { "delta": 0.65, "gamma": 0.03, "theta": -0.12, "vega": 0.18 },
    "implied_volatility": 0.342,
    "open_interest": 5432,
    "last_quote": {
      "bid": 5.20,       // ⚠️ CRITICAL — must be present and non-null
      "ask": 5.40,       // ⚠️ CRITICAL — must be present and non-null
      "midpoint": 5.30
    },
    "fmv": 5.28,
    "underlying_asset": { "ticker": "AAPL", "price": 182.50, "change_to_break_even": -2.50 }
  }]
}
```

> **⚠️ Bid/Ask Validation Rule:**
> Before passing any option contract to the strategy engine, the backend MUST verify:
> - `last_quote.bid` exists and is > 0
> - `last_quote.ask` exists and is > 0
> - `ask > bid` (no inverted markets)
>
> Contracts failing these checks are excluded from strategy recommendations and flagged in logs.

**Tier Constraints (Options Starter - $29/month):**
- Unlimited API calls ✅
- 15-minute delayed data (not real-time)
- Greeks, Snapshots, Reference data ✅
- No real-time quotes/trades (would need Advanced $199/month)

### API Fallback Strategy

**Rule: Yahoo Finance is ALWAYS tried first. Alpha Vantage is the fallback. Massive.com is the sole source for options data.**

```
Priority chain per data type:
┌────────────────────┬─────────────────────────────────────────────────────┐
│ Data Type          │ 🥇 Primary → 🥈 Fallback → 🥉 Last Resort          │
├────────────────────┼─────────────────────────────────────────────────────┤
│ Stock Price/Quote  │ Yahoo Finance → Alpha Vantage GLOBAL_QUOTE          │
│ Fundamentals       │ Yahoo Finance → Alpha Vantage OVERVIEW              │
│ News Headlines     │ Yahoo Finance → Alpha Vantage NEWS_SENTIMENT        │
│ Sentiment Scores   │ Alpha Vantage NEWS_SENTIMENT (enrichment, optional) │
│ Historical Prices  │ Yahoo Finance → Alpha Vantage TIME_SERIES_DAILY     │
│ Trending Stocks    │ Yahoo Finance (sole source)                         │
│ Screener/Filter    │ Yahoo Finance (sole source for universe)            │
│ Options Chain      │ Massive.com (sole source) ⚠️ bid/ask required      │
│ Greeks             │ Massive.com (sole source)                           │
│ Bid/Ask Quotes     │ Massive.com last_quote (sole source) ⚠️ CRITICAL   │
│ Earnings Calendar  │ Alpha Vantage EARNINGS (enrichment, optional)       │
└────────────────────┴─────────────────────────────────────────────────────┘
```

---

## Component Inventory

> **Visual styling for all components is defined in [`OptionChamber2.jsx`](./OptionChamber2.jsx). This table lists functional states only.**

### Core Components

| # | Component | File Reference | Functional States |
|---|-----------|---------------|-------------------|
| 1 | **OptionChamber** | Main export, lines 822-1037 | Default, Running scan, Showing results, Panel open |
| 2 | **ScreeningCard** | Lines 700-818 | Collapsed (header + RUN button visible), Expanded (filters visible), Running (spinner) |
| 3 | **OptionRow** | Lines 220-301 | Default, Hover highlight, Animating in |
| 4 | **TableHeader** | Lines 180-218 | Default, Active sort column, Sort direction (asc/desc) |
| 5 | **AnalyzePanel** | Lines 497-692 | Open, Closing, Watched/Unwatched star |
| 6 | **InteractivePayoff** | Lines 305-422 | Idle, Cursor tracking (showing price + P&L tooltip) |
| 7 | **Section** | Lines 465-493 | Collapsed, Expanded |
| 8 | **NewsCard** | Lines 426-447 | Has news, Empty state |
| 9 | **DeltaRing** | Lines 117-131 | Color varies by delta: ≥0.65 green, ≥0.55 amber, ≥0.45 blue, <0.45 purple |
| 10 | **IVBar** | Lines 135-146 | Color varies by IV: >50% red, >35% amber, ≤35% green |
| 11 | **SignalBadge** | Lines 150-162 | BUY (green), SELL (red); size: sm, normal |

---

## Interaction Map

| Element | Trigger | Result | Error Case |
|---------|---------|--------|------------|
| ScreeningCard header | Tap | Expand/collapse filter panel | N/A |
| Symbol search input | Type | Filter results table in real-time | "No results" row |
| Strategy dropdown | Change | Filter results table | N/A |
| Expiry pill | Tap | Filter by expiration date | N/A |
| "RUN SCREENER" button | Tap | Spinner + "SCANNING…" → Results populate | "Scan failed" toast |
| Column header | Tap | Sort ascending/descending toggle | N/A |
| Results row | Tap | AnalyzePanel slides up from bottom | N/A |
| AnalyzePanel backdrop | Tap | Panel dismisses | N/A |
| Watchlist star | Tap | Toggle watched state (scale animation) | N/A |
| Payoff diagram | Mouse/Touch move | Crosshair + price/P&L tooltip follows cursor | N/A |
| Payoff diagram | Mouse leave / Touch end | Cursor tooltip hides | N/A |
| Section chevron | Tap | Expand/collapse content | N/A |
| Market-Wide Scan toggle | Tap | Switch between Single Stock and Market-Wide mode | N/A |
| Market-Wide Scan progress | During scan | Progress indicator (e.g., "Analyzing AAPL 3/20…") | "Scan failed" toast |

---

## Acceptance Criteria

### Core Functionality
- [ ] Screening card expands/collapses with filters: symbol, strategy, expiry, criteria chips
- [ ] RUN SCREENER triggers scan with spinner loading state
- [ ] Results table shows all qualifying options strategies
- [ ] All column headers are sortable (ascending/descending)
- [ ] Fixed Strategy column stays visible during horizontal scroll
- [ ] Tapping a row opens the Analyze Panel bottom sheet
- [ ] Analyze Panel shows: strategy label, symbol header, leg breakdown, net premium, data table, payoff, rationale, news
- [ ] Interactive payoff diagram tracks cursor (mouse + touch) with price/P&L tooltip
- [ ] Payoff diagram shows profit zone (green), loss zone (red), strike marker, breakeven marker
- [ ] Probability score bar renders correctly (green ≥80, amber ≥65, red <65)
- [ ] "WHY HIGH PROBABILITY" rationale shows context-specific bullet points
- [ ] News section shows sentiment-colored headlines per symbol
- [ ] Multi-leg strategies (Iron Condor, Straddle, Spreads) show per-leg detail
- [ ] No naked short strategies are ever recommended
- [ ] Only strategies scoring ≥65 are shown, sorted by score
- [ ] Market-Wide Scan iterates top 20 most active stocks with progress feedback
- [ ] Direct symbol search bypasses screener and runs against full chain

### Data & API
- [ ] Yahoo Finance is the PRIMARY source for all market data (quotes, news, search, trending, screening)
- [ ] Alpha Vantage is the SECONDARY source (fundamentals enrichment + fallback when Yahoo fails)
- [ ] Massive.com is the TERTIARY source (sole provider for options chains + Greeks)
- [ ] Every option contract has validated bid/ask data before being passed to strategy engine
- [ ] Contracts with missing/zero/inverted bid/ask are excluded from recommendations
- [ ] News sourced from Yahoo Finance (primary) + Alpha Vantage NEWS_SENTIMENT (enrichment)
- [ ] Alpha Vantage provides enrichment: P/E, dividend yield, analyst target, 52W range, earnings, sentiment
- [ ] API keys are never exposed to the client (all requests proxied through Express)
- [ ] Alpha Vantage responses are cached for ≥15 minutes (rate limit protection)
- [ ] Fallback chain: Yahoo fails → Alpha Vantage. Alpha Vantage rate-limited → skip enrichment gracefully
- [ ] All API calls have error handling with graceful degradation
- [ ] No mock data in production — all data from live APIs
- [ ] Trending/most active stocks fetched dynamically (no hardcoded stock lists)

### Visual & UX
- [ ] UI matches `OptionChamber2.jsx` exactly — no visual deviations
- [ ] Dark theme is the only theme (no light mode toggle required for MVP)
- [ ] Financial numbers use monospace font
- [ ] Positive values = green, Negative values = red
- [ ] Delta ring visualization renders correctly with color tiers
- [ ] IV bar renders correctly with color tiers
- [ ] Skeleton/shimmer loading states for all async operations
- [ ] Error states show clear messages with retry option
- [ ] Staggered fadeUp animation on results rows
- [ ] Mobile-first: optimized for 448px max-width, centered

### Technical
- [ ] API keys stored in `.env` and never committed
- [ ] Express server proxies all external API requests
- [ ] No console.log in production code
- [ ] All inputs validated
- [ ] Loads in under 3 seconds on 4G
- [ ] No console errors in production

---

## Out of Scope (Phase 2)

- Light/Dark mode toggle (dark only for MVP)
- Watchlist persistence / Save functionality
- User authentication / accounts
- Real-time streaming (WebSocket)
- Push notifications
- Trade execution
- Historical backtesting
- PWA offline mode
- Social sharing
- TradingView chart integration (custom SVG payoff is sufficient for MVP)
- Multi-page routing (single screen is the design)

---

> **Approval:** ✅ **APPROVED** (2026-03-06)
>
> Specification approved. Development begins using the builder skill.
