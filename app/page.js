'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Check, ArrowRight, Play, FileText, BarChart3, Receipt, Users } from 'lucide-react';
import { SUBSCRIPTION_PLANS_ARRAY } from '@/lib/subscriptionConfig';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <NavigationBar />
      <HeroSection />
      <FeaturesSection />
      {/* <VideoShowcaseSection /> */}
      <IntegrationSection />
      <TestimonialsSection />
      <PricingSection />
      <CtaSection />
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
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="InsightBooks Logo"
              className="h-10 w-auto object-contain rounded-md"
            />
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link href="#features" className={`${scrolled ? "text-slate-700" : "text-white"} text-sm hover:text-indigo-500`}>
              Features
            </Link>
            <Link href="#testimonials" className={`${scrolled ? "text-slate-700" : "text-white"} text-sm hover:text-indigo-500`}>
              Testimonials
            </Link>
            <Link href="#pricing" className={`${scrolled ? "text-slate-700" : "text-white"} text-sm hover:text-indigo-500`}>
              Pricing
            </Link>
            <Link href="/auth/login" className={`${scrolled ? "text-slate-700" : "text-white"} text-sm hover:text-indigo-500`}>
              Log In
            </Link>
            <Link href="/auth/signup" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700">
              Create Account
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
            <Link href="#features" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
              Features
            </Link>
            <Link href="#testimonials" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
              Testimonials
            </Link>
            <Link href="#pricing" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="/auth/login" className="block text-slate-800" onClick={() => setMobileMenuOpen(false)}>
              Log In
            </Link>
            <Link href="/auth/signup" className="block w-full text-center bg-indigo-600 text-white py-3 rounded-md" onClick={() => setMobileMenuOpen(false)}>
              Create Account
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative bg-indigo-900 pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
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
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth/signup" className="bg-white text-indigo-900 px-6 py-3 rounded-md font-medium hover:bg-indigo-50 text-center">
                Create Account
              </Link>
              <Link href="#features" className="border border-indigo-300 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-800 text-center">
                Learn More
              </Link>
            </div>
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
                <text x="130" y="125" fill="#1e40af" fontWeight="600" fontSize="12">K14,850</text>
                
                <rect x="30" y="140" width="150" height="30" rx="4" fill="white" />
                <text x="40" y="160" fill="#64748b" fontSize="11">Monthly Growth</text>
                <text x="140" y="160" fill="#059669" fontWeight="600" fontSize="11">+12.5%</text>
                
                {/* Vertical separator */}
                <line x1="200" y1="100" x2="200" y2="180" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 2" />
                
                {/* Right panel - summary numbers */}
                <rect x="210" y="100" width="170" height="80" rx="6" fill="#f1f5f9" />
                <rect x="220" y="110" width="80" height="20" rx="4" fill="#ede9fe" />
                <text x="230" y="125" fill="#5b21b6" fontWeight="600" fontSize="12">Expenses</text>
                <text x="320" y="125" fill="#5b21b6" fontWeight="600" fontSize="12">K5,240</text>
                
                <rect x="220" y="140" width="150" height="30" rx="4" fill="white" />
                <text x="230" y="160" fill="#64748b" fontSize="11">Monthly Change</text>
                <text x="340" y="160" fill="#dc2626" fontWeight="600" fontSize="11">+3.8%</text>
                
                {/* Graph area */}
                <rect x="20" y="190" width="360" height="90" rx="6" fill="#f1f5f9" />
                
                {/* Graph line */}
                <polyline 
                  points="40,250 80,230 120,240 160,210 200,220 240,200 280,190 320,210 360,205" 
                  fill="none" 
                  stroke="#4f46e5" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                
                {/* Graph dots */}
                <circle cx="40" cy="250" r="4" fill="#4f46e5" />
                <circle cx="80" cy="230" r="4" fill="#4f46e5" />
                <circle cx="120" cy="240" r="4" fill="#4f46e5" />
                <circle cx="160" cy="210" r="4" fill="#4f46e5" />
                <circle cx="200" cy="220" r="4" fill="#4f46e5" />
                <circle cx="240" cy="200" r="4" fill="#4f46e5" />
                <circle cx="280" cy="190" r="4" fill="#4f46e5" />
                <circle cx="320" cy="210" r="4" fill="#4f46e5" />
                <circle cx="360" cy="205" r="4" fill="#4f46e5" />
                
                {/* Horizontal line (x-axis) */}
                <line x1="30" y1="260" x2="370" y2="260" stroke="#cbd5e1" strokeWidth="1" />
                
                {/* Chart title and legend */}
                <text x="30" y="210" fill="#334155" fontWeight="600" fontSize="12">Monthly Performance</text>
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
      icon: FileText,
      color: "bg-blue-500",
      title: "Invoicing",
      description: "Create and send professional invoices with automatic payment reminders."
    },
    {
      icon: BarChart3,
      color: "bg-purple-500",
      title: "Reporting",
      description: "Generate financial reports with customizable filters and insights."
    },
    {
      icon: Receipt,
      color: "bg-green-500",
      title: "Expenses",
      description: "Track expenses, upload receipts, and categorize transactions."
    },
    // {
    //   emoji: "💸",
    //   title: "Tax Ready",
    //   description: "Organize your finances for tax season with built-in calculations."
    // },
    {
      icon: Users,
      color: "bg-orange-500",
      title: "Client Portal",
      description: "Give clients access to invoices and payment methods."
    },
    // {
    //   emoji: "🔄",
  ];

  return (
    <section id="features" className="pt-14 pb-10 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need, nothing you don't</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            InsightBooks focuses on the essential tools that make financial management simple and effective.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index} 
                className="p-6 rounded-lg bg-white border border-slate-200 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <div className={`${feature.color} w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent size={30} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
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

// Integration Section
function IntegrationSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 order-2 md:order-1">
            <div className="bg-white p-6 rounded-lg shadow">
            <svg viewBox="0 0 400 300" className="w-full h-auto">
                {/* Background gradient */}
                <defs>
                  <radialGradient id="bgGradient" cx="200" cy="150" r="180" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#f1f5f9" />
                  </radialGradient>
                  
                  <linearGradient id="centerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  
                  <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#64748b" floodOpacity="0.2"/>
                  </filter>
                </defs>

                {/* Background circle */}
                <rect cx="200" cy="150" r="180" fill="url(#bgGradient)" />
                
                {/* Connection lines with curved paths */}
                <path d="M200,110 C200,90 140,70 100,60" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                {/* <path d="M200,110 C200,80 200,80 200,60" stroke="#2a568bff" strokeWidth="1.5" fill="none" />
                <path d="M200,110 C200,90 260,70 300,60" stroke="#286abaff" strokeWidth="1.5" fill="none" />
                
                <path d="M160,150 C120,150 100,150 60,150" stroke="#638fc5ff" strokeWidth="1.5" fill="none" /> */}
                <path d="M240,150 C280,150 300,150 340,150" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                
                {/* <path d="M200,190 C200,210 140,230 100,240" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                <path d="M200,190 C200,220 200,220 200,240" stroke="#cbd5e1" strokeWidth="1.5" fill="none" /> */}
                <path d="M200,190 C200,210 260,230 300,240" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
                
                {/* Central hub - InsightBooks with gradient and shadow */}
                <circle cx="200" cy="150" r="42" fill="url(#centerGradient)" filter="url(#dropShadow)" />
                <circle cx="200" cy="150" r="40" fill="url(#centerGradient)" />
                <text x="200" y="155" textAnchor="middle" fill="white" fontWeight="600" fontSize="12">InsightBooks</text>
                
                {/* Outer glow animation */}
                <circle cx="200" cy="150" r="46" fill="none" stroke="#4f46e5" strokeWidth="2" opacity="0.3">
                  <animate attributeName="r" values="46;52;46" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
                </circle>
                
                {/* Banking nodes - Top row with shadow and better styling */}
                <g filter="url(#dropShadow)">
                  <circle cx="100" cy="60" r="26" fill="white" />
                  <circle cx="100" cy="60" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="100" y="65" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Inventory</text>
                
                {/* <g filter="url(#dropShadow)">
                  <circle cx="200" cy="60" r="26" fill="white" />
                  <circle cx="200" cy="60" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="200" y="65" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">CRM</text>
                
                <g filter="url(#dropShadow)">
                  <circle cx="300" cy="60" r="26" fill="white" />
                  <circle cx="300" cy="60" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="300" y="65" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Payroll</text>
                 */}
                {/* Middle nodes - Left and right */}
                {/* <g filter="url(#dropShadow)">
                  <circle cx="60" cy="150" r="26" fill="white" />
                  <circle cx="60" cy="150" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="60" y="155" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Payments</text>
                 */}
                <g filter="url(#dropShadow)">
                  <circle cx="340" cy="150" r="26" fill="white" />
                  <circle cx="340" cy="150" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="340" y="155" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">CRM</text>
                
                {/* Bottom row */}
                {/* <g filter="url(#dropShadow)">
                  <circle cx="100" cy="240" r="26" fill="white" />
                  <circle cx="100" cy="240" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="100" y="245" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Inventory</text>
                 */}
                {/* <g filter="url(#dropShadow)">
                  <circle cx="200" cy="240" r="26" fill="white" />
                  <circle cx="200" cy="240" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="200" y="245" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Analytics</text>
                 */}
                <g filter="url(#dropShadow)">
                  <circle cx="300" cy="240" r="26" fill="white" />
                  <circle cx="300" cy="240" r="25" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                </g>
                <text x="300" y="245" textAnchor="middle" fill="#334155" fontWeight="500" fontSize="10">Analytics</text>
                
                {/* Pulse indicators with improved animation */}
                <circle cx="150" cy="105" r="4" fill="#4f46e5" opacity="0.8">
                  <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
                
                <circle cx="120" cy="195" r="4" fill="#4f46e5" opacity="0.8">
                  <animate attributeName="r" values="4;6;4" dur="1.7s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.7s" repeatCount="indefinite" />
                </circle>
                
                <circle cx="280" cy="195" r="4" fill="#4f46e5" opacity="0.8">
                  <animate attributeName="r" values="4;6;4" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.4s" repeatCount="indefinite" />
                </circle>
                
                <circle cx="290" cy="105" r="4" fill="#4f46e5" opacity="0.8">
                  <animate attributeName="r" values="4;6;4" dur="2.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.1s" repeatCount="indefinite" />
                </circle>
                
                {/* Small data flow animation on paths */}
                <circle r="3" fill="#4f46e5" opacity="0.6">
                  <animateMotion path="M200,110 C200,90 140,70 100,60" dur="3s" repeatCount="indefinite" />
                </circle>
                
                <circle r="3" fill="#4f46e5" opacity="0.6">
                  <animateMotion path="M240,150 C280,150 300,150 340,150" dur="2.5s" repeatCount="indefinite" />
                </circle>
                
                <circle r="3" fill="#4f46e5" opacity="0.6">
                  <animateMotion path="M200,190 C200,210 260,230 300,240" dur="2.8s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          </div>
          
          <div className="md:w-1/2 order-1 md:order-2">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Connect with your favorite tools</h2>
            <p className="text-slate-600 mb-8">
              InsightBooks integrates seamlessly with the tools and services you already use.
            </p>
            
            <div className="space-y-4">
              {["E-commerce Platforms"].map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center mr-3">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <div className="text-slate-700">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "InsightBooks has simplified our financial reporting and saved us hours every month.",
      author: "Sarah Chitsulo",
      company: "TechInnovate"
    },
    {
      quote: "The intuitive interface makes it easy for our entire team to track expenses and invoices.",
      author: "Micheal Fumulani",
      company: "Retail Plus"
    }
  ];

  return (
    <section id="testimonials" className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">What our customers say</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Businesses of all sizes trust InsightBooks for their financial management.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="p-8 bg-white rounded-lg shadow">
              <p className="text-slate-700 mb-6 text-lg italic">"{testimonial.quote}"</p>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium mr-4">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{testimonial.author}</div>
                  <div className="text-slate-600 text-sm">{testimonial.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const plans = SUBSCRIPTION_PLANS_ARRAY;

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            All features included with every plan. Choose the option that works best for your business.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8">
          {plans.map((plan, index) => (
            <div key={index} className={`bg-white rounded-lg p-8 shadow-md ${
              plan.highlight ? "ring-2 ring-indigo-600 relative" : ""
            }`}>
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
              <Link href={plan.name === "Tailor-Made" ? "/contact" : "/auth/signup"} 
                className={`block w-full py-3 rounded-md text-center font-medium ${
                  plan.highlight 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}>
                {plan.name === "Tailor-Made" ? "Contact Us" : "Create Account"}
              </Link>
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
          <Link href="/auth/signup" className="bg-white text-indigo-600 px-6 py-3 rounded-md font-medium hover:bg-indigo-50">
            Create Account
          </Link>
          <Link href="/contact" className="border border-white text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-500">
            Contact Us
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
            <div className="flex items-center">
              <img
              src="/logo.png"
              alt="InsightBooks Logo"
              className="h-10 w-auto object-contain rounded-md"
              />
            </div>
            <p className="mb-6 mt-6">Financial management solution that helps businesses make better decisions.</p>
          </div>
          
<div>
  <h3 className="text-white font-medium mb-4">Product</h3>
  <ul className="space-y-2">
    {[
      { text: "Features", link: "/#features" },
      { text: "Pricing", link: "/#pricing" },
      // { text: "Integrations", link: "/integrations" },
      // { text: "Documentation", link: "/docs" }
    ].map((item, i) => (
      <li key={i}>
        <Link href={item.link} className="hover:text-white">
          {item.text}
        </Link>
      </li>
    ))}
  </ul>
</div>
          
          <div>
  <h3 className="text-white font-medium mb-4">Company</h3>
  <ul className="space-y-2">
    {[
      { text: "About", link: "/#" },
      // { text: "Careers", link: "/careers" },
      // { text: "Blog", link: "/blog" },
      { text: "Contact", link: "/contact" }
    ].map((item, i) => (
      <li key={i}>
        <Link href={item.link} className="hover:text-white">
          {item.text}
        </Link>
      </li>
    ))}
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