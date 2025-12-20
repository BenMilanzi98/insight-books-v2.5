"use client";

// app/journal-entries/[id]/page.js
import { useParams } from 'next/navigation';
import JournalEntryDetail from '@/components/JournalEntryDetail';

export default function JournalEntryDetailPage() {
  const params = useParams();
  
  return <JournalEntryDetail id={params.id} />;
}