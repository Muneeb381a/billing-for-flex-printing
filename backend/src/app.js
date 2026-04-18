import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import customerRoutes   from './routes/customers.js';
import categoryRoutes   from './routes/categories.js';
import productRoutes    from './routes/products.js';
import billRoutes       from './routes/bills.js';
import paymentRoutes    from './routes/payments.js';
import dashboardRoutes  from './routes/dashboard.js';
import ledgerRoutes     from './routes/ledger.js';
import pricingRoutes    from './routes/pricing.js';
import reportRoutes     from './routes/reports.js';
import settingsRoutes   from './routes/settings.js';
import inventoryRoutes  from './routes/inventory.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security & Parsing ────────────────────────────────────────
app.use(helmet());

// CORS_ORIGIN supports a comma-separated list for multiple origins.
// e.g. "https://my-app.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/customers',  customerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/bills',      billRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/ledger',     ledgerRoutes);
app.use('/api/pricing',    pricingRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/settings',   settingsRoutes);
app.use('/api/inventory',  inventoryRoutes);

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

export default app;
