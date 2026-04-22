"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  ChevronDown,
  HelpCircle,
  LifeBuoy,
  ChevronRight,
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  Handshake,
  Landmark,
  BookOpen,
  BookText,
  Scale,
  Wallet,
  Receipt,
  FileText,
  ScrollText,
  CreditCard,
  BarChart3,
  Package,
  ShoppingCart,
  RotateCcw,
  CalendarDays,
  Briefcase,
  Clock,
  TrendingUp,
  FileCheck,
  DollarSign,
  PieChart,
  KeyRound,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { userHasPermission } from "@/lib/permissions";
import { isPosDefaultLandingRole } from "@/lib/tenantRoleAccess";
import { getPlanDisplayName } from "@/lib/subscriptionConfig";
import BranchSwitcher from "./BranchSwitcher";

const iconMap = {
  dashboard: LayoutDashboard,
  tenants: Building2,
  settings: Settings,
  affiliate: Handshake,
  users: Users,
  coa: BookText,
  generalLedger: BookText,
  journal: BookOpen,
  trialBalance: Scale,
  capital: Wallet,
  pos: Receipt,
  quotations: FileText,
  invoicing: ScrollText,
  expenses: Receipt,
  payments: CreditCard,
  reports: BarChart3,
  stock: Package,
  rental: KeyRound,
  Rentals: Building2,
  Hiring: Wrench,
  purchases: ShoppingCart,
  businessModule: Landmark,
  hr: Users,
  gratuity: Wallet,
  advances: CreditCard,
  pension: Landmark,
  reversals: RotateCcw,
  accountingPeriods: CalendarDays,
  // Sub-item icons
  "Employee Management": Users,
  "Leave Management": CalendarDays,
  "Attendance Tracking": Clock,
  "Performance Management": TrendingUp,
  "Payroll Processing": DollarSign,
  "Pension (NPS)": Landmark,
  "Gratuity Management": Wallet,
  "Salary Advances": CreditCard,
  "HR Reports": BarChart3,
  "General Ledger": BookText,
  "Chart of Accounts": BookText,
  "Accounting Periods": CalendarDays,
  "Journal Entries": BookOpen,
  "Capital Account": Wallet,
  "Trial Balance": Scale,
  "Reversals": RotateCcw,
};

const NavIcon = ({ name, active, size = 18 }) => {
  const Icon = iconMap[name] || LayoutDashboard;

  // Define colorful icons for specific modules
  const colorfulIcons = {
    dashboard: "#3B82F6", // Blue
    tenants: "#10B981", // Green
    settings: "#F59E0B", // Yellow
    affiliate: "#EF4444", // Red
    users: "#8B5CF6", // Purple
    coa: "#06B6D4", // Cyan
    generalLedger: "#0EA5E9", // Sky
    journal: "#84CC16", // Lime
    trialBalance: "#F97316", // Orange
    capital: "#EC4899", // Pink
    pos: "#6366F1", // Indigo
    quotations: "#14B8A6", // Teal
    invoicing: "#A855F7", // Violet
    expenses: "#F43F5E", // Rose
    payments: "#22C55E", // Green
    reports: "#3B82F6", // Blue
    stock: "#EAB308", // Yellow
    rental: "#6366F1",
    Rentals: "#6366F1",
    Hiring: "#D97706",
    purchases: "#EF4444", // Red
    businessModule: "#8B5CF6", // Purple
    hr: "#06B6D4", // Cyan
    gratuity: "#84CC16", // Lime
    advances: "#F97316", // Orange
    pension: "#EC4899", // Pink
    accountingPeriods: "#0F766E", // Teal
    // Sub-item colors
    "Employee Management": "#06B6D4",
    "Leave Management": "#14B8A6",
    "Attendance Tracking": "#3B82F6",
    "Performance Management": "#10B981",
    "Payroll Processing": "#22C55E",
    "Pension (NPS)": "#EC4899",
    "Gratuity Management": "#84CC16",
    "Salary Advances": "#F97316",
    "HR Reports": "#6366F1",
    "General Ledger": "#0EA5E9",
    "Chart of Accounts": "#06B6D4",
    "Accounting Periods": "#0F766E",
    "Journal Entries": "#84CC16",
    "Capital Account": "#EC4899",
    "Trial Balance": "#F97316",
    "Reversals": "#F43F5E",
  };

  const iconColor = colorfulIcons[name] || (active ? "#60a5fa" : "rgba(255,255,255,0.6)");

  return (
    <Icon
      size={size}
      style={{
        flexShrink: 0,
        color: iconColor,
        transition: "all 0.2s ease",
      }}
    />
  );
};

