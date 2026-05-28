import http from 'http';
import { logger } from './logger.js';

const PORT = process.env.HEALTH_PORT || 3001;

export function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'zield-keeper',
        version: process.env.npm_package_version || '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }));
    } else if (req.url === '/metrics') {
      // Basic metrics endpoint (expand later with real counters)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime_seconds: process.uptime(),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    logger.info(`Health check server listening on port ${PORT}`);
  });

  return server;
}
