"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui/card"
import { Switch } from "@/lib/ui/switch"
import { Button } from "@/lib/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/lib/ui/dialog"
import { Input } from "@/lib/ui/input"
import { Package, Truck, ShoppingBag, WashingMachine, Droplets, Sparkles } from "lucide-react"
import { Toaster, toast } from "sonner";
import { useBranch } from "@/lib/branchcontext"

type Service = {
  id: string
  name: string
  price: number
  description: string
}

type Detergent = {
  id: string
  name: string
  description: string
  base_price: number
  custom_price: number | null
  is_available: boolean
  final_price: number
}

type Softener = {
  id: string
  name: string
  description: string
  base_price: number
  custom_price: number | null
  is_available: boolean
  final_price: number
}

type LaundryMethods = {
  dropoff_enabled: boolean
  delivery_enabled: boolean
  pickup_enabled: boolean
  self_service_enabled: boolean
}

// Create a separate component that uses the hook
function ServicesContent() {
  const { selectedBranch, branchChangeTrigger } = useBranch()
  const [shopId, setShopId] = useState<string | null>(null)
  const [methods, setMethods] = useState<LaundryMethods>({
    dropoff_enabled: false,
    delivery_enabled: false,
    pickup_enabled: false,
    self_service_enabled: false
  })
  const [services, setServices] = useState<Service[]>([])
  const [detergents, setDetergents] = useState<Detergent[]>([])
  const [softeners, setSofteners] = useState<Softener[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBranchName, setCurrentBranchName] = useState<string>('')

  const [newService, setNewService] = useState({ name: "", price: "", description: "" })
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)

  // New state for detergents/softeners
  const [newDetergent, setNewDetergent] = useState({ name: "", description: "", base_price: "" })
  const [newSoftener, setNewSoftener] = useState({ name: "", description: "", base_price: "" })

  // Fetch all data
  useEffect(() => {
    if (!selectedBranch) return

    const fetchData = async () => {
      try {
        setLoading(true)
        console.log("📡 Fetching data for branch:", selectedBranch.id)
        
        // Fetch services and products (detergents + softeners) in parallel
        const [servicesRes, productsRes] = await Promise.all([
          fetch(`/api/owner/services?branch_id=${selectedBranch.id}`),
          fetch(`/api/owner/detergents?branch_id=${selectedBranch.id}`) // This returns BOTH detergents and softeners
        ])

        const servicesData = await servicesRes.json()
        const productsData = await productsRes.json()

        if (!servicesRes.ok || servicesData.error) {
          toast.error(servicesData.error || "Failed to load services")
          return
        }

        if (!productsRes.ok || productsData.error) {
          toast.error(productsData.error || "Failed to load products")
          return
        }

        setShopId(servicesData.shopId)
        setMethods(servicesData.methods)
        setServices(servicesData.services || [])
        
        // Set both detergents and softeners from the products API response
        setDetergents(productsData.detergents || [])
        setSofteners(productsData.softeners || [])
        
        setCurrentBranchName(servicesData.branchName || selectedBranch.name)
        
        console.log("✅ Data loaded:", {
          services: servicesData.services?.length || 0,
          detergents: productsData.detergents?.length || 0,
          softeners: productsData.softeners?.length || 0
        })
        
      } catch (error: any) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedBranch, branchChangeTrigger])

  const updateMethod = async (field: string, value: boolean) => {
    if (!selectedBranch) {
      toast.error("Please select a branch first")
      return
    }

    // Optimistic update
    setMethods(prev => ({ ...prev, [field]: value }))

    try {
      const response = await fetch('/api/owner/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          field, 
          value,
          branchId: selectedBranch.id
        })
      })

      const { error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || "Failed to update method")
        // Revert on error
        setMethods(prev => ({ ...prev, [field]: !value }))
        return
      }

      toast.success("Method updated successfully")
      
    } catch (error: any) {
      toast.error("Failed to update method")
      // Revert on error
      setMethods(prev => ({ ...prev, [field]: !value }))
    }
  }

  const addService = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch first")
      return
    }

    if (!newService.name.trim() || !newService.price || !newService.description.trim()) {
      return toast.error("All fields are required")
    }

    if (parseFloat(newService.price) <= 0) {
      return toast.error("Price must be greater than 0")
    }

    try {
      const response = await fetch('/api/owner/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newService.name,
          price: newService.price,
          description: newService.description,
          branchId: selectedBranch.id
        })
      })

      const { service, error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || "Failed to add service")
        return
      }

      setServices(prev => [...prev, service])
      setNewService({ name: "", price: "", description: "" })
      toast.success("Service added successfully")
      
    } catch (error: any) {
      toast.error("Failed to add service")
    }
  }

  const updateService = async () => {
    if (!editingService) return

    if (!editingService.name.trim() || editingService.price <= 0 || !editingService.description.trim()) {
      return toast.error("All fields are required and price must be greater than 0")
    }

    try {
      const response = await fetch('/api/owner/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingService.id,
          name: editingService.name,
          price: editingService.price,
          description: editingService.description
        })
      })

      const { error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || "Failed to update service")
        return
      }

      setServices(prev => 
        prev.map(s => s.id === editingService.id ? editingService : s)
      )
      setEditingService(null)
      toast.success("Service updated successfully")
      
    } catch (error: any) {
      toast.error("Failed to update service")
    }
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return

    try {
      const response = await fetch('/api/owner/services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: serviceToDelete.id })
      })

      const { error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || "Failed to delete service")
        return
      }

      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id))
      setServiceToDelete(null)
      toast.success("Service deleted successfully")
      
    } catch (error: any) {
      toast.error("Failed to delete service")
    }
  }

  // Update detergent/softener availability and pricing
  const updateProductAvailability = async (type: 'detergent' | 'softener', id: string, is_available: boolean, custom_price?: number) => {
    if (!selectedBranch) {
      toast.error("Please select a branch first")
      return
    }

    // Optimistic update
    if (type === 'detergent') {
      setDetergents(prev => prev.map(d => 
        d.id === id ? { 
          ...d, 
          is_available, 
          custom_price: custom_price !== undefined ? custom_price : d.custom_price,
          final_price: custom_price !== undefined ? custom_price : d.final_price
        } : d
      ))
    } else {
      setSofteners(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          is_available, 
          custom_price: custom_price !== undefined ? custom_price : s.custom_price,
          final_price: custom_price !== undefined ? custom_price : s.final_price
        } : s
      ))
    }

    try {
      const response = await fetch('/api/owner/detergents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type,
          id,
          branchId: selectedBranch.id,
          is_available,
          custom_price
        })
      })

      const { error } = await response.json()

      if (!response.ok || error) {
        toast.error(error || `Failed to update ${type}`)
        // Revert on error
        if (type === 'detergent') {
          setDetergents(prev => prev.map(d => 
            d.id === id ? { ...d, is_available: !is_available } : d
          ))
        } else {
          setSofteners(prev => prev.map(s => 
            s.id === id ? { ...s, is_available: !is_available } : s
          ))
        }
        return
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully`)
      
    } catch (error: any) {
      toast.error(`Failed to update ${type}`)
      // Revert on error
      if (type === 'detergent') {
        setDetergents(prev => prev.map(d => 
          d.id === id ? { ...d, is_available: !is_available } : d
        ))
      } else {
        setSofteners(prev => prev.map(s => 
          s.id === id ? { ...s, is_available: !is_available } : s
        ))
      }
    }
  }

  // Add new detergent/softener
  const addNewProduct = async (type: 'detergent' | 'softener') => {
    const newProduct = type === 'detergent' ? newDetergent : newSoftener

    if (!newProduct.name.trim() || !newProduct.description.trim() || !newProduct.base_price) {
      return toast.error("All fields are required")
    }

    if (parseFloat(newProduct.base_price) < 0) {
      return toast.error("Price cannot be negative")
    }

    try {
      const response = await fetch('/api/owner/detergents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: newProduct.name,
          description: newProduct.description,
          base_price: newProduct.base_price,
          branchId: selectedBranch?.id
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        toast.error(data.error || `Failed to add ${type}`)
        return
      }

      // Add to local state
      const newItem = {
        ...data[type],
        is_available: true,
        final_price: parseFloat(newProduct.base_price),
        custom_price: parseFloat(newProduct.base_price)
      }

      if (type === 'detergent') {
        setDetergents(prev => [...prev, newItem])
        setNewDetergent({ name: "", description: "", base_price: "" })
      } else {
        setSofteners(prev => [...prev, newItem])
        setNewSoftener({ name: "", description: "", base_price: "" })
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`)
      
    } catch (error: any) {
      toast.error(`Failed to add ${type}`)
    }
  }

  // Edit product price
  const editProductPrice = (type: 'detergent' | 'softener', product: Detergent | Softener) => {
    const newPrice = prompt(`Enter new price for ${product.name}:`, product.final_price.toString())
    if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) >= 0) {
      updateProductAvailability(type, product.id, product.is_available, parseFloat(newPrice))
    } else if (newPrice !== null) {
      toast.error("Please enter a valid price")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading services...</p>
        </div>
      </div>
    )
  }

  if (!selectedBranch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Please select a branch to manage services</p>
        <p className="text-gray-400 mt-2">Use the branch selector in the sidebar</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-10">
      {/* Branch Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700 font-medium">
          Managing services for: <span className="font-bold">{currentBranchName}</span>
        </p>
      </div>

      {/* ===== Service Methods ===== */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-center md:text-left">
          Service Methods
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Drop Off",
              icon: Package,
              state: methods.dropoff_enabled,
              field: "dropoff_enabled",
            },
            {
              label: "Delivery",
              icon: Truck,
              state: methods.delivery_enabled,
              field: "delivery_enabled",
            },
            {
              label: "Pickup & Delivery",
              icon: ShoppingBag,
              state: methods.pickup_enabled,
              field: "pickup_enabled",
            },
            {
              label: "Self Service",
              icon: WashingMachine,
              state: methods.self_service_enabled,
              field: "self_service_enabled",
            },
          ].map(({ label, icon: Icon, state, field }) => (
            <Card
              key={label}
              className={`${
                state ? "bg-green-600 text-white" : "bg-red-600 text-white"
              } transition-all rounded-xl flex flex-col justify-between`}
            >
              <CardHeader className="flex flex-col items-center space-y-3 py-4">
                <Icon size={44} className="text-white" />
                <CardTitle className="text-lg">{label}</CardTitle>
                <Switch
                  checked={state}
                  onCheckedChange={(checked) => updateMethod(field, checked)}
                />
              </CardHeader>
              <CardContent className="text-center pb-4">
                <p className="text-sm md:text-base">
                  {state ? "Enabled" : "Disabled"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== Detergents Management ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
          <h2 className="text-xl md:text-2xl font-bold">Detergents</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
                <Droplets className="w-4 h-4 mr-2" />
                Add Detergent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Detergent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Detergent Name"
                  value={newDetergent.name}
                  onChange={(e) => setNewDetergent({ ...newDetergent, name: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={newDetergent.description}
                  onChange={(e) => setNewDetergent({ ...newDetergent, description: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={newDetergent.base_price}
                  onChange={(e) => setNewDetergent({ ...newDetergent, base_price: e.target.value })}
                />
                <Button
                  onClick={() => addNewProduct('detergent')}
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                >
                  Add Detergent
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {detergents.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Droplets className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No detergents</h3>
            <p className="mt-2 text-sm text-gray-500">
              Add detergents that customers can choose from.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {detergents.map((detergent) => (
              <Card key={detergent.id} className="p-4 border hover:shadow-lg transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {detergent.name}
                    <Switch
                      checked={detergent.is_available}
                      onCheckedChange={(checked) => 
                        updateProductAvailability('detergent', detergent.id, checked)
                      }
                    />
                  </CardTitle>
                  <p className="text-sm text-gray-600">{detergent.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold">
                        ₱{detergent.final_price.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => editProductPrice('detergent', detergent)}
                      >
                        Edit Price
                      </Button>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      detergent.is_available 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {detergent.is_available ? 'Available' : 'Disabled'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Softeners Management ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
          <h2 className="text-xl md:text-2xl font-bold">Fabric Softeners</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                <Sparkles className="w-4 h-4 mr-2" />
                Add Softener
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Softener</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Softener Name"
                  value={newSoftener.name}
                  onChange={(e) => setNewSoftener({ ...newSoftener, name: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={newSoftener.description}
                  onChange={(e) => setNewSoftener({ ...newSoftener, description: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={newSoftener.base_price}
                  onChange={(e) => setNewSoftener({ ...newSoftener, base_price: e.target.value })}
                />
                <Button
                  onClick={() => addNewProduct('softener')}
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                >
                  Add Softener
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {softeners.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No softeners</h3>
            <p className="mt-2 text-sm text-gray-500">
              Add fabric softeners that customers can choose from.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {softeners.map((softener) => (
              <Card key={softener.id} className="p-4 border hover:shadow-lg transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {softener.name}
                    <Switch
                      checked={softener.is_available}
                      onCheckedChange={(checked) => 
                        updateProductAvailability('softener', softener.id, checked)
                      }
                    />
                  </CardTitle>
                  <p className="text-sm text-gray-600">{softener.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold">
                        ₱{softener.final_price.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => editProductPrice('softener', softener)}
                      >
                        Edit Price
                      </Button>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      softener.is_available 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {softener.is_available ? 'Available' : 'Disabled'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Laundry Services ===== */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
          <h2 className="text-xl md:text-2xl font-bold">Laundry Services</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 w-full md:w-auto">
                + Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Service</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Service Name"
                  value={newService.name}
                  onChange={(e) =>
                    setNewService({ ...newService, name: e.target.value })
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price per kg"
                  value={newService.price}
                  onChange={(e) =>
                    setNewService({ ...newService, price: e.target.value })
                  }
                />
                <Input
                  placeholder="Service Description"
                  value={newService.description}
                  onChange={(e) =>
                    setNewService({
                      ...newService,
                      description: e.target.value,
                    })
                  }
                />
                <Button
                  onClick={addService}
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                >
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <WashingMachine className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No services</h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by creating your first laundry service for {currentBranchName}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card
                key={service.id}
                className="bg-white shadow-md rounded-xl border hover:shadow-lg transition-all p-4 flex flex-col justify-between h-full"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    {service.name}
                  </CardTitle>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {service.description}
                  </p>
                </CardHeader>

                <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">
                    ₱{service.price.toFixed(2)}/kg
                  </span>

                  <div className="flex gap-2">
                    {/* Edit */}
                    <Dialog
                      open={editingService?.id === service.id}
                      onOpenChange={(open) => !open && setEditingService(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-400 text-yellow-600 hover:bg-yellow-50 h-8 px-3"
                          onClick={() => setEditingService(service)}
                        >
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Edit Service</DialogTitle>
                        </DialogHeader>
                        {editingService && (
                          <div className="space-y-4">
                            <Input
                              placeholder="Service Name"
                              value={editingService.name}
                              onChange={(e) =>
                                setEditingService({
                                  ...editingService,
                                  name: e.target.value,
                                })
                              }
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Price per kg"
                              value={editingService.price}
                              onChange={(e) =>
                                setEditingService({
                                  ...editingService,
                                  price: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                            <Input
                              placeholder="Description"
                              value={editingService.description}
                              onChange={(e) =>
                                setEditingService({
                                  ...editingService,
                                  description: e.target.value,
                                })
                              }
                            />
                            <Button
                              onClick={updateService}
                              className="bg-blue-600 hover:bg-blue-700 w-full"
                            >
                              Save Changes
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <Dialog
                      open={serviceToDelete?.id === service.id}
                      onOpenChange={(open) => !open && setServiceToDelete(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-600 hover:bg-red-50 h-8 px-3"
                          onClick={() => setServiceToDelete(service)}
                        >
                          Delete
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Confirm Delete</DialogTitle>
                        </DialogHeader>
                        <p>
                          Are you sure you want to delete{" "}
                          <b>{service.name}</b>?
                        </p>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setServiceToDelete(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={confirmDeleteService}
                          >
                            Delete
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// Main component that handles authentication and wraps with DashboardLayout
export default function ServicesPage() {
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
      <ServicesContent />
    </DashboardLayout>
  )
}