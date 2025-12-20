import { useMemo, useState } from "react";

const sectionClass =
  "space-y-3 rounded-2xl border border-gray-200 bg-white/90 p-4  ring-1 ring-gray-100";
const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300/80 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500";

function FormSection({ title, description, children }) {
  return (
    <div className={sectionClass}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Validation helpers
const validateEmail = (email) => {
  if (!email) return true; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  if (!phone) return true; // Phone is optional
  // Flexible international phone validation - allows +, digits, spaces, dashes, parentheses
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export default function SupplierForm({ initialData = {}, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    supplierName: initialData.supplierName || "",
    contactPerson: initialData.contactPerson || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    mobile: initialData.mobile || "",
    address: initialData.address || "",
    city: initialData.city || "",
    country: initialData.country || "Malawi",
    postalCode: initialData.postalCode || "",
    taxId: initialData.taxId || "",
    paymentTerms: initialData.paymentTerms ?? 30,
    currency: initialData.currency || "MWK",
    creditLimit: initialData.creditLimit || "",
    bankName: initialData.bankName || "",
    bankAccountNumber: initialData.bankAccountNumber || "",
    bankBranch: initialData.bankBranch || "",
    isActive: initialData.isActive !== undefined ? initialData.isActive : true,
    notes: initialData.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.supplierName.trim()) {
      errors.supplierName = "Supplier name is required";
    }
    
    if (formData.email && !validateEmail(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = "Please enter a valid phone number";
    }
    
    if (formData.mobile && !validatePhone(formData.mobile)) {
      errors.mobile = "Please enter a valid mobile number";
    }
    
    if (formData.creditLimit && (isNaN(formData.creditLimit) || parseFloat(formData.creditLimit) < 0)) {
      errors.creditLimit = "Credit limit must be a positive number";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      setError("Please fix the validation errors before submitting");
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
        paymentTerms: formData.paymentTerms ? parseInt(formData.paymentTerms) : 30,
      };
      
      if (typeof onSave === 'function') {
        await onSave(submitData);
      }
    } catch (err) {
      setError(err?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = useMemo(() => saving, [saving]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <FormSection title="Business Details" description="Core supplier identification information.">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`${inputClass} ${validationErrors.supplierName ? 'border-red-500' : ''}`}
              name="supplierName"
              value={formData.supplierName}
              onChange={handleChange}
              required
              placeholder="e.g., Sunrise Trading Co."
            />
            {validationErrors.supplierName && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.supplierName}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Contact Person</label>
              <input
                className={inputClass}
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                placeholder="Main point of contact"
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={`${inputClass} ${validationErrors.email ? 'border-red-500' : ''}`}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="accounts@supplier.com"
              />
              {validationErrors.email && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Phone</label>
              <input
                className={`${inputClass} ${validationErrors.phone ? 'border-red-500' : ''}`}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+265 123 456 789"
              />
              {validationErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.phone}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Mobile</label>
              <input
                className={`${inputClass} ${validationErrors.mobile ? 'border-red-500' : ''}`}
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="+265 999 123 456"
              />
              {validationErrors.mobile && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.mobile}</p>
              )}
            </div>
          </div>
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={labelClass}>Active Supplier</span>
            </label>
            <p className="mt-1 text-xs text-gray-500">Inactive suppliers won't appear in selection lists</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Address Information" description="Physical location and mailing address.">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Street Address</label>
            <input
              className={inputClass}
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>City</label>
              <input
                className={inputClass}
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Lilongwe"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Country</label>
              <input
                className={inputClass}
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Malawi"
              />
            </div>
            <div>
              <label className={labelClass}>Postal Code</label>
              <input
                className={inputClass}
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="00000"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Financial Information" description="Payment terms, tax details, and banking information.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Payment Terms (days)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                placeholder="30"
              />
              <p className="mt-1 text-xs text-gray-500">Default: 30 days</p>
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select
                className={inputClass}
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="MWK">MWK - Malawi Kwacha</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="ZAR">ZAR - South African Rand</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tax ID / VAT Number</label>
              <input
                className={inputClass}
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                placeholder="VAT/Tax identification number"
              />
            </div>
            <div>
              <label className={labelClass}>Credit Limit</label>
              <input
                className={`${inputClass} ${validationErrors.creditLimit ? 'border-red-500' : ''}`}
                type="number"
                min={0}
                step="0.01"
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleChange}
                placeholder="0.00"
              />
              {validationErrors.creditLimit && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.creditLimit}</p>
              )}
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Banking Details</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Bank Name</label>
                <input
                  className={inputClass}
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="Bank name"
                />
              </div>
              <div>
                <label className={labelClass}>Account Number</label>
                <input
                  className={inputClass}
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="Account number"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Bank Branch</label>
              <input
                className={inputClass}
                name="bankBranch"
                value={formData.bankBranch}
                onChange={handleChange}
                placeholder="Branch name or location"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Commercial Terms"
        description="Defaults that feed into purchase orders, receipts, and bills."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Payment Terms (days)</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleChange}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={`${inputClass} min-h-[96px]`}
            rows={3}
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any special instructions, preferred delivery windows, etc."
          />
        </div>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={isDisabled}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white  hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : initialData?.id ? "Update Supplier" : "Save Supplier"}
        </button>
      </div>
    </form>
  );
}

