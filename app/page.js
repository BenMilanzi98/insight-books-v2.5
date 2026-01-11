'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Check, ArrowRight, Play, FileText, BarChart3, Receipt, Users, ChevronLeft, ChevronRight, LayoutDashboard, UserCheck, Building2, User, CreditCard, FileText as FileTextIcon, DollarSign, Wallet, Clock, Banknote, TrendingUp, Package, Truck, Calculator, BookOpen, Briefcase, UserPlus } from 'lucide-react';
import { SUBSCRIPTION_PLANS_ARRAY } from '@/lib/subscriptionConfig';

export default function LandingPage() {
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled ? "bg-white py-3 shadow-sm" : "bg-transparent py-5"
    }`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center">
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
              alt="InsightBooks Logo"
              className="h-10 w-auto object-contain rounded-md"
            />
          </Link>
          
          <div className="hidden md:flex space-x-8">
            <Link href="/auth/login" className={`border ${scrolled ? "border-slate-700 text-slate-700 hover:bg-slate-50" : "border-white text-white hover:bg-white hover:text-indigo-900"} text-sm px-4 py-2 rounded-md transition-colors`}>
              Log In
            </Link>
            <Link href="/contact" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700">
              Book a Demo
            </Link>
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
            <Link href="/auth/login" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
              Log In
            </Link>
            <Link href="/contact" className="block w-full text-center bg-indigo-600 text-white py-3 rounded-md" onClick={() => setMobileMenuOpen(false)}>
              Book a Demo
            </Link>
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

  return (
    <section className="relative bg-indigo-900 pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '20px 20px'
      }}></div>
      <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-800 clip-diagonal"></div>
      
      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 text-white">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              Financial Management <span className="text-indigo-300">Simplified</span>
            </h1>
            <p className="text-indigo-100 text-lg mb-10">
              One platform to manage your invoices, expenses, and financial reports. Built for growing businesses.
            </p>
            {/* <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact" className="bg-white text-indigo-900 px-6 py-3 rounded-md font-medium hover:bg-indigo-50 text-center">
                Request a Demo
              </Link>
              <Link href="#features" className="border border-indigo-300 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-800 text-center">
                Learn More
              </Link>
            </div> */}
            <div className="mt-10 text-sm text-indigo-200">
              Trusted by growing businesses in Malawi
            </div>
          </div>
          
          <div className="md:w-1/2">
            <div className="relative">
              <svg viewBox="0 0 400 300" className="w-full h-auto drop-shadow-xl">
                {/* Main app window with border and rounded corners */}
                <rect x="10" y="10" width="380" height="280" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="2" />
                
                {/* Window header/toolbar */}
                <rect x="10" y="10" width="380" height="30" rx="10" fill="#f1f5f9" />
                <rect x="10" y="30" width="380" height="10" fill="#f1f5f9" />
                
                {/* Window control buttons */}
                <circle cx="30" cy="25" r="6" fill="#f87171" /> {/* Close */}
                <circle cx="50" cy="25" r="6" fill="#fbbf24" /> {/* Minimize */}
                <circle cx="70" cy="25" r="6" fill="#34d399" /> {/* Expand */}
                
                {/* App header */}
                <rect x="20" y="50" width="360" height="40" rx="6" fill="#f8fafc" />
                <text x="40" y="75" fill="#334155" fontWeight="600" fontSize="14">InsightBooks Dashboard</text>
                
                {/* Left panel - summary numbers */}
                <rect x="20" y="100" width="170" height="80" rx="6" fill="#f1f5f9" />
                <rect x="30" y="110" width="80" height="20" rx="4" fill="#dbeafe" />
                <text x="40" y="125" fill="#1e40af" fontWeight="600" fontSize="12">Revenue</text>
                <text x="130" y="125" fill="#1e40af" fontWeight="600" fontSize="12">K{dashboardData.revenue.toLocaleString()}</text>

                <rect x="30" y="140" width="150" height="30" rx="4" fill="white" />
                <text x="40" y="160" fill="#64748b" fontSize="11">Monthly Growth</text>
                <text x="140" y="160" fill={dashboardData.revenueGrowth >= 0 ? "#059669" : "#dc2626"} fontWeight="600" fontSize="11">
                  {dashboardData.revenueGrowth >= 0 ? '+' : ''}{dashboardData.revenueGrowth}%
                </text>

                {/* Vertical separator */}
                <line x1="200" y1="100" x2="200" y2="180" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 2" />

                {/* Right panel - summary numbers */}
                <rect x="210" y="100" width="170" height="80" rx="6" fill="#f1f5f9" />
                <rect x="220" y="110" width="80" height="20" rx="4" fill="#ede9fe" />
                <text x="230" y="125" fill="#5b21b6" fontWeight="600" fontSize="12">Expenses</text>
                <text x="320" y="125" fill="#5b21b6" fontWeight="600" fontSize="12">K{dashboardData.expenses.toLocaleString()}</text>

                <rect x="220" y="140" width="150" height="30" rx="4" fill="white" />
                <text x="230" y="160" fill="#64748b" fontSize="11">Monthly Change</text>
                <text x="340" y="160" fill={dashboardData.expensesChange >= 0 ? "#dc2626" : "#059669"} fontWeight="600" fontSize="11">
                  {dashboardData.expensesChange >= 0 ? '+' : ''}{dashboardData.expensesChange}%
                </text>
                
                {/* Graph area */}
                <rect x="20" y="190" width="360" height="90" rx="6" fill="#f1f5f9" />

                {/* Graph line */}
                <polyline
                  points={dashboardData.graphPoints.map(point => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Graph dots */}
                {dashboardData.graphPoints.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#4f46e5"
                  >
                    <animate
                      attributeName="r"
                      dur="2s"
                      repeatCount="indefinite"
                      values="4;6;4"
                    />
                  </circle>
                ))}

                {/* Horizontal line (x-axis) */}
                <line x1="30" y1="260" x2="370" y2="260" stroke="#cbd5e1" strokeWidth="1" />

                {/* Chart title and legend */}
                <text x="30" y="210" fill="#334155" fontWeight="600" fontSize="12">Monthly Performance</text>

                {/* Live indicator */}
                
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: LayoutDashboard,
      color: "bg-blue-500",
      title: "Dashboard",
      description: "Real-time overview of key business metrics, performance, and activity."
    },
    {
      icon: UserCheck,
      color: "bg-green-500",
      title: "User & Role Management",
      description: "Assign roles and permissions to control system access."
    },
    {
      icon: Building2,
      color: "bg-purple-500",
      title: "Business Management",
      description: "Comprehensive business setup and configuration tools."
    },
    {
      icon: User,
      color: "bg-orange-500",
      title: "Client Management",
      description: "Manage customer details, contacts, and transaction history."
    },
    {
      icon: CreditCard,
      color: "bg-red-500",
      title: "POS (Point of Sale)",
      description: "Handle in-store sales, receipts, and payment processing."
    },
    {
      icon: FileTextIcon,
      color: "bg-indigo-500",
      title: "Quotations",
      description: "Create and manage customer price estimates."
    },
    {
      icon: Receipt,
      color: "bg-cyan-500",
      title: "Invoicing",
      description: "Generate, send, and track invoices and payment status."
    },
    {
      icon: DollarSign,
      color: "bg-emerald-500",
      title: "Expense Tracking",
      description: "Record and monitor expenses to control costs and spending."
    },
    {
      icon: Wallet,
      color: "bg-amber-500",
      title: "Assets & Liabilities",
      description: "Track what the business owns and owes."
    },
    {
      icon: UserPlus,
      color: "bg-gray-500",
      title: "HR & Payroll (Coming Soon)",
      description: "Employee records, salaries, deductions, and payroll processing."
    },
    {
      icon: Banknote,
      color: "bg-teal-500",
      title: "Payment Processing",
      description: "Process and record incoming and outgoing payments."
    },
    {
      icon: TrendingUp,
      color: "bg-rose-500",
      title: "Financial Reporting",
      description: "Generate financial statements and performance reports."
    },
    {
      icon: Package,
      color: "bg-pink-500",
      title: "Stock Management",
      description: "Track stock levels, movements, and availability."
    },
    {
      icon: Truck,
      color: "bg-lime-500",
      title: "Supplier Management (Coming Soon)",
      description: "Manage suppliers, purchases, and transactions."
    },
    {
      icon: Calculator,
      color: "bg-violet-500",
      title: "Tax Management",
      description: "Calculate and track taxes in compliance with regulations."
    },
    {
      icon: BookOpen,
      color: "bg-yellow-500",
      title: "Accounting (Coming Soon)",
      description: "📋 Chart of Accounts\n✏️ Journal Entries\n⚖️ Trial Balance"
    }
    // {
    //   emoji: "🔄",
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Features</h2>
          <p className="text-slate-600 max-w-3xl mx-auto text-lg">
            Everything you need to manage your business finances efficiently and effectively.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            const isComingSoon = feature.title.includes("Coming Soon");

            return (
              <div
                key={index}
                className={`group relative p-8 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-500 cursor-pointer overflow-hidden ${
                  isComingSoon ? 'opacity-75' : ''
                }`}
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* Content */}
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 ${feature.color} shadow-lg`}>
                    <IconComponent size={28} className="text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-700 transition-colors duration-300">
                    {feature.title}
                  </h3>

                  <p className="text-slate-600 leading-relaxed group-hover:text-slate-700 transition-colors duration-300">
                    {feature.description}
                  </p>

                  {/* Coming Soon Badge */}
                  {isComingSoon && (
                    <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-full">
                      Soon
                    </div>
                  )}
                </div>

                {/* Hover effect line */}
                <div className="absolute bottom-0 left-0 w-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600 group-hover:w-full transition-all duration-500"></div>
              </div>
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


