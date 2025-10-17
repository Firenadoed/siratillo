"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type RoleRow = {
  roles: {
    name: string;
  };
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step 1: Authenticate user with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      console.error("Login failed:", error);
      return;
    }

    const user = data.user;
    if (!user) {
      alert("No user found!");
      return;
    }

    console.log("✅ Authenticated:", user.email);

    // Step 2: Fetch user's role via join
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id)
      .returns<RoleRow[]>(); // ✅ fix type inference

    if (roleError) {
      alert("Error fetching user role: " + roleError.message);
      console.error("Role fetch error:", roleError);
      return;
    }

    const role = roleData?.[0]?.roles?.name;
    console.log("🧩 User role:", role);

    // Step 3: Redirect user based on role
    if (role === "superadmin") router.push("/admin");
    else if (role === "owner") router.push("/owner");
    else if (role === "employee") router.push("/employee");
    else if (role === "delivery") router.push("/delivery");
    else if (role === "customer") router.push("/customer");
    else alert("Unknown role. Please contact support.");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md sm:max-w-sm md:max-w-md lg:max-w-lg text-center border border-gray-100">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <Image
            src="/logo.jpg"
            alt="LaundryGo Logo"
            width={200}
            height={200}
            className="rounded-full shadow-sm"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-bold text-blue-600 mb-6 tracking-tight">
          LaundryGo
        </h1>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="text-left">
            <label className="block mb-1 font-medium text-gray-700 text-sm sm:text-base">
              Email
            </label>
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
            <label className="block mb-1 font-medium text-gray-700 text-sm sm:text-base">
              Password
            </label>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full text-sm sm:text-base px-3 py-2"
            />
          </div>

          <div className="flex justify-between items-center">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-500 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 sm:py-3 rounded-lg text-sm sm:text-base transition-all duration-200"
          >
            Log In
          </Button>
        </form>
      </div>
    </div>
  );
}
