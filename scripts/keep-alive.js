#!/usr/bin/env node

/**
 * Keep-alive script for Render.com
 * Pings the service periodically to prevent it from sleeping
 */

const https = require('https');
const http = require('http');

const SERVICE_URL = process.env.SERVICE_URL || 'https://your-app-name.onrender.com';
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL) || 25 * 60 * 1000; // 25 minutes
const HEALTH_ENDPOINT = '/alive';

console.log('🏓 Keep-alive service starting...');
console.log(`📡 Target URL: ${SERVICE_URL}${HEALTH_ENDPOINT}`);
console.log(`⏰ Ping interval: ${PING_INTERVAL / 1000 / 60} minutes`);

function pingService() {
  const url = `${SERVICE_URL}${HEALTH_ENDPOINT}`;
  const protocol = url.startsWith('https') ? https : http;
  
  const startTime = Date.now();
  
  protocol.get(url, (res) => {
    const duration = Date.now() - startTime;
    let body = '';
    
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      const timestamp = new Date().toISOString();
      
      if (res.statusCode === 200) {
        console.log(`✅ ${timestamp} - Ping successful (${res.statusCode}) - ${duration}ms`);
        
        try {
          const response = JSON.parse(body);
          if (response.uptime) {
            console.log(`   ⏱️ Service uptime: ${response.uptime}s`);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      } else {
        console.log(`⚠️ ${timestamp} - Ping returned ${res.statusCode} - ${duration}ms`);
      }
    });
  }).on('error', (error) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ ${timestamp} - Ping failed:`, error.message);
  });
}

// Initial ping
console.log('🚀 Sending initial ping...');
pingService();

// Schedule regular pings
setInterval(() => {
  console.log('📡 Sending keep-alive ping...');
  pingService();
}, PING_INTERVAL);

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('📨 Received SIGTERM, shutting down keep-alive service...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📨 Received SIGINT, shutting down keep-alive service...');
  process.exit(0);
});

console.log('🏓 Keep-alive service is running!');
console.log('   Press Ctrl+C to stop');
