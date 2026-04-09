"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Shield,
  Clock,
  ArrowRight,
  Calendar,
} from "lucide-react";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { clearUserCache } from "@/lib/permissions";

const Signup = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    businessName: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    referralCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: "Enter a password",
  });
  const [referralSuccess, setReferralSuccess] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get("error");
    const oauthDetails = urlParams.get("details");
    const referralCode = urlParams.get("ref");

    if (referralCode) {
      setFormData((prev) => ({ ...prev, referralCode }));
      setReferralSuccess(true);
    }

    if (oauthError) {
      const messages = {
        oauth_config_missing: "Google OAuth is not properly configured. Please contact support.",
        oauth_init_failed: "Failed to start Google sign-in. Please try again.",
        oauth_no_code: "Google sign-in was cancelled or failed. Please try again.",
        oauth_callback_failed: "Google sign-in failed. Please try again.",
        oauth_denied: "Google sign-in was denied. Please try again.",
        signup_failed: "Failed to create account. Please try again.",
      };
      let msg = messages[oauthError] || "An error occurred during Google sign-in. Please try again.";
      if (oauthDetails) msg += ` (${oauthDetails})`;
      setError(msg);

      const newUrl = new URL(window.location);
      newUrl.searchParams.delete("error");
      newUrl.searchParams.delete("details");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ score: 0, feedback: "Enter a password" });
      return;
    }
    let score = 0;
    if (formData.password.length >= 12) score += 2;
    else if (formData.password.length >= 8) score += 1;
    if (/[A-Z]/.test(formData.password)) score += 1;
    if (/[a-z]/.test(formData.password)) score += 1;
    if (/[0-9]/.test(formData.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(formData.password)) score += 1;

    const feedback =
      score < 2 ? "Weak password"
      : score < 4 ? "Medium strength"
      : score < 6 ? "Strong password"
      : "Very strong password";
    setPasswordStrength({ score, feedback });
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.businessName || !formData.fullName || !formData.email || !formData.phone) {
      setError("Please fill in all required fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (passwordStrength.score < 3) {
      setError("Please choose a stronger password");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!formData.agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          referralCode: formData.referralCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create account");

      clearUserCache();

      // Redirect to OTP verification page
      if (data.requiresVerification) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left branding panel */}
      <div className="hidden md:flex md:w-2/5 bg-gradient-to-br from-indigo-800 via-indigo-700 to-indigo-900 text-white p-10 flex-col justify-between">
        <div>
          <img src="/logo.png" alt="InsightBooks" className="h-10 w-auto object-contain rounded-md" />
          <div className="mt-10 max-w-sm">
            <h2 className="text-3xl font-bold mb-4">
              Start your free trial today
            </h2>
            <p className="text-indigo-200 mb-10">
              Get full access to InsightBooks for 48 hours — no credit card required.
              Explore every feature before you subscribe.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/50 flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">2-Day Free Trial</h3>
                  <p className="text-sm text-indigo-200">Full access to all features for 48 hours</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/50 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">No Card Required</h3>
                  <p className="text-sm text-indigo-200">Start instantly, pay only when you are ready</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/50 flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="font-semibold">Flexible Plans</h3>
                  <p className="text-sm text-indigo-200">Choose monthly or yearly after your trial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm opacity-70">© {new Date().getFullYear()} InsightBooks. All rights reserved.</div>
      </div>

      {/* Right form panel */}
      <div className="w-full md:w-3/5 p-6 md:p-10 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-lg">
          {/* Mobile header */}
          <div className="md:hidden mb-6 text-center">
            <img src="/logo.png" alt="InsightBooks" className="h-8 mx-auto mb-3" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-gray-500 mt-1">
              Register to start your <span className="font-semibold text-indigo-600">free 2-day trial</span>
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-sm text-green-700">
              <Check size={18} className="flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Google OAuth */}
          <div className="mb-6">
            <GoogleOAuthButton mode="signup" onError={(err) => setError(err)} />
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-gray-50 text-gray-500">Or register with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <div className="relative">
                <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="businessName" name="businessName" type="text" required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Your Company Ltd." value={formData.businessName} onChange={handleChange} />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="fullName" name="fullName" type="text" required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="John Doe" value={formData.fullName} onChange={handleChange} />
              </div>
            </div>

            {/* Email & Phone side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="email" name="email" type="email" required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="you@company.com" value={formData.email} onChange={handleChange} />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="phone" name="phone" type="tel" required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+265 999 123 456" value={formData.phone} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Password & Confirm side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="password" name="password" type={showPassword ? "text" : "password"} required minLength={8}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Min. 8 characters" value={formData.password} onChange={handleChange} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-1.5">
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${
                        passwordStrength.score < 2 ? "bg-red-500" : passwordStrength.score < 4 ? "bg-yellow-500" : "bg-green-500"
                      }`} style={{ width: `${Math.min(100, (passwordStrength.score / 6) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{passwordStrength.feedback}</p>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange} />
                </div>
              </div>
            </div>

            {referralSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-sm text-green-700">
                <Check size={16} className="flex-shrink-0 mt-0.5" />
                <span>Referral code <strong>{formData.referralCode}</strong> applied!</span>
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-2">
              <input id="agreeTerms" name="agreeTerms" type="checkbox" required
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={formData.agreeTerms} onChange={handleChange} />
              <label htmlFor="agreeTerms" className="text-sm text-gray-600">
                I agree to the{" "}
                <Link href="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>{" "}and{" "}
                <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>
              </label>
            </div>

            {/* Action buttons: Register (primary) then Book a Demo (secondary) */}
            <div className="pt-2 space-y-3">
              <button type="submit" disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating account...
                  </>
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <a href="https://calendly.com/insightbooks/demo" target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-indigo-200 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">
                <Calendar size={18} />
                Book a Demo
              </a>
            </div>

            {/* Trial info */}
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4 text-center">
              <p className="text-sm text-indigo-800">
                <Clock size={14} className="inline mr-1 -mt-0.5" />
                Your <strong>free 2-day trial</strong> starts immediately. No payment required.
                After 48 hours, choose a plan to continue.
              </p>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
