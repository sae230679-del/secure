import { beforeAll, afterAll } from 'vitest';
import { initializeApp } from '../server/app';
import { pool } from '../server/db';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await initializeApp();
});

afterAll(async () => {
  await pool.end();
});
