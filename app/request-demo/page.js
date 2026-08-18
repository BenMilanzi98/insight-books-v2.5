import { tt } from '@/lib/i18n/runtime';
import PublicLeadCaptureForm from '@/components/crm/PublicLeadCaptureForm';

export const metadata = {
  title: 'Request a Demo | InsightBooks',
  description: 'Request a personalized InsightBooks demo.',
};

export default function RequestDemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PublicLeadCaptureForm
        title={tt('Request a demo')}
        subtitle={tt('Tell us about your business and we will schedule a walkthrough.')}
        apiPath="/api/request-demo"
        submitLabel="Request demo"
        showPreferredTime
      />
    </main>
  );
}
