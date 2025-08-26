const express = require("express");
const { Client } = require("pg");

// Create router for admin API endpoints that the panel needs
const createAdminAPIRouter = () => {
  const router = express.Router();

  // GET /admin/regions - List all regions with full nested data
  router.get("/regions", async (req, res) => {
    console.log("Admin regions endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      // Get regions with all related data
      const regionsResult = await client.query(`
        SELECT 
          r.*,
          json_agg(DISTINCT jsonb_build_object(
            'provider_id', rfp.provider_id
          )) FILTER (WHERE rfp.provider_id IS NOT NULL) as fulfillment_providers,
          json_agg(DISTINCT jsonb_build_object(
            'provider_id', rpp.provider_id  
          )) FILTER (WHERE rpp.provider_id IS NOT NULL) as payment_providers,
          json_agg(DISTINCT c.*) FILTER (WHERE c.iso_2 IS NOT NULL) as countries,
          cur.symbol as currency_symbol,
          cur.name as currency_name
        FROM region r
        LEFT JOIN region_fulfillment_providers rfp ON r.id = rfp.region_id
        LEFT JOIN region_payment_providers rpp ON r.id = rpp.region_id
        LEFT JOIN country c ON r.id = c.region_id
        LEFT JOIN currency cur ON r.currency_code = cur.code
        GROUP BY r.id, r.name, r.currency_code, r.tax_rate, r.tax_code, 
                 r.created_at, r.updated_at, r.deleted_at, r.metadata,
                 r.gift_cards_taxable, r.automatic_taxes, r.tax_provider_id,
                 cur.symbol, cur.name
      `);

      // Transform the data to match Medusa's expected format
      const regions = regionsResult.rows.map(region => ({
        id: region.id,
        name: region.name,
        currency_code: region.currency_code,
        currency: {
          code: region.currency_code,
          symbol: region.currency_symbol || '$',
          symbol_native: region.currency_symbol || '$',
          name: region.currency_name || 'US Dollar'
        },
        tax_rate: region.tax_rate || 0,
        tax_code: region.tax_code || null,
        gift_cards_taxable: region.gift_cards_taxable || true,
        automatic_taxes: region.automatic_taxes || true,
        tax_provider_id: region.tax_provider_id || null,
        fulfillment_providers: region.fulfillment_providers || [{ provider_id: 'manual' }],
        payment_providers: region.payment_providers || [{ provider_id: 'stripe' }],
        countries: region.countries || [],
        created_at: region.created_at,
        updated_at: region.updated_at,
        deleted_at: region.deleted_at,
        metadata: region.metadata || {}
      }));

      res.json({
        regions: regions,
        count: regions.length,
        offset: 0,
        limit: 100
      });

    } catch (error) {
      console.error("Regions endpoint error:", error);
      res.status(500).json({ 
        message: "Error fetching regions",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/regions/:id - Get single region with full data
  router.get("/regions/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Get single region:", id);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const regionResult = await client.query(`
        SELECT 
          r.*,
          json_agg(DISTINCT jsonb_build_object(
            'provider_id', rfp.provider_id
          )) FILTER (WHERE rfp.provider_id IS NOT NULL) as fulfillment_providers,
          json_agg(DISTINCT jsonb_build_object(
            'provider_id', rpp.provider_id
          )) FILTER (WHERE rpp.provider_id IS NOT NULL) as payment_providers,
          json_agg(DISTINCT c.*) FILTER (WHERE c.iso_2 IS NOT NULL) as countries,
          cur.symbol as currency_symbol,
          cur.name as currency_name
        FROM region r
        LEFT JOIN region_fulfillment_providers rfp ON r.id = rfp.region_id
        LEFT JOIN region_payment_providers rpp ON r.id = rpp.region_id
        LEFT JOIN country c ON r.id = c.region_id
        LEFT JOIN currency cur ON r.currency_code = cur.code
        WHERE r.id = $1
        GROUP BY r.id, r.name, r.currency_code, r.tax_rate, r.tax_code,
                 r.created_at, r.updated_at, r.deleted_at, r.metadata,
                 r.gift_cards_taxable, r.automatic_taxes, r.tax_provider_id,
                 cur.symbol, cur.name
      `, [id]);

      if (regionResult.rows.length === 0) {
        return res.status(404).json({ message: "Region not found" });
      }

      const region = regionResult.rows[0];
      
      res.json({
        region: {
          id: region.id,
          name: region.name,
          currency_code: region.currency_code,
          currency: {
            code: region.currency_code,
            symbol: region.currency_symbol || '$',
            symbol_native: region.currency_symbol || '$',
            name: region.currency_name || 'US Dollar'
          },
          tax_rate: region.tax_rate || 0,
          tax_code: region.tax_code || null,
          gift_cards_taxable: region.gift_cards_taxable || true,
          automatic_taxes: region.automatic_taxes || true,
          tax_provider_id: region.tax_provider_id || null,
          fulfillment_providers: region.fulfillment_providers || [{ provider_id: 'manual' }],
          payment_providers: region.payment_providers || [{ provider_id: 'stripe' }],
          countries: region.countries || [],
          created_at: region.created_at,
          updated_at: region.updated_at,
          deleted_at: region.deleted_at,
          metadata: region.metadata || {}
        }
      });

    } catch (error) {
      console.error("Get region error:", error);
      res.status(500).json({ 
        message: "Error fetching region",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/shipping-options - List shipping options
  router.get("/shipping-options", async (req, res) => {
    console.log("Shipping options endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const shippingResult = await client.query(`
        SELECT so.*, r.name as region_name, sp.name as profile_name
        FROM shipping_option so
        LEFT JOIN region r ON so.region_id = r.id
        LEFT JOIN shipping_profile sp ON so.profile_id = sp.id
        WHERE so.deleted_at IS NULL
      `);

      const shippingOptions = shippingResult.rows.map(option => ({
        id: option.id,
        name: option.name,
        region_id: option.region_id,
        region: {
          id: option.region_id,
          name: option.region_name
        },
        profile_id: option.profile_id,
        profile: {
          id: option.profile_id,
          name: option.profile_name
        },
        provider_id: option.provider_id,
        price_type: option.price_type,
        amount: option.amount,
        is_return: option.is_return,
        admin_only: option.admin_only,
        data: option.data || {},
        metadata: option.metadata || {},
        created_at: option.created_at,
        updated_at: option.updated_at
      }));

      res.json({
        shipping_options: shippingOptions,
        count: shippingOptions.length,
        offset: 0,
        limit: 100
      });

    } catch (error) {
      console.error("Shipping options error:", error);
      res.status(500).json({ 
        message: "Error fetching shipping options",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/store - Get store details
  router.get("/store", async (req, res) => {
    console.log("Store endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const storeResult = await client.query(`
        SELECT s.*, 
               array_agg(sc.currency_code) as currencies
        FROM store s
        LEFT JOIN store_currencies sc ON s.id = sc.store_id
        GROUP BY s.id
        LIMIT 1
      `);

      if (storeResult.rows.length === 0) {
        return res.status(404).json({ message: "Store not found" });
      }

      const store = storeResult.rows[0];
      
      res.json({
        store: {
          id: store.id,
          name: store.name,
          default_currency_code: store.default_currency_code,
          currencies: store.currencies || ['usd'],
          swap_link_template: store.swap_link_template,
          payment_link_template: store.payment_link_template,
          invite_link_template: store.invite_link_template,
          default_sales_channel_id: store.default_sales_channel_id,
          default_location_id: store.default_location_id,
          metadata: store.metadata || {},
          created_at: store.created_at,
          updated_at: store.updated_at
        }
      });

    } catch (error) {
      console.error("Store endpoint error:", error);
      res.status(500).json({ 
        message: "Error fetching store",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/fulfillment-providers - List fulfillment providers
  router.get("/fulfillment-providers", async (req, res) => {
    console.log("Fulfillment providers endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const providersResult = await client.query(`
        SELECT * FROM fulfillment_provider WHERE is_installed = true
      `);

      const providers = providersResult.rows.map(provider => ({
        id: provider.id,
        is_installed: provider.is_installed
      }));

      res.json({
        fulfillment_providers: providers,
        count: providers.length
      });

    } catch (error) {
      console.error("Fulfillment providers error:", error);
      res.status(500).json({ 
        message: "Error fetching fulfillment providers",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/payment-providers - List payment providers
  router.get("/payment-providers", async (req, res) => {
    console.log("Payment providers endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const providersResult = await client.query(`
        SELECT * FROM payment_provider WHERE is_installed = true
      `);

      const providers = providersResult.rows.map(provider => ({
        id: provider.id,
        is_installed: provider.is_installed
      }));

      res.json({
        payment_providers: providers,
        count: providers.length
      });

    } catch (error) {
      console.error("Payment providers error:", error);
      res.status(500).json({ 
        message: "Error fetching payment providers",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/currencies - List currencies
  router.get("/currencies", async (req, res) => {
    console.log("Currencies endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const currenciesResult = await client.query(`
        SELECT * FROM currency ORDER BY code
      `);

      res.json({
        currencies: currenciesResult.rows,
        count: currenciesResult.rows.length
      });

    } catch (error) {
      console.error("Currencies error:", error);
      res.status(500).json({ 
        message: "Error fetching currencies",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  return router;
};

module.exports = { createAdminAPIRouter };