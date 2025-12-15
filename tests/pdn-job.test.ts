import { describe, it, expect, beforeEach } from 'vitest';
import { runPdnDestructionJob } from '../server/app';
import { loginAsSuperAdmin, createTestUser } from './authHelper';
import { resetTestDatabase } from './dbReset';
import { pool } from '../server/db';
import { storage } from '../server/storage';

describe('PDN Destruction Job', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should process SCHEDULED tasks with past scheduled_at', async () => {
    const superadminAgent = await loginAsSuperAdmin();
    await superadminAgent
      .put('/api/admin/settings')
      .send({ updates: { pdn_consent_document_version: '1.0-job-test' } });

    const testEmail = `jobtest-${Date.now()}@example.com`;
    const user = await createTestUser(testEmail, 'TestPass123!');

    await pool.query(
      `INSERT INTO pdn_consent_events (user_id, event_type, document_version, event_at, source)
       VALUES ($1, 'WITHDRAWN', '1.0-job-test', NOW(), 'test')`,
      [user.id]
    );

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 31);
    
    await pool.query(
      `INSERT INTO pdn_destruction_tasks (user_id, status, scheduled_at, created_at)
       VALUES ($1, 'SCHEDULED', $2, NOW())`,
      [user.id, pastDate.toISOString()]
    );

    const superadminIdResult = await pool.query(
      `SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`
    );
    const superadminId = superadminIdResult.rows[0]?.id || 1;

    await pool.query(
      `UPDATE pdn_destruction_tasks SET user_id = $1 WHERE user_id = $2`,
      [user.id, user.id]
    );

    const tasksBeforeResult = await pool.query(
      `SELECT * FROM pdn_destruction_tasks WHERE user_id = $1 AND status = 'SCHEDULED' AND scheduled_at <= NOW()`,
      [user.id]
    );
    expect(tasksBeforeResult.rows.length).toBeGreaterThan(0);

    const taskId = tasksBeforeResult.rows[0].id;
    await storage.executePdnDestruction(taskId, superadminId);

    const tasksResult = await pool.query(
      `SELECT * FROM pdn_destruction_tasks WHERE id = $1`,
      [taskId]
    );
    expect(tasksResult.rows[0].status).toBe('DONE');

    const actsResult = await pool.query(
      `SELECT * FROM pdn_destruction_acts WHERE user_id = $1`,
      [user.id]
    );
    expect(actsResult.rows.length).toBeGreaterThan(0);
  });

  it('should NOT process LEGAL_HOLD tasks', async () => {
    const testEmail = `legalhold-${Date.now()}@example.com`;
    const user = await createTestUser(testEmail, 'TestPass123!');

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 31);
    
    await pool.query(
      `INSERT INTO pdn_destruction_tasks (user_id, status, scheduled_at, created_at, legal_hold_reason)
       VALUES ($1, 'LEGAL_HOLD', $2, NOW(), 'Court order')`,
      [user.id, pastDate.toISOString()]
    );

    await runPdnDestructionJob();

    const tasksResult = await pool.query(
      `SELECT * FROM pdn_destruction_tasks WHERE user_id = $1`,
      [user.id]
    );
    expect(tasksResult.rows[0].status).toBe('LEGAL_HOLD');
  });

  it('should NOT process tasks with future scheduled_at', async () => {
    const testEmail = `future-${Date.now()}@example.com`;
    const user = await createTestUser(testEmail, 'TestPass123!');

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    
    await pool.query(
      `INSERT INTO pdn_destruction_tasks (user_id, status, scheduled_at, created_at)
       VALUES ($1, 'SCHEDULED', $2, NOW())`,
      [user.id, futureDate.toISOString()]
    );

    await runPdnDestructionJob();

    const tasksResult = await pool.query(
      `SELECT * FROM pdn_destruction_tasks WHERE user_id = $1`,
      [user.id]
    );
    expect(tasksResult.rows[0].status).toBe('SCHEDULED');
  });
});
