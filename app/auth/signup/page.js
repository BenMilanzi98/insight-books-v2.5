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
  ChevronRight, 
  Check,
  AlertCircle,
  Shield
} from "lucide-react";
import OTPVerification from "@/components/auth/OTPVerification";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

const Signup = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [planCycle, setPlanCycle] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [formData, setFormData] = useState({
    businessName: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    referralCode: "" // Add referral code field
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: "Enter a password"
  });
  
  // OTP verification states
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [userId, setUserId] = useState(null);
  const [referralSuccess, setReferralSuccess] = useState(false); // Track if referral code was detected

  // Check for OAuth errors in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');
    const oauthDetails = urlParams.get('details');
    const referralCode = urlParams.get('ref'); // Check for referral code
    
    // Handle referral code if present
    if (referralCode) {
      setFormData(prev => ({ ...prev, referralCode }));
      setReferralSuccess(true);
    }
    
    if (oauthError) {
      let errorMessage = '';
      
      switch (oauthError) {
        case 'oauth_config_missing':
          errorMessage = 'Google OAuth is not properly configured. Please contact support.';
          break;
        case 'oauth_init_failed':
          errorMessage = 'Failed to start Google sign-in. Please try again.';
          break;
        case 'oauth_no_code':
          errorMessage = 'Google sign-in was cancelled or failed. Please try again.';
          break;
        case 'oauth_callback_failed':
          errorMessage = 'Google sign-in failed. Please try again.';
          break;
        case 'oauth_denied':
          errorMessage = 'Google sign-in was denied. Please try again.';
          break;
        case 'signup_failed':
          errorMessage = 'Failed to create account. Please try again.';
          break;
        default:
          errorMessage = 'An error occurred during Google sign-in. Please try again.';
      }
      
      if (oauthDetails) {
        errorMessage += ` (${oauthDetails})`;
      }
      
      setError(errorMessage);
      
      // Clear the error from URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('error');
      newUrl.searchParams.delete('details');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Updated plans - use public plans only (no EIS)
  const plans = {
    monthly: PUBLIC_SUBSCRIPTION_PLANS.filter(plan => plan.period === 'month').map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.priceFormatted,
      period: plan.period === '3months' ? '3 months' : plan.period,
      features: plan.features,
      ...(plan.savings && { savings: plan.savings })
    })),
    annually: PUBLIC_SUBSCRIPTION_PLANS.filter(plan => plan.period === 'year').map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.priceFormatted,
      period: plan.period === '3months' ? '3 months' : plan.period,
      features: plan.features,
      ...(plan.savings && { savings: plan.savings })
    }))
  };

  // Check password strength
  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ score: 0, feedback: "Enter a password" });
      return;
    }

    // Simple password strength checker
    let score = 0;
    let feedback = "";

    // Length check
    if (formData.password.length >= 12) {
      score += 2;
    } else if (formData.password.length >= 8) {
      score += 1;
    }

    // Complexity checks
    if (/[A-Z]/.test(formData.password)) score += 1;
    if (/[a-z]/.test(formData.password)) score += 1;
    if (/[0-9]/.test(formData.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(formData.password)) score += 1;

    // Set feedback based on score
    if (score < 2) {
      feedback = "Weak password";
    } else if (score < 4) {
      feedback = "Medium strength password";
    } else if (score < 6) {
      feedback = "Strong password";
    } else {
      feedback = "Very strong password";
    }

    setPasswordStrength({ score, feedback });
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateStep1 = () => {
    if (!selectedPlan) {
      setError("Please select a plan to continue");
      return false;
    }
    setError("");
    return true;
  };

  const validateStep2 = () => {
    if (!formData.businessName || !formData.fullName || !formData.email || !formData.phone) {
      setError("Please fill in all required fields");
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    // Basic phone validation
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      setError("Please enter a valid phone number");
      return false;
    }
    setError("");
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password) {
      setError("Please enter a password");
      return false;
    }
    
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }
    
    if (passwordStrength.score < 3) {
      setError("Please choose a stronger password");
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    
    if (!formData.agreeTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      return false;
    }
    
    setError("");
    return true;
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      setError(""); // Clear any previous errors
      setSuccess(""); // Clear any previous success messages
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
      setError(""); // Clear any previous errors
      setSuccess(""); // Clear any previous success messages
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(""); // Clear any previous errors
      setSuccess(""); // Clear any previous success messages
    }
  };

  const handleBackToSignIn = () => {
    router.push('/auth/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep3()) {
      return;
    }
    
    setIsLoading(true);
    setError("");
    setSuccess(""); // Clear any previous success messages
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: formData.businessName,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          selectedPlan: selectedPlan,
          referralCode: formData.referralCode // Include referral code in the request
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }
      
      // Check if OTP verification is required
      if (data.requiresVerification) {
        // Check if there was an email error
        if (data.emailError) {
          console.warn('Account created but OTP email failed:', data.emailError);
          // Show warning but continue to OTP verification
          setError(`Account created successfully, but there was an issue sending the verification email. You can try resending the OTP or contact support if the problem persists.`);
        }
        
        // Show success message if referral was processed
        if (data.referralProcessed) {
          setSuccess(`Account created successfully! Your referral code ${data.referralCode} has been processed. Please check your email for the verification code.`);
        }
        
        // Show OTP verification screen
        setUserId(data.userId);
        setShowOtpVerification(true);
      } else {
        // If no verification needed, redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator component
  const PasswordStrengthIndicator = ({ strength }) => {
    const getColor = () => {
      if (strength.score < 2) return "bg-red-500";
      if (strength.score < 4) return "bg-yellow-500";
      if (strength.score < 6) return "bg-green-500";
      return "bg-green-600";
    };

    const getWidth = () => {
      return `${Math.min(100, (strength.score / 6) * 100)}%`;
    };

    return (
      <div className="mt-2">
        <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getColor()} transition-all duration-300`} 
            style={{ width: getWidth() }}
          ></div>
        </div>
        <p className="text-sm mt-1 text-gray-600 flex items-center">
          <Shield size={14} className="mr-1" />
          {strength.feedback}
        </p>
      </div>
    );
  };

  // If showing OTP verification, render that component
  if (showOtpVerification) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Branding Section */}
        <div className="hidden md:flex md:w-1/3 bg-indigo-800 text-white p-8 flex-col justify-between">
          <div>
            {/* <div className="flex items-center mb-8">
              <div className="h-10 w-10 rounded-md bg-white text-indigo-700 flex items-center justify-center font-bold text-xl mr-3">
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
            <div className="max-w-md">
              <h2 className="text-3xl font-bold mb-6">Almost there!</h2>
              <p className="mb-8">
                Please verify your email address to complete your registration and access your account.
              </p>
            </div>
          </div>
          
          <div className="text-sm opacity-80">
            © {new Date().getFullYear()} InsightBooks. All rights reserved.
          </div>
        </div>

        {/* OTP Verification Section */}
        <div className="w-full md:w-2/3 p-6 flex items-center justify-center">
          <OTPVerification 
            email={formData.email} 
            userId={userId} 
            onBackToSignIn={handleBackToSignIn} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Branding Section */}
      <div className="hidden md:flex md:w-1/3 bg-indigo-800 text-white p-8 flex-col justify-between">
        <div>
          {/* <div className="flex items-center mb-8">
            <div className="h-10 w-10 rounded-md bg-white text-indigo-700 flex items-center justify-center font-bold text-xl mr-3">
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
            <h2 className="text-3xl font-bold mb-6">Start your journey with InsightBooks today</h2>
            <p className="mb-8">
              Join thousands of businesses that trust InsightBooks for their financial management needs.
            </p>
          </div>
          
          <div className="mb-8">
            <div className="flex mb-6">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-indigo-700 text-white">
                1
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Choose your plan</h3>
                <p className="text-indigo-200">Select the plan that fits your business needs</p>
              </div>
            </div>
            
            <div className="flex mb-6">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-indigo-700 text-white">
                2
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Create your account</h3>
                <p className="text-indigo-200">Provide your business and contact information</p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-indigo-700 text-white">
                3
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Set up access</h3>
                <p className="text-indigo-200">Secure your account with a password</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-sm opacity-80">
          © {new Date().getFullYear()} InsightBooks. All rights reserved.
        </div>
      </div>

      {/* Signup Form Section */}
      <div className="w-full md:w-2/3 p-6 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          {/* Step Progress */}
          <div className="md:hidden mb-6">
            <div className="flex justify-between">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 ${
                    currentStep === step 
                      ? "bg-indigo-600 text-white" 
                      : currentStep > step 
                      ? "bg-green-500 text-white" 
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {currentStep > step ? <Check size={16} /> : step}
                  </div>
                  <div className="text-xs text-gray-500">
                    {step === 1 ? "Plan" : step === 2 ? "Account" : "Security"}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <div className="h-1 bg-green-500 w-full" style={{ width: `${(currentStep - 1) * 50}%` }}></div>
              <div className="h-1 bg-gray-200 w-full" style={{ width: `${100 - ((currentStep - 1) * 50)}%` }}></div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800">
              {currentStep === 1 
                ? "Choose your plan" 
                : currentStep === 2 
                ? "Create your account" 
                : "Secure your account"}
            </h2>
            <p className="text-gray-600 mt-2">
              {currentStep === 1 
                ? "Select the plan that best fits your business needs" 
                : currentStep === 2 
                ? "Provide your business and contact information" 
                : "Set up your password and complete your registration"}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
              <AlertCircle size={18} className="mr-2" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-700">
              <Check size={18} className="mr-2" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Choose Plan */}
            {currentStep === 1 && (
              <div>
                <div className="mb-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    {plans.monthly.map((plan) => (
                      <div 
                        key={plan.id}
                        className={`border rounded-lg p-6 cursor-pointer transition-all ${
                          selectedPlan === plan.id 
                            ? "border-indigo-500 ring-2 ring-indigo-200" 
                            : "border-gray-200 hover:border-indigo-300"
                        }`}
                        onClick={() => setSelectedPlan(plan.id)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{plan.name}</h3>
                            <div className="flex items-baseline mt-2">
                              <span className="text-2xl font-bold">{plan.price}</span>
                              <span className="text-gray-600 ml-1">/{plan.period}</span>
                            </div>
                            {plan.savings && (
                              <div className="text-sm text-green-600 mt-1">
                                {plan.savings}
                              </div>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                            selectedPlan === plan.id 
                              ? "border-indigo-500 bg-indigo-500" 
                              : "border-gray-300"
                          }`}>
                            {selectedPlan === plan.id && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <ul className="space-y-3">
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-start">
                                <Check size={16} className="text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                <span className="text-sm">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start">
                    <div className="text-indigo-600 mr-3 mt-0.5">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Need a custom solution?</h4>
                      <p className="text-sm text-gray-600 mt-1">If you need additional features or customizations for your business, contact our sales team for a tailor-made package.</p>
                      <a href="/contact" className="text-indigo-600 font-medium text-sm inline-flex items-center mt-2 hover:underline">
                        Contact Sales
                        <ChevronRight size={14} className="ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Account Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Google OAuth Section */}
                <div>
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-4">Sign up or sign in with Google</p>
                    <GoogleOAuthButton 
                      mode="signup"
                      onError={(error) => setError(error)}
                      className="mb-4"
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="businessName" className="block text-gray-700 font-medium mb-2">
                    Business Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Building size={18} />
                    </div>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Your Company Ltd."
                      value={formData.businessName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-gray-700 font-medium mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <User size={18} />
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Mail size={18} />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Phone size={18} />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                {/* Referral Code Field */}
                {referralSuccess && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-start">
                      <div className="text-green-600 mr-3 mt-0.5">
                        <Check size={18} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">Referral Code Detected!</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Your referral code <strong>{formData.referralCode}</strong> has been automatically added. 
                          You'll get special benefits when you complete your registration!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start">
                    <div className="text-blue-600 mr-3 mt-0.5">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Password Security</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Your password will be securely hashed before being stored in our database. 
                        We never store or transmit passwords in plain text.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-start">
                    <input
                      id="agreeTerms"
                      name="agreeTerms"
                      type="checkbox"
                      className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500 mt-1"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      required
                    />
                    <label htmlFor="agreeTerms" className="ml-3 text-sm text-gray-600">
                      I agree to the{" "}
                      <Link href="/terms" className="text-indigo-600 hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-indigo-600 hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Security */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
                    Create Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Lock size={18} />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  <PasswordStrengthIndicator strength={passwordStrength} />
                  
                  <div className="mt-3 text-sm text-gray-600">
                    <p>Password should include:</p>
                    <ul className="mt-1 space-y-1 pl-5 list-disc">
                      <li className={formData.password.length >= 8 ? "text-green-600" : ""}>
                        At least 8 characters
                      </li>
                      <li className={/[A-Z]/.test(formData.password) ? "text-green-600" : ""}>
                        At least one uppercase letter
                      </li>
                      <li className={/[a-z]/.test(formData.password) ? "text-green-600" : ""}>
                        At least one lowercase letter
                      </li>
                      <li className={/[0-9]/.test(formData.password) ? "text-green-600" : ""}>
                        At least one number
                      </li>
                      <li className={/[^A-Za-z0-9]/.test(formData.password) ? "text-green-600" : ""}>
                        At least one special character
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <Lock size={18} />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-start">
                    <input
                      id="agreeTerms"
                      name="agreeTerms"
                      type="checkbox"
                      className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500 mt-1"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      required
                    />
                    <label htmlFor="agreeTerms" className="ml-3 text-sm text-gray-600">
                      I agree to the{" "}
                      <Link href="/terms" className="text-indigo-600 hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-indigo-600 hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Form Navigation */}
            <div className="mt-10 pt-6 border-t border-gray-200 flex justify-between">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  onClick={prevStep}
                >
                  Back
                </button>
              )}
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  className="ml-auto px-6 py-2 bg-indigo-700 text-white rounded-md font-medium hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors flex items-center"
                  onClick={nextStep}
                >
                  Continue
                  <ChevronRight size={16} className="ml-2" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="ml-auto px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating your account..." : "Create Account"}
                </button>
              )}
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">
                Login to your account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;