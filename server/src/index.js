require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');
const { closeAllClients } = require('./utils/eventHub');

const app = express();
const PORT = process.env.PORT || 5000;
const configuredOrigins = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set(configuredOrigins.split(',').map((origin) => origin.trim()).filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/api/v1/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, data: null, message: 'Server is running' });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ success: false, data: null, message: 'Service unavailable' });
  }
});

// API routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/materials', require('./routes/materials'));
app.use('/api/v1/customers', require('./routes/customers'));
app.use('/api/v1/admin/customers', require('./routes/adminCustomers'));
app.use('/api/v1/admin/suppliers', require('./routes/adminSuppliers'));
app.use('/api/v1/admin/employees', require('./routes/adminEmployees'));
app.use('/api/v1/cart', require('./routes/cart'));
app.use('/api/v1/orders', require('./routes/orders'));
app.use('/api/v1/admin/orders', require('./routes/adminOrders'));
app.use('/api/v1/admin/payments', require('./routes/payments'));
app.use('/api/v1/admin/stats', require('./routes/adminStats'));
app.use('/api/v1/reviews', require('./routes/reviews'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/v1/sync', require('./routes/sync'));
app.use('/api/v1/social', require('./routes/social'));
app.use('/api/v1/admin/social', require('./routes/social'));
app.use('/api/social-media', require('./routes/social'));
app.use('/api/v1/sales-report', require('./routes/salesReport'));
app.use('/api/v1/admin/sales-report', require('./routes/salesReport'));
app.use('/api/competitors', require('./routes/competitors'));
app.use('/api/v1/competitors', require('./routes/competitors'));

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status === 500) console.error('Server error:', err);
  res.status(status).json({ success: false, data: null, message: err.message || 'Internal server error' });
});

const { initSocialTable } = require('./db/initSocialTable');
const { initProductSchema } = require('./db/initProductSchema');
const { initCompetitorTables } = require('./db/initCompetitorTables');

async function startServer() {
  const requiredSettings = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD_HASH',
  ];
  const missingSettings = requiredSettings.filter((setting) => !process.env[setting]);
  if (missingSettings.length > 0) {
    throw new Error(`Missing required environment settings: ${missingSettings.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  const result = await pool.query('SELECT NOW() AS now');
  console.log(`PostgreSQL connected — DB time: ${result.rows[0].now}`);
  await initSocialTable();
  await initProductSchema();
  await initCompetitorTables();

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(PORT, '0.0.0.0', () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`Server running on port ${PORT}`);

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down.`);
    closeAllClients();
    server.close((err) => {
      if (err) {
        console.error('HTTP server shutdown failed:', err);
        process.exitCode = 1;
      }
      pool.end().catch((poolError) => {
        console.error('PostgreSQL pool shutdown failed:', poolError);
        process.exitCode = 1;
      });
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  startServer().catch(async (err) => {
    console.error('Server startup failed:', err);
    try {
      await pool.end();
    } catch (poolError) {
      console.error('PostgreSQL pool shutdown failed:', poolError);
    }
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.startServer = startServer;