"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Shield, Users, CreditCard, Building, CheckCircle, AlertCircle, Clock, Mail, MapPin } from "lucide-react";

export default function TermsOfService() {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", title: "Introduction", icon: FileText },
    { id: "definitions", title: "Definitions", icon: Building },
    { id: "account", title: "Account Registration", icon: Users },
    { id: "acceptable-use", title: "Acceptable Use", icon: Shield },
    { id: "subscription", title: "Subscription & Payment", icon: CreditCard },
    { id: "data-privacy", title: "Data & Privacy", icon: Shield },
    { id: "intellectual-property", title: "Intellectual Property", icon: FileText },
    { id: "service-availability", title: "Service Availability", icon: Clock },
    { id: "liability", title: "Limitation of Liability", icon: AlertCircle },
    { id: "termination", title: "Termination", icon: CheckCircle },
    { id: "governing-law", title: "Governing Law", icon: Building },
    { id: "changes", title: "Changes to Terms", icon: FileText },
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
                Back to Home
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <FileText size={24} className="text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Terms of Service</h1>
                <p className="text-sm text-gray-500">Last updated: January 15, 2025</p>
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
                <FileText size={20} className="mr-2 text-indigo-600" />
                Table of Contents
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
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Terms of Service</h1>
                    <p className="text-indigo-100">Please read these terms carefully before using our service</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock size={16} />
                    <span>Last Updated: January 15, 2025</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield size={16} />
                    <span>Version 2.1</span>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {/* Introduction */}
                <section id="introduction" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <FileText size={20} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">1. Introduction</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      Welcome to <strong>InsightBooks</strong> ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of our financial management platform and services (collectively, the "Service").
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
                      <p className="text-blue-800 font-medium">
                        By accessing or using InsightBooks, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access the Service.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Definitions */}
                <section id="definitions" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Building size={20} className="text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">2. Definitions</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">"Service"</h3>
                      <p className="text-gray-700 text-sm">Refers to the InsightBooks platform, including all features, functionality, and content.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">"User," "you," or "your"</h3>
                      <p className="text-gray-700 text-sm">Refers to any individual or entity using our Service.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">"Account"</h3>
                      <p className="text-gray-700 text-sm">Refers to your registered user account on InsightBooks.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">"Content"</h3>
                      <p className="text-gray-700 text-sm">Refers to any data, information, or materials you upload, create, or generate using our Service.</p>
                    </div>
                  </div>
                </section>

                {/* Account Registration */}
                <section id="account" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Users size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">3. Account Registration</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      To use certain features of InsightBooks, you must create an account. You agree to:
                    </p>
                    <div className="space-y-3">
                      {[
                        "Provide accurate, current, and complete information during registration",
                        "Maintain and update your account information to keep it accurate and current",
                        "Maintain the security of your account credentials",
                        "Accept responsibility for all activities that occur under your account",
                        "Notify us immediately of any unauthorized use of your account"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-green-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-green-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Acceptable Use */}
                <section id="acceptable-use" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Shield size={20} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">4. Acceptable Use</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      You agree to use InsightBooks only for lawful purposes and in accordance with these Terms. You agree not to:
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <div className="space-y-3">
                        {[
                          "Use the Service for any illegal or unauthorized purpose",
                          "Violate any applicable laws or regulations",
                          "Infringe upon the rights of others",
                          "Attempt to gain unauthorized access to our systems or other users' accounts",
                          "Interfere with or disrupt the Service or servers",
                          "Upload malicious code, viruses, or other harmful content",
                          "Use the Service to store or transmit sensitive personal data without proper consent"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <div className="bg-red-100 p-1 rounded-full mt-1">
                              <AlertCircle size={16} className="text-red-600" />
                            </div>
                            <span className="text-gray-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Subscription and Payment */}
                <section id="subscription" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <CreditCard size={20} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">5. Subscription and Payment</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      InsightBooks offers various subscription plans. By subscribing, you agree to:
                    </p>
                    <div className="space-y-3 mb-6">
                      {[
                        "Pay all fees associated with your chosen plan",
                        "Provide accurate billing information",
                        "Authorize us to charge your payment method for recurring fees",
                        "Understand that fees are non-refundable except as required by law",
                        "Accept that we may change our pricing with 30 days' notice"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-blue-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-blue-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-medium">
                        <strong>Free Trial:</strong> We offer a 3-day free trial for new users. After the trial period, your account will be charged according to your selected plan.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Data and Privacy */}
                <section id="data-privacy" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <Shield size={20} className="text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">6. Data and Privacy</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms.
                    </p>
                    <p className="text-gray-700 mb-4">
                      You retain ownership of your data. We will:
                    </p>
                    <div className="space-y-3">
                      {[
                        "Process your data only as necessary to provide the Service",
                        "Implement appropriate security measures to protect your data",
                        "Not sell your personal information to third parties",
                        "Allow you to export your data upon request"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-indigo-100 p-1 rounded-full mt-1">
                            <CheckCircle size={16} className="text-indigo-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Intellectual Property */}
                <section id="intellectual-property" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-yellow-100 p-2 rounded-lg">
                      <FileText size={20} className="text-yellow-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">7. Intellectual Property</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <h3 className="font-semibold text-gray-900 mb-2">Our Rights</h3>
                      <p className="text-gray-700 text-sm">
                        InsightBooks and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-gray-900 mb-2">Your Rights</h3>
                      <p className="text-gray-700 text-sm">
                        You retain ownership of any content you create or upload to our Service. By using our Service, you grant us a limited license to store and process your content as necessary to provide the Service.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Service Availability */}
                <section id="service-availability" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-gray-100 p-2 rounded-lg">
                      <Clock size={20} className="text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">8. Service Availability</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      We strive to maintain high availability of our Service, but we do not guarantee uninterrupted access. We may:
                    </p>
                    <div className="space-y-3 mb-4">
                      {[
                        "Perform maintenance that may temporarily affect service availability",
                        "Update or modify the Service from time to time",
                        "Suspend or terminate service in case of violations of these Terms"
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
                        We will provide reasonable notice for planned maintenance and updates.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Limitation of Liability */}
                <section id="liability" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <AlertCircle size={20} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">9. Limitation of Liability</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      To the maximum extent permitted by law, InsightBooks shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <div className="space-y-3">
                        {[
                          "Loss of profits, data, or business opportunities",
                          "Service interruptions or data loss",
                          "Damages resulting from third-party actions",
                          "Any damages exceeding the amount paid for the Service in the 12 months preceding the claim"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <div className="bg-red-100 p-1 rounded-full mt-1">
                              <AlertCircle size={16} className="text-red-600" />
                            </div>
                            <span className="text-gray-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Termination */}
                <section id="termination" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">10. Termination</h2>
                  </div>
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 mb-4">
                      You may cancel your account at any time through your account settings. We may terminate or suspend your account immediately if:
                    </p>
                    <div className="space-y-3 mb-4">
                      {[
                        "You violate these Terms",
                        "You fail to pay subscription fees",
                        "We discontinue the Service"
                      ].map((item, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="bg-red-100 p-1 rounded-full mt-1">
                            <AlertCircle size={16} className="text-red-600" />
                          </div>
                          <span className="text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">
                        Upon termination, your access to the Service will cease, and we may delete your account data after 30 days.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Governing Law */}
                <section id="governing-law" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Building size={20} className="text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">11. Governing Law</h2>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      These Terms shall be governed by and construed in accordance with the laws of <strong>Malawi</strong>, without regard to its conflict of law provisions.
                    </p>
                  </div>
                </section>

                {/* Changes to Terms */}
                <section id="changes" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FileText size={20} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">12. Changes to Terms</h2>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-gray-700">
                      We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
                    </p>
                  </div>
                </section>

                {/* Contact Information */}
                <section id="contact" className="mb-12">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Mail size={20} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">13. Contact Information</h2>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                    <p className="text-gray-700 mb-4">
                      If you have any questions about these Terms of Service, please contact us:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Mail size={16} className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Email</p>
                          <p className="text-gray-700">insightinnovationsltd@gmail.com</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <MapPin size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Address</p>
                          <p className="text-gray-700">InsightBooks, Malawi</p>
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
                    © 2025 InsightBooks. All rights reserved.
                  </p>
                  <div className="flex space-x-6">
                    <Link href="/privacy" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      Privacy Policy
                    </Link>
                    <Link href="/contact" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      Contact Us
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