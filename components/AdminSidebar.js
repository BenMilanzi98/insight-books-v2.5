"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Shield, 
  Building2, 
  Users, 
  DollarSign, 
  Server, 
  Settings, 
  BarChart3,
  FileText,
  CreditCard,
  Activity,
  Database,
  Globe,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  X,
  Mail
} from "lucide-react";

const AdminSidebar = ({ collapsed, setCollapsed }) => {
  const pathname = usePathname();

  const navigation = [
    {
      label: "Dashboard",
      items: [
        { 
          href: "/admin/dashboard", 
          icon: Shield, 
          text: "System Overview",
          description: "Monitor system health and performance"
        }
      ]
    },
    {
      label: "Tenant Management",
      items: [
        { 
          href: "/admin/tenants", 
          icon: Building2, 
          text: "All Tenants",
          description: "Manage business accounts and subscriptions"
        },
        { 
          href: "/admin/tenants/trials", 
          icon: Clock, 
          text: "Trial Users",
          description: "Monitor trial accounts and conversions"
        },
        { 
          href: "/admin/tenants/expiring", 
          icon: AlertTriangle, 
          text: "Expiring Soon",
          description: "Track subscriptions nearing expiration"
        }
      ]
    },
    {
      label: "User Management",
      items: [
        { 
          href: "/admin/users", 
          icon: Users, 
          text: "All Users",
          description: "Manage user accounts across tenants"
        },
        { 
          href: "/admin/users/roles", 
          icon: Shield, 
          text: "Roles & Permissions",
          description: "Configure user roles and access levels"
        },
        { 
          href: "/admin/users/activity", 
          icon: Activity, 
          text: "User Activity",
          description: "Monitor user engagement and logins"
        }
      ]
    },
    {
      label: "Financial Oversight",
      items: [
        { 
          href: "/admin/financials", 
          icon: DollarSign, 
          text: "Revenue Overview",
          description: "Track system-wide financial metrics"
        },
        { 
          href: "/admin/financials/invoices", 
          icon: FileText, 
          text: "Invoice Management",
          description: "Monitor all invoices and payments"
        },
        { 
          href: "/admin/financials/subscriptions", 
          icon: CreditCard, 
          text: "Subscription Analytics",
          description: "Analyze subscription patterns and revenue"
        }
      ]
    },
    {
      label: "System Administration",
      items: [
        { 
          href: "/admin/system", 
          icon: Server, 
          text: "System Health",
          description: "Monitor system performance and uptime"
        },
        { 
          href: "/admin/system/database", 
          icon: Database, 
          text: "Database Status",
          description: "Check database health and performance"
        },
        { 
          href: "/admin/system/security", 
          icon: Shield, 
          text: "Security Monitoring",
          description: "Track security events and threats"
        },
        { 
          href: "/admin/system/backups", 
          icon: Zap, 
          text: "Backup Management",
          description: "Manage system backups and recovery"
        },
        { 
          href: "/admin/email-management", 
          icon: Mail, 
          text: "Email Management",
          description: "Send bulk emails to users"
        }
      ]
    },
    {
      label: "Analytics & Reports",
      items: [
        { 
          href: "/admin/analytics", 
          icon: BarChart3, 
          text: "Business Analytics",
          description: "Comprehensive business insights"
        },
        { 
          href: "/admin/reports", 
          icon: TrendingUp, 
          text: "System Reports",
          description: "Generate detailed system reports"
        },
        { 
          href: "/admin/analytics/geographic", 
          icon: Globe, 
          text: "Geographic Data",
          description: "Analyze user distribution by location"
        }
      ]
    },
    {
      label: "Configuration",
      items: [
        { 
          href: "/admin/settings", 
          icon: Settings, 
          text: "System Settings",
          description: "Configure global system parameters"
        },
        { 
          href: "/admin/settings/email", 
          icon: Zap, 
          text: "Email Configuration",
          description: "Manage email templates and settings"
        },
        { 
          href: "/admin/settings/integrations", 
          icon: Zap, 
          text: "Third-party Integrations",
          description: "Configure external service connections"
        }
      ]
    }
  ];

  const isActive = (href) => pathname === href;

  return (
    <div
      style={{
        width: collapsed ? "80px" : "280px",
        height: "100vh",
        backgroundColor: "#1a202c",
        color: "white",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease-in-out",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        overflow: "hidden"
      }}
    >
      {/* Sidebar Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            backgroundColor: "#3182ce",
            color: "white",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold"
          }}>
            <Shield size={20} />
          </div>
          {!collapsed && <span style={{ fontSize: "18px", fontWeight: "600" }}>Admin</span>}
        </div>
        {!collapsed && (
          <button 
            onClick={() => setCollapsed(true)}
            style={{ 
              padding: "4px", 
              borderRadius: "6px", 
              color: "rgba(255,255,255,0.6)", 
              cursor: "pointer",
              backgroundColor: "transparent",
              border: "none"
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "16px 0"
      }}>
        {navigation.map((section, sIndex) => (
          <div key={`section-${sIndex}`} style={{ marginBottom: "16px" }}>
            {!collapsed && (
              <div style={{
                fontSize: "12px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                padding: "0 16px 8px",
                fontWeight: "600"
              }}>
                {section.label}
              </div>
            )}
            <div>
              {section.items.map((item, iIndex) => (
                <Link
                  key={`item-${sIndex}-${iIndex}`}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: collapsed ? "12px 16px" : "10px 16px",
                    textDecoration: "none",
                    color: isActive(item.href) ? "white" : "rgba(255,255,255,0.7)",
                    backgroundColor: isActive(item.href) ? "rgba(49, 130, 206, 0.2)" : "transparent",
                    borderLeft: isActive(item.href) ? "3px solid #3182ce" : "3px solid transparent",
                    gap: "12px",
                    transition: "all 0.2s ease",
                    position: "relative"
                  }}
                >
                  <item.icon size={collapsed ? 20 : 18} />
                  {!collapsed && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: "500" }}>{item.text}</div>
                      <div style={{ 
                        fontSize: "11px", 
                        color: "rgba(255,255,255,0.5)",
                        marginTop: "2px",
                        lineHeight: "1.2"
                      }}>
                        {item.description}
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Section */}
      {!collapsed && (
        <div style={{ 
          padding: "16px", 
          borderTop: "1px solid rgba(255,255,255,0.1)",
          backgroundColor: "rgba(0,0,0,0.1)"
        }}>
          <div style={{
            fontSize: "12px",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "16px",
            fontWeight: "600"
          }}>
            Quick Stats
          </div>
          
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: "1.4" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>System Status:</span>
              <span style={{ color: "#48bb78" }}>● Healthy</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Uptime:</span>
              <span>99.9%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>Active Users:</span>
              <span>1,247</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Tenants:</span>
              <span>89</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSidebar; 