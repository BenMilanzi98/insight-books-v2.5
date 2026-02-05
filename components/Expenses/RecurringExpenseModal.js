// components/Expenses/RecurringExpenseModal.js
import { useState, useEffect } from "react";
import { 
  X, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Trash2,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import DynamicCategorySelect from '@/components/DynamicCategorySelect';

const RecurringExpenseModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  categories = [],
  isLoading = false,
  initialData = null
}) => {
  const getOptionId = (option) => (typeof option === 'string' ? option : option?.id);
  const getOptionName = (option) => (typeof option === 'string' ? option : option?.name);
  // Form state
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expenseAccountId: "",
    startDate: new Date().toISOString().split("T")[0],
    frequency: "monthly", // weekly, monthly, quarterly, yearly
    dayOfMonth: new Date().getDate().toString(),
    dayOfWeek: "1", // 0-6, Sunday-Saturday
    endDate: "", // Optional
    occurrences: "12", // Default to 12 occurrences
    endType: "occurrences", // occurrences or date
    notes: ""
  });

  // Error state
  const [errors, setErrors] = useState({});
  
  // Reset form data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Editing mode - populate with existing data
        setFormData({
          description: initialData.description || "",
          amount: initialData.amount ? (typeof initialData.amount === 'string' ? initialData.amount.replace(/,/g, '') : initialData.amount.toString()) : "",
          expenseAccountId: initialData.expenseAccountId || (categories.length > 0 ? getOptionId(categories[0]) || "" : ""),
          startDate: initialData.startDate || new Date().toISOString().split("T")[0],
          frequency: initialData.frequency || "monthly",
          dayOfMonth: initialData.dayOfMonth ? initialData.dayOfMonth.toString() : new Date().getDate().toString(),
          dayOfWeek: initialData.dayOfWeek ? initialData.dayOfWeek.toString() : new Date().getDay().toString(),
          endDate: initialData.endDate || "",
          occurrences: initialData.occurrences ? initialData.occurrences.toString() : "12",
          endType: initialData.endDate ? "date" : "occurrences",
          notes: initialData.notes || ""
        });
      } else {
        // Create mode - use defaults
        const today = new Date().toISOString().split("T")[0];
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        setFormData({
          description: "",
          amount: "",
          expenseAccountId: categories.length > 0 ? getOptionId(categories[0]) || "" : "",
          startDate: today,
          frequency: "monthly",
          dayOfMonth: new Date().getDate().toString(),
          dayOfWeek: new Date().getDay().toString(),
          endDate: oneYearFromNow.toISOString().split("T")[0],
          occurrences: "12",
          endType: "occurrences",
          notes: ""
        });
      }
      setErrors({});
    }
  }, [isOpen, categories, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error for this field if any
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    
    if (formData.amount === '' || formData.amount <= 0) {
      newErrors.amount = "Amount is required and must be greater than zero";
    }
    
    if (!formData.expenseAccountId) {
      newErrors.expenseAccountId = "Expense account is required";
    }
    
    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }
    
    if (formData.endType === "date" && !formData.endDate) {
      newErrors.endDate = "End date is required";
    }
    
    if (formData.endType === "occurrences") {
      const occurrences = parseInt(formData.occurrences);
      if (isNaN(occurrences) || occurrences <= 0) {
        newErrors.occurrences = "Number of occurrences must be a positive number";
      }
    }
    
    if (formData.frequency === "monthly" && 
        (isNaN(parseInt(formData.dayOfMonth)) || 
         parseInt(formData.dayOfMonth) < 1 || 
         parseInt(formData.dayOfMonth) > 31)) {
      newErrors.dayOfMonth = "Day of month must be between 1 and 31";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Transform form data into recurring expense data structure
    const selectedAccount = categories.find(acc => getOptionId(acc) === formData.expenseAccountId);
    const recurringExpenseData = {
      ...formData,
      amount: parseFloat(formData.amount.replace(/,/g, '')),
      dayOfMonth: parseInt(formData.dayOfMonth),
      dayOfWeek: parseInt(formData.dayOfWeek),
      occurrences: parseInt(formData.occurrences),
      status: "Active",
      category: getOptionName(selectedAccount) || ""
    };
    
    onSubmit(recurringExpenseData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4 bg-opacity-50">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center">
              <RefreshCw className="w-5 h-5 mr-2 text-green-600" />
              {initialData ? 'Edit Recurring Expense' : 'Create Recurring Expense'}
            </h3>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-5 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">
                    Recurring expenses will automatically create new expense entries 
                    according to your defined schedule. You'll be notified when new 
                    expenses are created.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Monthly Office Rent"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="100.00"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>
            </div>
            
            <div className="mb-4">
              <DynamicCategorySelect
                value={formData.expenseAccountId}
                onChange={(value) => setFormData(prev => ({ ...prev, expenseAccountId: value }))}
                options={categories}
                placeholder="Select expense account"
                required={true}
                label="Expense Account"
              />
              {errors.expenseAccountId && (
                <p className="mt-1 text-sm text-red-600">{errors.expenseAccountId}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded-md ${errors.startDate ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            {/* Frequency-specific options */}
            {formData.frequency === "weekly" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week
                </label>
                <select
                  name="dayOfWeek"
                  value={formData.dayOfWeek}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}
            
            {formData.frequency === "monthly" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month
                </label>
                <input
                  type="number"
                  name="dayOfMonth"
                  value={formData.dayOfMonth}
                  onChange={handleChange}
                  min="1"
                  max="31"
                  className={`w-full p-2 border rounded-md ${errors.dayOfMonth ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.dayOfMonth && (
                  <p className="mt-1 text-sm text-red-600">{errors.dayOfMonth}</p>
                )}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Scheduling
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="endType"
                    value="occurrences"
                    checked={formData.endType === "occurrences"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>After</span>
                  <input
                    type="number"
                    name="occurrences"
                    value={formData.occurrences}
                    onChange={handleChange}
                    min="1"
                    className={`mx-2 p-1 w-16 border rounded-md ${errors.occurrences ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={formData.endType !== "occurrences"}
                  />
                  <span>occurrences</span>
                </label>
                {errors.occurrences && (
                  <p className="mt-1 text-sm text-red-600">{errors.occurrences}</p>
                )}
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="endType"
                    value="date"
                    checked={formData.endType === "date"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>On specific end date:</span>
                </label>
                <div className={`ml-6 ${formData.endType !== "date" && "opacity-50"}`}>
                  <div className="relative">
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleChange}
                      className={`w-full p-2 border rounded-md ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={formData.endType !== "date"}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  {errors.endDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Add any additional details..."
              ></textarea>
            </div>
          </div>
          
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between">
            <button 
              type="button"
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <span>{initialData ? 'Update Recurring Expense' : 'Create Recurring Expense'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringExpenseModal;