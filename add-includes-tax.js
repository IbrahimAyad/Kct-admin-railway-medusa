const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function addIncludesTax() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Add includes_tax column if it doesn't exist
    console.log('1. Adding includes_tax column to shipping_option...');
    try {
      await client.query(`
        ALTER TABLE shipping_option 
        ADD COLUMN includes_tax boolean DEFAULT false
      `);
      console.log('✅ includes_tax column added');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✅ includes_tax column already exists');
      } else {
        console.log('⚠️ includes_tax column error:', err.message);
      }
    }

    // 2. Update existing records
    console.log('\n2. Setting default value for existing records...');
    await client.query(`
      UPDATE shipping_option 
      SET includes_tax = false 
      WHERE includes_tax IS NULL
    `);
    console.log('✅ Default values set');

    // 3. Verify
    console.log('\n3. Verifying shipping options...');
    const result = await client.query(`
      SELECT id, name, includes_tax 
      FROM shipping_option 
      WHERE deleted_at IS NULL
    `);
    
    console.log('Shipping options with includes_tax:');
    result.rows.forEach(option => {
      console.log(`  - ${option.name}: includes_tax = ${option.includes_tax}`);
    });

    console.log('\n✅ includes_tax field added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

addIncludesTax();