import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const PRODUCTION_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!PRODUCTION_DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const email = 'sae230679@yandex.ru';
const name = 'Sergey';
const password = 'SecureLex2024!';

async function createSuperAdmin() {
  const pool = new Pool({ connectionString: PRODUCTION_DATABASE_URL });
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`User ${email} already exists`);
      return;
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_master_admin) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, role, is_master_admin`,
      [name, email, passwordHash, 'superadmin', true]
    );
    
    console.log(`SuperAdmin created successfully!`);
    console.log(`ID: ${result.rows[0].id}`);
    console.log(`Email: ${result.rows[0].email}`);
    console.log(`Role: ${result.rows[0].role}`);
    console.log(`Master Admin: ${result.rows[0].is_master_admin}`);
    console.log(`\nPassword: ${password}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
