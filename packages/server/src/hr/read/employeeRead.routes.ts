// packages/server/src/hr/read/employeeRead.routes.ts

import { Router } from 'express';
import { EmployeeReadController } from './EmployeeReadController';

export function createEmployeeReadRoutes(
  controller: EmployeeReadController
): Router {
  const router = Router();

  router.get('/employees', controller.listEmployees);
  router.get('/employees/:employeeId', controller.getEmployeeMaster);
  router.get(
    '/employees/:employeeId/events',
    controller.listEmployeeEvents
  );
  router.get(
    '/employees/:employeeId/details',
    controller.getEmployeeDetails
  );
  router.get(
    '/employees/:employeeId/state',
    controller.getEmployeeCurrentState
  );

  return router;
}
