// Options Routes — handles option chain endpoints
// Source: Massive.com (sole provider) with bid/ask validation

import { Router } from 'express';
import massive from '../lib/massive.js';

const router = Router();

/**
 * GET /api/options/chain/:ticker
 * Full option chain with Greeks — ⚠️ validates bid/ask
 */
router.get('/chain/:ticker', async (req, res) => {
    const { ticker } = req.params;
    const { expiration, type, limit = '250' } = req.query;

    try {
        const chain = await massive.getOptionChain(ticker, {
            expirationDate: expiration || null,
            contractType: type || null,
            limit: parseInt(limit),
        });

        res.json({
            success: true,
            data: {
                ticker: chain.ticker,
                totalContracts: chain.totalContracts,
                validContracts: chain.validContracts,
                invalidContracts: chain.invalidContracts,
                contracts: chain.contracts,
            },
        });
    } catch (err) {
        console.error(`[Options] Chain error for ${ticker}:`, err.message);
        res.status(500).json({ success: false, error: `Failed to fetch options chain for ${ticker}` });
    }
});

/**
 * GET /api/options/contracts/:ticker
 * Available expirations and strikes for a ticker
 */
router.get('/contracts/:ticker', async (req, res) => {
    const { ticker } = req.params;

    try {
        const contracts = await massive.getContracts(ticker);
        res.json({ success: true, data: contracts });
    } catch (err) {
        console.error(`[Options] Contracts error for ${ticker}:`, err.message);
        res.status(500).json({ success: false, error: `Failed to fetch contracts for ${ticker}` });
    }
});

export default router;