// Define navigation sections with permissions
const navigationByPermission = {
  // Master Admin sees everything - All sections available
  masterAdmin: [
    {
      label: "Administration",
      items: [
        { href: "/insightbooks/dashboard", icon: "dashboard", text: "Dashboard" },
        { href: "/insightbooks/tenant-management", icon: "tenants", text: "Tenant Management" },
        { href: "/insightbooks/global-settings", icon: "settings", text: "Global Settings" },
        { href: "/insightbooks/affiliate-system", icon: "affiliate", text: "Affiliate Management" },
        { 
          href: "/insightbooks/internal-business", 
          icon: "businessModule", 
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
        { href: "/tenants/dashboard", icon: "dashboard", text: "Business Owner Dashboard" },
        { href: "/users", icon: "users", text: "User & Role Management" },
        { href: "/account", icon: "settings", text: "Account & business" },
        { href: "/insightbooks/billing", icon: "payments", text: "Billing & Subscriptions" },
        { href: "/insightbooks/audit-logs", icon: "reports", text: "Audit Logs" },
      ],
    },
    {
      label: "Accounting",
      items: [
        {
          href: "/accounting",
          icon: "coa",
          text: "Accounting",
          expandable: true,
          subItems: [
            { href: "/general-ledger", text: "General Ledger" },
            { href: "/accounting/receivables", text: "Receivables" },
            { href: "/accounting/payables", text: "Payables" },
            { href: "/chart-of-accounts", text: "Chart of Accounts" },
            { href: "/accounting-periods", text: "Accounting Periods" },
            { href: "/journal-entries", text: "Journal Entries" },
            { href: "/transactions/reversals", text: "Reversals" },
            { href: "/trial-balance", text: "Trial Balance" },
            { href: "/capital-account", text: "Capital Account" },
          ]
        },
      ],
    },
    {
      label: "Core Features",
      items: [
        { href: "/pos", icon: "pos", text: "POS" },
        { href: "/quotations", icon: "quotations", text: "Quotations" },
        { href: "/invoice", icon: "invoicing", text: "Invoicing", badge: "3" },
        { href: "/expenses", icon: "expenses", text: "Expense Tracking" },
        { href: "/payments", icon: "payments", text: "Payment Accounts" },
        { href: "/reports", icon: "reports", text: "Financial Reporting" },
        { href: "/clients", icon: "users", text: "Client Management" },
      ],
    },
      {
        label: "Additional Modules",
        items: [
          { href: "/stock", icon: "stock", text: "Stock Management" },
          {
            href: "/rentals",
            icon: "rental",
            text: "Rental & Hiring",
            expandable: true,
            subItems: [
              { href: "/rentals", text: "Rentals" },
              { href: "/rentals/hiring", text: "Hiring" },
            ],
          },
          {
            href: "/purchases/suppliers",
            icon: "purchases",
            text: "Purchases",
            expandable: true,
            subItems: [
              { href: "/purchases/suppliers", text: "Suppliers" },
              { href: "/purchases/orders", text: "Orders" },
              { href: "/purchases/receipts", text: "Receipts" },
              { href: "/purchases/bills", text: "Bills" },
              { href: "/purchases/payments", text: "Payments" },
            ],
          },
        // HR Module temporarily commented out
        {
          href: "/hr",
          icon: "hr",
          text: "HR & Payroll",
          expandable: true,
          subItems: [
            { href: "/hr/employees", text: "Employee Management" },
            { href: "/hr/leave", text: "Leave Management" },
            { href: "/hr/attendance", text: "Attendance Tracking" },
            { href: "/hr/performance", text: "Performance Management" },
            { href: "/hr/payroll", text: "Payroll Processing" },
            { href: "/hr/benefits", text: "Benefits & Allowances" },
            { href: "/hr/pension", text: "Pension (NPS)", icon: "pension" },
            { href: "/hr/gratuity", text: "Gratuity Management", icon: "gratuity" },
            { href: "/hr/advances", text: "Salary Advances", icon: "advances" },
            { href: "/hr/reports", text: "HR Reports" }
          ]
        },
        // { href: "/pos", icon: "🧾", text: "Point of Sale (POS)" },
        { href: "/affiliate", icon: "affiliate", text: "Affiliate System" },
        { href: "/tax-types", icon: "reports", text: "Tax Types" },
      ],
    },
    {
      label: "MRA EIS",
      items: [
        {
          href: "/eis",
          icon: "reports",
          text: "MRA EIS",
          expandable: true,
          subItems: [
            { href: "/eis", text: "EIS Dashboard" },
            { href: "/eis/invoices", text: "EIS Invoices" },
            { href: "/eis/config", text: "EIS Configuration" },
          ]
        },
      ],
    },
    {
      label: "Accounting",
      items: [
        {
          href: "/accounting",
          icon: "coa",
          text: "Accounting",
          expandable: true,
          subItems: [
            { href: "/chart-of-accounts", text: "Chart of Accounts" },
          ]
        },
      ],
    },
  ],
  // Business Owner Management
  userManagement: {
    label: "User Management",
    items: [
      { href: "/users", icon: "users", text: "User & Role Management", permission: "users.view" },
    ]
  },
  // Core features
  invoices: {
    label: "Invoicing",
    items: [
      { href: "/invoice", icon: "invoicing", text: "Invoicing", permission: "invoices.view" },
      { href: "/quotations", icon: "quotations", text: "Quotations", permission: "invoices.view" },
      { href: "/credit-debit-notes", icon: "invoicing", text: "Credit & Debit Notes", permission: "invoices.view" },
    ]
  },
  clients: {
    label: "Clients",
    items: [
      { href: "/clients", icon: "users", text: "Client Management", permission: "clients.view" },
    ]
  },
  expenses: {
    label: "Expenses",
    items: [
      { href: "/expenses", icon: "expenses", text: "Expense Tracking", permission: "expenses.view" },
    ]
  },
  payments: {
    label: "Payment Accounts",
    items: [
      { href: "/payments", icon: "payments", text: "Payment Accounts", permission: "payments.view" },
    ]
  },
  reports: {
    label: "Reports",
    items: [
      { href: "/reports", icon: "reports", text: "Financial Reporting", permission: "reports.view" },
    ]
  },
  accounting: {
    label: "Accounting",
    items: [
      {
        href: "/accounting",
        icon: "coa",
        text: "Accounting",
        expandable: true,
        subItems: [
          { href: "/general-ledger", text: "General Ledger", permission: "generalLedger.view" },
          { href: "/accounting/receivables", text: "Receivables" },
          { href: "/accounting/payables", text: "Payables" },
          { href: "/accounting-periods", text: "Accounting Periods", permission: "journalEntries.view" },
          { href: "/journal-entries", text: "Journal Entries", permission: "journalEntries.view" },
          { href: "/chart-of-accounts", text: "Chart of Accounts" },
          { href: "/capital-account", text: "Capital Account", permission: "reports.view" },
          { href: "/trial-balance", text: "Trial Balance", permission: "trialBalance.view" },
          { href: "/transactions/reversals", text: "Reversals" },
        ]
      },
    ]
  },
  // Additional modules
  stock: {
    label: "Stock",
    items: [
      { href: "/stock", icon: "stock", text: "Stock Management", permission: "stock.view" },
    ]
  },
  rental: {
    label: "Rental & Hiring",
    items: [
      { href: "/rentals", icon: "rental", text: "Rentals", permission: "rentals.view" },
      { href: "/rentals/hiring", icon: "rental", text: "Hiring", permission: "rentals.view" },
    ],
  },
  assets: {
    label: "Asset Management",
    items: [
      { href: "/asset-management", icon: "reports", text: "Asset Management", permission: "assets.view" },
    ]
  },
  hr: {
    label: "HR & Payroll",
    items: [
      { href: "/hr", icon: "users", text: "HR & Payroll", permission: "hr.view" },
    ]
  },
  // Accounting
  // accounting: {
  //   label: "Accounting",
  //   items: [
  //     { href: "/general-ledger", icon: "📕", text: "General Ledger", permission: "reports.view" },
  //     { href: "/journal-entries", icon: "✏️", text: "Journal Entries", permission: "reports.view" },
  //     { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts", permission: "reports.view" },
  //     { href: "/trial-balance", icon: "⚖️", text: "Trial Balance", permission: "reports.view" },
  //   ]
  // },
  // Dashboard (always displayed)
  dashboard: {
    label: "Dashboard",
    items: [
      { href: "/dashboard", icon: "dashboard", text: "Dashboard" },
    ]
  },
  // Client portal items
  clientPortal: {
    label: "Client Portal",
    items: [
      { href: "/dashboard", icon: "dashboard", text: "Dashboard" },
      { href: "/invoices", icon: "invoicing", text: "My Invoices" },
      { href: "/payments", icon: "payments", text: "Payment History" },
      { href: "/quotes", icon: "quotations", text: "My Quotes" },
    ]
  }
};

// Function to get initials from name
const getInitials = (name) => {
  if (!name) return 'U';
  
  const nameParts = name.trim().split(' ');
  
  if (nameParts.length === 1) {
    return nameParts[0].charAt(0).toUpperCase();
  }
  
  // Get first and last part of the name
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
};

const Sidebar = ({ collapsed = false, toggleSidebar }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [subscription, setSubscription] = useState(null);
  
  // Fetch current user with loading state
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsUserLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          console.error('Failed to fetch user data');
          // Default user on error
          setUser({ name: "User", role: { name: "Employee", permissions: {} } });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Default user on error
        setUser({ name: "User", role: { name: "Employee", permissions: {} } });
      } finally {
        setIsUserLoading(false);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/subscription/status');
        if (response.ok) {
          const data = await response.json();
          setIsTrialActive(data.isTrialActive || false);
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();
  }, []);
  
  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
    }

    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Keyboard shortcut for sidebar toggle (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [toggleSidebar]);

  // Find active path and expand parent if needed
  useEffect(() => {
    const navSections = getNavigationSections();
    
    // Check if any submenu item matches the current path
    navSections.forEach(section => {
      section.items.forEach(item => {
        if (item.subItems) {
          const isSubItemActive = item.subItems.some(subItem => subItem.href === pathname);
          if (isSubItemActive && !expandedItems.includes(item.href)) {
            setExpandedItems(prev => [...prev, item.href]);
          }
        }
      });
    });
  }, [pathname, user, expandedItems]);
  
  // Build navigation sections based on user permissions
  const getNavigationSections = () => {
    // If user is loading, return minimal navigation
    if (isUserLoading) {
      return [navigationByPermission.dashboard];
    }
    
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

    // Sales: POS-only shell (ignore extra perms on the role template so staff cannot browse the app)
    if (isPosDefaultLandingRole(user)) {
      return [
        {
          label: "Point of Sale",
          items: [{ href: "/pos", icon: "pos", text: "POS" }],
        },
      ];
    }

    // For other roles, build navigation based on permissions
    const sections = [];

    if (userHasPermission(user, "dashboard.view")) {
      sections.push(navigationByPermission.dashboard);
    }

    // Create a Core Features section based on permissions
    const coreItems = [];
    
    // Add items based on permissions
    if (userHasPermission(user, "sales.view")) {

      coreItems.push({
        href: "/pos",
        icon: "pos",
        text: "POS"
      });
    }
    if (userHasPermission(user, "quotations.view")) {

      coreItems.push({
        href: "/quotations",
        icon: "quotations",
        text: "Quotations"
      });
    }
    if (userHasPermission(user, "invoices.view")) {

      coreItems.push({
        href: "/invoice",
        icon: "invoicing",
        text: "Invoicing",
        badge: ""
      });
    }

    if (userHasPermission(user, "expenses.view")) {
      coreItems.push({
        href: "/expenses",
        icon: "expenses",
        text: "Expense Tracking"
      });
    }

    if (userHasPermission(user, "payments.view")) {
      coreItems.push({
        href: "/payments",
        icon: "payments",
        text: "Payment Accounts"
      });
    }

    if (userHasPermission(user, "reports.view")) {
      coreItems.push({
        href: "/reports",
        icon: "reports",
        text: "Financial Reporting"
      });
    }

    if (userHasPermission(user, "clients.view")) {
      coreItems.push({
        href: "/clients",
        icon: "users",
        text: "Client Management"
      });
    }

    // Assets & Liabilities should be permission-gated (deny-by-default).
    if (userHasPermission(user, "assets.view")) {
      coreItems.push({
        href: "/asset-management",
        icon: "reports",
        text: "Assets & Liabilities"
      });
    }

    if (userHasPermission(user, "hr.view")) {
      coreItems.push({
        href: "/hr",
        icon: "users",
        text: "HR & Payroll",
        expandable: true,
        subItems: [
          { href: "/hr/employees", text: "Employee Management" },
          { href: "/hr/leave", text: "Leave Management" },
          { href: "/hr/attendance", text: "Attendance Tracking" },
          { href: "/hr/performance", text: "Performance Management" },
          { href: "/hr/payroll", text: "Payroll Processing" },
          { href: "/hr/benefits", text: "Benefits & Allowances" },
          { href: "/hr/pension", text: "Pension (NPS)", icon: "pension" },
          { href: "/hr/gratuity", text: "Gratuity Management", icon: "gratuity" },
          { href: "/hr/advances", text: "Salary Advances", icon: "advances" },
          { href: "/hr/reports", text: "HR Reports" }
        ]
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
    
    if (userHasPermission(user, "stock.view")) {
      additionalItems.push({
        href: "/stock",
        icon: "stock",
        text: "Stock Management"
      });
    }

    if (
      userHasPermission(user, "rentals.view") ||
      userHasPermission(user, "rentals.create") ||
      userHasPermission(user, "invoices.view") ||
      userHasPermission(user, "invoices.create")
    ) {
      additionalItems.push({
        href: "/rentals",
        icon: "rental",
        text: "Rental & Hiring",
        expandable: true,
        subItems: [
          { href: "/rentals", text: "Rentals" },
          { href: "/rentals/hiring", text: "Hiring" },
        ],
      });
    }

    if (userHasPermission(user, "budgets.view")) {
      additionalItems.push({
        href: "/budget-forecast/reports",
        icon: "reports",
        text: "Budget & Forecast",
        expandable: true,
        subItems: [
          { href: "/budget-forecast/reports", text: "Variance reports" },
          { href: "/budget-forecast/budgets", text: "Expense budgets" },
          { href: "/budget-forecast/forecasts", text: "Revenue forecasts" },
        ],
      });
    }

    
    // Add Purchases if user has inventory or purchases permission
    const canViewPurchases = userHasPermission(user, "purchases.view") || userHasPermission(user, "stock.view");
    if (canViewPurchases) {
      additionalItems.push({
        href: "/purchases/suppliers",
        icon: "purchases",
        text: "Purchases",
        expandable: true,
        subItems: [
          { href: "/purchases/suppliers", text: "Suppliers" },
          { href: "/purchases/orders", text: "Orders" },
          { href: "/purchases/receipts", text: "Receipts" },
          { href: "/purchases/bills", text: "Bills" },
          { href: "/purchases/payments", text: "Payments" },
        ],
      });
    }
    
    // Asset Management moved to Core Features section
    
    // HR Module temporarily commented out


    
    // // Add more additional modules based on permissions
    // if (userHasPermission(user, "invoices.view")) {
    //   additionalItems.push({
    //     href: "/pos",
    //     icon: "🧾",
    //     text: "Point of Sale (POS)"
    //   });
    // }
    
    // Tax Types - allow if user has accounting or reports view permission
    if (userHasPermission(user, "accounting.view") || 
        userHasPermission(user, "reports.view") ||
        userHasPermission(user, "tax.view")) {
      additionalItems.push({
        href: "/tax-types",
        icon: "reports",
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

    // Accounting section: include only items explicitly permitted.
    const accountingSubItems = [
      { href: "/general-ledger", text: "General Ledger", permission: "generalLedger.view" },
      { href: "/accounting/receivables", text: "Receivables", permission: "invoices.view" },
      { href: "/accounting/payables", text: "Payables", permission: "expenses.view" },
      { href: "/accounting-periods", text: "Accounting Periods", permission: "journalEntries.view" },
      { href: "/chart-of-accounts", text: "Chart of Accounts", permission: "accounts.view" },
      { href: "/journal-entries", text: "Journal Entries", permission: "journalEntries.view" },
      { href: "/capital-account", text: "Capital Account", permission: "reports.view" },
      { href: "/trial-balance", text: "Trial Balance", permission: "trialBalance.view" },
      { href: "/transactions/reversals", text: "Reversals", permission: "journalEntries.view" },
    ].filter((i) => userHasPermission(user, i.permission));

    if (accountingSubItems.length > 0) {
      sections.push({
        label: "Accounting",
        items: [
          {
            href: "/accounting",
            icon: "coa",
            text: "Accounting",
            expandable: true,
            subItems: accountingSubItems.map(({ permission, ...rest }) => rest),
          },
        ],
      });
    }
    
    // Create a business management section if user has access to any of these
    const businessItems = [];
    // Add User & Role Management if user has permission
    if (userHasPermission(user, "users.view") || userHasPermission(user, "roles.view")) {
      businessItems.push({
        href: "/users",
        icon: "users",
        text: "User & Role Management"
      });
    }

    // if (userHasPermission(user, "system.view")) {
    //   businessItems.push({
    //     href: "/customization",
    //     icon: "🎨",
    //     text: "System Customization"
    //   });
    // }

    // Add Business Management section if there are any items
    if (businessItems.length > 0) {
      sections.push({
        label: "Business Management",
        items: businessItems
      });
    }
    // Only show accounting section if user has reports view permission

    return sections;
  };
  
  const isActive = (href) => pathname === href;
  const isMobile = windowWidth < 1024;

  const toggleExpand = (href) => {
    setExpandedItems(prev => 
      prev.includes(href) ? prev.filter(item => item !== href) : [...prev, href]
    );
  };

  const isExpanded = (href) => expandedItems.includes(href);

  // Get the navigation sections based on user permissions
  const navSections = getNavigationSections();
  
  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div 
      className="sidebar"
      style={{
        width: collapsed ? "80px" : "280px",
        height: "100vh",
        backgroundColor: "#1a202c",
        color: "white",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease-in-out",
        position: isMobile ? "fixed" : "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        overflow: "hidden"
      }}
    >
      {/* Header Skeleton */}
      <div className="sidebar-header-skeleton" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div className="logo-skeleton" style={{
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <div className="logo-icon-skeleton" style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            animation: "pulse 1.5s infinite ease-in-out"
          }}></div>
          {!collapsed && <div style={{ 
            width: "120px", 
            height: "18px", 
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            animation: "pulse 1.5s infinite ease-in-out"
          }}></div>}
        </div>
      </div>

      {/* User Section Skeleton */}
      <div className="user-section-skeleton" style={{
        display: "flex",
        alignItems: "center",
        padding: "16px",
        gap: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div className="user-avatar-skeleton" style={{
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          animation: "pulse 1.5s infinite ease-in-out"
        }}></div>
        {!collapsed && (
          <div className="user-info-skeleton" style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <div style={{ 
              width: "100px", 
              height: "14px", 
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              animation: "pulse 1.5s infinite ease-in-out"
            }}></div>
            <div style={{ 
              width: "80px", 
              height: "12px", 
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              animation: "pulse 1.5s infinite ease-in-out"
            }}></div>
          </div>
        )}
      </div>

      {/* Nav Skeleton */}
      <div className="nav-content-skeleton" style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "16px 0"
      }}>
        {/* Create 4 section skeletons */}
        {[...Array(4)].map((_, sectionIndex) => (
          <div key={`section-skeleton-${sectionIndex}`} style={{
            marginBottom: "16px"
          }}>
            {!collapsed && (
              <div style={{ 
                margin: "0 16px 8px",
                width: "120px", 
                height: "12px", 
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                animation: "pulse 1.5s infinite ease-in-out"
              }}></div>
            )}
            
            {/* Create 3-5 item skeletons per section */}
            {[...Array(sectionIndex === 0 ? 5 : 3)].map((_, itemIndex) => (
              <div key={`item-skeleton-${sectionIndex}-${itemIndex}`} style={{
                margin: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                <div style={{ 
                  width: "16px", 
                  height: "16px", 
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  animation: "pulse 1.5s infinite ease-in-out"
                }}></div>
                
                {!collapsed && (
                  <div style={{ 
                    // Use fixed widths based on indices for deterministic rendering
                    width: [110, 95, 130, 85, 105][itemIndex % 5] + "px", 
                    height: "14px", 
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "4px",
                    animation: "pulse 1.5s infinite ease-in-out"
                  }}></div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer Skeleton */}
      {!collapsed && (
        <div style={{
          padding: "16px",
          borderTop: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div style={{ 
            width: "120px", 
            height: "12px", 
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            marginBottom: "16px",
            animation: "pulse 1.5s infinite ease-in-out"
          }}></div>
          
          {[...Array(3)].map((_, i) => (
            <div key={`footer-link-${i}`} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px"
            }}>
              <div style={{ 
                width: "14px", 
                height: "14px", 
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                animation: "pulse 1.5s infinite ease-in-out"
              }}></div>
              <div style={{ 
                width: "60px", 
                height: "12px", 
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                animation: "pulse 1.5s infinite ease-in-out"
              }}></div>
            </div>
          ))}
        </div>
      )}
      
      {/* Animation for skeletons */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
  
  if (isLoading) {
    return <SkeletonLoader />;
  }
  
  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && !collapsed && (
        <div
          className="sidebar-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 99,
            animation: "fadeIn 0.3s ease-out"
          }}
          onClick={toggleSidebar}
        />
      )}

      <div
        className={`sidebar ${collapsed ? "collapsed" : ""}`}
        style={{
          width: collapsed ? "80px" : "280px",
          height: "100vh",
          backgroundColor: "#0f172a",
          background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          position: isMobile ? "fixed" : "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          overflow: "hidden",
          boxShadow: "none",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          animation: "slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
      <div className="sidebar-header" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        position: "relative"
      }}>
        {!collapsed && (
          <div className="flex items-center">
            <img src="/logo.png" alt="InsightBooks Logo" className="h-11 w-auto object-contain rounded-md"/>
          </div>
        )}

      </div>

      {/* Business Name Display */}
      {!collapsed && user?.tenant && (
        <Link
          href="/switch-tenant"
          className="business-name-section"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            gap: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            textDecoration: "none",
            color: "inherit",
            cursor: "pointer",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
            borderRadius: "12px",
            margin: "8px 8px 0 8px",
            background: "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.05) 100%)",
            border: "1px solid rgba(107, 114, 128, 0.15)"
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.backgroundColor = "rgba(107, 114, 128, 0.15)";
            el.style.borderColor = "rgba(107, 114, 128, 0.3)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.backgroundColor = "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.05) 100%)";
            el.style.borderColor = "rgba(107, 114, 128, 0.15)";
          }}
        >
          {/* Business Icon */}
          <div className="business-icon" style={{
            backgroundColor: "#6b7280",
            color: "white",
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            boxShadow: "none",
            transition: "background-color 0.2s ease"
          }}>
            🏢
          </div>
          
          <div className="business-info" style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}>
            <div className="business-name" style={{
              fontSize: "13px",
              color: "#d1d5db",
              fontWeight: "600",
              marginBottom: "2px"
            }}>
              {user.tenant.name}
            </div>
          </div>
        </Link>
      )}

      {/* Branches/Businesses: switch active business (tenant) from sidebar */}
      {!collapsed && user?.tenant && (
        <div style={{
          padding: "8px",
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }}>
          <BranchSwitcher />
        </div>
      )}

      <Link
        href="/subscription"
        className="user-section-link"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px",
          gap: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          textDecoration: "none",
          color: "inherit",
          cursor: "pointer",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
          borderRadius: "12px",
          margin: "8px 8px 0 8px",
          background: subscription?.isTrial
            ? "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)"
            : "linear-gradient(135deg, rgba(49, 130, 206, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)",
          border: subscription?.isTrial
            ? "1px solid rgba(251, 191, 36, 0.2)"
            : "1px solid rgba(49, 130, 206, 0.15)"
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = subscription?.isTrial
            ? "rgba(251, 191, 36, 0.15)"
            : "rgba(49, 130, 206, 0.15)";
          el.style.borderColor = subscription?.isTrial
            ? "rgba(251, 191, 36, 0.4)"
            : "rgba(49, 130, 206, 0.3)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.backgroundColor = subscription?.isTrial
            ? "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)"
            : "linear-gradient(135deg, rgba(49, 130, 206, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)";
          el.style.borderColor = subscription?.isTrial
            ? "rgba(251, 191, 36, 0.2)"
            : "rgba(49, 130, 206, 0.15)";
        }}
      >
        {/* Subscription Icon */}
        <div className="subscription-icon" style={{
          backgroundColor: subscription?.isTrial ? "#f59e0b" : "#3b82f6",
          color: "white",
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          boxShadow: "none",
          transition: "background-color 0.2s ease"
        }}>
          {subscription?.isTrial ? "⏰" : "👑"}
        </div>
        
        {!collapsed && (
          <div className="subscription-info" style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            {isUserLoading ? (
              // Loading state
              <>
                <div style={{
                  width: "100px",
                  height: "16px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  animation: "pulse 1.5s infinite ease-in-out",
                  marginBottom: "4px"
                }}></div>
                <div style={{
                  width: "80px",
                  height: "14px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  animation: "pulse 1.5s infinite ease-in-out",
                  marginBottom: "4px"
                }}></div>
                <div style={{
                  width: "90px",
                  height: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  animation: "pulse 1.5s infinite ease-in-out"
                }}></div>
              </>
            ) : (
              // Subscription info loaded
              <>
                <div className="subscription-header" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "2px"
                }}>
                  <span className="subscription-label" style={{
                    fontWeight: "700",
                    fontSize: "15px",
                    color: "white",
                    letterSpacing: "0.5px"
                  }}>Subscription</span>
                  {subscription?.isTrial && (
                    <span className="trial-badge" style={{
                      backgroundColor: "#f59e0b",
                      color: "#92400e",
                      fontSize: "9px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Trial</span>
                  )}
                </div>

                <div className="subscription-plan" style={{
                  fontSize: "13px",
                  color: subscription?.isTrial ? "#fbbf24" : "#60a5fa",
                  fontWeight: "600",
                  marginBottom: "2px"
                }}>
                  {subscription?.isTrial ? 'Free Trial Active' : getPlanDisplayName(subscription?.plan) || 'No Active Plan'}
                </div>

                {/* Next Payment Date Display */}
                {(subscription?.isTrial || subscription?.expiresAt) && (
                  <div className="next-payment-date" style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.75)",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <span style={{ fontSize: "10px", opacity: 0.8 }}>⏰</span>
                    {subscription?.isTrial ? 'Ends' : 'Renews'}: {formatDate(subscription?.isTrial ? subscription?.trialEndDate : subscription?.expiresAt)}
                  </div>
                )}

                {user?.role?.name === 'MASTER_ADMIN' && (
                  <div className="tenant-selector" style={{
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.6)",
                    padding: "4px 8px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    <span>Switch Business Owner</span>
                    <ChevronDown size={12} style={{ marginLeft: "4px" }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Link>

      <div className="nav-content" style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "16px 0"
      }}>
        {navSections.filter(section => section && section.items).map((section, sIndex) => (
          <div className="nav-section" key={`section-${sIndex}`} style={{
            marginBottom: "16px"
          }}>
            {!collapsed && section?.label && (
              <div className="nav-label" style={{
                fontSize: "12px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                padding: "0 16px 8px",
                fontWeight: "600"
              }}>{section.label}</div>
            )}
            <div className="nav-group">
              {section.items?.map((item, iIndex) => (
                <div key={`item-${sIndex}-${iIndex}`}>
                  {item.expandable ? (
                    <div>
                      <div
                        className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                        onClick={() => !collapsed && toggleExpand(item.href)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          margin: "2px 8px",
                          color: isActive(item.href) ? "white" : "rgba(255,255,255,0.7)",
                          backgroundColor: isActive(item.href) ? "rgba(49, 130, 206, 0.2)" : "transparent",
                          borderLeft: isActive(item.href) ? "3px solid #3182ce" : "3px solid transparent",
                          borderTop: "1px solid transparent",
                          borderRight: "1px solid transparent",
                          borderBottom: "1px solid transparent",
                          gap: "12px",
                          position: "relative",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          cursor: "pointer",
                          borderRadius: "8px",
                          transform: "translateX(0)",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          if (!isActive(item.href)) {
                            el.style.backgroundColor = "rgba(49, 130, 206, 0.15)";
                            el.style.borderColor = "rgba(49, 130, 206, 0.3)";
                            el.style.transform = "translateX(4px)";
                            el.style.color = "rgba(255,255,255,0.9)";
                          } else {
                            el.style.transform = "translateX(2px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget;
                          if (!isActive(item.href)) {
                            el.style.backgroundColor = "transparent";
                            el.style.borderColor = "transparent";
                            el.style.transform = "translateX(0)";
                            el.style.color = "rgba(255,255,255,0.7)";
                          } else {
                            el.style.transform = "translateX(0)";
                          }
                        }}
                      >
                        <span className="nav-icon" style={{ 
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "transform 0.2s ease"
                        }}>
                          <NavIcon name={item.icon} active={isActive(item.href)} />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="nav-text" style={{
                              fontSize: "14px",
                              flex: 1
                            }}>{item.text}</span>
                            <ChevronRight 
                              size={16} 
                              style={{
                                transform: isExpanded(item.href) ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: isExpanded(item.href) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                                flexShrink: 0
                              }}
                            />
                          </>
                        )}
                      </div>
                      {!collapsed && isExpanded(item.href) && (
                        <div className="sub-menu" style={{
                          animation: "slideDown 0.2s ease-out",
                          overflow: "hidden"
                        }}>
                          {item.subItems.map((subItem, subIndex) => {
                            const isSubActive = isActive(subItem.href);
                            const subItemIconName = subItem.icon || subItem.text;
                            return (
                              <Link 
                                href={subItem.href}
                                key={`subitem-${sIndex}-${iIndex}-${subIndex}`}
                                className={`sub-menu-item ${isSubActive ? "active" : ""}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "10px 16px 10px 52px",
                                  textDecoration: "none",
                                  color: isSubActive ? "white" : "rgba(255,255,255,0.7)",
                                  backgroundColor: isSubActive ? "rgba(49, 130, 206, 0.15)" : "transparent",
                                  fontSize: "13px",
                                  gap: "10px",
                                  position: "relative",
                                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                  borderRadius: "6px",
                                  margin: "2px 8px",
                                  borderLeft: isSubActive ? "3px solid #3182ce" : "3px solid transparent",
                                  transform: "translateX(0)",
                                  animation: `fadeIn 0.2s ease-out ${subIndex * 0.03}s both`,
                                }}
                                onMouseEnter={(e) => {
                                  const el = e.currentTarget;
                                  if (!isSubActive) {
                                    el.style.backgroundColor = "rgba(49, 130, 206, 0.12)";
                                    el.style.transform = "translateX(6px)";
                                    el.style.color = "rgba(255,255,255,0.95)";
                                    el.style.borderLeft = "3px solid rgba(49, 130, 206, 0.4)";
                                  } else {
                                    el.style.transform = "translateX(2px)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  const el = e.currentTarget;
                                  if (!isSubActive) {
                                    el.style.backgroundColor = "transparent";
                                    el.style.transform = "translateX(0)";
                                    el.style.color = "rgba(255,255,255,0.7)";
                                    el.style.borderLeft = "3px solid transparent";
                                  } else {
                                    el.style.transform = "translateX(0)";
                                  }
                                }}
                              >
                                <span className="sub-nav-icon" style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "18px",
                                  height: "18px",
                                  flexShrink: 0,
                                  transition: "transform 0.2s ease",
                                }}>
                                  <NavIcon name={subItemIconName} active={isSubActive} size={16} />
                                </span>
                                <span style={{
                                  flex: 1,
                                  fontWeight: isSubActive ? "500" : "400",
                                  transition: "font-weight 0.2s ease, color 0.2s ease"
                                }}>
                                  {subItem.text}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        margin: "2px 8px",
                        textDecoration: "none",
                        color: isActive(item.href) ? "white" : "rgba(255,255,255,0.7)",
                        backgroundColor: isActive(item.href) ? "rgba(49, 130, 206, 0.2)" : "transparent",
                        borderLeft: isActive(item.href) ? "3px solid #3182ce" : "3px solid transparent",
                        borderRight: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        borderTop: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        borderBottom: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        gap: "12px",
                        position: "relative",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        borderRadius: "8px",
                        transform: "translateX(0)",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        if (!isActive(item.href)) {
                          el.style.backgroundColor = "rgba(49, 130, 206, 0.15)";
                          el.style.borderColor = "rgba(49, 130, 206, 0.3)";
                          el.style.transform = "translateX(4px)";
                          el.style.color = "rgba(255,255,255,0.9)";
                        } else {
                          el.style.transform = "translateX(2px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        if (!isActive(item.href)) {
                          el.style.backgroundColor = "transparent";
                          el.style.borderColor = "transparent";
                          el.style.transform = "translateX(0)";
                          el.style.color = "rgba(255,255,255,0.7)";
                        } else {
                          el.style.transform = "translateX(0)";
                        }
                      }}
                    >
                      <span className="nav-icon" style={{ 
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.2s ease"
                      }}>
                        <NavIcon name={item.icon} active={isActive(item.href)} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="nav-text" style={{
                            fontSize: "14px"
                          }}>{item.text}</span>
                          {item.badge && (
                            <span className="nav-badge" style={{
                              backgroundColor: "#ef4444",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: "bold",
                              borderRadius: "10px",
                              padding: "2px 6px",
                              marginLeft: "auto"
                            }}>{item.badge}</span>
                          )}
                        </>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
</div>

<style dangerouslySetInnerHTML={{
  __html: `
    @keyframes slideIn {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
        max-height: 0;
      }
      to {
        opacity: 1;
        transform: translateY(0);
        max-height: 1000px;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translateY(0);
        max-height: 1000px;
      }
      to {
        opacity: 0;
        transform: translateY(-10px);
        max-height: 0;
      }
    }

    .nav-item:hover .nav-icon {
      transform: scale(1.15);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sub-menu-item:hover .sub-nav-icon {
      transform: scale(1.15) rotate(5deg);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .nav-item.active .nav-icon {
      filter: brightness(1.3) drop-shadow(0 0 4px rgba(96, 165, 250, 0.4));
    }

    .sub-menu-item.active .sub-nav-icon {
      filter: brightness(1.3) drop-shadow(0 0 3px rgba(96, 165, 250, 0.4));
    }

    .nav-item:hover {
      box-shadow: 0 2px 8px rgba(49, 130, 206, 0.15);
    }

    .sub-menu-item:hover {
      box-shadow: 0 2px 6px rgba(49, 130, 206, 0.12);
    }
  `
}} />
</>
);
};

export default Sidebar;
