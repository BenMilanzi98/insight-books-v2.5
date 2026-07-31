import PublicLeadCaptureForm from '@/components/crm/PublicLeadCaptureForm';

export const metadata = {
  title: 'Start a Trial | InsightBooks',
  description: 'Enquire about starting an InsightBooks trial.',
};

export default function StartTrialPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PublicLeadCaptureForm
        title="Start a trial"
        subtitle="Share your details and our team will follow up about trial access."
        apiPath="/api/start-trial"
        submitLabel="Request trial"
      />
    </main>
  );
}
