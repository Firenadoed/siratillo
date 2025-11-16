"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui/card"
import { Button } from "@/lib/ui/button"
import { Input } from "@/lib/ui/input"
import { Switch } from "@/lib/ui/switch"
import { Toaster, toast } from "sonner"
import { useBranch, type Branch } from "@/lib/branchcontext"
import { Building, Clock, Phone, Image as ImageIcon, Save, MapPin, Plus, Loader2, Edit, Power, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/lib/ui/dialog"
import { Label } from "@/lib/ui/label"
import { Textarea } from "@/lib/ui/textarea"
import dynamic from 'next/dynamic'

// Dynamically import map components with no SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

// Dynamically import the useMapEvents hook
const LocationMarker = dynamic(
  () => Promise.resolve(({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number, address: string) => void }) => {
    const { useMapEvents } = require('react-leaflet')
    const [position, setPosition] = useState<[number, number] | null>(null)

    useMapEvents({
      click(e: any) {
        const { lat, lng } = e.latlng
        setPosition([lat, lng])
        const address = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`
        onLocationSelect(lat, lng, address)
      },
    })

    return position === null ? null : <Marker position={position} />
  }),
  { ssr: false }
)

// Default center coordinates (Philippines)
const DEFAULT_CENTER: [number, number] = [9.3100, 123.3080]

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
  const { selectedBranch, branchChangeTrigger, allBranches, updateBranch, deleteBranch, refreshBranches } = useBranch()
  const [shop, setShop] = useState<Shop | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentBranchName, setCurrentBranchName] = useState<string>('')

  // Branch Creation States
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false)
  const [creatingBranch, setCreatingBranch] = useState(false)
  
  // Branch Edit/Delete States
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [isEditBranchOpen, setIsEditBranchOpen] = useState(false)
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null)
  const [togglingBranch, setTogglingBranch] = useState<string | null>(null)

  const [newBranchData, setNewBranchData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    locationAddress: ''
  })

  // Form states
  const [shopData, setShopData] = useState({
    name: "",
    description: ""
  })
  const [newLogo, setNewLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState("")
  const [contactsData, setContactsData] = useState<Contact[]>([])
  const [hoursData, setHoursData] = useState<OperatingHours[]>([])

  // Fix Leaflet icons only in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet')
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })
    }
  }, [])

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
        
        // Initialize hours data with all 7 days, filling in missing days
        const initializeHoursData = (existingHours: OperatingHours[]) => {
          const defaultHours = DAYS.map(day => {
            const existing = existingHours.find(h => h.day_of_week === day.id)
            if (existing) {
              return {
                ...existing,
                open_time: existing.open_time || '09:00',
                close_time: existing.close_time || '17:00'
              }
            }
            // Create default entry for missing days
            return {
              id: `temp-${day.id}`,
              day_of_week: day.id,
              open_time: '09:00',
              close_time: '17:00',
              is_closed: false
            }
          })
          return defaultHours
        }

        setHoursData(initializeHoursData(operatingHours || []))

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
      console.log("📅 Saving operating hours:", hoursData)
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

  // Update operating hours - FIXED VERSION
  const updateHours = (dayOfWeek: number, field: string, value: any) => {
    setHoursData(prev => {
      const updated = prev.map(hour => {
        if (hour.day_of_week === dayOfWeek) {
          // Special handling for is_closed toggle
          if (field === 'is_closed') {
            return {
              ...hour,
              is_closed: value,
              // Set default times when opening
              open_time: value === false && !hour.open_time ? '09:00' : hour.open_time,
              close_time: value === false && !hour.close_time ? '17:00' : hour.close_time
            }
          }
          return { ...hour, [field]: value }
        }
        return hour
      })
      
      console.log(`Updated day ${dayOfWeek}, ${field}:`, value, updated.find(h => h.day_of_week === dayOfWeek))
      return updated
    })
  }

  // Handle branch creation
  const createBranch = async () => {
    if (!shop?.id) {
      toast.error('No shop found')
      return
    }

    if (!newBranchData.name || !newBranchData.address) {
      toast.error('Branch name and address are required')
      return
    }

    setCreatingBranch(true)

    try {
      const response = await fetch('/api/owner/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBranchData.name,
          address: newBranchData.address,
          latitude: newBranchData.latitude ? parseFloat(newBranchData.latitude) : null,
          longitude: newBranchData.longitude ? parseFloat(newBranchData.longitude) : null,
          shopId: shop.id
        })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to create branch')
      }

      toast.success('Branch created successfully!')
      
      // Refresh branches to get the complete list
      await refreshBranches()
      
      setNewBranchData({ 
        name: '', 
        address: '', 
        latitude: '', 
        longitude: '',
        locationAddress: '' 
      })
      setIsCreateBranchOpen(false)

    } catch (error: any) {
      console.error('Error creating branch:', error)
      toast.error(error.message || 'Failed to create branch')
    } finally {
      setCreatingBranch(false)
    }
  }

  // Handle location selection from map
  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setNewBranchData(prev => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
      locationAddress: address
    }))
  }

  // Branch management functions
  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch)
    setNewBranchData({
      name: branch.name,
      address: branch.address,
      latitude: branch.latitude?.toString() || '',
      longitude: branch.longitude?.toString() || '',
      locationAddress: ''
    })
    setIsEditBranchOpen(true)
  }

  const handleUpdateBranch = async () => {
    if (!editingBranch) return

    try {
      await updateBranch(editingBranch.id, {
        name: newBranchData.name,
        address: newBranchData.address,
        latitude: newBranchData.latitude ? parseFloat(newBranchData.latitude) : null,
        longitude: newBranchData.longitude ? parseFloat(newBranchData.longitude) : null,
      })

      toast.success('Branch updated successfully!')
      setIsEditBranchOpen(false)
      setEditingBranch(null)
      setNewBranchData({ name: '', address: '', latitude: '', longitude: '', locationAddress: '' })
    } catch (error: any) {
      toast.error(error.message || 'Failed to update branch')
    }
  }

  const handleDeleteBranch = async (branchId: string) => {
    // Prevent deleting if it's the last branch
    if (allBranches.length <= 1) {
      toast.error('Cannot delete the last branch. You must have at least one branch.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return
    }

    setDeletingBranch(branchId)
    
    try {
      await deleteBranch(branchId)
      toast.success('Branch deleted successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete branch')
    } finally {
      setDeletingBranch(null)
    }
  }

  const handleToggleBranchStatus = async (branch: Branch) => {
    setTogglingBranch(branch.id)
    
    try {
      await updateBranch(branch.id, {
        is_active: !branch.is_active
      })
      toast.success(`Branch ${!branch.is_active ? 'activated' : 'deactivated'} successfully!`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update branch status')
    } finally {
      setTogglingBranch(null)
    }
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

      {/* ===== Branch Management ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Branch Management</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your shop branches</p>
            </div>
          </div>
          
          <Dialog open={isCreateBranchOpen} onOpenChange={setIsCreateBranchOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Add New Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-name">Branch Name *</Label>
                  <Input
                    id="branch-name"
                    value={newBranchData.name}
                    onChange={(e) => setNewBranchData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Main Branch, Downtown Location"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="branch-address">Address *</Label>
                  <Textarea
                    id="branch-address"
                    value={newBranchData.address}
                    onChange={(e) => setNewBranchData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Full street address including city and postal code"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="block mb-2 font-medium text-gray-700">
                    Branch Location on Map
                  </Label>
                  <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                    <MapPin size={16} />
                    Click on the map to mark your branch location (optional but recommended)
                  </p>
                  
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <MapContainer
                      center={DEFAULT_CENTER}
                      zoom={13}
                      style={{ height: '300px', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <LocationMarker onLocationSelect={handleLocationSelect} />
                    </MapContainer>
                  </div>

                  {(newBranchData.latitude && newBranchData.longitude) && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <strong>Selected Location:</strong><br />
                        Latitude: {newBranchData.latitude}<br />
                        Longitude: {newBranchData.longitude}<br />
                        {newBranchData.locationAddress && `Address: ${newBranchData.locationAddress}`}
                      </p>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-500">
                  * Required fields. Coordinates are optional but recommended for delivery services.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateBranchOpen(false)}
                  disabled={creatingBranch}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createBranch}
                  disabled={creatingBranch || !newBranchData.name || !newBranchData.address}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {creatingBranch ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Branch'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <div className="text-center py-8">
            <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Your Branches</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create multiple branches to expand your laundry service coverage. Each branch can have its own contact information, operating hours, and settings.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Current branches */}
              {allBranches.map((branch) => (
                <div key={branch.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-all group relative">
                  <Building className="mx-auto h-8 w-8 text-blue-600 mb-2" />
                  <h4 className="font-semibold text-gray-900 text-center">{branch.name}</h4>
                  <p className="text-sm text-gray-500 mt-1 text-center line-clamp-2">{branch.address}</p>
                  
                  <div className="flex items-center justify-center mt-3 gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      branch.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                    
                    {/* Action buttons */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBranch(branch)}
                        className="h-8 w-8 p-0"
                        title="Edit branch"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleBranchStatus(branch)}
                        disabled={togglingBranch === branch.id}
                        className="h-8 w-8 p-0"
                        title={branch.is_active ? 'Deactivate branch' : 'Activate branch'}
                      >
                        {togglingBranch === branch.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Power className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBranch(branch.id)}
                        disabled={deletingBranch === branch.id || allBranches.length <= 1}
                        className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50"
                        title={allBranches.length <= 1 ? 'Cannot delete the last branch' : 'Delete branch'}
                      >
                        {deletingBranch === branch.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Current branch indicator */}
                  {selectedBranch?.id === branch.id && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Current
                      </span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Empty state */}
              {allBranches.length === 0 && (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 col-span-full">
                  <Building className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No branches found</p>
                </div>
              )}
            </div>
            
            <Dialog open={isCreateBranchOpen} onOpenChange={setIsCreateBranchOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Branch
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </Card>
      </section>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditBranchOpen} onOpenChange={setIsEditBranchOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">Branch Name *</Label>
              <Input
                id="edit-branch-name"
                value={newBranchData.name}
                onChange={(e) => setNewBranchData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Main Branch, Downtown Location"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-branch-address">Address *</Label>
              <Textarea
                id="edit-branch-address"
                value={newBranchData.address}
                onChange={(e) => setNewBranchData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full street address including city and postal code"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="block mb-2 font-medium text-gray-700">
                Branch Location on Map
              </Label>
              <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                <MapPin size={16} />
                Click on the map to update branch location (optional)
              </p>
              
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <MapContainer
                  center={editingBranch?.latitude && editingBranch?.longitude ? 
                    [editingBranch.latitude, editingBranch.longitude] as [number, number] : 
                    DEFAULT_CENTER
                  }
                  zoom={13}
                  style={{ height: '300px', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <LocationMarker onLocationSelect={handleLocationSelect} />
                </MapContainer>
              </div>

              {(newBranchData.latitude && newBranchData.longitude) && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Selected Location:</strong><br />
                    Latitude: {newBranchData.latitude}<br />
                    Longitude: {newBranchData.longitude}<br />
                    {newBranchData.locationAddress && `Address: ${newBranchData.locationAddress}`}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditBranchOpen(false)
                setEditingBranch(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateBranch}
              disabled={!newBranchData.name || !newBranchData.address}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Update Branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            {hoursData.map(dayHours => {
              const dayName = DAYS.find(d => d.id === dayHours.day_of_week)?.name || `Day ${dayHours.day_of_week}`
              
              return (
                <div key={dayHours.day_of_week} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 min-w-20 sm:min-w-24">{dayName}</span>
                    
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={!dayHours.is_closed}
                        onCheckedChange={(checked) => updateHours(dayHours.day_of_week, 'is_closed', !checked)}
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
                        onChange={(e) => updateHours(dayHours.day_of_week, 'open_time', e.target.value)}
                        className="w-28 sm:w-32"
                      />
                      <span className="text-gray-500 text-sm">to</span>
                      <Input
                        type="time"
                        value={dayHours.close_time}
                        onChange={(e) => updateHours(dayHours.day_of_week, 'close_time', e.target.value)}
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