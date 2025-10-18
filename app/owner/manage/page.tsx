"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/lib/ui/dialog"
import { Button } from "@/lib/ui/button"
import { Input } from "@/lib/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/lib/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select"
import { Toaster, toast } from "sonner"

type Account = {
  id: string
  name: string
  email: string
  role: "employee" | "deliveryman"
  branch_id: string
  branch_name: string
  created_at: string
}

type Branch = {
  id: string
  name: string
  shop_id: string
}

export default function ManageAccounts() {
  const router = useRouter()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [shopId, setShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [openAdd, setOpenAdd] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selected, setSelected] = useState<Account | null>(null)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState<"employee" | "deliveryman">("employee")
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [searchEmployee, setSearchEmployee] = useState("")
  const [searchDelivery, setSearchDelivery] = useState("")

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
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
      }
    }

    checkAuth()
  }, [router])

  // Fetch accounts data
  useEffect(() => {
    if (!isAuthorized) return

    const fetchAccounts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/owner/users')
        const { accounts, shopId, branches, error } = await response.json()

        if (!response.ok || error) {
          toast.error(error || "Failed to load accounts")
          return
        }

        setAccounts(accounts || [])
        setBranches(branches || [])
        setShopId(shopId)
        
      } catch (error: any) {
        console.error("Error fetching accounts:", error)
        toast.error("Failed to load accounts")
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [isAuthorized])

  // Reset form when opening add modal
  const handleOpenAdd = (role: "employee" | "deliveryman") => {
    setNewRole(role)
    setNewName("")
    setNewEmail("")
    setNewPassword("")
    // Set selectedBranchId only if branches are available
    if (branches.length > 0) {
      setSelectedBranchId(branches[0].id)
    } else {
      setSelectedBranchId("")
    }
    setOpenAdd(true)
  }

  const handleAdd = async () => {
    if (!newEmail || !newPassword || !newName || !selectedBranchId) {
      toast.error("Please fill in all fields including branch selection")
      return
    }

    // Double-check that branches are loaded
    if (branches.length === 0) {
      toast.error("No branches available. Please create branches first.")
      return
    }

    try {
      const res = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole,
          branch_id: selectedBranchId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(`Error: ${err.message}`)
        return
      }

      toast.success(`${newRole} added successfully`)
      setOpenAdd(false)
      
      // Refresh accounts
      const response = await fetch('/api/owner/users')
      const { accounts, branches } = await response.json()
      setAccounts(accounts || [])
      setBranches(branches || [])
      
    } catch (error: any) {
      toast.error("Failed to add account: " + error.message)
    }
  }

  const handleEdit = async () => {
    if (!selected) return

    try {
      const res = await fetch("/api/owner/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          name: newName,
          password: newPassword,
          branch_id: selectedBranchId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(`Error: ${err.message}`)
        return
      }

      toast.success("Account updated successfully")
      setOpenEdit(false)
      setSelected(null)
      setSelectedBranchId("")
      
      // Refresh accounts
      const response = await fetch('/api/owner/users')
      const { accounts } = await response.json()
      setAccounts(accounts || [])
      
    } catch (error: any) {
      toast.error("Failed to update account: " + error.message)
    }
  }

  const handleDelete = async () => {
    if (!selected) return

    try {
      const res = await fetch("/api/owner/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(`Error: ${err.message}`)
        return
      }

      toast.success("Account deleted successfully")
      setOpenDelete(false)
      setSelected(null)
      
      // Refresh accounts
      const response = await fetch('/api/owner/users')
      const { accounts } = await response.json()
      setAccounts(accounts || [])
      
    } catch (error: any) {
      toast.error("Failed to delete account: " + error.message)
    }
  }

  const employees = accounts.filter(acc => acc.role === "employee")
  const deliverymen = accounts.filter(acc => acc.role === "deliveryman")

  const renderCardTable = (
    title: string,
    data: Account[],
    role: "employee" | "deliveryman",
    search: string,
    setSearch: (val: string) => void
  ) => {
    const filteredData = data.filter((acc) =>
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.branch_name.toLowerCase().includes(search.toLowerCase())
    )

    return (
      <Card className="mb-8">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="Search by name or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 sm:w-60"
            />
            <Button
              onClick={() => handleOpenAdd(role)}
              className="w-full sm:w-auto"
              disabled={branches.length === 0}
            >
              + Add {role === "employee" ? "Employee" : "Deliveryman"}
              {branches.length === 0 && " (No Branches)"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-1/5">Name</th>
                  <th className="p-2 w-1/5">Email</th>
                  <th className="p-2 w-1/5">Role</th>
                  <th className="p-2 w-1/5">Branch</th>
                  <th className="p-2 w-1/5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((acc) => (
                    <tr key={acc.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{acc.name}</td>
                      <td className="p-2">{acc.email}</td>
                      <td className="p-2 capitalize">{acc.role}</td>
                      <td className="p-2">{acc.branch_name}</td>
                      <td className="p-2 flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(acc)
                            setNewName(acc.name)
                            setNewEmail(acc.email)
                            setNewPassword("")
                            setNewRole(acc.role)
                            setSelectedBranchId(acc.branch_id)
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
                    <td colSpan={5} className="text-center p-4 text-gray-500">
                      No {role}s found
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

  if (loading || !isAuthorized) {
    return (
      <DashboardLayout>
        <Toaster position="top-right" richColors />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {!isAuthorized ? "Checking permissions..." : "Loading accounts..."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Toaster position="top-right" richColors />
      <div className="p-4 sm:p-6 space-y-8">
        <h1 className="text-2xl font-bold">Manage Accounts</h1>
        
        {branches.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              <strong>No branches found.</strong> Please create branches first before adding employees or delivery personnel.
            </p>
          </div>
        )}
        
        {renderCardTable("Employee Accounts", employees, "employee", searchEmployee, setSearchEmployee)}
        {renderCardTable("Deliveryman Accounts", deliverymen, "deliveryman", searchDelivery, setSearchDelivery)}

        {/* Add Modal */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {newRole}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input 
                placeholder={`Enter ${newRole} name`} 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
              />
              <Input 
                placeholder="Enter email" 
                type="email" 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)} 
              />
              <Input 
                placeholder="Enter password" 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
              
              {branches.length > 0 ? (
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-red-500 text-sm">
                  No branches available. Please create branches first.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                onClick={handleAdd} 
                className="w-full sm:w-auto"
                disabled={!selectedBranchId || branches.length === 0}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {selected?.role}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input 
                placeholder="Enter name" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
              />
              <Input 
                placeholder="Enter email" 
                type="email" 
                value={newEmail} 
                disabled 
              />
              <Input 
                placeholder="Enter new password (leave blank to keep current)" 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <p>Are you sure you want to delete <b>{selected?.name}</b> from <b>{selected?.branch_name}</b>?</p>
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