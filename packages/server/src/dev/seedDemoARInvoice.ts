// packages/server/src/dev/seedDemoARInvoice.ts
// DEV-ONLY — deterministic demo AR invoice seed
// Produces a VALID, AUDIT-COMPLETE event stream

import { getPostgresPool } from '../db/PostgresClient';
import { randomUUID } from 'crypto';

async function seed() {
  const pool = getPostgresPool();

  const invoiceId = randomUUID();
  const now = new Date();

  //1️⃣ CREATE (DRAFT)
  await pool.query(
    `
    INSERT INTO ar_invoice_events (
      event_id,
      invoice_id,
      event_type,
      actor_id,
      actor_roles,
      reason,
      event_time,
      payload
    )
    VALUES ($1, $2, 'AR_INVOICE_CREATED', 'system', ARRAY['SYSTEM'], $3, now(), $4::jsonb)
    `,
    [
      randomUUID(),
      invoiceId,
      'Initial invoice creation (demo seed)',
      JSON.stringify({
        customerId: 'CUST-001',
        currency: 'USD',
      }),
    ]
  );

  // 2️⃣ ISSUE
  await pool.query(
    `
    INSERT INTO ar_invoice_events (
      event_id,
      invoice_id,
      event_type,
      actor_id,
      actor_roles,
      reason,
      event_time,
      payload
    )
    VALUES ($1, $2, 'AR_INVOICE_ISSUED', 'system', ARRAY['SYSTEM'], $3, now(), $4::jsonb)
    `,
    [
      randomUUID(),
      invoiceId,
      'Invoice issued to customer (demo seed)',
      JSON.stringify({
        totalAmount: '1000.00',
        issuedAt: now.toISOString(),
        dueDate: new Date(now.getTime() + 30 * 86400000).toISOString(),
      }),
    ]
  );

  console.log('✅ Demo AR invoice created and issued');
  console.log('   invoiceId:', invoiceId);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Failed to seed demo AR invoice');
  console.error(err);
  process.exit(1);
});
