"use client";

import { useState, useEffect } from "react";
import DynamicSelect from "@/components/DynamicSelect";
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
  CheckCircle,
  FileText,
  Eye,
  Printer,
  CreditCard,
  Ban,
  UserX,
  UserCheck
} from "lucide-react";
import EmployeeIDCardGenerator from "@/components/EmployeeIDCardGenerator";

// Employee Form Component
const EmployeeForm = ({ employee, onSubmit, onCancel, isSubmitting, departments = [], relationships = [], onAddDepartment, onAddRelationship }) => {
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
  const [gratuityAccounts, setGratuityAccounts] = useState([]);
  const [selectedGratuityAccount, setSelectedGratuityAccount] = useState('');
  const [salaryCalculation, setSalaryCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [contractFile, setContractFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [contractUrl, setContractUrl] = useState(null);
  const [idUrl, setIdUrl] = useState(null);
  const [stepNotice, setStepNotice] = useState({ visible: false, type: "success", message: "" });

  const steps = [
    {
      id: 'personal',
      title: 'Personal Info',
      description: 'Contact & demographic details'
    },
    {
      id: 'employment',
      title: 'Employment Details',
      description: 'Role, dates, and status'
    },
    {
      id: 'compensation',
      title: 'Compensation',
      description: 'Salary, deductions, and calculations'
    },
    {
      id: 'nextOfKin',
      title: 'Next of Kin',
      description: 'Emergency contact information'
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Employment contract & ID documents'
    }
  ];

  const requiredFieldsByStep = {
    0: [
      { field: 'name', label: 'Full Name' }
      // Email is optional - removed from required fields
    ],
    1: [
      { field: 'jobTitle', label: 'Job Title' },
      { field: 'startDate', label: 'Start Date' }
    ]
  };

  useEffect(() => {
    setCurrentStep(0);
    setStepNotice({ visible: false, type: "success", message: "" });
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
      
      // Load documents if they exist
      const bankDetails = (employee.bankDetails && typeof employee.bankDetails === 'object') 
        ? employee.bankDetails 
        : {};
      const documents = bankDetails.documents || {};
      
      if (documents.contract) {
        setContractUrl(documents.contract);
      }
      if (documents.nationalId) {
        setIdUrl(documents.nationalId);
      }
      
      // Reset salary calculation when editing
      setSalaryCalculation(null);
    }
  }, [employee]);

  const showStepNotice = (type, message) => {
    setStepNotice({ visible: true, type, message });
    setTimeout(() => {
      setStepNotice((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Fetch deductions when employment type changes
  useEffect(() => {
    fetchDeductions();
    fetchGratuityAccounts();
  }, [formData.employmentType]);

  // Load selected deductions when deductions are fetched and employee has selectedDeductions
  useEffect(() => {
    if (employee && employee.selectedDeductions && Array.isArray(employee.selectedDeductions) && deductions.length > 0) {
      const selectedDeductionObjects = deductions.filter(d => 
        employee.selectedDeductions.includes(d.id)
      );
      setSelectedDeductions(selectedDeductionObjects);
    }
    
    // Load gratuity account if employee has one
    if (employee && employee.gratuityAccount) {
      setSelectedGratuityAccount(employee.gratuityAccount.id);
    }
  }, [employee, deductions]);

  const fetchDeductions = async () => {
    try {
      const response = await fetch('/api/deductions');
      const data = await response.json();
      const availableDeductions = data.deductions || [];
      setDeductions(availableDeductions);

      if (!employee) {
        // IMPORTANT: Statutory deductions (PAYE, NPS) are OPTIONAL and must NOT be applied by default.
        // Users explicitly enable them per employee.
        setSelectedDeductions([]);
      }
    } catch (error) {
      console.error('Error fetching deductions:', error);
    }
  };

  const fetchGratuityAccounts = async () => {
    try {
      const response = await fetch('/api/gratuity');
      const data = await response.json();
      const accounts = data.gratuityAccounts || [];
      setGratuityAccounts(accounts);
    } catch (error) {
      console.error('Error fetching gratuity accounts:', error);
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

  const buildEmergencyContact = () => {
    const { nextOfKinName, nextOfKinRelationship, nextOfKinPhone, nextOfKinAddress } = formData;
    const hasNextOfKin = [nextOfKinName, nextOfKinRelationship, nextOfKinPhone, nextOfKinAddress]
      .some(value => value && value.toString().trim() !== "");

    return hasNextOfKin
      ? {
          name: nextOfKinName || undefined,
          relationship: nextOfKinRelationship || undefined,
          phone: nextOfKinPhone || undefined,
          address: nextOfKinAddress || undefined
        }
      : null;
  };

  const uploadDocumentsIfNeeded = async () => {
    // Start with already-known URLs (existing documents)
    const documents = {};
    if (contractUrl) documents.contract = contractUrl;
    if (idUrl) documents.nationalId = idUrl;

    if (!contractFile && !idFile) {
      return documents;
    }

    setUploadingDocuments(true);
    try {
      const uploadPromises = [];

      if (contractFile) {
        const contractFormData = new FormData();
        contractFormData.append('file', contractFile);
        contractFormData.append('type', 'contract');
        uploadPromises.push(
          fetch('/api/employees/upload-document', {
            method: 'POST',
            body: contractFormData
          }).then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || data.details || 'Failed to upload contract');
            }
            if (data.url) {
              documents.contract = data.url;
            } else {
              throw new Error('No URL returned from upload');
            }
          })
        );
      }

      if (idFile) {
        const idFormData = new FormData();
        idFormData.append('file', idFile);
        idFormData.append('type', 'nationalId');
        uploadPromises.push(
          fetch('/api/employees/upload-document', {
            method: 'POST',
            body: idFormData
          }).then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || data.details || 'Failed to upload ID document');
            }
            if (data.url) {
              documents.nationalId = data.url;
            } else {
              throw new Error('No URL returned from upload');
            }
          })
        );
      }

      await Promise.all(uploadPromises);
      return documents;
    } finally {
      setUploadingDocuments(false);
    }
  };

  const buildStepSubmitData = async ({ stepIndex, keepOpen, formEvent }) => {
    const emergencyContact = buildEmergencyContact();
    const isDocumentsStep = stepIndex === steps.length - 1;

    let documents;
    if (isDocumentsStep) {
      documents = await uploadDocumentsIfNeeded();
    }

    // CREATE flow: always submit the full payload on the final step.
    // (Per-tab partial submit is for EDIT mode only.)
    if (!employee) {
      const {
        nextOfKinName,
        nextOfKinRelationship,
        nextOfKinPhone,
        nextOfKinAddress,
        ...formWithoutKin
      } = formData;

      const sendEmailCheckbox = formEvent?.target?.querySelector?.('input[name="sendEmail"]');
      const sendEmail = sendEmailCheckbox ? sendEmailCheckbox.checked : false;

      const submitData = {
        ...formWithoutKin,
        grossSalary: formData.grossSalary,
        selectedDeductions: selectedDeductions.map(d => d.id),
        gratuityAccountId: selectedGratuityAccount && selectedGratuityAccount.trim() !== '' ? selectedGratuityAccount : null,
        salaryCalculation: salaryCalculation,
        emergencyContact,
        documents: documents && Object.keys(documents).length > 0 ? documents : undefined,
        sendEmail
      };

      await onSubmit(submitData, keepOpen ? { keepOpen: true } : undefined);
      return;
    }

    // EDIT flow: only send the fields for the current tab/step (prevents overwriting other sections)
    const base = {};

    if (stepIndex === 0) {
      Object.assign(base, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        idNumber: formData.idNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        maritalStatus: formData.maritalStatus,
        nationality: formData.nationality,
        address: formData.address,
      });
    } else if (stepIndex === 1) {
      Object.assign(base, {
        jobTitle: formData.jobTitle,
        department: formData.department,
        employmentType: formData.employmentType,
        startDate: formData.startDate,
        workLocation: formData.workLocation,
        isActive: formData.isActive,
      });
    } else if (stepIndex === 2) {
      Object.assign(base, {
        grossSalary: formData.grossSalary,
        selectedDeductions: selectedDeductions.map(d => d.id),
        gratuityAccountId: selectedGratuityAccount && selectedGratuityAccount.trim() !== '' ? selectedGratuityAccount : null,
      });
    } else if (stepIndex === 3) {
      Object.assign(base, {
        emergencyContact,
      });
    } else if (stepIndex === 4) {
      Object.assign(base, {
        documents: documents && Object.keys(documents).length > 0 ? documents : undefined,
      });
    }

    await onSubmit(base, keepOpen ? { keepOpen: true } : undefined);
  };

  const handleSaveCurrentStep = async () => {
    try {
      if (!validateStep(currentStep)) return;
      await buildStepSubmitData({ stepIndex: currentStep, keepOpen: true });
      showStepNotice("success", "Saved successfully");
    } catch (error) {
      console.error('Error saving current step:', error);
      showStepNotice("error", error.message || "Failed to save");
      alert(error.message || 'Failed to save. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // For create mode, only allow submission on the final step
    if (!employee && currentStep !== steps.length - 1) {
      return;
    }

    try {
      if (!validateStep(currentStep)) return;
      // Final submit closes the modal by default
      await buildStepSubmitData({ stepIndex: currentStep, keepOpen: false, formEvent: e });
    } catch (error) {
      console.error('Error submitting employee form:', error);
      showStepNotice("error", error.message || "Failed to save");
      alert(error.message || 'Failed to save. Please try again.');
    }
  };

  const validateStep = (stepIndex) => {
    const rules = requiredFieldsByStep[stepIndex];
    if (!rules) {
      return true;
    }

    const missing = rules.filter(({ field }) => {
      const value = formData[field];
      return value === undefined || value === null || value.toString().trim() === '';
    });

    if (missing.length > 0) {
      const missingLabels = missing.map(rule => rule.label).join(', ');
      alert(`Please fill in the required fields: ${missingLabels}`);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index) => {
    // Allow navigation to any step
    setCurrentStep(index);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{employee ? "Edit Employee" : "Add New Employee"}</h2>
        <button className="text-gray-500 hover:text-gray-700" onClick={onCancel}>
          <X size={20} />
        </button>
      </div>

      {stepNotice.visible && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            stepNotice.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {stepNotice.message}
        </div>
      )}

      <div className="mb-6">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            return (
              <li key={step.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(index)}
                  className="flex flex-col items-start text-left sm:items-center sm:text-center focus:outline-none cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                      isCompleted
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : isActive
                          ? 'border-blue-600 text-blue-600 bg-blue-50'
                          : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={18} className="text-white" /> : index + 1}
                  </span>
                  <span className={`mt-2 text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-blue-600' : 'text-gray-700'}`}>
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:block">{step.description}</span>
                </button>
                {index < steps.length - 1 && (
                  <span
                    className={`mx-2 hidden h-0.5 flex-1 sm:block ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-lg border border-gray-200 p-4">
          {currentStep === 0 && (
            <>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-gray-400 text-xs">(Optional)</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
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
            </>
          )}

          {currentStep === 1 && (
            <>
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
                  <DynamicSelect
                    value={formData.department}
                    onChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
                    options={departments}
                    placeholder="Select or add department"
                    searchPlaceholder="Search departments..."
                    addNewPlaceholder="Enter new department..."
                    onAddOption={onAddDepartment}
                    label="Department"
                    className=""
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
            </>
          )}

          {currentStep === 2 && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Compensation &amp; Deductions</h3>
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
              </div>

              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">Salary Deductions</h4>
                <p className="text-xs text-gray-500 mb-2">
                  Select deductions to apply to this employee. <strong>PAYE (Malawi Income Tax 2025/26) is optional</strong> and can be enabled/disabled per employee.
                </p>
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
                              {deduction.name && deduction.name.toLowerCase().includes('paye') ? (
                                <span className="text-blue-600 font-medium">Auto-calculated</span>
                              ) : deduction.name && (deduction.name.toLowerCase().includes('nps') || deduction.name.toLowerCase().includes('pension')) ? (
                                <span className="text-blue-600 font-medium">Auto-calculated (5% + 5%)</span>
                              ) : deduction.percentage !== null && deduction.percentage !== undefined
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

              {/* Gratuity Selection */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">Gratuity Account (Optional)</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Select a gratuity account to accumulate gratuity for this employee. Gratuity is calculated as a percentage of salary and accumulates over time. It is NOT deducted from salary but will be paid to the employee after the specified period.
                </p>
                <select
                  value={selectedGratuityAccount}
                  onChange={(e) => setSelectedGratuityAccount(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Gratuity Account</option>
                  {gratuityAccounts
                    .filter(account => !employee || account.employeeId === employee.id)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.employee?.name || 'Employee'} - Accrued: MWK {(account.totalAccrued || 0).toLocaleString()}
                      </option>
                    ))}
                </select>
                {!employee && gratuityAccounts.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    No gratuity accounts available. Create a gratuity account in the Gratuity Management section first.
                  </p>
                )}
                {selectedGratuityAccount && (
                  <p className="text-xs text-blue-600 mt-2">
                    ✓ Gratuity will accumulate each month as a percentage of salary. The accumulated amount will be available for payment after the specified period.
                  </p>
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
            </>
          )}

          {currentStep === 3 && (
            <>
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
                  <DynamicSelect
                    value={formData.nextOfKinRelationship}
                    onChange={(value) => setFormData(prev => ({ ...prev, nextOfKinRelationship: value }))}
                    options={relationships}
                    placeholder="Select or add relationship"
                    searchPlaceholder="Search relationships..."
                    addNewPlaceholder="Enter new relationship..."
                    onAddOption={onAddRelationship}
                    label="Relationship"
                    className=""
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="nextOfKinPhone"
                    value={formData.nextOfKinPhone}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus-border-transparent"
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
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus-border-transparent"
                    placeholder="456 Lakeside Drive, Blantyre"
                  />
                </div>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Documents</h3>
              <p className="text-sm text-gray-600 mb-6">Upload employment contract and national ID documents (PDF, JPG, PNG - Max 20MB each)</p>
              
              <div className="space-y-6">
                {/* Employment Contract Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employment Contract</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                    {contractUrl ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="text-blue-600" size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Contract uploaded</p>
                            <a 
                              href={contractUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View document
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContractFile(null);
                            setContractUrl(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          id="contract-upload"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 20 * 1024 * 1024) {
                                alert('File size must be less than 20MB');
                                return;
                              }
                              setContractFile(file);
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="contract-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <FileText className="text-gray-400" size={24} />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PDF, JPG, PNG (MAX. 20MB)</p>
                        </label>
                        {contractFile && (
                          <p className="mt-2 text-sm text-gray-700">{contractFile.name}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* National ID Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">National ID / Identification Document</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
                    {idUrl ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FileText className="text-green-600" size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">ID document uploaded</p>
                            <a 
                              href={idUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View document
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIdFile(null);
                            setIdUrl(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          id="id-upload"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 20 * 1024 * 1024) {
                                alert('File size must be less than 20MB');
                                return;
                              }
                              setIdFile(file);
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="id-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                            <FileText className="text-gray-400" size={24} />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PDF, JPG, PNG (MAX. 20MB)</p>
                        </label>
                        {idFile && (
                          <p className="mt-2 text-sm text-gray-700">{idFile.name}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="mt-4 text-xs text-gray-500 italic">Note: Documents are optional but recommended for record keeping.</p>
              
              {/* Email Notification Option - Only show when creating new employee */}
              {!employee && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="send-welcome-email"
                      name="sendEmail"
                      disabled={!formData.email || formData.email.trim() === ''}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="send-welcome-email" className={`ml-3 block text-sm ${!formData.email || formData.email.trim() === '' ? 'text-gray-500' : 'text-gray-700'}`}>
                      <span className="font-medium">Send welcome email to employee</span>
                      <p className="text-xs text-gray-600 mt-1">
                        {formData.email && formData.email.trim() !== ''
                          ? `Email will be sent to: ${formData.email}`
                          : 'Please provide an email address in Personal Info section to enable this option'}
                      </p>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-4 border-t border-gray-200 mt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="order-2 sm:order-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <div className="flex w-full justify-end gap-3 order-1 sm:order-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back
              </button>
            )}

            {/* Save Button - Available on every tab when editing (keeps modal open) */}
            {employee && (
              <button
                type="button"
                onClick={handleSaveCurrentStep}
                disabled={isSubmitting || uploadingDocuments}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {(isSubmitting || uploadingDocuments) && (
                  <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                Save
              </button>
            )}
            
            {/* Next Button - Show on all steps except the last one */}
            {currentStep < steps.length - 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            )}
            
            {/* Submit Button - Only on the final step */}
            {currentStep === steps.length - 1 && (
              <button
                type="submit"
                disabled={isSubmitting || uploadingDocuments}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(isSubmitting || uploadingDocuments) && (
                  <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                {uploadingDocuments ? 'Uploading Documents...' : (employee ? "Update Employee" : "Create Employee")}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

// Deduction Modal Component
const DeductionModal = ({ deduction, deductionType, setDeductionType, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: deduction?.name || '',
    description: deduction?.description || '',
    type: deduction?.percentage !== null && deduction?.percentage !== undefined ? 'percentage' : 'fixed',
    value: deduction?.percentage !== null && deduction?.percentage !== undefined 
      ? deduction.percentage 
      : deduction?.amount || '',
    isStatutory: deduction?.isStatutory || false,
    isActive: deduction?.isActive !== undefined ? deduction.isActive : true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        isStatutory: formData.isStatutory,
        isActive: formData.isActive,
        type: formData.type
      };

      if (formData.type === 'percentage') {
        payload.percentage = parseFloat(formData.value);
      } else {
        payload.amount = parseFloat(formData.value);
      }

      const url = deduction ? `/api/deductions/${deduction.id}` : '/api/deductions';
      const method = deduction ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save deduction');
      }

      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save deduction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {deduction ? 'Edit Deduction' : 'Create Deduction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              placeholder="e.g., Health Insurance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value, value: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            >
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.type === 'percentage' ? 'Percentage' : 'Amount'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              {formData.type === 'percentage' ? (
                <div className="flex items-center">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 text-gray-500">%</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="absolute left-3 text-gray-500">MK</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isStatutory}
                onChange={(e) => setFormData({ ...formData, isStatutory: e.target.checked })}
                className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <span className="ml-2 text-sm text-gray-700">Statutory Deduction</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <span className="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : deduction ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Employee Management Component
const EmployeeManagement = () => {
  // Add print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        #employee-view-print,
        #employee-view-print * {
          visibility: visible;
        }
        #employee-view-print {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          max-width: 100%;
          box-shadow: none;
          border: none;
        }
        .print\\:hidden {
          display: none !important;
        }
        .print\\:block {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [employees, setEmployees] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [relationships, setRelationships] = useState([
    "Spouse",
    "Child",
    "Parent",
    "Sibling",
    "Grandparent",
    "Grandchild",
    "In-law",
    "Cousin",
    "Friend",
    "Other"
  ]);
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
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showIDCardGenerator, setShowIDCardGenerator] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [employeeToAction, setEmployeeToAction] = useState(null);
  const [statistics, setStatistics] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    totalSalaryExpense: 0
  });

  useEffect(() => {
    loadEmployees();
    loadDeductions();
    loadTenantInfo();
  }, []);

  const loadTenantInfo = async () => {
    try {
      const response = await fetch('/api/account');
      if (response.ok) {
        const data = await response.json();
        setTenantInfo(data);
      }
    } catch (error) {
      console.error('Error loading tenant info:', error);
    }
  };

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
      // Map employees and extract photo URLs from contactDetails
      const employeesWithPhotos = (data.employees || []).map(emp => {
        const contactDetails = emp.contactDetails && typeof emp.contactDetails === 'object' ? emp.contactDetails : {};
        return {
          ...emp,
          photoUrl: contactDetails.photoUrl || contactDetails.photo || emp.photoUrl || emp.photo || null
        };
      });
      setEmployees(employeesWithPhotos);
      
      // Extract unique departments from existing employees
      const uniqueDepartments = [...new Set((data.employees || [])
        .map(e => e.department)
        .filter(d => d && d.trim() !== ""))
      ].sort();
      setDepartments(uniqueDepartments);
      
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

  const handleAddDepartment = async (newDepartment) => {
    if (!departments.includes(newDepartment)) {
      setDepartments(prev => [...prev, newDepartment]);
    }
  };

  const handleAddRelationship = async (newRelationship) => {
    if (!relationships.includes(newRelationship)) {
      setRelationships(prev => [...prev, newRelationship]);
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

  const handleViewEmployee = (employee, e) => {
    if (e) e.stopPropagation();
    setViewingEmployee(employee);
    setShowViewModal(true);
  };

  const handlePrintEmployee = () => {
    const printContent = document.getElementById('employee-view-print');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Employee Details - ${viewingEmployee.name}</title>
            <style>
              @media print {
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .print\\:hidden { display: none !important; }
                .print\\:block { display: block !important; }
                @page { margin: 1cm; }
                h2, h3 { color: #000; }
                .bg-gray-50 { background-color: #f9fafb; }
                .bg-white { background-color: #fff; }
                .text-gray-900 { color: #111827; }
                .text-gray-600 { color: #4b5563; }
                .border { border: 1px solid #e5e7eb; }
                .rounded-lg { border-radius: 0.5rem; }
                .p-4 { padding: 1rem; }
                .mb-4 { margin-bottom: 1rem; }
                .space-y-3 > * + * { margin-top: 0.75rem; }
                a { color: #2563eb; text-decoration: underline; }
              }
              body { font-family: Arial, sans-serif; padding: 20px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      // Fallback to regular print if popup is blocked
      window.print();
    }
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

  const handleTerminateEmployee = (employee, e) => {
    if (e) e.stopPropagation();
    setEmployeeToAction(employee);
    setShowTerminateModal(true);
  };

  const handleSuspendEmployee = (employee, e) => {
    if (e) e.stopPropagation();
    setEmployeeToAction(employee);
    setShowSuspendModal(true);
  };

  const handleReactivateEmployee = async (employee, e) => {
    if (e) e.stopPropagation();
    
    if (confirm(`Are you sure you want to reactivate ${employee.name}?`)) {
      try {
        const response = await fetch(`/api/employees/${employee.id}/reactivate`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Please log in to reactivate employees. Authentication required.');
            return;
          }
          throw new Error('Failed to reactivate employee');
        }
        
        const data = await response.json();
        setEmployees(employees.map(e => 
          e.id === employee.id ? data.employee : e
        ));
        setSuccessMessage('Employee reactivated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        loadEmployees(); // Refresh statistics
      } catch (error) {
        console.error(`Error reactivating employee ${employee.id}:`, error);
        alert("Failed to reactivate employee. Please try again.");
      }
    }
  };

  const handleTerminateSubmit = async (formData) => {
    try {
      const response = await fetch(`/api/employees/${employeeToAction.id}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to terminate employees. Authentication required.');
          return;
        }
        throw new Error('Failed to terminate employee');
      }
      
      const data = await response.json();
      setEmployees(employees.map(e => 
        e.id === employeeToAction.id ? data.employee : e
      ));
      setSuccessMessage('Employee terminated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setShowTerminateModal(false);
      setEmployeeToAction(null);
      loadEmployees(); // Refresh statistics
    } catch (error) {
      console.error('Error terminating employee:', error);
      alert("Failed to terminate employee. Please try again.");
    }
  };

  const handleSuspendSubmit = async (formData) => {
    try {
      const response = await fetch(`/api/employees/${employeeToAction.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to suspend employees. Authentication required.');
          return;
        }
        throw new Error('Failed to suspend employee');
      }
      
      const data = await response.json();
      setEmployees(employees.map(e => 
        e.id === employeeToAction.id ? data.employee : e
      ));
      setSuccessMessage('Employee suspended successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setShowSuspendModal(false);
      setEmployeeToAction(null);
      loadEmployees(); // Refresh statistics
    } catch (error) {
      console.error('Error suspending employee:', error);
      alert("Failed to suspend employee. Please try again.");
    }
  };

  const handleFormSubmit = async (formData, options = {}) => {
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
      
      // If saving a single tab while editing, keep the form open.
      if (!options.keepOpen) {
        setIsFormOpen(false);
      }
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

  const departmentFilterOptions = [...new Set(employees.map(e => e.department).filter(Boolean))];

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
        <div className="flex gap-2">
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center gap-2 hover:bg-green-700"
            onClick={() => setShowIDCardGenerator(true)}
            title="Generate Employee ID Cards"
          >
            <CreditCard size={16} />
            <span>Generate ID Cards</span>
          </button>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
            onClick={handleAddEmployee}
          >
            <Plus size={16} />
            <span>Add Employee</span>
          </button>
        </div>
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
              {departmentFilterOptions.map(dept => (
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
                        employee.status === 'Active' && employee.isActive
                          ? 'bg-green-100 text-green-800'
                          : employee.status === 'Suspended'
                          ? 'bg-yellow-100 text-yellow-800'
                          : employee.status === 'Terminated'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status || (employee.isActive ? 'Active' : 'Inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-right whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <button 
                          className="text-green-600 hover:text-green-800 p-1 rounded"
                          onClick={(e) => handleViewEmployee(employee, e)}
                          title="View Employee"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          onClick={(e) => handleEditEmployee(employee, e)}
                          title="Edit Employee"
                        >
                          <Edit size={16} />
                        </button>
                        {(employee.status === 'Active' || employee.isActive) && (
                          <>
                            <button 
                              className="text-yellow-600 hover:text-yellow-800 p-1 rounded"
                              onClick={(e) => handleSuspendEmployee(employee, e)}
                              title="Suspend Employee"
                            >
                              <Ban size={16} />
                            </button>
                            <button 
                              className="text-orange-600 hover:text-orange-800 p-1 rounded"
                              onClick={(e) => handleTerminateEmployee(employee, e)}
                              title="Terminate Employee"
                            >
                              <UserX size={16} />
                            </button>
                          </>
                        )}
                        {(employee.status === 'Suspended' || employee.status === 'Terminated') && (
                          <button 
                            className="text-green-600 hover:text-green-800 p-1 rounded"
                            onClick={(e) => handleReactivateEmployee(employee, e)}
                            title="Reactivate Employee"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
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
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Malawi Tax Info (2025/26)</h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>• PAYE: Progressive rates</div>
                  <div>• NPS: 5% employee + 5% employer</div>
                  <div>• Up to MK 170,000: 0% (tax-free)</div>
                  <div>• MK 170,001 – 1,570,000: 30%</div>
                  <div>• MK 1,570,001 – 10,000,000: 35%</div>
                  <div>• Above MK 10,000,000: 40%</div>
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
              departments={departments}
              relationships={relationships}
              onAddDepartment={handleAddDepartment}
              onAddRelationship={handleAddRelationship}
            />
          </div>
        </div>
      )}

      {/* Employee View Modal */}
      {showViewModal && viewingEmployee && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
          <div 
            id="employee-view-print" 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Print Header - Only visible when printing */}
            <div className="hidden print:block print:mb-6 print:border-b print:pb-4">
              <h1 className="text-2xl font-bold">Employee Details</h1>
              <p className="text-gray-600">Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                    {viewingEmployee.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{viewingEmployee.name}</h2>
                    <p className="text-gray-600">{viewingEmployee.email}</p>
                    <p className="text-sm text-gray-500">Employee ID: {viewingEmployee.employeeId || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrintEmployee}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 print:hidden"
                    title="Print Employee Details"
                  >
                    <Printer size={18} />
                    Print
                  </button>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-gray-500 hover:text-gray-700 print:hidden"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User size={20} />
                    Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Full Name:</span>
                      <p className="text-gray-900">{viewingEmployee.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Email:</span>
                      <p className="text-gray-900">{viewingEmployee.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Phone:</span>
                      <p className="text-gray-900">{viewingEmployee.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Date of Birth:</span>
                      <p className="text-gray-900">
                        {viewingEmployee.dateOfBirth 
                          ? new Date(viewingEmployee.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Gender:</span>
                      <p className="text-gray-900">{viewingEmployee.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Marital Status:</span>
                      <p className="text-gray-900">{viewingEmployee.maritalStatus || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Nationality:</span>
                      <p className="text-gray-900">{viewingEmployee.nationality || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">National ID:</span>
                      <p className="text-gray-900">{viewingEmployee.idNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Address:</span>
                      <p className="text-gray-900">{viewingEmployee.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Employment Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Briefcase size={20} />
                    Employment Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Employee ID:</span>
                      <p className="text-gray-900">{viewingEmployee.employeeId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Job Title:</span>
                      <p className="text-gray-900">{viewingEmployee.jobTitle || viewingEmployee.position || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Department:</span>
                      <p className="text-gray-900">{viewingEmployee.department || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Employment Type:</span>
                      <p className="text-gray-900">{viewingEmployee.employmentType || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Start Date:</span>
                      <p className="text-gray-900">
                        {viewingEmployee.startDate 
                          ? new Date(viewingEmployee.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Work Location:</span>
                      <p className="text-gray-900">{viewingEmployee.workLocation || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Status:</span>
                      <span className={`ml-2 px-2.5 py-1 rounded-full text-xs ${
                        viewingEmployee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {viewingEmployee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compensation Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign size={20} />
                    Compensation
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Gross Salary:</span>
                      <p className="text-gray-900 font-semibold">
                        {viewingEmployee.grossSalary ? formatCurrency(viewingEmployee.grossSalary) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Net Salary:</span>
                      <p className="text-gray-900 font-semibold">
                        {viewingEmployee.salary ? formatCurrency(viewingEmployee.salary) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Hourly Rate:</span>
                      <p className="text-gray-900">
                        {viewingEmployee.hourlyRate ? formatCurrency(viewingEmployee.hourlyRate) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                {viewingEmployee.emergencyContact && typeof viewingEmployee.emergencyContact === 'object' && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Phone size={20} />
                      Emergency Contact
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Name:</span>
                        <p className="text-gray-900">{viewingEmployee.emergencyContact.name || viewingEmployee.emergencyContact.fullName || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Relationship:</span>
                        <p className="text-gray-900">{viewingEmployee.emergencyContact.relationship || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Phone:</span>
                        <p className="text-gray-900">{viewingEmployee.emergencyContact.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Address:</span>
                        <p className="text-gray-900">{viewingEmployee.emergencyContact.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Documents */}
                {(() => {
                  const bankDetails = (viewingEmployee.bankDetails && typeof viewingEmployee.bankDetails === 'object') 
                    ? viewingEmployee.bankDetails 
                    : {};
                  const documents = bankDetails.documents || {};
                  
                  if (documents.contract || documents.nationalId) {
                    return (
                      <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <FileText size={20} />
                          Documents
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {documents.contract && (
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <span className="text-sm font-medium text-gray-600 block mb-1">Employment Contract</span>
                              <a 
                                href={documents.contract} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <FileText size={14} />
                                View Document
                              </a>
                            </div>
                          )}
                          {documents.nationalId && (
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <span className="text-sm font-medium text-gray-600 block mb-1">National ID</span>
                              <a 
                                href={documents.nationalId} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <FileText size={14} />
                                View Document
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Print Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 print:block hidden print:mt-8">
                <p className="text-xs text-gray-500 text-center">
                  This document was generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ID Card Generator */}
      {showIDCardGenerator && (
        <EmployeeIDCardGenerator
          employees={employees}
          tenantInfo={tenantInfo}
          onClose={() => {
            setShowIDCardGenerator(false);
            // Reload employees to get updated photo URLs
            loadEmployees();
          }}
        />
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

      {/* Terminate Employee Modal */}
      {showTerminateModal && employeeToAction && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Terminate Employee</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => {
                  setShowTerminateModal(false);
                  setEmployeeToAction(null);
                }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">Are you sure you want to terminate <strong>{employeeToAction.name}</strong>?</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleTerminateSubmit({
                  terminationDate: formData.get('terminationDate'),
                  terminationReason: formData.get('terminationReason'),
                  sendEmail: formData.get('sendEmail') === 'on'
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Termination Date *
                    </label>
                    <input
                      type="date"
                      name="terminationDate"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Termination Reason
                    </label>
                    <textarea
                      name="terminationReason"
                      rows={4}
                      placeholder="Enter reason for termination..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="sendEmail"
                      id="terminate-send-email"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="terminate-send-email" className="ml-2 block text-sm text-gray-700">
                      Send email notification to employee
                    </label>
                  </div>
                  {employeeToAction?.email && (
                    <p className="text-xs text-gray-500 ml-6">
                      Email will be sent to: {employeeToAction.email}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTerminateModal(false);
                      setEmployeeToAction(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Terminate Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Employee Modal */}
      {showSuspendModal && employeeToAction && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Suspend Employee</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => {
                  setShowSuspendModal(false);
                  setEmployeeToAction(null);
                }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">Suspend <strong>{employeeToAction.name}</strong> from work?</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleSuspendSubmit({
                  suspendedFrom: formData.get('suspendedFrom'),
                  suspendedTo: formData.get('suspendedTo'),
                  suspensionReason: formData.get('suspensionReason'),
                  sendEmail: formData.get('sendEmail') === 'on'
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suspension Start Date *
                    </label>
                    <input
                      type="date"
                      name="suspendedFrom"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suspension End Date (Optional)
                    </label>
                    <input
                      type="date"
                      name="suspendedTo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite suspension</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suspension Reason
                    </label>
                    <textarea
                      name="suspensionReason"
                      rows={4}
                      placeholder="Enter reason for suspension..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="sendEmail"
                      id="suspend-send-email"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="suspend-send-email" className="ml-2 block text-sm text-gray-700">
                      Send email notification to employee
                    </label>
                  </div>
                  {employeeToAction?.email && (
                    <p className="text-xs text-gray-500 ml-6">
                      Email will be sent to: {employeeToAction.email}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuspendModal(false);
                      setEmployeeToAction(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Suspend Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

