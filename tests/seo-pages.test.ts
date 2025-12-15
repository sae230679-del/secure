import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';
import { loginAsSuperAdmin } from './authHelper';
import { resetTestDatabase } from './dbReset';

describe('SEO Pages CRUD', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('should create, read, update, and delete SEO pages', async () => {
    const agent = await loginAsSuperAdmin();

    const createRes = await agent
      .post('/api/admin/seo-pages')
      .send({
        slug: 'test-page',
        title: 'Test Page Title',
        h1: 'Test H1 Header',
        description: 'Test description',
        content: '<h1>Test Content</h1>',
        isActive: true,
      });

    expect([200, 201]).toContain(createRes.status);
    expect(createRes.body.slug).toBe('test-page');
    const pageId = createRes.body.id;

    const listRes = await agent.get('/api/admin/seo-pages');
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((p: any) => p.slug === 'test-page')).toBe(true);

    const updateRes = await agent
      .put(`/api/admin/seo-pages/${pageId}`)
      .send({
        title: 'Updated Title',
        description: 'Updated description',
        content: '<h1>Updated Content</h1>',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('Updated Title');

    const publicRes = await request(app).get('/api/public/seo/test-page');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.title).toBe('Updated Title');

    const deleteRes = await agent.delete(`/api/admin/seo-pages/${pageId}`);
    expect(deleteRes.status).toBe(200);

    const publicAfterDelete = await request(app).get('/api/public/seo/test-page');
    expect([404, 410]).toContain(publicAfterDelete.status);
  });

  it('should not return inactive SEO pages publicly', async () => {
    const agent = await loginAsSuperAdmin();

    const createRes = await agent
      .post('/api/admin/seo-pages')
      .send({
        slug: 'inactive-page',
        title: 'Inactive Page',
        h1: 'Inactive H1',
        description: 'This page is inactive',
        content: '<h1>Inactive</h1>',
        isActive: false,
      });

    expect([200, 201]).toContain(createRes.status);

    const publicRes = await request(app).get('/api/public/seo/inactive-page');
    expect([404, 410]).toContain(publicRes.status);
  });
});
