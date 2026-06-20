const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.USER_DB_HOST,
  port: process.env.USER_DB_PORT || 5432,
  database: process.env.USER_DB_NAME,
  user: process.env.USER_DB_USER,
  password: process.env.USER_DB_PASSWORD,
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to User DB, initializing tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      console.log('Seeding initial user data...');

      const passwordHash = await bcrypt.hash('password123', 10);
      const adminHash = await bcrypt.hash('admin123', 10);

      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES
         ($1, $2, $3, $4, $5),
         ($6, $7, $8, $9, $10)`,
        [
          '11111111-1111-1111-1111-111111111111', 'Test Customer', 'customer@vastraco.com', passwordHash, 'customer',
          '33333333-3333-3333-3333-333333333333', 'Admin User', 'admin@vastraco.com', adminHash, 'admin'
        ]
      );
      console.log('User seed data inserted.');
    }

    console.log('User DB initialization complete.');
  } catch (err) {
    console.error('Error initializing User DB', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
