const express = require("express");
const session = require("express-session");
const { GracefulShutdownServer } = require("medusa-core-utils");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const cors = require("cors");

const loaders = require("@medusajs/medusa/dist/loaders").default;

(async () => {
  async function start() {
    const app = express();
    const directory = process.cwd();

    // Add JSON parsing middleware
    app.use(express.json());
    
    // Add CORS for admin
    app.use(cors({
      origin: true,
      credentials: true
    }));

    // Add session management
    app.use(session({
      secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'supersecret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      }
    }));

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
        max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
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

      // CUSTOM AUTH HANDLER - Bypass Medusa auth
      app.post('/admin/auth', async (req, res) => {
        console.log('Custom auth handler triggered');
        const { email, password } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }

        const client = new Client({
          connectionString: process.env.DATABASE_URL
        });

        try {
          await client.connect();
          
          // Get user from database with full details
          const result = await client.query(
            'SELECT id, email, first_name, last_name, password_hash, role, api_token, created_at, updated_at FROM "user" WHERE email = $1',
            [email]
          );

          if (result.rows.length === 0) {
            console.log('User not found:', email);
            return res.status(401).json({ 
              type: "unauthorized",
              message: "These credentials do not match our records." 
            });
          }

          const user = result.rows[0];
          
          // Verify password
          const isValid = await bcrypt.compare(password, user.password_hash);
          
          if (!isValid) {
            console.log('Invalid password for:', email);
            return res.status(401).json({ 
              type: "unauthorized",
              message: "These credentials do not match our records." 
            });
          }

          // Create session - Medusa expects specific session structure
          req.session = req.session || {};
          req.session.user_id = user.id;
          req.session.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            api_token: user.api_token,
            created_at: user.created_at,
            updated_at: user.updated_at
          };
          
          // Save session
          if (req.session.save) {
            req.session.save();
          }
          
          console.log('Auth successful for:', email);
          
          // Return the exact format Medusa admin expects
          res.status(200).json({
            user: {
              id: user.id,
              email: user.email,
              first_name: user.first_name || "",
              last_name: user.last_name || "",
              role: user.role || "admin",
              api_token: user.api_token || null,
              created_at: user.created_at,
              updated_at: user.updated_at,
              metadata: {}
            }
          });

        } catch (error) {
          console.error('Auth error:', error);
          res.status(500).json({ 
            type: "server_error",
            message: "An error occurred while processing your request" 
          });
        } finally {
          await client.end();
        }
      });

      // Also handle /admin/login
      app.post('/admin/login', async (req, res) => {
        console.log('Login endpoint hit, redirecting to auth');
        return app._router.handle(Object.assign(req, { url: '/admin/auth', path: '/admin/auth' }), res);
      });

      // Handle /admin/users/me endpoint for session verification
      app.get('/admin/users/me', async (req, res) => {
        console.log('Users/me endpoint called');
        
        // Check if user is in session
        if (!req.session || !req.session.user_id) {
          return res.status(401).json({ 
            type: "unauthorized",
            message: "Not authenticated" 
          });
        }

        const client = new Client({
          connectionString: process.env.DATABASE_URL
        });

        try {
          await client.connect();
          
          // Get user from database
          const result = await client.query(
            'SELECT id, email, first_name, last_name, role, api_token, created_at, updated_at FROM "user" WHERE id = $1',
            [req.session.user_id]
          );

          if (result.rows.length === 0) {
            return res.status(401).json({ 
              type: "unauthorized",
              message: "User not found" 
            });
          }

          const user = result.rows[0];
          
          // Return user data
          res.status(200).json({
            user: {
              id: user.id,
              email: user.email,
              first_name: user.first_name || "",
              last_name: user.last_name || "",
              role: user.role || "admin",
              api_token: user.api_token || null,
              created_at: user.created_at,
              updated_at: user.updated_at,
              metadata: {}
            }
          });

        } catch (error) {
          console.error('Users/me error:', error);
          res.status(500).json({ 
            type: "server_error",
            message: "An error occurred while fetching user data" 
          });
        } finally {
          await client.end();
        }
      });

      // Load Medusa with error handling
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
          console.log("💡 Payment provider initialization failed - using custom auth");
        } else {
          console.error("Critical error:", loadError);
        }
      }

      const port = parseInt(process.env.PORT || "9000");
      const host = process.env.HOST || "0.0.0.0";

      // Add health endpoint
      app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() });
      });

      const server = GracefulShutdownServer.create(
        app.listen(port, host, (err) => {
          if (err) {
            return;
          }
          console.log(`\n🚀 KCT Menswear Server (with auth fix) is ready on ${host}:${port}`);
          console.log(`📊 Admin Dashboard: http://localhost:${port}/admin`);
          console.log(`🛍️  Store API: http://localhost:${port}/store`);
          console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
          console.log(`🔐 Custom auth handler: ENABLED`);
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