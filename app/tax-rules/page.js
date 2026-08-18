"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  HelpCircle, 
  AlertCircle, 
  Save,
  Copy
} from "lucide-react";

const TaxRulesManager = () => {
  const [taxRules, setTaxRules] = useState([
    { 
      id: 1, 
      name: "Standard VAT", 
      rate: 17.5, 
      isDefault: true, 
      type: "percentage", 
      applies_to: "all",
      code: "VAT17.5"
    },
    { 
      id: 2, 
      name: "Zero-rated", 
      rate: 0, 
      isDefault: false, 
      type: "percentage",
      applies_to: "exports",
      code: "VAT0"
    },
    { 
      id: 3, 
      name: "Withholding Tax", 
      rate: 3, 
      isDefault: false, 
      type: "percentage",
      applies_to: "services",
      code: "WHT3"
    }
  ]);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTaxGroups, setShowTaxGroups] = useState(false);
  const [taxGroups, setTaxGroups] = useState([
    {
      id: 1,
      name: "Standard + WHT",
      taxes: [1, 3],
      description: "Standard VAT + Withholding Tax"
    }
  ]);
  
  // Function to add a new tax rule
  const addTaxRule = () => {
    const newId = taxRules.length > 0 ? Math.max(...taxRules.map(rule => rule.id)) + 1 : 1;
    setTaxRules([...taxRules, { 
      id: newId, 
      name: "", 
      rate: 0, 
      isDefault: false,
      type: "percentage",
      applies_to: "all",
      code: ""
    }]);
  };
  
  // Function to delete a tax rule
  const deleteTaxRule = (id) => {
    // Check if tax is used in any tax groups first
    const isUsedInGroup = taxGroups.some(group => group.taxes.includes(id));
    
    if (isUsedInGroup) {
      alert("This tax is used in one or more tax groups and cannot be deleted.");
      return;
    }
    
    setTaxRules(taxRules.filter(rule => rule.id !== id));
  };
  
  // Function to update a tax rule
  const updateTaxRule = (id, field, value) => {
    setTaxRules(taxRules.map(rule => 
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };
  
  // Function to set a tax rule as default
  const setDefaultTaxRule = (id) => {
    setTaxRules(taxRules.map(rule => 
      ({ ...rule, isDefault: rule.id === id })
    ));
  };
  
  // Function to add a new tax group
  const addTaxGroup = () => {
    const newId = taxGroups.length > 0 ? Math.max(...taxGroups.map(group => group.id)) + 1 : 1;
    setTaxGroups([...taxGroups, { 
      id: newId, 
      name: "New Tax Group", 
      taxes: [],
      description: ""
    }]);
  };
  
  // Function to delete a tax group
  const deleteTaxGroup = (id) => {
    setTaxGroups(taxGroups.filter(group => group.id !== id));
  };
  
  // Function to update a tax group
  const updateTaxGroup = (id, field, value) => {
    setTaxGroups(taxGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };
  
  // Function to update taxes in a group
  const updateTaxGroupTaxes = (groupId, taxId, isChecked) => {
    setTaxGroups(taxGroups.map(group => {
      if (group.id === groupId) {
        if (isChecked) {
          return { ...group, taxes: [...group.taxes, taxId] };
        } else {
          return { ...group, taxes: group.taxes.filter(id => id !== taxId) };
        }
      }
      return group;
    }));
  };
  
  // Function to duplicate a tax rule
  const duplicateTaxRule = (id) => {
    const ruleToDuplicate = taxRules.find(rule => rule.id === id);
    if (ruleToDuplicate) {
      const newId = Math.max(...taxRules.map(rule => rule.id)) + 1;
      const newRule = { 
        ...ruleToDuplicate, 
        id: newId, 
        name: `${ruleToDuplicate.name} (Copy)`,
        isDefault: false,
        code: `${ruleToDuplicate.code}_COPY`
      };
      setTaxRules([...taxRules, newRule]);
    }
  };
  
  // Function to import tax rules
  const importTaxRules = () => {
    // In a real implementation, this would open a file picker
    // For now, we'll just add a sample imported tax
    const newId = Math.max(...taxRules.map(rule => rule.id)) + 1;
    setTaxRules([...taxRules, { 
      id: newId, 
      name: "Imported Tax", 
      rate: 10, 
      isDefault: false,
      type: "percentage",
      applies_to: "all",
      code: "IMP10"
    }]);
  };
  
  // Calculate effective rate for tax groups
  const calculateGroupRate = (taxIds) => {
    return taxIds.reduce((total, taxId) => {
      const tax = taxRules.find(rule => rule.id === taxId);
      return tax ? total + tax.rate : total;
    }, 0);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{tt('Tax Rules')}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {tt('Manage tax rates applied to invoices and transactions')}
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1 rounded text-sm flex items-center"
            onClick={importTaxRules}
          >
            <Upload size={14} className="mr-1" />
            {tt('Import')}
          </button>
          <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1 rounded text-sm flex items-center">
            <Download size={14} className="mr-1" />
            {tt('Export')}
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-md font-medium text-gray-900">{tt('Individual Tax Rates')}</h3>
            <p className="text-xs text-gray-500">
              {tt('Define tax rates that can be applied to invoices and transactions')}
            </p>
          </div>
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
            onClick={addTaxRule}
          >
            <Plus size={16} className="mr-1" />
            {tt('Add Tax')}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Rate')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Type')}
                </th>
                {showAdvanced && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tt('Applies To')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tt('Code')}
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Default')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input 
                      type="text" 
                      className="border-gray-300 rounded-md px-3 py-1 w-full"
                      placeholder={tt('Tax name')}
                      value={rule.name}
                      onChange={(e) => updateTaxRule(rule.id, 'name', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        step="0.01"
                        className="border-gray-300 rounded-md px-3 py-1 w-20"
                        value={rule.rate}
                        onChange={(e) => updateTaxRule(rule.id, 'rate', parseFloat(e.target.value))}
                      />
                      <span className="ml-2">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select 
                      className="border-gray-300 rounded-md px-3 py-1 w-full"
                      value={rule.type}
                      onChange={(e) => updateTaxRule(rule.id, 'type', e.target.value)}
                    >
                      <option value="percentage">{tt('Percentage')}</option>
                      <option value="fixed">{tt('Fixed Amount')}</option>
                    </select>
                  </td>
                  {showAdvanced && (
                    <>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select 
                          className="border-gray-300 rounded-md px-3 py-1 w-full"
                          value={rule.applies_to}
                          onChange={(e) => updateTaxRule(rule.id, 'applies_to', e.target.value)}
                        >
                          <option value="all">{tt('All Transactions')}</option>
                          <option value="sales">{tt('POS Only')}</option>
                          <option value="purchases">{tt('Purchases Only')}</option>
                          <option value="services">{tt('Services Only')}</option>
                          <option value="goods">{tt('Goods Only')}</option>
                          <option value="exports">{tt('Exports Only')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input 
                          type="text" 
                          className="border-gray-300 rounded-md px-3 py-1 w-full"
                          placeholder={tt('Tax code')}
                          value={rule.code || ''}
                          onChange={(e) => updateTaxRule(rule.id, 'code', e.target.value)}
                        />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <input 
                      type="radio" 
                      name="defaultTax" 
                      checked={rule.isDefault}
                      onChange={() => setDefaultTaxRule(rule.id)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button 
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => duplicateTaxRule(rule.id)}
                        title={tt('Duplicate')}
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => deleteTaxRule(rule.id)}
                        title={tt('Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-2 flex justify-between items-center">
          <button 
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? tt('Hide Advanced Options') : tt('Show Advanced Options')}
          </button>
          
          <button 
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
            onClick={() => setShowTaxGroups(!showTaxGroups)}
          >
            {showTaxGroups ? tt('Hide Tax Groups') : tt('Show Tax Groups')}
          </button>
        </div>
        
        {showTaxGroups && (
          <div className="mt-8">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-md font-medium text-gray-900">{tt('Tax Groups')}</h3>
                <p className="text-xs text-gray-500">
                  {tt('Combine multiple taxes to apply simultaneously')}
                </p>
              </div>
              <button 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm flex items-center"
                onClick={addTaxGroup}
              >
                <Plus size={16} className="mr-1" />
                {tt('Add Group')}
              </button>
            </div>
            
            <div className="space-y-4">
              {taxGroups.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                    <input 
                      type="text" 
                      className="font-medium bg-transparent border-0 focus:ring-0 p-0"
                      value={group.name}
                      onChange={(e) => updateTaxGroup(group.id, 'name', e.target.value)}
                    />
                    <div className="flex items-center">
                      <span className="mr-2 text-sm text-gray-500">
                        Effective Rate: {calculateGroupRate(group.taxes).toFixed(2)}%
                      </span>
                      <button 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => deleteTaxGroup(group.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Description')}
                      </label>
                      <input 
                        type="text" 
                        className="border-gray-300 rounded-md px-3 py-1 w-full"
                        placeholder={tt('Group description')}
                        value={group.description}
                        onChange={(e) => updateTaxGroup(group.id, 'description', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Included Taxes')}
                      </label>
                      <div className="border border-gray-200 rounded-md p-2 max-h-40 overflow-y-auto">
                        {taxRules.length === 0 ? (
                          <p className="text-sm text-gray-500">{tt('No taxes defined yet')}</p>
                        ) : (
                          <div className="space-y-2">
                            {taxRules.map((tax) => (
                              <div key={tax.id} className="flex items-center">
                                <input 
                                  type="checkbox" 
                                  id={`group-${group.id}-tax-${tax.id}`}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  checked={group.taxes.includes(tax.id)}
                                  onChange={(e) => updateTaxGroupTaxes(group.id, tax.id, e.target.checked)}
                                />
                                <label 
                                  htmlFor={`group-${group.id}-tax-${tax.id}`}
                                  className="ml-2 text-sm text-gray-700"
                                >
                                  {tax.name} ({tax.rate}%)
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4">
          <div className="flex">
            <HelpCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                {tt('Tax settings will be applied to invoices based on your configuration. Make sure to set one tax rule as the default.')}
              </p>
              <a 
                href="#"
                className="text-sm font-medium text-blue-700 hover:text-blue-600 mt-2 inline-block"
              >
                {tt('Learn more about tax setup')}
              </a>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 border-t flex justify-end">
        <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2">
          {tt('Cancel')}
        </button>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center">
          <Save size={16} className="mr-2" />
          {tt('Save Tax Settings')}
        </button>
      </div>
    </div>
  );
};

export default TaxRulesManager;