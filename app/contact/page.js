"use client";

import { Suspense, useState } from "react";
import Link from "next/link";

// Demo Request Form Component
function DemoRequestForm() {
  const [formData, setFormData] = useState({
    businessName: '',
    clientName: '',
    email: '',
    phone: '',
    dateTime: '',
    body: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Helper functions for date/time picker
  const getMinDateTime = () => {
    const now = new Date();
    // Set minimum to tomorrow at 8 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    const maxDate = new Date();
    // Set maximum to 30 days from now
    maxDate.setDate(maxDate.getDate() + 30);
    maxDate.setHours(18, 0, 0, 0);
    return maxDate.toISOString().slice(0, 16);
  };

  const getQuickTimeSuggestions = () => {
    const suggestions = [];
    const now = new Date();

    // Next 5 business days
    for (let i = 1; i <= 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Morning slot (9 AM)
      const morning = new Date(date);
      morning.setHours(9, 0, 0, 0);

      // Afternoon slot (2 PM)
      const afternoon = new Date(date);
      afternoon.setHours(14, 0, 0, 0);

      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      suggestions.push({
        label: `${dayName} ${dateStr} 9:00 AM`,
        value: morning.toISOString().slice(0, 16)
      });

      suggestions.push({
        label: `${dayName} ${dateStr} 2:00 PM`,
        value: afternoon.toISOString().slice(0, 16)
      });

      if (suggestions.length >= 6) break; // Limit to 6 suggestions
    }

    return suggestions;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/contact/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitMessage('Demo request submitted successfully! We will contact you soon.');
        setFormData({
          businessName: '',
          clientName: '',
          email: '',
          phone: '',
          dateTime: '',
          body: ''
        });
      } else {
        setSubmitMessage(data.error || 'Failed to submit demo request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitMessage('Failed to submit demo request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-16">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
          Request a Demo
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Experience InsightBooks in action. Fill out the form below and we'll schedule a personalized demo tailored to your business needs.
        </p>
      </div>

      {/* Form Container */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-3xl transform rotate-1"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-3xl transform -rotate-1"></div>

        {/* Form Card */}
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Business Information Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Business Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 flex items-center">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                    Business Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 text-gray-800 placeholder-gray-400"
                      placeholder="Enter your business name"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                      🏢
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="clientName" className="block text-sm font-semibold text-gray-700 flex items-center">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                    Your Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="clientName"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 text-gray-800 placeholder-gray-400"
                      placeholder="Enter your full name"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                      👤
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📞</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">Contact Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Email Address *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 text-gray-800 placeholder-gray-400"
                      placeholder="your@email.com"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                      ✉️
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Phone Number *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 text-gray-800 placeholder-gray-400"
                      placeholder="+265 XXX XXX XXX"
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                      📱
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Scheduling Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📅</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">Demo Scheduling</h3>
              </div>

              <div className="space-y-4">
                <label htmlFor="dateTime" className="block text-sm font-semibold text-gray-700 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Preferred Demo Date & Time
                </label>

                <div className="relative">
                  <input
                    type="datetime-local"
                    id="dateTime"
                    name="dateTime"
                    value={formData.dateTime}
                    onChange={handleInputChange}
                    min={getMinDateTime()}
                    max={getMaxDateTime()}
                    className="w-full px-4 py-4 pl-12 pr-12 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 text-gray-800 bg-white"
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    📅
                  </div>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    🕒
                  </div>
                </div>

                {/* Date & Time Info */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-white text-xs">ℹ️</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-purple-800 mb-2">Demo Scheduling Info</h4>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li>• Business hours: Monday-Friday 8AM-6PM, Saturday 9AM-2PM</li>
                        <li>• Demos typically last 30-60 minutes</li>
                        <li>• We'll confirm your preferred time within 24 hours</li>
                        <li>• Time zone: Malawi Standard Time (CAT)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Quick Time Suggestions */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Quick suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {getQuickTimeSuggestions().map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, dateTime: suggestion.value }))}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Needs Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">💡</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">Business Needs</h3>
              </div>

              <div className="space-y-2">
                <label htmlFor="body" className="block text-sm font-semibold text-gray-700 flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  Tell us about your business needs *
                </label>
                <div className="relative">
                  <textarea
                    id="body"
                    name="body"
                    value={formData.body}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all duration-200 text-gray-800 placeholder-gray-400 resize-vertical"
                    placeholder="Please describe your business, current challenges, and what you're looking to achieve with InsightBooks. For example: 'We run a retail business with 50+ employees and need better Stock Management and invoicing solutions.'"
                  />
                  <div className="absolute left-4 top-4 text-gray-400">
                    💭
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Message */}
            {submitMessage && (
              <div className={`p-6 rounded-xl border-2 ${
                submitMessage.includes('successfully')
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {submitMessage.includes('successfully') ? '✅' : '❌'}
                  </span>
                  <p className="font-medium">{submitMessage}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="text-center pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-12 py-4 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transform hover:scale-105 shadow-xl hover:shadow-2xl"
              >
                <span className="relative z-10 flex items-center justify-center space-x-3">
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Request Demo</span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ContactContent() {
  const whatsappNumber = "265894092494"; // Replace with your number

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Branding Section (Same as Login) */}
      <div className="hidden md:flex md:w-1/2 bg-indigo-800 text-white p-8 flex-col justify-between">
        <div>
          {/* <div className="flex items-center mb-8">
            <div className="h-10 w-10 rounded-md bg-white text-blue-800 flex items-center justify-center font-bold text-xl mr-3">
              IB
            </div>
            <h1 className="text-2xl font-bold">InsightBooks</h1>
          </div> */}
          <div className="flex items-center">
            <img
            src="/logo.png"
            alt="InsightBooks Logo"
            className="h-10 w-auto object-contain rounded-md"
            />
          </div>
          <div className="max-w-md mt-6">
            <h2 className="text-3xl font-bold mb-6">Need help with InsightBooks?</h2>
            <p className="mb-4">
              Our team is ready to assist you with anything — billing, onboarding, or product questions.
            </p>
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Quick response via WhatsApp</span>
              </div>
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Support in English</span>
              </div>
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Human assistance, not bots</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm opacity-80">
          © {new Date().getFullYear()} InsightBooks. All rights reserved.
        </div>
      </div>

      {/* Demo Request Form and Contact Section */}
      <div className="w-full md:w-1/2 p-6">
        {/* Demo Request Form */}
        <DemoRequestForm />

        {/* Contact Us Section */}
        <div className="w-full max-w-lg mx-auto mt-16">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-xl text-gray-600 max-w-md mx-auto leading-relaxed">
              Have questions or need immediate assistance? We're here to help!
            </p>
          </div>

          {/* Contact Options */}
          <div className="space-y-6">
            {/* WhatsApp Contact */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 rounded-2xl transform rotate-1 opacity-20 group-hover:rotate-2 transition-transform duration-300"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100 group-hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">💬</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">WhatsApp Chat</h3>
                    <p className="text-gray-600">Instant response • Available 24/7</p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/btn w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                >
                  <span className="text-xl">📱</span>
                  <span>Start WhatsApp Chat</span>
                  <span className="text-xl group-hover/btn:translate-x-1 transition-transform duration-200">→</span>
                </a>
              </div>
            </div>

            {/* Alternative Contact Methods */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-8 border border-gray-100">
              <div className="space-y-4">
                {/* Email Contact */}
                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">✉️</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Email Support</p>
                      <p className="text-sm text-gray-600">Response within 24 hours</p>
                    </div>
                  </div>
                  <a
                    href="mailto:insightinnovationsltd@gmail.com"
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors duration-200"
                  >
                    Send Email →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-12">
            <Link
              href="/"
              className="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 font-medium hover:underline transition-colors duration-200"
            >
              <span>←</span>
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const ContactPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <ContactContent />
    </Suspense>
  );
};

export default ContactPage;
