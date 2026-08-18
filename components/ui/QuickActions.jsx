import React from 'react';
import { tx } from '@/lib/i18n/runtime';
import { 
  Camera, Upload, RefreshCw, BarChart, Users, Building2, 
  CreditCard, Settings, FileText, DollarSign, Edit, Mail 
} from 'lucide-react';

const QuickActions = ({ 
  title = {tt('Quick Actions')}, 
  actions = [], 
  columns = 4, 
  variant = "default",
  className = "",
  onActionClick 
}) => {
  const getGridCols = (cols) => {
    const gridMap = {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    };
    return gridMap[cols] || gridMap[4];
  };

  const getVariantStyles = (variant) => {
    const variants = {
      default: {
        container: "bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200",
        title: "text-lg font-semibold text-gray-900",
        action: "bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md",
        icon: "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600"
      },
      elevated: {
        container: "bg-white rounded-xl shadow-lg border-0",
        title: "text-xl font-bold text-gray-900",
        action: "bg-gradient-to-br from-white to-gray-50 border-0 shadow-md hover:shadow-lg hover:scale-105",
        icon: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm"
      },
      minimal: {
        container: "bg-transparent border-0 shadow-none",
        title: "text-lg font-medium text-gray-700",
        action: "bg-gray-50 hover:bg-gray-100 border-0",
        icon: "bg-gray-200 text-gray-600 group-hover:bg-gray-300"
      }
    };
    return variants[variant] || variants.default;
  };

  const getIconComponent = (iconName) => {
    const iconMap = {
      camera: Camera, upload: Upload, refresh: RefreshCw, chart: BarChart,
      users: Users, building: Building2, creditCard: CreditCard, settings: Settings,
      fileText: FileText, dollarSign: DollarSign, edit: Edit, mail: Mail
    };
    
    const IconComponent = iconMap[iconName] || BarChart;
    return <IconComponent className="w-5 h-5" />;
  };

  const styles = getVariantStyles(variant);

  if (!actions || actions.length === 0) return null;

  return (
    <div className={`rounded-lg p-6 ${styles.container} ${className}`}>
      {title && (
        <h3 className={`mb-6 ${styles.title} animate-fade-in`}>
          {tx(title)}
        </h3>
      )}
      
      <div className={`grid ${getGridCols(columns)} gap-4`}>
        {actions.map((action, index) => (
          <button
            key={action.id || index}
            className={`group relative overflow-hidden rounded-lg p-4 cursor-pointer transition-all duration-300 transform hover:scale-105 ${styles.action} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 animate-fade-in-up`}
            onClick={() => onActionClick?.(action)}
            style={{ animationDelay: `${index * 100}ms` }}
            aria-label={tx(action.title)}
            title={tx(action.description)}
          >
            <div className="relative z-10 text-left">
              <div className="flex items-center mb-3">
                <div className={`rounded-full p-3 mr-3 transition-all duration-300 ${styles.icon}`}>
                  {getIconComponent(action.icon)}
                </div>
                <h4 className="font-medium text-gray-900 group-hover:text-blue-900 transition-colors duration-200">
                  {tx(action.title)}
                </h4>
              </div>
              
              {action.description && (
                <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">
                  {tx(action.description)}
                </p>
              )}
              
              <div className="absolute bottom-0 left-0 w-0 h-1 bg-blue-500 group-hover:w-full transition-all duration-300 ease-out" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const QuickActionPresets = {
  expenses: [
    {
      id: 'scan-receipt',
      title: 'Scan Receipt',
      description: 'Automatically extract details from receipts',
      icon: 'camera',
      action: 'scan'
    },
    {
      id: 'upload-receipt',
      title: 'Upload Receipt',
      description: 'Upload receipt images or PDFs',
      icon: 'upload',
      action: 'upload'
    },
    {
      id: 'recurring-expense',
      title: 'Recurring Expense',
      description: 'Set up regular, scheduled expenses',
      icon: 'refresh',
      action: 'recurring'
    },
    {
      id: 'expense-report',
      title: 'Expense Report',
      description: 'Generate detailed expense reports',
      icon: 'chart',
      action: 'report'
    }
  ],
  
  admin: [
    {
      id: 'manage-users',
      title: 'Manage Users',
      description: 'View and manage user accounts',
      icon: 'users',
      action: 'users'
    },
    {
      id: 'view-companies',
      title: 'View Companies',
      description: 'Browse company information',
      icon: 'building',
      action: 'companies'
    },
    {
      id: 'subscriptions',
      title: 'Subscriptions',
      description: 'Manage subscription plans',
      icon: 'creditCard',
      action: 'subscriptions'
    },
    {
      id: 'system-settings',
      title: 'System Settings',
      description: 'Configure system preferences',
      icon: 'settings',
      action: 'settings'
    }
  ],
  
  clients: [
    {
      id: 'create-invoice',
      title: 'Create Invoice',
      description: 'Generate new invoice for client',
      icon: 'fileText',
      action: 'invoice'
    },
    {
      id: 'record-payment',
      title: 'Record Payment',
      description: 'Log payment received',
      icon: 'dollarSign',
      action: 'payment'
    },
    {
      id: 'edit-profile',
      title: 'Edit Profile',
      description: 'Update client information',
      icon: 'edit',
      action: 'edit'
    },
    {
      id: 'send-email',
      title: 'Send Email',
      description: 'Communicate with client',
      icon: 'mail',
      action: 'email'
    }
  ]
};

export default QuickActions; 