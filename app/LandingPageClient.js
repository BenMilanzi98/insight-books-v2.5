'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Check, ArrowRight, Play, FileText, BarChart3, Receipt, Users, ChevronLeft, ChevronRight, LayoutDashboard, UserCheck, Building2, User, CreditCard, FileText as FileTextIcon, DollarSign, Wallet, Clock, Banknote, TrendingUp, Package, Truck, Calculator, BookOpen, Briefcase, UserPlus, Brain, Sparkles, MapPin, Mail, Phone } from 'lucide-react';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

const WHATSAPP_DEMO_URL = `https://wa.me/265894092494?text=${encodeURIComponent("I'm interested in InsightBooks, Can you please tell me more")}`;

export default function LandingPageClient() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <NavigationBar />
      <HeroSection />
      <FeaturesSection />
      {/* <VideoShowcaseSection /> */}
      <PricingSection />
      <CtaSection />
      <TestimonialsSection />
      <Footer />
    </main>
  );
}

// Navigation Bar
function NavigationBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const scrolled = scrollY > 20;
  const showRegisterAndDemo = scrollY > 72;

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsLoggedIn(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled ? "bg-white py-3 shadow-sm" : "bg-transparent py-5"
    }`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center gap-4">
          {/* <div className="flex items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center mr-3">
                <span className="text-white font-medium text-sm">IB</span>
              </div>
              <span className={`font-semibold text-lg ${scrolled ? "text-slate-800" : "text-white"}`}>
                InsightBooks
              </span>
            </div>
          </div> */}
          <Link href="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="InsightBooks — cloud accounting and business software"
              className="h-10 w-auto object-contain rounded-md"
            />
          </Link>
          
          <div className="hidden md:flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
            {!isCheckingAuth && (
              <>
                {isLoggedIn ? (
                  <Link href="/dashboard" className={`border ${scrolled ? "border-slate-700 text-slate-700 hover:bg-slate-50" : "border-white text-white hover:bg-white hover:text-indigo-900"} text-sm px-4 py-2 rounded-md transition-colors`}>
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/auth/login" className={`border ${scrolled ? "border-slate-700 text-slate-700 hover:bg-slate-50" : "border-white text-white hover:bg-white hover:text-indigo-900"} text-sm px-4 py-2 rounded-md transition-colors`}>
                      Log In
                    </Link>
                    {showRegisterAndDemo && (
                      <Link
                        href="/auth/signup"
                        className={`border ${scrolled ? 'border-slate-700 text-slate-700 hover:bg-slate-50' : 'border-white text-white hover:bg-white hover:text-indigo-900'} text-sm px-4 py-2 rounded-md transition-all duration-300`}
                      >
                        Register
                      </Link>
                    )}
                  </>
                )}
                {showRegisterAndDemo && (
                  <a
                    href={WHATSAPP_DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Book a Demo
                  </a>
                )}
              </>
            )}
          </div>
          
          <button 
            className={`md:hidden ${scrolled ? "text-slate-800" : "text-white"}`} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="p-4 flex justify-end">
            <button onClick={() => setMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="px-8 py-6 space-y-6">
            {!isCheckingAuth && (
              <>
                {isLoggedIn ? (
                  <Link href="/dashboard" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/auth/login" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
                      Log In
                    </Link>
                    {showRegisterAndDemo && (
                      <Link href="/auth/signup" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
                        Register
                      </Link>
                    )}
                  </>
                )}
                {showRegisterAndDemo && (
                  <a
                    href={WHATSAPP_DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-blue-600 text-white py-3 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Book a Demo
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// Hero Section
function HeroSection() {
  const [dashboardData, setDashboardData] = useState({
    revenue: 14850,
    revenueGrowth: 12.5,
    expenses: 5240,
    expensesChange: 3.8,
    graphPoints: [
      { x: 40, y: 250 },
      { x: 80, y: 230 },
      { x: 120, y: 240 },
      { x: 160, y: 210 },
      { x: 200, y: 220 },
      { x: 240, y: 200 },
      { x: 280, y: 190 },
      { x: 320, y: 210 },
      { x: 360, y: 205 }
    ],
    animationCounter: 0
  });

  // Animate dashboard data
  useEffect(() => {
    const interval = setInterval(() => {
      setDashboardData(prev => {
        const counter = prev.animationCounter + 1;

        // Use counter-based calculations instead of Date.now() for SSR compatibility
        const revenueChange = (Math.sin(counter * 0.1) + Math.cos(counter * 0.07)) * 50;
        const newRevenue = Math.max(14000, Math.min(16000, prev.revenue + revenueChange));

        const growthChange = Math.sin(counter * 0.05) * 0.3;
        const newGrowth = Math.max(8, Math.min(18, prev.revenueGrowth + growthChange));

        const expenseChange = (Math.cos(counter * 0.12) + Math.sin(counter * 0.08)) * 25;
        const newExpenses = Math.max(4800, Math.min(5800, prev.expenses + expenseChange));

        const changeVariation = Math.sin(counter * 0.06) * 0.5;
        const newChange = Math.max(-2, Math.min(8, prev.expensesChange + changeVariation));

        // Update graph points with smooth wave variations
        const newGraphPoints = prev.graphPoints.map((point, index) => {
          const wave1 = Math.sin(counter * 0.1 + index * 0.5) * 8;
          const wave2 = Math.cos(counter * 0.08 + index * 0.3) * 6;
          const variation = (wave1 + wave2) * 0.5;
          return {
            ...point,
            y: Math.max(180, Math.min(260, point.y + variation))
          };
        });

        return {
          revenue: Math.round(newRevenue),
          revenueGrowth: Math.round(newGrowth * 10) / 10,
          expenses: Math.round(newExpenses),
          expensesChange: Math.round(newChange * 10) / 10,
          graphPoints: newGraphPoints,
          animationCounter: counter
        };
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const pts = dashboardData.graphPoints;
  const polylinePoints = pts.map((point) => `${point.x},${point.y}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const chartBaseY = 268;
  const areaPath =
    first && last
      ? `M ${first.x} ${first.y} ${pts
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')} L ${last.x} ${chartBaseY} L ${first.x} ${chartBaseY} Z`
      : '';

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-x-hidden overflow-y-visible pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))] sm:pb-16 md:pt-32 md:pb-24">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950 via-indigo-950 to-blue-950" aria-hidden />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% -28%, rgba(67, 56, 202, 0.5), transparent 52%), radial-gradient(ellipse 55% 45% at 100% 45%, rgba(29, 78, 216, 0.35), transparent), radial-gradient(ellipse 40% 40% at 0% 80%, rgba(30, 58, 138, 0.4), transparent)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(96, 165, 250, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(96, 165, 250, 0.07) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="hidden sm:block absolute top-20 left-1/4 w-[min(420px,55vw)] h-[min(420px,55vw)] max-w-[90vw] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" aria-hidden />
      <div className="hidden sm:block absolute bottom-10 right-0 w-[min(380px,50vw)] h-[min(380px,50vw)] max-w-[85vw] bg-blue-600/25 rounded-full blur-[90px] pointer-events-none" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full min-w-0">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 sm:gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left min-w-0">
            <div className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-sky-400/20 bg-blue-950/40 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-sky-100/90 backdrop-blur-sm mb-6 sm:mb-8 text-center leading-snug">
              <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden />
              <span className="min-w-0">Invoices, expenses & reports — in one place</span>
            </div>

            <h1 className="text-[clamp(1.65rem,5.5vw,2.25rem)] sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] sm:leading-[1.08] mb-5 sm:mb-6 text-balance px-0.5 sm:px-0">
              Business Management{' '}
              <span className="bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text text-transparent">
                Simplified
              </span>
            </h1>

            <p className="text-base sm:text-xl text-blue-100/90 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8 sm:mb-10 text-balance px-0.5 sm:px-0">
              One platform to manage your invoices, expenses, and financial reports. Built for growing
              businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10 sm:mb-12 max-w-md mx-auto lg:max-w-none lg:mx-0">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-blue-950 px-5 py-3.5 min-h-[48px] sm:min-h-0 text-sm font-semibold shadow-lg shadow-blue-950/50 hover:bg-sky-50 transition-colors w-full sm:w-auto"
              >
                Try for Free
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <a
                href={WHATSAPP_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-sky-300/25 bg-blue-950/30 text-sky-50 px-5 py-3.5 min-h-[48px] sm:min-h-0 text-sm font-semibold backdrop-blur-sm hover:bg-blue-900/40 transition-colors w-full sm:w-auto"
              >
                Book a demo
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-center justify-center lg:justify-start gap-3 sm:gap-6 text-xs sm:text-sm text-blue-200/70 max-w-md mx-auto lg:max-w-none">
              <div className="flex w-full sm:w-auto items-start sm:items-center gap-2.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-950/50 border border-sky-400/20">
                  <MapPin className="w-4 h-4 text-sky-300" aria-hidden />
                </span>
                <span className="text-blue-100/90 pt-0.5 sm:pt-0">
                  Trusted by growing businesses in <span className="text-white font-medium">Malawi</span>
                </span>
              </div>
              <div className="hidden sm:block h-4 w-px shrink-0 bg-sky-400/20" aria-hidden />
              <div className="flex w-full sm:w-auto items-start sm:items-center gap-1.5 text-sky-300/95 text-left sm:text-center">
                <Check className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" strokeWidth={2.5} aria-hidden />
                <span className="leading-snug">Bank-grade security & multi-user access</span>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-lg mx-auto lg:max-w-none min-w-0 mt-2 sm:mt-0">
            <div
              className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-600/35 via-blue-600/20 to-blue-950/30 blur-2xl pointer-events-none"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-sky-400/15 bg-blue-950/35 shadow-2xl shadow-blue-950/60 backdrop-blur-xl overflow-hidden ring-1 ring-indigo-500/20">
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-blue-500/20 bg-blue-950/60 min-w-0">
                <div className="flex gap-1.5 shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                </div>
                <div className="flex-1 flex justify-center min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-blue-300/70 font-mono truncate px-1 sm:px-2 text-center">
                    <span className="sm:hidden">insightbooksafrica.com/…</span>
                    <span className="hidden sm:inline">www.insightbooksafrica.com/dashboard</span>
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-md bg-sky-500/15 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-sky-300 border border-sky-400/25">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-400" />
                  </span>
                  Live
                </span>
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">Overview</h3>
                  <span className="text-[10px] sm:text-[11px] text-blue-300/60 shrink-0">Last 30 days</span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5">
                  <div className="rounded-xl border border-indigo-400/20 bg-gradient-to-br from-indigo-600/25 to-blue-950/20 p-3 sm:p-4 min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-200/90 mb-1">
                      Revenue
                    </p>
                    <p className="text-lg sm:text-2xl font-semibold text-white tabular-nums tracking-tight truncate">
                      K{dashboardData.revenue.toLocaleString()}
                    </p>
                    <p
                      className={`text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 tabular-nums leading-snug ${
                        dashboardData.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {dashboardData.revenueGrowth >= 0 ? '↑' : '↓'}{' '}
                      {dashboardData.revenueGrowth >= 0 ? '+' : ''}
                      {dashboardData.revenueGrowth}% vs last month
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-400/20 bg-gradient-to-br from-blue-600/25 to-indigo-950/20 p-3 sm:p-4 min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-sky-200/90 mb-1">
                      Expenses
                    </p>
                    <p className="text-lg sm:text-2xl font-semibold text-white tabular-nums tracking-tight truncate">
                      K{dashboardData.expenses.toLocaleString()}
                    </p>
                    <p
                      className={`text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 tabular-nums leading-snug ${
                        dashboardData.expensesChange >= 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {dashboardData.expensesChange >= 0 ? '↑' : '↓'}{' '}
                      {dashboardData.expensesChange >= 0 ? '+' : ''}
                      {dashboardData.expensesChange}% vs last month
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-950/70 p-3 sm:p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-blue-100/90">Cash performance</span>
                    <span className="flex items-center gap-3 text-[10px] text-blue-300/70">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                        Net trend
                      </span>
                    </span>
                  </div>
                  <svg viewBox="0 0 400 120" className="w-full h-auto min-w-0 max-w-full" role="img" aria-label="Demo chart of monthly performance">
                    <defs>
                      <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                      <linearGradient id="heroAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(37, 99, 235)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="rgb(30, 58, 138)" stopOpacity="0" />
                      </linearGradient>
                      <filter id="heroGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {[0, 1, 2, 3].map((i) => (
                      <line
                        key={i}
                        x1="24"
                        y1={24 + i * 28}
                        x2="376"
                        y2={24 + i * 28}
                        stroke="rgba(59, 130, 246, 0.12)"
                        strokeWidth="1"
                      />
                    ))}
                    {areaPath ? (
                      <path d={areaPath} fill="url(#heroAreaGrad)" transform="translate(0, -168)" />
                    ) : null}
                    <polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="url(#heroLineGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#heroGlow)"
                      transform="translate(0, -168)"
                    />
                    {pts.map((point, index) => (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y - 168}
                        r="3.5"
                        fill="#dbeafe"
                        stroke="#2563eb"
                        strokeWidth="1.5"
                      />
                    ))}
                    <line
                      x1="24"
                      y1="104"
                      x2="376"
                      y2="104"
                      stroke="rgba(59, 130, 246, 0.25)"
                      strokeWidth="1"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section — icon accents stay in the blue / indigo family (logo-aligned)
