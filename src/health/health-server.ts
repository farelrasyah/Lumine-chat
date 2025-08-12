import * as express from 'express';
import { HealthCheckService } from './health-check.service';

/**
 * Standalone health check server for Render.com monitoring
 * This runs as a separate lightweight web service
 */
export async function startHealthServer() {
  const app = express();
  const port = process.env.HEALTH_CHECK_PORT || process.env.PORT || 10000;
  const healthService = new HealthCheckService();

  // Middleware
  app.use(express.json());
  
  // Add request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // Basic health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const health = await healthService.getDetailedHealth();
      const statusCode = health.overallHealth === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Simple alive check
  app.get('/alive', (req, res) => {
    const response = healthService.keepAlive();
    res.json(response);
  });

  // Status endpoint
  app.get('/status', (req, res) => {
    const status = healthService.getHealthStatus();
    res.json(status);
  });

  // Ready endpoint for Kubernetes-style checks
  app.get('/ready', async (req, res) => {
    try {
      const health = await healthService.getDetailedHealth();
      if (health.overallHealth === 'healthy') {
        res.json({ ready: true, timestamp: new Date().toISOString() });
      } else {
        res.status(503).json({ ready: false, reason: 'Services not ready', health });
      }
    } catch (error) {
      res.status(503).json({ 
        ready: false, 
        reason: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Lumine Chat Bot Health Monitor',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/health - Detailed health check',
        '/alive - Simple keep-alive',
        '/status - Basic status info',
        '/ready - Readiness probe'
      ]
    });
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    // Prepare for shutdown
    healthService.prepareShutdown();
    
    // Close server
    server.close(() => {
      console.log('Health check server closed.');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.log('Forcing exit...');
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Error handling
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error in health server:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  // Start server
  const server = app.listen(port, () => {
    console.log(`🏥 Health check server running on port ${port}`);
    console.log(`📊 Health endpoint: http://localhost:${port}/health`);
    console.log(`💓 Keep-alive endpoint: http://localhost:${port}/alive`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return server;
}

// Start server if this file is run directly
if (require.main === module) {
  startHealthServer().catch(console.error);
}
