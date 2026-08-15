"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import { DollarSign, Check, Edit2, Download, Eye, Copy } from "lucide-react";

const InvoiceTemplateEditor = ({ template, onSave }) => {
  const [name, setName] = useState(template?.name || "New Template");
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);
  const [activeTab, setActiveTab] = useState("design");
  
  const colorOptions = [
    { id: "blue", color: "#3b82f6", name: "Blue" },
    { id: "green", color: "#10b981", name: "Green" },
    { id: "purple", color: "#8b5cf6", name: "Purple" },
    { id: "red", color: "#ef4444", name: "Red" },
    { id: "orange", color: "#f59e0b", name: "Orange" },
    { id: "gray", color: "#6b7280", name: "Gray" },
  ];
  
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].id);
  const [showLogo, setShowLogo] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [includeTerms, setIncludeTerms] = useState(true);
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">{tt('Edit Invoice Template')}</h2>
      </div>
      
      <div className="p-4 border-b">
        <div className="flex flex-col md:flex-row md:items-center mb-4">
          <div className="w-full md:w-1/2 mb-4 md:mb-0 md:mr-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Template Name')}
            </label>
            <input
              type="text"
              className="border-gray-300 rounded-md px-3 py-2 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="w-full md:w-1/2 flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              checked={isDefault}
              onChange={() => setIsDefault(!isDefault)}
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
              {tt('Set as default template')}
            </label>
          </div>
        </div>
      </div>
      
      <div className="border-b">
        <div className="flex">
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === "design"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("design")}
          >
            {tt('Design')}
          </button>
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === "content"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("content")}
          >
            {tt('Content')}
          </button>
          <button
            className={`py-3 px-4 font-medium ${
              activeTab === "preview"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("preview")}
          >
            {tt('Preview')}
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {activeTab === "design" && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">{tt('Design Options')}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tt('Color Scheme')}
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedColor(option.id)}
                    className={`w-8 h-8 rounded-full ${
                      selectedColor === option.id ? "ring-2 ring-offset-2 ring-gray-400" : ""
                    }`}
                    style={{ backgroundColor: option.color }}
                    title={option.name}
                  >
                    {selectedColor === option.id && (
                      <Check className="text-white w-5 h-5 mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tt('Layout Options')}
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showLogo"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    checked={showLogo}
                    onChange={() => setShowLogo(!showLogo)}
                  />
                  <label htmlFor="showLogo" className="text-sm text-gray-700">
                    {tt('Show Company Logo')}
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showFooter"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    checked={showFooter}
                    onChange={() => setShowFooter(!showFooter)}
                  />
                  <label htmlFor="showFooter" className="text-sm text-gray-700">
                    {tt('Show Footer with Company Information')}
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeTerms"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                    checked={includeTerms}
                    onChange={() => setIncludeTerms(!includeTerms)}
                  />
                  <label htmlFor="includeTerms" className="text-sm text-gray-700">
                    {tt('Include Terms & Conditions')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "content" && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">{tt('Content Options')}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Invoice Title Format')}
              </label>
              <input
                type="text"
                className="border-gray-300 rounded-md px-3 py-2 w-full"
                defaultValue="INVOICE #[Number]"
              />
              <p className="text-xs text-gray-500 mt-1">
                {tt('Use [Number] as placeholder for the invoice number')}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Default Terms & Conditions')}
              </label>
              <textarea
                className="border-gray-300 rounded-md px-3 py-2 w-full"
                rows="4"
                defaultValue="Payment is due within 14 days from the date of invoice. Late payment is subject to interest charges at 2% per month."
              ></textarea>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Custom Thank You Message')}
              </label>
              <input
                type="text"
                className="border-gray-300 rounded-md px-3 py-2 w-full"
                defaultValue="Thank you for your business!"
              />
            </div>
          </div>
        )}
        
        {activeTab === "preview" && (
          <div>
            <div className="bg-gray-100 border rounded-lg p-6 mb-4">
              <div className="flex justify-between mb-6">
                <div>
                  {showLogo && (
                    <div className="w-40 h-16 bg-white rounded border flex items-center justify-center text-gray-400 mb-2">
                      {tt('Company Logo')}
                    </div>
                  )}
                  <div className="text-gray-700">
                    <p className="font-medium">{tt('Your Company Name')}</p>
                    <p className="text-sm">{tt('123 Business Street')}</p>
                    <p className="text-sm">{tt('City, Country, ZIP')}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <h1 
                    className="text-2xl font-bold mb-2"
                    style={{ color: colorOptions.find(c => c.id === selectedColor)?.color }}
                  >
                    {tt('INVOICE #12345')}
                  </h1>
                  <p className="text-gray-600 text-sm">{tt('Date: 07/03/2025')}</p>
                  <p className="text-gray-600 text-sm">{tt('Due Date: 21/03/2025')}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h2 className="font-medium mb-2">{tt('Bill To:')}</h2>
                <div className="text-gray-700">
                  <p>{tt('Client Name')}</p>
                  <p className="text-sm">{tt('Client Address')}</p>
                  <p className="text-sm">{tt('City, Country, ZIP')}</p>
                </div>
              </div>
              
              <div className="border rounded-md overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead
                    className="text-left text-xs font-medium uppercase tracking-wider"
                    style={{ backgroundColor: colorOptions.find(c => c.id === selectedColor)?.color, color: 'white' }}
                  >
                    <tr>
                      <th className="px-4 py-2">{tt('Item')}</th>
                      <th className="px-4 py-2 text-right">{tt('Quantity')}</th>
                      <th className="px-4 py-2 text-right">{tt('Price')}</th>
                      <th className="px-4 py-2 text-right">{tt('Amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3">{tt('Product/Service Name')}</td>
                      <td className="px-4 py-3 text-right">1</td>
                      <td className="px-4 py-3 text-right">{tt('MK 100.00')}</td>
                      <td className="px-4 py-3 text-right">{tt('MK 100.00')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">{tt('Product/Service Name')}</td>
                      <td className="px-4 py-3 text-right">2</td>
                      <td className="px-4 py-3 text-right">{tt('MK 75.00')}</td>
                      <td className="px-4 py-3 text-right">{tt('MK 150.00')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2">
                    <span>{tt('Subtotal:')}</span>
                    <span>{tt('MK 250.00')}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Tax (17.5%):</span>
                    <span>{tt('MK 41.25')}</span>
                  </div>
                  <div 
                    className="flex justify-between py-2 font-bold"
                    style={{ color: colorOptions.find(c => c.id === selectedColor)?.color }}
                  >
                    <span>{tt('Total:')}</span>
                    <span>{tt('MK 291.25')}</span>
                  </div>
                </div>
              </div>
              
              {includeTerms && (
                <div className="mt-6 pt-4 border-t text-xs text-gray-600">
                  <h3 className="font-medium mb-1">{tt('Terms & Conditions:')}</h3>
                  <p>{tt('Payment is due within 14 days from the date of invoice. Late payment is subject to interest charges at 2% per month.')}</p>
                </div>
              )}
              
              {showFooter && (
                <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center">
                  <p>Your Company Name • Phone: (123) 456-7890 • Email: info@yourcompany.com</p>
                  <p>{tt('Thank you for your business!')}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-2">
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1 rounded text-sm flex items-center">
                <Download size={14} className="mr-1" />
                {tt('Download PDF')}
              </button>
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1 rounded text-sm flex items-center">
                <Copy size={14} className="mr-1" />
                {tt('Duplicate')}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t bg-gray-50 flex justify-end">
        <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2">
          {tt('Cancel')}
        </button>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          onClick={() => onSave?.({
            name,
            isDefault,
            color: selectedColor,
            showLogo,
            showFooter,
            includeTerms
          })}
        >
          {tt('Save Template')}
        </button>
      </div>
    </div>
  );
};

export default InvoiceTemplateEditor;