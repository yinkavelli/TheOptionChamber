// Express Server — API proxy for The Option Chamber
// All API keys are server-side only, never exposed to client

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import marketRoutes from './routes/market.js';
import optionsRoutes from './routes/options.js';
import screenerRoutes from './routes/screener.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.log(`[SLOW] ${req.method} ${req.url} - ${duration}ms`);
        }
    });
    next();
});

// API Routes
app.use('/api/market', marketRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/screener', screenerRoutes);

// Fundamentals route (mounted under market for cleanliness)
import('./routes/market.js').then(m => {
    // Already mounted above, /api/market/fundamentals/:ticker is handled there
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        apis: {
            yahoo: 'configured',
            marketdata: process.env.MARKETDATA_API_KEY ? 'configured' : 'missing',
            alphavantage: process.env.ALPHAVANTAGE_API_KEY ? 'configured' : 'missing',
            massive: process.env.MASSIVE_API_KEY ? 'configured' : 'missing',
        },
    });
});

// Serve static files in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(join(distPath, 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n🏛️  The Option Chamber API Server`);
        console.log(`   Running on http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/api/health\n`);
        console.log(`   APIs configured:`);
        console.log(`   ├─ 🥇 Yahoo Finance (quotes, primary)`);
        console.log(`   ├─ 🥈 MarketData.app (${process.env.MARKETDATA_API_KEY ? '✅' : '❌'}) — options chains, primary`);
        console.log(`   ├─ 🥉 Alpha Vantage  (${process.env.ALPHAVANTAGE_API_KEY ? '✅' : '❌'}) — fundamentals, news`);
        console.log(`   └─  4  Massive.com    (${process.env.MASSIVE_API_KEY ? '✅' : '❌'}) — options fallback\n`);
    });
}

export default app;
