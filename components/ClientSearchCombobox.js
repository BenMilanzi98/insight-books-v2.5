"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X, Plus, Loader } from "lucide-react";

const ClientSearchCombobox = ({
  clients = [],
  value = "",
  onChange,
  onAddNew,
  placeholder = tt('Search or select a client...'),
  error = null,
  disabled = false,
  isLoading = false,
  className = "",
  showAddNew = true,
  allowEmpty = false,
  emptyLabel = "Walk-in Customer"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClients, setFilteredClients] = useState(clients);
  const comboboxRef = useRef(null);
  const inputRef = useRef(null);

  // Get selected client name
  const selectedClient = clients.find(c => c.id === value);
  const displayValue = selectedClient ? selectedClient.name : searchQuery;

  // Filter clients based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClients(clients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter(
        client =>
          client.name?.toLowerCase().includes(query) ||
          client.email?.toLowerCase().includes(query) ||
          client.phone?.toLowerCase().includes(query) ||
          client.contactPerson?.toLowerCase().includes(query)
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  // Update search query when value changes externally
  useEffect(() => {
    if (value && selectedClient) {
      setSearchQuery(selectedClient.name);
    } else if (!value) {
      setSearchQuery("");
    }
  }, [value, selectedClient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    setIsOpen(true);
    
    // Clear selection if search doesn't match selected client
    if (value && selectedClient && !selectedClient.name.toLowerCase().includes(newQuery.toLowerCase())) {
      onChange({ target: { name: "clientId", value: "" } });
    }
  };

  // Handle client selection
  const handleSelectClient = (clientId) => {
    onChange({ target: { name: "clientId", value: clientId } });
    const client = clients.find(c => c.id === clientId);
    setSearchQuery(client ? client.name : "");
    setIsOpen(false);
  };

  // Handle add new client
  const handleAddNew = () => {
    setIsOpen(false);
    if (onAddNew) {
      onAddNew();
    }
  };

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Handle clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    setSearchQuery("");
    onChange({ target: { name: "clientId", value: "" } });
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div ref={comboboxRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`w-full pl-10 pr-20 py-2 border rounded-md ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled || isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isLoading ? (
            <Loader className="h-4 w-4 animate-spin text-gray-500" />
          ) : (
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {allowEmpty && (
            <div
              onClick={() => handleSelectClient("")}
              className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                !value ? 'bg-blue-50' : ''
              }`}
            >
              <div className="text-sm text-gray-700">{emptyLabel}</div>
            </div>
          )}
          
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client.id)}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                  value === client.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-sm font-medium text-gray-900">{client.name}</div>
                {(client.email || client.phone) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {client.email && <span>{client.email}</span>}
                    {client.email && client.phone && <span> • </span>}
                    {client.phone && <span>{client.phone}</span>}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
              {searchQuery.trim() ? "No clients found" : "No clients available"}
            </div>
          )}
          
          {showAddNew && (
            <>
              <div className="border-t border-gray-200 my-1"></div>
              <div
                onClick={handleAddNew}
                className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">{tt('Add New Client')}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
};

export default ClientSearchCombobox;

