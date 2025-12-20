// app/accounting/general-ledger/page.js 
import GeneralLedger from '@/components/GeneralLedger';
import PermissionGuard from '@/components/PermissionGuard';

export const metadata = {
  title: 'General Ledger',
  description: 'View and manage the general ledger journal entries',
};

export default function GeneralLedgerPage() {
  return <PermissionGuard permission="generalLedger.view"><GeneralLedger /></PermissionGuard>;
}