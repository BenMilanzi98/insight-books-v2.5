"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar/Sidebar";
import AppBar from "@/components/AppBar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import AIAssistant from "@/components/AIAssistant";
import OnboardingGate from "@/components/OnboardingGate";

export default function RootLayoutClient({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const hiddenPaths = ["/", "/auth/login", "/auth/signup", "/auth/business-setup", "/contact", "/terms", "/privacy"];
  const shouldHideLayout =
    hiddenPaths.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/insightbooks/") ||
    pathname.startsWith("/ref/") ||
    pathname.startsWith("/affiliate/");

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setSidebarOpen(window.innerWidth >= 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

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
        {!shouldHideLayout && (
          <AppBar toggleSidebar={toggleSidebar} isMobile={isMobile} sidebarOpen={sidebarOpen} />
        )}
        <main
          className={!shouldHideLayout && !sidebarOpen ? "main-content-full-width" : ""}
          style={{
            padding: shouldHideLayout ? "0" : "24px 32px 24px 32px",
            flex: 1,
            maxWidth: "100%",
          }}
        >
          {shouldHideLayout ? children : <OnboardingGate>{children}</OnboardingGate>}
        </main>
        {!shouldHideLayout && <Footer />}
      </div>

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

      <FloatingWhatsApp />
      {!shouldHideLayout && <AIAssistant />}
    </div>
  );
}
