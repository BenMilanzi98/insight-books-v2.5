"use client";

import { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import UnitSelector from './UnitSelector';
import UnitConfiguration from './UnitConfiguration';

const UnitManagement = ({ 
  isEnabled = false, 
  onToggle, 
  baseUnits = [], 
  units = [], 
  selectedBaseUnit, 
  onBaseUnitChange, 
  selectedUnits = [], 
  onUnitsChange,
  unitConfigurations = {},
  onConfigurationChange,
  baseUnitPrice = 0,
  baseCostPrice = 0,
  baseQuantity = 0,
  baseReorderPoint = 0,
  disabled = false 
}) => {
  const [hasDefaultUnit, setHasDefaultUnit] = useState(false);

  // Check if there's a default unit configured
  useEffect(() => {
    const hasDefault = Object.values(unitConfigurations).some(config => config.isDefault);
    setHasDefaultUnit(hasDefault);
  }, [unitConfigurations]);

  return (
    <div className="space-y-6">
      {/* Toggle Switch */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Flexible Unit Management
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Enable to sell this product in multiple units (e.g., kg, g, lb) with auto-calculated pricing
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onChange={onToggle}
          disabled={disabled}
          className={`${
            isEnabled ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span
            className={`${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>

      {/* Unit Management Interface */}
      {isEnabled && (
        <div className="space-y-6 p-4 border border-gray-200 rounded-lg bg-white">
          {/* Unit Selection */}
          <UnitSelector
            baseUnits={baseUnits}
            units={units}
            selectedBaseUnit={selectedBaseUnit}
            onBaseUnitChange={onBaseUnitChange}
            selectedUnits={selectedUnits}
            onUnitsChange={onUnitsChange}
            disabled={disabled}
          />

          {/* Unit Configuration */}
          {selectedUnits.length > 0 && (
            <UnitConfiguration
              selectedUnits={selectedUnits}
              unitConfigurations={unitConfigurations}
              onConfigurationChange={onConfigurationChange}
              baseUnitPrice={baseUnitPrice}
              baseCostPrice={baseCostPrice}
              baseQuantity={baseQuantity}
              baseReorderPoint={baseReorderPoint}
              disabled={disabled}
            />
          )}

          {/* Summary */}
          {selectedUnits.length > 0 && hasDefaultUnit && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center text-sm text-green-700">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>
                  Unit management configured successfully. This product can now be sold in {selectedUnits.length + 1} different unit(s) with auto-calculated pricing.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disabled State Info */}
      {!isEnabled && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Single Unit Mode</p>
            <p>
              This product will use a single unit for all operations. 
              Enable flexible unit management above to sell in multiple units with auto-calculated pricing based on conversion rates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitManagement;
