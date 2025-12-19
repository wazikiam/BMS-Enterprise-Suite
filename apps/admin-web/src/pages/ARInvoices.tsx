// apps/admin-web/src/pages/ARInvoices.tsx
// ACCOUNTS RECEIVABLE — READ ONLY
//
// Governance:
// - Read-only
// - No mutations
// - Actor headers required
// - Deterministic rendering

import { useEffect, useState } from 'react';

type ARInvoice = {
  invoiceId: string;
  customerId?: string;
  totalAmount: string;
  outstandingAmount: string;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string;
};

export default function ARInvoicesPage() {
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/ar/invoices', {
          headers: {
            'X-Actor-Id': 'admin',
            'X-Actor-Roles': 'ADMIN',
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        setInvoices(data.invoices ?? []);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load AR invoices');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading Accounts Receivable…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: 'red' }}>
        Failed to load AR invoices: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Accounts Receivable</h2>

      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 16,
          }}
        >
          <thead>
            <tr>
              <th align="left">Invoice</th>
              <th align="left">Customer</th>
              <th align="right">Total</th>
              <th align="right">Outstanding</th>
              <th align="left">Currency</th>
              <th align="left">Status</th>
              <th align="left">Issued</th>
              <th align="left">Due</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.invoiceId}>
                <td>{inv.invoiceId}</td>
                <td>{inv.customerId ?? '-'}</td>
                <td align="right">{inv.totalAmount}</td>
                <td align="right">{inv.outstandingAmount}</td>
                <td>{inv.currency}</td>
                <td>{inv.status}</td>
                <td>{new Date(inv.issuedAt).toLocaleDateString()}</td>
                <td>
                  {inv.dueDate
                    ? new Date(inv.dueDate).toLocaleDateString()
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
