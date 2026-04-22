"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, User, Search, X } from "lucide-react";
import { isPosDefaultLandingRole } from "@/lib/tenantRoleAccess";

const AppBar = ({ toggleSidebar, sidebarOpen, isMobile, skipUserFetch = false, adminUser = null }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const pathname = usePathname();
  
  // Add state for user data and loading state (only used when !skipUserFetch)
  const [user, setUser] = useState(skipUserFetch && adminUser ? { name: adminUser.name, email: adminUser.email } : null);
  const [isUserLoading, setIsUserLoading] = useState(!skipUserFetch);
  
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  
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
  
  // Add useEffect to fetch user data (skip when in admin context to avoid calling tenant /api/auth/me)
  useEffect(() => {
    if (skipUserFetch) {
      if (adminUser) {
        setUser({ name: adminUser.name, email: adminUser.email });
      } else {
        setUser({ name: "Admin", email: "" });
      }
      setIsUserLoading(false);
      return;
    }
    const fetchUserData = async () => {
      setIsUserLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          console.error('Failed to fetch user data');
          setUser({ name: "User", email: "user@example.com" });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser({ name: "User", email: "user@example.com" });
      } finally {
        setIsUserLoading(false);
      }
    };
    fetchUserData();
  }, [skipUserFetch, adminUser]);
  
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
  
  // Mock notifications
  const notifications = [];

  const appHomeHref =
    !skipUserFetch && user?.role && isPosDefaultLandingRole(user) ? "/pos" : "/dashboard";
  const atAppHome = pathname === appHomeHref;
  
  // Get current page title from pathname
  const getPageTitle = () => {
    const path = pathname.split("/")[1];
    if (path === "" || !path) return "Dashboard";
    return path.charAt(0).toUpperCase() + path.slice(1);
  };
  
  const handleToggleNotifications = () => {
    setNotificationsOpen(!notificationsOpen);
    if (profileOpen) setProfileOpen(false);
  };
  
  const handleToggleProfile = () => {
    setProfileOpen(!profileOpen);
    if (notificationsOpen) setNotificationsOpen(false);
  };

  // Toggle mobile search
  const toggleSearch = () => {
    setShowSearch(!showSearch);
  };

  return (
    <header className="app-bar" style={{
      position: "sticky", 
      top: 0, 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      height: "72px", 
      padding: "0 24px", 
      backgroundColor: "#ffffff", 
      borderBottom: "1px solid #e5e7eb",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", 
      zIndex: 50,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)"
    }}>
      <div className="app-bar-left" style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "20px",
        flex: 1,
        minWidth: 0
      }}>
        {isMobile && (
          <button
            onClick={toggleSidebar}
            aria-label="Toggle menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "8px",
              color: "#4b5563",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f3f4f6";
              e.currentTarget.style.color = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#4b5563";
            }}
          >
            <Menu size={22} />
          </button>
        )}

        {!isMobile && (
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? "Close Sidebar (Ctrl+B)" : "Open Sidebar (Ctrl+B)"}
            style={{
              backgroundColor: sidebarOpen ? "#f3f4f6" : "#3b82f6",
              color: sidebarOpen ? "#4b5563" : "white",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: "500",
              boxShadow: sidebarOpen ? "none" : "0 1px 2px 0 rgba(59, 130, 246, 0.3)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              if (sidebarOpen) {
                e.currentTarget.style.backgroundColor = "#e5e7eb";
              } else {
                e.currentTarget.style.backgroundColor = "#2563eb";
                e.currentTarget.style.boxShadow = "0 2px 4px 0 rgba(59, 130, 246, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (sidebarOpen) {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
              } else {
                e.currentTarget.style.backgroundColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(59, 130, 246, 0.3)";
              }
            }}
          >
            <Menu size={16} />
            <span>{sidebarOpen ? "Close" : "Open"}</span>
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <h1 className="page-title" style={{
            fontSize: isMobile ? "18px" : "22px",
            fontWeight: 700,
            margin: 0,
            color: "#111827",
            letterSpacing: "-0.01em",
            lineHeight: "1.2"
          }}>
            {getPageTitle()}
          </h1>
          {!isMobile && (
            <nav className="breadcrumbs" style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "6px", 
              fontSize: "13px", 
              color: "#6b7280",
              fontWeight: 400
            }}>
              <Link
                href={appHomeHref}
                style={{
                  color: "#3b82f6",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#2563eb")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#3b82f6")}
              >
                Home
              </Link>
              {pathname !== "/" && !atAppHome && (
                <>
                  <span style={{ color: "#d1d5db" }}>/</span>
                  <span style={{ color: "#6b7280" }}>{getPageTitle()}</span>
                </>
              )}
            </nav>
          )}
        </div>
      </div>
      
      <div className="app-bar-right" style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px" 
      }}>
        {/* Mobile Search Icon */}
        {isMobile && !showSearch && (
          <button
            onClick={toggleSearch}
            aria-label="Show search"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "8px",
              color: "#6b7280",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f3f4f6";
              e.currentTarget.style.color = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            <Search size={20} />
          </button>
        )}

        {/* Mobile search - Full width */}
        {isMobile && showSearch && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "72px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: "12px",
            zIndex: 51,
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
          }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input 
                type="text" 
                placeholder="Search..." 
                style={{
                  width: "100%",
                  padding: "10px 16px 10px 40px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  fontSize: "14px",
                  outline: "none",
                  backgroundColor: "#f9fafb",
                  transition: "all 0.2s ease"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.backgroundColor = "#ffffff";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.backgroundColor = "#f9fafb";
                  e.target.style.boxShadow = "none";
                }}
                autoFocus
              />
              <Search style={{ 
                position: "absolute", 
                left: "14px", 
                top: "50%", 
                transform: "translateY(-50%)", 
                color: "#9ca3af",
                width: "18px",
                height: "18px",
                pointerEvents: "none" 
              }} />
            </div>
            <button
              onClick={toggleSearch}
              aria-label="Close search"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                borderRadius: "8px",
                color: "#6b7280",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
                e.currentTarget.style.color = "#111827";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
        
        {/* Desktop Search */}
        {!isMobile && (
          <div className={`search-container ${searchFocused ? "focused" : ""}`} style={{ 
            position: "relative", 
            width: searchFocused ? "360px" : "280px", 
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
          }}>
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="search-input"
              style={{
                width: "100%",
                padding: "10px 16px 10px 42px",
                border: `1px solid ${searchFocused ? "#3b82f6" : "#e5e7eb"}`,
                borderRadius: "12px",
                fontSize: "14px",
                outline: "none",
                backgroundColor: searchFocused ? "#ffffff" : "#f9fafb",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: searchFocused 
                  ? "0 0 0 3px rgba(59, 130, 246, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.05)" 
                  : "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <Search style={{ 
              position: "absolute", 
              left: "14px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              color: searchFocused ? "#3b82f6" : "#9ca3af",
              width: "18px",
              height: "18px",
              pointerEvents: "none",
              transition: "color 0.2s ease"
            }} />
          </div>
        )}
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Notifications Button and Dropdown */}
          <div ref={notificationRef} style={{ position: "relative" }}>
            <button 
              onClick={handleToggleNotifications}
              aria-label="Notifications"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px",
                borderRadius: "10px",
                color: "#6b7280",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f6";
                e.currentTarget.style.color = "#111827";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              <Bell size={20} strokeWidth={2} />
              {/* Only show badge if there are unread notifications */}
              {0 > 0 && (
                <span style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "600",
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                  border: "2px solid #ffffff",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.1)"
                }}>0</span>
              )}
            </button>
            
            {notificationsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                right: 0,
                width: isMobile ? "calc(100vw - 32px)" : "380px",
                maxWidth: "calc(100vw - 32px)",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 200,
                animation: "slideDown 0.2s ease-out"
              }}>
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#fafafa"
                }}>
                  <h3 style={{ margin: "0", fontSize: "16px", fontWeight: "600", color: "#111827" }}>Notifications</h3>
                  <button 
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3b82f6",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#eff6ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Mark all as read
                  </button>
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px 24px",
                      color: "#9ca3af",
                      fontSize: "14px",
                      textAlign: "center"
                    }}>
                      <div style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        backgroundColor: "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "16px"
                      }}>
                        <Bell size={28} color="#9ca3af" strokeWidth={1.5} />
                      </div>
                      <span style={{ fontWeight: "500", color: "#6b7280", marginBottom: "4px" }}>No notifications</span>
                      <span style={{ fontSize: "13px" }}>You're all caught up!</span>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        style={{
                          padding: "14px 20px",
                          display: "flex",
                          gap: "14px",
                          borderBottom: "1px solid #f3f4f6",
                          backgroundColor: notification.read ? "transparent" : "#eff6ff",
                          transition: "background-color 0.15s ease",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = notification.read ? "#f9fafb" : "#dbeafe";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = notification.read ? "transparent" : "#eff6ff";
                        }}
                      >
                        <div style={{ 
                          fontSize: "20px",
                          flexShrink: 0,
                          marginTop: "2px"
                        }}>
                          {notification.type === "invoice" && "📝"}
                          {notification.type === "system" && "⚙️"}
                          {notification.type === "user" && "👤"}
                          {notification.type === "payment" && "💰"}
                        </div>
                        <div style={{ flex: "1", minWidth: 0 }}>
                          <div style={{ 
                            fontSize: "14px", 
                            fontWeight: notification.read ? "400" : "500",
                            marginBottom: "4px",
                            color: "#111827",
                            lineHeight: "1.4"
                          }}>
                            {notification.text}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>{notification.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div style={{
                    padding: "12px 20px",
                    borderTop: "1px solid #f3f4f6",
                    textAlign: "center",
                    backgroundColor: "#fafafa"
                  }}>
                    <Link 
                      href="/notifications" 
                      style={{
                        color: "#3b82f6",
                        fontSize: "13px",
                        fontWeight: "500",
                        textDecoration: "none",
                        transition: "color 0.2s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#2563eb"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "#3b82f6"}
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Profile Button and Dropdown */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button 
              onClick={handleToggleProfile}
              aria-label="Profile"
              style={{
                background: "none",
                border: "2px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px",
                borderRadius: "50%",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
                fontSize: "14px",
                boxShadow: "0 2px 4px 0 rgba(59, 130, 246, 0.2)",
                border: "2px solid #ffffff"
              }}>
                {/* {isUserLoading ? (
                  <div style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255, 255, 255, 0.5)",
                    borderTop: "2px solid white",
                    animation: "spin 1s linear infinite"
                  }}></div>
                ) : (
                  getInitials(user?.name)
                )} */}
                {isUserLoading ? (
                  // Show loading spinner
                  <div style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255, 255, 255, 0.5)",
                    borderTop: "2px solid white",
                    animation: "spin 1s linear infinite"
                  }}></div>
                ) : user?.tenant?.logoUrl ? (
                  // Show logo if available; on error or 1x1 placeholder (missing file) show initials
                  <img
                    src={typeof window !== 'undefined' && user.tenant.logoUrl?.startsWith('/uploads/')
                      ? `/api/uploads/${user.tenant.logoUrl.replace(/^\/+uploads\//, '')}`
                      : user.tenant.logoUrl}
                    alt="Logo"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%233b82f6" rx="20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="system-ui">' + (user?.name ? getInitials(user.name) : '?') + '</text></svg>');
                    }}
                    onLoad={(e) => {
                      const img = e.target;
                      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
                        img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%233b82f6" rx="20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="system-ui">' + (user?.name ? getInitials(user.name) : '?') + '</text></svg>');
                      }
                    }}
                    style={{
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  // Fallback to initials
                  getInitials(user?.name)
                )}
              </div>
            </button>
            
            {profileOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                right: 0,
                width: isMobile ? "calc(100vw - 32px)" : "320px",
                maxWidth: "calc(100vw - 32px)",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                zIndex: 200,
                animation: "slideDown 0.2s ease-out"
              }}>
                <div style={{
                  padding: "20px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  backgroundColor: "#fafafa"
                }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "18px",
                    boxShadow: "0 2px 4px 0 rgba(59, 130, 246, 0.2)",
                    border: "2px solid #ffffff",
                    flexShrink: 0
                  }}>
                    {/* {isUserLoading ? (
                      <div style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: "2px solid rgba(255, 255, 255, 0.5)",
                        borderTop: "2px solid white",
                        animation: "spin 1s linear infinite"
                      }}></div>
                    ) : (
                      getInitials(user?.name)
                    )} */}
                    {isUserLoading ? (
                     // Show loading spinner
                        <div style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: "2px solid rgba(255, 255, 255, 0.5)",
                          borderTop: "2px solid white",
                          animation: "spin 1s linear infinite"
                        }}></div>
                      ) : user?.tenant?.logoUrl ? (
                        // Show logo if available; on error or 1x1 placeholder (missing file) show initials
                        <img
                          src={typeof window !== 'undefined' && user.tenant.logoUrl?.startsWith('/uploads/')
                            ? `/api/uploads/${user.tenant.logoUrl.replace(/^\/+uploads\//, '')}`
                            : user.tenant.logoUrl}
                          alt="Logo"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%233b82f6" rx="20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="system-ui">' + (user?.name ? getInitials(user.name) : '?') + '</text></svg>');
                          }}
                          onLoad={(e) => {
                            const img = e.target;
                            if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
                              img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%233b82f6" rx="20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="system-ui">' + (user?.name ? getInitials(user.name) : '?') + '</text></svg>');
                            }
                          }}
                          style={{
                            borderRadius: "50%",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        // Fallback to initials
                        getInitials(user?.name)
                      )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isUserLoading ? (
                      /* Show loading skeleton for name */
                      <>
                        <div style={{ 
                          width: "150px", 
                          height: "18px", 
                          backgroundColor: "#e5e7eb",
                          borderRadius: "6px",
                          marginBottom: "8px",
                          animation: "pulse 1.5s infinite ease-in-out"
                        }}></div>
                        <div style={{ 
                          width: "120px", 
                          height: "14px", 
                          backgroundColor: "#e5e7eb",
                          borderRadius: "6px",
                          animation: "pulse 1.5s infinite ease-in-out"
                        }}></div>
                      </>
                    ) : (
                      <>
                        <h3 style={{ 
                          margin: "0 0 6px 0", 
                          fontSize: "16px", 
                          fontWeight: "600",
                          color: "#111827",
                          lineHeight: "1.2"
                        }}>
                          {user?.name || "User"}
                        </h3>
                        <div style={{ 
                          fontSize: "13px", 
                          color: "#6b7280",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {user?.email || "user@example.com"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ padding: "8px" }}>
                  <Link 
                    href="/profile" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#374151",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.color = "#111827";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>👤</span>
                    <span>My Profile</span>
                  </Link>
                  <Link 
                    href="/account" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#374151",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.color = "#111827";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>⚙️</span>
                    <span>Settings</span>
                  </Link>
                  <Link 
                    href="/switch-tenant" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#374151",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.color = "#111827";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>🏢</span>
                    <span>Switch Or Add Business</span>
                  </Link>
                  
                  <div style={{ height: "1px", backgroundColor: "#e5e7eb", margin: "8px 0" }}></div>

                  <Link
                    href="/terms"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#374151",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.color = "#111827";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>📄</span>
                    <span>Terms of Service</span>
                  </Link>
                  <Link
                    href="/privacy"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#374151",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.color = "#111827";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>🔒</span>
                    <span>Privacy Policy</span>
                  </Link>

                  <div style={{ height: "1px", backgroundColor: "#e5e7eb", margin: "8px 0" }}></div>

                  <button
                    onClick={async() => {
                        await fetch("/api/auth/logout", {
                          method: "POST",
                        });
                        window.location.href = "/auth/login";
                      }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      color: "#dc2626",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      width: "100%",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.15s ease",
                      textAlign: "left"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fef2f2";
                      e.currentTarget.style.color = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#dc2626";
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Animation styles */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideDown {
          0% {
            opacity: 0;
            transform: translateY(-8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </header>
  );
};

export default AppBar;