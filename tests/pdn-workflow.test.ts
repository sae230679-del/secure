import { describe, it, expect, beforeEach } from 'vitest';
import { loginAsSuperAdmin, createTestUser, loginAsUser } from './authHelper';
import { resetTestDatabase } from './dbReset';
import { pool } from '../server/db';

describe('PDN Withdrawal Workflow', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should create destruction task on PDN withdrawal', async () => {
    const superadminAgent = await loginAsSuperAdmin();
    await superadminAgent
      .put('/api/admin/settings')
      .send({ updates: { pdn_consent_document_version: '1.0-test' } });

    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPass123!';
    await createTestUser(testEmail, testPassword);
    
    const userAgent = await loginAsUser(testEmail, testPassword);

    const withdrawRes = await userAgent.post('/api/me/withdraw-pdn-consent');
    expect(withdrawRes.status).toBe(200);

    const eventsResult = await pool.query(
      `SELECT * FROM pdn_consent_events WHERE event_type = 'WITHDRAWN' ORDER BY id DESC LIMIT 1`
    );
    expect(eventsResult.rows.length).toBeGreaterThan(0);
    const withdrawalEvent = eventsResult.rows[0];
    expect(withdrawalEvent.event_type).toBe('WITHDRAWN');

    const tasksResult = await pool.query(
      `SELECT * FROM pdn_destruction_tasks WHERE user_id = $1`,
      [withdrawalEvent.user_id]
    );
    expect(tasksResult.rows.length).toBeGreaterThan(0);
    const task = tasksResult.rows[0];
    expect(task.status).toBe('SCHEDULED');

    const scheduledAt = new Date(task.scheduled_at);
    const now = new Date();
    const diffDays = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(28);
    expect(diffDays).toBeLessThan(32);
  });
});
