const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {
  console.log("No .env file found");
}

// CORS settings for enterprise security
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000,https://kctmenswear.com,https://www.kctmenswear.com,https://cdn.kctmenswear.com";
const ADMIN_CORS = process.env.ADMIN_CORS || "http://localhost:3000,http://localhost:7001,https://admin.kctmenswear.com";

// Google Analytics Configuration
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || "G-LH26GTWFQS";

// Database configuration for enterprise scalability
const DATABASE_TYPE = process.env.DATABASE_TYPE || "postgres";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:password@localhost:5432/kct_commerce";

// Redis configuration for caching and event bus
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const plugins = [
  `medusa-fulfillment-manual`,
  {
    resolve: `medusa-payment-stripe`,
    options: {
      api_key: process.env.STRIPE_API_KEY || "sk_test_dummy_key_for_development",
      webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
    },
  },
  {
    resolve: `@medusajs/file-local`,
    options: {
      upload_dir: "uploads",
    },
  },
  {
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      serve: true,  // Enable admin panel
      path: "/admin",
      outDir: "build",
      autoRebuild: false,
    },
  },
];

// Note: Redis cache and event bus are configured in modules section below

const modules = {
  eventBus: {
    resolve: "@medusajs/event-bus-redis",
    options: {
      redisUrl: REDIS_URL
    }
  },
  cacheService: {
    resolve: "@medusajs/cache-redis",
    options: {
      redisUrl: REDIS_URL,
      ttl: 30,
    }
  }
};

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig: {
    // Parse PORT as integer for Medusa
    port: parseInt(process.env.PORT, 10) || 9000,
    host: "0.0.0.0",
    // Remove any conflicting server configs
    worker_mode: "shared",
    // Make sure no other port configs interfere
    // Enterprise JWT configuration
    jwt_secret: process.env.JWT_SECRET || "supersecret",
    cookie_secret: process.env.COOKIE_SECRET || "supersecret",
    // Enterprise admin configuration
    admin_cors: ADMIN_CORS,
    // Store CORS for security
    store_cors: STORE_CORS,
    // Database configuration
    database_type: DATABASE_TYPE,
    database_url: DATABASE_URL,
    database_logging: process.env.NODE_ENV !== "production",
    // Redis URL
    redis_url: REDIS_URL,
    // Enterprise worker mode for scalability
    worker_mode: process.env.WORKER_MODE || "shared",
    // Session configuration
    session_options: {
      secret: process.env.SESSION_SECRET || "supersecret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    },
    // Google Analytics GA4 Configuration
    analytics: {
      google: {
        enabled: process.env.NODE_ENV === "production",
        measurement_id: GA4_MEASUREMENT_ID,
        api_secret: process.env.GA4_API_SECRET,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        project_id: process.env.GOOGLE_PROJECT_ID,
      },
    },
  },
  plugins,
  modules,
};

// Export configuration for use by services
module.exports.GA4_CONFIG = {
  measurementId: GA4_MEASUREMENT_ID,
  enabled: process.env.NODE_ENV === "production" && !!GA4_MEASUREMENT_ID,
  projectId: process.env.GOOGLE_PROJECT_ID,
};