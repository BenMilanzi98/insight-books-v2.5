"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { clearUserCache } from "@/lib/permissions";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";

// Component that safely uses search params
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const requestedRedirect = searchParams.get('redirect');
  const signupSuccess = searchParams.get('signup') === 'success';
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantChoices, setTenantChoices] = useState([]);
  const [showBusinessChoice, setShowBusinessChoice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    signupSuccess ? "" : ""
  );

  useEffect(() => {
    if (signupSuccess) {
      setSuccessMessage(t('authentication.accountCreated'));
    }
  }, [signupSuccess, t]);

  useEffect(() => {
    // Clear success message after 5 seconds
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 409 && data.code === "MULTI_TENANT_EMAIL") {
          const tenants = Array.isArray(data.tenants) ? data.tenants : [];
          setTenantChoices(tenants);
          setSelectedTenantId(tenants[0]?.id || "");
          setShowBusinessChoice(true);
          setError(data.error || "Choose the business you want to access, then try again.");
          setIsLoading(false);
          return;
        }
        if (data.requiresVerification && data.email) {
          const q = new URLSearchParams({
            email: data.email,
            from: "login",
          });
          router.push(`/auth/verify-email?${q.toString()}`);
          return;
        }
        throw new Error(data.error || "Authentication failed");
      }

      const defaultPath = data.defaultPostLoginPath || '/dashboard';
      const isGenericDashboard =
        !requestedRedirect ||
        requestedRedirect === '/dashboard' ||
        requestedRedirect === '/';
      const nextPath =
        isGenericDashboard ? defaultPath : requestedRedirect;
      clearUserCache();
      router.push(nextPath);
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    setTenantChoices([]);
    setSelectedTenantId("");
    setShowBusinessChoice(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-blue-950 text-slate-900">
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
        <section className="hidden flex-col justify-between p-8 text-white xl:flex xl:p-10">
          <div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 shadow-2xl shadow-indigo-950/20 backdrop-blur">
              <img src="/logo.png" alt={tt('InsightBooks Logo')} className="h-9 w-auto rounded-lg object-contain" />
            </div>

            <div className="mt-16 max-w-xl">
              <p className="mb-4 inline-flex rounded-full border border-sky-400/20 bg-blue-950/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-100 backdrop-blur">
                {tt('Future-ready business OS')}
              </p>
              <h1 className="text-4xl font-black leading-tight tracking-tight">
                {tt('Control finance, stock, sales, and payroll from one intelligent workspace.')}
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200">
                {tt('A compact, secure command center for daily operations, reporting, and team workflows.')}
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
                <p className="mt-1 text-xs text-slate-300">{tt(label)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-start justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-6 lg:px-8">
          <div className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-center xl:hidden">
              <div className="rounded-2xl bg-white/95 p-2.5 shadow-xl">
                <img src="/logo.png" alt={tt('InsightBooks Logo')} className="h-8 w-auto object-contain sm:h-9" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-blue-950/50 backdrop-blur-xl sm:p-6 lg:p-7">
              <div className="mb-4 flex justify-end">
                <LanguageSwitcher />
              </div>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">{t('authentication.welcomeBack')}</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    {t('authentication.login')}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {t('authentication.signInToContinue')}
                  </p>
                </div>
                <Link href="/auth/signup" className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">
                  {t('authentication.createAccount')}
                </Link>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
                <div className="grid grid-cols-2 text-center text-sm font-semibold">
                  <span className="rounded-xl bg-blue-950 px-3 py-2 text-white shadow-sm">{t('authentication.login')}</span>
                  <Link href="/auth/signup" className="rounded-xl px-3 py-2 text-slate-500 hover:text-slate-900">
                    {t('authentication.createAccount')}
                  </Link>
                </div>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {showBusinessChoice && tenantChoices.length > 0 && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-950">
                    <p className="font-semibold">{tt('Choose your business')}</p>
                    <p className="mt-1 text-indigo-900/75">
                      {tt('Your email is linked to more than one business. Select where you want to log in.')}
                    </p>
                    <fieldset className="mt-4 space-y-2">
                      <legend className="sr-only">{tt('Business')}</legend>
                      {tenantChoices.map((tenant) => (
                        <label
                          key={tenant.id}
                          htmlFor={`tenant-${tenant.id}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                            selectedTenantId === tenant.id
                              ? "border-indigo-500 bg-white shadow-sm"
                              : "border-indigo-100 bg-white/40 hover:bg-white"
                          }`}
                        >
                          <input
                            id={`tenant-${tenant.id}`}
                            type="radio"
                            name="tenantId"
                            value={tenant.id}
                            checked={selectedTenantId === tenant.id}
                            onChange={() => setSelectedTenantId(tenant.id)}
                            className="h-4 w-4 border-slate-300 text-indigo-700 focus:ring-indigo-500"
                            required
                          />
                          <span className="font-semibold text-slate-900">{tenant.name || "Business"}</span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                )}

                {showBusinessChoice && tenantChoices.length === 0 && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-950">
                    <p className="font-semibold">{tt('Choose your business')}</p>
                    <p className="mt-1 text-indigo-900/75">
                      {tt('Enter your password and continue. If this email belongs to multiple businesses, we will show them here for selection.')}
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('authentication.email')}
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      placeholder={tt('you@company.com')}
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                      {t('authentication.password')}
                    </label>
                    <Link href="/auth/forgot-password" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                      {t('authentication.forgotPassword')}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      placeholder={tt('Enter your password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      onClick={togglePasswordVisibility}
                      aria-label={showPassword ? t('accessibility.hidePassword') : t('accessibility.showPassword')}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                    />
                    {t('authentication.rememberMe')}
                  </label>
                </div>

                <button
                  type="submit"
                  className="group flex w-full items-center justify-center rounded-xl bg-blue-600 p-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-950/25 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                  disabled={isLoading}
                >
                  {isLoading ? t('common.loading.pleaseWait') : t('authentication.login')}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                New to InsightBooks?{" "}
                <Link href="/auth/signup" className="font-bold text-indigo-700 hover:text-indigo-900">
                  {tt('Create Account')}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
const Login = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">{tt('Loading...')}</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
};

export default Login;