import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

/**
 * Test environment MUST override OS-level PG variables.
 * This is REQUIRED on Windows where PGUSER/PGPORT are often predefined.
 */
dotenv.config({
  path: '.env.test',
  override: true,
});

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
});
