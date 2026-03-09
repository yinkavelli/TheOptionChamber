// Strategy Intelligence Engine
// Scores and identifies high-probability options strategies
// Per spec: 11 eligible strategies, scoring 0-100, threshold ≥65

/**
 * Calculate days to expiration from a date string
 */
function calcDTE(expirationDate) {
    const exp = new Date(expirationDate);
    const now = new Date();
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

/**
 * Normal CDF for Black-Scholes
 */
function normalCDF(x) {
    let t = 1 / (1 + 0.2316419 * Math.abs(x));
    let d = 0.3989423 * Math.exp(-x * x / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
}

/**
 * Black-Scholes option pricing model
 * type: 'call' or 'put'
 * S: Underlying Price
 * K: Strike Price
 * T: Time to Expiration (in years)
 * r: Risk-free rate (e.g. 0.045 for 4.5%)
 * v: Implied Volatility (decimal)
 */
function blackScholes(type, S, K, T, r, v) {
    // Handle edge cases
    if (T <= 0 || v <= 0) {
        return type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    }

    let d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    let d2 = d1 - v * Math.sqrt(T);

    if (type === 'call') {
        return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    } else {
        return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    }
}

/**
 * Analyze an option leg to calculate its theoretical edge
 */
function calcLegEdge(contract, underlyingPrice, dte) {
    const r = 0.045; // Assumed 4.5% risk-free rate
    const T = Math.max(dte / 365, 0.001); // Time in years

    const theoPrice = blackScholes(
        contract.contractType,
        underlyingPrice,
        contract.strikePrice,
        T,
        r,
        contract.impliedVolatility
    );

    const marketMid = contract.midpoint || ((contract.bid + contract.ask) / 2);

    // For calculating mathematical edge:
    // If selling (credit), you want market price > theo price
    // If buying (debit), you want market price < theo price
    const diff = marketMid - theoPrice;
    const edgePct = theoPrice > 0 ? (diff / theoPrice) * 100 : 0;

    return {
        theoPrice: Math.round(theoPrice * 100) / 100,
        edgeAmount: Math.round(diff * 100) / 100,
        edgePct: Math.round(edgePct * 10) / 10
    };
}

/**
 * Calculate probability of profit based on delta
 * For credit spreads: POP ≈ 1 - |short delta|
 * For debit spreads: POP ≈ |long delta|
 */
function calcPOP(delta, strategyType) {
    const absDelta = Math.abs(delta);
    switch (strategyType) {
        case 'credit':
            return (1 - absDelta) * 100;
        case 'debit':
            return absDelta * 100;
        case 'neutral':
            return (1 - absDelta * 2) * 100;
        default:
            return absDelta * 100;
    }
}

/**
 * Score a strategy 0-100 based on spec criteria
 * Weights: POP 30%, Risk/Reward 25%, Theta Efficiency 15%, Liquidity 15%, IV Environment 15%
 */
function scoreStrategy({ pop, riskRewardRatio, thetaPerRisk, liquidityScore, ivScore, strategyClass = 'debit' }) {
    const popScore = Math.min(100, pop);
    // Credit strategies have inherently low R/R (0.10-0.40)
    // Debit strategies have higher R/R (typically > 0.5)
    const rrMultiplier = strategyClass === 'credit' ? 200 : 50;
    const rrScore = Math.min(100, riskRewardRatio * rrMultiplier);
    const thetaScore = Math.min(100, thetaPerRisk * 500);

    return Math.round(
        popScore * 0.30 +
        rrScore * 0.25 +
        thetaScore * 0.15 +
        liquidityScore * 0.15 +
        ivScore * 0.15
    );
}

/**
 * Calculate liquidity score based on bid-ask spread and volume
 */
function calcLiquidityScore(bid, ask, volume) {
    const spread = ask - bid;
    const mid = (bid + ask) / 2;
    const spreadPct = mid > 0 ? spread / mid : 1;

    // Tight spread = high score
    let spreadScore = spreadPct <= 0.02 ? 100 : spreadPct <= 0.05 ? 80 : spreadPct <= 0.10 ? 60 : spreadPct <= 0.20 ? 40 : 20;
    // High volume = high score
    let volScore = volume >= 1000 ? 100 : volume >= 500 ? 80 : volume >= 100 ? 60 : volume >= 50 ? 40 : 20;

    return (spreadScore + volScore) / 2;
}

/**
 * Calculate IV environment score — how well IV rank matches strategy type
 */
function calcIVScore(iv, strategyClass) {
    const ivPct = iv * 100; // Convert from decimal if needed
    const ivNorm = ivPct > 1 ? ivPct : ivPct * 100;

    // Credit strategies benefit from high IV, debit from low IV
    if (strategyClass === 'credit') {
        return ivNorm >= 50 ? 90 : ivNorm >= 35 ? 70 : ivNorm >= 20 ? 50 : 30;
    } else if (strategyClass === 'debit') {
        return ivNorm <= 25 ? 90 : ivNorm <= 35 ? 70 : ivNorm <= 50 ? 50 : 30;
    } else {
        // Neutral: sweet spot 30-50
        return (ivNorm >= 30 && ivNorm <= 50) ? 85 : (ivNorm >= 20 && ivNorm <= 60) ? 65 : 40;
    }
}

/**
 * Find vertical spreads (bull call, bear put, bull put, bear call)
 */
function findVerticalSpreads(contracts, underlyingPrice) {
    const strategies = [];

    // Group by expiration
    const byExpiry = {};
    for (const c of contracts) {
        const key = c.expirationDate;
        if (!byExpiry[key]) byExpiry[key] = { calls: [], puts: [] };
        if (c.contractType === 'call') byExpiry[key].calls.push(c);
        else byExpiry[key].puts.push(c);
    }

    for (const [expiry, { calls, puts }] of Object.entries(byExpiry)) {
        const dte = calcDTE(expiry);
        if (dte < 15 || dte > 60) continue;

        // Sort by strike
        calls.sort((a, b) => a.strikePrice - b.strikePrice);
        puts.sort((a, b) => a.strikePrice - b.strikePrice);

        // Bull Put Spread (Credit) — sell higher put, buy lower put
        for (let i = 0; i < puts.length - 1; i++) {
            for (let j = i + 1; j < puts.length && puts[j].strikePrice - puts[i].strikePrice <= 25; j++) {
                const shortPut = puts[j]; // Higher strike (sold)
                const longPut = puts[i];  // Lower strike (bought)

                if (Math.abs(shortPut.delta) < 0.15 || Math.abs(shortPut.delta) > 0.30) continue;

                const credit = shortPut.midpoint - longPut.midpoint;
                const maxRisk = (shortPut.strikePrice - longPut.strikePrice) - credit;
                if (credit <= 0 || maxRisk <= 0) continue;

                const pop = calcPOP(shortPut.delta, 'credit');
                const rr = credit / maxRisk;
                const thetaPerRisk = Math.abs(shortPut.theta - longPut.theta) / maxRisk;
                const liquidity = (calcLiquidityScore(shortPut.bid, shortPut.ask, shortPut.volume) +
                    calcLiquidityScore(longPut.bid, longPut.ask, longPut.volume)) / 2;
                const ivScore = calcIVScore(shortPut.impliedVolatility, 'credit');

                const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'credit' });
                if (score < 55) continue;

                strategies.push({
                    strategy: 'Bull Put Spread',
                    type: 'Credit Vertical',
                    signal: 'SELL',
                    score,
                    pop: Math.round(pop),
                    symbol: shortPut.underlyingTicker,
                    underlying: underlyingPrice,
                    expiry: expiry,
                    dte,
                    edge: Math.round((calcLegEdge(shortPut, underlyingPrice, dte).edgeAmount - calcLegEdge(longPut, underlyingPrice, dte).edgeAmount) * 100) / 100,
                    legs: [
                        { signal: 'SELL', type: 'P', strike: shortPut.strikePrice, expiry, bid: shortPut.bid, ask: shortPut.ask, delta: shortPut.delta },
                        { signal: 'BUY', type: 'P', strike: longPut.strikePrice, expiry, bid: longPut.bid, ask: longPut.ask, delta: longPut.delta },
                    ],
                    credit,
                    maxRisk,
                    maxProfit: credit,
                    breakeven: shortPut.strikePrice - credit,
                    bid: Math.round((shortPut.bid - longPut.ask) * 100) / 100,
                    ask: Math.round((shortPut.ask - longPut.bid) * 100) / 100,
                    delta: shortPut.delta - longPut.delta,
                    theta: shortPut.theta - longPut.theta,
                    iv: (shortPut.impliedVolatility + longPut.impliedVolatility) / 2,
                    vol: `${((shortPut.volume + longPut.volume) / 1000).toFixed(1)}k`,
                    oi: `${((shortPut.openInterest + longPut.openInterest) / 1000).toFixed(1)}k`,
                });
            }
        }

        // Bear Call Spread (Credit) — sell lower call, buy higher call
        for (let i = 0; i < calls.length - 1; i++) {
            for (let j = i + 1; j < calls.length && calls[j].strikePrice - calls[i].strikePrice <= 25; j++) {
                const shortCall = calls[i]; // Lower strike (sold)
                const longCall = calls[j]; // Higher strike (bought)

                if (Math.abs(shortCall.delta) < 0.15 || Math.abs(shortCall.delta) > 0.30) continue;

                const credit = shortCall.midpoint - longCall.midpoint;
                const maxRisk = (longCall.strikePrice - shortCall.strikePrice) - credit;
                if (credit <= 0 || maxRisk <= 0) continue;

                const pop = calcPOP(shortCall.delta, 'credit');
                const rr = credit / maxRisk;
                const thetaPerRisk = Math.abs(shortCall.theta - longCall.theta) / maxRisk;
                const liquidity = (calcLiquidityScore(shortCall.bid, shortCall.ask, shortCall.volume) +
                    calcLiquidityScore(longCall.bid, longCall.ask, longCall.volume)) / 2;
                const ivScore = calcIVScore(shortCall.impliedVolatility, 'credit');

                const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'credit' });
                if (score < 55) continue;

                strategies.push({
                    strategy: 'Bear Call Spread',
                    type: 'Credit Vertical',
                    signal: 'SELL',
                    score,
                    pop: Math.round(pop),
                    symbol: shortCall.underlyingTicker,
                    underlying: underlyingPrice,
                    expiry,
                    dte,
                    edge: Math.round((calcLegEdge(shortCall, underlyingPrice, dte).edgeAmount - calcLegEdge(longCall, underlyingPrice, dte).edgeAmount) * 100) / 100,
                    legs: [
                        { signal: 'SELL', type: 'C', strike: shortCall.strikePrice, expiry, bid: shortCall.bid, ask: shortCall.ask, delta: shortCall.delta },
                        { signal: 'BUY', type: 'C', strike: longCall.strikePrice, expiry, bid: longCall.bid, ask: longCall.ask, delta: longCall.delta },
                    ],
                    credit,
                    maxRisk,
                    maxProfit: credit,
                    breakeven: shortCall.strikePrice + credit,
                    bid: Math.round((shortCall.bid - longCall.ask) * 100) / 100,
                    ask: Math.round((shortCall.ask - longCall.bid) * 100) / 100,
                    delta: shortCall.delta - longCall.delta,
                    theta: shortCall.theta - longCall.theta,
                    iv: (shortCall.impliedVolatility + longCall.impliedVolatility) / 2,
                    vol: `${((shortCall.volume + longCall.volume) / 1000).toFixed(1)}k`,
                    oi: `${((shortCall.openInterest + longCall.openInterest) / 1000).toFixed(1)}k`,
                });
            }
        }

        // Bull Call Spread (Debit) — buy lower call, sell higher call
        for (let i = 0; i < calls.length - 1; i++) {
            for (let j = i + 1; j < calls.length && calls[j].strikePrice - calls[i].strikePrice <= 25; j++) {
                const longCall = calls[i];  // Lower strike (bought)
                const shortCall = calls[j]; // Higher strike (sold)

                if (Math.abs(longCall.delta) < 0.40 || Math.abs(longCall.delta) > 0.55) continue;

                const debit = longCall.midpoint - shortCall.midpoint;
                const maxProfit = (shortCall.strikePrice - longCall.strikePrice) - debit;
                if (debit <= 0 || maxProfit <= 0) continue;
                if (debit > maxProfit * 3) continue;

                const pop = calcPOP(longCall.delta, 'debit');
                const rr = maxProfit / debit;
                const thetaPerRisk = Math.abs(longCall.theta - shortCall.theta) / debit;
                const liquidity = (calcLiquidityScore(longCall.bid, longCall.ask, longCall.volume) +
                    calcLiquidityScore(shortCall.bid, shortCall.ask, shortCall.volume)) / 2;
                const ivScore = calcIVScore(longCall.impliedVolatility, 'debit');

                const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'debit' });
                if (score < 55) continue;

                strategies.push({
                    strategy: 'Call Spread',
                    type: 'Debit Vertical',
                    signal: 'BUY',
                    score,
                    pop: Math.round(pop),
                    symbol: longCall.underlyingTicker,
                    underlying: underlyingPrice,
                    expiry,
                    dte,
                    edge: Math.round((calcLegEdge(shortCall, underlyingPrice, dte).edgeAmount - calcLegEdge(longCall, underlyingPrice, dte).edgeAmount) * -100) / 100,
                    legs: [
                        { signal: 'BUY', type: 'C', strike: longCall.strikePrice, expiry, bid: longCall.bid, ask: longCall.ask, delta: longCall.delta },
                        { signal: 'SELL', type: 'C', strike: shortCall.strikePrice, expiry, bid: shortCall.bid, ask: shortCall.ask, delta: shortCall.delta },
                    ],
                    debit,
                    maxRisk: debit,
                    maxProfit,
                    breakeven: longCall.strikePrice + debit,
                    bid: Math.round((longCall.bid - shortCall.ask) * 100) / 100,
                    ask: Math.round((longCall.ask - shortCall.bid) * 100) / 100,
                    delta: longCall.delta - shortCall.delta,
                    theta: longCall.theta - shortCall.theta,
                    iv: (longCall.impliedVolatility + shortCall.impliedVolatility) / 2,
                    vol: `${((longCall.volume + shortCall.volume) / 1000).toFixed(1)}k`,
                    oi: `${((longCall.openInterest + shortCall.openInterest) / 1000).toFixed(1)}k`,
                });
            }
        }

        // Put Spread (Bear Put — Debit) — buy higher put, sell lower put
        for (let i = 0; i < puts.length - 1; i++) {
            for (let j = i + 1; j < puts.length && puts[j].strikePrice - puts[i].strikePrice <= 25; j++) {
                const shortPut = puts[i]; // Lower strike (sold)
                const longPut = puts[j];  // Higher strike (bought)

                if (Math.abs(longPut.delta) < 0.40 || Math.abs(longPut.delta) > 0.55) continue;

                const debit = longPut.midpoint - shortPut.midpoint;
                const maxProfit = (longPut.strikePrice - shortPut.strikePrice) - debit;
                if (debit <= 0 || maxProfit <= 0) continue;
                if (debit > maxProfit * 3) continue;

                const pop = calcPOP(longPut.delta, 'debit');
                const rr = maxProfit / debit;
                const thetaPerRisk = Math.abs(longPut.theta - shortPut.theta) / debit;
                const liquidity = (calcLiquidityScore(longPut.bid, longPut.ask, longPut.volume) +
                    calcLiquidityScore(shortPut.bid, shortPut.ask, shortPut.volume)) / 2;
                const ivScore = calcIVScore(longPut.impliedVolatility, 'debit');

                const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'debit' });
                if (score < 55) continue;

                strategies.push({
                    strategy: 'Put Spread',
                    type: 'Debit Vertical',
                    signal: 'BUY',
                    score,
                    pop: Math.round(pop),
                    symbol: longPut.underlyingTicker,
                    underlying: underlyingPrice,
                    expiry,
                    dte,
                    edge: Math.round((calcLegEdge(shortPut, underlyingPrice, dte).edgeAmount - calcLegEdge(longPut, underlyingPrice, dte).edgeAmount) * -100) / 100,
                    legs: [
                        { signal: 'BUY', type: 'P', strike: longPut.strikePrice, expiry, bid: longPut.bid, ask: longPut.ask, delta: longPut.delta },
                        { signal: 'SELL', type: 'P', strike: shortPut.strikePrice, expiry, bid: shortPut.bid, ask: shortPut.ask, delta: shortPut.delta },
                    ],
                    debit,
                    maxRisk: debit,
                    maxProfit,
                    breakeven: longPut.strikePrice - debit,
                    bid: Math.round((longPut.bid - shortPut.ask) * 100) / 100,
                    ask: Math.round((longPut.ask - shortPut.bid) * 100) / 100,
                    delta: longPut.delta - shortPut.delta,
                    theta: longPut.theta - shortPut.theta,
                    iv: (longPut.impliedVolatility + shortPut.impliedVolatility) / 2,
                    vol: `${((longPut.volume + shortPut.volume) / 1000).toFixed(1)}k`,
                    oi: `${((longPut.openInterest + shortPut.openInterest) / 1000).toFixed(1)}k`,
                });
            }
        }
    }

    return strategies;
}

