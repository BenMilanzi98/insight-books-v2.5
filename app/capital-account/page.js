"use client";
import CapitalAccountManager from "@/components/CapitalAccountManager";
import { Wallet } from "lucide-react";

const CapitalAccountPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-3">
              <h1 className="text-2xl font-bold text-gray-900">Capital Account Management</h1>
              <p className="text-sm text-gray-600">
                Manage your business capital, set initial balances, and transfer funds between accounts
              </p>
            </div>
          </div>
        </div>

        {/* Capital Account Manager Component */}
        <CapitalAccountManager />
      </div>
    </div>
  );
};

export default CapitalAccountPage; 