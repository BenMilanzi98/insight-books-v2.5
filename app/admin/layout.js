"use client";
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from "@/components/AdminSidebar/AdminSidebar";
import AppBar from "@/components/AppBar";
import Footer from "@/components/Footer";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if current page is the login page
  const isLoginPage = pathname === '/admin/login';

  // Handle responsive behavior (same as main system)
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setSidebarOpen(window.innerWidth >= 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Collapse sidebar on mobile when changing pages (same as main system)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  useEffect(() => {
    // Skip auth check for login page
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [isLoginPage]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth/me');
      if (response.ok) {
        const data = await response.json();
        setAdmin(data.admin);
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle sidebar function (same as main system)
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // For login page, render children without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sidebar (Fixed for Desktop) - EXACTLY like main system */}
      <div
        style={{
          position: isMobile ? "fixed" : "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          width: sidebarOpen ? "280px" : "0",
          transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.3s ease, width 0.3s ease",
          zIndex: 1000,
          overflow: "hidden",
          backgroundColor: "#1a202c",
          boxShadow: sidebarOpen ? "2px 0 5px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <AdminSidebar collapsed={!sidebarOpen} setCollapsed={() => setSidebarOpen(false)} admin={admin} />
      </div>

      {/* Main Content - EXACTLY like main system */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%",
          transition: "margin-left 0.3s ease",
          overflow: "auto",
          marginLeft: !isMobile && sidebarOpen ? "280px" : "0",
        }}
      >
        <AppBar toggleSidebar={toggleSidebar} isMobile={isMobile} sidebarOpen={sidebarOpen} />
        <main
          style={{
            padding: "24px",
            flex: 1,
          }}
        >
          <div className=" mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>

      {/* Overlay for mobile when sidebar is open - EXACTLY like main system */}
      {isMobile && sidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 900,
            cursor: "pointer",
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
} 