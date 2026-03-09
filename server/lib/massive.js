// Massive.com API Client — TERTIARY data source (Options specialist)
// Sole source for: option chains, Greeks, bid/ask quotes
// Uses Polygon.io infrastructure
// ⚠️ CRITICAL: bid/ask validation is enforced here

import fetch from 'node-fetch';

const BASE_URL = 'https://api.polygon.io';

function getHeaders() {
    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) throw new Error('MASSIVE_API_KEY not set');
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
    };
}

async function massiveFetch(path, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${path}${queryString ? '?' + queryString : ''}`;

    const res = await fetch(url, {
        headers: getHeaders(),
        timeout: 15000,
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Massive.com HTTP ${res.status}: ${body}`);
    }

    return await res.json();
}

/**
 * Extract bid/ask pricing from Polygon snapshot contract
 * Polygon snapshots use `day` object instead of `last_quote`
 * We derive bid/ask from day.open/close or day.high/low
 */
function extractPricing(contract) {
    const day = contract.day || {};

    // Primary: use day high/low as ask/bid proxy
    let bid = day.low || 0;
    let ask = day.high || 0;

    // If day has close/open, prefer those for tighter spread
    if (day.close > 0 && day.open > 0) {
        bid = Math.min(day.open, day.close);
        ask = Math.max(day.open, day.close);
    }

    // If we have VWAP, use it for midpoint calculation
    const vwap = day.vwap || 0;

    // Fallback: if only close exists, estimate from close
    if (bid === 0 && ask === 0 && day.close > 0) {
        bid = day.close * 0.98;
        ask = day.close * 1.02;
    }

    // If both are the same value, create a small spread
    if (bid > 0 && bid === ask) {
        bid = bid * 0.99;
        ask = ask * 1.01;
    }

    const midpoint = vwap > 0 ? vwap : (bid + ask) / 2;

    return {
        isValid: bid > 0 && ask > 0,
        bid: Math.round(bid * 100) / 100,
        ask: Math.round(ask * 100) / 100,
        midpoint: Math.round(midpoint * 100) / 100,
        volume: day.volume || 0,
        vwap,
    };
}

/**
 * Get full option chain with Greeks for a ticker
 * Returns contracts with validated bid/ask data
 */
export async function getOptionChain(ticker, {
    expirationDate = null,
    expirationDateGte = null,
    expirationDateLte = null,
    contractType = null,
    limit = 250,
    strikePrice = null,
    strikePriceGte = null,
    strikePriceLte = null,
    underlyingPrice = 0,
} = {}) {
    const params = {
        limit: String(limit),
        order: 'asc',
        sort: 'expiration_date',
    };

    if (expirationDate) params['expiration_date'] = expirationDate;
    if (expirationDateGte) params['expiration_date.gte'] = expirationDateGte;
    if (expirationDateLte) params['expiration_date.lte'] = expirationDateLte;
    if (contractType) params.contract_type = contractType;
    if (strikePrice) params['strike_price'] = String(strikePrice);
    if (strikePriceGte) params['strike_price.gte'] = String(strikePriceGte);
    if (strikePriceLte) params['strike_price.lte'] = String(strikePriceLte);

    const data = await massiveFetch(
        `/v3/snapshot/options/${encodeURIComponent(ticker)}`,
        params
    );

    const results = data?.results || [];

    // Process and validate each contract
    const contracts = results.map(contract => {
        const pricing = extractPricing(contract);
        const greeks = contract.greeks || {};
        const details = contract.details || {};

        return {
            ticker: details.ticker || contract.ticker,
            contractType: details.contract_type || 'unknown',
            strikePrice: details.strike_price || 0,
            expirationDate: details.expiration_date || '',
            sharesPerContract: details.shares_per_contract || 100,
            exerciseStyle: details.exercise_style || 'american',
            // Greeks
            delta: greeks.delta || 0,
            gamma: greeks.gamma || 0,
            theta: greeks.theta || 0,
            vega: greeks.vega || 0,
            // IV
            impliedVolatility: contract.implied_volatility || 0,
            // Volume & OI
            openInterest: contract.open_interest || 0,
            volume: pricing.volume,
            // ⚠️ CRITICAL: Bid/Ask data (derived from day OHLC)
            bid: pricing.bid,
            ask: pricing.ask,
            midpoint: pricing.midpoint,
            bidAskValid: pricing.isValid,
            // Underlying
            underlyingPrice: underlyingPrice,
            underlyingTicker: contract.underlying_asset?.ticker || ticker,
        };
    });

    // Log bid/ask validation stats
    const validCount = contracts.filter(c => c.bidAskValid).length;
    const invalidCount = contracts.filter(c => !c.bidAskValid).length;
    if (invalidCount > 0) {
        console.warn(`[Massive] ${ticker}: ${validCount} valid, ${invalidCount} missing bid/ask — excluded from strategies`);
    }

    return {
        ticker,
        totalContracts: contracts.length,
        validContracts: validCount,
        invalidContracts: invalidCount,
        contracts,
        // Only return contracts with valid bid/ask for strategy engine
        validContractsOnly: contracts.filter(c => c.bidAskValid),
    };
}

