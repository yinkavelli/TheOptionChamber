// API client for frontend — all requests go through the Express proxy
const API_BASE = '/api';

async function apiFetch(path, options = {}, timeoutMs = 30000) {
    const url = `${API_BASE}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timer);
        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(body.error || `API error ${res.status}`);
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'API returned unsuccessful');
        return data.data;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error('Request timed out. The ticker may be invalid or the server is slow.');
        throw err;
    }
}

export const api = {
    // Market data
    getIndices: () => apiFetch('/market/indices'),
    search: (q) => apiFetch(`/market/search?q=${encodeURIComponent(q)}`),
    getQuote: (ticker) => apiFetch(`/market/quote/${encodeURIComponent(ticker)}`),
    getChart: (ticker, range = '1d') => apiFetch(`/market/chart/${encodeURIComponent(ticker)}?range=${range}`),
    getTrending: () => apiFetch('/market/trending'),
    getNews: (ticker) => apiFetch(`/market/news/${encodeURIComponent(ticker)}`),
    getFundamentals: (ticker) => apiFetch(`/market/fundamentals/${encodeURIComponent(ticker)}`),

    // Options data
    getChain: (ticker, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/options/chain/${encodeURIComponent(ticker)}${qs ? '?' + qs : ''}`);
    },
    getContracts: (ticker) => apiFetch(`/options/contracts/${encodeURIComponent(ticker)}`),

    // Screener
    scanSingle: (ticker, scenario = null) => apiFetch('/screener/scan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'single', ticker, ...(scenario ? { scenario } : {}) }),
    }),
    scanMarketWide: (params = {}, scenario = null) => apiFetch('/screener/scan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'market-wide', ...params, ...(scenario ? { scenario } : {}) }),
    }),

    // Health check
    health: () => apiFetch('/health'),
};

export default api;
