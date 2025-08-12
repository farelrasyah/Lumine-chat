import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SupabaseService } from './supabase/supabase.service';
import { HealthCheckService } from './health/health-check.service';

async function bootstrap() {
  console.log('🚀 Starting Lumine Chat Bot...');
  console.log('📋 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌍 Timezone:', process.env.TZ || 'system default');
  
  const app = await NestFactory.create(AppModule);
  
  // Initialize health check service
  const healthService = new HealthCheckService();
  
  // Test critical services on startup
  console.log('🔍 Testing critical services...');
  
  try {
    console.log('📊 Testing Supabase connection...');
    await SupabaseService.testSupabaseConnection();
    console.log('✅ Supabase connection: OK');
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    console.log('⚠️ Bot will continue but database features may not work');
  }

  // Add basic health endpoint to the main app
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', async (req: any, res: any) => {
    try {
      const health = await healthService.getDetailedHealth();
      const statusCode = health.overallHealth === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  expressApp.get('/alive', (req: any, res: any) => {
    res.json(healthService.keepAlive());
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n📨 Received ${signal}. Starting graceful shutdown...`);
    
    // Prepare health service for shutdown
    healthService.prepareShutdown();
    
    try {
      console.log('🔄 Closing NestJS application...');
      await app.close();
      console.log('✅ Application closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    healthService.prepareShutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    healthService.prepareShutdown();
    process.exit(1);
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log('🎉 Lumine Chat Bot is running!');
  console.log(`📡 Server listening on: http://0.0.0.0:${port}`);
  console.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
  console.log(`💓 Keep-alive: http://0.0.0.0:${port}/alive`);
  console.log('🤖 WhatsApp bot is ready to receive messages...');
  
  // Log memory usage periodically in production
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const usage = process.memoryUsage();
      console.log(`💾 Memory Usage - RSS: ${Math.round(usage.rss / 1024 / 1024)}MB, Heap: ${Math.round(usage.heapUsed / 1024 / 1024)}MB/${Math.round(usage.heapTotal / 1024 / 1024)}MB`);
    }, 300000); // Every 5 minutes
  }
}

bootstrap().catch((error) => {
  console.error('💥 Failed to start application:', error);
  process.exit(1);
});
