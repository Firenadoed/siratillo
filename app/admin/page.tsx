"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/lib/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/lib/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/lib/ui/alert-dialog";
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [searchShop, setSearchShop] = useState("");
  const [searchOwner, setSearchOwner] = useState("");

  // Dialog states
  const [openAddShop, setOpenAddShop] = useState(false);
  const [openAddBranch, setOpenAddBranch] = useState<{ open: boolean; shopId: string | null }>({ open: false, shopId: null });
  const [openAddOwner, setOpenAddOwner] = useState(false);

  // Form states
  const [newShopName, setNewShopName] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchLocation, setBranchLocation] = useState<[number, number] | null>([9.308, 123.308]);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerShop, setNewOwnerShop] = useState("");

  // Editing states
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);

  // Deletion states
  const [deleteShopId, setDeleteShopId] = useState<string | null>(null);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);
  const [deleteOwnerId, setDeleteOwnerId] = useState<string | null>(null);

  // ==============================
  // Authentication & Authorization Check
  // ==============================
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/check-auth');
        const { authorized, error } = await response.json();
        
        if (!response.ok || !authorized) {
          toast.error(error || "Access denied");
          router.replace("/login");
          return;
        }

        setIsAuthorized(true);
        setLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("Authentication error");
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router]);

  // ==============================
  // Fetch data only when authorized
  // ==============================
  useEffect(() => {
    if (isAuthorized) {
      fetchShops();
      fetchOwners();
    }
  }, [isAuthorized]);

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/admin/shops');
      const { shops, error } = await response.json();
      
      if (error) throw new Error(error);
      setShops(shops || []);
    } catch (error: any) {
      toast.error("Failed to fetch shops: " + error.message);
    }
  };

  const fetchOwners = async () => {
    try {
      const response = await fetch('/api/admin/owners');
      const { owners, error } = await response.json();
      
      if (error) throw new Error(error);
      
      // Transform the data to match your existing structure
      const transformedOwners = owners.map((owner: any) => ({
        id: owner.user_id,
        full_name: owner.users?.full_name || '',
        email: owner.users?.email || '',
        shop_id: owner.shops?.id || ''
      }));
      
      setOwners(transformedOwners);
    } catch (error: any) {
      toast.error("Failed to fetch owners: " + error.message);
    }
  };

  // ==============================
  // Handlers - UPDATED TO USE API ROUTES
  // ==============================
  const handleLogout = async () => {
    try {
      // You'll need to create a logout API route or keep client-side logout
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.replace('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };

  // Add/Edit/Delete Shop - SECURE
  const handleSaveShop = async () => {
    if (!newShopName.trim()) return toast.error("Shop name required");
    
    try {
      const url = editingShop ? `/api/admin/shops/${editingShop.id}` : '/api/admin/shops';
      const method = editingShop ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShopName,
          description: newShopAddress
        })
      });
      
      const { shop, error } = await response.json();
      
      if (error) throw new Error(error);
      
      setOpenAddShop(false);
      setNewShopName("");
      setNewShopAddress("");
      setEditingShop(null);
      fetchShops();
      toast.success(editingShop ? "Shop updated" : "Shop added");
    } catch (error: any) {
      toast.error("Failed to save shop: " + error.message);
    }
  };

  const handleDeleteShop = async () => {
    if (!deleteShopId) return;
    
    try {
      const response = await fetch(`/api/admin/shops/${deleteShopId}`, {
        method: 'DELETE'
      });
      
      const { error } = await response.json();
      
      if (error) throw new Error(error);
      
      setDeleteShopId(null);
      fetchShops();
      toast.success("Shop deleted");
    } catch (error: any) {
      toast.error("Failed to delete shop: " + error.message);
    }
  };

  // Add/Edit/Delete Branch - SECURE
  const handleSaveBranch = async () => {
    if (!branchLocation || !openAddBranch.shopId) return toast.error("Select branch location.");
    
    try {
      const url = editingBranch ? `/api/admin/branches/${editingBranch.id}` : '/api/admin/branches';
      const method = editingBranch ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: openAddBranch.shopId,
          name: branchName,
          address: branchAddress,
          latitude: branchLocation[0],
          longitude: branchLocation[1]
        })
      });
      
      const { branch, error } = await response.json();
      
      if (error) throw new Error(error);
      
      setOpenAddBranch({ open: false, shopId: null });
      setBranchName("");
      setBranchAddress("");
      setBranchLocation([9.308, 123.308]);
      setEditingBranch(null);
      fetchShops();
      toast.success(editingBranch ? "Branch updated" : "Branch added");
    } catch (error: any) {
      toast.error("Failed to save branch: " + error.message);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deleteBranchId) return;
    
    try {
      const response = await fetch(`/api/admin/branches/${deleteBranchId}`, {
        method: 'DELETE'
      });
      
      const { error } = await response.json();
      
      if (error) throw new Error(error);
      
      setDeleteBranchId(null);
      fetchShops();
      toast.success("Branch deleted");
    } catch (error: any) {
      toast.error("Failed to delete branch: " + error.message);
    }
  };

  // Add/Edit/Delete Owner - SECURE
  const handleSaveOwner = async () => {
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) return toast.error("Name and Email required");
    
    try {
      if (editingOwner) {
        // For editing, you might need to create an update owner API
        toast.error("Owner editing not implemented yet");
        return;
      } else {
        if (!newOwnerPassword.trim()) return toast.error("Password required for new owner");
        if (!newOwnerShop) return toast.error("Please select a shop");
        
        const response = await fetch('/api/admin/owners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: newOwnerName,
            email: newOwnerEmail,
            password: newOwnerPassword,
            shop_id: newOwnerShop
          })
        });
        
        const { success, error } = await response.json();
        
        if (error) throw new Error(error);
        
        setOpenAddOwner(false);
        setNewOwnerName("");
        setNewOwnerEmail("");
        setNewOwnerPassword("");
        setNewOwnerShop("");
        fetchOwners();
        toast.success("Owner added successfully");
      }
    } catch (error: any) {
      toast.error("Failed to save owner: " + error.message);
    }
  };

  const handleDeleteOwner = async () => {
    if (!deleteOwnerId) return;
    
    try {
      const response = await fetch(`/api/admin/users/${deleteOwnerId}`, {
        method: 'DELETE'
      });
      
      const { error } = await response.json();
      
      if (error) throw new Error(error);
      
      setDeleteOwnerId(null);
      fetchOwners();
      toast.success("Owner deleted");
    } catch (error: any) {
      toast.error("Failed to delete owner: " + error.message);
    }
  };

  // ==============================
  // Filtered lists
  // ==============================
  const filteredShops = shops.filter(s => s.name.toLowerCase().includes(searchShop.toLowerCase()));
  const filteredOwners = owners.filter(o => o.full_name.toLowerCase().includes(searchOwner.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  // ==============================
  // JSX Render (Mostly unchanged)
  // ==============================
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8">
      <Toaster position="top-right" richColors />
      <header className="bg-purple-700 text-white py-3 px-4 md:px-6 rounded-md shadow-md flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left truncate">Superadmin Dashboard</h1>
        <Button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 w-full md:w-auto">Logout</Button>
      </header>

      {/* =================== Shops Card =================== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-wrap">
          <CardTitle className="text-xl font-semibold">Laundry Shops</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
            <Input 
              placeholder="Search shop..." 
              value={searchShop} 
              onChange={(e) => setSearchShop(e.target.value)} 
              className="flex-1 min-w-[200px]" 
            />
            <Button 
              className="w-full sm:w-auto" 
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
        <CardContent className="flex flex-col gap-4">
          {filteredShops.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No shops found</p>
          ) : (
            filteredShops.map((shop) => (
              <div key={shop.id} className="border rounded-md p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{shop.name}</p>
                  {shop.description && (
                    <p className="text-sm text-gray-600 mt-1">{shop.description}</p>
                  )}
                  {shop.branches.map((b) => (
                    <div key={b.id} className="mt-2 border p-2 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-wrap">
                      <span className="truncate">{b.name} ({b.address})</span>
                      <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
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
                            <Button size="sm" variant="destructive">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { setDeleteBranchId(b.id); handleDeleteBranch(); }}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-2 sm:mt-0">
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
                      <Button size="sm" variant="destructive">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shop?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setDeleteShopId(shop.id); handleDeleteShop(); }}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button 
                    size="sm" 
                    onClick={() => setOpenAddBranch({ open: true, shopId: shop.id })}
                  >
                    + Add Branch
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* =================== Owners Card =================== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-wrap">
          <CardTitle className="text-xl font-semibold">Owners</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
            <Input 
              placeholder="Search owner..." 
              value={searchOwner} 
              onChange={(e) => setSearchOwner(e.target.value)} 
              className="flex-1 min-w-[200px]" 
            />
            <Button 
              className="w-full sm:w-auto" 
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
        <CardContent className="flex flex-col gap-4">
          {filteredOwners.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No owners found</p>
          ) : (
            filteredOwners.map((owner) => {
              const shop = shops.find((s) => s.id === owner.shop_id);
              return (
                <div key={owner.id} className="border rounded-md p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{owner.full_name}</p>
                    <p className="text-sm text-gray-600 truncate">{owner.email}</p>
                    <p className="text-sm text-gray-600 truncate">{shop?.name || "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 sm:mt-0">
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
                        <Button size="sm" variant="destructive">Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Owner?</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { setDeleteOwnerId(owner.id); handleDeleteOwner(); }}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* =================== Shop Dialog =================== */}
      <Dialog open={openAddShop} onOpenChange={setOpenAddShop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShop ? "Edit Shop" : "Add Shop"}</DialogTitle>
          </DialogHeader>
          <Input 
            placeholder="Shop Name" 
            value={newShopName} 
            onChange={(e) => setNewShopName(e.target.value)} 
            className="mb-2" 
          />
          <Input 
            placeholder="Description" 
            value={newShopAddress} 
            onChange={(e) => setNewShopAddress(e.target.value)} 
            className="mb-2" 
          />
          <DialogFooter>
            <Button onClick={handleSaveShop}>
              {editingShop ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================== Branch Dialog =================== */}
      <Dialog open={openAddBranch.open} onOpenChange={(o) => setOpenAddBranch({ ...openAddBranch, open: o })}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <Input 
            placeholder="Branch Name" 
            value={branchName} 
            onChange={(e) => setBranchName(e.target.value)} 
            className="mb-2" 
          />
          <Input 
            placeholder="Address" 
            value={branchAddress} 
            onChange={(e) => setBranchAddress(e.target.value)} 
            className="mb-2" 
          />
          <BranchMap location={branchLocation} setLocation={setBranchLocation} />
          <DialogFooter>
            <Button onClick={handleSaveBranch}>
              {editingBranch ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================== Owner Dialog =================== */}
      <Dialog open={openAddOwner} onOpenChange={setOpenAddOwner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOwner ? "Edit Owner" : "Add Owner"}</DialogTitle>
          </DialogHeader>
          <Input 
            placeholder="Full Name" 
            value={newOwnerName} 
            onChange={(e) => setNewOwnerName(e.target.value)} 
            className="mb-2" 
          />
          <Input 
            placeholder="Email" 
            value={newOwnerEmail} 
            onChange={(e) => setNewOwnerEmail(e.target.value)} 
            className="mb-2" 
          />
          {!editingOwner && (
            <Input 
              placeholder="Password" 
              type="password" 
              value={newOwnerPassword} 
              onChange={(e) => setNewOwnerPassword(e.target.value)} 
              className="mb-2" 
            />
          )}
          <Select onValueChange={setNewOwnerShop} value={newOwnerShop}>
            <SelectTrigger className="w-full mb-2">
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
          <DialogFooter>
            <Button onClick={handleSaveOwner}>
              {editingOwner ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}