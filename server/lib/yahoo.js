// Yahoo Finance API Client — PRIMARY data source
// Uses unofficial Yahoo Finance endpoints

import fetch from 'node-fetch';

const BASE_V8 = 'https://query1.finance.yahoo.com/v8/finance';
const BASE_V1 = 'https://query1.finance.yahoo.com/v1/finance';
const BASE_V6 = 'https://query2.finance.yahoo.com/v6/finance';
const BASE_V10 = 'https://query2.finance.yahoo.com/v10/finance';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function yahooFetch(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 10000 });
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`Yahoo Finance HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Get major market indices (S&P 500, NASDAQ, DOW, VIX)
 */
export async function getIndices() {
  const symbols = ['^GSPC', '^IXIC', '^DJI', '^VIX'];
  const url = `${BASE_V8}/chart/${symbols.join(',')}?range=1d&interval=5m`;

  // Fetch each individually since batch may not work
  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const data = await yahooFetch(`${BASE_V8}/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`);
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return {
        symbol: sym,
        name: sym === '^GSPC' ? 'S&P 500' : sym === '^IXIC' ? 'NASDAQ' : sym === '^DJI' ? 'DOW' : 'VIX',
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose || meta.chartPreviousClose,
        change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose),
        changePercent: ((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose)) * 100,
      };
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

/**
 * Search for symbols (autocomplete)
 */
export async function searchSymbols(query) {
  const url = `${BASE_V1}/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
  const data = await yahooFetch(url);
  return (data?.quotes || []).map(q => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    type: q.quoteType,
    exchange: q.exchDisp || q.exchange,
  }));
}

/**
 * Get a stock quote with key stats
 */
export async function getQuote(ticker) {
  const url = `${BASE_V8}/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m&includePrePost=true`;
  const data = await yahooFetch(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);

  const meta = result.meta;
  const prevClose = meta.previousClose || meta.chartPreviousClose;

  return {
    symbol: meta.symbol,
    price: meta.regularMarketPrice,
    previousClose: prevClose,
    change: meta.regularMarketPrice - prevClose,
    changePercent: ((meta.regularMarketPrice - prevClose) / prevClose) * 100,
    volume: meta.regularMarketVolume,
    marketCap: meta.marketCap || null,
    currency: meta.currency,
    exchangeName: meta.exchangeName,
    marketState: meta.marketState,
    // OHLC from today's data
    open: result.indicators?.quote?.[0]?.open?.[0] || null,
    high: result.indicators?.quote?.[0]?.high ? Math.max(...result.indicators.quote[0].high.filter(Boolean)) : null,
    low: result.indicators?.quote?.[0]?.low ? Math.min(...result.indicators.quote[0].low.filter(Boolean)) : null,
  };
}

/**
 * Get chart data for a ticker
 */
export async function getChart(ticker, range = '1d') {
  const intervalMap = {
    '1d': '5m', '5d': '15m', '1mo': '1d', '3mo': '1d',
    '6mo': '1d', '1y': '1wk', '5y': '1mo', 'max': '1mo',
  };
  const interval = intervalMap[range] || '1d';
  const url = `${BASE_V8}/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const data = await yahooFetch(url);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${ticker}`);

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  return {
    symbol: result.meta.symbol,
    currency: result.meta.currency,
    range,
    interval,
    data: timestamps.map((t, i) => ({
      timestamp: t,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i],
    })).filter(d => d.close != null),
  };
}

/**
 * Get trending/most active stocks
 */
export async function getTrending() {
  try {
    const url = `${BASE_V1}/trending/US?count=20`;
    const data = await yahooFetch(url);
    const symbols = (data?.finance?.result?.[0]?.quotes || []).map(q => q.symbol);
    
    if (symbols.length === 0) {
      return getFallbackTrending();
    }

    // Fetch quotes for trending symbols
    const quotes = await Promise.allSettled(
      symbols.slice(0, 20).map(sym => getQuote(sym))
    );

    return quotes
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  } catch {
    return getFallbackTrending();
  }
}

async function getFallbackTrending() {
  // High-volume options stocks as fallback
  const fallbackSymbols = ['AAPL', 'TSLA', 'NVDA', 'META', 'AMZN', 'MSFT', 'SPY', 'QQQ', 'AMD', 'GOOGL',
    'NFLX', 'COIN', 'PLTR', 'SOFI', 'BAC', 'F', 'NIO', 'INTC', 'UBER', 'DIS'];
  const quotes = await Promise.allSettled(
    fallbackSymbols.map(sym => getQuote(sym))
  );
  return quotes
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Get news for a symbol
 */
export async function getNews(ticker) {
  try {
    const url = `${BASE_V1}/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=10&enableFuzzyQuery=false`;
    const data = await yahooFetch(url);
    return (data?.news || []).map(n => ({
      headline: n.title,
      source: n.publisher,
      url: n.link,
      timestamp: n.providerPublishTime,
      time: formatTimeAgo(n.providerPublishTime),
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
    }));
  } catch {
    return [];
  }
}

function formatTimeAgo(unixTimestamp) {
  if (!unixTimestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Screen stocks by criteria using Yahoo Finance screener
 */
export async function screenStocks({ minVolume = 1000000, minMarketCap = 10000000000 }) {
  try {
    // Use Yahoo's screener API
    const url = `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=50`;
    const data = await yahooFetch(url);
    const results = data?.finance?.result?.[0]?.quotes || [];

    return results
      .filter(q => {
        const vol = q.regularMarketVolume || 0;
        const cap = q.marketCap || 0;
        return vol >= minVolume && cap >= minMarketCap;
      })
      .map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        marketCap: q.marketCap,
      }));
  } catch {
    // Fallback: use trending as screen results
    return getTrending();
  }
}

export default {
  getIndices,
  searchSymbols,
  getQuote,
  getChart,
  getTrending,
  getNews,
  screenStocks,
};
