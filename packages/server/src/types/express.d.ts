// packages/server/src/types/express.d.ts
// Global Express Request augmentation
// Authoritative actor context contract
// Loaded automatically by TypeScript

import 'express-serve-static-core';

export interface ActorContext {
  id: string;
  roles: readonly string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    actor?: ActorContext;
  }
}
