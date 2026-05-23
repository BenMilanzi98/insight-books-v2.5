"use client";

import { useState, useEffect, useRef } from 'react';
import { Edit, Trash2, Save, X, AlertCircle } from 'lucide-react';

const UnitConfiguration = ({ 
  selectedUnits = [], 
  baseUnitPrice = 0,
  baseCostPrice = 0,
  baseQuantity = 0,
  baseReorderPoint = 0,
  unitConfigurations = {}, 
  onConfigurationChange,
  disabled = false 
}) => {
  const [editingUnit, setEditingUnit] = useState(null);
  const [tempConfig, setTempConfig] = useState({});
  const prevValuesRef = useRef({});

  // Auto-calculate pricing for sub-units based on conversion rates
  const calculateSubUnitPricing = (unit) => {
    const conversionRate = unit.conversionRate || unit.conversionToBase || 1;
    return {
      unitPrice: (baseUnitPrice / conversionRate).toFixed(2),
      costPrice: (baseCostPrice / conversionRate).toFixed(2),
      quantityInStock: (baseQuantity * conversionRate).toFixed(3),
      reorderPoint: (baseReorderPoint * conversionRate).toFixed(3)
    };
  };

  // Initialize configurations for new units with auto-calculated values
  useEffect(() => {
    const currentValues = {
      selectedUnits: selectedUnits.map(u => u.id).sort().join(','),
      baseUnitPrice,
      baseCostPrice,
      baseQuantity,
      baseReorderPoint
    };

    // Check if values have actually changed
    const prevValues = prevValuesRef.current;
    const hasValuesChanged = 
      prevValues.selectedUnits !== currentValues.selectedUnits ||
      prevValues.baseUnitPrice !== currentValues.baseUnitPrice ||
      prevValues.baseCostPrice !== currentValues.baseCostPrice ||
      prevValues.baseQuantity !== currentValues.baseQuantity ||
      prevValues.baseReorderPoint !== currentValues.baseReorderPoint;

    if (!hasValuesChanged) {
      return;
    }

    // Update the ref with current values
    prevValuesRef.current = currentValues;

    const newConfigs = { ...unitConfigurations };
    let hasChanges = false;
    let hasDefaultUnit = false;

    // Check if there's already a default unit
    Object.values(newConfigs).forEach(config => {
      if (config.isDefault) {
        hasDefaultUnit = true;
      }
    });

    selectedUnits.forEach(unit => {
      const calculated = calculateSubUnitPricing(unit);
      
      if (!newConfigs[unit.id]) {
        // New unit - add configuration
        // Set base unit as default if no default exists
        const isDefault = unit.isBaseUnit && !hasDefaultUnit;
        if (isDefault) {
          hasDefaultUnit = true;
        }
        
        newConfigs[unit.id] = {
          ...calculated,
          isDefault
        };
        hasChanges = true;
      } else {
        // Existing unit - check if values need updating
        const currentConfig = newConfigs[unit.id];
        if (
          currentConfig.unitPrice !== calculated.unitPrice ||
          currentConfig.costPrice !== calculated.costPrice ||
          currentConfig.quantityInStock !== calculated.quantityInStock ||
          currentConfig.reorderPoint !== calculated.reorderPoint
        ) {
          newConfigs[unit.id] = {
            ...currentConfig,
            unitPrice: calculated.unitPrice,
            costPrice: calculated.costPrice,
            quantityInStock: calculated.quantityInStock,
            reorderPoint: calculated.reorderPoint
          };
          hasChanges = true;
        }
      }
    });

    // Remove configurations for units that are no longer selected
    const selectedUnitIds = selectedUnits.map(unit => unit.id);
    Object.keys(newConfigs).forEach(unitId => {
      if (!selectedUnitIds.includes(unitId)) {
        delete newConfigs[unitId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onConfigurationChange(newConfigs);
    }
  }, [selectedUnits, baseUnitPrice, baseCostPrice, baseQuantity, baseReorderPoint]);

  const startEditing = (unit) => {
    setEditingUnit(unit.id);
    setTempConfig({
      ...unitConfigurations[unit.id],
      unitPrice: unitConfigurations[unit.id]?.unitPrice || '',
      costPrice: unitConfigurations[unit.id]?.costPrice || '',
      quantityInStock: unitConfigurations[unit.id]?.quantityInStock || '',
      reorderPoint: unitConfigurations[unit.id]?.reorderPoint || '',
      isDefault: unitConfigurations[unit.id]?.isDefault || false
    });
  };

  const saveConfiguration = (unitId) => {
    const updatedConfigs = {
      ...unitConfigurations,
      [unitId]: { ...tempConfig }
    };
    onConfigurationChange(updatedConfigs);
    setEditingUnit(null);
    setTempConfig({});
  };

  const cancelEditing = () => {
    setEditingUnit(null);
    setTempConfig({});
  };

  const removeUnit = (unitId) => {
    const updatedConfigs = { ...unitConfigurations };
    delete updatedConfigs[unitId];
    onConfigurationChange(updatedConfigs);
  };

  const handleTempConfigChange = (field, value) => {
    setTempConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const setAsDefault = (unitId) => {
    const updatedConfigs = { ...unitConfigurations };
    
    // Remove default from all other units
    Object.keys(updatedConfigs).forEach(id => {
      if (updatedConfigs[id]) {
        updatedConfigs[id].isDefault = false;
      }
    });
    
    // Set this unit as default
    if (updatedConfigs[unitId]) {
      updatedConfigs[unitId].isDefault = true;
    }
    
    onConfigurationChange(updatedConfigs);
  };

  if (selectedUnits.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No units selected. Please select units above to configure pricing and stock.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Unit Configuration
        </h4>
        <span className="text-xs text-gray-500">
          {selectedUnits.length} unit(s) configured
        </span>
      </div>

      <div className="space-y-3">
        {selectedUnits.map(unit => {
          const config = unitConfigurations[unit.id] || {};
          const isEditing = editingUnit === unit.id;
          const isDefault = config.isDefault;

          return (
            <div
              key={unit.id}
              className={`border rounded-lg p-4 ${
                isDefault ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              {/* Unit Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h5 className="font-medium text-gray-900">
                    {unit.name} ({unit.symbol})
                  </h5>
                  {isDefault && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      Default Unit
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => setAsDefault(unit.id)}
                      disabled={disabled}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUnit(unit.id)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Auto-calculated Configuration Display */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Selling Price:</span>
                    <p className="font-medium text-green-600">MWK {config.unitPrice || '0.00'}</p>
                    <p className="text-xs text-gray-400">Auto-calculated</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Order Price:</span>
                    <p className="font-medium text-green-600">MWK {config.costPrice || '0.00'}</p>
                    <p className="text-xs text-gray-400">Auto-calculated</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock:</span>
                    <p className="font-medium text-blue-600">{config.quantityInStock || '0'} {unit.symbol}</p>
                    <p className="text-xs text-gray-400">Auto-calculated</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Reorder Point:</span>
                    <p className="font-medium text-blue-600">{config.reorderPoint || '0'} {unit.symbol}</p>
                    <p className="text-xs text-gray-400">Auto-calculated</p>
                  </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Validation Summary */}
      {selectedUnits.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="flex items-center text-sm text-gray-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>
              {selectedUnits.filter(unit => unitConfigurations[unit.id]?.isDefault).length === 0 
                ? 'Please set one unit as the default unit for this product.'
                : 'Configuration complete. You can now save the product.'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitConfiguration;
