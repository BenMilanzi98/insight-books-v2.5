// app/journal-entries/new/page.js
import JournalEntryForm from '@/components/JournalEntryForm';
import PermissionGuard from '@/components/PermissionGuard';

export const metadata = {
  title: 'New Journal Entry',
  description: 'Create a new journal entry in the general ledger',
};

export default function NewJournalEntryPage() {
  return (
    <PermissionGuard permission="journalEntries.view">
      <JournalEntryForm />
    </PermissionGuard>
  );
}