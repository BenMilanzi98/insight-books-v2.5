"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, User, UserPlus, X } from "lucide-react";

const ApprovalWorkflowForm = ({ initialWorkflow, onSave, onCancel }) => {
  const [workflow, setWorkflow] = useState(
    initialWorkflow || {
      name: "",
      description: "",
      triggerType: "amount",
      threshold: 50000,
      enabled: true,
      approvers: [],
      steps: [
        {
          name: "First Approval",
          approverType: "role",
          approverValue: "",
          timeLimit: 24
        }
      ]
    }
  );

  const [expanded, setExpanded] = useState(true);

  // Available roles for approval
  const availableRoles = [
    { id: "admin", name: "Admin" },
    { id: "finance_manager", name: "Finance Manager" },
    { id: "department_head", name: "Department Head" },
    { id: "accountant", name: "Accountant" }
  ];

  // Trigger types
  const triggerTypes = [
    { id: "amount", name: "Transaction Amount" },
    { id: "type", name: "Transaction Type" },
    { id: "vendor", name: "Specific Vendor" }
  ];

  // Add a new approval step
  const addApprovalStep = () => {
    setWorkflow({
      ...workflow,
      steps: [
        ...workflow.steps,
        {
          name: `Step ${workflow.steps.length + 1}`,
          approverType: "role",
          approverValue: "",
          timeLimit: 24
        }
      ]
    });
  };

  // Remove an approval step
  const removeApprovalStep = (index) => {
    const newSteps = [...workflow.steps];
    newSteps.splice(index, 1);
    setWorkflow({
      ...workflow,
      steps: newSteps
    });
  };

  // Update a step field
  const updateStepField = (index, field, value) => {
    const newSteps = [...workflow.steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };
    setWorkflow({
      ...workflow,
      steps: newSteps
    });
  };

  // Update workflow field
  const updateWorkflowField = (field, value) => {
    setWorkflow({
      ...workflow,
      [field]: value
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div 
        className="bg-gray-50 p-4 border-b flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <h3 className="font-medium text-gray-900">
            {workflow.name || "New Approval Workflow"}
          </h3>
          {workflow.enabled && (
            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {tt('Enabled')}
            </span>
          )}
        </div>
        <button className="text-gray-500">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <>
          <div className="p-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tt('Workflow Name')}
                </label>
                <input
                  type="text"
                  className="border-gray-300 rounded-md px-3 py-2 w-full"
                  placeholder={tt('e.g., Invoice Approval Process')}
                  value={workflow.name}
                  onChange={(e) => updateWorkflowField("name", e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2 h-full pt-6">
                <label className="inline-flex relative items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={workflow.enabled}
                    onChange={() => updateWorkflowField("enabled", !workflow.enabled)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-sm text-gray-700">
                  {workflow.enabled ? "Workflow Enabled" : "Workflow Disabled"}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Description')}
              </label>
              <textarea
                className="border-gray-300 rounded-md px-3 py-2 w-full"
                rows="2"
                placeholder={tt('Describe the purpose of this approval workflow')}
                value={workflow.description}
                onChange={(e) => updateWorkflowField("description", e.target.value)}
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tt('Trigger Type')}
                </label>
                <select
                  className="border-gray-300 rounded-md px-3 py-2 w-full"
                  value={workflow.triggerType}
                  onChange={(e) => updateWorkflowField("triggerType", e.target.value)}
                >
                  {triggerTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {workflow.triggerType === "amount" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tt('Amount Threshold')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      className="border-gray-300 rounded-md pl-7 px-3 py-2 w-full"
                      placeholder="50000"
                      value={workflow.threshold}
                      onChange={(e) => updateWorkflowField("threshold", parseFloat(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {tt('Transactions above this amount will require approval')}
                  </p>
                </div>
              )}

              {workflow.triggerType === "type" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tt('Transaction Types')}
                  </label>
                  <select
                    className="border-gray-300 rounded-md px-3 py-2 w-full"
                    defaultValue="expense"
                  >
                    <option value="expense">{tt('Expenses')}</option>
                    <option value="invoice">{tt('Invoices')}</option>
                    <option value="purchase_order">{tt('Purchase Orders')}</option>
                    <option value="all">{tt('All Transaction Types')}</option>
                  </select>
                </div>
              )}

              {workflow.triggerType === "vendor" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {tt('Specific Vendors')}
                  </label>
                  <input
                    type="text"
                    className="border-gray-300 rounded-md px-3 py-2 w-full"
                    placeholder={tt('Enter vendor names separated by commas')}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-900">{tt('Approval Steps')}</h3>
              <button
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm flex items-center"
                onClick={addApprovalStep}
              >
                <Plus size={16} className="mr-1" />
                {tt('Add Step')}
              </button>
            </div>

            {workflow.steps.map((step, index) => (
              <div
                key={`step-${index}`}
                className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                      Step {index + 1}
                    </span>
                    <input
                      type="text"
                      className="border-0 bg-transparent font-medium p-0 focus:ring-0"
                      placeholder={tt('Step Name')}
                      value={step.name}
                      onChange={(e) => updateStepField(index, "name", e.target.value)}
                    />
                  </div>
                  {workflow.steps.length > 1 && (
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeApprovalStep(index)}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tt('Approver Type')}
                    </label>
                    <select
                      className="border-gray-300 rounded-md px-3 py-2 w-full"
                      value={step.approverType}
                      onChange={(e) => updateStepField(index, "approverType", e.target.value)}
                    >
                      <option value="role">{tt('Role')}</option>
                      <option value="specific_user">{tt('Specific User')}</option>
                      <option value="department_head">{tt('Department Head')}</option>
                    </select>
                  </div>

                  {step.approverType === "role" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Role')}
                      </label>
                      <select
                        className="border-gray-300 rounded-md px-3 py-2 w-full"
                        value={step.approverValue}
                        onChange={(e) => updateStepField(index, "approverValue", e.target.value)}
                      >
                        <option value="">{tt('Select Role')}</option>
                        {availableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {step.approverType === "specific_user" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Select User')}
                      </label>
                      <div className="relative">
                        <select
                          className="border-gray-300 rounded-md px-3 py-2 w-full"
                          value={step.approverValue}
                          onChange={(e) => updateStepField(index, "approverValue", e.target.value)}
                        >
                          <option value="">{tt('Select User')}</option>
                          <option value="user1">John Doe (Finance)</option>
                          <option value="user2">Jane Smith (Management)</option>
                          <option value="user3">David Wilson (Accounting)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {step.approverType === "department_head" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Department')}
                      </label>
                      <select
                        className="border-gray-300 rounded-md px-3 py-2 w-full"
                        value={step.approverValue}
                        onChange={(e) => updateStepField(index, "approverValue", e.target.value)}
                      >
                        <option value="">{tt('Select Department')}</option>
                        <option value="finance">{tt('Finance')}</option>
                        <option value="operations">{tt('Operations')}</option>
                        <option value="sales">POS</option>
                        <option value="marketing">{tt('Marketing')}</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Limit (Hours)
                    </label>
                    <input
                      type="number"
                      className="border-gray-300 rounded-md px-3 py-2 w-full"
                      placeholder="24"
                      value={step.timeLimit}
                      onChange={(e) => updateStepField(index, "timeLimit", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {tt('Escalate to next level if no response within this timeframe')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Approvers (Optional)
                    </label>
                    <div className="flex border border-gray-300 rounded-md">
                      <input
                        type="text"
                        className="border-0 flex-1 px-3 py-2 rounded-l-md focus:ring-0"
                        placeholder={tt('Add backup approver')}
                      />
                      <button className="bg-gray-100 px-3 border-l border-gray-300 text-gray-500">
                        <UserPlus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm">
                  <div className="flex items-center text-gray-600">
                    <User size={16} className="mr-1" />
                    <span>
                      {step.approverType === "role" 
                        ? availableRoles.find(r => r.id === step.approverValue)?.name || "No role selected" 
                        : step.approverType === "specific_user"
                          ? "Specific user assigned"
                          : "Department head will be assigned"}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {tt('All approval steps must be completed in sequence before a transaction is approved.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 flex justify-end">
            <button 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2"
              onClick={onCancel}
            >
              {tt('Cancel')}
            </button>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              onClick={() => onSave?.(workflow)}
            >
              {tt('Save Workflow')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ApprovalWorkflowForm;