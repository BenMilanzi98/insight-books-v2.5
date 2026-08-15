"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, User, Search, X } from "lucide-react";
import { isPosDefaultLandingRole } from "@/lib/tenantRoleAccess";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import { translateNavLabel } from "@/lib/i18n/navLabelMap";

const AppBar = ({
  toggleSidebar,
  sidebarOpen,
  isMobile,
  skipUserFetch = false,
  adminUser = null,
  menuButtonRef = null,
  navId = undefined,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  
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

  // Stable on SSR + first client paint (avoids logo href hydration churn once user loads).
  const [homeHref, setHomeHref] = useState("/dashboard");
  useEffect(() => {
    if (skipUserFetch) {
      setHomeHref("/dashboard");
      return;
    }
    if (!user?.role) return;
    setHomeHref(isPosDefaultLandingRole(user) ? "/pos" : "/dashboard");
  }, [skipUserFetch, user]);

  const atAppHome = pathname === homeHref;
  
  // Get current page title from pathname (friendly labels; keep /reports-v2 URL)
  const getPageTitle = () => {
    const path = pathname.split("/")[1];
    if (path === "" || !path) return "Dashboard";
    const titleMap = {
      "reports-v2": "Reports",
      "general-ledger-v2": "General Ledger",
      "chart-of-accounts": "Chart of Accounts",
      pos: "Point of Sale",
    };
    if (titleMap[path]) return titleMap[path];
    return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
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
    <header className="app-bar sticky top-0 z-[var(--z-sticky,100)] grid h-[72px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[var(--border-default,#e5e7eb)] bg-[var(--surface-primary,#ffffff)] px-3 shadow-[var(--shadow-card)] sm:gap-3 sm:px-4">
      <div className="app-bar-left flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={Boolean(sidebarOpen)}
          aria-controls={navId}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary,#4b5563)] transition-colors hover:bg-gray-100 hover:text-gray-900 md:hidden"
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarOpen ? "Close Sidebar (Ctrl+B)" : "Open Sidebar (Ctrl+B)"}
          className={`hidden items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all md:inline-flex ${
            sidebarOpen
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-blue-500 text-white shadow-sm hover:bg-blue-600"
          }`}
        >
          <Menu size={16} />
          <span>{sidebarOpen ? "Close" : "Open"}</span>
        </button>

        <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
          <h1 className="page-title m-0 truncate text-base font-bold leading-tight tracking-tight text-gray-900 md:text-[22px]">
            {getPageTitle()}
          </h1>
          <nav className="breadcrumbs hidden items-center gap-1.5 text-[13px] font-normal text-gray-500 md:flex">
            <Link
              href={homeHref}
              className="text-blue-500 no-underline transition-colors hover:text-blue-600"
            >
              {translateNavLabel('Home', t)}
            </Link>
            {pathname !== "/" && !atAppHome && (
              <>
                <span className="text-gray-300">/</span>
                <span className="truncate text-gray-500">{getPageTitle()}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      <Link
        href={homeHref}
        aria-label={tt('InsightBooks home')}
        className="col-start-2 inline-flex max-w-[7.5rem] shrink-0 items-center justify-center rounded-[10px] leading-none sm:max-w-[9rem]"
      >
        <img
          src="/logo.png"
          alt={tt('InsightBooks')}
          className="h-8 w-auto max-w-full rounded-lg object-contain sm:h-9 md:h-10"
        />
      </Link>
      
      <div className="app-bar-right relative z-20 flex min-w-0 items-center justify-end gap-2 bg-[var(--surface-primary,#ffffff)] pl-1 sm:gap-3 sm:pl-2">
        <LanguageSwitcher compact />
        {/* Mobile Search Icon */}
        {isMobile && !showSearch && (
          <button
            onClick={toggleSearch}
            aria-label={tt('Show search')}
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
                placeholder={t('common.actions.search')} 
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
              aria-label={tt('Close search')}
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
              placeholder={t('common.actions.search')} 
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
              aria-label={tt('Notifications')}
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
                  <h3 style={{ margin: "0", fontSize: "16px", fontWeight: "600", color: "#111827" }}>{tt('Notifications')}</h3>
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
                    {tt('Mark all as read')}
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
                      <span style={{ fontWeight: "500", color: "#6b7280", marginBottom: "4px" }}>{tt('No notifications')}</span>
                      <span style={{ fontSize: "13px" }}>{tt("You're all caught up!")}</span>
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
                      {tt('View all notifications')}
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
              aria-label={tt('Profile')}
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
                    alt={tt('Logo')}
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
                          alt={tt('Logo')}
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
                    <span>{tt('My Profile')}</span>
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
                    <span>{tt('Settings')}</span>
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
                    <span>{tt('Switch Or Add Business')}</span>
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
                    <span>{tt('Terms of Service')}</span>
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
                    <span>{tt('Privacy Policy')}</span>
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
                    <span>{tt('Logout')}</span>
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