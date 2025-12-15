import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const PRODUCTION_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!PRODUCTION_DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const email = 'sae230679@yandex.ru';
const newPassword = 'SecureLex2024!';

async function resetPassword() {
  const pool = new Pool({ connectionString: PRODUCTION_DATABASE_URL });
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role',
      [hashedPassword, email]
    );
    
    if (result.rowCount === 0) {
      console.log(`User with email ${email} not found`);
    } else {
      console.log(`Password updated successfully for: ${result.rows[0].email}`);
      console.log(`User ID: ${result.rows[0].id}, Role: ${result.rows[0].role}`);
      console.log(`\nNew password: ${newPassword}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();
