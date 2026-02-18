// Define navigation sections with permissions
export const navigationByPermission = {
    // Master Admin sees everything - All sections available
    masterAdmin: [
      {
        label: "Administration",
        items: [
          { href: "/insightbooks/dashboard", icon: "📊", text: "Dashboard" },
          { href: "/insightbooks/tenant-management", icon: "🏢", text: "Business Owner Management" },
          { href: "/insightbooks/global-settings", icon: "⚙️", text: "Global Settings" },
          { href: "/insightbooks/affiliate-system", icon: "🤝", text: "Affiliate Management" },
          { 
            href: "/insightbooks/internal-business", 
            icon: "🏛️", 
            text: "Business Owner Module", 
            expandable: true,
            subItems: [
              { href: "/insightbooks/internal-business/overview", text: "Business Overview" },
              { href: "/insightbooks/internal-business/finances", text: "Financial Management" },
              { href: "/insightbooks/internal-business/staff", text: "Staff Management" },
              { href: "/insightbooks/internal-business/expenses", text: "Expense Tracking" },
              { href: "/insightbooks/internal-business/revenue", text: "Revenue Analytics" },
              { href: "/insightbooks/internal-business/reports", text: "Business Reports" },
            ]
          },
        ],
      },
      {
        label: "Business Owner Controls",
        items: [
          { href: "/tenants/dashboard", icon: "🏠", text: "Business Owner Dashboard" },
          { href: "/users", icon: "👥", text: "User & Role Management" },
          { href: "/financial-setup", icon: "💼", text: "Financial Setup" },
          { href: "/customization", icon: "🎨", text: "System Customization" },
          { href: "/insightbooks/billing", icon: "💰", text: "Billing & Subscriptions" },
          { href: "/insightbooks/audit-logs", icon: "📜", text: "Audit Logs" },
        ],
      },
      {
        label: "Core Features",
        items: [
          { href: "/clients", icon: "🤵", text: "Client Management" },
          { href: "/pos", icon: "🧾", text: "POS" },
          { href: "/quotations", icon: "📄", text: "Quotations" },
          { href: "/invoice", icon: "📝", text: "Invoicing", badge: "3" },
          { href: "/expenses", icon: "💸", text: "Expense Tracking" },
          { href: "/payments", icon: "💳", text: "Payment Processing" },
          { href: "/reports", icon: "📊", text: "Financial Reporting" },
        ],
      },
      {
        label: "Additional Modules",
        items: [
          { href: "/stock", icon: "📦", text: "Stock Management" },
          { href: "/hr/payroll/paye-summary", icon: "📊", text: "PAYE Summary (MRA)" },
          { href: "/hr", icon: "👨‍💼", text: "HR & Payroll" },
          { href: "/pos", icon: "🧾", text: "Point of Sale (POS)" },
          { href: "/affiliate", icon: "🔗", text: "Affiliate System" },
          { href: "/budget", icon: "🧮", text: "Budgeting" },
          { href: "/tax-types", icon: "📑", text: "Tax Types" },
        ],
      },
      {
        label: "Accounting",
        items: [
          // { href: "/general-ledger", icon: "📕", text: "General Ledger" },
          { href: "/journal-entries", icon: "✏️", text: "Journal Entries" },
          { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts" },
          { href: "/capital-account", icon: "💰", text: "Capital Account" },
          { href: "/capital-account/transfers", icon: "🔄", text: "Capital Transfers" },
          { href: "/trial-balance", icon: "⚖️", text: "Trial Balance" },
        ],
      },
    ],
    // Business Owner Management
    userManagement: {
      label: "User Management",
      items: [
        { href: "/users", icon: "👥", text: "User & Role Management", permission: "users.view" },
      ]
    },
    // Core features
    invoices: {
      label: "Invoicing",
      items: [
        { href: "/invoice", icon: "📝", text: "Invoicing", permission: "invoices.view" },
        { href: "/quotations", icon: "📄", text: "Quotations", permission: "invoices.view" },
      ]
    },
    clients: {
      label: "Clients",
      items: [
        { href: "/clients", icon: "🤵", text: "Client Management", permission: "clients.view" },
      ]
    },
    expenses: {
      label: "Expenses",
      items: [
        { href: "/expenses", icon: "💸", text: "Expense Tracking", permission: "expenses.view" },
      ]
    },
    payments: {
      label: "Payments",
      items: [
        { href: "/payments", icon: "💳", text: "Payment Processing", permission: "payments.view" },
      ]
    },
    reports: {
      label: "Reports",
      items: [
        { href: "/reports", icon: "📊", text: "Financial Reporting", permission: "reports.view" },
      ]
    },
    budgets: {
      label: "Budgeting",
      items: [
        { href: "/budget", icon: "🧮", text: "Budgets", permission: "budgets.view" },
      ]
    },
    // Additional modules
    inventory: {
      label: "Inventory",
      items: [
        { href: "/stock", icon: "📦", text: "Stock Management", permission: "inventory.view" },
      ]
    },
    // HR Module
    hr: {
      label: "HR & Payroll",
      items: [
        { href: "/hr/payroll/paye-summary", icon: "📊", text: "PAYE Summary (MRA)", permission: "hr.view" },
        { href: "/hr", icon: "👨‍💼", text: "HR & Payroll", permission: "hr.view" },
      ]
    },
    // Accounting
    accounting: {
      label: "Accounting",
      items: [
        { href: "/journal-entries", icon: "✏️", text: "Journal Entries", permission: "journalEntries.view" },
        { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts", permission: "reports.view" },
        { href: "/capital-account", icon: "💰", text: "Capital Account", permission: "reports.view" },
        { href: "/capital-account/transfers", icon: "🔄", text: "Capital Transfers", permission: "reports.view" },
        { href: "/trial-balance", icon: "⚖️", text: "Trial Balance", permission: "reports.view" },
      ]
    },
    // Dashboard (always displayed)
    dashboard: {
      label: "Dashboard",
      items: [
        { href: "/dashboard", icon: "📊", text: "Dashboard" },
      ]
    },
    // Client portal items
    clientPortal: {
      label: "Client Portal",
      items: [
        { href: "/dashboard", icon: "📊", text: "Dashboard" },
        { href: "/invoices", icon: "📝", text: "My Invoices" },
        { href: "/payments", icon: "💳", text: "Payment History" },
        { href: "/quotes", icon: "📄", text: "My Quotes" },
      ]
    }
  };
  
  // Helper function to check if user has a specific permission
  export const hasPermission = (permissions, permission) => {
    if (!permissions) return false;
    
    // Split the permission string (e.g., "users.view" -> ["users", "view"])
    const [category, action] = permission.split('.');
    
    // Check if the user has the specified permission
    return permissions[category]?.[action] === true;
  };
  
  // Function to build navigation based on user permissions
  export const buildUserNavigation = (user) => {
    if (!user || !user.role) {
      return [navigationByPermission.dashboard];
    }
    
    // Special case for Master Admin role - show all sections
    if (user.role.name === 'MASTER_ADMIN') {
      return navigationByPermission.masterAdmin;
    }
    
    // Special case for Client role - show client portal
    if (user.role.name === 'Client') {
      return [navigationByPermission.clientPortal];
    }
    
    // For other roles, build navigation based on permissions
    const sections = [];
    
    // Dashboard is always included
    sections.push(navigationByPermission.dashboard);
    
    // Create a business management section if user has access to any of these
    const businessItems = [];
    
    // Add User & Role Management if user has permission
    if (hasPermission(user.role.permissions, "users.view")) {
      businessItems.push({ 
        href: "/users", 
        icon: "👥", 
        text: "User & Role Management" 
      });
    }
    
    // Add other business management items if relevant permissions exist
    if (hasPermission(user.role.permissions, "settings.view")) {
      businessItems.push({ 
        href: "/financial-setup", 
        icon: "💼", 
        text: "Financial Setup" 
      });
      
      businessItems.push({ 
        href: "/customization", 
        icon: "🎨", 
        text: "System Customization" 
      });
    }
    
    // Add Business Management section if there are any items
    if (businessItems.length > 0) {
      sections.push({
        label: "Business Management",
        items: businessItems
      });
    }
    
    // Create a Core Features section based on permissions
    const coreItems = [];
    
    // Add items based on permissions
    if (hasPermission(user.role.permissions, "clients.view")) {
      coreItems.push({ 
        href: "/clients", 
        icon: "🤵", 
        text: "Client Management" 
      });
    }
    
    if (hasPermission(user.role.permissions, "invoices.view")) {
      coreItems.push({ 
        href: "/pos", 
        icon: "🧾", 
        text: "POS" 
      });
      
      coreItems.push({ 
        href: "/quotations", 
        icon: "📄", 
        text: "Quotations" 
      });
      
      coreItems.push({ 
        href: "/invoice", 
        icon: "📝", 
        text: "Invoicing", 
        badge: "3" 
      });
    }
    
    if (hasPermission(user.role.permissions, "expenses.view")) {
      coreItems.push({ 
        href: "/expenses", 
        icon: "💸", 
        text: "Expense Tracking" 
      });
    }
    
    if (hasPermission(user.role.permissions, "payments.view")) {
      coreItems.push({ 
        href: "/payments", 
        icon: "💳", 
        text: "Payment Processing" 
      });
    }
    
    if (hasPermission(user.role.permissions, "reports.view")) {
      coreItems.push({ 
        href: "/reports", 
        icon: "📊", 
        text: "Financial Reporting" 
      });
    }
    
    // Add Core Features section if there are any items
    if (coreItems.length > 0) {
      sections.push({
        label: "Core Features",
        items: coreItems
      });
    }
    
    // Create an Additional Modules section based on permissions
    const additionalItems = [];
    
    if (hasPermission(user.role.permissions, "inventory.view")) {
      additionalItems.push({ 
        href: "/stock", 
        icon: "📦", 
        text: "Stock Management" 
      });
    }

    if (hasPermission(user.role.permissions, "budgets.view")) {
      additionalItems.push({
        href: "/budget",
        icon: "🧮",
        text: "Budgeting"
      });
    }
    
    // Enable HR Module if user has hr.view permission
    if (hasPermission(user.role.permissions, "hr.view")) {
      sections.push({
        label: "HR & Payroll",
        items: [
          { href: "/hr/payroll/paye-summary", icon: "📊", text: "PAYE Summary (MRA)" },
          { href: "/hr", icon: "👨‍💼", text: "HR & Payroll" },
        ]
      });
    }
    
    // Add more additional modules based on permissions
    if (hasPermission(user.role.permissions, "invoices.view")) {
      additionalItems.push({ 
        href: "/pos", 
        icon: "🧾", 
        text: "Point of Sale (POS)" 
      });
    }
    
    if (hasPermission(user.role.permissions, "reports.view")) {
      additionalItems.push({ 
        href: "/tax-types", 
        icon: "📑", 
        text: "Tax Management" 
      });
    }
    
    // Add Additional Modules section if there are any items
    if (additionalItems.length > 0) {
      sections.push({
        label: "Additional Modules",
        items: additionalItems
      });
    }
    
    // Only show accounting section if user has reports view permission
    if (hasPermission(user.role.permissions, "reports.view")) {
      sections.push({
        label: "Accounting",
        items: [
          ...(hasPermission(user.role.permissions, "generalLedger.view")
            ? [{ href: "/general-ledger", icon: "📕", text: "General Ledger" }]
            : []),
          { href: "/journal-entries", icon: "✏️", text: "Journal Entries" },
          { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts" },
          { href: "/capital-account", icon: "💰", text: "Capital Account" },
          { href: "/trial-balance", icon: "⚖️", text: "Trial Balance" },
        ]
      });
    }
    
    return sections;
  };