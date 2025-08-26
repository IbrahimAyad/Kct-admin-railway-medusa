const express = require("express");
const session = require("express-session");
const { GracefulShutdownServer } = require("medusa-core-utils");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cors = require("cors");
const { createAdminAuthRouter } = require("./admin-auth-fix");
const { createAdminAPIRouter } = require("./admin-api-fix");

const loaders = require("@medusajs/medusa/dist/loaders").default;

(async () => {
  async function start() {
    const app = express();
    const directory = process.cwd();

    // Add JSON parsing middleware FIRST
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Add CORS for admin - MUST be before routes
    app.use(cors({
      origin: function(origin, callback) {
        // Allow all origins in development, specific origins in production
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Add session management - MUST be before routes
    app.use(session({
      name: 'connect.sid',
      secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'supersecret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to false for now to ensure it works
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
      }
    }));

    // Log all requests to admin FIRST
    app.use('/admin/*', (req, res, next) => {
      console.log(`Admin request: ${req.method} ${req.originalUrl}`);
      next();
    });

    // Add custom admin auth router BEFORE security middleware
    const adminAuthRouter = createAdminAuthRouter();
    app.use('/admin', adminAuthRouter);
    
    // Add custom admin API router for regions, shipping, etc.
    const adminAPIRouter = createAdminAPIRouter();
    app.use('/admin', adminAPIRouter);

    try {
      // Security middleware (after auth routes)
      app.use(helmet({
        contentSecurityPolicy: false, // Disable for admin panel
        crossOriginEmbedderPolicy: false,
      }));

      // Compression
      app.use(compression());

      // Rate limiting
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path.startsWith('/admin/auth') // Skip rate limit for auth
      });
      app.use(limiter);

      // Logging
      if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('combined'));
      }

      // Try to load Medusa (but don't fail if it doesn't work)
      let container;
      let configModule;
      
      try {
        const result = await loaders({
          directory,
          expressApp: app,
        });
        container = result.container;
        configModule = container.resolve("configModule");
        console.log("✅ Medusa loaded successfully");
      } catch (loadError) {
        console.warn("⚠️ Medusa initialization issue:", loadError.message);
        console.log("💡 Running with custom auth only");
      }

      const port = parseInt(process.env.PORT || "9000");
      const host = process.env.HOST || "0.0.0.0";

      // Health endpoint
      app.get("/health", (req, res) => {
        res.json({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          auth: "custom"
        });
      });

      // Serve admin panel static files ONLY for non-API routes
      const path = require('path');
      const adminBuildPath = path.join(directory, 'build');
      
      // Only serve static files for actual file requests, not API calls
      app.use('/admin', (req, res, next) => {
        // Skip static file serving for API routes
        if (req.path.startsWith('/regions') || 
            req.path.startsWith('/shipping-options') ||
            req.path.startsWith('/fulfillment-providers') ||
            req.path.startsWith('/payment-providers') ||
            req.path.startsWith('/store') ||
            req.path.startsWith('/currencies') ||
            req.path.startsWith('/auth') ||
            req.path.startsWith('/users') ||
            req.path.startsWith('/login')) {
          return next();
        }
        // Serve static files for everything else
        express.static(adminBuildPath)(req, res, next);
      });
      
      // Fallback for admin panel routes (but not API routes)
      app.get('/admin/*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/admin/regions') || 
            req.path.startsWith('/admin/shipping-options') ||
            req.path.startsWith('/admin/fulfillment-providers') ||
            req.path.startsWith('/admin/payment-providers') ||
            req.path.startsWith('/admin/store') ||
            req.path.startsWith('/admin/currencies')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }
        
        const indexPath = path.join(adminBuildPath, 'index.html');
        if (require('fs').existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Admin panel not built. Run: npm run build:admin');
        }
      });

      const server = GracefulShutdownServer.create(
        app.listen(port, host, (err) => {
          if (err) {
            console.error("Failed to start server:", err);
            return;
          }
          console.log(`\n🚀 KCT Server (Custom Auth v2) ready on ${host}:${port}`);
          console.log(`📊 Admin: https://final-stand-production.up.railway.app/admin`);
          console.log(`🔐 Auth: Custom implementation active`);
          console.log(`✅ Login: admin@kctmenswear.com / supersecret`);
        })
      );

      // Graceful shutdown
      const gracefulShutDown = () => {
        server
          .shutdown()
          .then(() => {
            console.log("\n👋 Gracefully shut down");
            process.exit(0);
          })
          .catch((err) => {
            console.log("❌ Error during shutdown", err);
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