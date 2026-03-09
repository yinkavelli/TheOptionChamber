// Market Routes — handles all market data endpoints
// Primary: Yahoo Finance | Fallback: Alpha Vantage

import { Router } from 'express';
import yahoo from '../lib/yahoo.js';
import alphavantage from '../lib/alphavantage.js';

const router = Router();

/**
 * GET /api/market/indices
 * Major indices: S&P 500, NASDAQ, DOW, VIX
 */
router.get('/indices', async (req, res) => {
    try {
        const indices = await yahoo.getIndices();
        res.json({ success: true, data: indices });
    } catch (err) {
        console.error('[Market] Indices error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch indices' });
    }
});

/**
 * GET /api/market/search?q=AAPL
 * Symbol search autocomplete
 */
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 1) {
        return res.json({ success: true, data: [] });
    }
    try {
        const results = await yahoo.searchSymbols(q);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('[Market] Search error:', err.message);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

/**
 * GET /api/market/quote/:ticker
 * Stock quote — Primary: Yahoo Finance → Fallback: Alpha Vantage GLOBAL_QUOTE
 */
router.get('/quote/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
        // PRIMARY: Yahoo Finance
        const quote = await yahoo.getQuote(ticker);
        res.json({ success: true, data: quote, source: 'yahoo' });
    } catch (yahooErr) {
        console.warn(`[Market] Yahoo quote failed for ${ticker}:`, yahooErr.message);
        try {
            // FALLBACK: Alpha Vantage
            const avQuote = await alphavantage.getGlobalQuote(ticker);
            if (avQuote) {
                res.json({ success: true, data: avQuote, source: 'alphavantage' });
            } else {
                throw new Error('Alpha Vantage returned no data');
            }
        } catch (avErr) {
            console.error(`[Market] Both Yahoo and AV failed for ${ticker}:`, avErr.message);
            res.status(500).json({ success: false, error: `Failed to fetch quote for ${ticker}` });
        }
    }
});

/**
 * GET /api/market/chart/:ticker?range=1d
 * Chart data — Primary: Yahoo Finance → Fallback: Alpha Vantage TIME_SERIES_DAILY
 */
router.get('/chart/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const { range = '1d' } = req.query;
    try {
        const chart = await yahoo.getChart(ticker, range);
        res.json({ success: true, data: chart, source: 'yahoo' });
    } catch (yahooErr) {
        console.warn(`[Market] Yahoo chart failed for ${ticker}:`, yahooErr.message);
        try {
            const avData = await alphavantage.getDailyTimeSeries(ticker);
            if (avData.length > 0) {
                res.json({
                    success: true,
                    data: { symbol: ticker, range, interval: '1d', data: avData },
                    source: 'alphavantage',
                });
            } else {
                throw new Error('No chart data');
            }
        } catch (avErr) {
            res.status(500).json({ success: false, error: `Failed to fetch chart for ${ticker}` });
        }
    }
});

/**
 * GET /api/market/trending
 * Most active/trending stocks
 */
router.get('/trending', async (req, res) => {
    try {
        const trending = await yahoo.getTrending();
        res.json({ success: true, data: trending });
    } catch (err) {
        console.error('[Market] Trending error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch trending stocks' });
    }
});

/**
 * GET /api/market/news/:ticker
 * News — Primary: Yahoo Finance → Enrichment: Alpha Vantage NEWS_SENTIMENT
 */
router.get('/news/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
        // PRIMARY: Yahoo Finance news
        let news = await yahoo.getNews(ticker);

        // ENRICHMENT: Try Alpha Vantage sentiment (non-blocking)
        try {
            const avNews = await alphavantage.getNewsSentiment(ticker);
            if (avNews && avNews.length > 0) {
                // Merge sentiment data or add AV-unique articles
                const yahooHeadlines = new Set(news.map(n => n.headline?.toLowerCase()));
                const uniqueAvNews = avNews.filter(an =>
                    !yahooHeadlines.has(an.headline?.toLowerCase())
                ).map(an => ({
                    ...an,
                    sentiment: an.overallSentiment || 'neutral',
                }));

                // Add sentiment to Yahoo articles
                news = news.map(n => ({
                    ...n,
                    sentiment: mapSentiment(n),
                }));

                // Append unique AV articles
                news = [...news, ...uniqueAvNews.slice(0, 3)];
            }
        } catch (avErr) {
            // Non-blocking: just serve Yahoo news without sentiment
            console.warn(`[Market] AV sentiment enrichment failed for ${ticker}:`, avErr.message);
        }

        // Ensure all articles have a sentiment field
        news = news.map(n => ({
            ...n,
            sentiment: n.sentiment || 'neutral',
        }));

        res.json({ success: true, data: news });
    } catch (err) {
        console.error(`[Market] News error for ${ticker}:`, err.message);
        // Last resort: try Alpha Vantage alone
        try {
            const avNews = await alphavantage.getNewsSentiment(ticker);
            res.json({ success: true, data: avNews || [], source: 'alphavantage' });
        } catch {
            res.json({ success: true, data: [] });
        }
    }
});

/**
 * GET /api/fundamentals/:ticker
 * Fundamental data — Primary: Alpha Vantage OVERVIEW | Fallback: Yahoo Finance
 */
router.get('/fundamentals/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
        const overview = await alphavantage.getOverview(ticker);
        if (overview) {
            res.json({ success: true, data: overview, source: 'alphavantage' });
        } else {
            // Alpha Vantage rate limited, try Yahoo
            const quote = await yahoo.getQuote(ticker);
            res.json({
                success: true,
                data: {
                    symbol: ticker,
                    marketCap: quote.marketCap,
                    // Yahoo doesn't provide PE, dividend etc on chart endpoint
                    // Return what we can
                },
                source: 'yahoo',
                partial: true,
            });
        }
    } catch (err) {
        console.error(`[Market] Fundamentals error for ${ticker}:`, err.message);
        res.status(500).json({ success: false, error: `Failed to fetch fundamentals for ${ticker}` });
    }
});

function mapSentiment(article) {
    const text = (article.headline || '').toLowerCase();
    if (text.match(/surge|jump|rally|beat|record|soar|upgrade|bullish|growth|strong/)) return 'positive';
    if (text.match(/drop|fall|cut|miss|warn|downgrade|bearish|decline|weak/)) return 'negative';
    return 'neutral';
}

export default router;
