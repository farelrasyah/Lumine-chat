import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private startTime = Date.now();
  private isHealthy = true;
  private lastHealthCheck = Date.now();

  constructor() {
    // Update health status periodically
    setInterval(() => {
      this.updateHealthStatus();
    }, 60000); // Check every minute
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus() {
    this.lastHealthCheck = Date.now();
    const uptime = Date.now() - this.startTime;
    
    return {
      status: this.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000), // seconds
      uptimeFormatted: this.formatUptime(uptime),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: this.getMemoryUsage(),
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString()
    };
  }

  /**
   * Detailed health check with dependencies
   */
  async getDetailedHealth() {
    const basicHealth = this.getHealthStatus();
    
    // Test critical services
    const services = await Promise.allSettled([
      this.checkSupabaseConnection(),
      this.checkWhatsAppStatus(),
      this.checkMemoryUsage()
    ]);

    const serviceStatus = {
      supabase: services[0].status === 'fulfilled' ? services[0].value : false,
      whatsapp: services[1].status === 'fulfilled' ? services[1].value : false,
      memory: services[2].status === 'fulfilled' ? services[2].value : false
    };

    const allServicesHealthy = Object.values(serviceStatus).every(status => status);
    this.isHealthy = allServicesHealthy;

    return {
      ...basicHealth,
      services: serviceStatus,
      overallHealth: allServicesHealthy ? 'healthy' : 'degraded'
    };
  }

  /**
   * Keep-alive endpoint for Render.com
   */
  keepAlive() {
    const response = {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    };
    
    this.logger.log('Keep-alive ping received');
    return response;
  }

  /**
   * Graceful shutdown signal
   */
  prepareShutdown() {
    this.isHealthy = false;
    this.logger.warn('Health check service preparing for shutdown');
    
    return {
      status: 'shutting_down',
      timestamp: new Date().toISOString(),
      message: 'Service is preparing for graceful shutdown'
    };
  }

  private updateHealthStatus() {
    // Basic health checks
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Consider unhealthy if memory usage is too high
    if (memoryUsagePercent > 90) {
      this.isHealthy = false;
      this.logger.warn(`High memory usage detected: ${memoryUsagePercent.toFixed(2)}%`);
    } else if (!this.isHealthy && memoryUsagePercent < 80) {
      this.isHealthy = true;
      this.logger.log('Health status recovered');
    }
  }

  private async checkSupabaseConnection(): Promise<boolean> {
    try {
      // Dynamic import to avoid circular dependencies
      const { SupabaseService } = await import('../supabase/supabase.service');
      await SupabaseService.testSupabaseConnection();
      return true;
    } catch (error) {
      this.logger.error('Supabase health check failed:', error.message);
      return false;
    }
  }

  private checkWhatsAppStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      // Basic check - if process is running, assume WhatsApp is potentially OK
      // In production, you might want to add more sophisticated checks
      const isProcessHealthy = process.uptime() > 30; // At least 30 seconds uptime
      resolve(isProcessHealthy);
    });
  }

  private checkMemoryUsage(): Promise<boolean> {
    return new Promise((resolve) => {
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      resolve(memoryUsagePercent < 85); // Consider healthy if under 85%
    });
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
