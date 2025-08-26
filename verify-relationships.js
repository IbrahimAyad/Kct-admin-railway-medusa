const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function verifyAndFixRelationships() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Update region metadata
    console.log('1. Updating region metadata...');
    await client.query(`
      UPDATE region 
      SET metadata = COALESCE(metadata, '{}')::jsonb || '{"created_via": "admin"}'::jsonb
      WHERE id = 'reg_us'
    `);
    console.log('✅ Region metadata updated\n');

    // 2. Verify fulfillment provider associations
    console.log('2. Checking fulfillment provider associations...');
    const checkResult = await client.query(`
      SELECT r.id as region_id, r.name, fp.provider_id 
      FROM region r 
      LEFT JOIN region_fulfillment_providers fp ON r.id = fp.region_id
      WHERE r.id = 'reg_us'
    `);
    
    console.log('Current associations:');
    if (checkResult.rows.length === 0) {
      console.log('❌ No associations found');
    } else {
      checkResult.rows.forEach(row => {
        console.log(`  Region: ${row.region_id} (${row.name}) -> Provider: ${row.provider_id || 'NONE'}`);
      });
    }

    // 3. Re-insert if needed
    if (!checkResult.rows[0]?.provider_id) {
      console.log('\n3. Re-inserting fulfillment provider association...');
      await client.query(`
        DELETE FROM region_fulfillment_providers WHERE region_id = 'reg_us'
      `);
      await client.query(`
        INSERT INTO region_fulfillment_providers (region_id, provider_id) 
        VALUES ('reg_us', 'manual')
      `);
      console.log('✅ Fulfillment provider re-linked\n');
    } else {
      console.log('\n✅ Fulfillment provider already linked\n');
    }

    // 4. Verify payment provider associations
    console.log('4. Checking payment provider associations...');
    const paymentCheck = await client.query(`
      SELECT r.id as region_id, r.name, pp.provider_id 
      FROM region r 
      LEFT JOIN region_payment_providers pp ON r.id = pp.region_id
      WHERE r.id = 'reg_us'
    `);
    
    if (!paymentCheck.rows[0]?.provider_id) {
      console.log('Re-inserting payment provider...');
      await client.query(`
        DELETE FROM region_payment_providers WHERE region_id = 'reg_us'
      `);
      await client.query(`
        INSERT INTO region_payment_providers (region_id, provider_id) 
        VALUES ('reg_us', 'stripe')
      `);
      console.log('✅ Payment provider re-linked\n');
    } else {
      console.log('✅ Payment provider already linked\n');
    }

    // 5. Final verification
    console.log('5. FINAL VERIFICATION:');
    console.log('=====================\n');
    
    // Check all tables
    const tables = [
      { name: 'fulfillment_provider', query: "SELECT * FROM fulfillment_provider" },
      { name: 'payment_provider', query: "SELECT * FROM payment_provider" },
      { name: 'region', query: "SELECT id, name, currency_code FROM region" },
      { name: 'region_fulfillment_providers', query: "SELECT * FROM region_fulfillment_providers" },
      { name: 'region_payment_providers', query: "SELECT * FROM region_payment_providers" },
      { name: 'shipping_option', query: "SELECT id, name, region_id FROM shipping_option" }
    ];

    for (const table of tables) {
      const result = await client.query(table.query);
      console.log(`${table.name}: ${result.rows.length} records`);
      if (result.rows.length > 0 && result.rows.length <= 3) {
        result.rows.forEach(row => {
          console.log(`  - ${JSON.stringify(row)}`);
        });
      }
    }

    console.log('\n✅ All verifications complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

verifyAndFixRelationships();