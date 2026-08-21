"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
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
  BadgePercent,
  ArrowLeftRight,
  Undo2,
  Gift,
  HandCoins,
  Download,
  Truck,
  ClipboardList,
  Banknote,
  Target,
  Calculator,
  CalendarRange,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { userHasPermission } from "@/lib/permissions";
import { isPosDefaultLandingRole } from "@/lib/tenantRoleAccess";
import { getRouteRuleForPath } from "@/lib/tenantPageAccess";
import { getPlanDisplayName } from "@/lib/subscriptionConfig";
import {
  TENANT_EIS_NAV_FULL,
  buildTenantEisNavMenuItem,
} from "@/lib/mraEis/navConfig";
import BusinessSwitcher from "./BusinessSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { translateNavLabel } from "@/lib/i18n/navLabelMap";

const POS_SHELL_PERMISSIONS = [
  "sales.create",
  "sales.view",
  "sales.update",
  "sales.delete",
  "sales.void",
  "sales.refund",
  "sales.export",
];

const POS_SUPPORT_PERMISSIONS = [
  "clients.create",
  "clients.view",
  "clients.update",
  "inventory.view",
  "tax.view",
  "payments.view",
  "accounts.view",
  "settings.view",
  "system.switchTenant",
];

const POS_ONLY_NAV_PERMISSIONS = new Set([
  ...POS_SHELL_PERMISSIONS,
  ...POS_SUPPORT_PERMISSIONS,
]);

const NAV_ROUTE_PERMISSION_OVERRIDES = {
  "/quotations": ["quotations.view"],
  "/rentals": ["rentals.view"],
  "/rentals/hirings": ["rentals.view"],
  "/rentals/reports": ["rentals.view"],
  "/rentals/hiring": ["rentals.view"],
  "/rentals/contracts-v2": ["rentals.view"],
  "/rentals/quotations-v2": ["rentals.view"],
  "/rentals/reconcile": ["rentals.view"],
  "/rentals/inbound-hiring": ["rentals.view"],
  "/accounting/receivables": [
    "accounting.view",
    "generalLedger.view",
    "journalEntries.view",
    "trialBalance.view",
  ],
};

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
  taxCodes: BadgePercent,
  taxAccounts: Landmark,
  taxTransactions: ArrowLeftRight,
  taxPeriods: CalendarRange,
  taxReturns: FileCheck,
  fileCheck: FileCheck,
  taxPayments: Banknote,
  taxRefunds: Undo2,
  taxCredits: Gift,
  taxWithholding: HandCoins,
  taxReconciliation: Scale,
  importExport: Download,
  suppliers: Truck,
  orders: ClipboardList,
  receipts: Package,
  bills: FileText,
  budgets: PieChart,
  forecasts: TrendingUp,
  receivables: ScrollText,
  payables: Receipt,
  financialCalendar: CalendarDays,
  bankReconciliation: Landmark,
  equity: Handshake,
  yearEndClose: FileCheck,
  financialPlanning: Target,
  loanReadiness: Calculator,
  benefits: Gift,
  payeSummary: FileText,
  payrollWorkbench: Briefcase,
  // Sub-item icons (by label fallback)
  "Employee Management": Users,
  "Leave Management": CalendarDays,
  "Attendance Tracking": Clock,
  "Payroll Processing": DollarSign,
  "Pension (NPS)": Landmark,
  "Gratuity Management": Wallet,
  "Salary Advances": CreditCard,
  "HR Reports": BarChart3,
  "Benefits & Allowances": Gift,
  "PAYE Summary": FileText,
  "Payroll Workbench (V2)": Briefcase,
  "General Ledger": BookText,
  "Chart of Accounts": BookText,
  "Accounting Periods": CalendarDays,
  "Journal Entries": BookOpen,
  "Capital Account": Wallet,
  "Trial Balance": Scale,
  Reversals: RotateCcw,
  Receivables: ScrollText,
  Payables: Receipt,
  "Financial Calendar": CalendarDays,
  "Bank Reconciliation": Landmark,
  "Equity Management": Handshake,
  "Year-End Close": FileCheck,
  "Financial Planning": Target,
  "Loan Readiness": Calculator,
  Suppliers: Truck,
  Orders: ClipboardList,
  Receipts: Package,
  Bills: FileText,
  Payments: CreditCard,
  Budgets: PieChart,
  Forecasts: TrendingUp,
  Reports: BarChart3,
  "Quantity rentals": Wrench,
  "Contracts V2": FileText,
  "Quotations V2": ScrollText,
  "Rental reconcile": Scale,
  "Supplier hiring": Truck,
  Dashboard: LayoutDashboard,
  "Tax codes": BadgePercent,
  "Tax accounts": Landmark,
  "Tax transactions": ArrowLeftRight,
  "Tax periods": CalendarRange,
  "Tax returns": FileCheck,
  "Tax payments": Banknote,
  "Tax refunds": Undo2,
  "Tax credits": Gift,
  Withholding: HandCoins,
  Reconciliation: Scale,
  "Import/Export": Download,
  Settings: Settings,
};

