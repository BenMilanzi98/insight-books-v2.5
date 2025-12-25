"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";

// Component that safely uses search params
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const signupSuccess = searchParams.get('signup') === 'success';
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    signupSuccess ? "Account created successfully! Please sign in." : ""
  );

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
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          password
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      
      // If remember me is checked, we could set a longer cookie expiry
      // But we're handling this on the server side
      
      // Redirect to the dashboard or the original requested URL
      router.push(redirectUrl);
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Branding Section */}
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
            <h2 className="text-3xl font-bold mb-6">Welcome to your complete business management solution</h2>
            <p className="mb-4">
              Streamline your invoicing, expenses, financial reporting, and more with our powerful multi-tenant platform.
            </p>
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Secure multi-tenant architecture</span>
              </div>
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Comprehensive financial management</span>
              </div>
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center mr-3">✓</div>
                <span>Inventory, HR, and POS integration</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm opacity-80">
          © InsightBooks {new Date().getFullYear()}. All rights reserved.
        </div>
      </div>

      {/* Login Form Section */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-800">Login to your account</h2>
            <p className="text-gray-600 mt-2">Enter your credentials to access your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
              <AlertCircle size={18} className="mr-2" />
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-700">
              <CheckCircle size={18} className="mr-2" />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label htmlFor="password" className="block text-gray-700 font-medium">
                  Password
                </label>
                <Link href="/auth/forgot-password" className="text-sm text-indigo-700 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-600">
                  Remember me
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-700 text-white p-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <GoogleOAuthButton mode="login" />
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="text-indigo-700 font-medium hover:underline">
                Create Account
              </Link>
            </p>
          </div> */}
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
const Login = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
};

export default Login;