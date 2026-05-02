"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

const UnitBasedQuantityInput = ({ 
  product, 
  quantity, 
  onQuantityChange, 
  onPriceChange,
  onUnitQuantitiesChange,
  className = "" 
}) => {
  // State for individual unit quantities
  const [unitQuantities, setUnitQuantities] = useState({});
  
  // Use refs to store callback functions to prevent infinite loops
  const onQuantityChangeRef = useRef(onQuantityChange);
  const onPriceChangeRef = useRef(onPriceChange);
  const onUnitQuantitiesChangeRef = useRef(onUnitQuantitiesChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onQuantityChangeRef.current = onQuantityChange;
    onPriceChangeRef.current = onPriceChange;
    onUnitQuantitiesChangeRef.current = onUnitQuantitiesChange;
  }, [onQuantityChange, onPriceChange, onUnitQuantitiesChange]);

  // Initialize unit quantities when product changes (prefer cart-provided unitQuantities when present)
  useEffect(() => {
    if (product?.units && product.units.length > 0) {
      const initialQuantities = {};
      product.units.forEach((unit) => {
        const v = product.unitQuantities?.[unit.id];
        const n = v != null && v !== '' ? Number(v) : 0;
        initialQuantities[unit.id] = Number.isFinite(n) ? n : 0;
      });
      setUnitQuantities(initialQuantities);
    }
  }, [product?.id]); // Only depend on product ID to prevent infinite loops

  // Calculate totals directly from current values.
  let totalBaseQuantity = 0;
  let totalPrice = 0;
  if (product?.units && Object.keys(unitQuantities).length > 0) {
    console.log("=== TOTAL CALCULATION DEBUG ===");
    console.log("Unit quantities:", unitQuantities);
    console.log("Product units:", product.units);

    Object.entries(unitQuantities).forEach(([unitId, qty]) => {
      const unit = product.units.find(u => u.id === unitId);
      if (unit && qty > 0) {
        const conversionRate = parseFloat(unit.conversionToBase);
        const unitPrice = parseFloat(unit.unitPrice);
        const convertedToBase = unit.isBaseUnit ? qty : qty / conversionRate;
        console.log(`Unit ${unit.symbol}: ${qty} ${unit.symbol} = ${convertedToBase.toFixed(6)} base units (conversion rate: ${conversionRate})`);
        totalBaseQuantity += convertedToBase;
        totalPrice += qty * unitPrice;
      }
    });

    console.log("Total base quantity:", totalBaseQuantity.toFixed(6));
    console.log("Total price:", totalPrice.toFixed(2));
    console.log("==============================");
  }

  // Notify parent components when totals change
  useEffect(() => {
    onQuantityChangeRef.current(totalBaseQuantity);
    onPriceChangeRef.current(totalPrice);
    onUnitQuantitiesChangeRef.current(unitQuantities);
  }, [totalBaseQuantity, totalPrice, unitQuantities]);

  // Handle individual unit quantity changes
  const handleUnitQuantityChange = useCallback((unitId, value) => {
    console.log("=== UNIT QUANTITY CHANGE DEBUG ===");
    console.log("Unit ID:", unitId);
    console.log("Value:", value);
    
    const numValue = parseFloat(value) || 0;
    
    console.log("Setting quantity for unit:", unitId, "to:", numValue);
    console.log("================================");
    
    setUnitQuantities(prev => ({
      ...prev,
      [unitId]: numValue
    }));
  }, []);

  // No auto-conversion - let users enter quantities independently

  if (!product?.units || product.units.length === 0) {
    return null;
  }

  const baseUnit = product.units.find(u => u.isBaseUnit);
  const subUnits = product.units.filter(u => !u.isBaseUnit);

  return (
    <div className={`unit-quantity-input ${className}`}>
      {/* Unit Quantity Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">Quantity by Unit</h4>
        </div>
        
        <div className="divide-y divide-gray-200">
          {/* Base Unit Row */}
          {baseUnit && (
            <div className="px-3 py-2 bg-green-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700">
                    {baseUnit.symbol} (Base Unit)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={unitQuantities[baseUnit.id] || 0}
                    onChange={(e) => handleUnitQuantityChange(baseUnit.id, e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-right"
                    placeholder="0.000"
                  />
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {formatCurrency(parseFloat(baseUnit.unitPrice))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sub Units Rows */}
          {subUnits.map(unit => (
            <div key={unit.id} className="px-3 py-2 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <span className="text-sm font-medium text-blue-700">
                      {unit.symbol}
                    </span>
                    <div className="text-xs text-gray-500">
                      1 {baseUnit?.symbol} = {parseFloat(unit.conversionToBase)} {unit.symbol}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={unitQuantities[unit.id] || 0}
                    onChange={(e) => handleUnitQuantityChange(unit.id, e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                    placeholder="0.000"
                  />
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {formatCurrency(parseFloat(unit.unitPrice))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Summary */}
      <div className="mt-3 p-3 bg-gray-50 rounded-md border">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Total Quantity:
          </span>
          <span className="text-sm font-bold text-gray-900">
            {totalBaseQuantity.toFixed(6)} {baseUnit?.symbol}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm font-medium text-gray-700">
            Total Price:
          </span>
          <span className="text-sm font-bold text-green-600">
            {formatCurrency(totalPrice)}
          </span>
        </div>
      </div>

      {/* Stock Status Indicators */}
      <div className="mt-2 space-y-1">
        {product.units.map(unit => {
          const availableStock = parseFloat(unit.quantityInStock);
          const requested = unitQuantities[unit.id] || 0;
          const isOutOfStock = availableStock === 0;
          const isLowStock = availableStock <= parseFloat(unit.reorderPoint);
          const isInsufficient = requested > availableStock;
          
          console.log(`🔥 UNIT STOCK DEBUG: ${unit.symbol} - Available: ${availableStock}, Requested: ${requested}`);

          return (
            <div key={unit.id} className={`text-xs px-2 py-1 rounded ${
              isOutOfStock ? 'bg-red-100 text-red-700' :
              isInsufficient ? 'bg-red-100 text-red-700' :
              isLowStock ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {unit.symbol}: {availableStock} available
              {isInsufficient && ` (Need ${requested - availableStock} more)`}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper function for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-MW', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

export default UnitBasedQuantityInput;