/**
 * Find Iron Condors
 */
function findIronCondors(contracts, underlyingPrice) {
    const strategies = [];

    const byExpiry = {};
    for (const c of contracts) {
        const key = c.expirationDate;
        if (!byExpiry[key]) byExpiry[key] = { calls: [], puts: [] };
        if (c.contractType === 'call') byExpiry[key].calls.push(c);
        else byExpiry[key].puts.push(c);
    }

    for (const [expiry, { calls, puts }] of Object.entries(byExpiry)) {
        const dte = calcDTE(expiry);
        if (dte < 25 || dte > 50) continue;

        calls.sort((a, b) => a.strikePrice - b.strikePrice);
        puts.sort((a, b) => a.strikePrice - b.strikePrice);

        // Find put spread side (sell higher, buy lower)
        for (let pi = 0; pi < puts.length - 1; pi++) {
            const shortPut = puts[pi + 1];
            const longPut = puts[pi];

            if (Math.abs(shortPut.delta) < 0.10 || Math.abs(shortPut.delta) > 0.25) continue;
            if (shortPut.strikePrice >= underlyingPrice) continue;

            // Find call spread side (sell lower, buy higher)
            for (let ci = 0; ci < calls.length - 1; ci++) {
                const shortCall = calls[ci];
                const longCall = calls[ci + 1];

                if (Math.abs(shortCall.delta) < 0.10 || Math.abs(shortCall.delta) > 0.25) continue;
                if (shortCall.strikePrice <= underlyingPrice) continue;

                const putCredit = shortPut.midpoint - longPut.midpoint;
                const callCredit = shortCall.midpoint - longCall.midpoint;
                const totalCredit = putCredit + callCredit;

                const putWidth = shortPut.strikePrice - longPut.strikePrice;
                const callWidth = longCall.strikePrice - shortCall.strikePrice;
                const maxRisk = Math.max(putWidth, callWidth) - totalCredit;

                if (totalCredit <= 0 || maxRisk <= 0) continue;

                const breakEvenWidth = shortCall.strikePrice - shortPut.strikePrice;
                if (breakEvenWidth / underlyingPrice < 0.10) continue;

                const pop = Math.min(calcPOP(shortPut.delta, 'credit'), calcPOP(shortCall.delta, 'credit'));
                const rr = totalCredit / maxRisk;
                const totalTheta = Math.abs(shortPut.theta + shortCall.theta - longPut.theta - longCall.theta);
                const thetaPerRisk = totalTheta / maxRisk;
                const liquidity = (
                    calcLiquidityScore(shortPut.bid, shortPut.ask, shortPut.volume) +
                    calcLiquidityScore(longPut.bid, longPut.ask, longPut.volume) +
                    calcLiquidityScore(shortCall.bid, shortCall.ask, shortCall.volume) +
                    calcLiquidityScore(longCall.bid, longCall.ask, longCall.volume)
                ) / 4;
                const ivScore = calcIVScore((shortPut.impliedVolatility + shortCall.impliedVolatility) / 2, 'credit');

                const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'credit' });
                if (score < 55) continue;

                strategies.push({
                    strategy: 'Iron Condor',
                    type: 'Credit Neutral',
                    signal: 'SELL',
                    score,
                    pop: Math.round(pop),
                    symbol: shortPut.underlyingTicker,
                    underlying: underlyingPrice,
                    expiry,
                    dte,
                    edge: Math.round((calcLegEdge(shortPut, underlyingPrice, dte).edgeAmount - calcLegEdge(longPut, underlyingPrice, dte).edgeAmount + calcLegEdge(shortCall, underlyingPrice, dte).edgeAmount - calcLegEdge(longCall, underlyingPrice, dte).edgeAmount) * 100) / 100,
                    legs: [
                        { signal: 'SELL', type: 'P', strike: shortPut.strikePrice, expiry, bid: shortPut.bid, ask: shortPut.ask, delta: shortPut.delta },
                        { signal: 'BUY', type: 'P', strike: longPut.strikePrice, expiry, bid: longPut.bid, ask: longPut.ask, delta: longPut.delta },
                        { signal: 'SELL', type: 'C', strike: shortCall.strikePrice, expiry, bid: shortCall.bid, ask: shortCall.ask, delta: shortCall.delta },
                        { signal: 'BUY', type: 'C', strike: longCall.strikePrice, expiry, bid: longCall.bid, ask: longCall.ask, delta: longCall.delta },
                    ],
                    credit: totalCredit,
                    maxRisk,
                    maxProfit: totalCredit,
                    breakeven: `${(shortPut.strikePrice - totalCredit).toFixed(2)} / ${(shortCall.strikePrice + totalCredit).toFixed(2)}`,
                    bid: Math.round(((shortPut.bid - longPut.ask) + (shortCall.bid - longCall.ask)) * 100) / 100,
                    ask: Math.round(((shortPut.ask - longPut.bid) + (shortCall.ask - longCall.bid)) * 100) / 100,
                    delta: shortPut.delta + shortCall.delta - longPut.delta - longCall.delta,
                    theta: shortPut.theta + shortCall.theta - longPut.theta - longCall.theta,
                    iv: (shortPut.impliedVolatility + shortCall.impliedVolatility) / 2,
                    vol: `${(([shortPut, longPut, shortCall, longCall].reduce((s, c) => s + c.volume, 0)) / 1000).toFixed(1)}k`,
                    oi: `${(([shortPut, longPut, shortCall, longCall].reduce((s, c) => s + c.openInterest, 0)) / 1000).toFixed(1)}k`,
                });
            }
        }
    }

    return strategies;
}

