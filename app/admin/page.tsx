"use client";

import { useState, useEffect } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";

// Dynamically import Leaflet map for client-side only
const BranchMap = dynamic(() => import("../../components/branchmap"), { ssr: false });

// Types
type Branch = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

type Shop = {
  id: string;
  name: string;
  description?: string;
  branches: Branch[];
};

type Owner = {
  id: string;
  full_name: string;
  email: string;
  shop_id: string;
};

export default function ManageShops() {
  const supabase = useSupabaseClient();

  // State
  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [searchShop, setSearchShop] = useState("");
  const [searchOwner, setSearchOwner] = useState("");

  const [openAddShop, setOpenAddShop] = useState(false);
  const [openAddOwner, setOpenAddOwner] = useState(false);
  const [openAddBranch, setOpenAddBranch] = useState<{ open: boolean; shopId: string | null }>({ open: false, shopId: null });

  // Forms
  const [newShopName, setNewShopName] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");

  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerShop, setNewOwnerShop] = useState("");

  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchLocation, setBranchLocation] = useState<[number, number] | null>([9.308, 123.308]);

  // Editing states
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Deletion states
  const [deleteShopId, setDeleteShopId] = useState<string | null>(null);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);
  const [deleteOwnerId, setDeleteOwnerId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchShops();
    fetchOwners();
  }, []);

  // ===============================
  // Fetch Shops
  // ===============================
  const fetchShops = async () => {
    const { data: shopsData, error } = await supabase
      .from("shops")
      .select(`
        id,
        name,
        description,
        shop_branches (
          id,
          name,
          address,
          latitude,
          longitude
        )
      `);

    if (error) {
      toast.error("Error fetching shops: " + error.message);
      return;
    }

    if (shopsData) {
      setShops(
        shopsData.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          branches:
            s.shop_branches?.map((b: any) => ({
              id: b.id,
              name: b.name,
              address: b.address,
              lat: b.latitude,
              lng: b.longitude,
            })) || [],
        }))
      );
    }
  };

  // ===============================
  // Fetch Owners
  // ===============================
  const fetchOwners = async () => {
    const { data, error } = await supabase
      .from("shop_user_assignments")
      .select(`
        user_id,
        role_in_shop,
        users (
          id,
          full_name,
          email
        ),
        shops (
          id,
          name
        )
      `)
      .eq("role_in_shop", "owner"); // only owners

    if (error) {
      toast.error("Error fetching owners: " + error.message);
      return;
    }

    if (data) {
      const mappedOwners: Owner[] = data.map((a: any) => ({
        id: a.user_id,
        full_name: a.users.full_name,
        email: a.users.email,
        shop_id: a.shops.id,
      }));
      setOwners(mappedOwners);
    }
  };

  // ===============================
  // Add / Edit Shop
  // ===============================
  const handleSaveShop = async () => {
    if (editingShop) {
      const { error } = await supabase.from("shops").update({ name: newShopName, description: newShopAddress }).eq("id", editingShop.id);
      if (error) return toast.error("Failed to update shop: " + error.message);
      setEditingShop(null);
    } else {
      const { error } = await supabase.from("shops").insert([{ name: newShopName, description: newShopAddress }]);
      if (error) return toast.error("Failed to add shop: " + error.message);
    }

    setOpenAddShop(false);
    setNewShopName("");
    setNewShopAddress("");
    fetchShops();
    toast.success(editingShop ? "Shop updated" : "Shop added");
  };

  const handleDeleteShop = async () => {
    if (!deleteShopId) return;
    const { error } = await supabase.from("shops").delete().eq("id", deleteShopId);
    if (error) return toast.error("Failed to delete shop: " + error.message);
    fetchShops();
    toast.success("Shop deleted");
    setDeleteShopId(null);
  };

  // ===============================
  // Add / Edit Branch
  // ===============================
  const handleSaveBranch = async () => {
    if (!branchLocation || !openAddBranch.shopId) return toast.error("Select branch location.");

    if (editingBranch) {
      const { error } = await supabase
        .from("shop_branches")
        .update({
          name: branchName,
          address: branchAddress,
          latitude: branchLocation[0],
          longitude: branchLocation[1],
        })
        .eq("id", editingBranch.id);
      if (error) return toast.error("Failed to update branch: " + error.message);
      setEditingBranch(null);
    } else {
      const { error } = await supabase.from("shop_branches").insert([
        {
          shop_id: openAddBranch.shopId,
          name: branchName,
          address: branchAddress,
          latitude: branchLocation[0],
          longitude: branchLocation[1],
        },
      ]);
      if (error) return toast.error("Failed to add branch: " + error.message);
    }

    setOpenAddBranch({ open: false, shopId: null });
    setBranchName("");
    setBranchAddress("");
    setBranchLocation([9.308, 123.308]);
    fetchShops();
    toast.success(editingBranch ? "Branch updated" : "Branch added");
  };

  const handleDeleteBranch = async () => {
    if (!deleteBranchId) return;
    const { error } = await supabase.from("shop_branches").delete().eq("id", deleteBranchId);
    if (error) return toast.error("Failed to delete branch: " + error.message);
    fetchShops();
    toast.success("Branch deleted");
    setDeleteBranchId(null);
  };

  // ===============================
  // Add / Edit Owner
  // ===============================
  const handleSaveOwner = async () => {
    if (editingOwner) {
      const { error } = await supabase.from("users").update({ full_name: newOwnerName, email: newOwnerEmail }).eq("id", editingOwner.id);
      if (error) return toast.error("Failed to update owner: " + error.message);
      setEditingOwner(null);
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newOwnerEmail,
        password: newOwnerPassword,
      });
      if (authError) return toast.error("Auth error: " + authError.message);

      const userId = authData.user?.id;
      if (!userId) return toast.error("Failed to create user.");

      const { error: userError } = await supabase.from("users").insert([{ id: userId, full_name: newOwnerName, email: newOwnerEmail }]);
      if (userError) return toast.error("Failed to insert user: " + userError.message);

      const { data: roleData, error: roleError } = await supabase.from("roles").select("id").eq("name", "owner").single();
      if (roleError) return toast.error("Failed to fetch role: " + roleError.message);

      const { error: userRoleError } = await supabase.from("user_roles").insert([{ user_id: userId, role_id: roleData.id }]);
      if (userRoleError) return toast.error("Failed to assign user role: " + userRoleError.message);

      const { error: assignError } = await supabase.from("shop_user_assignments").insert([{ user_id: userId, shop_id: newOwnerShop, role_in_shop: "owner" }]);
      if (assignError) return toast.error("Failed to assign owner: " + assignError.message);
    }

    setOpenAddOwner(false);
    setNewOwnerName("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setNewOwnerShop("");
    fetchOwners();
    fetchShops();
    toast.success(editingOwner ? "Owner updated" : "Owner added");
  };

  const handleDeleteOwner = async () => {
    if (!deleteOwnerId) return;

    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deleteOwnerId }),
    });

    const data = await res.json();
    if (res.ok) {
      toast.success("Owner deleted successfully");
      fetchOwners();
      fetchShops();
      setDeleteOwnerId(null);
    } else {
      toast.error("Failed to delete owner: " + data.error);
    }
  };

  // Filtered lists
  const filteredShops = shops.filter((s) => s.name.toLowerCase().includes(searchShop.toLowerCase()));
  const filteredOwners = owners.filter((o) => o.full_name.toLowerCase().includes(searchOwner.toLowerCase()));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Toaster position="top-right" richColors />
      <header className="bg-purple-700 text-white py-3 px-4 md:px-6 rounded-md shadow-md flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left">Superadmin</h1>
        <Button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 w-full md:w-auto">
          Logout
        </Button>
      </header>

      {/* Shops Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-xl font-semibold">Laundry Shops</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input placeholder="Search shop..." value={searchShop} onChange={(e) => setSearchShop(e.target.value)} className="flex-1 sm:w-60" />
            <Button
              onClick={() => {
                setEditingShop(null);
                setNewShopName("");
                setNewShopAddress("");
                setOpenAddShop(true);
              }}
            >
              + Add Shop
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-1/3">Shop</th>
                  <th className="p-2 w-1/3">Branches</th>
                  <th className="p-2 w-1/3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map((shop) => (
                  <tr key={shop.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">{shop.name}</td>
                    <td className="p-2 space-y-1">
                      {shop.branches.map((b) => (
                        <div key={b.id} className="flex items-center gap-2 flex-wrap">
                          {b.name} ({b.address})
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingBranch(b);
                              setBranchName(b.name);
                              setBranchAddress(b.address);
                              setBranchLocation([b.lat!, b.lng!]);
                              setOpenAddBranch({ open: true, shopId: shop.id });
                            }}
                          >
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setDeleteBranchId(b.id);
                                    handleDeleteBranch();
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </td>
                    <td className="p-2 flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingShop(shop);
                          setNewShopName(shop.name);
                          setNewShopAddress(shop.description || "");
                          setOpenAddShop(true);
                        }}
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Shop?</AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                setDeleteShopId(shop.id);
                                handleDeleteShop();
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button size="sm" onClick={() => setOpenAddBranch({ open: true, shopId: shop.id })}>
                        + Add Branch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Owners Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-xl font-semibold">Owners</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input placeholder="Search owner..." value={searchOwner} onChange={(e) => setSearchOwner(e.target.value)} className="flex-1 sm:w-60" />
            <Button
              onClick={() => {
                setEditingOwner(null);
                setNewOwnerName("");
                setNewOwnerEmail("");
                setNewOwnerPassword("");
                setNewOwnerShop("");
                setOpenAddOwner(true);
              }}
            >
              + Add Owner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea>
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Shop</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.map((owner) => {
                  const shop = shops.find((s) => s.id === owner.shop_id);
                  return (
                    <tr key={owner.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{owner.full_name}</td>
                      <td className="p-2">{owner.email}</td>
                      <td className="p-2">{shop?.name || "—"}</td>
                      <td className="p-2 flex gap-1 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingOwner(owner);
                            setNewOwnerName(owner.full_name);
                            setNewOwnerEmail(owner.email);
                            setNewOwnerShop(owner.shop_id);
                            setOpenAddOwner(true);
                          }}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Owner?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setDeleteOwnerId(owner.id);
                                  handleDeleteOwner();
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add / Edit Shop Dialog */}
      <Dialog open={openAddShop} onOpenChange={setOpenAddShop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShop ? "Edit Shop" : "Add Shop"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Shop Name" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} />
            <Input placeholder="Description" value={newShopAddress} onChange={(e) => setNewShopAddress(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveShop}>{editingShop ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={openAddBranch.open} onOpenChange={(open) => setOpenAddBranch({ ...openAddBranch, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Branch Name" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            <Input placeholder="Address" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} />
            {branchLocation && <BranchMap location={branchLocation} setLocation={setBranchLocation} />}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveBranch}>{editingBranch ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Owner Dialog */}
      <Dialog open={openAddOwner} onOpenChange={setOpenAddOwner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOwner ? "Edit Owner" : "Add Owner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Full Name" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} />
            <Input placeholder="Email" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} />
            {!editingOwner && <Input placeholder="Password" type="password" value={newOwnerPassword} onChange={(e) => setNewOwnerPassword(e.target.value)} />}
            <Select onValueChange={setNewOwnerShop} value={newOwnerShop}>
              <SelectTrigger>
                <SelectValue placeholder="Select Shop" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveOwner}>{editingOwner ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
