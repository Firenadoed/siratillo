"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui/card"
import { Button } from "@/lib/ui/button"
import { Input } from "@/lib/ui/input"
import { Switch } from "@/lib/ui/switch"
import { Toaster, toast } from "sonner"
import { useBranch } from "@/lib/branchcontext"
import { Building, Clock, Phone, Image as ImageIcon, Save, MapPin } from "lucide-react"

interface Shop {
  id: string
  name: string
  description: string
  logo_url: string | null
  cover_image_url: string | null
}

interface Contact {
  id: string
  contact_type: string
  value: string
  is_primary: boolean
}

interface OperatingHours {
  id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

const DAYS = [
  { id: 0, name: "Sunday" },
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" }
]

// Create a separate component that uses the hook
function SettingsContent() {
  const { selectedBranch, branchChangeTrigger } = useBranch()
  const [shop, setShop] = useState<Shop | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentBranchName, setCurrentBranchName] = useState<string>('')

  // Form states
  const [shopData, setShopData] = useState({
    name: "",
    description: ""
  })
  const [newLogo, setNewLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState("")
  const [contactsData, setContactsData] = useState<Contact[]>([])
  const [hoursData, setHoursData] = useState<OperatingHours[]>([])

  // Fetch shop settings data
  useEffect(() => {
    if (!selectedBranch) return

    const fetchSettingsData = async () => {
      try {
        setLoading(true)
        console.log("📡 Fetching settings data for branch:", selectedBranch.id)

        const response = await fetch(`/api/owner/settings?branch_id=${selectedBranch.id}`)
        const { shop, contacts, operatingHours, error } = await response.json()

        if (!response.ok || error) {
          toast.error(error || "Failed to load settings")
          return
        }

        setShop(shop)
        setContacts(contacts || [])
        setOperatingHours(operatingHours || [])
        setCurrentBranchName(selectedBranch.name)

        // Initialize form data
        setShopData({
          name: shop?.name || "",
          description: shop?.description || ""
        })
        setContactsData(contacts || [])
        setHoursData(operatingHours || [])

        console.log("✅ Settings data loaded")
      } catch (error: any) {
        console.error("Error fetching settings:", error)
        toast.error("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }

    fetchSettingsData()
  }, [selectedBranch, branchChangeTrigger])

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setNewLogo(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  // Upload logo to Supabase storage
  const uploadLogo = async (): Promise<string | null> => {
    if (!newLogo) return null

    try {
      const formData = new FormData()
      formData.append('file', newLogo)

      const response = await fetch('/api/owner/settings/upload-logo', {
        method: 'POST',
        body: formData
      })

      const { url, error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || "Failed to upload logo")
        return null
      }

      toast.success("Logo uploaded successfully")
      return url
    } catch (error) {
      console.error("Error uploading logo:", error)
      toast.error("Failed to upload logo")
      return null
    }
  }

  // Save all settings
  const saveSettings = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch first")
      return
    }

    setSaving(true)

    try {
      let logoUrl = shop?.logo_url

      // Upload new logo if selected
      if (newLogo) {
        logoUrl = await uploadLogo()
      }

      // Update shop info
      const shopResponse = await fetch('/api/owner/settings/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop?.id,
          name: shopData.name,
          description: shopData.description,
          logo_url: logoUrl
        })
      })

      const shopResult = await shopResponse.json()

      if (!shopResponse.ok || shopResult.error) {
        throw new Error(shopResult.error || "Failed to update shop info")
      }

      // Update contacts
      const contactsResponse = await fetch('/api/owner/settings/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch.id,
          contacts: contactsData
        })
      })

      const contactsResult = await contactsResponse.json()

      if (!contactsResponse.ok || contactsResult.error) {
        throw new Error(contactsResult.error || "Failed to update contacts")
      }

      // Update operating hours
      const hoursResponse = await fetch('/api/owner/settings/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch.id,
          hours: hoursData
        })
      })

      const hoursResult = await hoursResponse.json()

      if (!hoursResponse.ok || hoursResult.error) {
        throw new Error(hoursResult.error || "Failed to update operating hours")
      }

      toast.success("Settings saved successfully")
      
      // Refresh data
      setShop(prev => prev ? { ...prev, ...shopData, logo_url: logoUrl || prev.logo_url } : null)
      setContacts(contactsData)
      setOperatingHours(hoursData)

    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast.error(error.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  // Add new contact
  const addContact = () => {
    setContactsData(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        contact_type: 'phone',
        value: '',
        is_primary: false
      }
    ])
  }

  // Remove contact
  const removeContact = (index: number) => {
    setContactsData(prev => prev.filter((_, i) => i !== index))
  }

  // Update contact
  const updateContact = (index: number, field: string, value: any) => {
    setContactsData(prev => prev.map((contact, i) => 
      i === index ? { ...contact, [field]: value } : contact
    ))
  }

  // Update operating hours
  const updateHours = (dayOfWeek: number, field: string, value: any) => {
    setHoursData(prev => prev.map(hour => 
      hour.day_of_week === dayOfWeek ? { ...hour, [field]: value } : hour
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!selectedBranch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Please select a branch to manage settings</p>
        <p className="text-gray-400 mt-2">Use the branch selector in the sidebar</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Branch Info Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6" />
          <div>
            <p className="font-medium opacity-90">Managing settings for</p>
            <p className="font-bold text-xl">{currentBranchName}</p>
          </div>
        </div>
      </div>

      {/* ===== Shop Information ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Shop Information</h2>
              <p className="text-sm text-gray-500 mt-1">Applies to all branches</p>
            </div>
          </div>
        </div>
        
        <Card className="p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Logo Upload */}
            <div>
              <h3 className="font-semibold mb-4 text-gray-900">Shop Logo</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center shadow-inner">
                  {logoPreview || shop?.logo_url ? (
                    <img 
                      src={logoPreview || shop?.logo_url || ''} 
                      alt="Shop Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 w-full">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="mb-3 w-full"
                  />
                  <p className="text-sm text-gray-500">
                    Recommended: Square image, 500x500px or larger
                  </p>
                </div>
              </div>
            </div>

            {/* Shop Details */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">Shop Name</label>
                <Input
                  value={shopData.name}
                  onChange={(e) => setShopData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter shop name"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-900">Description</label>
                <textarea
                  value={shopData.description}
                  onChange={(e) => setShopData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter shop description"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ===== Contact Information ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Contact Information</h2>
              <p className="text-sm text-gray-500 mt-1">For {selectedBranch.name} only</p>
            </div>
          </div>
          <Button
            onClick={addContact}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg w-full md:w-auto"
          >
            + Add Contact
          </Button>
        </div>
        
        <Card className="p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <div className="space-y-4">
            {contactsData.map((contact, index) => (
              <div key={contact.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all">
                <select
                  value={contact.contact_type}
                  onChange={(e) => updateContact(index, 'contact_type', e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                >
                  <option value="phone">📞 Phone</option>
                  <option value="email">✉️ Email</option>
                  <option value="facebook">📘 Facebook</option>
                  <option value="instagram">📷 Instagram</option>
                  <option value="website">🌐 Website</option>
                  <option value="viber">💜 Viber</option>
                  <option value="telegram">📱 Telegram</option>
                </select>
                
                <Input
                  value={contact.value}
                  onChange={(e) => updateContact(index, 'value', e.target.value)}
                  placeholder={`Enter ${contact.contact_type}`}
                  className="flex-1 w-full"
                />
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <Switch
                      checked={contact.is_primary}
                      onCheckedChange={(checked) => updateContact(index, 'is_primary', checked)}
                    />
                    Primary
                  </label>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeContact(index)}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 ml-2"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            
            {contactsData.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100">
                <Phone className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No contact methods</h3>
                <p className="text-gray-500 mb-4">
                  Add contact methods for customers to reach {selectedBranch.name}
                </p>
                <Button
                  onClick={addContact}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  Add First Contact
                </Button>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ===== Operating Hours ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Operating Hours</h2>
              <p className="text-sm text-gray-500 mt-1">For {selectedBranch.name} only</p>
            </div>
          </div>
        </div>
        
        <Card className="p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <div className="space-y-3">
            {DAYS.map(day => {
              const dayHours = hoursData.find(h => h.day_of_week === day.id) || {
                id: `temp-${day.id}`,
                day_of_week: day.id,
                open_time: '09:00',
                close_time: '17:00',
                is_closed: false
              }

              return (
                <div key={day.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 min-w-20 sm:min-w-24">{day.name}</span>
                    
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={!dayHours.is_closed}
                        onCheckedChange={(checked) => updateHours(day.id, 'is_closed', !checked)}
                      />
                      <span className={`text-sm font-medium ${dayHours.is_closed ? 'text-red-600' : 'text-green-600'}`}>
                        {dayHours.is_closed ? 'Closed' : 'Open'}
                      </span>
                    </div>
                  </div>
                  
                  {!dayHours.is_closed && (
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                      <Input
                        type="time"
                        value={dayHours.open_time}
                        onChange={(e) => updateHours(day.id, 'open_time', e.target.value)}
                        className="w-28 sm:w-32"
                      />
                      <span className="text-gray-500 text-sm">to</span>
                      <Input
                        type="time"
                        value={dayHours.close_time}
                        onChange={(e) => updateHours(day.id, 'close_time', e.target.value)}
                        className="w-28 sm:w-32"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      {/* Save Button */}
      <div className="flex justify-end sticky bottom-6 bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-gray-200 shadow-xl">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50"
          size="lg"
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? "Saving Changes..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  )
}

// Main component that handles authentication and wraps with DashboardLayout
export default function SettingsPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true)
        const response = await fetch('/api/owner/check-auth')
        const { authorized, error } = await response.json()
        
        if (!response.ok || !authorized) {
          toast.error(error || "Owner access required")
          router.replace("/login")
          return
        }

        setIsAuthorized(true)
        
      } catch (error) {
        console.error("Auth check error:", error)
        toast.error("Authentication failed")
        router.replace("/login")
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (authLoading || !isAuthorized) {
    return (
      <DashboardLayout>
        <Toaster position="top-right" richColors />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {authLoading ? "Checking permissions..." : "Redirecting..."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Toaster position="top-right" richColors />
      <SettingsContent />
    </DashboardLayout>
  )
}