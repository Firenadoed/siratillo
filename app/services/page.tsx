"use client"

import { useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Package, Truck, ShoppingBag, WashingMachine } from "lucide-react"

// Type
type Service = {
  id: number
  name: string
  price: number
  description: string
}

export default function ServicesPage() {
  // service method toggles
  const [dropOff, setDropOff] = useState(true)
  const [delivery, setDelivery] = useState(true)
  const [pickup, setPickup] = useState(false)
  const [selfService, setSelfService] = useState(false)

  // services list
  const [services, setServices] = useState<Service[]>([
    { id: 1, name: "Hand Wash", price: 65, description: "Gentle hand washing for delicate clothes." },
    { id: 2, name: "Fold Only", price: 30, description: "Neatly folded laundry, no washing included." },
    { id: 3, name: "Wash Only", price: 60, description: "Machine wash without folding or drying." },
    { id: 4, name: "Wash and Fold", price: 80, description: "Complete washing and folding service for all types of clothes." },
    { id: 5, name: "Dry Only", price: 65, description: "Drying service for pre-washed clothes using professional dryers." },
  ])

  // Add Service
  const [newService, setNewService] = useState({ name: "", price: "", description: "" })

  const addService = () => {
    if (!newService.name || !newService.price || !newService.description) return
    setServices([
      ...services,
      {
        id: Date.now(),
        name: newService.name,
        price: parseFloat(newService.price),
        description: newService.description,
      },
    ])
    setNewService({ name: "", price: "", description: "" })
  }

  // Edit Service
  const [editingService, setEditingService] = useState<Service | null>(null)

  const updateService = () => {
    if (!editingService) return
    setServices(
      services.map((s) =>
        s.id === editingService.id ? editingService : s
      )
    )
    setEditingService(null) // ✅ close after saving
  }

  // Delete Confirmation
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)

  const confirmDeleteService = () => {
    if (serviceToDelete) {
      setServices(services.filter((s) => s.id !== serviceToDelete.id))
      setServiceToDelete(null) // close dialog
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-10">
        {/* Service Methods */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Service Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Drop Off */}
            <Card className={dropOff ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
              <CardHeader className="flex flex-col items-center space-y-3">
                <Package size={48} className="text-white" />
                <CardTitle className="text-center">Drop Off</CardTitle>
                <Switch checked={dropOff} onCheckedChange={setDropOff} />
              </CardHeader>
              <CardContent className="text-center">
                <p>{dropOff ? "Enabled" : "Disabled"}</p>
              </CardContent>
            </Card>

            {/* Delivery */}
            <Card className={delivery ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
              <CardHeader className="flex flex-col items-center space-y-3">
                <Truck size={48} className="text-white" />
                <CardTitle className="text-center">Delivery</CardTitle>
                <Switch checked={delivery} onCheckedChange={setDelivery} />
              </CardHeader>
              <CardContent className="text-center">
                <p>{delivery ? "Enabled" : "Disabled"}</p>
              </CardContent>
            </Card>

            {/* Pickup */}
            <Card className={pickup ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
              <CardHeader className="flex flex-col items-center space-y-3">
                <ShoppingBag size={48} className="text-white" />
                <CardTitle className="text-center">Pickup & Delivery</CardTitle>
                <Switch checked={pickup} onCheckedChange={setPickup} />
              </CardHeader>
              <CardContent className="text-center">
                <p>{pickup ? "Enabled" : "Disabled"}</p>
              </CardContent>
            </Card>

            {/* Self Service */}
            <Card className={selfService ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
              <CardHeader className="flex flex-col items-center space-y-3">
                <WashingMachine size={48} className="text-white" />
                <CardTitle className="text-center">Self Service</CardTitle>
                <Switch checked={selfService} onCheckedChange={setSelfService} />
              </CardHeader>
              <CardContent className="text-center">
                <p>{selfService ? "Enabled" : "Disabled"}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Laundry Services */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Laundry Services</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  + Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Service Name"
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Price per kg"
                    value={newService.price}
                    onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  />
                  <Input
                    placeholder="Service Description"
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  />
                  <Button onClick={addService} className="bg-blue-600 hover:bg-blue-700 w-full">
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card
                key={service.id}
                className="bg-white shadow-md rounded-xl border hover:shadow-lg transition-all h-48 flex flex-col justify-between"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    {service.name}
                  </CardTitle>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {service.description}
                  </p>
                </CardHeader>

                <CardContent className="flex items-center justify-between">
                  <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">
                    ₱{service.price.toFixed(2)}/kg
                  </span>
                  <div className="flex gap-2">
                    {/* 📝 Edit Service */}
                    <Dialog open={editingService?.id === service.id} onOpenChange={(open) => !open && setEditingService(null)}>
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Service</DialogTitle>
                        </DialogHeader>
                        {editingService && (
                          <div className="space-y-4">
                            <Input
                              placeholder="Service Name"
                              value={editingService.name}
                              onChange={(e) =>
                                setEditingService({ ...editingService, name: e.target.value })
                              }
                            />
                            <Input
                              type="number"
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
                              placeholder="Service Description"
                              value={editingService.description}
                              onChange={(e) =>
                                setEditingService({ ...editingService, description: e.target.value })
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

                    {/* ❌ Delete Service with confirmation */}
                    <Dialog open={serviceToDelete?.id === service.id} onOpenChange={(open) => !open && setServiceToDelete(null)}>
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Delete</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete <b>{service.name}</b>?</p>
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
        </section>
      </div>
    </DashboardLayout>
  )
}
