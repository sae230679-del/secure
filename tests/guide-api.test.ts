import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';
import { loginAsSuperAdmin, createTestUser, loginAsUser } from './authHelper';
import { resetTestDatabase } from './dbReset';
import { storage } from '../server/storage';

describe('Guide API', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await storage.seedGuideSections();
  });

  describe('GET /api/guide/home', () => {
    it('should return sections sorted by sortOrder ascending', async () => {
      const res = await request(app).get('/api/guide/home');
      
      expect(res.status).toBe(200);
      expect(res.body.sections).toBeDefined();
      expect(Array.isArray(res.body.sections)).toBe(true);
      
      const sortOrders = res.body.sections.map((s: any) => s.sortOrder);
      const sortedOrders = [...sortOrders].sort((a, b) => a - b);
      expect(sortOrders).toEqual(sortedOrders);
    });

    it('should exclude sections where isVisible=false', async () => {
      const agent = await loginAsSuperAdmin();
      
      const sectionsRes = await agent.get('/api/admin/guide/sections');
      const firstSection = sectionsRes.body[0];
      
      await agent
        .patch(`/api/admin/guide/sections/${firstSection.id}`)
        .send({ isVisible: false });

      const homeRes = await request(app).get('/api/guide/home');
      
      expect(homeRes.status).toBe(200);
      const slugs = homeRes.body.sections.map((s: any) => s.slug);
      expect(slugs).not.toContain(firstSection.slug);
    });

    it('should include correct totals for topics and articles', async () => {
      const res = await request(app).get('/api/guide/home');
      
      expect(res.status).toBe(200);
      expect(res.body.totals).toBeDefined();
      expect(typeof res.body.totals.topics).toBe('number');
      expect(typeof res.body.totals.articles).toBe('number');
    });
  });

  describe('GET /api/guide/search', () => {
    it('should exclude results from invisible sections', async () => {
      const agent = await loginAsSuperAdmin();
      
      const sectionsRes = await agent.get('/api/admin/guide/sections');
      const documentsSection = sectionsRes.body.find((s: any) => s.slug === 'documents');
      
      await agent
        .patch(`/api/admin/guide/sections/${documentsSection.id}`)
        .send({ isVisible: false });

      const searchRes = await request(app).get('/api/guide/search?q=Документы');
      
      expect(searchRes.status).toBe(200);
      const sectionSlugs = searchRes.body.sections.map((s: any) => s.slug);
      expect(sectionSlugs).not.toContain('documents');
    });

    it('should return empty results for short queries', async () => {
      const res = await request(app).get('/api/guide/search?q=a');
      
      expect(res.status).toBe(200);
      expect(res.body.sections).toEqual([]);
      expect(res.body.topics).toEqual([]);
      expect(res.body.articles).toEqual([]);
    });
  });

  describe('PUT /api/admin/guide/sections/reorder', () => {
    it('should return 401 for unauthorized requests', async () => {
      const res = await request(app)
        .put('/api/admin/guide/sections/reorder')
        .send({ items: [] });
      
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-superadmin users', async () => {
      await createTestUser('regular@test.com', 'password123');
      const userAgent = await loginAsUser('regular@test.com', 'password123');
      
      const res = await userAgent
        .put('/api/admin/guide/sections/reorder')
        .send({ items: [] });
      
      expect(res.status).toBe(403);
    });

    it('should reorder sections for superadmin', async () => {
      const agent = await loginAsSuperAdmin();
      
      const sectionsRes = await agent.get('/api/admin/guide/sections');
      const sections = sectionsRes.body;
      
      const reversedItems = sections
        .sort((a: any, b: any) => b.sortOrder - a.sortOrder)
        .map((s: any, i: number) => ({ id: s.id, sortOrder: (i + 1) * 10 }));

      const reorderRes = await agent
        .put('/api/admin/guide/sections/reorder')
        .send({ items: reversedItems });
      
      expect(reorderRes.status).toBe(200);
      
      const homeRes = await request(app).get('/api/guide/home');
      const newOrder = homeRes.body.sections.map((s: any) => s.slug);
      const originalOrder = sections.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((s: any) => s.slug);
      
      expect(newOrder).not.toEqual(originalOrder);
    });

    it('should reject invalid items array length', async () => {
      const agent = await loginAsSuperAdmin();
      
      const res = await agent
        .put('/api/admin/guide/sections/reorder')
        .send({ items: [{ id: 1, sortOrder: 10 }] });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject duplicate ids', async () => {
      const agent = await loginAsSuperAdmin();
      
      const items = Array(9).fill({ id: 1, sortOrder: 10 });
      
      const res = await agent
        .put('/api/admin/guide/sections/reorder')
        .send({ items });
      
      expect(res.status).toBe(400);
    });

    it('should reject invalid sortOrder type', async () => {
      const agent = await loginAsSuperAdmin();
      
      const sectionsRes = await agent.get('/api/admin/guide/sections');
      const sections = sectionsRes.body;
      
      const items = sections.map((s: any, i: number) => ({ 
        id: s.id, 
        sortOrder: i === 0 ? "invalid" : (i + 1) * 10 
      }));

      const res = await agent
        .put('/api/admin/guide/sections/reorder')
        .send({ items });
      
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/guide/sections/:id', () => {
    it('should toggle visibility and affect /api/guide/home', async () => {
      const agent = await loginAsSuperAdmin();
      
      const sectionsRes = await agent.get('/api/admin/guide/sections');
      const section = sectionsRes.body[0];
      
      const patchRes = await agent
        .patch(`/api/admin/guide/sections/${section.id}`)
        .send({ isVisible: false });
      
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.isVisible).toBe(false);
      
      const homeRes = await request(app).get('/api/guide/home');
      const slugs = homeRes.body.sections.map((s: any) => s.slug);
      expect(slugs).not.toContain(section.slug);
    });

    it('should return 401 for unauthorized requests', async () => {
      const res = await request(app)
        .patch('/api/admin/guide/sections/1')
        .send({ isVisible: false });
      
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/guide/sections', () => {
    it('should return all sections with counts for superadmin', async () => {
      const agent = await loginAsSuperAdmin();
      
      const res = await agent.get('/api/admin/guide/sections');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(9);
      
      const section = res.body[0];
      expect(section.id).toBeDefined();
      expect(section.slug).toBeDefined();
      expect(section.title).toBeDefined();
      expect(typeof section.isVisible).toBe('boolean');
      expect(typeof section.sortOrder).toBe('number');
      expect(typeof section.topicsCount).toBe('number');
      expect(typeof section.articlesCount).toBe('number');
    });

    it('should return 401 for unauthorized requests', async () => {
      const res = await request(app).get('/api/admin/guide/sections');
      expect(res.status).toBe(401);
    });
  });
});
