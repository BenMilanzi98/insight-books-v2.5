"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      router.replace("/auth/signup");
    }
  }, [email, router]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          setError("Code expired. Please request a new one.");
        } else if (data.alreadyVerified) {
          router.push("/auth/login");
          return;
        } else {
          setError(data.error || "Verification failed");
        }
        return;
      }

      setSuccess("Email verified! Redirecting to your dashboard...");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyVerified) {
          router.push("/auth/login");
          return;
        }
        setError(data.error || "Could not resend code");
        return;
      }
      setSuccess("A new verification code has been sent. Check your inbox and spam folder.");
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("Could not resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.every((d) => d !== "") && !isVerifying) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (!email) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left branding panel */}
      <div className="hidden md:flex md:w-2/5 bg-gradient-to-br from-indigo-800 via-indigo-700 to-indigo-900 text-white p-10 flex-col justify-between">
        <div>
          <img
            src="/logo.png"
            alt="InsightBooks"
            className="h-10 w-auto object-contain rounded-md"
          />
          <div className="mt-10 max-w-sm">
            <h2 className="text-3xl font-bold mb-4">Almost there!</h2>
            <p className="text-indigo-200 mb-10">
              We sent a 6-digit verification code to your email. Check your inbox and spam
              folder, then enter the code to activate your 2-day free trial.
            </p>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/50 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Secure Verification</h3>
                  <p className="text-sm text-indigo-200">
                    The code expires in 10 minutes and can only be used once
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/50 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Instant Access</h3>
                  <p className="text-sm text-indigo-200">
                    Once verified you'll be logged in immediately
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-indigo-300 text-xs">&copy; {new Date().getFullYear()} InsightBooks Africa</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-gray-50">
        <div className="w-full max-w-md">
          <Link
            href="/auth/signup"
            className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-8"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to sign up
          </Link>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
              <p className="text-gray-500 mt-2">
                We sent a code to <span className="font-medium text-gray-700">{email}</span>.
                Check your inbox and spam folder.
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              ))}
            </div>

            <button
              onClick={handleVerify}
              disabled={isVerifying || otp.join("").length < 6}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors"
            >
              {isVerifying ? "Verifying..." : "Verify Email"}
            </button>

            <div className="mt-6 text-center text-sm text-gray-500">
              Didn&apos;t receive the code?{" "}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="text-indigo-600 font-medium hover:text-indigo-800 disabled:text-gray-400 inline-flex items-center gap-1"
              >
                <RefreshCw size={14} className={isResending ? "animate-spin" : ""} />
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : isResending
                    ? "Sending..."
                    : "Resend Code"}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              Code expires in 10 minutes. Check your spam folder if you don&apos;t see the email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

