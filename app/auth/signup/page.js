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
    const referralCode = urlParams.get("ref");

    if (referralCode) {
      setFormData((prev) => ({ ...prev, referralCode }));
      setReferralSuccess(true);
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
        const verifyParams = new URLSearchParams({ email: data.email });
        if (data.tenant?.id) verifyParams.set("tenantId", data.tenant.id);
        if (data.tenant?.subdomain) verifyParams.set("subdomain", data.tenant.subdomain);
        if (data.emailSent === false) {
          verifyParams.set("delivery", "failed");
        }
        router.push(`/auth/verify-email?${verifyParams.toString()}`);
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
    <div className="relative min-h-screen overflow-hidden bg-blue-950">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950 via-indigo-950 to-blue-950" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% -28%, rgba(67, 56, 202, 0.45), transparent 52%), radial-gradient(ellipse 55% 45% at 100% 45%, rgba(29, 78, 216, 0.3), transparent), radial-gradient(ellipse 40% 40% at 0% 80%, rgba(30, 58, 138, 0.35), transparent)',
        }}
      />
      <div className="absolute top-20 left-1/4 hidden h-[min(420px,55vw)] w-[min(420px,55vw)] rounded-full bg-indigo-600/20 blur-[100px] sm:block" />
      <div className="absolute bottom-10 right-0 hidden h-[min(380px,50vw)] w-[min(380px,50vw)] rounded-full bg-blue-600/25 blur-[90px] sm:block" />

      <div className="relative z-10 grid min-h-screen xl:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden flex-col justify-between p-8 text-white xl:flex xl:p-10">
          <div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 shadow-2xl backdrop-blur">
              <img src="/logo.png" alt="InsightBooks" className="h-9 w-auto rounded-lg object-contain" />
            </div>

            <div className="mt-16 max-w-xl">
              <p className="mb-4 inline-flex rounded-full border border-sky-400/20 bg-blue-950/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-100 backdrop-blur">
                Future-ready business OS
              </p>
              <h1 className="text-4xl font-black leading-tight tracking-tight">
                Control finance, stock, sales, and payroll from one intelligent workspace.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200">
                A compact, secure command center for daily operations, reporting, and team workflows.
              </p>
            </div>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              ["48h", "Trial access"],
              ["360°", "Visibility"],
              ["Secure", "Tenant data"],
            ].map(([metric, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xl font-bold">{metric}</p>
                <p className="mt-1 text-xs text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-h-screen items-start justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-6 lg:px-8">
          <div className="w-full max-w-2xl">
            <div className="mb-4 flex justify-center xl:hidden">
              <div className="rounded-2xl bg-white/95 p-2.5 shadow-xl">
                <img src="/logo.png" alt="InsightBooks" className="h-8 w-auto object-contain sm:h-9" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-blue-950/50 backdrop-blur-xl sm:p-6 lg:p-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Create Account</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    Start your free trial
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Register with your business details.
                  </p>
                </div>
                <Link href="/auth/login" className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">
                  Login
                </Link>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
                <div className="grid grid-cols-2 text-center text-sm font-semibold">
                  <Link href="/auth/login" className="rounded-xl px-3 py-2 text-slate-500 hover:text-slate-900">
                    Login
                  </Link>
                  <span className="rounded-xl bg-blue-950 px-3 py-2 text-white shadow-sm">Create Account</span>
                </div>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <Check size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="businessName" className="mb-2 block text-sm font-semibold text-slate-700">
                      Business Name
                    </label>
                    <div className="relative">
                      <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="businessName"
                        name="businessName"
                        type="text"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="Your Company Ltd."
                        value={formData.businessName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="you@company.com"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-slate-700">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="+265 999 123 456"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="Min. 8 characters"
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {formData.password && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength.score < 2
                                ? "bg-red-500"
                                : passwordStrength.score < 4
                                  ? "bg-amber-500"
                                  : "bg-blue-600"
                            }`}
                            style={{ width: `${Math.min(100, (passwordStrength.score / 6) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{passwordStrength.feedback}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="Repeat password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                {referralSuccess && (
                  <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Check size={16} className="mt-0.5 flex-shrink-0" />
                    <span>Referral code <strong>{formData.referralCode}</strong> applied!</span>
                  </div>
                )}

                <label htmlFor="agreeTerms" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm text-slate-600">
                  <input
                    id="agreeTerms"
                    name="agreeTerms"
                    type="checkbox"
                    required
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" className="font-semibold text-indigo-700 hover:text-indigo-900">Terms of Service</Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-semibold text-indigo-700 hover:text-indigo-900">Privacy Policy</Link>
                  </span>
                </label>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-950/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating account...
                      </>
                    ) : (
                      <>
                        Start Free Trial
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  <a
                    href="https://calendly.com/insightbooks/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-6 py-3.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <Calendar size={18} />
                    Book a Demo
                  </a>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-center">
                  <p className="text-sm text-indigo-800">
                    <Clock size={14} className="mr-1 inline -mt-0.5" />
                    Your <strong>free 2-day trial</strong> starts immediately. No payment required.
                  </p>
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <Link href="/auth/login" className="font-bold text-indigo-700 hover:text-indigo-900">Login</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Signup;
