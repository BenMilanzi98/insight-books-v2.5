"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import { Save, Plus, Trash, CheckCircle, AlertCircle } from "lucide-react";

export default function TaxSettings() {
  const [settings, setSettings] = useState({
    taxEnabled: true,
    defaultTaxRate: 17.5,
    taxRates: [
      { id: "1", name: "Standard Rate", rate: 17.5, isDefault: true },
      { id: "2", name: "Reduced Rate", rate: 5, isDefault: false },
      { id: "3", name: "Zero Rate", rate: 0, isDefault: false }
    ],
    taxNumber: "TAX-12345-MWK",
    taxPeriod: "monthly",
    taxOffice: "Blantyre Regional Office",
    nextFilingDue: "2025-05-31"
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newRate, setNewRate] = useState({ name: "", rate: "", isDefault: false });

  // Fetch tax settings
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch("/api/tenant/settings/tax");
        
        if (!response.ok) {
          throw new Error(`Error fetching tax settings: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // If the API returns data, update the state
        if (data) {
          setSettings({
            ...settings,
            ...data
          });
        }
      } catch (err) {
        console.error("Error fetching tax settings:", err);
        setError("Failed to load tax settings. Using default values.");
        // We'll continue with the default settings defined above
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  // Save tax settings
  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch("/api/tenant/settings/tax", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save tax settings");
      }
      
      setSuccess("Tax settings saved successfully.");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Error saving tax settings:", err);
      setError(err.message || "Failed to save tax settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Add new tax rate
  const addTaxRate = () => {
    if (!newRate.name || !newRate.rate) {
      setError("Please provide both a name and rate for the new tax rate.");
      return;
    }
    
    // Create a new ID (in a real app, the backend would generate this)
    const id = `new-${Date.now()}`;
    
    // Update default flag for all rates if this one is set as default
    let updatedRates = [...settings.taxRates];
    if (newRate.isDefault) {
      updatedRates = updatedRates.map(rate => ({
        ...rate,
        isDefault: false
      }));
    }
    
    // Add the new rate
    updatedRates.push({
      id,
      name: newRate.name,
      rate: parseFloat(newRate.rate),
      isDefault: newRate.isDefault
    });
    
    // Update settings
    setSettings({
      ...settings,
      taxRates: updatedRates,
      // If this is the first rate or it's set as default, update defaultTaxRate
      defaultTaxRate: newRate.isDefault ? parseFloat(newRate.rate) : settings.defaultTaxRate
    });
    
    // Reset new rate form
    setNewRate({ name: "", rate: "", isDefault: false });
    
    // Show success message
    setSuccess("New tax rate added. Don't forget to save changes.");
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  // Remove tax rate
  const removeTaxRate = (id) => {
    // Find the rate to be removed
    const rateToRemove = settings.taxRates.find(rate => rate.id === id);
    
    // Check if it's the default rate
    if (rateToRemove.isDefault) {
      setError("Cannot remove the default tax rate. Set another rate as default first.");
      return;
    }
    
    // Filter out the tax rate
    const updatedRates = settings.taxRates.filter(rate => rate.id !== id);
    
    // Update settings
    setSettings({
      ...settings,
      taxRates: updatedRates
    });
  };

  // Set a tax rate as default
  const setDefaultRate = (id) => {
    // Update all rates, changing isDefault flag
    const updatedRates = settings.taxRates.map(rate => ({
      ...rate,
      isDefault: rate.id === id
    }));
    
    // Get the new default rate
    const newDefaultRate = settings.taxRates.find(rate => rate.id === id);
    
    // Update settings
    setSettings({
      ...settings,
      taxRates: updatedRates,
      defaultTaxRate: newDefaultRate.rate
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">{tt('Tax Configuration')}</h2>
        <p className="text-gray-500 text-sm">
          {tt('Manage your tax settings, rates, and filing information.')}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.taxEnabled}
                onChange={() =>
                  setSettings({
                    ...settings,
                    taxEnabled: !settings.taxEnabled
                  })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">{tt('Enable Tax Calculations')}</span>
            </label>
            <p className="mt-1 text-sm text-gray-500">
              {tt('Turn on to automatically calculate taxes on invoices and sales.')}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Tax Registration Number')}
            </label>
            <input
              type="text"
              value={settings.taxNumber}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  taxNumber: e.target.value
                })
              }
              className="border border-gray-300 p-2 w-full rounded"
              placeholder={tt('Your tax registration number')}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Tax Filing Period')}
            </label>
            <select
              value={settings.taxPeriod}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  taxPeriod: e.target.value
                })
              }
              className="border border-gray-300 p-2 w-full rounded"
            >
              <option value="monthly">{tt('Monthly')}</option>
              <option value="quarterly">{tt('Quarterly')}</option>
              <option value="biannually">{tt('Bi-annually')}</option>
              <option value="annually">{tt('Annually')}</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Tax Office')}
            </label>
            <input
              type="text"
              value={settings.taxOffice}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  taxOffice: e.target.value
                })
              }
              className="border border-gray-300 p-2 w-full rounded"
              placeholder={tt('Your tax office')}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Next Filing Due Date')}
            </label>
            <input
              type="date"
              value={settings.nextFilingDue}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  nextFilingDue: e.target.value
                })
              }
              className="border border-gray-300 p-2 w-full rounded"
            />
          </div>
        </div>

        <div>
          <h3 className="text-md font-medium mb-3">{tt('Tax Rates')}</h3>
          <div className="mb-4 border border-gray-200 rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {tt('Name')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Rate (%)
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {tt('Default')}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {tt('Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settings.taxRates.map((rate) => (
                  <tr key={rate.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{rate.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{rate.rate.toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="radio"
                        name="defaultTaxRate"
                        checked={rate.isDefault}
                        onChange={() => setDefaultRate(rate.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => removeTaxRate(rate.id)}
                        className="text-red-600 hover:text-red-800"
                        disabled={rate.isDefault}
                        title={rate.isDefault ? tt('Cannot remove default rate') : tt('Remove tax rate')}
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
            <h4 className="text-sm font-medium mb-3">{tt('Add New Tax Rate')}</h4>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <input
                  type="text"
                  placeholder={tt('Name')}
                  value={newRate.name}
                  onChange={(e) =>
                    setNewRate({
                      ...newRate,
                      name: e.target.value
                    })
                  }
                  className="border border-gray-300 p-2 w-full rounded text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder={tt('Rate %')}
                  value={newRate.rate}
                  min="0"
                  step="0.01"
                  onChange={(e) =>
                    setNewRate({
                      ...newRate,
                      rate: e.target.value
                    })
                  }
                  className="border border-gray-300 p-2 w-full rounded text-sm"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newRate.isDefault}
                    onChange={() =>
                      setNewRate({
                        ...newRate,
                        isDefault: !newRate.isDefault
                      })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-1"
                  />
                  <span>{tt('Default')}</span>
                </label>
              </div>
            </div>
            <button
              onClick={addTaxRate}
              className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-100 flex items-center"
            >
              <Plus size={14} className="mr-1" />
              {tt('Add Rate')}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-200 mr-2"></div>
              {tt('Saving...')}
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" />
              {tt('Save Tax Settings')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}