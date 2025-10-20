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

  // Loading states for forms
  const [isSubmittingShop, setIsSubmittingShop] = useState(false);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);

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
  const handleSaveShop = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isSubmittingShop) return;
    if (!newShopName.trim()) return toast.error("Shop name required");
    
    setIsSubmittingShop(true);
    
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
    } finally {
      setIsSubmittingShop(false);
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
  const handleSaveBranch = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isSubmittingBranch) return;
    if (!branchLocation || !openAddBranch.shopId) return toast.error("Select branch location.");
    
    setIsSubmittingBranch(true);
    
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
    } finally {
      setIsSubmittingBranch(false);
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
  const handleSaveOwner = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isSubmittingOwner) return;
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) return toast.error("Name and Email required");
    
    setIsSubmittingOwner(true);
    
    try {
      if (editingOwner) {
        // EDIT EXISTING OWNER
        if (!newOwnerShop) {
          toast.error("Please select a shop");
          setIsSubmittingOwner(false);
          return;
        }
        
        const response = await fetch(`/api/admin/owners/${editingOwner.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: newOwnerName,
            email: newOwnerEmail,
            shop_id: newOwnerShop
          })
        });
        
        const { success, error, owner } = await response.json();
        
        if (error) throw new Error(error);
        
        setOpenAddOwner(false);
        resetOwnerForm();
        fetchOwners();
        toast.success("Owner updated successfully");
      } else {
        // ADD NEW OWNER
        if (!newOwnerPassword.trim()) {
          toast.error("Password required for new owner");
          setIsSubmittingOwner(false);
          return;
        }
        if (!newOwnerShop) {
          toast.error("Please select a shop");
          setIsSubmittingOwner(false);
          return;
        }
        
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
        resetOwnerForm();
        fetchOwners();
        toast.success("Owner added successfully");
      }
    } catch (error: any) {
      toast.error("Failed to save owner: " + error.message);
    } finally {
      setIsSubmittingOwner(false);
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

  // Reset form states when dialogs close
  const resetShopForm = () => {
    setNewShopName("");
    setNewShopAddress("");
    setEditingShop(null);
    setIsSubmittingShop(false);
  };

  const resetBranchForm = () => {
    setBranchName("");
    setBranchAddress("");
    setBranchLocation([9.308, 123.308]);
    setEditingBranch(null);
    setOpenAddBranch({ open: false, shopId: null });
    setIsSubmittingBranch(false);
  };

  const resetOwnerForm = () => {
    setNewOwnerName("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setNewOwnerShop("");
    setEditingOwner(null);
    setIsSubmittingOwner(false);
  };

  // ==============================
  // Filtered lists
  // ==============================
  const filteredShops = shops.filter(s => s.name.toLowerCase().includes(searchShop.toLowerCase()));
  const filteredOwners = owners.filter(o => 
    o.full_name.toLowerCase().includes(searchOwner.toLowerCase()) ||
    o.email.toLowerCase().includes(searchOwner.toLowerCase())
  );

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

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <Toaster position="top-center" richColors />
      
      {/* Header - Mobile Optimized */}
      <header className="bg-purple-700 text-white py-3 px-3 sm:px-4 rounded-lg shadow-md">
        <div className="flex flex-col xs:flex-row justify-between items-center gap-2">
          <h1 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold text-center xs:text-left break-words max-w-full">
            Superadmin Dashboard
          </h1>
          <Button 
            onClick={handleLogout} 
            className="bg-red-500 hover:bg-red-600 w-full xs:w-auto text-xs xs:text-sm py-2 h-9 min-h-9"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* =================== Shops Card =================== */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-base xs:text-lg sm:text-xl font-semibold break-words">Laundry Shops</CardTitle>
            <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
              <Input 
                placeholder="Search shop..." 
                value={searchShop} 
                onChange={(e) => setSearchShop(e.target.value)} 
                className="flex-1 min-w-0 text-xs xs:text-sm sm:text-base h-9" 
              />
              <Button 
                className="w-full xs:w-auto text-xs xs:text-sm h-9 min-h-9 whitespace-nowrap"
                onClick={() => { 
                  resetShopForm();
                  setOpenAddShop(true); 
                }}
              >
                + Add Shop
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6">
          {filteredShops.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-xs xs:text-sm">No shops found</p>
          ) : (
            <div className="space-y-3">
              {filteredShops.map((shop) => (
                <div key={shop.id} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                  {/* Shop Header */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm xs:text-base sm:text-lg break-words">{shop.name}</p>
                      {shop.description && (
                        <p className="text-xs text-gray-600 mt-1 break-words">{shop.description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 justify-start">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs h-8 px-2 min-w-[60px] flex-1 xs:flex-none"
                        onClick={(e) => { 
                          e.stopPropagation();
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
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="text-xs h-8 px-2 min-w-[60px] flex-1 xs:flex-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-lg mx-2">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm xs:text-base sm:text-lg text-center sm:text-left">
                              Delete Shop?
                            </AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex flex-row gap-2 sm:gap-0">
                            <AlertDialogCancel 
                              className="flex-1 text-xs xs:text-sm h-9 min-h-9"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              className="flex-1 text-xs xs:text-sm h-9 min-h-9 bg-red-600 hover:bg-red-700"
                              onClick={(e) => { 
                                e.stopPropagation();
                                setDeleteShopId(shop.id); 
                                handleDeleteShop(); 
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button 
                        size="sm"
                        className="text-xs h-8 px-2 min-w-[80px] flex-1 xs:flex-none bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenAddBranch({ open: true, shopId: shop.id });
                        }}
                      >
                        + Branch
                      </Button>
                    </div>
                  </div>

                  {/* Branches List */}
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs xs:text-sm font-medium text-gray-700 mb-2">Branches:</p>
                    {shop.branches && shop.branches.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {shop.branches.map((b) => (
                          <div key={b.id} className="border border-gray-100 rounded-md p-2 bg-gray-50">
                            <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs xs:text-sm break-words">{b.name}</p>
                                <p className="text-xs text-gray-600 break-words">{b.address}</p>
                              </div>
                              <div className="flex flex-wrap gap-1 justify-start">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-xs h-7 px-2 min-w-[50px]"
                                  onClick={() => { 
                                    setEditingBranch(b); 
                                    setBranchName(b.name); 
                                    setBranchAddress(b.address); 
                                    setBranchLocation([b.lat || 9.308, b.lng || 123.308]); 
                                    setOpenAddBranch({ open: true, shopId: shop.id }); 
                                  }}
                                >
                                  Edit
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      className="text-xs h-7 px-2 min-w-[50px]"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-lg mx-2">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-sm xs:text-base sm:text-lg text-center sm:text-left">
                                        Delete Branch?
                                      </AlertDialogTitle>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex flex-row gap-2 sm:gap-0">
                                      <AlertDialogCancel 
                                        className="flex-1 text-xs xs:text-sm h-9 min-h-9"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="flex-1 text-xs xs:text-sm h-9 min-h-9 bg-red-600 hover:bg-red-700"
                                        onClick={(e) => { 
                                          e.stopPropagation();
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
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">No branches</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================== Owners Card =================== */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle className="text-base xs:text-lg sm:text-xl font-semibold break-words">Owners</CardTitle>
            <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
              <Input 
                placeholder="Search owner..." 
                value={searchOwner} 
                onChange={(e) => setSearchOwner(e.target.value)} 
                className="flex-1 min-w-0 text-xs xs:text-sm sm:text-base h-9" 
              />
              <Button 
                className="w-full xs:w-auto text-xs xs:text-sm h-9 min-h-9 whitespace-nowrap"
                onClick={() => { 
                  resetOwnerForm();
                  setOpenAddOwner(true); 
                }}
              >
                + Add Owner
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6">
          {filteredOwners.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-xs xs:text-sm">No owners found</p>
          ) : (
            <div className="space-y-3">
              {filteredOwners.map((owner) => {
                const shop = shops.find((s) => s.id === owner.shop_id);
                return (
                  <div key={owner.id} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm xs:text-base break-words">{owner.full_name}</p>
                        <p className="text-xs text-gray-600 break-words mt-1">{owner.email}</p>
                        <p className="text-xs text-gray-700 mt-1">
                          Shop: <span className="font-medium break-words">{shop?.name || "Not assigned"}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-start mt-2 sm:mt-0">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-xs h-8 px-2 min-w-[60px] flex-1 xs:flex-none"
                          onClick={(e) => { 
                            e.stopPropagation();
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
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="text-xs h-8 px-2 min-w-[60px] flex-1 xs:flex-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-lg mx-2">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-sm xs:text-base sm:text-lg text-center sm:text-left">
                                Delete Owner?
                              </AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex flex-row gap-2 sm:gap-0">
                              <AlertDialogCancel 
                                className="flex-1 text-xs xs:text-sm h-9 min-h-9"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                className="flex-1 text-xs xs:text-sm h-9 min-h-9 bg-red-600 hover:bg-red-700"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setDeleteOwnerId(owner.id); 
                                  handleDeleteOwner(); 
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================== Shop Dialog =================== */}
      <Dialog open={openAddShop} onOpenChange={(open) => {
        if (!open) resetShopForm();
        setOpenAddShop(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-lg mx-2">
          <DialogHeader>
            <DialogTitle className="text-base xs:text-lg sm:text-xl text-center sm:text-left">
              {editingShop ? "Edit Shop" : "Add Shop"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveShop();
          }}>
            <div className="space-y-3">
              <Input 
                placeholder="Shop Name" 
                value={newShopName} 
                onChange={(e) => setNewShopName(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
                required
              />
              <Input 
                placeholder="Description" 
                value={newShopAddress} 
                onChange={(e) => setNewShopAddress(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
              />
            </div>
            <DialogFooter className="mt-4 flex flex-col xs:flex-row gap-2">
              <Button 
                type="submit"
                disabled={isSubmittingShop}
                className="w-full xs:w-auto text-xs xs:text-sm h-10 min-h-10"
              >
                {isSubmittingShop ? "Saving..." : (editingShop ? "Update Shop" : "Add Shop")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================== Branch Dialog =================== */}
      <Dialog open={openAddBranch.open} onOpenChange={(open) => {
        if (!open) resetBranchForm();
        else setOpenAddBranch({ ...openAddBranch, open });
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl w-full h-[90vh] sm:h-[80vh] rounded-lg mx-2">
          <DialogHeader>
            <DialogTitle className="text-base xs:text-lg sm:text-xl text-center sm:text-left">
              {editingBranch ? "Edit Branch" : "Add Branch"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveBranch();
          }} className="h-full flex flex-col">
            <div className="space-y-3 flex-1 overflow-y-auto">
              <Input 
                placeholder="Branch Name" 
                value={branchName} 
                onChange={(e) => setBranchName(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
                required
              />
              <Input 
                placeholder="Address" 
                value={branchAddress} 
                onChange={(e) => setBranchAddress(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
                required
              />
              <div className="h-48 xs:h-56 sm:h-64 w-full border rounded-md overflow-hidden">
                <BranchMap location={branchLocation} setLocation={setBranchLocation} />
              </div>
            </div>
            <DialogFooter className="mt-4 flex flex-col xs:flex-row gap-2">
              <Button 
                type="submit"
                disabled={isSubmittingBranch}
                className="w-full xs:w-auto text-xs xs:text-sm h-10 min-h-10"
              >
                {isSubmittingBranch ? "Saving..." : (editingBranch ? "Update Branch" : "Add Branch")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================== Owner Dialog =================== */}
      <Dialog open={openAddOwner} onOpenChange={(open) => {
        if (!open) resetOwnerForm();
        setOpenAddOwner(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-lg mx-2">
          <DialogHeader>
            <DialogTitle className="text-base xs:text-lg sm:text-xl text-center sm:text-left">
              {editingOwner ? "Edit Owner" : "Add Owner"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveOwner();
          }}>
            <div className="space-y-3">
              <Input 
                placeholder="Full Name" 
                value={newOwnerName} 
                onChange={(e) => setNewOwnerName(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
                required
              />
              <Input 
                placeholder="Email" 
                type="email"
                value={newOwnerEmail} 
                onChange={(e) => setNewOwnerEmail(e.target.value)} 
                className="text-xs xs:text-sm sm:text-base h-10"
                required
              />
              {/* Only show password field when adding new owner */}
              {!editingOwner && (
                <Input 
                  placeholder="Password" 
                  type="password" 
                  value={newOwnerPassword} 
                  onChange={(e) => setNewOwnerPassword(e.target.value)} 
                  className="text-xs xs:text-sm sm:text-base h-10"
                  required
                />
              )}
              <Select onValueChange={setNewOwnerShop} value={newOwnerShop} required>
                <SelectTrigger className="w-full text-xs xs:text-sm sm:text-base h-10">
                  <SelectValue placeholder="Select Shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs xs:text-sm sm:text-base">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-4 flex flex-col xs:flex-row gap-2">
              <Button 
                type="submit"
                disabled={isSubmittingOwner}
                className="w-full xs:w-auto text-xs xs:text-sm h-10 min-h-10"
              >
                {isSubmittingOwner ? "Saving..." : (editingOwner ? "Update Owner" : "Add Owner")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}