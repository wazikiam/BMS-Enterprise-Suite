// apps/admin-web/src/api/arInvoices.ts
// READ-ONLY AR Invoices API client
// Governance-safe: actor identity is required for all reads

export type ARInvoice = {
  invoiceId: string;
  customerId: string;
  totalAmount: string;
  currency: string;
  issuedAt: string;
  status: string;
};

const API_BASE = 'http://localhost:3001/api/ar';

function actorHeaders(): HeadersInit {
  return {
    'X-Actor-Id': 'admin',
    'X-Actor-Roles': 'ADMIN',
  };
}

export async function fetchARInvoices(): Promise<ARInvoice[]> {
  const res = await fetch(`${API_BASE}/invoices`, {
    headers: actorHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load AR invoices (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.invoices ?? [];
}
