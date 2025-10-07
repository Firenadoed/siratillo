"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Home, Shirt, Users } from "lucide-react"

// Sidebar Links
const sidebarLinks = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Services", href: "/services", icon: Shirt },
  { name: "Manage Accounts", href: "/manage", icon: Users },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-700 text-white flex flex-col relative shadow-lg">
        
        {/* Profile / Brand Section */}
        <div className="flex flex-col items-center p-6 border-b border-blue-600">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mb-2 shadow-inner">
            <span className="text-xl">👤</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-white">(BRAND) Laundry Shop</p>
            <p className="text-sm text-blue-200">Location</p>
            <p className="text-sm text-emerald-400 font-medium">Open</p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="p-6 font-semibold text-base uppercase tracking-wide text-blue-200">Laundry Admin</div>
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 bg-gray-50 overflow-y-auto">
        <div className="grid gap-6">
          {/* Example Card Wrapper (applies #4 improvements) */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
