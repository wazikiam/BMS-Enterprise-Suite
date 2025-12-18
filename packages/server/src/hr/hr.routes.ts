// packages/server/src/hr/hr.routes.ts

import { Router } from 'express';

// ─────────────────────────────────────────────────────────────
// HR Phase 1 (WRITE + OPERATIONAL READS) — PRESERVED
// ─────────────────────────────────────────────────────────────

import { HrEmployeeRepository } from './HrEmployeeRepository';
import { HrEmployeeService } from './HrEmployeeService';
import { HrEmployeeController } from './HrEmployeeController';

// ─────────────────────────────────────────────────────────────
// HR Phase 2 (READ-ONLY, AUDIT-GRADE)
// ─────────────────────────────────────────────────────────────

import { EmployeeReadService } from './read/EmployeeReadService';
import { EmployeeReadController } from './read/EmployeeReadController';
import { createEmployeeReadRoutes } from './read/employeeRead.routes';

// ─────────────────────────────────────────────────────────────
// Infrastructure
// ─────────────────────────────────────────────────────────────

import { getPostgresPool } from '../db/PostgresClient';

const router = Router();
const pool = getPostgresPool();

// ─────────────────────────────────────────────────────────────
// Phase 1 wiring (unchanged behavior)
// ─────────────────────────────────────────────────────────────

const phase1Repo = new HrEmployeeRepository(pool);
const phase1Service = new HrEmployeeService(phase1Repo);
const phase1Controller = new HrEmployeeController(
  phase1Service,
  phase1Repo
);

/**
 * Create employee (HR_ADMIN only)
 */
router.post('/employees', (req, res) =>
  phase1Controller.create(req, res)
);

/**
 * List employees (operational read)
 */
router.get('/employees', (req, res) =>
  phase1Controller.list(req, res)
);

/**
 * Get employee by id (operational read)
 */
router.get('/employees/:employeeId', (req, res) =>
  phase1Controller.getById(req, res)
);

// ─────────────────────────────────────────────────────────────
// Phase 2 wiring (audit-grade, read-only)
// ─────────────────────────────────────────────────────────────

const phase2ReadService = new EmployeeReadService(pool);
const phase2ReadController = new EmployeeReadController(
  phase2ReadService
);

/**
 * Audit-grade HR reads
 *
 * These routes DO NOT overlap Phase 1 semantics.
 */
router.use(
  '/audit',
  createEmployeeReadRoutes(phase2ReadController)
);

export default router;
