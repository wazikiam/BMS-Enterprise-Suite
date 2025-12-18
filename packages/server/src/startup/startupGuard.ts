// packages/server/src/startup/startupGuard.ts

/**
 * StartupGuard
 *
 * Enforces mandatory governance enforcement at process boot.
 * If any critical guard is missing, the server MUST NOT start.
 *
 * This prevents unsafe deployments.
 */

export class StartupGuard {
  static enforce(): void {
    const requiredModules = [
      '../guards/snapshotEligibility.guard',
      '../guards/snapshotRetention.guard',
      '../guards/exportTruth.guard',
    ];

    const missing: string[] = [];

    for (const modulePath of requiredModules) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require(modulePath);
      } catch {
        missing.push(modulePath);
      }
    }

    if (missing.length > 0) {
      // Hard fail
      // eslint-disable-next-line no-console
      console.error('❌ Startup blocked. Missing mandatory governance guards:');
      for (const m of missing) {
        // eslint-disable-next-line no-console
        console.error(`   - ${m}`);
      }

      process.exit(1);
    }
  }
}
