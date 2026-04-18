import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app.js';

// Export Express app as the Vercel serverless handler.
// pg Pool is lazy — it connects on first query, so no explicit connectDB() needed.
export default app;
