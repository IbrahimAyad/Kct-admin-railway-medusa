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
      
      // Get shipping options for this region
      const shippingResult = await client.query(`
        SELECT id, name, region_id, profile_id, provider_id, 
               price_type, amount, is_return, admin_only, 
               requirements, data, created_at, updated_at 
        FROM shipping_option 
        WHERE region_id = $1 AND deleted_at IS NULL
      `, [id]);
      
      const shipping_options = shippingResult.rows.map(option => ({
        id: option.id,
        name: option.name,
        region_id: option.region_id,
        profile_id: option.profile_id,
        provider_id: option.provider_id,
        price_type: option.price_type,
        amount: option.amount,
        is_return: option.is_return || false,
        admin_only: option.admin_only || false,
        requirements: option.requirements || [],
        data: option.data || {},
        created_at: option.created_at,
        updated_at: option.updated_at,
        deleted_at: null,
        metadata: null
      }));
      
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
          shipping_options: shipping_options,
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
    const { region_id } = req.query;
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      let query = `
        SELECT so.*, 
               r.name as region_name,
               r.currency_code as region_currency,
               sp.name as profile_name,
               sp.type as profile_type,
               sp.products as profile_products,
               sp.shipping_options as profile_shipping_options
        FROM shipping_option so
        LEFT JOIN region r ON so.region_id = r.id
        LEFT JOIN shipping_profile sp ON so.profile_id = sp.id
        WHERE so.deleted_at IS NULL
      `;
      
      const params = [];
      if (region_id) {
        query += ` AND so.region_id = $1`;
        params.push(region_id);
      }
      
      const shippingResult = await client.query(query, params);

      const shippingOptions = shippingResult.rows.map(option => ({
        id: option.id,
        name: option.name,
        region_id: option.region_id,
        region: {
          id: option.region_id,
          name: option.region_name || 'Unknown Region',
          currency_code: option.region_currency || 'usd'
        },
        profile_id: option.profile_id,
        profile: {
          id: option.profile_id,
          name: option.profile_name || 'Default Profile',
          type: option.profile_type || 'default',
          products: option.profile_products || [],
          shipping_options: option.profile_shipping_options || []
        },
        provider_id: option.provider_id || 'manual',
        provider: {
          id: option.provider_id || 'manual',
          is_installed: true
        },
        price_type: option.price_type || 'flat_rate',
        amount: option.amount || 0,
        is_return: option.is_return || false,
        is_default: option.is_default || false,
        admin_only: option.admin_only || false,
        includes_tax: option.includes_tax || false,
        min_subtotal: option.min_subtotal || null,
        max_subtotal: option.max_subtotal || null,
        requirements: option.requirements || [],
        data: option.data || {},
        metadata: option.metadata || {},
        created_at: option.created_at,
        updated_at: option.updated_at,
        deleted_at: option.deleted_at
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

  // GET /admin/shipping-profiles - List shipping profiles
  router.get("/shipping-profiles", async (req, res) => {
    console.log("Shipping profiles endpoint called");
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const profilesResult = await client.query(`
        SELECT * FROM shipping_profile 
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
      `);

      const profiles = profilesResult.rows.map(profile => ({
        id: profile.id,
        name: profile.name,
        type: profile.type || 'default',
        metadata: profile.metadata || {},
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        deleted_at: profile.deleted_at
      }));

      res.json({
        shipping_profiles: profiles,
        count: profiles.length,
        offset: 0,
        limit: 100
      });

    } catch (error) {
      console.error("Shipping profiles error:", error);
      res.status(500).json({ 
        message: "Error fetching shipping profiles",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/shipping-options/:id - Get single shipping option
  router.get("/shipping-options/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Get shipping option:", id);
    console.log("Request headers:", req.headers);
    console.log("Request query:", req.query);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT so.*, 
               r.name as region_name,
               r.currency_code as region_currency, 
               sp.name as profile_name,
               sp.type as profile_type,
               sp.products as profile_products,
               sp.shipping_options as profile_shipping_options
        FROM shipping_option so
        LEFT JOIN region r ON so.region_id = r.id
        LEFT JOIN shipping_profile sp ON so.profile_id = sp.id
        WHERE so.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shipping option not found" });
      }

      const option = result.rows[0];
      
      const response = {
        shipping_option: {
          id: option.id,
          name: option.name,
          region_id: option.region_id,
          region: {
            id: option.region_id,
            name: option.region_name || 'Unknown Region',
            currency_code: option.region_currency || 'usd'
          },
          profile_id: option.profile_id,
          profile: {
            id: option.profile_id,
            name: option.profile_name || 'Default Profile',
            type: option.profile_type || 'default',
            products: option.profile_products || [],
            shipping_options: option.profile_shipping_options || []
          },
          provider_id: option.provider_id || 'manual',
          provider: {
            id: option.provider_id || 'manual',
            is_installed: true
          },
          price_type: option.price_type || 'flat_rate',
          amount: option.amount || 0,
          is_return: option.is_return || false,
          is_default: option.is_default || false,
          admin_only: option.admin_only || false,
          includes_tax: option.includes_tax || false,
          min_subtotal: option.min_subtotal || null,
          max_subtotal: option.max_subtotal || null,
          requirements: option.requirements || [],
          data: option.data || {},
          metadata: option.metadata || {},
          created_at: option.created_at,
          updated_at: option.updated_at,
          deleted_at: option.deleted_at
        }
      };
      
      console.log("Returning shipping option:", JSON.stringify(response, null, 2));
      res.json(response);

    } catch (error) {
      console.error("Get shipping option error:", error);
      res.status(500).json({ 
        message: "Error fetching shipping option",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // POST /admin/shipping-options - Create shipping option
  router.post("/shipping-options", async (req, res) => {
    console.log("Create shipping option:", req.body);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const {
        name,
        region_id,
        profile_id,
        provider_id = 'manual',
        price_type = 'flat_rate',
        amount,
        is_return = false,
        admin_only = false,
        requirements = [],
        data = {},
        metadata = {}
      } = req.body;

      // Generate ID
      const id = 'so_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

      const result = await client.query(`
        INSERT INTO shipping_option (
          id, name, region_id, profile_id, provider_id,
          price_type, amount, is_return, admin_only,
          requirements, data, metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING *
      `, [id, name, region_id, profile_id, provider_id, price_type, amount, 
          is_return, admin_only, JSON.stringify(requirements), 
          JSON.stringify(data), JSON.stringify(metadata)]);

      const created = result.rows[0];
      
      res.status(201).json({
        shipping_option: {
          id: created.id,
          name: created.name,
          region_id: created.region_id,
          profile_id: created.profile_id,
          provider_id: created.provider_id,
          price_type: created.price_type,
          amount: created.amount,
          is_return: created.is_return,
          admin_only: created.admin_only,
          requirements: created.requirements || [],
          data: created.data || {},
          metadata: created.metadata || {},
          created_at: created.created_at,
          updated_at: created.updated_at
        }
      });

    } catch (error) {
      console.error("Create shipping option error:", error);
      res.status(500).json({ 
        message: "Error creating shipping option",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // PUT /admin/shipping-options/:id - Update shipping option
  router.put("/shipping-options/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Update shipping option:", id, req.body);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const updates = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      const updateableFields = ['name', 'amount', 'price_type', 'is_return', 
                                'admin_only', 'requirements', 'data', 'metadata'];
      
      updateableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount}`);
          if (typeof req.body[field] === 'object') {
            values.push(JSON.stringify(req.body[field]));
          } else {
            values.push(req.body[field]);
          }
          paramCount++;
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await client.query(`
        UPDATE shipping_option 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shipping option not found" });
      }

      const updated = result.rows[0];
      
      res.json({
        shipping_option: {
          id: updated.id,
          name: updated.name,
          region_id: updated.region_id,
          profile_id: updated.profile_id,
          provider_id: updated.provider_id,
          price_type: updated.price_type,
          amount: updated.amount,
          is_return: updated.is_return,
          admin_only: updated.admin_only,
          requirements: updated.requirements || [],
          data: updated.data || {},
          metadata: updated.metadata || {},
          created_at: updated.created_at,
          updated_at: updated.updated_at
        }
      });

    } catch (error) {
      console.error("Update shipping option error:", error);
      res.status(500).json({ 
        message: "Error updating shipping option",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // DELETE /admin/shipping-options/:id - Delete shipping option
  router.delete("/shipping-options/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Delete shipping option:", id);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(`
        UPDATE shipping_option 
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shipping option not found" });
      }

      res.json({
        id: id,
        object: "shipping-option",
        deleted: true
      });

    } catch (error) {
      console.error("Delete shipping option error:", error);
      res.status(500).json({ 
        message: "Error deleting shipping option",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  // PUT /admin/regions/:id - Update region
  router.put("/regions/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Update region:", id, req.body);
    
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      // Start transaction
      await client.query('BEGIN');
      
      // Update region fields
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      const updateableFields = ['name', 'currency_code', 'tax_rate', 'tax_code', 
                                'gift_cards_taxable', 'automatic_taxes'];
      
      updateableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramCount}`);
          values.push(req.body[field]);
          paramCount++;
        }
      });
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(id);
        
        await client.query(`
          UPDATE region 
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
        `, values);
      }
      
      // Update fulfillment providers if provided
      if (req.body.fulfillment_providers) {
        // Remove existing
        await client.query(`
          DELETE FROM region_fulfillment_providers WHERE region_id = $1
        `, [id]);
        
        // Add new ones
        for (const provider of req.body.fulfillment_providers) {
          await client.query(`
            INSERT INTO region_fulfillment_providers (region_id, provider_id)
            VALUES ($1, $2)
          `, [id, provider.provider_id || provider]);
        }
      }
      
      // Update payment providers if provided
      if (req.body.payment_providers) {
        // Remove existing
        await client.query(`
          DELETE FROM region_payment_providers WHERE region_id = $1
        `, [id]);
        
        // Add new ones
        for (const provider of req.body.payment_providers) {
          await client.query(`
            INSERT INTO region_payment_providers (region_id, provider_id)
            VALUES ($1, $2)
          `, [id, provider.provider_id || provider]);
        }
      }
      
      // Update countries if provided
      if (req.body.countries) {
        // Remove existing
        await client.query(`
          DELETE FROM country WHERE region_id = $1
        `, [id]);
        
        // Add new ones
        for (const country of req.body.countries) {
          const countryCode = country.iso_2 || country;
          await client.query(`
            INSERT INTO country (iso_2, iso_3, num_code, name, display_name, region_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (iso_2) DO UPDATE SET region_id = $6
          `, [countryCode, country.iso_3 || countryCode, country.num_code || 0, 
              country.name || countryCode, country.display_name || countryCode, id]);
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated region
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
          payment_providers: region.payment_providers || [{ provider_id: 'manual' }],
          countries: region.countries || [],
          created_at: region.created_at,
          updated_at: region.updated_at,
          deleted_at: region.deleted_at,
          metadata: region.metadata || {}
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Update region error:", error);
      res.status(500).json({ 
        message: "Error updating region",
        error: error.message 
      });
    } finally {
      await client.end();
    }
  });

  return router;
};

module.exports = { createAdminAPIRouter };