const FEATURE_ICON_TONES = {
  spotlight:
    'bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 shadow-lg shadow-blue-500/30',
  indigo: 'bg-gradient-to-br from-indigo-600 to-blue-800 shadow-md shadow-indigo-500/20',
  blue: 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20',
  sky: 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/25',
  cyan: 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20',
  deep: 'bg-gradient-to-br from-blue-800 to-indigo-900 shadow-md shadow-blue-900/25',
};

function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      tone: 'spotlight',
      title: 'AI Assistant',
      description: 'Context-aware help for accounting, payroll, and day-to-day questions.',
      detail:
        'Get answers in plain language about workflows, reports, and where to record transactions. The assistant is designed to guide your team inside InsightBooks—so you spend less time hunting menus and more time running the business.',
      isHighlighted: true,
    },
    {
      icon: UserPlus,
      tone: 'indigo',
      title: 'HR & Payroll',
      description: 'Employees, salaries, deductions, and payroll runs in one workflow.',
      detail:
        'Maintain staff records, structure pay components, and process payroll with clear audit trails. Built for growing teams that need consistency between HR data and the numbers that hit your books.',
      isHighlighted: true,
    },
    {
      icon: BookOpen,
      tone: 'blue',
      title: 'Accounting',
      description: 'Chart of accounts, journals, and trial balance—proper double-entry.',
      detail:
        'Structure your books with a chart of accounts, post journal entries, and review trial balance before period close. Ideal when you are ready to move from spreadsheets to disciplined bookkeeping.',
      isHighlighted: true,
    },
    {
      icon: Truck,
      tone: 'sky',
      title: 'Supplier Management',
      description: 'Suppliers, purchase orders, bills, and goods linked to stock.',
      detail:
        'Onboard suppliers, track purchase orders and bills, and connect receipts to inventory where it matters. Fewer gaps between what you buy, what you owe, and what you still have on hand.',
      isHighlighted: true,
    },
    {
      icon: LayoutDashboard,
      tone: 'cyan',
      title: 'Dashboard',
      description: 'At-a-glance revenue, expenses, and activity across the business.',
      detail:
        'See the metrics that matter on one screen: performance trends, alerts, and recent activity so owners and managers can align quickly without exporting spreadsheets.',
    },
    {
      icon: UserCheck,
      tone: 'deep',
      title: 'User & Role Management',
      description: 'Granular permissions so each role sees only what they need.',
      detail:
        'Create roles, assign module-level permissions, and onboard users safely. Scale your team without sacrificing control over sensitive financial and HR data.',
    },
    {
      icon: Building2,
      tone: 'indigo',
      title: 'Business Management',
      description: 'Branches, settings, and structure that match how you operate.',
      detail:
        'Configure businesses, branches, and core preferences so reporting and access reflect your real-world organization—not a one-size template.',
    },
    {
      icon: User,
      tone: 'blue',
      title: 'Client Management',
      description: 'Clients, contacts, and a full history of quotes and invoices.',
      detail:
        'Keep customer records current, track communication context, and tie every quotation and invoice back to the right client for clean receivables.',
    },
    {
      icon: CreditCard,
      tone: 'sky',
      title: 'POS (Point of Sale)',
      description: 'Fast checkout, receipts, and stock impact at the counter.',
      detail:
        'Ring up sales in real time, print or share receipts, and keep stock levels honest at the point of purchase—whether you run a shop floor or a service desk.',
    },
    {
      icon: FileTextIcon,
      tone: 'indigo',
      title: 'Quotations',
      description: 'Professional quotes you can convert to invoices in a click.',
      detail:
        'Build line-item quotations with clear terms, track status with customers, and convert accepted quotes to invoices without retyping line items.',
    },
    {
      icon: Receipt,
      tone: 'cyan',
      title: 'Invoicing',
      description: 'Issue invoices, track payments, and reduce follow-up friction.',
      detail:
        'Create branded invoices, monitor balances due, and record payments against the right documents so your revenue picture stays accurate month to month.',
    },
    {
      icon: DollarSign,
      tone: 'blue',
      title: 'Expense Tracking',
      description: 'Capture spend, categorize costs, and see where money goes.',
      detail:
        'Record expenses with supporting detail, categorize for reporting, and give leadership a clearer view of operating costs before they become surprises.',
    },
    {
      icon: Wallet,
      tone: 'deep',
      title: 'Assets & Liabilities',
      description: 'Balance-sheet view of what you own and what you owe.',
      detail:
        'Track assets and liabilities with context so your financial position is visible alongside income and expenses—not buried in disconnected lists.',
    },
    {
      icon: Banknote,
      tone: 'sky',
      title: 'Payment Accounts',
      description: 'Cash, bank, and mobile wallets with live balances and controlled transfers.',
      detail:
        'Configure payment methods under Payment Accounts, move funds between them safely, and tie receipts to invoices and POS so balances stay aligned with your books.',
    },
    {
      icon: TrendingUp,
      tone: 'indigo',
      title: 'Financial Reporting',
      description: 'Statements and reports leadership can trust for decisions.',
      detail:
        'Generate the reports you need for management and compliance—from profitability to position—without stitching together multiple exports.',
    },
    {
      icon: Package,
      tone: 'blue',
      title: 'Stock Management',
      description: 'Products, levels, transfers, and movements with full traceability.',
      detail:
        'Maintain catalogs, monitor stock across locations, and follow movements so sales, purchasing, and inventory stay in sync as you scale.',
    },
    {
      icon: Calculator,
      tone: 'cyan',
      title: 'Tax Management',
      description: 'Tax codes, calculations, and reporting support built in.',
      detail:
        'Configure tax treatment consistently across documents and leverage reporting hooks that make statutory work more structured and less last-minute.',
    },
  ];

  return (
    <section
      id="features"
      className="relative py-24 md:py-28 overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/40 to-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(59, 130, 246, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center mb-14 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800/90 shadow-sm backdrop-blur-sm mb-6">
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" aria-hidden />
            Platform capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-5">
            Everything to run your{' '}
            <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
              finances in one place
            </span>
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Invoicing, stock, payroll, accounting, and reporting — designed for teams that outgrow
            spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            const isComingSoon = feature.title.includes('Coming Soon');
            const isHighlighted = feature.isHighlighted || false;
            const iconClass =
              FEATURE_ICON_TONES[feature.tone] || FEATURE_ICON_TONES.blue;

            return (
              <article
                key={index}
                tabIndex={0}
                className={`group relative min-h-[260px] rounded-2xl border bg-white/70 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 ${
                  isHighlighted
                    ? 'border-blue-300/80 ring-1 ring-blue-200/60 hover:border-blue-400'
                    : 'border-slate-200/90 hover:border-blue-200'
                } ${isComingSoon ? 'opacity-75' : ''}`}
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-sky-50/40"
                  aria-hidden
                />

                {/* Default: icon + short copy */}
                <div className="absolute inset-0 z-10 flex flex-col p-6 md:p-7 transition-opacity duration-300 group-hover:opacity-0 group-hover:pointer-events-none group-focus-within:opacity-0 group-focus-within:pointer-events-none">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-transform duration-300 ${iconClass} ${
                        isHighlighted ? 'ring-2 ring-blue-200 ring-offset-2 ring-offset-white' : ''
                      }`}
                    >
                      <IconComponent size={22} className="text-white" strokeWidth={2} aria-hidden />
                    </div>
                    {isComingSoon && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
                        Soon
                      </span>
                    )}
                  </div>
                  <h3
                    className={`text-lg font-bold leading-snug mb-2 ${
                      isHighlighted ? 'text-blue-950' : 'text-slate-900'
                    }`}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 line-clamp-3 flex-1">
                    {feature.description}
                  </p>
                  <p className="mt-4 text-xs font-medium text-blue-600/80">
                    Hover or focus for details
                  </p>
                </div>

                {/* Hover / keyboard focus: title + full description (no icon) */}
                <div className="absolute inset-0 z-20 flex flex-col justify-center overflow-y-auto rounded-2xl p-6 md:p-7 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 bg-gradient-to-br from-white via-blue-50/80 to-indigo-50/90 ring-1 ring-blue-200/50">
                  <h3 className="text-xl font-bold leading-tight text-blue-950 pr-2">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">{feature.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Video Showcase Section
function VideoShowcaseSection() {
  const modules = [
    {
      title: "Invoicing & Billing",
      description: "Create professional invoices, set up recurring billing, and track payments easily.",
      videoSrc: "/videos/invoicing.mp4" // Placeholder path
    },
    {
      title: "Expense Management",
      description: "Track business expenses, capture receipts, and categorize transactions automatically.",
      videoSrc: "/videos/expenses.mp4" // Placeholder path
    },
    {
      title: "Financial Reports",
      description: "Generate income statements, balance sheets, and cash flow reports in seconds.",
      videoSrc: "/videos/reports.mp4" // Placeholder path
    },
    {
      title: "Client Management",
      description: "Maintain client records, track communication, and manage payment terms.",
      videoSrc: "/videos/clients.mp4" // Placeholder path
    },
    {
      title: "Tax Preparation",
      description: "Organize your finances for tax season with built-in calculations and categorization.",
      videoSrc: "/videos/tax.mp4" // Placeholder path
    },
    {
      title: "Bank Reconciliation",
      description: "Connect your bank accounts and reconcile transactions automatically.",
      videoSrc: "/videos/banking.mp4" // Placeholder path
    }
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">See InsightBooks in Action</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Watch short videos to see how InsightBooks can streamline your financial workflows.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {modules.map((module, index) => (
            <div key={index} className="rounded-lg overflow-hidden shadow-md bg-white">
              <div className="relative aspect-video bg-slate-200">
                {/* Video thumbnail with play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-indigo-600 rounded-full p-3 text-white">
                    <Play size={24} />
                  </div>
                </div>
                {/* This would be replaced with actual video player in production */}
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                  10-15 second {module.title} demo
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-lg text-slate-900 mb-2">{module.title}</h3>
                <p className="text-slate-600 text-sm">{module.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// Business categories — who InsightBooks is built for
function TestimonialsSection() {
  const businessCategories = [
    'Pharmacies',
    'Liquor stores',
    'Supermarkets & grocers',
    'Restaurants & cafés',
    'Hardware & building supplies',
    'Fashion & apparel',
    'Electronics & mobile shops',
    'Auto parts & garages',
    'Spaza shops & tuck shops',
    'Wholesalers & distributors',
    'Salons & barbers',
    'Hotels & guest houses',
    'Agricultural supplies',
    'Bookstores & stationery',
    'Butcheries & delis',
    'Fuel stations & convenience',
    'Medical & dental clinics',
    'Schools & training centres',
  ];

  return (
    <section className="relative border-y border-blue-100/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 py-14">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-blue-600/80 mb-2">
          Business categories
        </p>
        <h2 className="text-center text-lg font-semibold text-slate-800 mb-8 sm:text-xl">
          Built for shops and teams like yours
        </h2>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          {businessCategories.map((name) => (
            <span
              key={name}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-800"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const plans = PUBLIC_SUBSCRIPTION_PLANS;

  const allFeatures = [
    'POS (Point of Sale)',
    'Stock management',
    'Expense tracking',
    'Invoices',
    'Quotations',
    'Customer database',
    'Financial reporting',
    'AI assistant',
    'HR & payroll',
    'Supplier management',
    'Tax management',
    'Accounting & bookkeeping',
  ];

  return (
    <section
      id="pricing"
      className="relative overflow-hidden py-24 md:py-28 bg-gradient-to-b from-slate-50 via-blue-50/35 to-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(59, 130, 246, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-800 shadow-sm backdrop-blur-sm">
            <DollarSign className="h-3.5 w-3.5 text-blue-600" aria-hidden />
            Simple pricing
          </div>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Our pricing —{' '}
            <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
              full platform access
            </span>
          </h2>
          <p className="text-lg leading-relaxed text-slate-600">
            Every plan includes the same capabilities. Choose monthly flexibility or lock in annual savings.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {plans.map((plan, index) => (
            <div
              key={plan.id || index}
              className={`relative flex flex-col rounded-2xl border bg-white/85 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10 ${
                plan.highlight
                  ? 'border-blue-400/80 ring-2 ring-blue-200/70 md:scale-[1.02]'
                  : 'border-slate-200/90 hover:border-blue-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30">
                  Best value
                </div>
              )}
              <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-blue-950 tabular-nums">
                  {plan.priceFormatted}
                </span>
                {plan.periodDisplay && (
                  <span className="text-lg text-slate-600">{plan.periodDisplay}</span>
                )}
              </div>
              {plan.savings && (
                <div className="mt-4 inline-flex rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                  {plan.savings}
                </div>
              )}

              <div className="mt-8 flex-1">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-blue-900/70">
                  Everything included
                </h4>
                <ul className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1 text-sm [scrollbar-width:thin]">
                  {allFeatures.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3 rounded-lg py-0.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </span>
                      <span className="text-slate-700 leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/signup"
                  className={`flex-1 rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700'
                      : 'border border-blue-200 bg-blue-50/80 text-blue-900 hover:bg-blue-100'
                  }`}
                >
                  Try for Free
                </Link>
                <Link
                  href="/contact"
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section (visual language aligned with hero)
function CtaSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-28">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950 via-indigo-950 to-blue-950" aria-hidden />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% -28%, rgba(67, 56, 202, 0.5), transparent 52%), radial-gradient(ellipse 55% 45% at 100% 45%, rgba(29, 78, 216, 0.35), transparent)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(96, 165, 250, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(96, 165, 250, 0.07) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-600/25 blur-[90px] pointer-events-none" aria-hidden />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-sky-100/90 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-sky-300" aria-hidden />
          <span>Join businesses across Malawi</span>
        </div>
        <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Ready to simplify your{' '}
          <span className="bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text text-transparent">
            finances?
          </span>
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-blue-100/90">
          One platform for invoices, expenses, payroll, and reporting — built for teams that want clarity
          without the spreadsheet chaos.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-blue-950 shadow-lg shadow-blue-950/40 transition-colors hover:bg-sky-50"
          >
            Register
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href={WHATSAPP_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-sky-300/30 bg-blue-950/40 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-blue-900/50"
          >
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-blue-900/50 bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 text-slate-400">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(59, 130, 246, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Link href="/" className="inline-flex items-center">
              <img
                src="/logo.png"
                alt="InsightBooks — cloud accounting and business software"
                className="h-11 w-auto object-contain rounded-md"
              />
            </Link>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-slate-400">
              Business Management Simplified.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-opacity hover:opacity-95"
              >
                Try for Free
              </Link>
              <a
                href={WHATSAPP_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-sky-400/30 bg-blue-950/50 px-4 py-2 text-sm font-semibold text-sky-100 transition-colors hover:border-sky-400/50 hover:bg-blue-900/50"
              >
                Book a demo
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 lg:col-span-7">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200/90">
                <Mail className="h-4 w-4 text-sky-400" aria-hidden />
                Email
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a
                    href="mailto:insightinnovationsltd@gmail.com"
                    className="text-slate-400 transition-colors hover:text-white"
                  >
                    insightinnovationsltd@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:info@insightbooksafrica.com"
                    className="text-slate-400 transition-colors hover:text-white"
                  >
                    info@insightbooksafrica.com
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200/90">
                <Phone className="h-4 w-4 text-sky-400" aria-hidden />
                Phone
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="tel:+265894092494" className="text-slate-400 transition-colors hover:text-white">
                    +265 894 09 24 94
                  </a>
                </li>
                <li>
                  <a href="tel:+265888437000" className="text-slate-400 transition-colors hover:text-white">
                    +265 888 43 70 00
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-sky-200/90">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/privacy" className="text-slate-400 transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-slate-400 transition-colors hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-blue-900/60 pt-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} InsightBooks. All rights reserved.</p>
          <p className="text-slate-600">Built for businesses in Malawi and beyond.</p>
        </div>
      </div>
    </footer>
  );
}