/**
 * Find Straddles — buy ATM call + ATM put
 */
function findStraddles(contracts, underlyingPrice) {
    const strategies = [];

    const byExpiry = {};
    for (const c of contracts) {
        const key = c.expirationDate;
        if (!byExpiry[key]) byExpiry[key] = { calls: [], puts: [] };
        if (c.contractType === 'call') byExpiry[key].calls.push(c);
        else byExpiry[key].puts.push(c);
    }

    for (const [expiry, { calls, puts }] of Object.entries(byExpiry)) {
        const dte = calcDTE(expiry);
        if (dte < 25 || dte > 50) continue;

        // Find ATM strikes
        const atmCall = calls.reduce((best, c) =>
            Math.abs(c.strikePrice - underlyingPrice) < Math.abs(best.strikePrice - underlyingPrice) ? c : best
            , calls[0]);

        const atmPut = puts.find(p => p.strikePrice === atmCall?.strikePrice);
        if (!atmCall || !atmPut) continue;

        const debit = atmCall.midpoint + atmPut.midpoint;
        if (debit / underlyingPrice > 0.05) continue; // Premium must be ≤5% of underlying

        const ivAvg = (atmCall.impliedVolatility + atmPut.impliedVolatility) / 2;
        if (ivAvg > 0.40) continue; // IV rank below 40% for buying cheap vol

        const pop = 50; // Straddles are roughly 50/50
        const rr = underlyingPrice * 0.1 / debit; // Assume 10% move for reward calc
        const thetaPerRisk = Math.abs(atmCall.theta + atmPut.theta) / debit;
        const liquidity = (calcLiquidityScore(atmCall.bid, atmCall.ask, atmCall.volume) +
            calcLiquidityScore(atmPut.bid, atmPut.ask, atmPut.volume)) / 2;
        const ivScore = calcIVScore(ivAvg, 'debit');

        const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'debit' });
        if (score < 55) continue;

        strategies.push({
            strategy: 'Straddle',
            type: 'Debit Neutral',
            signal: 'BUY',
            score,
            pop: Math.round(pop),
            symbol: atmCall.underlyingTicker,
            underlying: underlyingPrice,
            expiry,
            dte,
            edge: Math.round((-calcLegEdge(atmCall, underlyingPrice, dte).edgeAmount - calcLegEdge(atmPut, underlyingPrice, dte).edgeAmount) * 100) / 100,
            legs: [
                { signal: 'BUY', type: 'C', strike: atmCall.strikePrice, expiry, bid: atmCall.bid, ask: atmCall.ask, delta: atmCall.delta },
                { signal: 'BUY', type: 'P', strike: atmPut.strikePrice, expiry, bid: atmPut.bid, ask: atmPut.ask, delta: atmPut.delta },
            ],
            debit,
            maxRisk: debit,
            maxProfit: Infinity,
            breakeven: `${(atmCall.strikePrice - debit).toFixed(2)} / ${(atmCall.strikePrice + debit).toFixed(2)}`,
            bid: Math.round((atmCall.bid + atmPut.bid) * 100) / 100,
            ask: Math.round((atmCall.ask + atmPut.ask) * 100) / 100,
            delta: atmCall.delta + atmPut.delta,
            theta: atmCall.theta + atmPut.theta,
            iv: ivAvg,
            vol: `${((atmCall.volume + atmPut.volume) / 1000).toFixed(1)}k`,
            oi: `${((atmCall.openInterest + atmPut.openInterest) / 1000).toFixed(1)}k`,
        });
    }

    return strategies;
}

