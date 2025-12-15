import { describe, it, expect, beforeEach } from 'vitest';
import { loginAsSuperAdmin } from './authHelper';
import { resetTestDatabase } from './dbReset';

describe('Admin Settings API', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should update settings and mask secrets on retrieval', async () => {
    const agent = await loginAsSuperAdmin();

    const updateRes = await agent
      .put('/api/admin/settings')
      .send({
        updates: {
          pdn_consent_document_version: '1.0-test',
          robokassa_password1: 'secret1',
          robokassa_password2: 'secret2',
          yookassa_secret_key: 'yoo-secret-key',
        }
      });

    expect(updateRes.status).toBe(200);

    const getRes = await agent.get('/api/admin/settings');
    
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    
    const findSetting = (key: string) => getRes.body.find((s: any) => s.key === key);
    expect(findSetting('pdn_consent_document_version')?.value).toBe('1.0-test');
    expect(findSetting('robokassa_password1')?.value).toBe('***');
    expect(findSetting('robokassa_password2')?.value).toBe('***');
    expect(findSetting('yookassa_secret_key')?.value).toBe('***');
  });

  it('should preserve existing secrets when updating with masked values', async () => {
    const agent = await loginAsSuperAdmin();

    await agent
      .put('/api/admin/settings')
      .send({
        updates: {
          robokassa_password1: 'original-secret',
        }
      });

    await agent
      .put('/api/admin/settings')
      .send({
        updates: {
          pdn_consent_document_version: '2.0-updated',
        }
      });

    const getRes = await agent.get('/api/admin/settings');
    
    expect(getRes.status).toBe(200);
    const findSetting = (key: string) => getRes.body.find((s: any) => s.key === key);
    expect(findSetting('pdn_consent_document_version')?.value).toBe('2.0-updated');
    expect(findSetting('robokassa_password1')?.value).toBe('***');
  });
});
