const express = require("express");
const { GracefulShutdownServer } = require("medusa-core-utils");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const loaders = require("@medusajs/medusa/dist/loaders").default;

(async () => {
  async function start() {
    const app = express();
    const directory = process.cwd();

    try {
      // Security middleware
      app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://imagedelivery.net", "https://cdn.kctmenswear.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            connectSrc: ["'self'", "https://api.cloudflare.com", "https://graph.facebook.com", "https://www.google-analytics.com"],
          },
        },
        crossOriginEmbedderPolicy: false,
      }));

      // Compression
      app.use(compression());

      // Rate limiting for enterprise security
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      });
      app.use('/admin', limiter);

      // API rate limiting
      const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 2000 : 20000,
        message: 'API rate limit exceeded',
      });
      app.use('/store', apiLimiter);

      // Logging
      if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('combined'));
      }

      // Load Medusa with error handling for payment provider issue
      let container;
      let configModule;
      
      try {
        const result = await loaders({
          directory,
          expressApp: app,
        });
        container = result.container;
        configModule = container.resolve("configModule");
      } catch (loadError) {
        console.warn("⚠️ Medusa initialization issue:", loadError.message);
        if (loadError.message.includes("Empty criteria") || loadError.message.includes("payment")) {
          console.log("💡 Payment provider initialization failed - starting server anyway");
          // Continue with basic server
        } else {
          throw loadError;
        }
      }

      const port = parseInt(process.env.PORT || "9000");
      const host = process.env.HOST || "0.0.0.0";

      // Add health endpoint for Railway
      app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() });
      });

      const server = GracefulShutdownServer.create(
        app.listen(port, host, (err) => {
          if (err) {
            return;
          }
          console.log(`\n🚀 KCT Menswear Server is ready on ${host}:${port}`);
          console.log(`📊 Admin Dashboard: http://localhost:${port}/admin`);
          console.log(`🛍️  Store API: http://localhost:${port}/store`);
          console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`\n📝 Available endpoints:`);
            console.log(`   - Analytics: http://localhost:${port}/admin/analytics/*`);
            console.log(`   - Cloudflare: http://localhost:${port}/admin/cloudflare/*`);
            console.log(`   - Health Check: http://localhost:${port}/admin/system/health`);
          }
        })
      );

      // Graceful shutdown
      const gracefulShutDown = () => {
        server
          .shutdown()
          .then(() => {
            console.log("\n👋 Gracefully closed out remaining connections");
            process.exit(0);
          })
          .catch((err) => {
            console.log("❌ Error during graceful shutdown", err);
            process.exit(1);
          });
      };

      process.on("SIGTERM", gracefulShutDown);
      process.on("SIGINT", gracefulShutDown);
    } catch (err) {
      console.error("❌ Error starting server", err);
      process.exit(1);
    }
  }

  await start();
})();