const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function setupCurrencies() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Ensure USD currency exists with all fields
    console.log('1. Setting up USD currency...');
    await client.query(`
      INSERT INTO currency (code, symbol, symbol_native, name)
      VALUES ('usd', '$', '$', 'US Dollar')
      ON CONFLICT (code) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        symbol_native = EXCLUDED.symbol_native,
        name = EXCLUDED.name
    `);
    console.log('✅ USD currency configured\n');

    // 2. Add other common currencies if needed
    console.log('2. Adding common currencies...');
    const currencies = [
      { code: 'eur', symbol: '€', symbol_native: '€', name: 'Euro' },
      { code: 'gbp', symbol: '£', symbol_native: '£', name: 'British Pound' },
      { code: 'cad', symbol: 'CA$', symbol_native: '$', name: 'Canadian Dollar' },
      { code: 'aud', symbol: 'A$', symbol_native: '$', name: 'Australian Dollar' }
    ];

    for (const currency of currencies) {
      await client.query(`
        INSERT INTO currency (code, symbol, symbol_native, name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE SET
          symbol = EXCLUDED.symbol,
          symbol_native = EXCLUDED.symbol_native,
          name = EXCLUDED.name
      `, [currency.code, currency.symbol, currency.symbol_native, currency.name]);
    }
    console.log('✅ Common currencies added\n');

    // 3. Ensure store exists with default currency
    console.log('3. Setting up store...');
    const storeCheck = await client.query(`SELECT id FROM store LIMIT 1`);
    
    if (storeCheck.rows.length === 0) {
      // Create store if it doesn't exist
      await client.query(`
        INSERT INTO store (
          id, name, default_currency_code, 
          swap_link_template, payment_link_template, 
          invite_link_template, created_at, updated_at
        ) VALUES (
          'store_01', 
          'KCT Menswear Store', 
          'usd',
          '{{cart_id}}',
          '{{payment_id}}',
          '{{invite_token}}',
          NOW(), 
          NOW()
        )
      `);
      console.log('✅ Store created');
    } else {
      // Update existing store
      await client.query(`
        UPDATE store 
        SET default_currency_code = 'usd',
            name = COALESCE(name, 'KCT Menswear Store')
        WHERE id = $1
      `, [storeCheck.rows[0].id]);
      console.log('✅ Store updated');
    }
    
    // 4. Setup store currencies relationship
    console.log('\n4. Setting up store currencies...');
    const storeId = storeCheck.rows[0]?.id || 'store_01';
    
    // Add USD as store currency
    await client.query(`
      INSERT INTO store_currencies (store_id, currency_code)
      VALUES ($1, 'usd')
      ON CONFLICT (store_id, currency_code) DO NOTHING
    `, [storeId]);
    
    console.log('✅ Store currencies configured\n');

    // 5. Verify setup
    console.log('5. Verifying setup...');
    
    // Check currencies
    const currencyResult = await client.query(`
      SELECT * FROM currency WHERE code = 'usd'
    `);
    console.log('USD Currency:', currencyResult.rows[0]);
    
    // Check store
    const storeResult = await client.query(`
      SELECT s.*, 
             array_agg(sc.currency_code) as currencies
      FROM store s
      LEFT JOIN store_currencies sc ON s.id = sc.store_id
      GROUP BY s.id
      LIMIT 1
    `);
    console.log('Store:', storeResult.rows[0]);

    console.log('\n✅ Currency setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

setupCurrencies();