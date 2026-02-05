"use client";

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Check, ChevronDown } from 'lucide-react';

const DynamicCategorySelect = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select or add category",
  searchPlaceholder = "Search categories...",
  emptyMessage = "No categories available",
  emptySearchMessage = "No categories found",
  addNewPlaceholder = "Enter new category name...",
  onAddCategory,
  className = "",
  disabled = false,
  required = false,
  label = "Category"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Ensure options is always an array
  const safeOptions = Array.isArray(options) ? options : [];

  const getOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    if (option?.label) return option.label;
    if (option?.name && option?.code) return `${option.code} - ${option.name}`;
    return option?.name || option?.accountName || option?.accountCode || 'Unknown';
  };

  const getOptionValue = (option) => {
    if (typeof option === 'string') return option;
    return option?.id || option?.value || option?.accountId || option?.accountCode || option?.name;
  };

  // Filter options based on search term
  const filteredOptions = safeOptions.filter(option => 
    getOptionLabel(option).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsAdding(false);
        setSearchTerm("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when adding new category
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSelect = (option) => {
    onChange(getOptionValue(option));
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setSearchTerm("");
  };

  const handleSaveNew = async () => {
    if (newCategory.trim()) {
      try {
        // Call the parent's onAddCategory function
        await onAddCategory(newCategory.trim());
        
        // Select the newly added category
        onChange(newCategory.trim());
        
        // Reset state
        setIsAdding(false);
        setNewCategory("");
        setIsOpen(false);
      } catch (error) {
        console.error('Error adding category:', error);
      }
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewCategory("");
    setSearchTerm("");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveNew();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
  };

  const selectedOption = safeOptions.find(option => getOptionValue(option) === value);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full p-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
              {selectedOption ? getOptionLabel(selectedOption) : placeholder}
            </span>
            <ChevronDown 
              size={16} 
              className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
            {/* Search/Add Header */}
            <div className="p-2 border-b border-gray-200">
              {!isAdding ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 p-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {onAddCategory && (
                    <button
                      type="button"
                      onClick={handleAddNew}
                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Add new category"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={addNewPlaceholder}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 p-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveNew}
                    disabled={!newCategory.trim()}
                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save new category"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={getOptionValue(option)}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                      getOptionValue(option) === value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {getOptionLabel(option)}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  {searchTerm ? emptySearchMessage : emptyMessage}
                </div>
              )}
            </div>

            {/* Add New Option (when not in adding mode) */}
            {!isAdding && searchTerm && !filteredOptions.includes(searchTerm) && (
              <div className="border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setNewCategory(searchTerm);
                    setIsAdding(true);
                  }}
                  className="w-full px-3 py-2 text-left text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center"
                >
                  <Plus size={16} className="mr-2" />
                  Add "{searchTerm}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicCategorySelect; 