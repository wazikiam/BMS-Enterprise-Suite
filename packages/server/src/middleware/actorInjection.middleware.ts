// packages/server/src/middleware/actorInjection.middleware.ts
// CANONICAL ACTOR INJECTION — SYSTEM WIDE
//
// This is the single source of truth for actor identity.
// All downstream systems rely on { actorId, roles }.

import { Request, Response, NextFunction } from 'express';

export function actorInjectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const actorId =
    req.header('x-actor-id') ??
    req.header('X-Actor-Id');

  const rolesHeader =
    req.header('x-actor-roles') ??
    req.header('X-Actor-Roles');

  if (!actorId || !rolesHeader) {
    return res.status(403).json({
      error: 'Forbidden: actor identity required',
    });
  }

  const roles = rolesHeader
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  if (roles.length === 0) {
    return res.status(403).json({
      error: 'Forbidden: actor roles required',
    });
  }

  // ✅ CANONICAL SHAPE (DO NOT CHANGE)
  (req as any).actor = {
    actorId,
    roles,
  };

  next();
}
