import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

dotenv.config();

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mount MechHelp microservice under /mechhelp prefix
// e.g. /mechhelp/api/aisensy/service-plans, /mechhelp/api/cars, etc.
const mechHelpApp = require('./MechHelp/backend/src/index.js');
app.use('/mechhelp', mechHelpApp);


// Helper to wrap Vercel-style handler for Express
const wrapHandler = (handlerModule) => async (req, res) => {
  try {
    if (req.params) {
      Object.assign(req.query, req.params);
    }
    const handler = handlerModule.default || handlerModule;
    await handler(req, res);
  } catch (err) {
    console.error('API Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
};

// Import API handlers
const finalizeHandler = await import('./api/billing/finalize.js');
const dailyQuicksHandler = await import('./api/cron/daily-quicks.js');
const garagesIndexHandler = await import('./api/garages/index.js');
const garageSettleHandler = await import('./api/garages/[id]/settle.js');
const garageSettlementsHandler = await import('./api/garages/[id]/settlements.js');

// API Index route listing available endpoints
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    status: 'online',
    message: 'MechHelp CRM Node.js Backend API',
    endpoints: [
      { method: 'GET', path: '/api/garages', description: 'List all garages and running balances' },
      { method: 'POST', path: '/api/billing/finalize', description: 'Finalize booking billing' },
      { method: 'GET', path: '/api/garages/:id/settlements', description: 'Fetch garage settlements' },
      { method: 'POST', path: '/api/garages/:id/settle', description: 'Settle garage entries' },
      { method: 'GET/POST', path: '/api/cron/daily-quicks', description: 'Trigger Daily Quicks summary email' },
      { method: 'GET', path: '/api/health', description: 'API Health Check' },
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register API routes
app.all('/api/billing/finalize', wrapHandler(finalizeHandler));
app.all('/api/cron/daily-quicks', wrapHandler(dailyQuicksHandler));
app.all('/api/garages', wrapHandler(garagesIndexHandler));
app.all('/api/garages/:id/settle', wrapHandler(garageSettleHandler));
app.all('/api/garages/:id/settlements', wrapHandler(garageSettlementsHandler));

// Unknown API route handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API endpoint '/api${req.path}' not found. Visit /api to see available endpoints.` });
});

// Serve static frontend files built in dist/ (excluding index.html to inject runtime env)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, { index: false }));

// SPA Fallback for client-side routing with dynamic runtime environment injection
// SPA fallback — serve CRM dashboard for all routes except /api/* and /mechhelp/*
app.get(/^(?!\/(api|mechhelp\/api)\/).*/, (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading index.html');
    }
    const envScript = `<script>window.__ENV={VITE_SUPABASE_URL:${JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)},VITE_SUPABASE_ANON_KEY:${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY)}};</script>`;
    const injectedHtml = html.replace('</head>', `${envScript}</head>`);
    res.send(injectedHtml);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Node.js CRM Server running at http://localhost:${PORT}`);
});
