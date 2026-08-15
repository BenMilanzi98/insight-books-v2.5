'use client';

import AppShell from '@/components/shell/AppShell';
import { I18nProvider } from '@/components/i18n/I18nProvider';

/** Thin entry — shell implementation lives in components/shell/AppShell.jsx */
export default function RootLayoutClient({ children, initialLocale = 'en' }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <AppShell>{children}</AppShell>
    </I18nProvider>
  );
}
