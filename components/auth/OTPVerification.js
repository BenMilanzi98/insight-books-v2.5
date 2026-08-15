"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Mail } from "lucide-react";

const OTPVerification = ({ email, userId, onBackToSignIn }) => {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  // Start countdown for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    // Allow only digits
    if (!/^\d*$/.test(value)) return;

    // Only keep the last character (in case multiple characters are pasted)
    const digit = value.slice(-1);

    // Update OTP state - ensure we're working with an array
    const currentOtp = Array.isArray(otp) ? otp : ["", "", "", "", "", ""];
    const newOtp = [...currentOtp];
    newOtp[index] = digit;
    setOtp(newOtp);

    console.log("Current OTP state:", newOtp, "Full OTP:", newOtp.join(""));

    // Clear error and success when user types
    if (error) setError("");
    if (success) setSuccess("");

    // Auto-focus next input if a digit was entered
    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-submit when all digits are filled
    if (digit && index === 5 && newOtp.every(d => d)) {
      // Small delay to ensure state is updated, then verify with the new OTP
      setTimeout(() => {
        handleVerify(newOtp);
      }, 100);
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // If current input is empty, focus on previous input
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    
    // Check if pasted data is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      
      console.log("Pasted OTP:", newOtp, "Full:", newOtp.join(""));
      
      // Clear error and success when user pastes
      if (error) setError("");
      if (success) setSuccess("");
      
      // Focus on last input
      if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
      
      // Auto-verify after paste
      setTimeout(() => {
        handleVerify(newOtp);
      }, 100);
    }
  };

  const handleVerify = async (otpValue = null) => {
    setLoading(true);
    setError("");

    try {
      // Use provided OTP value or current state, normalize to ensure it's a clean string
      let otpString = "";
      
      if (otpValue) {
        // If a value is passed, use it
        if (Array.isArray(otpValue)) {
          otpString = otpValue.join("").trim();
        } else if (typeof otpValue === "string") {
          otpString = otpValue.trim();
        } else {
          otpString = String(otpValue).trim();
        }
      } else {
        // Use current state - ensure it's an array
        const currentOtp = Array.isArray(otp) ? otp : [];
        otpString = currentOtp.join("").trim();
      }
      
      console.log("OTP to verify:", otpString, "Length:", otpString.length, "Type:", typeof otpString);
      
      // Validate OTP format
      if (!/^\d{6}$/.test(otpString)) {
        setError("Please enter a valid 6-digit verification code");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp: otpString, // Send normalized OTP
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.expired) {
          setError("Verification code has expired. Please request a new one.");
        } else if (data.alreadyVerified) {
          // Already verified - go to dashboard
          router.push("/dashboard");
          return;
        } else {
          setError(data.error || "Failed to verify. Please try again.");
        }
        setLoading(false);
        return;
      }

      // On success, redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Verification error:", error);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    
    setResendLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.alreadyVerified) {
          // Already verified - go to dashboard
          router.push("/dashboard");
          return;
        } else {
          setError(data.error || "Failed to resend code. Please try again.");
        }
        setResendLoading(false);
        return;
      }

      // Success - show success message
      setSuccess("New verification code sent! Check your inbox and spam folder.");
      setError(""); // Clear any previous errors
      
      // Reset countdown
      setCanResend(false);
      setResendCountdown(60);
      setResendLoading(false);
      
      // Clear OTP fields
      setOtp(["", "", "", "", "", ""]);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess("");
      }, 5000);
    } catch (error) {
      console.error("Resend error:", error);
      setError("An error occurred. Please try again.");
      setResendLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{tt('Verify Your Email')}</h2>
        <p className="text-gray-600">
          {tt("We've sent a 6-digit verification code to")} <span className="font-semibold">{email}</span>
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {tt('Check your inbox and spam folder. The code expires in 10 minutes.')}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tt('Enter the 6-digit code')}
          </label>
          <div className="flex gap-2 justify-center">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={loading || !otp.every(digit => digit)}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Didn't receive the code?
          </p>
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={!canResend || resendLoading}
            className="text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resendLoading ? "Sending..." : canResend ? "Resend Code" : `Resend in ${resendCountdown}s`}
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="text-gray-600 hover:text-gray-700 font-medium transition-colors"
          >
            ← Back to Sign In
          </button>
        </div>
      </form>
    </div>
  );
};

export default OTPVerification;