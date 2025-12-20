"use client";

import { Suspense } from "react";
import Link from "next/link";

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

      {/* WhatsApp Contact Section */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center md:text-left mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Contact Us</h2>
            <p className="text-gray-600 mt-2">
              Have a question? Tap the button below to chat with us instantly on WhatsApp.
            </p>
          </div>

          <div className="flex justify-center">
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center w-full bg-indigo-700 text-white p-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              💬 Chat on WhatsApp
            </a>
          </div>

          <div className="mt-10 text-center text-gray-500 text-sm">
            Prefer email? Contact us at{" "}
            <a
              href="mailto:insightinnovationsltd@gmail.com"
              className="text-indigo-700 hover:underline"
            >
              insightinnovationsltd@gmail.com
            </a>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Back to{" "}
              <Link href="/" className="text-indigo-700 font-medium hover:underline">
                Home
              </Link>
            </p>
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
