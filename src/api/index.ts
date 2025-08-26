import { Router } from "express";
import { getConfigFile } from "medusa-core-utils";
import { ConfigModule } from "@medusajs/medusa";

export default (rootDirectory: string): Router[] => {
  const router = Router();
  const { configModule } = getConfigFile<ConfigModule>(rootDirectory, "medusa-config");

  // Analytics endpoints
  router.get("/admin/analytics/sales", async (req, res) => {
    try {
      const analyticsService = req.scope.resolve("analyticsService");
      const period = req.query.period as string || '30d';
      const data = await analyticsService.getSalesAnalytics(period);
      res.json({ analytics: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/admin/analytics/inventory", async (req, res) => {
    try {
      const analyticsService = req.scope.resolve("analyticsService");
      const data = await analyticsService.getInventoryAnalytics();
      res.json({ analytics: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/admin/analytics/customers", async (req, res) => {
    try {
      const analyticsService = req.scope.resolve("analyticsService");
      const period = req.query.period as string || '30d';
      const data = await analyticsService.getCustomerAnalytics(period);
      res.json({ analytics: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cloudflare integration endpoints
  router.post("/admin/cloudflare/upload-image", async (req, res) => {
    try {
      const cloudflareService = req.scope.resolve("cloudflareService");
      const multer = require('multer');
      const upload = multer({ storage: multer.memoryStorage() });
      
      upload.single('image')(req, res, async (err: any) => {
        if (err) {
          return res.status(400).json({ error: 'File upload error' });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' });
        }
        
        try {
          const result = await cloudflareService.uploadImage(
            req.file.buffer,
            req.file.originalname,
            req.body.metadata ? JSON.parse(req.body.metadata) : undefined
          );
          res.json({ image: result });
        } catch (uploadError: any) {
          res.status(500).json({ error: uploadError.message });
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/admin/cloudflare/upload-images-batch", async (req, res) => {
    try {
      const cloudflareService = req.scope.resolve("cloudflareService");
      const multer = require('multer');
      const upload = multer({ storage: multer.memoryStorage() });
      
      upload.array('images', 10)(req, res, async (err: any) => {
        if (err) {
          return res.status(400).json({ error: 'File upload error' });
        }
        
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'No files provided' });
        }
        
        try {
          const files = (req.files as any[]).map((file: any, index: number) => ({
            buffer: file.buffer,
            filename: file.originalname,
            metadata: req.body.metadata ? JSON.parse(req.body.metadata[index] || '{}') : undefined,
          }));
          
          const results = await cloudflareService.uploadImagesBatch(files);
          res.json({ images: results });
        } catch (uploadError: any) {
          res.status(500).json({ error: uploadError.message });
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/admin/cloudflare/image/:imageId", async (req, res) => {
    try {
      const cloudflareService = req.scope.resolve("cloudflareService");
      const { imageId } = req.params;
      
      await cloudflareService.deleteImage(imageId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/admin/cloudflare/image-variants/:imageId", async (req, res) => {
    try {
      const cloudflareService = req.scope.resolve("cloudflareService");
      const { imageId } = req.params;
      
      const variants = cloudflareService.generateImageVariants(imageId);
      res.json({ variants });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Facebook Pixel configuration
  router.get("/store/facebook/pixel-config", async (req, res) => {
    try {
      const facebookService = req.scope.resolve("facebookService");
      const config = facebookService.getFacebookPixelConfig();
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Analytics configuration
  router.get("/store/google-analytics/config", async (req, res) => {
    try {
      const googleAnalyticsService = req.scope.resolve("googleAnalyticsService");
      const config = googleAnalyticsService.getGA4Config();
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk product operations
  router.post("/admin/products/bulk-update", async (req, res) => {
    try {
      const productService = req.scope.resolve("productService");
      const { productIds, updates } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: 'Product IDs are required' });
      }
      
      const results = [];
      
      for (const productId of productIds) {
        try {
          const updatedProduct = await productService.update(productId, updates);
          results.push({ id: productId, success: true, product: updatedProduct });
        } catch (error: any) {
          results.push({ id: productId, success: false, error: error.message });
        }
      }
      
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/admin/products/bulk-delete", async (req, res) => {
    try {
      const productService = req.scope.resolve("productService");
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: 'Product IDs are required' });
      }
      
      const results = [];
      
      for (const productId of productIds) {
        try {
          await productService.delete(productId);
          results.push({ id: productId, success: true });
        } catch (error: any) {
          results.push({ id: productId, success: false, error: error.message });
        }
      }
      
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enterprise health check
  router.get("/admin/system/health", async (req, res) => {
    try {
      const redis = req.scope.resolve("redisClient");
      const manager = req.scope.resolve("manager");
      
      // Check database
      let dbHealth = true;
      try {
        await manager.query("SELECT 1");
      } catch (error) {
        dbHealth = false;
      }
      
      // Check Redis
      let redisHealth = true;
      try {
        await redis.ping();
      } catch (error) {
        redisHealth = false;
      }
      
      // Check Cloudflare
      const cloudflareService = req.scope.resolve("cloudflareService");
      const cloudflareHealth = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_IMAGES_TOKEN);
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          redis: redisHealth,
          cloudflare: cloudflareHealth,
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return [router];
};