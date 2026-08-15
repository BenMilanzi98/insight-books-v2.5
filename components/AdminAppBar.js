"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect, useRef } from "react";
import { Menu, Bell, User, Search, X, Shield, LogOut } from "lucide-react";

const AdminAppBar = ({ toggleSidebar, sidebarOpen, isMobile, adminInfo, onLogout }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  
  // Function to get initials from name
  const getInitials = (name) => {
    if (!name) return 'A';
    
    const nameParts = name.trim().split(' ');
    
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }
    
    // Get first and last part of the name
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  };
  
  // Handle clicks outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Mock notifications for admin
  const notifications = [
    {
      id: 1,
      title: "New tenant registered",
      message: "TechStart Inc has joined the platform",
      time: "2 minutes ago",
      type: "info"
    },
    {
      id: 2,
      title: "System backup completed",
      message: "Daily backup completed successfully",
      time: "1 hour ago",
      type: "success"
    },
    {
      id: 3,
      title: "Subscription expiring",
      message: "Acme Corp subscription expires in 3 days",
      time: "2 hours ago",
      type: "warning"
    }
  ];
  
  const handleToggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (profileOpen) setProfileOpen(false);
  };
  
  const handleToggleProfile = () => {
    setProfileOpen(!profileOpen);
    if (notificationsOpen) setNotificationsOpen(false);
  };

  return (
    <header style={{
      position: "sticky", 
      top: 0, 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      height: "64px", 
      padding: "0 16px", 
      backgroundColor: "white", 
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)", 
      zIndex: 50,
      borderBottom: "1px solid #E5E7EB"
    }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px" 
      }}>
        <button 
          onClick={toggleSidebar} 
          aria-label={tt('Toggle menu')}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            padding: "8px",
            borderRadius: "6px",
            color: "#9CA3AF"
          }}
        >
          <Menu size={20} />
        </button>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            backgroundColor: "#4F46E5",
            color: "white",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: "20px", 
              fontWeight: 600, 
              margin: 0, 
              color: "#111827"
            }}>{tt('Admin Portal')}</h1>
            <p style={{ 
              fontSize: "14px", 
              color: "#6B7280", 
              margin: 0 
            }}>{tt('System Administration')}</p>
          </div>
        </div>
      </div>

      {/* Center - Search bar */}
      <div style={{ flex: 1, maxWidth: "400px", margin: "0 32px" }}>
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute",
            inset: "0",
            left: "12px",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            <Search style={{ height: "20px", width: "20px", color: "#9CA3AF" }} />
          </div>
          <input
            type="text"
            placeholder={tt('Search tenants, users, invoices...')}
            style={{
              display: "block",
              width: "100%",
              paddingLeft: "40px",
              paddingRight: "12px",
              paddingTop: "8px",
              paddingBottom: "8px",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              backgroundColor: "#F9FAFB",
              color: "#374151",
              fontSize: "14px"
            }}
          />
        </div>
      </div>

      {/* Right side - Notifications and profile */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px" 
      }}>
        {/* Notifications */}
        <div style={{ position: "relative" }} ref={notificationRef}>
          <button
            onClick={handleToggleNotifications}
            style={{
              padding: "8px",
              borderRadius: "6px",
              color: "#9CA3AF",
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "relative"
            }}
          >
            <Bell style={{ height: "20px", width: "20px" }} />
            {notifications.length > 0 && (
              <span style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                display: "block",
                height: "8px",
                width: "8px",
                borderRadius: "50%",
                backgroundColor: "#EF4444",
                border: "2px solid white"
              }}></span>
            )}
          </button>
          
          {/* Notifications dropdown */}
          {notificationsOpen && (
            <div style={{
              position: "absolute",
              right: 0,
              marginTop: "8px",
              width: "320px",
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              border: "1px solid #E5E7EB",
              zIndex: 50
            }}>
              <div style={{
                padding: "8px 16px",
                borderBottom: "1px solid #E5E7EB"
              }}>
                <h3 style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#111827",
                  margin: 0
                }}>{tt('Notifications')}</h3>
              </div>
              <div style={{ maxHeight: "256px", overflowY: "auto" }}>
                {notifications.map((notification) => (
                  <div key={notification.id} style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #F3F4F6",
                    cursor: "pointer"
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          marginTop: "8px",
                          backgroundColor: notification.type === 'success' ? '#10B981' :
                            notification.type === 'warning' ? '#F59E0B' :
                            notification.type === 'error' ? '#EF4444' : '#3B82F6'
                        }}></div>
                      </div>
                      <div style={{ marginLeft: "12px", flex: 1 }}>
                        <p style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#111827",
                          margin: "0 0 4px 0"
                        }}>{notification.title}</p>
                        <p style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          margin: "0 0 4px 0"
                        }}>{notification.message}</p>
                        <p style={{
                          fontSize: "12px",
                          color: "#9CA3AF",
                          margin: 0
                        }}>{notification.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                padding: "8px 16px",
                borderTop: "1px solid #E5E7EB"
              }}>
                <button style={{
                  fontSize: "14px",
                  color: "#4F46E5",
                  fontWeight: "500",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}>
                  {tt('View all notifications')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button
            onClick={handleToggleProfile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px",
              borderRadius: "8px",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              {adminInfo ? getInitials(adminInfo.name) : 'A'}
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "#111827",
                margin: "0 0 2px 0"
              }}>{adminInfo?.name || 'Admin'}</p>
              <p style={{
                fontSize: "12px",
                color: "#6B7280",
                margin: 0
              }}>{adminInfo?.role || 'Administrator'}</p>
            </div>
          </button>
          
          {/* Profile dropdown */}
          {profileOpen && (
            <div style={{
              position: "absolute",
              right: 0,
              marginTop: "8px",
              width: "192px",
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              border: "1px solid #E5E7EB",
              zIndex: 50
            }}>
              <div style={{
                padding: "8px 16px",
                borderBottom: "1px solid #E5E7EB"
              }}>
                <p style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#111827",
                  margin: "0 0 2px 0"
                }}>{adminInfo?.name || 'Admin'}</p>
                <p style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  margin: 0
                }}>{adminInfo?.email || 'admin@insightbooks.com'}</p>
              </div>
              <div style={{ padding: "4px 0" }}>
                <button style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  fontSize: "14px",
                  color: "#374151",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}>
                  {tt('Profile Settings')}
                </button>
                <button style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  fontSize: "14px",
                  color: "#374151",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}>
                  {tt('System Preferences')}
                </button>
                <button style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  fontSize: "14px",
                  color: "#374151",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}>
                  {tt('Help & Support')}
                </button>
              </div>
              <div style={{
                borderTop: "1px solid #E5E7EB",
                padding: "4px 0"
              }}>
                <button
                  onClick={onLogout}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    fontSize: "14px",
                    color: "#EF4444",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <LogOut style={{ height: "16px", width: "16px", marginRight: "8px" }} />
                  {tt('Sign Out')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminAppBar; 