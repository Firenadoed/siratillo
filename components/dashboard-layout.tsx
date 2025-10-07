"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Home, Shirt, Users, LogOut, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"

const sidebarLinks = [
  { name: "Dashboard", href: "/owner", icon: Home },
  { name: "Services", href: "/services", icon: Shirt },
  { name: "Manage Accounts", href: "/manage", icon: Users },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const user = useUser()

  const [shop, setShop] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user) return

    const fetchShop = async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, address, owner_id")
        .eq("owner_id", user.id)

      if (error) {
        console.error("❌ Error fetching shop:", error.message)
      } else if (!data || data.length === 0) {
        console.warn("⚠️ No shop found for this owner")
      } else {
        console.log(`🏪 Shop found: ${data[0].name} (${data[0].id})`)
        setShop(data[0])
      }
    }

    fetchShop()
  }, [supabase, user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ====== MOBILE NAVBAR ====== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-blue-800 text-white flex items-center justify-between px-4 py-3 shadow-md">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-blue-700"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <h1 className="font-semibold text-lg tracking-wide">LaundryGo Admin</h1>
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* ====== SIDEBAR ====== */}
      <aside
        className={cn(
          "fixed lg:static top-0 left-0 h-full w-64 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-700 text-white flex flex-col justify-between shadow-lg z-40 transform transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div>
          {/* Profile / Brand Section */}
          <div className="flex flex-col items-center p-6 border-b border-blue-600">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mb-2 shadow-inner">
              <span className="text-xl">👤</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">
                {shop ? shop.name : "(BRAND) Laundry Shop"}
              </p>
              <p className="text-sm text-blue-200">
                {shop ? shop.address : "Address not set"}
              </p>
              <p className="text-sm text-emerald-400 font-medium">Open</p>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <div className="p-6 font-semibold text-sm uppercase tracking-wide text-blue-200">
            Laundry Admin
          </div>
          <nav className="flex flex-col gap-2 px-4 relative">
            {sidebarLinks.map((link) => {
              const active = pathname === link.href
              return (
                <div key={link.name} className="relative">
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/90 rounded-l-full shadow-md after:content-[''] after:absolute after:right-[-12px] after:top-0 after:h-full after:w-4 after:bg-white/90 after:clip-path-[polygon(0%_0%,100%_50%,0%_100%)]"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Link
                    href={link.href}
                    onClick={() => setSidebarOpen(false)} // Close on mobile navigation
                    className={cn(
                      "relative z-10 flex items-center gap-3 px-4 py-2 font-medium rounded-l-full transition-all",
                      active
                        ? "text-blue-900"
                        : "text-blue-100 hover:bg-blue-600/40 hover:text-white"
                    )}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.name}
                  </Link>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="border-t border-blue-600 p-4">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* ====== OVERLAY (MOBILE ONLY) ====== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm lg:hidden z-30"
        ></div>
      )}

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mt-14 lg:mt-0 overflow-y-auto transition-all">
        <div className="grid gap-6">
          <div className="rounded-2xl border bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