const TAX_MANAGEMENT_SUB_ITEMS = [
  { href: "/tax-management", text: "Dashboard", icon: "dashboard" },
  { href: "/tax-management/accounts", text: "Tax accounts", icon: "taxAccounts" },
  { href: "/tax-management/transactions", text: "Tax transactions", icon: "taxTransactions" },
  { href: "/tax-management/periods", text: "Tax periods", icon: "taxPeriods" },
  { href: "/tax-management/returns", text: "Tax returns", icon: "taxReturns" },
  { href: "/tax-management/payments", text: "Tax payments", icon: "taxPayments" },
  { href: "/tax-management/refunds", text: "Tax refunds", icon: "taxRefunds" },
  { href: "/tax-management/credits", text: "Tax credits", icon: "taxCredits" },
  { href: "/tax-management/withholding", text: "Withholding", icon: "taxWithholding" },
  { href: "/tax-management/reconciliation", text: "Reconciliation", icon: "taxReconciliation" },
  { href: "/tax-management/reports", text: "Reports", icon: "reports" },
  { href: "/tax-management/import-export", text: "Import/Export", icon: "importExport" },
  { href: "/tax-management/settings", text: "Settings", icon: "settings" },
];

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
    taxCodes: "#F59E0B",
    taxAccounts: "#0EA5E9",
    taxTransactions: "#6366F1",
    taxPeriods: "#14B8A6",
    taxReturns: "#22C55E",
    taxPayments: "#10B981",
    taxRefunds: "#F43F5E",
    taxCredits: "#A855F7",
    taxWithholding: "#EC4899",
    taxReconciliation: "#F97316",
    importExport: "#84CC16",
    // Sub-item colors
    "Employee Management": "#06B6D4",
    "Leave Management": "#14B8A6",
    "Attendance Tracking": "#3B82F6",
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
        {
          href: "/insightbooks/mra-eis",
          icon: "reports",
          text: "MRA EIS Entitlement",
          expandable: true,
          subItems: [
            { href: "/insightbooks/mra-eis", text: "Entitlements", icon: "affiliate" },
            { href: "/insightbooks/mra-eis/centre", text: "Platform Overview", icon: "dashboard" },
            { href: "/insightbooks/mra-eis/terminals", text: "Terminals", icon: "pos" },
            { href: "/insightbooks/mra-eis/configuration", text: "Configuration", icon: "settings" },
            { href: "/insightbooks/mra-eis/mappings", text: "Mappings", icon: "coa" },
            { href: "/insightbooks/mra-eis/catalogue", text: "Catalogue", icon: "stock" },
          ],
        },
        { href: "/insightbooks/affiliate-system", icon: "affiliate", text: "Affiliate Management" },
        { 
          href: "/insightbooks/internal-business", 
          icon: "businessModule", 
          text: "Business Owner Module", 
          expandable: true,
          subItems: [
            { href: "/insightbooks/internal-business/overview", text: "Business Overview", icon: "dashboard" },
            { href: "/insightbooks/internal-business/finances", text: "Business Management", icon: "capital" },
            { href: "/insightbooks/internal-business/staff", text: "Staff Management", icon: "users" },
            { href: "/insightbooks/internal-business/expenses", text: "Expense Tracking", icon: "expenses" },
            { href: "/insightbooks/internal-business/revenue", text: "Revenue Analytics", icon: "forecasts" },
            { href: "/insightbooks/internal-business/reports", text: "Business Reports", icon: "reports" },
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
            { href: "/general-ledger-v2", text: "General Ledger", icon: "generalLedger" },
            { href: "/accounting/receivables", text: "Receivables", icon: "receivables" },
            { href: "/accounting/payables", text: "Payables", icon: "payables" },
            { href: "/chart-of-accounts", text: "Chart of Accounts", icon: "coa" },
            { href: "/financial-calendar-v2", text: "Financial Calendar", icon: "financialCalendar" },
            { href: "/journal-entries", text: "Journal Entries", icon: "journal" },
            { href: "/transactions/reversals", text: "Reversals", icon: "reversals" },
            { href: "/trial-balance", text: "Trial Balance", icon: "trialBalance" },
            { href: "/capital-account", text: "Capital Account", icon: "capital" },
          ]
        },
        {
          href: "/budget-forecast/budgets",
          icon: "reports",
          text: "Budget & Forecast",
          expandable: true,
          subItems: [
            { href: "/budget-forecast/budgets", text: "Budgets", icon: "budgets" },
            { href: "/budget-forecast/forecasts", text: "Forecasts", icon: "forecasts" },
            { href: "/budget-forecast/reports", text: "Reports", icon: "reports" },
          ],
        },
        { href: "/asset-management", icon: "reports", text: "Assets & Liabilities" },
        {
          href: "/tax-management",
          icon: "taxCodes",
          text: "Tax Management",
          expandable: true,
          subItems: TAX_MANAGEMENT_SUB_ITEMS,
        },
        buildTenantEisNavMenuItem(TENANT_EIS_NAV_FULL),
      ],
    },
    {
      label: "Features",
      items: [
        { href: "/pos", icon: "pos", text: "POS" },
        { href: "/quotations", icon: "quotations", text: "Quotations" },
        { href: "/invoice", icon: "invoicing", text: "Invoicing", badge: "3" },
        { href: "/expenses", icon: "expenses", text: "Expense Tracking" },
        { href: "/stock", icon: "stock", text: "Stock/Inventory management" },
        { href: "/clients", icon: "users", text: "Customer Management" },
        {
          href: "/purchases/suppliers",
          icon: "purchases",
          text: "Purchases",
          expandable: true,
          subItems: [
            { href: "/purchases/suppliers", text: "Suppliers", icon: "suppliers" },
            { href: "/purchases/orders", text: "Orders", icon: "orders" },
            { href: "/purchases/receipts", text: "Receipts", icon: "receipts" },
            { href: "/purchases/bills", text: "Bills", icon: "bills" },
            { href: "/purchases/payments", text: "Payments", icon: "payments" },
          ],
        },
        { href: "/payments", icon: "payments", text: "Accounts & Reconciliation" },
        {
          href: "/hr",
          icon: "hr",
          text: "HR & Payroll",
          expandable: true,
          subItems: [
            { href: "/hr/employees", text: "Employee Management", icon: "users" },
            { href: "/hr/leave", text: "Leave Management", icon: "accountingPeriods" },
            { href: "/hr/attendance", text: "Attendance Tracking", icon: "Attendance Tracking" },
            { href: "/hr/payroll", text: "Payroll Processing", icon: "Payroll Processing" },
            { href: "/hr/payroll/paye-summary", text: "PAYE Summary", icon: "payeSummary" },
            { href: "/hr/benefits", text: "Benefits & Allowances", icon: "benefits" },
            { href: "/hr/pension", text: "Pension (NPS)", icon: "pension" },
            { href: "/hr/gratuity", text: "Gratuity Management", icon: "gratuity" },
            { href: "/hr/advances", text: "Salary Advances", icon: "advances" },
            { href: "/hr/reports", text: "HR Reports", icon: "reports" },
          ]
        },
        {
          href: "/rentals",
          icon: "rental",
          text: "Rental & Hiring",
          expandable: true,
          subItems: [
            { href: "/rentals", text: "Rentals", icon: "Rentals", permission: "rentals.view" },
            { href: "/rentals/hirings", text: "Hirings", icon: "Hiring", permission: "rentals.view" },
            { href: "/rentals/reports", text: "Reports", icon: "Reports", permission: "rentals.view" },
          ],
        },
        { href: "/reports-v2", icon: "reports", text: "Reports" },
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
      { href: "/clients", icon: "users", text: "Customer Management", permission: "clients.view" },
    ]
  },
  expenses: {
    label: "Expenses",
    items: [
      { href: "/expenses", icon: "expenses", text: "Expense Tracking", permission: "expenses.view" },
    ]
  },
  payments: {
    label: "Accounts & Reconciliation",
    items: [
      { href: "/payments", icon: "payments", text: "Accounts & Reconciliation", permission: "payments.view" },
    ]
  },
  reports: {
    label: "Reports",
    items: [
      { href: "/reports-v2", icon: "reports", text: "Reports", permission: "reports.view" },
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
          { href: "/general-ledger-v2", text: "General Ledger", icon: "generalLedger", permission: "generalLedger.view" },
          { href: "/accounting/receivables", text: "Receivables", icon: "receivables" },
          { href: "/accounting/payables", text: "Payables", icon: "payables" },
          { href: "/financial-calendar-v2", text: "Financial Calendar", icon: "financialCalendar", permission: "journalEntries.view" },
          { href: "/journal-entries", text: "Journal Entries", icon: "journal", permission: "journalEntries.view" },
          { href: "/chart-of-accounts", text: "Chart of Accounts", icon: "coa" },
          { href: "/capital-account", text: "Capital Account", icon: "capital", permissions: ["reports.view", "accounts.view", "equity.view"] },
          { href: "/trial-balance", text: "Trial Balance", icon: "trialBalance", permission: "trialBalance.view" },
          { href: "/transactions/reversals", text: "Reversals", icon: "reversals" },
        ]
      },
    ]
  },
  // Additional modules
  stock: {
    label: "Stock",
    items: [
      { href: "/stock", icon: "stock", text: "Stock/Inventory management", permission: "inventory.view" },
    ]
  },
  rental: {
    label: "Rental & Hiring",
    items: [
      { href: "/rentals", icon: "Rentals", text: "Rentals", permission: "rentals.view" },
      { href: "/rentals/hirings", icon: "Hiring", text: "Hirings", permission: "rentals.view" },
      { href: "/rentals/reports", icon: "Reports", text: "Reports", permission: "rentals.view" },
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
  const { t } = useI18n();
  const navT = (text) => translateNavLabel(text, t);
  const router = useRouter();
  const pathname = usePathname();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [eisManagementAccess, setEisManagementAccess] = useState(null);
  
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

  // MRA EIS management unlock (active EIS subscription OR admin entitlement)
  useEffect(() => {
    let cancelled = false;
    const loadEisNav = async () => {
      try {
        const response = await fetch('/api/mra-eis/nav-access');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.managementAccess) {
          setEisManagementAccess(data.managementAccess);
        }
      } catch {
        /* keep null — nav stays hidden until unlock is known */
      }
    };
    if (user?.tenantId) loadEisNav();
    return () => {
      cancelled = true;
    };
  }, [user?.tenantId]);
  
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
          const isSubItemActive = item.subItems.some((subItem) =>
            isSubNavActive(item.href, subItem.href)
          );
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
    const hasAnyPermission = (permissions) =>
      permissions.some((permission) => userHasPermission(user, permission));

    const hasSalesShellAccess = POS_SHELL_PERMISSIONS.some((permission) =>
      userHasPermission(user, permission)
    );

    const enabledPermissions = Object.entries(user.role.permissions || {})
      .flatMap(([module, actions]) =>
        Object.entries(actions || {})
          .filter(([, enabled]) => enabled === true)
          .map(([action]) => `${module}.${action}`)
      );

    const isPosOnlyPermissionSet =
      hasSalesShellAccess &&
      enabledPermissions.length > 0 &&
      enabledPermissions.every((permission) => POS_ONLY_NAV_PERMISSIONS.has(permission));

    if (isPosOnlyPermissionSet) {
      return [
        {
          label: "Point of Sale",
          items: [{ href: "/pos", icon: "pos", text: "POS" }],
        },
      ];
    }

    const itemPermissionList = (item = {}) => {
      if (Array.isArray(item.permissions)) return item.permissions;
      if (item.permission) return [item.permission];
      return [];
    };

    const canAccessRoute = (href, fallbackPermissions = []) => {
      const navOverridePermissions = NAV_ROUTE_PERMISSION_OVERRIDES[href];
      if (Array.isArray(navOverridePermissions)) {
        return hasAnyPermission(navOverridePermissions);
      }

      const rule = getRouteRuleForPath(href);
      if (Array.isArray(rule?.allOf) && rule.allOf.length > 0) {
        return rule.allOf.every((permission) => userHasPermission(user, permission));
      }
      const permissions = Array.isArray(rule?.anyOf) && rule.anyOf.length > 0
        ? rule.anyOf
        : fallbackPermissions;
      return Array.isArray(permissions) && permissions.length > 0 && hasAnyPermission(permissions);
    };

    const filterSubItems = (subItems = []) =>
      subItems.filter((subItem) =>
        canAccessRoute(subItem.href, itemPermissionList(subItem))
      );

    const sections = [];

    if (canAccessRoute("/dashboard")) {
      sections.push(navigationByPermission.dashboard);
    }

    // Create a Features section based on permissions
    const coreItems = [];
    
    // Add items based on permissions
    if (canAccessRoute("/pos")) {

      coreItems.push({
        href: "/pos",
        icon: "pos",
        text: "POS"
      });
    }
    if (canAccessRoute("/quotations")) {

      coreItems.push({
        href: "/quotations",
        icon: "quotations",
        text: "Quotations"
      });
    }
    if (canAccessRoute("/invoice")) {

      coreItems.push({
        href: "/invoice",
        icon: "invoicing",
        text: "Invoicing",
        badge: ""
      });
    }

    if (canAccessRoute("/expenses")) {
      coreItems.push({
        href: "/expenses",
        icon: "expenses",
        text: "Expense Tracking"
      });
    }

    if (canAccessRoute("/stock")) {
      coreItems.push({
        href: "/stock",
        icon: "stock",
        text: "Stock/Inventory management"
      });
    }

    if (canAccessRoute("/clients")) {
      coreItems.push({
        href: "/clients",
        icon: "users",
        text: "Customer Management"
      });
    }

    const purchaseSubItems = filterSubItems([
      { href: "/purchases/suppliers", text: "Suppliers", icon: "suppliers", permission: "suppliers.view" },
      { href: "/purchases/orders", text: "Orders", icon: "orders", permission: "purchases.view" },
      { href: "/purchases/receipts", text: "Receipts", icon: "receipts", permission: "purchases.view" },
      { href: "/purchases/bills", text: "Bills", icon: "bills", permission: "purchases.view" },
      { href: "/purchases/payments", text: "Payments", icon: "payments", permission: "purchases.view" },
    ]);

    if (purchaseSubItems.length > 0) {
      coreItems.push({
        href: purchaseSubItems[0].href,
        icon: "purchases",
        text: "Purchases",
        expandable: true,
        subItems: purchaseSubItems,
      });
    }

    if (canAccessRoute("/payments")) {
      coreItems.push({
        href: "/payments",
        icon: "payments",
        text: "Accounts & Reconciliation"
      });
    }

    const hrSubItems = filterSubItems([
      { href: "/hr/employees", text: "Employee Management", icon: "users", permission: "hr.view" },
      { href: "/hr/leave", text: "Leave Management", icon: "accountingPeriods", permissions: ["leave.view", "leave.create", "hr.view"] },
      { href: "/hr/attendance", text: "Attendance Tracking", icon: "Attendance Tracking", permission: "hr.view" },
      { href: "/hr/payroll", text: "Payroll Processing", icon: "Payroll Processing", permissions: ["payroll.view", "hr.view"] },
      { href: "/hr/payroll/paye-summary", text: "PAYE Summary", icon: "payeSummary", permissions: ["payroll.view", "hr.view", "reports.view"] },
      { href: "/hr/benefits", text: "Benefits & Allowances", icon: "benefits", permission: "hr.view" },
      { href: "/hr/pension", text: "Pension (NPS)", icon: "pension", permissions: ["payroll.view", "hr.view"] },
      { href: "/hr/gratuity", text: "Gratuity Management", icon: "gratuity", permissions: ["payroll.view", "hr.view"] },
      { href: "/hr/advances", text: "Salary Advances", icon: "advances", permissions: ["payroll.view", "hr.view"] },
      { href: "/hr/reports", text: "HR Reports", icon: "reports", permissions: ["hr.view", "reports.view"] },
    ]);

    if (hrSubItems.length > 0) {
      coreItems.push({
        href: hrSubItems[0].href,
        icon: "users",
        text: "HR & Payroll",
        expandable: true,
        subItems: hrSubItems
      });
    }

    const rentalSubItems = filterSubItems([
      { href: "/rentals", text: "Rentals", icon: "Rentals", permission: "rentals.view" },
      { href: "/rentals/hirings", text: "Hirings", icon: "Hiring", permission: "rentals.view" },
      { href: "/rentals/reports", text: "Reports", icon: "Reports", permission: "rentals.view" },
    ]);

    if (rentalSubItems.length > 0) {
      coreItems.push({
        href: rentalSubItems[0].href,
        icon: "rental",
        text: "Rental & Hiring",
        expandable: true,
        subItems: rentalSubItems,
      });
    }

    // Reports stays last in Features.
    if (canAccessRoute("/reports") || canAccessRoute("/reports-v2")) {
      coreItems.push({
        href: "/reports-v2",
        icon: "reports",
        text: "Reports"
      });
    }

    // MRA EIS: only when tenant has an active EIS package OR super-admin entitlement,
    // and the user can open EIS settings routes (Owners/Admins always can).
    const eisUnlocked = eisManagementAccess?.unlocked === true;
    const canViewEisRoutes = canAccessRoute("/settings/integrations/mra-eis");
    if (eisUnlocked && canViewEisRoutes) {
      const navItems = eisManagementAccess?.navItems?.length
        ? eisManagementAccess.navItems
        : TENANT_EIS_NAV_FULL;
      coreItems.push(buildTenantEisNavMenuItem(navItems));
    }
    
    // Add Features section if there are any items
    if (coreItems.length > 0) {
      sections.push({
        label: "Features",
        items: coreItems
      });
    }

    // Accounting section extras (formerly Additional Features)
    const accountingSectionItems = [];

    const budgetSubItems = filterSubItems([
      { href: "/budget-forecast/budgets", text: "Budgets", icon: "budgets", permission: "budgets.view" },
      { href: "/budget-forecast/forecasts", text: "Forecasts", icon: "forecasts", permission: "budgets.view" },
      { href: "/budget-forecast/reports", text: "Reports", icon: "reports", permission: "budgets.view" },
    ]);

    if (budgetSubItems.length > 0) {
      accountingSectionItems.push({
        href: budgetSubItems[0].href,
        icon: "reports",
        text: "Budget & Forecast",
        expandable: true,
        subItems: budgetSubItems,
      });
    }

    // Assets & Liabilities should be permission-gated (deny-by-default).
    if (canAccessRoute("/asset-management")) {
      accountingSectionItems.push({
        href: "/asset-management",
        icon: "reports",
        text: "Assets & Liabilities"
      });
    }

    // Tax management follows the same route rule as the page guard.
    if (canAccessRoute("/tax-management")) {
      accountingSectionItems.push({
        href: "/tax-management",
        icon: "taxCodes",
        text: "Tax Management",
        expandable: true,
        subItems: TAX_MANAGEMENT_SUB_ITEMS,
      });
    }

    // Accounting section: include only items explicitly permitted.
    const accountingSubItems = filterSubItems([
      { href: "/general-ledger-v2", text: "General Ledger", icon: "generalLedger", permission: "generalLedger.view" },
      { href: "/accounting/receivables", text: "Receivables", icon: "receivables", permissions: NAV_ROUTE_PERMISSION_OVERRIDES["/accounting/receivables"] },
      { href: "/accounting/payables", text: "Payables", icon: "payables", permission: "expenses.view" },
      { href: "/financial-calendar-v2", text: "Financial Calendar", icon: "financialCalendar", permission: "journalEntries.view" },
      { href: "/capital-account", text: "Capital Account", icon: "capital", permissions: ["accounts.view", "reports.view", "equity.view", "equity.viewDashboard"] },
      { href: "/chart-of-accounts", text: "Chart of Accounts", icon: "coa", permission: "accounts.view" },
      { href: "/journal-entries", text: "Journal Entries", icon: "journal", permission: "journalEntries.view" },
      { href: "/trial-balance", text: "Trial Balance", icon: "trialBalance", permission: "trialBalance.view" },
      { href: "/transactions/reversals", text: "Reversals", icon: "reversals", permission: "journalEntries.view" },
    ]);

    if (accountingSubItems.length > 0 || accountingSectionItems.length > 0) {
      const items = [];
      if (accountingSubItems.length > 0) {
        items.push({
          href: "/accounting",
          icon: "coa",
          text: "Accounting",
          expandable: true,
          subItems: accountingSubItems.map(({ permission, permissions, ...rest }) => rest),
        });
      }
      items.push(...accountingSectionItems);
      sections.push({
        label: "Accounting",
        items,
      });
    }
    
    // Create a business management section if user has access to any of these
    const businessItems = [];
    // Add User & Role Management if user has permission
    if (canAccessRoute("/users")) {
      businessItems.push({
        href: "/users",
        icon: "users",
        text: "User & Role Management"
      });
    }
    if (
      userHasPermission(user, "securityGovernance.viewDashboard") ||
      userHasPermission(user, "securityGovernance.viewAudit") ||
      userHasPermission(user, "users.view") ||
      userHasPermission(user, "roles.view") ||
      userHasPermission(user, "system.view")
    ) {
      businessItems.push({
        href: "/security-governance",
        icon: "settings",
        text: "Security & Governance",
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
  /** Exact match for the parent/dashboard href; prefix match for deeper child routes. */
  const isSubNavActive = (parentHref, subHref) => {
    if (!subHref) return false;
    if (subHref === parentHref) return pathname === subHref;
    return pathname === subHref || pathname.startsWith(`${subHref}/`);
  };
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
      {/* Compact business switcher + plan / expiry */}
      {!collapsed && user?.tenant && (
        <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <BusinessSwitcher
            isTrial={Boolean(subscription?.isTrial)}
            planLabel={
              isUserLoading
                ? null
                : subscription?.isTrial
                  ? 'Free Trial'
                  : getPlanDisplayName(subscription?.plan) || null
            }
            expiryLabel={
              isUserLoading
                ? null
                : (subscription?.isTrial && subscription?.trialEndDate) || subscription?.expiresAt
                  ? `${subscription?.isTrial ? tt('Ends') : tt('Renews')} ${formatDate(
                      subscription?.isTrial ? subscription?.trialEndDate : subscription?.expiresAt
                    )}`
                  : null
            }
          />
        </div>
      )}

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
              }}>{navT(section.label)}</div>
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
                            }}>{navT(item.text)}</span>
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
                            const isSubActive = isSubNavActive(item.href, subItem.href);
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
                                  {navT(subItem.text)}
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
                          }}>{navT(item.text)}</span>
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
