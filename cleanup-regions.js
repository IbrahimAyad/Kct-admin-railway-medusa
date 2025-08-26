const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function cleanupRegions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Check all regions
    console.log('1. Checking all regions...');
    const regionsResult = await client.query(`
      SELECT r.id, r.name, r.currency_code, r.created_at,
             COUNT(so.id) as shipping_count
      FROM region r
      LEFT JOIN shipping_option so ON r.id = so.region_id
      GROUP BY r.id, r.name, r.currency_code, r.created_at
      ORDER BY r.created_at
    `);
    
    console.log('Current regions:');
    regionsResult.rows.forEach(region => {
      console.log(`  - ${region.id}: ${region.name} (${region.currency_code})`);
      console.log(`    Created: ${region.created_at}`);
      console.log(`    Shipping options: ${region.shipping_count}`);
    });
    console.log();

    // 2. Find duplicate regions
    console.log('2. Finding duplicate regions...');
    const duplicatesResult = await client.query(`
      SELECT name, currency_code, COUNT(*) as count
      FROM region
      GROUP BY name, currency_code
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length > 0) {
      console.log('Found duplicates:');
      for (const dup of duplicatesResult.rows) {
        console.log(`  - ${dup.count} regions named "${dup.name}" with currency ${dup.currency_code}`);
        
        // Get all instances of this duplicate
        const instances = await client.query(`
          SELECT r.id, r.created_at,
                 COUNT(so.id) as shipping_count,
                 COUNT(c.iso_2) as country_count
          FROM region r
          LEFT JOIN shipping_option so ON r.id = so.region_id
          LEFT JOIN country c ON r.id = c.region_id
          WHERE r.name = $1 AND r.currency_code = $2
          GROUP BY r.id, r.created_at
          ORDER BY shipping_count DESC, r.created_at ASC
        `, [dup.name, dup.currency_code]);
        
        // Keep the one with most shipping options (or oldest if tied)
        const [keepRegion, ...deleteRegions] = instances.rows;
        
        console.log(`    Keeping: ${keepRegion.id} (${keepRegion.shipping_count} shipping options)`);
        
        for (const delRegion of deleteRegions) {
          console.log(`    Deleting: ${delRegion.id} (${delRegion.shipping_count} shipping options)`);
          
          // Move any shipping options to the kept region
          if (delRegion.shipping_count > 0) {
            await client.query(`
              UPDATE shipping_option 
              SET region_id = $1 
              WHERE region_id = $2
            `, [keepRegion.id, delRegion.id]);
            console.log(`      Moved ${delRegion.shipping_count} shipping options`);
          }
          
          // Move any countries to the kept region
          if (delRegion.country_count > 0) {
            await client.query(`
              UPDATE country 
              SET region_id = $1 
              WHERE region_id = $2
            `, [keepRegion.id, delRegion.id]);
            console.log(`      Moved ${delRegion.country_count} countries`);
          }
          
          // Delete the duplicate region
          await client.query(`
            DELETE FROM region_fulfillment_providers WHERE region_id = $1
          `, [delRegion.id]);
          
          await client.query(`
            DELETE FROM region_payment_providers WHERE region_id = $1
          `, [delRegion.id]);
          
          await client.query(`
            DELETE FROM region WHERE id = $1
          `, [delRegion.id]);
          
          console.log(`      ✅ Deleted region ${delRegion.id}`);
        }
      }
    } else {
      console.log('No duplicate regions found');
    }
    console.log();

    // 3. Ensure providers exist first
    console.log('3. Ensuring providers exist...');
    
    // Create manual fulfillment provider if not exists
    await client.query(`
      INSERT INTO fulfillment_provider (id, is_installed)
      VALUES ('manual', true)
      ON CONFLICT (id) DO UPDATE SET is_installed = true
    `);
    
    // Create manual payment provider if not exists  
    await client.query(`
      INSERT INTO payment_provider (id, is_installed)
      VALUES ('manual', true)
      ON CONFLICT (id) DO UPDATE SET is_installed = true
    `);
    
    console.log('✅ Providers exist\n');
    
    // 4. Ensure all regions have proper relationships
    console.log('4. Ensuring regions have proper relationships...');
    const allRegions = await client.query(`SELECT id FROM region`);
    
    for (const region of allRegions.rows) {
      // Ensure fulfillment provider
      await client.query(`
        INSERT INTO region_fulfillment_providers (region_id, provider_id)
        VALUES ($1, 'manual')
        ON CONFLICT (region_id, provider_id) DO NOTHING
      `, [region.id]);
      
      // Ensure payment provider
      await client.query(`
        INSERT INTO region_payment_providers (region_id, provider_id)
        VALUES ($1, 'manual')
        ON CONFLICT (region_id, provider_id) DO NOTHING
      `, [region.id]);
    }
    console.log('✅ All regions have fulfillment and payment providers\n');

    // 5. Verify shipping options have all required fields
    console.log('5. Verifying shipping options...');
    const shippingOptions = await client.query(`
      SELECT id, name, provider_id, price_type, profile_id, region_id
      FROM shipping_option
      WHERE deleted_at IS NULL
    `);
    
    let fixCount = 0;
    for (const option of shippingOptions.rows) {
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (!option.provider_id) {
        updates.push(`provider_id = $${paramCount}`);
        values.push('manual');
        paramCount++;
        fixCount++;
      }
      
      if (!option.price_type) {
        updates.push(`price_type = $${paramCount}`);
        values.push('flat_rate');
        paramCount++;
        fixCount++;
      }
      
      if (!option.profile_id) {
        updates.push(`profile_id = $${paramCount}`);
        values.push('sp_01');
        paramCount++;
        fixCount++;
      }
      
      if (updates.length > 0) {
        values.push(option.id);
        await client.query(`
          UPDATE shipping_option
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
        `, values);
        console.log(`  Fixed: ${option.name}`);
      }
    }
    
    if (fixCount > 0) {
      console.log(`✅ Fixed ${fixCount} shipping option fields\n`);
    } else {
      console.log('✅ All shipping options have required fields\n');
    }

    // 6. Final verification
    console.log('6. Final verification...');
    const finalRegions = await client.query(`
      SELECT r.id, r.name, r.currency_code,
             COUNT(DISTINCT so.id) as shipping_count,
             COUNT(DISTINCT c.iso_2) as country_count,
             COUNT(DISTINCT rfp.provider_id) as fulfillment_count,
             COUNT(DISTINCT rpp.provider_id) as payment_count
      FROM region r
      LEFT JOIN shipping_option so ON r.id = so.region_id AND so.deleted_at IS NULL
      LEFT JOIN country c ON r.id = c.region_id
      LEFT JOIN region_fulfillment_providers rfp ON r.id = rfp.region_id
      LEFT JOIN region_payment_providers rpp ON r.id = rpp.region_id
      GROUP BY r.id, r.name, r.currency_code
    `);
    
    console.log('Final regions status:');
    finalRegions.rows.forEach(region => {
      console.log(`  ${region.name} (${region.id}):`);
      console.log(`    - ${region.shipping_count} shipping options`);
      console.log(`    - ${region.country_count} countries`);
      console.log(`    - ${region.fulfillment_count} fulfillment providers`);
      console.log(`    - ${region.payment_count} payment providers`);
    });

    console.log('\n✅ Region cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

cleanupRegions();