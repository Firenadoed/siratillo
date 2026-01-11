"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Home, 
  Shirt, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  MapPin, 
  ChevronDown,
  Building,
  Settings,
  QrCode,
  AlertTriangle
} from "lucide-react"
import { useEffect, useState } from "react"
import { useUser } from "@supabase/auth-helpers-react"
import { Toaster, toast } from "sonner"
import { BranchContext, type Branch } from "@/lib/branchcontext"

interface Shop {
  id: string
  name: string
  description: string
  owner_id: string
  logo_url: string | null
  cover_image_url: string | null
}

interface OperatingHours {
  id: string
  branch_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

const sidebarLinks = [
  { name: "Dashboard", href: "/owner", icon: Home },
  { name: "Services", href: "/owner/services", icon: Shirt },
  { name: "Manage Accounts", href: "/owner/manage", icon: Users },
  { name: "QR Codes", href: "/owner/qr-codes", icon: QrCode },
]

// Logout Confirmation Modal Component
function LogoutConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Confirm Logout</h3>
              <p className="text-gray-600 text-sm mt-1">
                Are you sure you want to log out?
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700">
            You will be redirected to the login page and will need to sign in again to access your dashboard.
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200 order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-600 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 order-1 sm:order-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()

  const [shop, setShop] = useState<Shop | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [branchesDropdownOpen, setBranchesDropdownOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [branchChangeTrigger, setBranchChangeTrigger] = useState(0)
  const [isOpenNow, setIsOpenNow] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // ==============================
  // 🕒 CHECK IF BRANCH IS OPEN NOW
  // ==============================
  const checkIfOpen = (branchId: string, hours: OperatingHours[]): boolean => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS" format
    
    console.log('🕒 Checking if open for branch:', branchId);
    console.log('📅 Current day:', currentDay, '(0=Sunday)');
    console.log('⏰ Current time:', currentTime);
    console.log('📋 All operating hours for this branch:', 
      hours.filter(h => h.branch_id === branchId)
    );
    
    const todayHours = hours.find(h => 
      h.branch_id === branchId && h.day_of_week === currentDay
    );
    
    if (!todayHours) {
      console.log('❌ No operating hours found for today');
      console.log('Available days for this branch:', 
        hours.filter(h => h.branch_id === branchId).map(h => ({
          day: h.day_of_week,
          open: h.open_time,
          close: h.close_time,
          closed: h.is_closed
        }))
      );
      return false;
    }
    
    if (todayHours.is_closed) {
      console.log('❌ Marked as closed for today');
      return false;
    }
    
    // Convert TIME fields to comparable strings
    // PostgreSQL TIME format is "HH:MM:SS" or "HH:MM:SS.sss"
    const openTimeStr = todayHours.open_time?.slice(0, 5) || '00:00'; // Take only HH:MM
    const closeTimeStr = todayHours.close_time?.slice(0, 5) || '23:59'; // Take only HH:MM
    const currentTimeStr = currentTime.slice(0, 5); // Take only HH:MM
    
    const isOpen = currentTimeStr >= openTimeStr && currentTimeStr <= closeTimeStr;
    
    console.log('✅ Hours found:', {
      openTime: openTimeStr,
      closeTime: closeTimeStr,
      currentTime: currentTimeStr,
      isOpen
    });
    
    return isOpen;
  }

  // ==============================
  // 🔐 AUTHENTICATION CHECK FIRST
  // ==============================
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔄 Checking owner authentication...")
        
        const response = await fetch('/api/owner/check-auth')
        const { authorized, error, user } = await response.json()
        
        console.log('Owner auth check result:', { authorized, error, user })
        
        if (!response.ok || !authorized) {
          toast.error(error || "Owner access required")
          router.replace("/login")
          return
        }

