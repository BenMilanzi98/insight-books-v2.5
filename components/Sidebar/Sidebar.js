"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, User, ChevronDown, HelpCircle, LifeBuoy, X, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { getPlanDisplayName } from "@/lib/subscriptionConfig";

// Define navigation sections with permissions
const navigationByPermission = {
  // Master Admin sees everything - All sections available
  masterAdmin: [
    {
      label: "Administration",
      items: [
        { href: "/admin/dashboard", icon: "📊", text: "Dashboard" },
        { href: "/admin/tenant-management", icon: "🏢", text: "Tenant Management" },
        { href: "/admin/global-settings", icon: "⚙️", text: "Global Settings" },
        { href: "/admin/affiliate-system", icon: "🤝", text: "Affiliate Management" },
        { 
          href: "/admin/internal-business", 
          icon: "🏛️", 
          text: "Business Owner Module", 
          expandable: true,
          subItems: [
            { href: "/admin/internal-business/overview", text: "Business Overview" },
            { href: "/admin/internal-business/finances", text: "Financial Management" },
            { href: "/admin/internal-business/staff", text: "Staff Management" },
            { href: "/admin/internal-business/expenses", text: "Expense Tracking" },
            { href: "/admin/internal-business/revenue", text: "Revenue Analytics" },
            { href: "/admin/internal-business/reports", text: "Business Reports" },
          ]
        },
      ],
    },
    {
      label: "Business Owner Controls",
      items: [
        { href: "/tenants/dashboard", icon: "🏠", text: "Business Owner Dashboard" },
        { href: "/users", icon: "👥", text: "User & Role Management" },
        { href: "/customization", icon: "🎨", text: "System Customization" },
        { href: "/admin/billing", icon: "💰", text: "Billing & Subscriptions" },
        { href: "/admin/audit-logs", icon: "📜", text: "Audit Logs" },
      ],
    },
    {
      label: "Accounting",
      items: [
        // {
        //   href: "/financial-setup",
        //   icon: "💼",
        //   text: "Financial Setup",
        //   expandable: true,
        //   subItems: [
        //     { href: "/financial-setup/opening-balances", text: "Opening Balances" },
        //   ]
        // },
        { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts" },
        { href: "/journal-entries", icon: "✏️", text: "Journal Entries" },
        { href: "/trial-balance", icon: "⚖️", text: "Trial Balance" },
        { href: "/capital-account", icon: "💰", text: "Capital Account" },
      ],
    },
    {
      label: "Core Features",
      items: [
        { href: "/pos", icon: "🧾", text: "POS" },
        { href: "/quotations", icon: "📄", text: "Quotations" },
        { href: "/invoice", icon: "📝", text: "Invoicing", badge: "3" },
        { href: "/expenses", icon: "💸", text: "Expense Tracking" },
        { href: "/payments", icon: "💳", text: "Payment Processing" },
        { href: "/reports", icon: "📊", text: "Financial Reporting" },
        { href: "/clients", icon: "🤵", text: "Client Management" },
      ],
    },
      {
        label: "Additional Modules",
        items: [
          { href: "/stock", icon: "📦", text: "Stock Management" },
          {
            href: "/purchases/suppliers",
            icon: "🛒",
            text: "Purchases",
          },
        // HR Module temporarily commented out
        { 
          href: "/hr", 
          icon: "👨‍💼", 
          text: "HR & Payroll",
          expandable: true,
          subItems: [
            { href: "/hr/employees", text: "Employee Management" },
            { href: "/hr/leave", text: "Leave Management" },
            { href: "/hr/attendance", text: "Attendance Tracking" },
            { href: "/hr/performance", text: "Performance Management" },
            { href: "/hr/payroll", text: "Payroll Processing" },
            { href: "/hr/pension", text: "Pension (NPS)" },
            { href: "/hr/gratuity", text: "Gratuity Management" },
            { href: "/hr/advances", text: "Salary Advances" },
            { href: "/hr/reports", text: "HR Reports" }
          ]
        },
        // { href: "/pos", icon: "🧾", text: "Point of Sale (POS)" },
        { href: "/affiliate", icon: "🔗", text: "Affiliate System" },
        { href: "/tax-management", icon: "📑", text: "Tax Management" },
      ],
    },
    {
      label: "Accounting",
      items: [
        // { 
        //   href: "/financial-setup", 
        //   icon: "💼", 
        //   text: "Financial Setup",
        //   expandable: true,
        //   subItems: [
        //     { href: "/financial-setup/opening-balances", text: "Opening Balances" },
        //   ]
        // },
        { href: "/chart-of-accounts", icon: "📋", text: "Chart of Accounts" },
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
  accounting: {
    label: "Accounting",
    items: [
      // {
      //   href: "/financial-setup",
      //   icon: "💼",
      //   text: "Financial Setup",
      //   expandable: true,
      //   subItems: [
      //     { href: "/financial-setup/opening-balances", text: "Opening Balances" },
      //   ]
      // },
      { href: "/capital-account", icon: "💰", text: "Capital Account" },
      { href: "/trial-balance", icon: "⚖️", text: "Trial Balance", permission: "reports.view" },
    ]
  },
  // Additional modules
  stock: {
    label: "Stock",
    items: [
      { href: "/stock", icon: "📦", text: "Stock Management", permission: "inventory.view" },
    ]
  },
  assets: {
    label: "Asset Management",
    items: [
      { href: "/asset-management", icon: "🏗️", text: "Asset Management", permission: "assets.view" },
    ]
  },
  hr: {
    label: "HR & Payroll",
    items: [
      { href: "/hr", icon: "👨‍💼", text: "HR & Payroll", permission: "hr.view" },
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

// Helper function to check if user has a specific permission
const hasPermission = (permissions, permission) => {
  if (!permissions) return false;
  if (permissions[permission] === true) {
    return true;
  }
  // Split the permission string (e.g., "users.view" -> ["users", "view"])
  const [category, action] = permission.split('.');
  
  // Check if the user has the specified permission
  return permissions[category]?.[action] === true;
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
    
    // For other roles, build navigation based on permissions
    const sections = [];
    
    // Dashboard is always included
    sections.push(navigationByPermission.dashboard);
    
    
    // Create a Core Features section based on permissions
    const coreItems = [];
    
    // Add items based on permissions
    if (hasPermission(user.role.permissions, "sales.view")) {

      coreItems.push({
        href: "/pos",
        icon: "🧾",
        text: "POS"
      });
    }
    if (hasPermission(user.role.permissions, "quotations.view")) {

      coreItems.push({
        href: "/quotations",
        icon: "📄",
        text: "Quotations"
      });
    }
    if (hasPermission(user.role.permissions, "invoices.view")) {

      coreItems.push({
        href: "/invoice",
        icon: "📝",
        text: "Invoicing",
        badge: ""
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

    if (hasPermission(user.role.permissions, "clients.view")) {
      coreItems.push({
        href: "/clients",
        icon: "🤵",
        text: "Client Management"
      });
    }

    // Always show Asset & Liability Management (no permission check for now)
    coreItems.push({
      href: "/asset-management",
      icon: "🏗️",
      text: "Assets & Liabilities"
    });

    if (hasPermission(user.role.permissions, "hr.view")) {
      coreItems.push({
        href: "/hr",
        icon: "👨‍💼",
        text: "HR & Payroll",
        expandable: true,
        subItems: [
          { href: "/hr/employees", text: "Employee Management" },
          { href: "/hr/leave", text: "Leave Management" },
          { href: "/hr/attendance", text: "Attendance Tracking" },
          { href: "/hr/performance", text: "Performance Management" },
          { href: "/hr/payroll", text: "Payroll Processing" },
          { href: "/hr/pension", text: "Pension (NPS)" },
          { href: "/hr/gratuity", text: "Gratuity Management" },
          { href: "/hr/advances", text: "Salary Advances" },
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
    
    if (hasPermission(user.role.permissions, "inventory.view")) {
      additionalItems.push({
        href: "/stock",
        icon: "📦",
        text: "Stock Management"
      });
    }

    
    // Add Purchases if user has inventory or purchases permission
    const canViewPurchases = hasPermission(user.role.permissions, "purchases.view") || hasPermission(user.role.permissions, "inventory.view");
    if (canViewPurchases) {
      additionalItems.push({
        href: "/purchases/suppliers",
        icon: "🛒",
        text: "Purchases",
      });
    }
    
    // Asset Management moved to Core Features section
    
    // HR Module temporarily commented out


    
    // // Add more additional modules based on permissions
    // if (hasPermission(user.role.permissions, "invoices.view")) {
    //   additionalItems.push({
    //     href: "/pos",
    //     icon: "🧾",
    //     text: "Point of Sale (POS)"
    //   });
    // }
    
    if (hasPermission(user.role.permissions, "tax.view")) {
   
      additionalItems.push({
        href: "/tax-management",
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

    if (
      hasPermission(user.role.permissions, "reports.view") ||
      hasPermission(user.role.permissions, "accounting.view")
    ) {
      sections.push(navigationByPermission.accounting);
    }
    
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

    // if (hasPermission(user.role.permissions, "system.view")) {
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
          backgroundColor: "#1a202c",
          background: "linear-gradient(180deg, #1a202c 0%, #2d3748 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          position: isMobile ? "fixed" : "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          overflow: "hidden",
          boxShadow: collapsed
            ? "2px 0 8px rgba(0, 0, 0, 0.1)"
            : "4px 0 24px rgba(0, 0, 0, 0.15)",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
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

        {/* Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-btn"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            color: "white",
            minWidth: "36px",
            minHeight: "36px"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "rgba(49, 130, 206, 0.2)";
            e.target.style.borderColor = "rgba(49, 130, 206, 0.4)";
            e.target.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
            e.target.style.transform = "scale(1)";
          }}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? (
            <Menu size={18} />
          ) : (
            <X size={18} />
          )}
        </button>
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
            transition: "all 0.2s ease",
            borderRadius: "12px",
            margin: "8px 8px 0 8px",
            background: "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.05) 100%)",
            border: "1px solid rgba(107, 114, 128, 0.15)"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "rgba(107, 114, 128, 0.15)";
            e.target.style.transform = "translateY(-2px) scale(1.02)";
            e.target.style.boxShadow = "0 6px 20px rgba(107, 114, 128, 0.25)";
            e.target.style.borderColor = "rgba(107, 114, 128, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(75, 85, 99, 0.05) 100%)";
            e.target.style.transform = "translateY(0) scale(1)";
            e.target.style.boxShadow = "none";
            e.target.style.borderColor = "rgba(107, 114, 128, 0.15)";
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
            boxShadow: "0 2px 8px rgba(107, 114, 128, 0.3)",
            transition: "all 0.2s ease"
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
          transition: "all 0.2s ease",
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
          e.target.style.backgroundColor = subscription?.isTrial
            ? "rgba(251, 191, 36, 0.15)"
            : "rgba(49, 130, 206, 0.15)";
          e.target.style.transform = "translateY(-2px) scale(1.02)";
          e.target.style.boxShadow = subscription?.isTrial
            ? "0 6px 20px rgba(251, 191, 36, 0.25)"
            : "0 6px 20px rgba(49, 130, 206, 0.25)";
          e.target.style.borderColor = subscription?.isTrial
            ? "rgba(251, 191, 36, 0.4)"
            : "rgba(49, 130, 206, 0.3)";
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = subscription?.isTrial
            ? "linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)"
            : "linear-gradient(135deg, rgba(49, 130, 206, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)";
          e.target.style.transform = "translateY(0) scale(1)";
          e.target.style.boxShadow = "none";
          e.target.style.borderColor = subscription?.isTrial
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
          boxShadow: subscription?.isTrial
            ? "0 2px 8px rgba(245, 158, 11, 0.3)"
            : "0 2px 8px rgba(59, 130, 246, 0.3)",
          transition: "all 0.2s ease"
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
                          gap: "12px",
                          position: "relative",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          cursor: "pointer",
                          borderRadius: "8px",
                          border: "1px solid transparent"
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive(item.href)) {
                            e.target.style.backgroundColor = "rgba(49, 130, 206, 0.1)";
                            e.target.style.borderColor = "rgba(49, 130, 206, 0.2)";
                            e.target.style.transform = "translateX(4px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive(item.href)) {
                            e.target.style.backgroundColor = "transparent";
                            e.target.style.borderColor = "transparent";
                            e.target.style.transform = "translateX(0)";
                          }
                        }}
                      >
                        <span className="nav-icon" style={{
                          fontSize: "16px"
                        }}>{item.icon}</span>
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
                                transition: 'transform 0.2s'
                              }}
                            />
                          </>
                        )}
                      </div>
                      {!collapsed && isExpanded(item.href) && (
                        <div className="sub-menu">
                          {item.subItems.map((subItem, subIndex) => (
                            <Link 
                              href={subItem.href}
                              key={`subitem-${sIndex}-${iIndex}-${subIndex}`}
                              className={`sub-menu-item ${isActive(subItem.href) ? "active" : ""}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "8px 16px 8px 44px",
                                textDecoration: "none",
                                color: isActive(subItem.href) ? "white" : "rgba(255,255,255,0.6)",
                                backgroundColor: isActive(subItem.href) ? "rgba(49, 130, 206, 0.1)" : "transparent",
                                fontSize: "13px",
                              }}
                            >
                              {subItem.text}
                            </Link>
                          ))}
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
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        borderRadius: "8px"
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive(item.href)) {
                          e.target.style.backgroundColor = "rgba(49, 130, 206, 0.1)";
                          e.target.style.borderColor = "rgba(49, 130, 206, 0.2)";
                          e.target.style.transform = "translateX(4px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive(item.href)) {
                          e.target.style.backgroundColor = "transparent";
                          e.target.style.borderColor = "transparent";
                          e.target.style.transform = "translateX(0)";
                        }
                      }}
                    >
                      <span className="nav-icon" style={{
                        fontSize: "16px"
                      }}>{item.icon}</span>
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
  `
}} />
</>
);
};

export default Sidebar;
