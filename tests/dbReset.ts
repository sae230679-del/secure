import { pool } from '../server/db';

export async function resetTestDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('TRUNCATE TABLE pdn_destruction_acts CASCADE');
    await client.query('TRUNCATE TABLE pdn_destruction_tasks CASCADE');
    await client.query('TRUNCATE TABLE pdn_consent_events CASCADE');
    await client.query('TRUNCATE TABLE seo_pages CASCADE');
    await client.query('TRUNCATE TABLE session CASCADE');
    await client.query('TRUNCATE TABLE reports CASCADE');
    await client.query('TRUNCATE TABLE audit_results CASCADE');
    await client.query('TRUNCATE TABLE payments CASCADE');
    await client.query('TRUNCATE TABLE audits CASCADE');
    await client.query('TRUNCATE TABLE contracts CASCADE');
    await client.query('TRUNCATE TABLE referrals CASCADE');
    await client.query('DELETE FROM users WHERE role != $1', ['superadmin']);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function truncateTable(tableName: string) {
  await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
}
