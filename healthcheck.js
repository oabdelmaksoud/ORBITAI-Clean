#!/usr/bin/env node

/**
 * Health check script for Docker containers
 * Checks if the application is healthy and ready to receive traffic
 */

const http = require('http');
const https = require('https');

const HEALTH_CHECK_PORT = process.env.HEALTH_CHECK_PORT || 3001;
const HEALTH_CHECK_PATH = process.env.HEALTH_CHECK_PATH || '/health';
const TIMEOUT = 5000; // 5 seconds

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const timer = setTimeout(() => {
      reject(new Error('Health check timeout'));
    }, TIMEOUT);

    client.get(url, (res) => {
      clearTimeout(timer);
      
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            resolve(health);
          } catch (err) {
            reject(new Error('Invalid health check response'));
          }
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function checkHealth() {
  try {
    const url = `http://localhost:${HEALTH_CHECK_PORT}${HEALTH_CHECK_PATH}`;
    const health = await makeRequest(url);
    
    // Check if all services are healthy
    if (health.status === 'ok' || health.healthy === true) {
      console.log('✅ Health check passed');
      process.exit(0);
    } else {
      console.error('❌ Health check failed: Unhealthy status');
      console.error(JSON.stringify(health, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
    process.exit(1);
  }
}

// Run health check
checkHealth();