        console.log("✅ Owner authenticated, fetching shop data...")
        setIsAuthorized(true)
        
      } catch (error) {
        console.error("Auth check error:", error)
        toast.error("Authentication failed")
        router.replace("/login")
      }
    }

    checkAuth()
  }, [router])

  // ==============================
  // 🏪 FETCH SHOP DATA ONLY WHEN AUTHORIZED
  // ==============================
  useEffect(() => {
    if (!isAuthorized) return

    const fetchShopData = async () => {
      try {
        setLoading(true)
        console.log("📡 Fetching shop data via API...")

        const response = await fetch('/api/owner/shop-data')
        const { shop, branches, operatingHours, error } = await response.json()

        if (!response.ok || error) {
          console.error("❌ Error fetching shop data:", error)
          toast.error("Failed to load shop data")
          return
        }

        if (shop) {
          console.log(`🏪 Shop found: ${shop.name}`)
          setShop(shop)
          setBranches(branches || [])
          setOperatingHours(operatingHours || [])
          
          // Set first branch as selected by default
          if (branches && branches.length > 0) {
            const firstBranch = branches[0]
            setSelectedBranch(firstBranch)
            // Check if branch is open
            setIsOpenNow(checkIfOpen(firstBranch.id, operatingHours || []))
          }
        } else {
          console.warn("⚠️ No shop found for this owner")
          toast.error("No shop assigned to your account")
        }
      } catch (error) {
        console.error("💥 Error fetching shop data:", error)
        toast.error("Failed to load shop data")
      } finally {
        setLoading(false)
      }
    }

    fetchShopData()
  }, [isAuthorized])

  // ==============================
  // 🎯 BRANCH CHANGE HANDLER
  // ==============================
  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch)
    setBranchesDropdownOpen(false)
    setBranchChangeTrigger(prev => prev + 1)
    
    // Check if selected branch is open
    setIsOpenNow(checkIfOpen(branch.id, operatingHours))
    
    console.log(`📍 Branch switched to: ${branch.name}, Open: ${isOpenNow}`)
  }

  // ==============================
  // 🕒 UPDATE OPEN STATUS EVERY MINUTE
  // ==============================
  useEffect(() => {
    if (!selectedBranch) return;

    const updateOpenStatus = () => {
      setIsOpenNow(checkIfOpen(selectedBranch.id, operatingHours))
    };

    // Update immediately
    updateOpenStatus();

    // Update every minute
    const interval = setInterval(updateOpenStatus, 60000);

    return () => clearInterval(interval);
  }, [selectedBranch, operatingHours])

  // ==============================
  // 🔄 BRANCH MANAGEMENT FUNCTIONS
  // ==============================
  const refreshBranches = async () => {
    try {
      const response = await fetch('/api/owner/branches')
      if (response.ok) {
        const { branches } = await response.json()
        setBranches(branches || [])
        
        // If the currently selected branch still exists, keep it selected
        if (selectedBranch) {
          const updatedSelectedBranch = branches.find((b: Branch) => b.id === selectedBranch.id)
          setSelectedBranch(updatedSelectedBranch || branches[0] || null)
        } else if (branches.length > 0) {
          setSelectedBranch(branches[0])
        }
        
        setBranchChangeTrigger(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error refreshing branches:', error)
    }
  }

  const addBranch = (branch: Branch) => {
    setBranches(prev => [...prev, branch])
    setBranchChangeTrigger(prev => prev + 1)
  }

  const updateBranches = (branchesList: Branch[]) => {
    setBranches(branchesList)
    setBranchChangeTrigger(prev => prev + 1)
  }

  const updateBranch = async (branchId: string, updates: Partial<Branch>) => {
    try {
      const response = await fetch('/api/owner/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: branchId, ...updates })
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to update branch')
      }

      const { branch: updatedBranch } = await response.json()
      
      // Update in local state
      setBranches(prev => 
        prev.map(branch => branch.id === branchId ? { ...branch, ...updatedBranch } : branch)
      )
      
      // If the updated branch is currently selected, update it too
      if (selectedBranch?.id === branchId) {
        setSelectedBranch(prev => prev ? { ...prev, ...updatedBranch } : null)
      }
      
      setBranchChangeTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error updating branch:', error)
      throw error
    }
  }

  const deleteBranch = async (branchId: string) => {
    try {
      const response = await fetch(`/api/owner/branches?id=${branchId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to delete branch')
      }

      // Remove from local state
      setBranches(prev => prev.filter(branch => branch.id !== branchId))
      
      // If the deleted branch was selected, select another one
      if (selectedBranch?.id === branchId) {
        const remainingBranches = branches.filter(branch => branch.id !== branchId)
        setSelectedBranch(remainingBranches[0] || null)
      }
      
      setBranchChangeTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error deleting branch:', error)
      throw error
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (response.ok) {
        toast.success("Logged out successfully")
        router.push("/login")
      } else {
        throw new Error('Logout failed')
      }
    } catch (error: any) {
      toast.error("Logout failed: " + error.message)
    }
  }

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  const handleConfirmLogout = () => {
    setShowLogoutModal(false)
    handleLogout()
  }

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLogoutModal) {
        setShowLogoutModal(false)
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showLogoutModal])

  // Show loading while checking auth OR fetching data
  if (loading || !isAuthorized) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <Toaster position="top-right" richColors />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!isAuthorized ? "Checking permissions..." : "Loading shop data..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <BranchContext.Provider value={{
        selectedBranch,
        branchChangeTrigger,
        allBranches: branches,
        setSelectedBranch,
        refreshBranches,
        addBranch,
        updateBranches,
        updateBranch,
        deleteBranch
      }}>
        <div className="flex h-screen bg-gray-50">
          <Toaster position="top-right" richColors />
          
          {/* ====== MOBILE NAVBAR ====== */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-800 to-blue-700 text-white flex items-center justify-between px-4 py-3 shadow-lg">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-blue-700/50 transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="font-bold text-lg tracking-tight">LaundryGo</h1>
            <div className="w-6" />
          </div>

          {/* ====== SIDEBAR ====== */}
          <aside
            className={cn(
              "fixed lg:static top-0 left-0 h-full w-80 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-700 text-white flex flex-col justify-between shadow-xl z-50 transform transition-transform duration-300",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            <div>
              {/* Shop Header Section */}
              <div className="p-6 border-b border-blue-600">
                <div className="flex items-center gap-4 mb-4">
                  {/* Shop Logo - Uses shop.logo_url */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
                    {shop?.logo_url ? (
                      <img 
                        src={shop.logo_url} 
                        alt={shop.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building className="w-7 h-7" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-white text-xl leading-tight truncate">
                      {shop ? shop.name : "No Shop Found"}
                    </h1>
                    {shop?.description && (
                      <p className="text-blue-200 text-sm mt-1 leading-relaxed">
                        {shop.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Branch Selector */}
                <div className="relative">
                  <button
                    onClick={() => setBranchesDropdownOpen(!branchesDropdownOpen)}
                    className="w-full flex items-center justify-between p-3 bg-blue-700/50 hover:bg-blue-600/50 rounded-xl transition-all duration-200 border border-blue-600 hover:border-blue-500 group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <MapPin className="w-4 h-4 text-blue-300 flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {selectedBranch ? selectedBranch.name : "Select Branch"}
                        </p>
                        <p className="text-blue-300 text-xs truncate">
                          {selectedBranch ? selectedBranch.address : "No branch selected"}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-blue-300 transition-transform duration-200 flex-shrink-0",
                      branchesDropdownOpen ? "rotate-180" : ""
                    )} />
                  </button>

                  {/* Branch Dropdown */}
                  {branchesDropdownOpen && branches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-blue-800 border border-blue-600 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                      <div className="p-2">
                        {branches.map((branch, index) => (
                          <button
                            key={branch.id}
                            onClick={() => handleBranchSelect(branch)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left",
                              selectedBranch?.id === branch.id
                                ? "bg-blue-600 border border-blue-500"
                                : "hover:bg-blue-700/50 border border-transparent"
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-blue-100">
                                {index + 1}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm truncate">
                                {branch.name}
                              </p>
                              <p className="text-blue-200 text-xs truncate mt-0.5">
                                {branch.address}
                              </p>
                            </div>
                            {selectedBranch?.id === branch.id && (
                              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge - Dynamic based on operating hours */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      isOpenNow ? "bg-emerald-400" : "bg-red-400"
                    )} />
                    <span className={cn(
                      "font-medium text-sm",
                      isOpenNow ? "text-emerald-300" : "text-red-300"
                    )}>
                      {isOpenNow ? "Open Now" : "Closed"}
                    </span>
                  </div>
                  <span className="text-blue-300 text-xs">
                    {branches.length} branch{branches.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>

              {/* Navigation Section */}
              <div className="p-4">
                <div className="px-3 py-2">
                  <h3 className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
                    Navigation
                  </h3>
                </div>
                <nav className="space-y-1">
                  {sidebarLinks.map((link) => {
                    const active = pathname === link.href
                    const Icon = link.icon
                    return (
                      <div key={link.name} className="relative">
                        {active && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 bg-white/10 rounded-xl shadow-lg"
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        )}
                        <Link
                          href={link.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "relative z-10 flex items-center gap-3 px-4 py-3 font-medium rounded-xl transition-all duration-200 group",
                            active
                              ? "text-white shadow-md"
                              : "text-blue-200 hover:text-white hover:bg-blue-700/30"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg transition-colors",
                            active 
                              ? "bg-white/10" 
                              : "bg-blue-700/50 group-hover:bg-blue-600/50"
                          )}>
                            <Icon className={cn(
                              "w-4 h-4 transition-colors",
                              active ? "text-white" : "text-blue-300 group-hover:text-white"
                            )} />
                          </div>
                          <span className="font-medium">{link.name}</span>
                        </Link>
                      </div>
                    )
                  })}
                </nav>
              </div>
            </div>

            {/* Footer Section */}
            <div className="p-4 border-t border-blue-600">
              <div className="space-y-2">
                <Link 
                  href="/owner/settings"
                  className="w-full flex items-center gap-3 p-3 text-blue-200 hover:text-white hover:bg-blue-700/30 rounded-xl transition-all duration-200"
                >
                  <div className="p-2 rounded-lg bg-blue-700/50">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Settings</span>
                </Link>
                
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-3 p-3 text-red-300 hover:text-red-100 hover:bg-red-500/20 rounded-xl transition-all duration-200 border border-transparent hover:border-red-500/30"
                >
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Logout</span>
                </button>
              </div>
            </div>
          </aside>

          {/* ====== OVERLAY (MOBILE ONLY) ====== */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden z-40"
            />
          )}

          {/* ====== MAIN CONTENT ====== */}
          <main className="flex-1 p-6 lg:p-8 mt-14 lg:mt-0 overflow-y-auto transition-all bg-gradient-to-br from-blue-50 to-blue-100/30">
            <div className="max-w-7xl mx-auto">
              {/* Branch Context Bar */}
              {selectedBranch && (
                <div className="mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-blue-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
                        {shop?.logo_url ? (
                          <img 
                            src={shop.logo_url} 
                            alt={shop.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <MapPin className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-800 text-lg">
                          {selectedBranch.name}
                        </h2>
                        <p className="text-slate-600 text-sm">
                          {selectedBranch.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        isOpenNow ? "bg-emerald-400" : "bg-red-400"
                      )} />
                      <span className={cn(
                        "font-medium text-sm",
                        isOpenNow ? "text-emerald-600" : "text-red-600"
                      )}>
                        {isOpenNow ? "Open Now" : "Closed"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="rounded-2xl border border-blue-200 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
                {children}
              </div>
            </div>
          </main>
        </div>
      </BranchContext.Provider>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  )
}