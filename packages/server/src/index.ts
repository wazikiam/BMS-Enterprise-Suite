import express from 'express';
import cors from 'cors';

import reportingRouter from './routes/reporting';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/**
 * Root welcome page
 */
app.get('/', (req, res) => {
  res.json({
    message: 'BMS Enterprise Suite API',
    version: '1.0.0',
    service: 'Business Management System',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      apiInfo: 'GET /api',
      frontend: 'http://localhost:5173'
    },
    documentation: 'API documentation available at /api'
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BMS Enterprise Suite',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API root info
 */
app.get('/api', (req, res) => {
  res.json({
    name: 'BMS Enterprise Suite API',
    version: '1.0.0',
    description: 'Business Management System REST API',
    documentation: 'Available at /api endpoint',
    modules: {
      reports: '/api/reports/*'
    },
    status: 'operational'
  });
});

/**
 * Reporting / Snapshots API (Week 11+)
 */
app.use('/api/reports', reportingRouter);

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: ['/', '/health', '/api'],
    suggestion: 'Check /api for available endpoints'
  });
});

/**
 * Global error handler
 */
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Something went wrong'
    });
  }
);

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BMS Enterprise Suite Server Started                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server:   http://localhost:${PORT}                               ║
║  Health:   http://localhost:${PORT}/health                       ║
║  API Docs: http://localhost:${PORT}/api                         ║
║                                                              ║
║  Environment: development                                    ║
║  Version:    1.0.0                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

export { app };
