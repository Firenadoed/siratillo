"use client";

import { useState } from "react";
import { Input } from "@/lib/ui/input";
import { Button } from "@/lib/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });

  const validateForm = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed. Please check your credentials.");
      }

      if (result.success) {
        console.log(`🔄 Redirecting to: ${result.redirectTo}`);
        window.location.href = result.redirectTo;
      }

    } catch (err: any) {
      let errorMessage = "Login failed. Please try again.";
      
      if (err.name === 'AbortError') {
        errorMessage = "Request timed out. Please check your connection.";
      } else if (err.message.includes('credentials')) {
        errorMessage = "Invalid email or password.";
      } else {
        errorMessage = err.message || errorMessage;
      }

      alert(errorMessage);
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'email') setEmail(value);
    if (field === 'password') setPassword(value);
    
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 px-4 relative overflow-hidden">
      {/* Wave Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-blue-300/25 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20 relative z-10">
        <div className="flex justify-center mb-6">
          <Image 
            src="/logo.jpg" 
            alt="LaundryGo Logo" 
            width={120} 
            height={120} 
            className="rounded-full shadow-md" 
            priority
          />
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">LaundryGo</h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block mb-2 font-medium text-gray-700">Business Email</label>
            <Input 
              placeholder="owner@yourlaundry.com" 
              type="email" 
              value={email} 
              onChange={(e) => handleInputChange('email', e.target.value)} 
              required 
              className="w-full"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-2">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block mb-2 font-medium text-gray-700">Password</label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"} 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => handleInputChange('password', e.target.value)} 
                required 
                className="w-full pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-2">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="ml-2 text-gray-600 text-sm">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-500 text-sm font-medium">
              Forgot password?
            </Link>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in to Dashboard"
            )}
          </Button>

          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Own a shop?{" "}
              <Link 
                href="/request-account" 
                className="text-blue-600 hover:text-blue-500 font-medium underline"
              >
                Request an account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}