// Clients Section
function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const clients = [
    "TechInnovate",
    "Retail Plus",
    "Finance Corp",
    "Business Solutions",
    "Enterprise Ltd",
    "Startup Hub",
    "Global Trade",
    "Local Services",
    "Digital Solutions",
    "Manufacturing Inc",
    "Healthcare Plus",
    "Education Hub"
  ];

  // Duplicate clients for infinite scroll effect
  const duplicatedClients = [...clients, ...clients];

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % clients.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? clients.length - 1 : prevIndex - 1
    );
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % clients.length);
    }, 3000); // Auto-play every 3 seconds

    return () => clearInterval(interval);
  }, []);

}

// Pricing Section
function PricingSection() {
  const plans = SUBSCRIPTION_PLANS_ARRAY;

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Pricing</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            All features included with every plan. Choose the option that works best for your business.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-white rounded-lg p-8 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer opacity-0 animate-fade-in ${
                plan.highlight ? "ring-2 ring-indigo-600 relative" : ""
              }`}
              style={{
                animationDelay: `${index * 0.2}s`,
                animationFillMode: 'both'
              }}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm">
                  Best Value
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline mb-2">
                <span className="text-3xl font-bold text-slate-900">{plan.priceFormatted}</span>
                {plan.periodDisplay && <span className="text-slate-600 ml-2">{plan.periodDisplay}</span>}
              </div>
              {plan.savings && (
                <div className="mb-6 text-sm text-green-600 font-medium">{plan.savings}</div>
              )}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center">
                    <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <Check className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span className="text-slate-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              {/* <Link href={plan.name === "Tailor-Made" ? "/contact" : "/contact"} 
                className={`block w-full py-3 rounded-md text-center font-medium ${
                  plan.highlight 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}>
                {plan.name === "Tailor-Made" ? "Contact Us" : "Book a Demo"}
              </Link> */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CtaSection() {
  return (
    <section className="py-20 bg-indigo-600 text-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-6">Ready to simplify your finances?</h2>
        <p className="text-indigo-100 mb-10 max-w-xl mx-auto">
         Join a community of growing businesses that trust InsightBooks for their financial management.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {/* <Link href="/auth/signup" className="bg-white text-indigo-600 px-6 py-3 rounded-md font-medium hover:bg-indigo-50">
            Create Account
          </Link> */}
          <Link href="/contact" className="border border-white text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-500">
            Book a Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            {/* <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center mr-3">
                <span className="text-white font-medium text-sm">IB</span>
              </div>
              <span className="text-white font-semibold">InsightBooks</span>
            </div> */}
            <Link href="/" className="flex items-center">
              <img
                src="/logo.png"
                alt="InsightBooks Logo"
                className="h-10 w-auto object-contain rounded-md"
              />
            </Link>
            <p className="mb-6 mt-6">Financial management solution that helps businesses make better decisions.</p>
          </div>
          
<div>
  <h3 className="text-white font-medium mb-4">Email</h3>
  <ul className="space-y-2">
    <li>
      <a href="mailto:insightinnovationsltd@gmail.com" className="hover:text-white">
        insightinnovationsltd@gmail.com
      </a>
    </li>
    <li>
      <a href="mailto:info@insightbooksafrica.com" className="hover:text-white">
        info@insightbooksafrica.com
      </a>
    </li>
  </ul>
</div>
          
          <div>
            <h3 className="text-white font-medium mb-4">Contact Us</h3>
            <ul className="space-y-2">
              <li>
                <a href="tel:+265894092494" className="hover:text-white">
                  +265 894 09 24 94
                </a>
              </li>
              <li>
                <a href="tel:+265888437000" className="hover:text-white">
                  +265 888 43 70 00
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-medium mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              {/* <li>
                <Link href="/security" className="hover:text-white">
                  Security
                </Link>
              </li> */}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8">
          <div className="text-sm">
            © InsightBooks 2025. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}