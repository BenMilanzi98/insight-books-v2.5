// app/journal-entries/new/page.js
import JournalEntryForm from '@/components/JournalEntryForm';

export const metadata = {
  title: 'New Journal Entry',
  description: 'Create a new journal entry in the general ledger',
};

export default function NewJournalEntryPage() {
  return <JournalEntryForm />;
}