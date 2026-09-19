const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { FRONTEND_DIST, PORT } = require('./config');
const carsRouter = require('./routes/cars');
const garagesRouter = require('./routes/garages');
const aisensyRouter = require('./routes/aisensy');
const referralsRouter = require('./routes/referrals');
const connectDB = require('./db');
const vehicleStore = require('./services/vehicleStore');

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: '*/*' }));

/**
 * Connect to MongoDB and pre-load all vehicles into memory.
 * This runs ONCE at startup — all subsequent vehicle requests are served from memory.
 */
async function init() {
  await connectDB();
  await vehicleStore.load();
}

// Ensure DB + vehicle store are ready before serving requests
let initPromise = init().catch(err => {
  console.error('⚠️  Startup init error:', err.message);
  // Don't crash — server still starts; vehicle store will retry on first request
});

// Wait for init before handling any request
app.use(async (req, res, next) => {
  try {
    await initPromise;
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err.message);
    res.status(500).json({ detail: 'Database connection failure' });
  }
});

// ── Vehicle store refresh — must be registered BEFORE carsRouter to avoid interception ──
/**
 * Reload all vehicles from MongoDB into memory.
 * Use this after manually adding/editing vehicles in MongoDB Atlas.
 * Accessible via browser (GET) or programmatically (POST).
 *
 * GET  /api/cars/refresh
 * POST /api/cars/refresh
 */
async function handleRefresh(req, res) {
  try {
    await vehicleStore.load();
    res.json({
      success: true,
      message: `Vehicle store refreshed. ${vehicleStore.count} vehicles loaded into memory.`,
      count: vehicleStore.count,
    });
  } catch (err) {
    console.error('Vehicle store refresh failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
app.get('/api/cars/refresh', handleRefresh);
app.post('/api/cars/refresh', handleRefresh);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/cars', carsRouter);
app.use('/cars', carsRouter);
app.use('/api/garages', garagesRouter);
app.use('/garages', garagesRouter);
app.use('/api/aisensy', aisensyRouter);
app.use('/aisensy', aisensyRouter);
app.use('/api/referrals', referralsRouter);
app.use('/referrals', referralsRouter);



app.get('/api', (_req, res) => {
  res.json({
    status: 'online',
    message: 'MechHelp API Microservice is running',
    vehicles_in_memory: vehicleStore.count,
    endpoints: {
      cars: '/api/cars',
      cars_search: '/api/cars/search',
      cars_refresh: 'POST /api/cars/refresh',
      garages: '/api/garages',
      aisensy: '/api/aisensy/service-plans',
      referrals: '/api/referrals',
    },
  });
});

// Frontend serving removed - integrated into CRM
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`MechHelp API running at http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=...`);
      process.exit(1);
    }
    throw err;
  });
}

module.exports = app;
