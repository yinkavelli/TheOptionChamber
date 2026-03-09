// Screener Routes — stock screening + strategy generation
// Combines: Yahoo Finance (universe) + MarketData.app (chains, primary) + Massive.com (chains, fallback) + Alpha Vantage (enrichment)

import { Router } from 'express';
import yahoo from '../lib/yahoo.js';
import marketdata from '../lib/marketdata.js';
import massive from '../lib/massive.js';
import alphavantage from '../lib/alphavantage.js';
import { analyzeStrategies, generateRationale } from '../lib/strategy-engine.js';

const router = Router();

/**
 * POST /api/screener/scan
 * Run stock screen + fetch option chains + generate strategy recommendations
 *
 * Body: {
 *   mode: "single" | "market-wide",
 *   ticker: "AAPL" (for single mode),
 *   minVolume: 1000000,
 *   minMarketCap: 10000000000,
 *   ivRankMin: 10,
 *   ivRankMax: 70,
 * }
 */
router.post('/scan', async (req, res) => {
    const {
        mode = 'single',
        ticker = null,
        minVolume = 1000000,
        minMarketCap = 10000000000,
    } = req.body;

    try {
        if (mode === 'single' && ticker) {
            // Single stock scan
            const result = await scanSingleStock(ticker);
            return res.json({ success: true, data: result });
        }

        if (mode === 'market-wide') {
            // Market-wide scan — top 20 most active stocks
            const result = await scanMarketWide(minVolume, minMarketCap);
            return res.json({ success: true, data: result });
        }

        return res.status(400).json({ success: false, error: 'Invalid scan mode. Use "single" or "market-wide".' });
    } catch (err) {
        console.error('[Screener] Scan error:', err.message);
        res.status(500).json({ success: false, error: 'Scan failed: ' + err.message });
    }
});

async function scanSingleStock(ticker) {
    // Step 1: Get underlying price first (Yahoo primary, AV fallback)
    let quote;
    try {
        quote = await yahoo.getQuote(ticker);
    } catch {
        try {
            quote = await alphavantage.getGlobalQuote(ticker);
        } catch {
            throw new Error(`Could not fetch quote for ${ticker}`);
        }
    }

    if (!quote) throw new Error(`Could not fetch quote for ${ticker}`);

    const underlyingPrice = quote.price || quote.regularMarketPrice || 0;
    console.log(`[Screener] ${ticker} price: $${underlyingPrice}`);

    // Step 2: Fetch option chain — MarketData.app primary, Massive.com fallback
    let contracts = [];
    try {
        contracts = await marketdata.getStrategyChain(ticker, underlyingPrice);
    } catch (err) {
        console.warn(`[Screener] MarketData.app failed for ${ticker}: ${err.message}. Falling back to Massive.com...`);
        try {
            contracts = await massive.getStrategyChain(ticker, underlyingPrice);
        } catch (err2) {
            console.warn(`[Screener] Massive.com fallback also failed for ${ticker}:`, err2.message);
        }
    }

    console.log(`[Screener] ${ticker}: ${contracts.length} valid contracts`);

    if (contracts.length === 0) {
        return {
            ticker,
            quote,
            strategies: [],
            message: 'No option contracts with valid bid/ask data found',
        };
    }

    // Step 3: Run strategy engine
    const strategies = analyzeStrategies(contracts, underlyingPrice);
    console.log(`[Screener] ${ticker}: ${strategies.length} strategies found (score >= 65)`);

    // Step 4: Try to enrich with fundamentals (non-blocking)
    let fundamentals = null;
    try {
        fundamentals = await alphavantage.getOverview(ticker);
    } catch {
        // Non-blocking enrichment
    }

    return {
        ticker,
        quote,
        fundamentals,
        contractsAnalyzed: contracts.length,
        strategies,
    };
}

/**
 * Scan market-wide — top 20 most active stocks
 */
async function scanMarketWide(minVolume, minMarketCap) {
    // Step 1: Get most active stocks from Yahoo Finance
    let stocks;
    try {
        stocks = await yahoo.screenStocks({ minVolume, minMarketCap });
    } catch {
        stocks = await yahoo.getTrending();
    }

    const tickers = stocks.slice(0, 20).map(s => s.symbol);

    if (tickers.length === 0) {
        throw new Error('No stocks found matching criteria');
    }

    // Step 2: Scan each ticker (batched in groups of 5)
    const allStrategies = [];
    const batchSize = 5;

    for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(t => scanSingleStock(t))
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value?.strategies) {
                allStrategies.push(...result.value.strategies);
            }
        }
    }

    // Sort all strategies by score descending
    allStrategies.sort((a, b) => b.score - a.score);

    return {
        mode: 'market-wide',
        tickersScanned: tickers.length,
        totalStrategies: allStrategies.length,
        strategies: allStrategies.slice(0, 50), // Top 50 across all stocks
    };
}

export default router;
