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
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.35),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(20,184,166,0.18),_transparent_38%)]" />
      <div className="absolute -left-24 top-32 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 grid min-h-screen xl:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden flex-col justify-between p-10 text-white xl:flex xl:p-14">
          <div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-2xl backdrop-blur">
              <img src="/logo.png" alt="InsightBooks" className="h-10 w-auto rounded-lg object-contain" />
              <div>
                <p className="text-sm font-bold">InsightBooks</p>
                <p className="text-xs text-indigo-100">Start, scale, and stay in control</p>
              </div>
            </div>

            <div className="mt-24 max-w-xl">
              <p className="mb-5 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                Free 2-day trial. No card required.
              </p>
              <h1 className="text-5xl font-black leading-tight tracking-tight">
                Build your business workspace in minutes.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-200">
                Create invoices, track stock, manage POS, run payroll, and see your numbers clearly from day one.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              [Clock, "2-Day Free Trial", "Full access for 48 hours"],
              [Shield, "Secure by Design", "Private tenant workspace"],
              [Calendar, "Flexible Plans", "Choose monthly or yearly later"],
            ].map(([Icon, title, text]) => (
              <div key={title} className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-3xl">
            <div className="mb-6 flex justify-center xl:hidden">
              <div className="rounded-2xl bg-white/95 p-3 shadow-xl">
                <img src="/logo.png" alt="InsightBooks" className="h-9 w-auto object-contain" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-xl sm:p-8 lg:p-10">
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">Create account</p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Start your free trial
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Register with your business details. Your email verification flow remains the same.
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                  48 hours free
                </div>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <Check size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="+265 999 123 456"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 pr-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
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
                                  : "bg-emerald-500"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 pl-12 text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="Repeat password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                {referralSuccess && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <Check size={16} className="mt-0.5 flex-shrink-0" />
                    <span>Referral code <strong>{formData.referralCode}</strong> applied!</span>
                  </div>
                )}

                <label htmlFor="agreeTerms" className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
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
                    className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
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
                    className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 font-bold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <Calendar size={18} />
                    Book a Demo
                  </a>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center">
                  <p className="text-sm text-indigo-800">
                    <Clock size={14} className="mr-1 inline -mt-0.5" />
                    Your <strong>free 2-day trial</strong> starts immediately. No payment required.
                  </p>
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <Link href="/auth/login" className="font-bold text-indigo-700 hover:text-indigo-900">Sign in</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Signup;
