// Alpha Vantage API Client — SECONDARY data source (enrichment + fallback)
// Key endpoints: OVERVIEW, GLOBAL_QUOTE, NEWS_SENTIMENT, TIME_SERIES_DAILY, EARNINGS

import fetch from 'node-fetch';

const BASE_URL = 'https://www.alphavantage.co/query';

// Simple in-memory cache to respect 25 req/day free tier limit
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes minimum

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

async function avFetch(params) {
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (!apiKey) throw new Error('ALPHAVANTAGE_API_KEY not set');

    const cacheKey = JSON.stringify(params);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const queryString = new URLSearchParams({ ...params, apikey: apiKey }).toString();
    const url = `${BASE_URL}?${queryString}`;

    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);

    const data = await res.json();

    // Check for rate limit response
    if (data['Note'] || data['Information']) {
        console.warn('[AlphaVantage] Rate limited:', data['Note'] || data['Information']);
        throw new Error('ALPHA_VANTAGE_RATE_LIMITED');
    }

    if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }

    setCache(cacheKey, data);
    return data;
}

/**
 * Company overview — fundamentals enrichment
 * P/E, PEG, EPS, dividend yield, market cap, analyst target, 52W range, beta, sector
 */
export async function getOverview(ticker) {
    try {
        const data = await avFetch({ function: 'OVERVIEW', symbol: ticker });
        return {
            symbol: data.Symbol,
            name: data.Name,
            description: data.Description,
            sector: data.Sector,
            industry: data.Industry,
            peRatio: parseFloat(data.PERatio) || null,
            pegRatio: parseFloat(data.PEGRatio) || null,
            eps: parseFloat(data.EPS) || null,
            dividendYield: parseFloat(data.DividendYield) || null,
            dividendPerShare: parseFloat(data.DividendPerShare) || null,
            marketCap: parseInt(data.MarketCapitalization) || null,
            analystTargetPrice: parseFloat(data.AnalystTargetPrice) || null,
            week52High: parseFloat(data['52WeekHigh']) || null,
            week52Low: parseFloat(data['52WeekLow']) || null,
            beta: parseFloat(data.Beta) || null,
            profitMargin: parseFloat(data.ProfitMargin) || null,
            revenuePerShare: parseFloat(data.RevenuePerShareTTM) || null,
            bookValue: parseFloat(data.BookValue) || null,
            forwardPE: parseFloat(data.ForwardPE) || null,
        };
    } catch (err) {
        if (err.message === 'ALPHA_VANTAGE_RATE_LIMITED') return null;
        throw err;
    }
}

/**
 * Global quote — fallback when Yahoo Finance is down
 */
export async function getGlobalQuote(ticker) {
    try {
        const data = await avFetch({ function: 'GLOBAL_QUOTE', symbol: ticker });
        const q = data['Global Quote'];
        if (!q) return null;
        return {
            symbol: q['01. symbol'],
            open: parseFloat(q['02. open']),
            high: parseFloat(q['03. high']),
            low: parseFloat(q['04. low']),
            price: parseFloat(q['05. price']),
            volume: parseInt(q['06. volume']),
            previousClose: parseFloat(q['08. previous close']),
            change: parseFloat(q['09. change']),
            changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
        };
    } catch (err) {
        if (err.message === 'ALPHA_VANTAGE_RATE_LIMITED') return null;
        throw err;
    }
}

/**
 * News with sentiment scores — enriches Yahoo Finance news
 */
export async function getNewsSentiment(ticker) {
    try {
        const data = await avFetch({ function: 'NEWS_SENTIMENT', tickers: ticker, limit: '10' });
        return (data?.feed || []).map(item => {
            const tickerSentiment = item.ticker_sentiment?.find(
                ts => ts.ticker === ticker
            );
            return {
                headline: item.title,
                source: item.source,
                url: item.url,
                time: formatTimeAgo(item.time_published),
                timestamp: item.time_published,
                summary: item.summary,
                overallSentiment: item.overall_sentiment_label,
                overallScore: parseFloat(item.overall_sentiment_score),
                tickerSentiment: tickerSentiment ? {
                    relevance: parseFloat(tickerSentiment.relevance_score),
                    sentiment: tickerSentiment.ticker_sentiment_label,
                    score: parseFloat(tickerSentiment.ticker_sentiment_score),
                } : null,
            };
        });
    } catch (err) {
        if (err.message === 'ALPHA_VANTAGE_RATE_LIMITED') return [];
        throw err;
    }
}

/**
 * Daily time series — fallback chart data + IV rank calculation
 */
export async function getDailyTimeSeries(ticker, outputSize = 'compact') {
    try {
        const data = await avFetch({
            function: 'TIME_SERIES_DAILY',
            symbol: ticker,
            outputsize: outputSize,
        });
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) return [];

        return Object.entries(timeSeries).map(([date, values]) => ({
            date,
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseInt(values['5. volume']),
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    } catch (err) {
        if (err.message === 'ALPHA_VANTAGE_RATE_LIMITED') return [];
        throw err;
    }
}

/**
 * Earnings data — calendar awareness for strategies
 */
export async function getEarnings(ticker) {
    try {
        const data = await avFetch({ function: 'EARNINGS', symbol: ticker });
        return {
            quarterly: (data?.quarterlyEarnings || []).slice(0, 4).map(e => ({
                date: e.fiscalDateEnding,
                reported: parseFloat(e.reportedEPS),
                estimated: parseFloat(e.estimatedEPS),
                surprise: parseFloat(e.surprise),
                surprisePercent: parseFloat(e.surprisePercentage),
            })),
            annual: (data?.annualEarnings || []).slice(0, 3).map(e => ({
                date: e.fiscalDateEnding,
                eps: parseFloat(e.reportedEPS),
            })),
        };
    } catch (err) {
        if (err.message === 'ALPHA_VANTAGE_RATE_LIMITED') return null;
        throw err;
    }
}

function formatTimeAgo(timeStr) {
    if (!timeStr) return '';
    // Alpha Vantage format: "20260305T143000"
    try {
        const year = timeStr.substring(0, 4);
        const month = timeStr.substring(4, 6);
        const day = timeStr.substring(6, 8);
        const hour = timeStr.substring(9, 11);
        const min = timeStr.substring(11, 13);
        const date = new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`);
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch {
        return '';
    }
}

export default {
    getOverview,
    getGlobalQuote,
    getNewsSentiment,
    getDailyTimeSeries,
    getEarnings,
};
