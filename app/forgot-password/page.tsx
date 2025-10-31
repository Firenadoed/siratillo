"use client";

import { useState } from "react";
import { Input } from "@/lib/ui/input";
import { Button } from "@/lib/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient(); // Call the function to get the client
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/callback`,
      });

      if (error) throw error;

      setEmailSent(true);
      
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setEmailSent(true); // Always show success for security
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 px-4 relative overflow-hidden">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20 relative z-10">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.jpg" 
              alt="LaundryGo Logo" 
              width={100} 
              height={100} 
              className="rounded-full shadow-md" 
              priority
            />
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Check Your Email</h1>
            
            <p className="text-gray-600 mb-6">
              If an account with <strong>{email}</strong> exists, we've sent a password reset link. 
              Please check your inbox and follow the instructions.
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full"
              >
                Try Another Email
              </Button>

              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 px-4 relative overflow-hidden">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20 relative z-10">
        <div className="flex justify-center mb-6">
          <Image 
            src="/logo.jpg" 
            alt="LaundryGo Logo" 
            width={100} 
            height={100} 
            className="rounded-full shadow-md" 
            priority
          />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Reset Your Password</h1>
          <p className="text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 font-medium text-gray-700">Business Email</label>
            <Input 
              placeholder="owner@yourlaundry.com" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full"
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2" 
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending Reset Link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>

          <div className="text-center">
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}