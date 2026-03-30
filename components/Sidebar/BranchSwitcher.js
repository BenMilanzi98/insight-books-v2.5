'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, Check, MapPin, X } from 'lucide-react';

export default function BranchSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Only show active branches so a tenant can switch to selectable locations.
        // `includeInactive=false` maps to `isActive: true` in the backend.
        const [branchesRes, currentRes] = await Promise.all([
          fetch('/api/branches?includeInactive=false', { cache: 'no-store' }),
          fetch('/api/branches/switch', { cache: 'no-store' })
        ]);
        
        if (branchesRes.ok) {
          const branchesData = await branchesRes.json();
          setBranches(branchesData.branches || []);
        }
        
        if (currentRes.ok) {
          const currentData = await currentRes.json();
          setCurrentBranchId(currentData.branchId || null);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleBranchSelect = async (branchId) => {
    if (branchId === currentBranchId) {
      setIsOpen(false);
      return;
    }
    
    try {
      const res = await fetch('/api/branches/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId })
      });
      
      if (res.ok) {
        setCurrentBranchId(branchId);
        setIsOpen(false);
        // Notify other tabs/windows to refresh branch context without polling
        try {
          localStorage.setItem('insightbooks:branch-switch', String(Date.now()));
        } catch {}
        // Reload page to apply branch context to all operations
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching branch:', error);
    }
  };

  const handleClearBranch = async () => {
    try {
      const res = await fetch('/api/branches/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: null })
      });
      
      if (res.ok) {
        setCurrentBranchId(null);
        setIsOpen(false);
        // Notify other tabs/windows to refresh branch context without polling
        try {
          localStorage.setItem('insightbooks:branch-switch', String(Date.now()));
        } catch {}
        window.location.reload();
      }
    } catch (error) {
      console.error('Error clearing branch:', error);
    }
  };

  const currentBranch = branches.find(b => b.id === currentBranchId);
  // API returns a virtual placeholder row when there are no real branch records.
  // We don't render those as selectable options.
  const selectableBranches = branches.filter((b) => !b.isVirtual);

  if (loading) {
    return (
      <div className="relative inline-block w-full">
        <div className="w-full flex items-center justify-between rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 animate-pulse">
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            <span className="truncate">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Don't show branch switcher if no branches exist
  if (branches.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={16} className="flex-shrink-0" />
          <span className="truncate text-sm">
            {currentBranch 
              ? `${currentBranch.name}${currentBranch.code ? ` (${currentBranch.code})` : ''}`
              : 'All Branches'}
          </span>
        </div>
        <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-sm border border-gray-200 max-h-60 overflow-auto">
          <div className="py-1">
            {/* "All Branches" option */}
            <button
              onClick={() => handleClearBranch()}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                !currentBranchId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin size={14} />
                <span>All Branches</span>
              </div>
              {!currentBranchId && <Check size={14} />}
            </button>
            
            <div className="border-t border-gray-200 my-1"></div>
            
            {/* Branch options */}
            {selectableBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleBranchSelect(branch.id)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                  currentBranchId === branch.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={14} className="flex-shrink-0" />
                  <span className="truncate">
                    {branch.name}
                    {branch.code && <span className="text-gray-500"> ({branch.code})</span>}
                  </span>
                </div>
                {currentBranchId === branch.id && <Check size={14} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

