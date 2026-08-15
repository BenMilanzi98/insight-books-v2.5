import { tt } from '@/lib/i18n/runtime';
import { useState } from 'react';
import { AlertTriangle, X, Trash2, FileText, ShoppingCart, Receipt } from 'lucide-react';

const ProductDeletionWarningModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  product, 
  usageDetails = {} 
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen || !product) return null;

  const hasUsage = usageDetails.totalUsage > 0;
  const requiredConfirmText = `DELETE ${product.name}`;

  const handleConfirm = async () => {
    if (confirmText !== requiredConfirmText) return;
    
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{tt('Delete Product')}</h3>
              <p className="text-sm text-gray-500">{tt('This action cannot be undone')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Product Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              {product.image && product.image !== '/api/placeholder/80/80' ? (
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <h4 className="font-medium text-gray-900">{product.name}</h4>
                <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                {product.category && (
                  <p className="text-sm text-gray-500">Category: {product.category}</p>
                )}
              </div>
            </div>
          </div>

          {/* Usage Warning */}
          {hasUsage && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800 mb-2">
                    {tt('Warning: Product is in use')}
                  </h4>
                  <p className="text-sm text-amber-700 mb-3">
                    This product is currently being used in {usageDetails.totalUsage} record(s). 
                    Deleting it may affect your historical data and reports.
                  </p>
                  
                  {/* Usage breakdown */}
                  <div className="space-y-2">
                    {usageDetails.invoices > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-amber-700">
                        <Receipt className="w-4 h-4" />
                        <span>{usageDetails.invoices} invoice(s)</span>
                      </div>
                    )}
                    {usageDetails.sales > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-amber-700">
                        <ShoppingCart className="w-4 h-4" />
                        <span>{usageDetails.sales} sale(s)</span>
                      </div>
                    )}
                    {usageDetails.quotations > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-amber-700">
                        <FileText className="w-4 h-4" />
                        <span>{usageDetails.quotations} quotation(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Type')} <span className="font-mono bg-gray-100 px-1 rounded">{requiredConfirmText}</span> {tt('to confirm deletion:')}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={requiredConfirmText}
              disabled={isDeleting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:opacity-50"
            />
          </div>

          {/* Additional Warning */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <strong>{tt('What happens when you delete this product:')}</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>{tt('The product will be permanently removed from inventory')}</li>
              <li>{tt('Historical records will remain but show "Deleted Product"')}</li>
              <li>{tt('Reports may show incomplete product information')}</li>
              <li>{tt('This action cannot be undone')}</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tt('Cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting || confirmText !== requiredConfirmText}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{tt('Deleting...')}</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>{tt('Delete Product')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDeletionWarningModal;
