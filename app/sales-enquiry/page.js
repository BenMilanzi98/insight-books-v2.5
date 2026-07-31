import PublicLeadCaptureForm from '@/components/crm/PublicLeadCaptureForm';

export const metadata = {
  title: 'Sales Enquiry | InsightBooks',
  description: 'Contact InsightBooks sales.',
};

export default function SalesEnquiryPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PublicLeadCaptureForm
        title="Sales enquiry"
        subtitle="Ask about plans, pricing, or onboarding for your organisation."
        apiPath="/api/sales-enquiry"
        submitLabel="Send enquiry"
      />
    </main>
  );
}
