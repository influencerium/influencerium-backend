/**
 * Influencerium Backend Server
 * Main entry point for the API server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const database = require('./database');
const { errorHandler } = require('./middleware/error');
const routes = require('./routes');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowed_headers,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.window_ms || 900000,
  max: config.rateLimit.max_requests || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware (only in development)
if (config.development?.log_requests) {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.app.environment,
  });
});

// API routes
app.use('/api/v1', routes);

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation',
    version: config.documentation.version,
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      influencers: '/api/v1/influencers',
      campaigns: '/api/v1/campaigns',
      models: '/api/v1/models',
      analytics: '/api/v1/analytics',
      documentation: '/docs',
      postman: '/docs/postman-collection.json'
    }
  });
});

// Swagger UI
app.use('/docs', require('./docs/swagger'));

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

// Start server function
async function startServer() {
  try {
    // Check database connection
    const dbConnected = await database.checkConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize mock data for development
    if (config.app.environment === 'development') {
      await database.initMockData();
    }

    // Start listening
    const port = config.app.port || 3000;
    const host = config.app.host || '0.0.0.0';
    
    app.listen(port, host, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Influencerium Backend Server                          ║
║                                                            ║
║   Environment: ${config.app.environment || 'development'}                              ║
║   Port: ${port}                                           ║
║   Host: ${host}                                           ║
║   API Version: v1                                          ║
║                                                            ║
║   Health Check: http://${host}:${port}/health                   ║
║   API Docs: http://${host}:${port}/api-docs                   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await database.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await database.closePool();
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server if this is the main module
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, startServer };