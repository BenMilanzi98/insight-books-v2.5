"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, X, AlertCircle } from 'lucide-react';

const UnitSelector = ({ 
  baseUnits = [], 
  units = [], 
  selectedBaseUnit, 
  onBaseUnitChange, 
  selectedUnits = [], 
  onUnitsChange,
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [baseUnitSearch, setBaseUnitSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [showCustomUnitForm, setShowCustomUnitForm] = useState(false);
  const [customUnit, setCustomUnit] = useState({ name: '', symbol: '', conversionRate: 1 });
  const [showBaseUnitDropdown, setShowBaseUnitDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  // Filter units based on selected base unit
  useEffect(() => {
    if (selectedBaseUnit) {
      const filtered = units.filter(unit => unit.baseUnitId === selectedBaseUnit.id);
      setAvailableUnits(filtered);
    } else {
      setAvailableUnits([]);
    }
  }, [selectedBaseUnit, units]);

  const handleUnitToggle = (unit) => {
    const isSelected = selectedUnits.some(selected => selected.id === unit.id);
    
    if (isSelected) {
      // Remove unit
      onUnitsChange(selectedUnits.filter(selected => selected.id !== unit.id));
    } else {
      // Add unit with default conversion rate
      const newUnit = {
        ...unit,
        conversionRate: unit.conversionToBase || 1 // Use standard conversion rate
      };
      onUnitsChange([...selectedUnits, newUnit]);
    }
  };

  const removeUnit = (unitId) => {
    onUnitsChange(selectedUnits.filter(unit => unit.id !== unitId));
  };

  const updateConversionRate = (unitId, newRate) => {
    onUnitsChange(selectedUnits.map(unit => 
      unit.id === unitId 
        ? { ...unit, conversionRate: parseFloat(newRate) || 1 }
        : unit
    ));
  };

  const addCustomUnit = () => {
    if (customUnit.name && customUnit.symbol) {
      const newCustomUnit = {
        id: `custom_${Date.now()}`,
        name: customUnit.name,
        symbol: customUnit.symbol,
        conversionToBase: customUnit.conversionRate,
        conversionRate: customUnit.conversionRate,
        isBaseUnit: false,
        baseUnitId: selectedBaseUnit.id,
        isCustom: true
      };
      
      onUnitsChange([...selectedUnits, newCustomUnit]);
      setCustomUnit({ name: '', symbol: '', conversionRate: 1 });
      setShowCustomUnitForm(false);
      setUnitSearch('');
    }
  };

  // Handle keyboard navigation for base unit dropdown
  const handleBaseUnitKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowBaseUnitDropdown(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowBaseUnitDropdown(true);
    }
  };

  // Handle keyboard navigation for unit dropdown
  const handleUnitKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowUnitDropdown(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowUnitDropdown(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Base Unit Selector - True Combobox */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Base Unit Type')}
        </label>
        <div className="relative">
          <input
            type="text"
            value={baseUnitSearch}
            onChange={(e) => {
              setBaseUnitSearch(e.target.value);
              setShowBaseUnitDropdown(true);
            }}
            onFocus={() => setShowBaseUnitDropdown(true)}
            onBlur={() => {
              // Delay hiding to allow clicks on dropdown items
              setTimeout(() => setShowBaseUnitDropdown(false), 200);
            }}
            onKeyDown={handleBaseUnitKeyDown}
            placeholder={selectedBaseUnit ? `${selectedBaseUnit.displayName} (${selectedBaseUnit.baseUnit})` : "Search or select base unit type..."}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowBaseUnitDropdown(!showBaseUnitDropdown)}
            className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showBaseUnitDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Base Unit Dropdown - Always visible when open */}
          {showBaseUnitDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {baseUnits
                .filter(baseUnit => 
                  baseUnit.displayName.toLowerCase().includes(baseUnitSearch.toLowerCase()) ||
                  baseUnit.baseUnit.toLowerCase().includes(baseUnitSearch.toLowerCase())
                )
                .map(baseUnit => (
                  <button
                    key={baseUnit.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      onBaseUnitChange(baseUnit);
                      setBaseUnitSearch('');
                      setShowBaseUnitDropdown(false);
                      // Clear selected units when base unit changes
                      onUnitsChange([]);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="font-medium">{baseUnit.displayName}</div>
                    <div className="text-sm text-gray-500">Base unit: {baseUnit.baseUnit}</div>
                    {baseUnit.description && (
                      <div className="text-xs text-gray-400">{baseUnit.description}</div>
                    )}
                  </button>
                ))}
              {baseUnits.filter(baseUnit => 
                baseUnit.displayName.toLowerCase().includes(baseUnitSearch.toLowerCase()) ||
                baseUnit.baseUnit.toLowerCase().includes(baseUnitSearch.toLowerCase())
              ).length === 0 && (
                <div className="px-4 py-2 text-sm text-gray-500">{tt('No base units found')}</div>
              )}
            </div>
          )}
        </div>
        {selectedBaseUnit && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedBaseUnit.description}
          </p>
        )}
      </div>

      {/* Unit Selection - True Combobox */}
      {selectedBaseUnit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tt('Available Units')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={unitSearch}
              onChange={(e) => {
                setUnitSearch(e.target.value);
                setShowUnitDropdown(true);
              }}
              onFocus={() => setShowUnitDropdown(true)}
              onBlur={() => {
                // Delay hiding to allow clicks on dropdown items
                setTimeout(() => setShowUnitDropdown(false), 200);
              }}
              onKeyDown={handleUnitKeyDown}
              placeholder={tt('Search or select units...')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => setShowUnitDropdown(!showUnitDropdown)}
              className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Unit Dropdown - Always visible when open */}
            {showUnitDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {availableUnits
                  .filter(unit => 
                    unit.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
                    unit.symbol.toLowerCase().includes(unitSearch.toLowerCase())
                  )
                  .map(unit => {
                    const isSelected = selectedUnits.some(selected => selected.id === unit.id);
                    return (
                      <label
                        key={unit.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleUnitToggle(unit)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {unit.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            Symbol: {unit.symbol}
                            {unit.isBaseUnit && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                {tt('Base')}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                
                {/* Custom Unit Option */}
                {selectedBaseUnit.name === 'custom' && (
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setShowCustomUnitForm(true);
                        setShowUnitDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm text-blue-600"
                    >
                      <Plus className="inline h-4 w-4 mr-2" />
                      {tt('Add Custom Unit')}
                    </button>
                  </div>
                )}
                
                {availableUnits.filter(unit => 
                  unit.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
                  unit.symbol.toLowerCase().includes(unitSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500">{tt('No units found')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Unit Form */}
      {showCustomUnitForm && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-3">{tt('Add Custom Unit')}</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tt('Unit Name')}
              </label>
              <input
                type="text"
                value={customUnit.name}
                onChange={(e) => setCustomUnit(prev => ({ ...prev, name: e.target.value }))}
                placeholder={tt('e.g., Dozen, Pack, Bundle')}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tt('Symbol')}
              </label>
              <input
                type="text"
                value={customUnit.symbol}
                onChange={(e) => setCustomUnit(prev => ({ ...prev, symbol: e.target.value }))}
                placeholder={tt('e.g., dz, pk, bdl')}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tt('Conversion Rate')}
              </label>
              <input
                type="number"
                value={customUnit.conversionRate}
                onChange={(e) => setCustomUnit(prev => ({ ...prev, conversionRate: parseFloat(e.target.value) || 1 }))}
                placeholder="1"
                step="0.001"
                min="0.001"
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many {customUnit.symbol || 'units'} = 1 {selectedBaseUnit?.baseUnit || 'base unit'}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={addCustomUnit}
                disabled={!customUnit.name || !customUnit.symbol}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tt('Add Unit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomUnitForm(false);
                  setCustomUnit({ name: '', symbol: '', conversionRate: 1 });
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {tt('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Units Display */}
      {selectedUnits.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tt('Selected Sub-Units')}
          </label>
          <div className="space-y-2">
            {selectedUnits.map(unit => (
              <div
                key={unit.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {unit.name} ({unit.symbol})
                    </span>
                    {unit.isBaseUnit && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        {tt('Base Unit')}
                      </span>
                    )}
                    {unit.isCustom && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        {tt('Custom')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUnit(unit.id)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Conversion Rate Input */}
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-600 whitespace-nowrap">
                    {tt('Conversion Rate:')}
                  </label>
                  <input
                    type="number"
                    value={unit.conversionRate || unit.conversionToBase || 1}
                    onChange={(e) => updateConversionRate(unit.id, e.target.value)}
                    disabled={disabled}
                    className="flex-1 p-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1"
                    step="0.001"
                    min="0.001"
                  />
                  <span className="text-xs text-gray-500">
                    {unit.symbol} = 1 {selectedBaseUnit?.baseUnit || 'base unit'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Messages */}
      {selectedBaseUnit && selectedUnits.length === 0 && (
        <div className="flex items-center text-sm text-amber-600">
          <AlertCircle className="h-4 w-4 mr-1" />
          {tt('Please select at least one unit to use with this product')}
        </div>
      )}
    </div>
  );
};

export default UnitSelector;
