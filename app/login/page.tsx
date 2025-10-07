"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    if (username === "admin" && password === "admin") {
      router.push("/admin")
    } else if (username === "sample" && password === "sample") {
      router.push("/employee")
    } else {
      alert("Invalid credentials. Try again.")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png" // Add logo in public/logo.png
            alt="LaundryGo Logo"
            width={80}
            height={80}
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-blue-600 mb-6">LaundryGo</h1>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="text-left">
            <label className="block mb-1 font-medium">Name:</label>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="text-left">
            <label className="block mb-1 font-medium">Password:</label>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center">
            <Link href="/forgot-password" className="text-sm text-blue-500 hover:underline">
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
          >
            Log In
          </Button>
        </form>
      </div>
    </div>
  )
}
