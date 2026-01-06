"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LogOut, 
  ChevronRight, 
  ChevronDown,
  BarChart3,
  Building2,
  Settings,
  Users,
  FileText,
  Shield,
  TrendingUp,
  DollarSign,
  Activity,
  Database,
  Bell,
  User
} from 'lucide-react';

const AdminSidebar = ({ collapsed, setCollapsed, admin }) => {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState([]);

  const toggleExpand = (href) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(item => item !== href)
        : [...prev, href]
    );
  };

  const isExpanded = (href) => expandedItems.includes(href);
  const isActive = (href) => pathname === href;

  const navigation = [
    {
      label: "Administration",
      items: [
        { href: '/admin/dashboard', icon: '📊', text: 'Dashboard' },
        { href: '/admin/tenant-management', icon: '🏢', text: 'Tenant Management' },
        { 
          href: '/admin/user-management', 
          icon: '👥', 
          text: 'User Management',
        },
        { href: '/admin/global-settings', icon: '⚙️', text: 'Global Settings' },
        { href: '/admin/affiliate', icon: '🤝', text: 'Affiliate Management' },
        { 
          href: '/admin/billing', 
          icon: '💰', 
          text: 'Billing & Subscriptions',
          expandable: true,
          subItems: [
            { href: '/admin/billing/overview', text: 'Billing Overview' },
            { href: '/admin/billing/subscriptions', text: 'Subscription Management' },
            { href: '/admin/billing/invoices', text: 'Invoices' },
            { href: '/admin/billing/payments', text: 'Payments' },
          ]
        },
        { 
          href: '/admin/email-management', 
          icon: '📧', 
          text: 'Email Management',
          description: 'Send bulk emails to users'
        },
        { 
          href: '/admin/audit', 
          icon: '📜', 
          text: 'Audit & Security',
        }
      ]
    }
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (collapsed) {
    return (
      <div 
        className="sidebar collapsed"
        style={{
          width: "80px",
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
        {/* Collapsed Header */}
        <div className="sidebar-header" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }}>
          <div className="flex items-center">
            <img src="/logo.png" alt="InsightBooks Logo" className="h-8 w-auto object-contain rounded-md"/>
          </div>
        </div>

        {/* Collapsed Footer with logout only */}
        <div className="sidebar-footer-collapsed" style={{
          padding: "16px 8px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "center",
          marginTop: "auto"
        }}>
          <button 
            onClick={handleLogout}
            className="footer-link" 
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "16px",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="sidebar"
      style={{
        width: "280px",
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
      <div className="sidebar-header" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div className="flex items-center">
          <img src="/logo.png" alt="InsightBooks Logo" className="h-11 w-auto object-contain rounded-md"/>
        </div>
      </div>

      {/* Admin User Section */}
      <div className="user-section" style={{
        display: "flex",
        alignItems: "center",
        padding: "16px",
        gap: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div className="user-avatar" style={{
          backgroundColor: "#3182ce",
          color: "white",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          <User className="h-5 w-5" />
        </div>
        
        <div className="user-info" style={{
          flex: 1
        }}>
          <div className="user-name" style={{
            fontWeight: "600",
            fontSize: "14px"
          }}>{admin?.name || 'Admin'}</div>
          <div className="user-role" style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.7)"
          }}>{admin?.role || 'Administrator'}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="nav-content" style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "16px 0"
      }}>
        {navigation.map((section, sIndex) => (
          <div className="nav-section" key={`section-${sIndex}`} style={{
            marginBottom: "16px"
          }}>
            <div className="nav-label" style={{
              fontSize: "12px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              padding: "0 16px 8px",
              fontWeight: "600"
            }}>{section.label}</div>
            <div className="nav-group">
              {section.items.map((item, iIndex) => (
                <div key={`item-${sIndex}-${iIndex}`}>
                  {item.expandable ? (
                    <div>
                      <div 
                        className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                        onClick={() => toggleExpand(item.href)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 16px",
                          color: isActive(item.href) ? "white" : "rgba(255,255,255,0.7)",
                          backgroundColor: isActive(item.href) ? "rgba(49, 130, 206, 0.2)" : "transparent",
                          borderLeft: isActive(item.href) ? "3px solid #3182ce" : "3px solid transparent",
                          borderRight: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                          borderTop: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                          borderBottom: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                          gap: "12px",
                          position: "relative",
                          transition: "all 0.2s ease",
                          cursor: "pointer"
                        }}
                      >
                        <span className="nav-icon" style={{
                          fontSize: "16px"
                        }}>{item.icon}</span>
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
                      </div>
                      {isExpanded(item.href) && (
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
                        padding: "10px 16px",
                        textDecoration: "none",
                        color: isActive(item.href) ? "white" : "rgba(255,255,255,0.7)",
                        backgroundColor: isActive(item.href) ? "rgba(49, 130, 206, 0.2)" : "transparent",
                        borderLeft: isActive(item.href) ? "3px solid #3182ce" : "3px solid transparent",
                        borderRight: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        borderTop: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        borderBottom: isActive(item.href) ? "1px solid rgba(49, 130, 206, 0.3)" : "1px solid transparent",
                        gap: "12px",
                        position: "relative",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <span className="nav-icon" style={{
                        fontSize: "16px"
                      }}>{item.icon}</span>
                      <span className="nav-text" style={{
                        fontSize: "14px"
                      }}>{item.text}</span>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer" style={{
        padding: "16px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        fontSize: "12px"
      }}>
        <div className="app-version" style={{
          color: "rgba(255,255,255,0.5)",
          marginBottom: "8px"
        }}>InsightBooks v1.0.2</div>
        <div className="footer-links" style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <button 
            onClick={handleLogout}
            className="footer-link" 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            <LogOut size={14} className="footer-icon" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar; 