/**
 * Find single options (Long Calls / Long Puts)
 */
function findSingleOptions(contracts, underlyingPrice) {
    const strategies = [];

    for (const c of contracts) {
        const dte = calcDTE(c.expirationDate);
        if (dte < 30 || dte > 90) continue;

        const absDelta = Math.abs(c.delta);
        const gammaTheta = c.theta !== 0 ? Math.abs(c.gamma / c.theta) : 0;

        // Deep ITM OR high gamma/theta ratio
        if (absDelta < 0.60 && gammaTheta <= 3) continue;
        if (c.volume < 10) continue;
        if ((c.ask - c.bid) > 5.00) continue;

        const isCall = c.contractType === 'call';
        const pop = calcPOP(c.delta, 'debit');
        const premium = c.midpoint;
        const rr = (underlyingPrice * 0.05) / premium; // Assume 5% move
        const thetaPerRisk = Math.abs(c.theta) / premium;
        const liquidity = calcLiquidityScore(c.bid, c.ask, c.volume);
        const ivScore = calcIVScore(c.impliedVolatility, 'debit');

        const score = scoreStrategy({ pop, riskRewardRatio: rr, thetaPerRisk, liquidityScore: liquidity, ivScore, strategyClass: 'debit' });
        if (score < 55) continue;

        strategies.push({
            strategy: 'Single Option',
            type: isCall ? 'Long Call' : 'Long Put',
            signal: 'BUY',
            score,
            pop: Math.round(pop),
            symbol: c.underlyingTicker,
            underlying: underlyingPrice,
            strike: c.strikePrice,
            expiry: c.expirationDate,
            dte,
            edge: Math.round(-calcLegEdge(c, underlyingPrice, dte).edgeAmount * 100) / 100,
            theoPrice: calcLegEdge(c, underlyingPrice, dte).theoPrice,
            legs: [
                { signal: 'BUY', type: isCall ? 'C' : 'P', strike: c.strikePrice, expiry: c.expirationDate, bid: c.bid, ask: c.ask, delta: c.delta },
            ],
            premium,
            maxRisk: premium,
            maxProfit: isCall ? Infinity : c.strikePrice - premium,
            breakeven: isCall ? c.strikePrice + premium : c.strikePrice - premium,
            bid: c.bid,
            ask: c.ask,
            delta: c.delta,
            gamma: c.gamma,
            theta: c.theta,
            vega: c.vega,
            iv: c.impliedVolatility,
            vol: `${(c.volume / 1000).toFixed(1)}k`,
            oi: `${(c.openInterest / 1000).toFixed(1)}k`,
            change: 0,
        });
    }

    return strategies;
}