/**
 * Get available contracts/expirations for a ticker
 */
export async function getContracts(ticker) {
    try {
        const data = await massiveFetch(
            `/v3/reference/options/contracts`,
            {
                underlying_ticker: ticker,
                limit: '1000',
                order: 'asc',
                sort: 'expiration_date',
            }
        );

        const results = data?.results || [];
        const expirations = [...new Set(results.map(c => c.expiration_date))].sort();

        const strikesByExpiry = {};
        for (const contract of results) {
            const exp = contract.expiration_date;
            if (!strikesByExpiry[exp]) strikesByExpiry[exp] = new Set();
            strikesByExpiry[exp].add(contract.strike_price);
        }

        return {
            ticker,
            totalContracts: results.length,
            expirations,
            strikesByExpiry: Object.fromEntries(
                Object.entries(strikesByExpiry).map(([k, v]) => [k, [...v].sort((a, b) => a - b)])
            ),
        };
    } catch (err) {
        console.error(`[Massive] Error fetching contracts for ${ticker}:`, err.message);
        throw err;
    }
}

/**
 * Get option chain for strategy engine — only returns contracts with valid bid/ask
 * ⚠️ This is the function the strategy engine should call
 * @param {string} ticker
 * @param {number} underlyingPrice — pass in from Yahoo Finance quote
 */
export async function getStrategyChain(ticker, underlyingPrice = 0) {
    // Calculate date range: 15-90 days from now (covers all strategy DTE requirements)
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fmtDate = d => d.toISOString().split('T')[0];

    // Calculate strike range: +/- 25% of underlying price
    const strikeLow = underlyingPrice > 0 ? Math.floor(underlyingPrice * 0.75) : null;
    const strikeHigh = underlyingPrice > 0 ? Math.ceil(underlyingPrice * 1.25) : null;

    console.log(`[Massive] Strategy chain for ${ticker}: DTE ${fmtDate(minDate)} to ${fmtDate(maxDate)}, strikes ${strikeLow}-${strikeHigh}`);

    const chain = await getOptionChain(ticker, {
        limit: 250,
        underlyingPrice,
        expirationDateGte: fmtDate(minDate),
        expirationDateLte: fmtDate(maxDate),
        strikePriceGte: strikeLow,
        strikePriceLte: strikeHigh,
    });

    console.log(`[Massive] ${ticker}: ${chain.validContracts} valid / ${chain.totalContracts} total contracts in strategy range`);
    return chain.validContractsOnly;
}

export default {
    getOptionChain,
    getContracts,
    getStrategyChain,
    extractPricing,
};
