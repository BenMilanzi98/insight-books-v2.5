"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Edit, 
  Trash2, 
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle
} from "lucide-react";

// Employee Form Component
const EmployeeForm = ({ employee, onSubmit, onCancel, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    idNumber: "",
    jobTitle: "",
    department: "",
    employmentType: "Permanent",
    grossSalary: "",
    hourlyRate: "",
    startDate: new Date().toISOString().split('T')[0],
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "Malawian",
    address: "",
    workLocation: "",
    isActive: true,
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinPhone: "",
    nextOfKinAddress: ""
  });

  const [deductions, setDeductions] = useState([]);
  const [selectedDeductions, setSelectedDeductions] = useState([]);
  const [salaryCalculation, setSalaryCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (employee) {
      const emergencyContact =
        (employee.emergencyContact && typeof employee.emergencyContact === 'object')
          ? employee.emergencyContact
          : {};

      setFormData({
        name: employee.name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        idNumber: employee.idNumber || "",
        jobTitle: employee.jobTitle || employee.position || "",
        department: employee.department || "",
        employmentType: employee.employmentType || "Permanent",
        grossSalary: employee.grossSalary || employee.salary || "",
        hourlyRate: employee.hourlyRate || "",
        startDate: employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : "",
        dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : "",
        gender: employee.gender || "",
        maritalStatus: employee.maritalStatus || "",
        nationality: employee.nationality || "Malawian",
        address: employee.address || "",
        workLocation: employee.workLocation || "",
        isActive: employee.isActive !== undefined ? employee.isActive : true,
        nextOfKinName: emergencyContact.name || emergencyContact.fullName || "",
        nextOfKinRelationship: emergencyContact.relationship || "",
        nextOfKinPhone: emergencyContact.phone || "",
        nextOfKinAddress: emergencyContact.address || ""
      });
      
      // Reset salary calculation when editing
      setSalaryCalculation(null);
    }
  }, [employee]);

  // Fetch deductions when employment type changes
  useEffect(() => {
    fetchDeductions();
  }, [formData.employmentType]);

  // Load selected deductions when deductions are fetched and employee has selectedDeductions
  useEffect(() => {
    if (employee && employee.selectedDeductions && Array.isArray(employee.selectedDeductions) && deductions.length > 0) {
      const selectedDeductionObjects = deductions.filter(d => 
        employee.selectedDeductions.includes(d.id)
      );
      setSelectedDeductions(selectedDeductionObjects);
    }
  }, [employee, deductions]);

  const fetchDeductions = async () => {
    try {
      const response = await fetch('/api/deductions');
      const data = await response.json();
      setDeductions(data.deductions || []);
    } catch (error) {
      console.error('Error fetching deductions:', error);
    }
  };

  const calculateSalary = async () => {
    if (!formData.grossSalary || formData.grossSalary <= 0) {
      alert('Please enter a valid gross salary');
      return;
    }

    try {
      setCalculating(true);
      const response = await fetch('/api/employees/calculate-salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grossSalary: formData.grossSalary,
          deductionIds: selectedDeductions.map(d => d.id),
          employmentType: formData.employmentType
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please log in to calculate salary. Authentication required.");
          return;
        }
        throw new Error('Failed to calculate salary');
      }

      const data = await response.json();
      setSalaryCalculation(data.calculation);
    } catch (error) {
      console.error('Error calculating salary:', error);
      alert('Failed to calculate salary');
    } finally {
      setCalculating(false);
    }
  };

  const toggleDeduction = (deduction) => {
    setSelectedDeductions(prev => {
      const isSelected = prev.some(d => d.id === deduction.id);
      if (isSelected) {
        return prev.filter(d => d.id !== deduction.id);
      } else {
        return [...prev, deduction];
      }
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const {
      nextOfKinName,
      nextOfKinRelationship,
      nextOfKinPhone,
      nextOfKinAddress,
      ...formWithoutKin
    } = formData;

    const hasNextOfKin = [nextOfKinName, nextOfKinRelationship, nextOfKinPhone, nextOfKinAddress]
      .some(value => value && value.toString().trim() !== "");

    const emergencyContact = hasNextOfKin
      ? {
          name: nextOfKinName || undefined,
          relationship: nextOfKinRelationship || undefined,
          phone: nextOfKinPhone || undefined,
          address: nextOfKinAddress || undefined
        }
      : null;

    // Include salary calculation data if available
    const submitData = {
      ...formWithoutKin,
      grossSalary: formData.grossSalary,
      selectedDeductions: selectedDeductions.map(d => d.id),
      salaryCalculation: salaryCalculation,
      emergencyContact
    };
    
    onSubmit(submitData);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{employee ? "Edit Employee" : "Add New Employee"}</h2>
        <button className="text-gray-500 hover:text-gray-700" onClick={onCancel}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+265 999 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID/Passport Number</label>
                <input
                  type="text"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ID Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Malawian"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Main Street, Lilongwe"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Software Engineer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="IT"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="Permanent">Permanent</option>
                  <option value="Contract">Contract</option>
                  <option value="Casual">Casual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Location</label>
                <input
                  type="text"
                  name="workLocation"
                  value={formData.workLocation}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Lilongwe"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-600">Employee is Active</span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Compensation & Deductions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gross Salary (MWK)</label>
                <input
                  type="number"
                  name="grossSalary"
                  value={formData.grossSalary}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="500000"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (MWK)</label>
                <input
                  type="number"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5000"
                  step="0.01"
                />
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3">Salary Deductions</h4>
              {deductions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {deductions.map(deduction => (
                    <div
                      key={deduction.id}
                      className={`p-2 rounded-md border cursor-pointer transition-colors text-xs ${
                        selectedDeductions.some(d => d.id === deduction.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleDeduction(deduction)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{deduction.name}</div>
                          <div className="text-xs text-gray-600">
                            {deduction.percentage !== null && deduction.percentage !== undefined
                              ? `${deduction.percentage}%`
                              : deduction.amount !== null && deduction.amount !== undefined
                              ? `MWK ${(deduction.amount || 0).toLocaleString()}`
                              : 'No value set'
                            }
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {deduction.isStatutory && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-800 rounded">
                              Statutory
                            </span>
                          )}
                          {selectedDeductions.some(d => d.id === deduction.id) && (
                            <CheckCircle size={16} className="text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  No deductions available for {formData.employmentType} employees
                </div>
              )}
            </div>

            {formData.grossSalary && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-800">Salary Calculation</h4>
                  <button
                    type="button"
                    onClick={calculateSalary}
                    disabled={calculating || !formData.grossSalary}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {calculating ? 'Calculating...' : 'Calculate Net Salary'}
                  </button>
                </div>

                {salaryCalculation && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white p-3 rounded">
                        <div className="text-sm text-gray-600">Gross Salary</div>
                        <div className="text-lg font-semibold text-green-600">
                          MWK {(salaryCalculation.grossSalary || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <div className="text-sm text-gray-600">Total Deductions</div>
                        <div className="text-lg font-semibold text-red-600">
                          MWK {(salaryCalculation.totalDeductions || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <div className="text-sm text-gray-600">Net Salary</div>
                        <div className="text-lg font-semibold text-blue-600">
                          MWK {(salaryCalculation.netPay || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {salaryCalculation.paye.payeAmount > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">PAYE Tax Breakdown</div>
                        <div className="space-y-1">
                          {salaryCalculation.paye.breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.bracket}</span>
                              <span>MWK {(item.tax || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {salaryCalculation.nps.totalAmount > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">NPS Contributions</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Employee (5%)</span>
                            <span>MWK {(salaryCalculation.nps.employeeAmount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Employer (5%)</span>
                            <span>MWK {(salaryCalculation.nps.employerAmount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {salaryCalculation.customDeductions.breakdown.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Other Deductions</div>
                        <div className="space-y-1">
                          {salaryCalculation.customDeductions.breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{item.name}</span>
                              <span>MWK {(item.amount || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Next of Kin Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="nextOfKinName"
                  value={formData.nextOfKinName}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                <input
                  type="text"
                  name="nextOfKinRelationship"
                  value={formData.nextOfKinRelationship}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Sibling"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="nextOfKinPhone"
                  value={formData.nextOfKinPhone}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+265 888 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Physical Address</label>
                <input
                  type="text"
                  name="nextOfKinAddress"
                  value={formData.nextOfKinAddress}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="456 Lakeside Drive, Blantyre"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && (
              <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
            {employee ? "Update Employee" : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Main Employee Management Component
const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterEmploymentType, setFilterEmploymentType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [deductionType, setDeductionType] = useState('custom');
  const [statistics, setStatistics] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    totalSalaryExpense: 0
  });

  useEffect(() => {
    loadEmployees();
    loadDeductions();
  }, []);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/employees');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        
        if (response.status === 401) {
          setError("Please log in to view employees. Authentication required.");
          return;
        }
        
        throw new Error(errorData.error || `Failed to fetch employees (${response.status})`);
      }
      
      const data = await response.json();
      setEmployees(data.employees || []);
      
      // Calculate statistics
      const active = (data.employees || []).filter(e => e.isActive).length;
      const inactive = (data.employees || []).length - active;
      const totalSalary = (data.employees || []).reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
      
      setStatistics({
        totalEmployees: (data.employees || []).length,
        activeEmployees: active,
        inactiveEmployees: inactive,
        totalSalaryExpense: totalSalary
      });
    } catch (error) {
      console.error("Error loading employees:", error);
      setError(`Failed to load employees: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeductions = async () => {
    try {
      const response = await fetch('/api/deductions');
      const data = await response.json();
      setDeductions(data.deductions || []);
    } catch (error) {
      console.error('Error loading deductions:', error);
    }
  };

  const editDeduction = (deduction) => {
    setEditingDeduction(deduction);
    setShowDeductionModal(true);
  };

  const deleteDeduction = async (deductionId) => {
    if (!confirm('Are you sure you want to delete this deduction?')) {
      return;
    }

    try {
      const response = await fetch(`/api/deductions/${deductionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccessMessage('Deduction deleted successfully');
        loadDeductions();
      } else {
        if (response.status === 401) {
          setError('Please log in to delete deductions. Authentication required.');
          return;
        }
        const error = await response.json();
        setError(`Failed to delete deduction: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting deduction:', error);
      setError('Failed to delete deduction');
    }
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const handleEditEmployee = (employee, e) => {
    if (e) e.stopPropagation();
    setSelectedEmployee(employee);
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleDeleteEmployee = async (employeeId, e) => {
    if (e) e.stopPropagation();
    
    if (confirm("Are you sure you want to delete this employee?")) {
      try {
        const response = await fetch(`/api/employees/${employeeId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Please log in to delete employees. Authentication required.');
            return;
          }
          throw new Error('Failed to delete employee');
        }
        
        setEmployees(employees.filter(emp => emp.id !== employeeId));
        setSuccessMessage('Employee deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        loadEmployees(); // Refresh statistics
      } catch (error) {
        console.error(`Error deleting employee ${employeeId}:`, error);
        alert("Failed to delete employee. Please try again.");
      }
    }
  };

  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      if (isEditing && selectedEmployee) {
        const response = await fetch(`/api/employees/${selectedEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            setError("Please log in to update employees. Authentication required.");
            setIsFormOpen(false);
            return;
          }
          throw new Error('Failed to update employee');
        }
        
        const data = await response.json();
        setEmployees(employees.map(e => 
          e.id === selectedEmployee.id ? data.employee : e
        ));
        setSuccessMessage('Employee updated successfully');
      } else {
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            setError("Please log in to create employees. Authentication required.");
            setIsFormOpen(false);
            return;
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create employee');
        }
        
        const data = await response.json();
        setEmployees([data.employee, ...employees]);
        setSuccessMessage('Employee created successfully');
      }
      
      setIsFormOpen(false);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadEmployees(); // Refresh statistics
    } catch (error) {
      console.error("Error saving employee:", error);
      alert(error.message || "Failed to save employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MW', { 
      style: 'currency', 
      currency: 'MWK',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = !searchTerm || 
      employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === "All" || employee.department === filterDepartment;
    const matchesEmploymentType = filterEmploymentType === "All" || employee.employmentType === filterEmploymentType;
    const matchesStatus = filterStatus === "All" || 
      (filterStatus === "Active" && employee.isActive) ||
      (filterStatus === "Inactive" && !employee.isActive);
    
    return matchesSearch && matchesDepartment && matchesEmploymentType && matchesStatus;
  });

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  return (
    <div className="p-4 sm:p-6">
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="ml-auto text-green-400 hover:text-green-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employee Management</h1>
          <p className="text-gray-600">Manage your employees and their information</p>
        </div>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
          onClick={handleAddEmployee}
        >
          <Plus size={16} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-blue-100 p-3 rounded-full mr-4">
            <User size={20} className="text-blue-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{statistics.totalEmployees}</span>
            <span className="text-gray-600 text-sm">Total Employees</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-green-100 p-3 rounded-full mr-4">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{statistics.activeEmployees}</span>
            <span className="text-gray-600 text-sm">Active</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-red-100 p-3 rounded-full mr-4">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{statistics.inactiveEmployees}</span>
            <span className="text-gray-600 text-sm">Inactive</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-yellow-100 p-3 rounded-full mr-4">
            <DollarSign size={20} className="text-yellow-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">
              {formatCurrency(statistics.totalSalaryExpense)}
            </span>
            <span className="text-gray-600 text-sm">Monthly Salary</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout - 3/1 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Employee Table - 3 columns */}
        <div className="lg:col-span-3">
          {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-grow max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
            <Filter size={18} className="text-gray-500 mr-2" />
            <select 
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="bg-transparent border-none focus:outline-none"
            >
              <option value="All">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
            <select 
              value={filterEmploymentType}
              onChange={(e) => setFilterEmploymentType(e.target.value)}
              className="bg-transparent border-none focus:outline-none"
            >
              <option value="All">All Types</option>
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
              <option value="Casual">Casual</option>
            </select>
          </div>
          
          <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-none focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-10 w-10 border-4 border-t-blue-600 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading employees...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle size={24} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-800 font-medium mb-1">Error Loading Employees</h3>
            <p className="text-red-600 mb-3">{error}</p>
            
            {error.includes("Authentication required") ? (
              <div className="space-y-2">
                <p className="text-sm text-red-700">
                  Please make sure you are logged in to access the HR module.
                </p>
                <button 
                  className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm"
                  onClick={() => window.location.href = '/auth/login'}
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <button 
                className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                onClick={loadEmployees}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employment Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredEmployees.map((employee) => (
                  <tr 
                    key={employee.id} 
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-sm">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                          {employee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">{employee.name}</div>
                          <div className="text-gray-500">{employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{employee.employeeId || 'N/A'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{employee.jobTitle || employee.position || 'N/A'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{employee.department || 'N/A'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{employee.employmentType || 'N/A'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 text-right">{formatCurrency(employee.salary)}</td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs ${
                        employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-right whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <button 
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          onClick={(e) => handleEditEmployee(employee, e)}
                          title="Edit Employee"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          onClick={(e) => handleDeleteEmployee(employee.id, e)}
                          title="Delete Employee"
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
          
          {filteredEmployees.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-2">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No employees found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterDepartment !== 'All' || filterEmploymentType !== 'All' || filterStatus !== 'All'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Get started by adding your first employee'
                }
              </p>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={handleAddEmployee}
              >
                Add Your First Employee
              </button>
            </div>
          )}
        </div>
      )}
        </div>
        
        {/* Deductions Management - 1 column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Deductions</h3>
                <p className="text-sm text-gray-600">Manage salary deductions</p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1 mb-4">
                {deductions.map(deduction => (
                  <div key={deduction.id} className="bg-gray-50 border border-gray-200 rounded-md p-2">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{deduction.name}</h4>
                        <p className="text-[11px] text-gray-600 truncate">{deduction.description}</p>
                      </div>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        <button
                          onClick={() => editDeduction(deduction)}
                          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                          title="Edit deduction"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => deleteDeduction(deduction.id)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title="Delete deduction"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">Value:</span>
                        <span className="text-[11px] font-semibold text-gray-900">
                          {deduction.percentage !== null && deduction.percentage !== undefined
                            ? `${deduction.percentage}%` 
                            : deduction.amount !== null && deduction.amount !== undefined
                            ? `MWK ${(deduction.amount || 0).toLocaleString()}`
                            : 'No value set'
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">Applies to:</span>
                        <span className="text-[11px] font-medium text-gray-700 capitalize">
                          {deduction.appliesTo === 'all' ? 'All' : deduction.appliesTo}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-600">Status:</span>
                        <div className="flex gap-1">
                          {deduction.isStatutory && (
                            <span className="px-1 py-0.5 text-[10px] bg-red-100 text-red-800 rounded font-medium">
                              Statutory
                            </span>
                          )}
                          <span className={`px-1 py-0.5 text-[10px] rounded font-medium ${
                            deduction.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {deduction.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {deductions.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-3">
                      <DollarSign size={32} className="mx-auto" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No deductions</h3>
                    <p className="text-xs text-gray-600 mb-3">Create your first deduction</p>
                    <button
                      onClick={() => {
                        setEditingDeduction(null);
                        setDeductionType('custom');
                        setShowDeductionModal(true);
                      }}
                      className="px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-800 transition-colors"
                    >
                      Add Deduction
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setEditingDeduction(null);
                    setDeductionType('custom');
                    setShowDeductionModal(true);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Plus size={14} className="inline mr-2" />
                  Add Deduction
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Malawi Tax Info</h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>• PAYE: Progressive rates</div>
                  <div>• NPS: 5% employee + 5% employer</div>
                  <div>• First MK 150,000: 0%</div>
                  <div>• Next MK 350,000: 25%</div>
                  <div>• Next MK 2,050,000: 30%</div>
                  <div>• Excess MK 2,550,000: 35%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <EmployeeForm 
              employee={isEditing ? selectedEmployee : null}
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductionModal && (
        <DeductionModal
          deduction={editingDeduction}
          deductionType={deductionType}
          setDeductionType={setDeductionType}
          onClose={() => {
            setShowDeductionModal(false);
            setEditingDeduction(null);
            setDeductionType('custom');
          }}
          onSave={() => {
            setShowDeductionModal(false);
            setEditingDeduction(null);
            setDeductionType('custom');
            loadDeductions();
            setSuccessMessage('Deduction saved successfully');
          }}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;

