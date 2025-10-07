"use client"

import { useEffect, useState } from "react"
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"
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

type Service = {
  id: string
  name: string
  price: number
  description: string
}

export default function ServicesPage() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [shopId, setShopId] = useState<string | null>(null)
  const [dropOff, setDropOff] = useState(false)
  const [delivery, setDelivery] = useState(false)
  const [pickup, setPickup] = useState(false)
  const [selfService, setSelfService] = useState(false)
  const [services, setServices] = useState<Service[]>([])

  const [newService, setNewService] = useState({ name: "", price: "", description: "" })
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)

  useEffect(() => {
    if (!session) {
      router.push("/login")
      return
    }

    const fetchData = async () => {
      const user = session.user
      if (!user) return

      const { data: shop } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", user.id)
        .single()

      if (!shop) return

      setShopId(shop.id)

      const { data: methods } = await supabase
        .from("laundry_methods")
        .select("*")
        .eq("shop_id", shop.id)
        .maybeSingle()

      if (methods) {
        setDropOff(methods.dropoff_enabled)
        setDelivery(methods.delivery_enabled)
        setPickup(methods.pickup_enabled)
        setSelfService(methods.self_service_enabled ?? false)
      }

      const { data: svc } = await supabase
        .from("services")
        .select("*")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: true })

      if (svc) setServices(svc)
    }

    fetchData()
  }, [session, supabase, router])

  const updateMethod = async (field: string, value: boolean) => {
    if (!shopId) return
    const { data: existing } = await supabase
      .from("laundry_methods")
      .select("id")
      .eq("shop_id", shopId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from("laundry_methods")
        .update({
          [field]: value,
          updated_at: new Date(),
        })
        .eq("shop_id", shopId)
    } else {
      await supabase
        .from("laundry_methods")
        .insert([{ shop_id: shopId, [field]: value, updated_at: new Date() }])
    }
  }

  const addService = async () => {
    if (!shopId) return alert("Shop not found")
    if (!newService.name || !newService.price || !newService.description)
      return alert("All fields are required")

    const { data: existing } = await supabase
      .from("services")
      .select("id")
      .eq("shop_id", shopId)
      .ilike("name", newService.name.trim())

    if (existing && existing.length > 0) {
      alert("A service with this name already exists.")
      return
    }

    const { data, error } = await supabase
      .from("services")
      .insert([
        {
          shop_id: shopId,
          name: newService.name.trim(),
          price: parseFloat(newService.price),
          description: newService.description.trim(),
        },
      ])
      .select()

    if (error) {
      alert("Failed to add service.")
    } else {
      setServices([...services, data[0]])
      setNewService({ name: "", price: "", description: "" })
    }
  }

  const updateService = async () => {
    if (!editingService) return
    const { error } = await supabase
      .from("services")
      .update({
        name: editingService.name,
        price: editingService.price,
        description: editingService.description,
      })
      .eq("id", editingService.id)

    if (!error) {
      setServices(
        services.map((s) => (s.id === editingService.id ? editingService : s))
      )
      setEditingService(null)
    }
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceToDelete.id)

    if (!error) {
      setServices(services.filter((s) => s.id !== serviceToDelete.id))
      setServiceToDelete(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-10">
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
                state: dropOff,
                setState: setDropOff,
                field: "dropoff_enabled",
              },
              {
                label: "Delivery",
                icon: Truck,
                state: delivery,
                setState: setDelivery,
                field: "delivery_enabled",
              },
              {
                label: "Pickup & Delivery",
                icon: ShoppingBag,
                state: pickup,
                setState: setPickup,
                field: "pickup_enabled",
              },
              {
                label: "Self Service",
                icon: WashingMachine,
                state: selfService,
                setState: setSelfService,
                field: "self_service_enabled",
              },
            ].map(({ label, icon: Icon, state, setState, field }) => (
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
                    onCheckedChange={(checked) => {
                      setState(checked)
                      updateMethod(field, checked)
                    }}
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
        </section>
      </div>
    </DashboardLayout>
  )
}
