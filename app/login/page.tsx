"use client";

import { useState } from "react";
import { Input } from "@/lib/ui/input";
import { Button } from "@/lib/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call the secure API route instead of client-side role check
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      if (result.success) {
        console.log(`🔄 Redirecting to: ${result.redirectTo}`);
        window.location.href = result.redirectTo;
      }

    } catch (err: any) {
      alert(err.message || "Login failed");
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md sm:max-w-sm md:max-w-md lg:max-w-lg text-center border border-gray-100">
        <div className="flex justify-center mb-2">
          <Image 
            src="/logo.jpg" 
            alt="LaundryGo Logo" 
            width={200} 
            height={200} 
            className="rounded-full shadow-sm" 
          />
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-blue-600 mb-6 tracking-tight">LaundryGo</h1>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="text-left">
            <label className="block mb-1 font-medium text-gray-700 text-sm sm:text-base">Email</label>
            <Input 
              placeholder="you@example.com" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full text-sm sm:text-base px-3 py-2" 
            />
          </div>

          <div className="text-left">
            <label className="block mb-1 font-medium text-gray-700 text-sm sm:text-base">Password</label>
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full text-sm sm:text-base px-3 py-2" 
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 sm:py-3 rounded-lg text-sm sm:text-base transition-all duration-200" 
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>
      </div>
    </div>
  );
}