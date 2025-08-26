const express = require('express');
const { createMedusaContainer } = require('@medusajs/medusa');
const { createServer } = require('http');

async function startServer() {
  try {
    console.log('Starting custom server...');
    console.log('PORT:', process.env.PORT);
    console.log('HOST:', process.env.HOST || '0.0.0.0');
    
    // Create a basic health check server first
    const app = express();
    const port = process.env.PORT || 9000;
    const host = process.env.HOST || '0.0.0.0';
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    app.get('/', (req, res) => {
      res.json({ message: 'Medusa server is running', timestamp: new Date().toISOString() });
    });
    
    const server = createServer(app);
    
    server.listen(port, host, () => {
      console.log(`✅ Server successfully bound to ${host}:${port}`);
    });
    
    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();