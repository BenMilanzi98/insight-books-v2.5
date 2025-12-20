"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, User, Search, X } from "lucide-react";

const AppBar = ({ toggleSidebar, sidebarOpen, isMobile }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const pathname = usePathname();
  
  // Add state for user data and loading state
  const [user, setUser] = useState(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  
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
  
  // Add useEffect to fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      setIsUserLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          console.error('Failed to fetch user data');
          // Set default user on error
          setUser({ name: "User", email: "user@example.com" });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Set default user on error
        setUser({ name: "User", email: "user@example.com" });
      } finally {
        setIsUserLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
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
      height: "64px", 
      padding: "0 16px", 
      backgroundColor: "white", 
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)", 
      zIndex: 50
    }}>
      <div className="app-bar-left" style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "16px" 
      }}>
        {isMobile && (
          <button 
            onClick={toggleSidebar} 
            aria-label="Toggle menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex"
            }}
          >
            <Menu size={24} />
          </button>
        )}
        
        <h1 className="page-title" style={{ 
          fontSize: isMobile ? "16px" : "20px", 
          fontWeight: 600, 
          margin: 0, 
          color: "#333"
        }}>
          {getPageTitle()}
        </h1>

        {!isMobile && (
          <nav className="breadcrumbs" style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px", 
            fontSize: "14px", 
            color: "#666" 
          }}>
            <Link href="/dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>Home</Link> 
            {pathname !== "/" && pathname !== "/dashboard" && (
              <>
                <span>/</span>
                <span>{getPageTitle()}</span>
              </>
            )}
          </nav>
        )}
      </div>
      
      <div className="app-bar-right" style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px" 
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
              display: "flex"
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
            height: "64px",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            zIndex: 51
          }}>
            <input 
              type="text" 
              placeholder="Search..." 
              style={{
                flex: 1,
                padding: "8px",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                fontSize: "14px",
                outline: "none"
              }}
              autoFocus
            />
            <button
              onClick={toggleSearch}
              aria-label="Close search"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                marginLeft: "8px"
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
            width: searchFocused ? "320px" : "240px", 
            transition: "width 0.2s ease" 
          }}>
            <input 
              type="text" 
              placeholder="Search..." 
              className="search-input"
              style={{
                width: "100%",
                padding: "8px 16px 8px 36px",
                border: `1px solid ${searchFocused ? "#2563eb" : "#e0e0e0"}`,
                borderRadius: "20px",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow: searchFocused ? "0 0 0 2px rgba(37, 99, 235, 0.1)" : "none"
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <Search style={{ 
              position: "absolute", 
              left: "12px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              color: "#888",
              width: "16px",
              height: "16px",
              pointerEvents: "none" 
            }} />
          </div>
        )}
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                padding: "8px",
                borderRadius: "50%",
                transition: "background-color 0.2s"
              }}
            >
              <Bell size={20} />
              {/* Only show badge if there are unread notifications */}
              {0 > 0 && (
                <span style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "600",
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px"
                }}>0</span>
              )}
            </button>
            
            {notificationsOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: isMobile ? "calc(100vw - 32px)" : "320px",
                maxWidth: "calc(100vw - 32px)",
                backgroundColor: "white",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                overflow: "hidden",
                zIndex: 200
              }}>
                <div style={{
                  padding: "16px",
                  borderBottom: "1px solid #e0e0e0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <h3 style={{ margin: "0", fontSize: "16px", fontWeight: "600" }}>Notifications</h3>
                  <button style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}>Mark all as read</button>
                </div>
                <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "120px",
                      color: "#888",
                      fontSize: "15px",
                      textAlign: "center"
                    }}>
                      <span style={{ fontSize: "32px", marginBottom: "8px" }}>🔔</span>
                      <span>You do not have any notifications at this time.</span>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div 
                        key={notification.id} 
                        style={{
                          padding: "12px 16px",
                          display: "flex",
                          gap: "12px",
                          borderBottom: "1px solid #f0f0f0",
                          backgroundColor: notification.read ? "transparent" : "#f0f7ff",
                          transition: "background-color 0.2s"
                        }}
                      >
                        <div style={{ fontSize: "18px" }}>
                          {notification.type === "invoice" && "📝"}
                          {notification.type === "system" && "⚙️"}
                          {notification.type === "user" && "👤"}
                          {notification.type === "payment" && "💰"}
                        </div>
                        <div style={{ flex: "1" }}>
                          <div style={{ fontSize: "14px", marginBottom: "4px" }}>{notification.text}</div>
                          <div style={{ fontSize: "12px", color: "#666" }}>{notification.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{
                  padding: "12px 16px",
                  borderTop: "1px solid #e0e0e0",
                  textAlign: "center"
                }}>
                  <Link href="/notifications" style={{
                    color: "#2563eb",
                    fontSize: "14px",
                    textDecoration: "none"
                  }}>View all notifications</Link>
                </div>
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
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                borderRadius: "50%",
                transition: "background-color 0.2s"
              }}
            >
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#2563eb",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
                fontSize: "14px"
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
                  // Show logo if available
                  <img 
                    src={typeof window !== 'undefined' && user.tenant.logoUrl?.startsWith('/uploads/')
                      ? `/api/uploads/${user.tenant.logoUrl.replace(/^\/+uploads\//, '')}`
                      : user.tenant.logoUrl}
                    alt="Logo"
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
                top: "calc(100% + 8px)",
                right: 0,
                width: isMobile ? "calc(100vw - 32px)" : "320px",
                maxWidth: "calc(100vw - 32px)",
                backgroundColor: "white",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                overflow: "hidden",
                zIndex: 200
              }}>
                <div style={{
                  padding: "16px",
                  borderBottom: "1px solid #e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#2563eb",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "16px"
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
                        // Show logo if available
                        <img 
                          src={typeof window !== 'undefined' && user.tenant.logoUrl?.startsWith('/uploads/')
                            ? `/api/uploads/${user.tenant.logoUrl.replace(/^\/+uploads\//, '')}`
                            : user.tenant.logoUrl}
                          alt="Logo"
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
                  <div>
                    {isUserLoading ? (
                      /* Show loading skeleton for name */
                      <>
                        <div style={{ 
                          width: "150px", 
                          height: "16px", 
                          backgroundColor: "#e5e7eb",
                          borderRadius: "4px",
                          marginBottom: "8px",
                          animation: "pulse 1.5s infinite ease-in-out"
                        }}></div>
                        <div style={{ 
                          width: "120px", 
                          height: "12px", 
                          backgroundColor: "#e5e7eb",
                          borderRadius: "4px",
                          animation: "pulse 1.5s infinite ease-in-out"
                        }}></div>
                      </>
                    ) : (
                      <>
                        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>{user?.name}</h3>
                        <div style={{ fontSize: "12px", color: "#666" }}>{user?.email}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ padding: "8px 0" }}>
                  <Link 
                    href="/profile" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      color: "#333",
                      textDecoration: "none",
                      transition: "background-color 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "16px", opacity: "0.8" }}>👤</span>
                    <span>My Profile</span>
                  </Link>
                  <Link 
                    href="/account" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      color: "#333",
                      textDecoration: "none",
                      transition: "background-color 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "16px", opacity: "0.8" }}>⚙️</span>
                    <span>Settings</span>
                  </Link>
                  <Link 
                    href="/switch-tenant" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      color: "#333",
                      textDecoration: "none",
                      transition: "background-color 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "16px", opacity: "0.8" }}>🏢</span>
                    <span>Switch Or Add Business</span>
                  </Link>
                  
                  <div style={{ height: "1px", backgroundColor: "#e0e0e0", margin: "8px 0" }}></div>
                  
                  <Link 
                    href="/help" 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      color: "#333",
                      textDecoration: "none",
                      transition: "background-color 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "16px", opacity: "0.8" }}>❓</span>
                    <span>Help Center</span>
                  </Link>
                  <button
                    onClick={async() => {
                        await fetch("/api/auth/logout", {
                          method: "POST",
                        });
                        window.location.href = "/auth/login"; // or "/" if you want
                      }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 16px",
                      color: "#333",
                      background: "none",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    <span style={{ fontSize: "16px", opacity: "0.8" }}>🚪</span>
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
      `}</style>
    </header>
  );
};

export default AppBar;