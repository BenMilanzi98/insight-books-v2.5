"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar/Sidebar";
import AppBar from "@/components/AppBar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import AIAssistant from "@/components/AIAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Define paths where sidebar, footer, and appbar should be hidden
  const hiddenPaths = ["/", "/auth/login", "/auth/signup", "/auth/business-setup", "/contact", "/terms", "/privacy"];
  const shouldHideLayout = hiddenPaths.includes(pathname) || pathname.startsWith('/auth/') || pathname.startsWith('/insightbooks/') || pathname.startsWith('/ref/') || pathname.startsWith('/affiliate/');

  // Handle responsive behavior
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setSidebarOpen(window.innerWidth >= 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Register service worker for offline POS support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Collapse sidebar on mobile when changing pages
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  // Toggle sidebar function
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
          {/* Sidebar (Fixed for Desktop) */}
          {!shouldHideLayout && (
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
                backgroundColor: "#fff",
                boxShadow: sidebarOpen ? "2px 0 5px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <Sidebar collapsed={!sidebarOpen} toggleSidebar={toggleSidebar} />
            </div>
          )}

          {/* Main Content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
              width: "100%",
              transition: "margin-left 0.3s ease",
              overflow: "auto",
              marginLeft: !isMobile && sidebarOpen && !shouldHideLayout ? "280px" : "0",
            }}
          >
            {!shouldHideLayout && <AppBar toggleSidebar={toggleSidebar} isMobile={isMobile} sidebarOpen={sidebarOpen} />}
            <main
              className={!shouldHideLayout && !sidebarOpen ? "main-content-full-width" : ""}
              style={{
                padding: shouldHideLayout ? "0" : "24px 32px 24px 32px",
                flex: 1,
                maxWidth: "100%",
              }}
            >
              {children}
            </main>
            {!shouldHideLayout && <Footer />}
          </div>
        </div>

        {/* Overlay for mobile when sidebar is open */}
        {isMobile && sidebarOpen && !shouldHideLayout && (
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

        {/* Floating WhatsApp Support Button */}
        <FloatingWhatsApp />
        
        {/* AI Assistant */}
        {!shouldHideLayout && <AIAssistant />}
      </body>
    </html>
  );
}
