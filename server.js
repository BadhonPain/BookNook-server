
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const {
  connectToDatabase,
  ensureIndexes,
  getDb
} = require('./lib/db');

const booksRouter = require('./routes/books');
const borrowsRouter = require('./routes/borrows');
const recommendationsRouter = require('./routes/recommendations');

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Origin is not allowed by the BookNook API.')
      );
    },
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));

// Initialize MongoDB before handling API requests.
// Connection and index creation are cached per instance.
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    await ensureIndexes();
    next();
  } catch (error) {
    next(error);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();

    return res.json({
      status: 'ok',
      database: db ? 'connected' : 'disconnected'
    });
  } catch {
    return res.status(503).json({
      status: 'unavailable',
      database: 'disconnected'
    });
  }
});

// API routes
app.use('/books', booksRouter);
app.use('/borrows', borrowsRouter);
app.use('/recommendations', recommendationsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found.'
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    'body' in error
  ) {
    return res.status(400).json({
      message: 'Request body must contain valid JSON.'
    });
  }

  if (error.message === 'Origin is not allowed by the BookNook API.') {
    return res.status(403).json({
      message: error.message
    });
  }

  const status = error.status === 503 ? 503 : 500;

  return res.status(status).json({
    message: status === 503
      ? error.message
      : 'Internal server error.'
  });
});

// Local development only
async function startServer() {
  try {
    await connectToDatabase();
    await ensureIndexes();

    console.log('Connected to MongoDB');

    return app.listen(PORT, () => {
      console.log(`BookNook server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  startServer().catch(() => {
    process.exitCode = 1;
  });
}

// Export Express app for Vercel
module.exports = app;
