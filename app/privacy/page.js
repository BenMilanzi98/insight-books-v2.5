"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Eye, Lock, Database, Users, Bell, CheckCircle, AlertCircle, Clock, Mail, MapPin, FileText, Globe, Settings, Camera } from "lucide-react";

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", title: "Introduction", icon: Shield },
    { id: "information-collection", title: "Information We Collect", icon: Database },
    { id: "mobile-app-camera", title: "Mobile app & POS camera", icon: Camera },
    { id: "how-we-use", title: "How We Use Information", icon: Settings },
    { id: "information-sharing", title: "Information Sharing", icon: Users },
    { id: "data-security", title: "Data Security", icon: Lock },
    { id: "data-retention", title: "Data Retention", icon: Clock },
    { id: "your-rights", title: "Your Rights & Choices", icon: CheckCircle },
    { id: "cookies", title: "Cookies & Tracking", icon: Eye },
    { id: "third-party", title: "Third-Party Services", icon: Globe },
    { id: "children-privacy", title: "Children's Privacy", icon: Users },
    { id: "international-transfers", title: "International Transfers", icon: Globe },
    { id: "changes", title: "Changes to Policy", icon: FileText },
    { id: "contact", title: "Contact Information", icon: Mail },
  ];

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg"
              >
                <ArrowLeft size={18} className="mr-2" />
                {tt('Back to Home')}
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Shield size={24} className="text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{tt('Privacy Policy')}</h1>
                <p className="text-sm text-gray-500">{tt('Last updated: January 15, 2025')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield size={20} className="mr-2 text-indigo-600" />
                {tt('Table of Contents')}
              </h2>
              <nav className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center space-x-2 ${
                        activeSection === section.id
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Content Header */}
              <div className="bg-gradient-to-r from-blue-600 to-sky-600 text-white p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{tt('Privacy Policy')}</h1>
                    <p className="text-indigo-100">{tt('How we protect and handle your personal information')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock size={16} />
                    <span>{tt('Last Updated: January 15, 2025')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Lock size={16} />
                    <span>{tt('GDPR Compliant')}</span>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {/* Introduction */}
                <section id="introduction" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Shield size={20} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('1. Introduction')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {tt('At')} <strong>{tt('InsightBooks')}</strong> ("we," "our," or "us"), we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Business Management platform and services.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
                      <p className="text-blue-800 font-medium">
                        By using InsightBooks, you consent to the data practices described in this policy. If you do not agree with our policies and practices, please do not use our Service.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Information We Collect */}
                <section id="information-collection" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Database size={20} className="text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('2. Information We Collect')}</h2>
                  </div>
                  
                  {/* Personal Information */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                      <Users size={18} className="mr-2 text-purple-600" />
                      {tt('2.1 Personal Information')}
                    </h3>
                    <p className="text-gray-700 mb-4">
                      {tt('We collect personal information that you provide directly to us, including:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        "Name, email address, and phone number",
                        "Business information (company name, address, industry)",
                        "Payment and billing information",
                        "Account credentials and preferences",
                        "Communication preferences and marketing consent"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-gray-50 p-3 rounded-lg">
                          <div className="bg-purple-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-purple-600" />
                          </div>
                          <span className="text-gray-700 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Business Data */}
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                      <Database size={18} className="mr-2 text-blue-600" />
                      {tt('2.2 Business Data')}
                    </h3>
                    <p className="text-gray-700 mb-4">
                      {tt('When you use our Service, we may collect business-related data, including:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        "Financial records, invoices, and transactions",
                        "Client and customer information",
                        "Expense reports and receipts",
                        "Inventory and product data",
                        "Reports and analytics generated through our platform"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-blue-50 p-3 rounded-lg">
                          <div className="bg-blue-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-blue-600" />
                          </div>
                          <span className="text-gray-700 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Automatically Collected Information */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                      <Eye size={18} className="mr-2 text-green-600" />
                      {tt('2.3 Automatically Collected Information')}
                    </h3>
                    <p className="text-gray-700 mb-4">
                      {tt('We automatically collect certain information when you use our Service:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        "Device information (IP address, browser type, operating system)",
                        "Usage data (pages visited, features used, time spent)",
                        "Log data (access times, error logs, performance data)",
                        "Cookies and similar tracking technologies"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-green-50 p-3 rounded-lg">
                          <div className="bg-green-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-green-600" />
                          </div>
                          <span className="text-gray-700 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div id="mobile-app-camera" className="mt-10 pt-8 border-t border-gray-200 scroll-mt-28">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                      <Camera size={18} className="mr-2 text-indigo-600" />
                      2.4 Mobile app — camera use for POS (barcode scanning)
                    </h3>
                    <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
                      <p className="leading-relaxed">
                        {tt('The')} <strong>{tt('InsightBooks')}</strong> {tt('mobile app includes a')} <strong>Point of Sale (POS)</strong> workspace. When you choose to scan a product barcode or machine-readable code at checkout, the app may request permission to use your device&apos;s <strong>{tt('camera')}</strong>. That permission is used <strong>{tt('only when you actively open the scanner')}</strong> {tt('to capture barcodes or similar codes—not for continuous background recording or unrelated surveillance.')}
                      </p>
                      <p className="leading-relaxed">
                        {tt('The camera feed is used')} <strong>{tt('on your device')}</strong> {tt('to read the code and match it to products or line items in your sale. We process the')} <strong>{tt('decoded scan result')}</strong> (for example, a SKU or barcode value) as part of your normal POS and inventory workflow. We do <strong>{tt('not')}</strong> {tt('upload or retain')} <strong>{tt('video recordings')}</strong> {tt('of your camera for this barcode feature on our servers.')}
                      </p>
                      <p className="leading-relaxed">
                        You can decline camera access and still use other POS actions (such as manual search or selection), though barcode scanning will not be available without permission. You may withdraw camera permission at any time in your device settings; the app will only request it again when you use a feature that requires the camera.
                      </p>
                    </div>
                  </div>
                </section>

                {/* How We Use Your Information */}
                <section id="how-we-use" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Settings size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('3. How We Use Your Information')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('We use the information we collect for the following purposes:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { title: "Service Provision", desc: "To provide, maintain, and improve our Business Management services", color: "blue" },
                        { title: "Account Management", desc: "To create and manage your account, process payments, and provide customer support", color: "green" },
                        { title: "Communication", desc: "To send you important updates, security alerts, and support messages", color: "purple" },
                        { title: "Analytics", desc: "To analyze usage patterns and improve our Service", color: "indigo" },
                        { title: "Security", desc: "To protect against fraud, abuse, and security threats", color: "red" },
                        { title: "Legal Compliance", desc: "To comply with applicable laws and regulations", color: "yellow" },
                        { title: "Marketing", desc: "To send you promotional materials (with your consent)", color: "pink" }
                      ].map((item, index) => (
                        <div key={index} className={`bg-${item.color}-50 p-4 rounded-lg border border-${item.color}-200`}>
                          <h4 className={`font-semibold text-gray-900 mb-2 text-${item.color}-800`}>{item.title}</h4>
                          <p className="text-gray-700 text-sm">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Information Sharing and Disclosure */}
                <section id="information-sharing" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <Users size={20} className="text-orange-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('4. Information Sharing and Disclosure')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:')}
                    </p>
                    <div className="space-y-4">
                      {[
                        { title: "Service Providers", desc: "With trusted third-party service providers who assist us in operating our Service", icon: "🔧" },
                        { title: "Legal Requirements", desc: "When required by law, court order, or government request", icon: "⚖️" },
                        { title: "Business Transfers", desc: "In connection with a merger, acquisition, or sale of assets", icon: "🏢" },
                        { title: "Protection", desc: "To protect our rights, property, or safety, or that of our users", icon: "🛡️" },
                        { title: "Consent", desc: "With your explicit consent for specific purposes", icon: "✅" }
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-4 bg-orange-50 p-4 rounded-lg border border-orange-200">
                          <div className="text-2xl">{item.icon}</div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                            <p className="text-gray-700 text-sm">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Data Security */}
                <section id="data-security" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Lock size={20} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('5. Data Security')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('We implement appropriate technical and organizational security measures to protect your information, including:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {[
                        "Encryption of data in transit and at rest",
                        "Regular security assessments and updates",
                        "Access controls and authentication measures",
                        "Secure data centers and infrastructure",
                        "Employee training on data protection",
                        "Incident response and breach notification procedures"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-red-50 p-3 rounded-lg border border-red-200">
                          <div className="bg-red-100 p-1 rounded-full mt-1">
                            <Lock size={16} className="text-red-600" />
                          </div>
                          <span className="text-gray-700 text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">
                        However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security of your information.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Data Retention */}
                <section id="data-retention" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-gray-100 p-2 rounded-lg">
                      <Clock size={20} className="text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('6. Data Retention')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('We retain your information for as long as necessary to:')}
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Provide our services to you",
                        "Comply with legal obligations",
                        "Resolve disputes and enforce agreements",
                        "Improve our services"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-gray-100 p-1 rounded-full mt-1">
                            <Clock size={16} className="text-gray-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800">
                        When you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal or regulatory purposes.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Your Rights and Choices */}
                <section id="your-rights" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('7. Your Rights and Choices')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('You have the following rights regarding your personal information:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { title: "Access", desc: "Request access to your personal information", icon: "👁️" },
                        { title: "Correction", desc: "Request correction of inaccurate information", icon: "✏️" },
                        { title: "Deletion", desc: "Request deletion of your personal information", icon: "🗑️" },
                        { title: "Portability", desc: "Request a copy of your data in a portable format", icon: "📁" },
                        { title: "Restriction", desc: "Request restriction of processing", icon: "⏸️" },
                        { title: "Objection", desc: "Object to processing of your information", icon: "🚫" },
                        { title: "Withdrawal", desc: "Withdraw consent for marketing communications", icon: "↩️" }
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                          <div className="text-xl">{item.icon}</div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                            <p className="text-gray-700 text-xs">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800">
                        {tt('To exercise these rights, please contact us using the information provided below.')}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Cookies and Tracking Technologies */}
                <section id="cookies" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Eye size={20} className="text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('8. Cookies and Tracking Technologies')}</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      {tt('We use cookies and similar tracking technologies to:')}
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Remember your preferences and settings",
                        "Analyze how you use our Service",
                        "Provide personalized content and features",
                        "Improve our Service performance and security"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-purple-100 p-1 rounded-full mt-1">
                            <Eye size={16} className="text-purple-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-purple-800">
                        {tt('You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of our Service.')}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Third-Party Services */}
                <section id="third-party" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Globe size={20} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('9. Third-Party Services')}</h2>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      Our Service may contain links to third-party websites or integrate with third-party services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
                    </p>
                  </div>
                </section>

                {/* Children's Privacy */}
                <section id="children-privacy" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-pink-100 p-2 rounded-lg">
                      <Users size={20} className="text-pink-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt("10. Children's Privacy")}</h2>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      Our Service is not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If you believe we have collected information from a child under 18, please contact us immediately.
                    </p>
                  </div>
                </section>

                {/* International Data Transfers */}
                <section id="international-transfers" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Globe size={20} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('11. International Data Transfers')}</h2>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards to protect your information.
                    </p>
                  </div>
                </section>

                {/* Changes to This Policy */}
                <section id="changes" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-yellow-100 p-2 rounded-lg">
                      <FileText size={20} className="text-yellow-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('12. Changes to This Policy')}</h2>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this policy periodically.
                    </p>
                  </div>
                </section>

                {/* Contact Information */}
                <section id="contact" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Mail size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{tt('13. Contact Information')}</h2>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                    <p className="text-gray-700 mb-4">
                      {tt('If you have any questions about this Privacy Policy or our data practices, please contact us:')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Mail size={16} className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tt('Email')}</p>
                          <p className="text-gray-700 text-sm">{tt('insightinnovationsltd@gmail.com')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <MapPin size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tt('Address')}</p>
                          <p className="text-gray-700 text-sm">{tt('InsightBooks, Malawi')}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Shield size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tt('Data Protection Officer')}</p>
                          <p className="text-gray-700 text-sm">{tt('Available upon request')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t p-8">
                <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                  <p className="text-sm text-gray-600">
                    © InsightBooks 2025. All rights reserved.
                  </p>
                  <div className="flex space-x-6">
                    <Link href="/terms" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      {tt('Terms of Service')}
                    </Link>
                    <Link href="/contact" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      {tt('Contact Us')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 