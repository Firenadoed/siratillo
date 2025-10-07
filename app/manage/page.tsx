"use client"

import { useEffect, useState } from "react"
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

type Account = {
  id: string
  name: string
  email: string
  password: string
  role: "employee" | "deliveryman"
}

export default function ManageAccounts() {
  const supabase = useSupabaseClient()
  const session = useSession()
  const router = useRouter()

  const [employees, setEmployees] = useState<Account[]>([])
  const [deliverymen, setDeliverymen] = useState<Account[]>([])
  const [shopId, setShopId] = useState<string | null>(null)

  const [openAdd, setOpenAdd] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selected, setSelected] = useState<Account | null>(null)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"employee" | "deliveryman">("employee")
  const [searchEmployee, setSearchEmployee] = useState("")
  const [searchDelivery, setSearchDelivery] = useState("")

  useEffect(() => {
    if (session === null) {
      router.push("/login")
    }
  }, [session, router])

  useEffect(() => {
    const fetchOwnerShop = async () => {
      if (!session) return

      const { data: shop, error: shopError } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", session.user.id)
        .maybeSingle()

      if (shopError || !shop) {
        alert("No shop found for this owner.")
        return
      }

      setShopId(shop.id)
      fetchAccounts(shop.id)
    }

    fetchOwnerShop()
  }, [session, supabase])

  const fetchAccounts = async (shop_id: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, password, role")
      .eq("shop_id", shop_id)
      .in("role", ["employee", "deliveryman"])

    if (!error && data) {
      setEmployees(data.filter((u) => u.role === "employee"))
      setDeliverymen(data.filter((u) => u.role === "deliveryman"))
    }
  }

  const handleAdd = async () => {
    if (!shopId) return alert("No shop found for this owner.")
    if (!newEmail || !newPassword || !newName) {
      alert("Please fill in all fields.")
      return
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        name: newName,
        role: newRole,
        shop_id: shopId,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(`Error: ${err.message}`)
      return
    }

    setOpenAdd(false)
    setNewName("")
    setNewEmail("")
    setNewPassword("")
    fetchAccounts(shopId)
  }

  const handleEdit = async () => {
    if (!selected || !shopId) return

    const { error } = await supabase
      .from("users")
      .update({
        name: newName,
        password: newPassword,
      })
      .eq("id", selected.id)

    if (error) {
      alert("Failed to update account.")
    } else {
      setOpenEdit(false)
      setSelected(null)
      fetchAccounts(shopId)
    }
  }

  const handleDelete = async () => {
    if (!selected || !shopId) return

    const { error } = await supabase.from("users").delete().eq("id", selected.id)
    if (error) alert("Failed to delete account.")
    else {
      setOpenDelete(false)
      setSelected(null)
      fetchAccounts(shopId)
    }
  }

  const renderCardTable = (
    title: string,
    data: Account[],
    role: "employee" | "deliveryman",
    search: string,
    setSearch: (val: string) => void
  ) => {
    const filteredData = data.filter((acc) =>
      acc.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 sm:w-60"
            />
            <Button
              onClick={() => {
                setNewRole(role)
                setOpenAdd(true)
              }}
              className="w-full sm:w-auto"
            >
              + Add {role === "employee" ? "Employee" : "Deliveryman"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-1/4">Name</th>
                  <th className="p-2 w-1/4">Email</th>
                  <th className="p-2 w-1/4">Password</th>
                  <th className="p-2 w-1/4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((acc) => (
                    <tr key={acc.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{acc.name}</td>
                      <td className="p-2">{acc.email}</td>
                      <td className="p-2">••••••</td>
                      <td className="p-2 flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(acc)
                            setNewName(acc.name)
                            setNewEmail(acc.email)
                            setNewPassword(acc.password)
                            setNewRole(acc.role)
                            setOpenEdit(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelected(acc)
                            setOpenDelete(true)
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center p-4 text-gray-500">
                      No results found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-8">
        <h1 className="text-2xl font-bold">Manage Accounts</h1>
        {renderCardTable("Employee Accounts", employees, "employee", searchEmployee, setSearchEmployee)}
        {renderCardTable("Deliveryman Accounts", deliverymen, "deliveryman", searchDelivery, setSearchDelivery)}

        {/* Add Modal */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {newRole}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder={`Enter ${newRole} name`} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Enter email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Input placeholder="Enter password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} className="w-full sm:w-auto">
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {newRole}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Enter name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Enter email" type="email" value={newEmail} disabled />
              <Input placeholder="Enter password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleEdit} className="w-full sm:w-auto">
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={openDelete} onOpenChange={setOpenDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {selected?.role}</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete <b>{selected?.name}</b>?</p>
            <DialogFooter>
              <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
