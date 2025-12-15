import request from 'supertest';
import { app } from '../server/app';
import { storage } from '../server/storage';

export async function loginAsSuperAdmin() {
  await storage.ensureSuperAdmin();
  
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  
  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set for tests');
  }
  
  const agent = request.agent(app);
  
  const loginRes = await agent
    .post('/api/auth/login')
    .send({ email, password });
  
  if (loginRes.status !== 200) {
    throw new Error(`Failed to login as superadmin: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }
  
  return agent;
}

export async function createTestUser(email: string, password: string) {
  const existingUser = await storage.getUserByEmail(email);
  if (existingUser) {
    return existingUser;
  }
  
  const user = await storage.createUser({
    name: 'Test User',
    email,
    password,
  });
  
  return user;
}

export async function loginAsUser(email: string, password: string) {
  const agent = request.agent(app);
  
  const loginRes = await agent
    .post('/api/auth/login')
    .send({ email, password });
  
  if (loginRes.status !== 200) {
    throw new Error(`Failed to login as user: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }
  
  return agent;
}
