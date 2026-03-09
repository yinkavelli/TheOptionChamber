// API client for frontend — all requests go through the Express proxy
const API_BASE = '/api';

async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `API error ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API returned unsuccessful');
    return data.data;
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
    scanSingle: (ticker) => apiFetch('/screener/scan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'single', ticker }),
    }),
    scanMarketWide: (params = {}) => apiFetch('/screener/scan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'market-wide', ...params }),
    }),

    // Health check
    health: () => apiFetch('/health'),
};

export default api;
