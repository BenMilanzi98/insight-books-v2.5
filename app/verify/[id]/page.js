import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Verify Transaction – InsightBooks' };

export default async function VerifyPage({ params }) {
  const { id } = await params;

  // Try sale first, then invoice
  let record = await prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      saleNumber: true,
      saleDate: true,
      total: true,
      status: true,
      tenant: { select: { name: true, tpin: true } },
    },
  }).catch(() => null);

  let type = 'Sale';

  if (!record) {
    record = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        total: true,
        status: true,
        tenant: { select: { name: true, tpin: true } },
      },
    }).catch(() => null);
    type = 'Invoice';
  }

  if (!record) return notFound();

  const number = record.saleNumber || record.invoiceNumber;
  const date = record.saleDate || record.issueDate;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Verified</h1>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Type</span>
            <span className="font-medium">{type}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Number</span>
            <span className="font-medium">{number}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{new Date(date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Total</span>
            <span className="font-medium">MK {Number(record.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Status</span>
            <span className="font-medium">{record.status}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">Business</span>
            <span className="font-medium">{record.tenant?.name || 'N/A'}</span>
          </div>
          {record.tenant?.tpin && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">TPIN</span>
              <span className="font-medium">{record.tenant.tpin}</span>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-center text-gray-400">
          Verified by InsightBooks EIS
        </p>
      </div>
    </div>
  );
}
