import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME;
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;

function showUsage() {
  console.log(`
Usage: npx tsx scripts/create-superadmin.ts

Required environment variables:
  DATABASE_URL or PRODUCTION_DATABASE_URL - PostgreSQL connection string
  SUPERADMIN_EMAIL                        - Email for the superadmin account
  SUPERADMIN_NAME                         - Display name for the superadmin
  SUPERADMIN_PASSWORD                     - Password (min 8 chars, must contain uppercase, lowercase, number)

Example:
  SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_NAME=Admin SUPERADMIN_PASSWORD=SecurePass123! npx tsx scripts/create-superadmin.ts

Or set these in your .env file and run:
  npx tsx scripts/create-superadmin.ts
  `);
}

function validatePassword(password: string): boolean {
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    console.error('Error: Password must contain at least one uppercase letter');
    return false;
  }
  if (!/[a-z]/.test(password)) {
    console.error('Error: Password must contain at least one lowercase letter');
    return false;
  }
  if (!/[0-9]/.test(password)) {
    console.error('Error: Password must contain at least one number');
    return false;
  }
  return true;
}

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL or PRODUCTION_DATABASE_URL not found');
  showUsage();
  process.exit(1);
}

if (!SUPERADMIN_EMAIL) {
  console.error('Error: SUPERADMIN_EMAIL not provided');
  showUsage();
  process.exit(1);
}

if (!SUPERADMIN_NAME) {
  console.error('Error: SUPERADMIN_NAME not provided');
  showUsage();
  process.exit(1);
}

if (!SUPERADMIN_PASSWORD) {
  console.error('Error: SUPERADMIN_PASSWORD not provided');
  showUsage();
  process.exit(1);
}

if (!validatePassword(SUPERADMIN_PASSWORD)) {
  process.exit(1);
}

async function createSuperAdmin() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [SUPERADMIN_EMAIL]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`User ${SUPERADMIN_EMAIL} already exists`);
      return;
    }
    
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD!, 10);
    
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_master_admin) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, role, is_master_admin`,
      [SUPERADMIN_NAME, SUPERADMIN_EMAIL, passwordHash, 'superadmin', true]
    );
    
    console.log(`SuperAdmin created successfully!`);
    console.log(`ID: ${result.rows[0].id}`);
    console.log(`Email: ${result.rows[0].email}`);
    console.log(`Role: ${result.rows[0].role}`);
    console.log(`Master Admin: ${result.rows[0].is_master_admin}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSuperAdmin();