/**
 * Generate rationale text for a strategy
 */
export function generateRationale(strategy) {
    const sigs = [];

    if (strategy.delta) {
        const absDelta = Math.abs(strategy.delta);
        sigs.push(
            absDelta > 0.6
                ? `Strong delta (${absDelta.toFixed(2)}) reflects high directional conviction`
                : `Delta of ${absDelta.toFixed(2)} offers balanced risk exposure`
        );
    }

    if (strategy.iv) {
        const ivPct = strategy.iv > 1 ? strategy.iv : strategy.iv * 100;
        sigs.push(
            ivPct > 40
                ? `Elevated IV (${ivPct.toFixed(1)}%) — market pricing in a sizeable move`
                : `Contained IV (${ivPct.toFixed(1)}%) keeps entry cost efficient`
        );
    }

    if (strategy.theta) {
        const absTheta = Math.abs(strategy.theta);
        sigs.push(
            strategy.signal === 'SELL'
                ? `Positive theta decay of $${absTheta.toFixed(2)}/day works in your favor`
                : `Daily theta cost of -$${absTheta.toFixed(2)} is manageable for the timeframe`
        );
    }

    if (strategy.oi) {
        sigs.push(`Open interest ${strategy.oi} confirms strong institutional activity`);
    }

    if (strategy.pop) {
        sigs.push(`Probability of profit at ${strategy.pop}% based on current delta positioning`);
    }

    if (strategy.edge !== undefined && strategy.edge !== 0) {
        const isFavorable = strategy.signal === 'BUY' ? strategy.edge > 0 : strategy.edge > 0;
        if (isFavorable && strategy.edge > 0.05) {
            sigs.push(`Strategy presents a mathematical pricing edge of $${Math.abs(strategy.edge).toFixed(2)} vs theoretical Black-Scholes`);
        } else if (!isFavorable && strategy.edge < -0.10) {
            sigs.push(`Note: Trading at a -$${Math.abs(strategy.edge).toFixed(2)} theoretical disadvantage to Black-Scholes modeling`);
        }
    }

    return sigs;
}

/**
 * Main entry point — analyze contracts and return scored strategies
 */
export function analyzeStrategies(contracts, underlyingPrice) {
    const strategies = [
        ...findVerticalSpreads(contracts, underlyingPrice),
        ...findIronCondors(contracts, underlyingPrice),
        ...findStraddles(contracts, underlyingPrice),
        ...findSingleOptions(contracts, underlyingPrice),
    ];

    // Sort by score descending
    strategies.sort((a, b) => b.score - a.score);

    // Add rationale to each
    for (const s of strategies) {
        s.rationale = generateRationale(s);
        // Ensure change field exists for UI
        if (s.change === undefined) s.change = 0;
    }

    return strategies;
}

export default {
    analyzeStrategies,
    generateRationale,
};
