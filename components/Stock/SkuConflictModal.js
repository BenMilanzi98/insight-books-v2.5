"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import { X, AlertTriangle, RotateCcw, Package, Calendar, User, RefreshCw } from "lucide-react";

const SkuConflictModal = ({
  isOpen,
  onClose,
  conflictData,
  onRestoreProduct,
  onCreateWithNewSku,
  onCancel,
  isProcessing = false
}) => {
  const [selectedAction, setSelectedAction] = useState(null);

  if (!isOpen || !conflictData) return null;

  const { deletedProduct } = conflictData;
  const deletedDate = new Date(deletedProduct.deletedAt).toLocaleDateString();
  const deletedTime = new Date(deletedProduct.deletedAt).toLocaleTimeString();

  const handleRestore = async () => {
    setSelectedAction('restore');
    try {
      await onRestoreProduct(deletedProduct.id);
    } catch (error) {
      console.error('Error restoring product:', error);
    }
  };

  const handleCreateNew = async () => {
    setSelectedAction('create');
    try {
      await onCreateWithNewSku();
    } catch (error) {
      console.error('Error creating with new SKU:', error);
    }
  };

  const handleCancel = () => {
    setSelectedAction(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>
        
        {/* Modal content */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">
                {tt('SKU Conflict Detected')}
              </h3>
            </div>
            <button
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Body */}
          <div className="px-6 py-6">
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                {tt('The SKU')} <span className="font-semibold text-gray-900">{deletedProduct.sku}</span> {tt("you're trying to use belongs to a previously deleted product. You have two options:")}
              </p>
            </div>

            {/* Deleted Product Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Package className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">{tt('Deleted Product Details')}</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="font-medium w-20">{tt('Name:')}</span>
                      <span>{deletedProduct.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium w-20">{tt('SKU:')}</span>
                      <span className="font-mono bg-gray-200 px-2 py-1 rounded">{deletedProduct.sku}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="font-medium w-20">{tt('Deleted:')}</span>
                      <span>{deletedDate} at {deletedTime}</span>
                    </div>
                    {deletedProduct.deletedByUser && (
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        <span className="font-medium w-20">{tt('By:')}</span>
                        <span>{deletedProduct.deletedByUser.name}</span>
                      </div>
                    )}
                    {deletedProduct.deletionReason && (
                      <div className="flex items-start">
                        <span className="font-medium w-20 mt-0.5">{tt('Reason:')}</span>
                        <span className="text-gray-700">{deletedProduct.deletionReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Options */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-3">{tt('Choose an action:')}</h4>
              
              {/* Option 1: Restore Product */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex items-center justify-center mr-3 mt-0.5">
                      {selectedAction === 'restore' && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <RotateCcw className="h-5 w-5 text-blue-600 mr-2" />
                      <h5 className="font-medium text-gray-900">{tt('Restore the deleted product')}</h5>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {tt('Restore the deleted product and then edit it with your new information. This will bring back the original product with the same SKU.')}
                    </p>
                    <button
                      onClick={handleRestore}
                      disabled={isProcessing}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing && selectedAction === 'restore' ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {tt('Restoring...')}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {tt('Restore Product')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Create with New SKU */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex items-center justify-center mr-3 mt-0.5">
                      {selectedAction === 'create' && (
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Package className="h-5 w-5 text-green-600 mr-2" />
                      <h5 className="font-medium text-gray-900">{tt('Create with a different SKU')}</h5>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {tt('Create your new product with a different SKU. The deleted product will remain deleted.')}
                    </p>
                    <button
                      onClick={handleCreateNew}
                      disabled={isProcessing}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing && selectedAction === 'create' ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {tt('Creating...')}
                        </>
                      ) : (
                        <>
                          <Package className="h-4 w-4 mr-2" />
                          {tt('Create with New SKU')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tt('Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkuConflictModal;
