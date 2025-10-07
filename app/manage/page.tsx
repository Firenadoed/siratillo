"use client"

import { useState } from "react"
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
import { Table } from "@/components/ui/table"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

type Account = {
  id: number
  name: string
  password: string
  role: "Laundryman" | "Deliveryman"
}

export default function ManageAccounts() {
  // Initial data
  const [laundrymen, setLaundrymen] = useState<Account[]>([
    { id: 1, name: "Kiko Gutierrez", password: "12345", role: "Laundryman" },
    { id: 2, name: "Rian Garcia", password: "12345", role: "Laundryman" },
  ])
  const [deliverymen, setDeliverymen] = useState<Account[]>([
    { id: 3, name: "David John", password: "12345", role: "Deliveryman" },
    { id: 4, name: "Mary Grace", password: "12345", role: "Deliveryman" },
  ])

  // Modal states
  const [openAdd, setOpenAdd] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)

  // Selected
  const [selected, setSelected] = useState<Account | null>(null)
  const [newName, setNewName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"Laundryman" | "Deliveryman">("Laundryman")

  // Search
  const [searchLaundry, setSearchLaundry] = useState("")
  const [searchDelivery, setSearchDelivery] = useState("")

  // Add
  const handleAdd = () => {
    const newAccount = {
      id: Date.now(),
      name: newName,
      password: newPassword,
      role: newRole,
    }
    if (newRole === "Laundryman") {
      setLaundrymen([...laundrymen, newAccount])
    } else {
      setDeliverymen([...deliverymen, newAccount])
    }
    setNewName("")
    setNewPassword("")
    setNewRole("Laundryman")
    setOpenAdd(false)
  }

  // Edit
  const handleEdit = () => {
    if (!selected) return
    if (selected.role === "Laundryman") {
      setLaundrymen(
        laundrymen.map((acc) =>
          acc.id === selected.id ? { ...acc, name: newName, password: newPassword } : acc
        )
      )
    } else {
      setDeliverymen(
        deliverymen.map((acc) =>
          acc.id === selected.id ? { ...acc, name: newName, password: newPassword } : acc
        )
      )
    }
    setOpenEdit(false)
    setSelected(null)
  }

  // Delete
  const handleDelete = () => {
    if (!selected) return
    if (selected.role === "Laundryman") {
      setLaundrymen(laundrymen.filter((acc) => acc.id !== selected.id))
    } else {
      setDeliverymen(deliverymen.filter((acc) => acc.id !== selected.id))
    }
    setOpenDelete(false)
    setSelected(null)
  }

  // Render reusable table inside card
  const renderCardTable = (
    title: string,
    data: Account[],
    role: "Laundryman" | "Deliveryman",
    search: string,
    setSearch: (val: string) => void
  ) => {
    const filteredData = data.filter((acc) =>
      acc.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <div className="flex space-x-2">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60"
            />
            <Button
              onClick={() => {
                setNewRole(role)
                setOpenAdd(true)
              }}
            >
              + Add {role}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table className="w-full table-fixed">
            <thead>
              <tr>
                <th className="text-left p-2 w-1/3">Name</th>
                <th className="text-left p-2 w-1/3">Password</th>
                <th className="text-left p-2 w-1/3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((acc) => (
                  <tr key={acc.id} className="border-t">
                    <td className="p-2">{acc.name}</td>
                    <td className="p-2">••••••</td>
                    <td className="p-2 space-x-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelected(acc)
                          setNewName(acc.name)
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
                  <td colSpan={3} className="text-center p-4 text-gray-500">
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Manage Accounts</h1>

      {renderCardTable("Laundryman Accounts", laundrymen, "Laundryman", searchLaundry, setSearchLaundry)}
      {renderCardTable("Deliveryman Accounts", deliverymen, "Deliveryman", searchDelivery, setSearchDelivery)}

      {/* Add Modal */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {newRole}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={`Enter ${newRole} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Enter password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleAdd}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {newRole}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Enter password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleEdit}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected?.role}</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {selected?.name}?</p>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
