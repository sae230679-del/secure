import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
const RESET_EMAIL = process.env.RESET_PASSWORD_EMAIL;
const RESET_PASSWORD = process.env.RESET_PASSWORD_VALUE;

function showUsage() {
  console.log(`
Usage: RESET_PASSWORD_EMAIL=<email> RESET_PASSWORD_VALUE=<password> npx tsx scripts/reset-password.ts

Required environment variables:
  DATABASE_URL or PRODUCTION_DATABASE_URL - PostgreSQL connection string
  RESET_PASSWORD_EMAIL                    - Email of user to reset password for
  RESET_PASSWORD_VALUE                    - New password (min 8 chars, must contain uppercase, lowercase, number)

Example:
  RESET_PASSWORD_EMAIL=admin@example.com RESET_PASSWORD_VALUE=NewSecurePass123! npx tsx scripts/reset-password.ts
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

if (!RESET_EMAIL) {
  console.error('Error: RESET_PASSWORD_EMAIL not provided');
  showUsage();
  process.exit(1);
}

if (!RESET_PASSWORD) {
  console.error('Error: RESET_PASSWORD_VALUE not provided');
  showUsage();
  process.exit(1);
}

if (!validatePassword(RESET_PASSWORD)) {
  process.exit(1);
}

async function resetPassword() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const hashedPassword = await bcrypt.hash(RESET_PASSWORD!, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, role',
      [hashedPassword, RESET_EMAIL]
    );
    
    if (result.rowCount === 0) {
      console.log(`User with email ${RESET_EMAIL} not found`);
      process.exit(1);
    } else {
      console.log(`Password updated successfully for: ${result.rows[0].email}`);
      console.log(`User ID: ${result.rows[0].id}, Role: ${result.rows[0].role}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetPassword();
