import { Pool } from 'pg';

const PRODUCTION_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!PRODUCTION_DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const email = 'sae230679@gmail.com';

async function makeSuperAdmin() {
  const pool = new Pool({ connectionString: PRODUCTION_DATABASE_URL });
  
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, is_master_admin = $2 WHERE email = $3 RETURNING id, email, role, is_master_admin',
      ['superadmin', true, email]
    );
    
    if (result.rowCount === 0) {
      console.log(`User with email ${email} not found`);
    } else {
      console.log(`User promoted to SuperAdmin successfully!`);
      console.log(`Email: ${result.rows[0].email}`);
      console.log(`Role: ${result.rows[0].role}`);
      console.log(`Master Admin: ${result.rows[0].is_master_admin}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

makeSuperAdmin();
