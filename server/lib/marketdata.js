// MarketData.app API Client — PRIMARY options data source
// Provides: real bid/ask quotes, greeks, IV, volume, OI
// Replaces Polygon/Massive.com for options chain data
// Starter plan: 10,000 daily credits, 15-min delayed options
// Docs: https://www.marketdata.app/docs/api/options/chain

import fetch from 'node-fetch';
import https from 'https';

const BASE_URL = 'https://api.marketdata.app/v1';

// Custom HTTPS agent to handle Windows SSL cert trust issues
const agent = new https.Agent({ rejectUnauthorized: false });

function getHeaders() {
    const apiKey = process.env.MARKETDATA_API_KEY;
    if (!apiKey) throw new Error('MARKETDATA_API_KEY not set');
    return {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
    };
}

async function mdFetch(path, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${path}${queryString ? '?' + queryString : ''}`;

    const res = await fetch(url, {
        headers: getHeaders(),
        agent,
        timeout: 20000,
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`MarketData.app HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();

    if (data.s !== 'ok') {
        throw new Error(`MarketData.app error: ${data.s || 'unknown'} — ${JSON.stringify(data)}`);
    }

    return data;
}

/**
 * Get available expiration dates for a ticker
 */
export async function getExpirations(ticker) {
    const data = await mdFetch(`/options/expirations/${encodeURIComponent(ticker)}/`);
    return data.expirations || [];
}

/**
 * Get option chain with full data (bid/ask, greeks, IV, volume, OI)
 * MarketData.app returns parallel arrays — we transform them into contract objects
 *
 * @param {string} ticker
 * @param {Object} options
 * @param {string} [options.from] - Min expiration date (ISO 8601)
 * @param {string} [options.to] - Max expiration date (ISO 8601)
 * @param {string} [options.expiration] - Specific expiration or 'all'
 * @param {string} [options.side] - 'call', 'put', or omit for both
 * @param {string} [options.strike] - Strike filter (e.g. '200-300')
 * @param {number} [options.strikeLimit] - Max strikes per expiry
 * @param {number} [options.minOpenInterest] - Min OI filter
 * @param {number} [options.minVolume] - Min volume filter
 * @param {number} [options.underlyingPrice] - For reference/enrichment
 */
export async function getOptionChain(ticker, {
    from = null,
    to = null,
    expiration = null,
    side = null,
    strike = null,
    strikeLimit = null,
    minOpenInterest = null,
    minVolume = null,
    underlyingPrice = 0,
} = {}) {
    const params = {};

    if (from) params.from = from;
    if (to) params.to = to;
    if (expiration) params.expiration = expiration;
    if (side) params.side = side;
    if (strike) params.strike = strike;
    if (strikeLimit) params.strikeLimit = String(strikeLimit);
    if (minOpenInterest) params.minOpenInterest = String(minOpenInterest);
    if (minVolume) params.minVolume = String(minVolume);

    const data = await mdFetch(`/options/chain/${encodeURIComponent(ticker)}/`, params);

    // Transform parallel arrays into contract objects
    const count = data.optionSymbol?.length || 0;
    const contracts = [];

    for (let i = 0; i < count; i++) {
        const bid = data.bid?.[i] || 0;
        const ask = data.ask?.[i] || 0;
        const mid = data.mid?.[i] || (bid + ask) / 2;
        const sideVal = data.side?.[i] || '';

        // Determine contract type from side field
        const contractType = sideVal === 'call' ? 'call' : 'put';

        // Convert Unix timestamp expiration to ISO date string
        const expUnix = data.expiration?.[i] || 0;
        const expirationDate = expUnix > 0
            ? new Date(expUnix * 1000).toISOString().split('T')[0]
            : '';

        const isValid = bid > 0 && ask > 0;

        contracts.push({
            // Identity
            ticker: data.optionSymbol?.[i] || '',
            underlyingTicker: data.underlying?.[i] || ticker,
            contractType,
            strikePrice: data.strike?.[i] || 0,
            expirationDate,
            dte: data.dte?.[i] || 0,

            // Pricing — REAL bid/ask from MarketData.app ✅
            bid: Math.round(bid * 100) / 100,
            ask: Math.round(ask * 100) / 100,
            midpoint: Math.round(mid * 100) / 100,
            last: data.last?.[i] || 0,
            bidSize: data.bidSize?.[i] || 0,
            askSize: data.askSize?.[i] || 0,
            bidAskValid: isValid,

            // Greeks
            delta: data.delta?.[i] || 0,
            gamma: data.gamma?.[i] || 0,
            theta: data.theta?.[i] || 0,
            vega: data.vega?.[i] || 0,

            // Volatility & Volume
            impliedVolatility: data.iv?.[i] || 0,
            openInterest: data.openInterest?.[i] || 0,
            volume: data.volume?.[i] || 0,

            // Moneyness
            inTheMoney: data.inTheMoney?.[i] || false,
            intrinsicValue: data.intrinsicValue?.[i] || 0,
            extrinsicValue: data.extrinsicValue?.[i] || 0,

            // Underlying
            underlyingPrice: data.underlyingPrice?.[i] || underlyingPrice,
        });
    }

    // Log stats
    const validCount = contracts.filter(c => c.bidAskValid).length;
    const invalidCount = contracts.filter(c => !c.bidAskValid).length;
    if (invalidCount > 0) {
        console.warn(`[MarketData] ${ticker}: ${validCount} valid, ${invalidCount} missing bid/ask`);
    }

    return {
        ticker,
        totalContracts: contracts.length,
        validContracts: validCount,
        invalidContracts: invalidCount,
        contracts,
        validContractsOnly: contracts.filter(c => c.bidAskValid),
    };
}

/**
 * Get option chain for strategy engine — only returns contracts with valid bid/ask
 * Drop-in replacement for massive.getStrategyChain()
 *
 * @param {string} ticker
 * @param {number} underlyingPrice — pass in from Yahoo Finance quote
 */
export async function getStrategyChain(ticker, underlyingPrice = 0) {
    // Calculate date range: 15-90 days from now
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fmtDate = d => d.toISOString().split('T')[0];

    // Calculate strike range: +/- 25% of underlying price
    const strikeLow = underlyingPrice > 0 ? Math.floor(underlyingPrice * 0.75) : null;
    const strikeHigh = underlyingPrice > 0 ? Math.ceil(underlyingPrice * 1.25) : null;
    const strikeFilter = strikeLow && strikeHigh ? `${strikeLow}-${strikeHigh}` : null;

    console.log(`[MarketData] Strategy chain for ${ticker}: DTE ${fmtDate(minDate)} to ${fmtDate(maxDate)}, strikes ${strikeLow}-${strikeHigh}`);

    const chain = await getOptionChain(ticker, {
        from: fmtDate(minDate),
        to: fmtDate(maxDate),
        strike: strikeFilter,
        minOpenInterest: 10,
        underlyingPrice,
    });

    console.log(`[MarketData] ${ticker}: ${chain.validContracts} valid / ${chain.totalContracts} total contracts`);
    return chain.validContractsOnly;
}

export default {
    getExpirations,
    getOptionChain,
    getStrategyChain,
};
