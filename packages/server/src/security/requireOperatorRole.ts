// packages/server/src/security/requireOperatorRole.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Operator-only guard.
 * Relies on actorInjectionMiddleware.
 * FAIL-CLOSED by default.
 */
export function requireOperatorRole(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const actor = (req as any).actor;

  if (!actor || actor.role !== 'OPERATOR') {
    return res.status(403).json({ error: 'Operator role required' });
  }

  next();
}
