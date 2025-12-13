import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';

// Load environment variables
config();

// Import internal modules
import { AuthService, SessionService } from '@bms/core';
import { AuthMiddleware } from './api/auth/auth.middleware';
import { createAuthRoutes } from './api/auth/auth.routes';

class BMSServer {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // Compression
    this.app.use(compression());

    // Logging
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Request ID (for tracing)
    this.app.use((req, res, next) => {
      req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'bms-server',
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API documentation
    this.app.get('/api', (req, res) => {
      res.status(200).json({
        name: 'BMS Enterprise Suite API',
        version: '1.0.0',
        description: 'Business Management System REST API',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          products: '/api/products',
          sales: '/api/sales',
          customers: '/api/customers',
          inventory: '/api/inventory',
          purchases: '/api/purchases',
          hr: '/api/hr',
          reports: '/api/reports',
          settings: '/api/settings'
        },
        documentation: '/api/docs'
      });
    });

    // Initialize services (in production, these would come from dependency injection)
    const authService = this.initializeServices();
    const authMiddleware = new AuthMiddleware(authService);

    // API routes
    this.app.use('/api/auth', createAuthRoutes(authService, authMiddleware));

    // Other API routes will be added here as we build them
    this.app.use('/api/users', (req, res) => {
      res.status(200).json({ message: 'Users endpoint - Coming soon' });
    });

    this.app.use('/api/products', (req, res) => {
      res.status(200).json({ message: 'Products endpoint - Coming soon' });
    });

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('public'));
      
      // Serve React app for all other routes
      this.app.get('*', (req, res) => {
        res.sendFile('public/index.html', { root: '.' });
      });
    }
  }

  private initializeServices(): AuthService {
    // In a real application, you would use dependency injection
    // For now, we'll create mock repositories
    
    const mockUserRepository = {
      findByEmail: async (email: string) => null,
      create: async (userData: any) => ({ ...userData, id: 'user_' + Date.now() }),
      update: async (id: string, updates: any) => ({ ...updates, id }),
      findById: async (id: string) => null
    };

    const mockSessionRepository = {
      create: async (sessionData: any) => ({ ...sessionData, id: 'sess_' + Date.now() }),
      findByToken: async (token: string) => null,
      findByRefreshToken: async (refreshToken: string) => null,
      revoke: async (id: string, reason: string) => {},
      update: async (id: string, updates: any) => ({ ...updates, id })
    };

    return new AuthService(mockUserRepository, mockSessionRepository);
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Global error handler:', error);

      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal Server Error';
      
      res.status(statusCode).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BMS Enterprise Suite Server Started                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server:   http://localhost:${this.port}                               ║
║  Health:   http://localhost:${this.port}/health                       ║
║  API Docs: http://localhost:${this.port}/api                         ║
║                                                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                   ║
║  Version:    1.0.0                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      this.shutdown();
    });
  }

  private shutdown(): void {
    console.log('Server is shutting down...');
    // Add cleanup logic here
    process.exit(0);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new BMSServer();
  server.start();
}

// Export for testing
export { BMSServer };

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}