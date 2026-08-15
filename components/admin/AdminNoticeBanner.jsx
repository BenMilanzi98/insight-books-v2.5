'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Info, X } from 'lucide-react';

const NOTICES = {
  'coa-removed':
    'System Chart of Accounts is no longer available in System Administration. Tenant Chart of Accounts remains under the tenant accounting workspace.',
};

export default function AdminNoticeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = searchParams?.get('notice');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [notice]);

  if (!notice || dismissed || !NOTICES[notice]) return null;

  const dismiss = () => {
    setDismissed(true);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('notice');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900"
      role="status"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">{NOTICES[notice]}</p>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-1 text-sky-700 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        aria-label={tt('Dismiss notice')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
