"use client";
import { tt } from '@/lib/i18n/runtime';

// app/journal-entries/edit/[id]/page.js
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import JournalEntryForm from '@/components/JournalEntryForm';
import PermissionGuard from '@/components/PermissionGuard';

export default function EditJournalEntryPage() {
  const params = useParams();
  const [journalEntry, setJournalEntry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchJournalEntry = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/journal-entries/${params.id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch journal entry: ${response.statusText}`);
        }
        
        const data = await response.json();
        setJournalEntry(data);
      } catch (err) {
        console.error("Error fetching journal entry:", err);
        setError(err.message || "Failed to load journal entry");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (params.id) {
      fetchJournalEntry();
    }
  }, [params.id]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-auto max-w-2xl my-8">
        <p className="font-bold">{tt('Error:')}</p>
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <PermissionGuard permission="journalEntries.view">
      <JournalEntryForm existingEntry={journalEntry} />
    </PermissionGuard>
  );
}