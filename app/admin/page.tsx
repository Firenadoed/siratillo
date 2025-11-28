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
import { 
  LogOut, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin,
  Building,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from "lucide-react";

// Dynamically import Leaflet map for client-side only
const BranchMap = dynamic(() => import("../../components/branchmap"), { 
  ssr: false,
  loading: () => (
    <div className="h-64 xs:h-72 sm:h-80 w-full flex items-center justify-center bg-gray-100 rounded-xl">
      <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
    </div>
  )
});

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

type AccountRequest = {
  id: string;
  name: string;
  email: string;
  contact: string;
  shop_name: string;
  shop_address: string;
  latitude: number;
  longitude: number;
  location_address: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
};

export default function ManageShops() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([]);
  const [searchShop, setSearchShop] = useState("");
  const [searchOwner, setSearchOwner] = useState("");
  const [searchRequests, setSearchRequests] = useState("");

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

  // Loading states
  const [isSubmittingShop, setIsSubmittingShop] = useState(false);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);

  // NEW: Logout states
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Pagination states
  const [shopPage, setShopPage] = useState(1);
  const [ownerPage, setOwnerPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const itemsPerPage = 5;

  // Collapsible states
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [showAccountRequests, setShowAccountRequests] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<string | null>(null);

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
      fetchAccountRequests();
    }
  }, [isAuthorized]);

  const fetchShops = async () => {
    setIsLoadingShops(true);
    try {
      const response = await fetch('/api/admin/shops');
      const { shops, error } = await response.json();
      
      if (error) throw new Error(error);
      setShops(shops || []);
    } catch (error: any) {
      toast.error("Failed to fetch shops: " + error.message);
    } finally {
      setIsLoadingShops(false);
    }
  };

  const fetchOwners = async () => {
    setIsLoadingOwners(true);
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
    } finally {
      setIsLoadingOwners(false);
    }
  };

  const fetchAccountRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const response = await fetch('/api/admin/account-requests');
      const { requests, error } = await response.json();
      
      if (error) throw new Error(error);
      setAccountRequests(requests || []);
    } catch (error: any) {
      toast.error("Failed to fetch account requests: " + error.message);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // ==============================
  // NEW: Enhanced Logout Handler
  // ==============================
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        toast.success("Logged out successfully");
        router.replace('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // ==============================
  // Account Request Handlers
  // ==============================
  const handleProcessRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setIsProcessingRequest(requestId);
    try {
      const response = await fetch(`/api/admin/account-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const { success, error } = await response.json();
      
      if (error) throw new Error(error);
      
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchAccountRequests(); // Refresh the list
      fetchShops(); // Refresh shops in case new one was created
      fetchOwners(); // Refresh owners in case new one was created
    } catch (error: any) {
      toast.error(`Failed to ${action} request: ${error.message}`);
    } finally {
      setIsProcessingRequest(null);
    }
  };

  // ==============================
  // Other Handlers
  // ==============================
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
      resetShopForm();
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
      resetBranchForm();
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

  // Toggle shop expansion
  const toggleShopExpansion = (shopId: string) => {
    const newExpanded = new Set(expandedShops);
    if (newExpanded.has(shopId)) {
      newExpanded.delete(shopId);
    } else {
      newExpanded.add(shopId);
    }
    setExpandedShops(newExpanded);
  };

  // Toggle mobile menu
  const toggleMobileMenu = (itemId: string) => {
    setMobileMenuOpen(mobileMenuOpen === itemId ? null : itemId);
  };

  // ==============================
  // Filtered and paginated lists
  // ==============================
  const filteredShops = shops.filter(s => s.name.toLowerCase().includes(searchShop.toLowerCase()));
  const filteredOwners = owners.filter(o => 
    o.full_name.toLowerCase().includes(searchOwner.toLowerCase()) ||
    o.email.toLowerCase().includes(searchOwner.toLowerCase())
  );
  const filteredRequests = accountRequests.filter(r => 
    r.name.toLowerCase().includes(searchRequests.toLowerCase()) ||
    r.shop_name.toLowerCase().includes(searchRequests.toLowerCase()) ||
    r.email.toLowerCase().includes(searchRequests.toLowerCase())
  );

  // Pagination calculations
  const shopStartIndex = (shopPage - 1) * itemsPerPage;
  const shopEndIndex = shopStartIndex + itemsPerPage;
  const paginatedShops = filteredShops.slice(shopStartIndex, shopEndIndex);
  const totalShopPages = Math.ceil(filteredShops.length / itemsPerPage);

  const ownerStartIndex = (ownerPage - 1) * itemsPerPage;
  const ownerEndIndex = ownerStartIndex + itemsPerPage;
  const paginatedOwners = filteredOwners.slice(ownerStartIndex, ownerEndIndex);
  const totalOwnerPages = Math.ceil(filteredOwners.length / itemsPerPage);

  const requestsStartIndex = (requestsPage - 1) * itemsPerPage;
  const requestsEndIndex = requestsStartIndex + itemsPerPage;
  const paginatedRequests = filteredRequests.slice(requestsStartIndex, requestsEndIndex);
  const totalRequestsPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const pendingRequestsCount = accountRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
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
    <div className="flex h-screen overflow-hidden">
      <Toaster position="top-center" richColors />
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showAccountRequests ? 'lg:mr-80' : ''}`}>
        {/* Header - Fixed */}
        <header className="bg-purple-700 text-white py-4 px-4 sm:px-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 sm:h-7 sm:w-7" />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                Superadmin Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowAccountRequests(!showAccountRequests)}
                className="bg-green-600 hover:bg-green-700 text-sm sm:text-base py-3 h-12 min-h-12 flex items-center gap-2 px-4"
              >
                <Users className="h-5 w-5" />
                <span className="hidden sm:inline">Account Requests</span>
                {pendingRequestsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingRequestsCount}
                  </span>
                )}
              </Button>
              
              {/* NEW: Logout Button with Confirmation */}
              <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <AlertDialogTrigger asChild>
                  <Button 
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                    className="bg-red-500 hover:bg-red-600 text-sm sm:text-base py-3 h-12 min-h-12 flex items-center gap-2 px-4"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5" />
                    )}
                    <span className="hidden sm:inline">
                      {isLoggingOut ? "Logging out..." : "Logout"}
                    </span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl mx-2">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg sm:text-xl text-center sm:text-left flex items-center gap-3">
                      <LogOut className="h-5 w-5 text-red-500" />
                      Confirm Logout
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <p className="text-gray-600 text-center sm:text-left">
                      Are you sure you want to logout? You'll need to login again to access the dashboard.
                    </p>
                  </div>
                  <AlertDialogFooter className="flex flex-row gap-3 sm:gap-0">
                    <AlertDialogCancel 
                      className="flex-1 text-sm h-12 min-h-12"
                      disabled={isLoggingOut}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      className="flex-1 text-sm h-12 min-h-12 bg-red-600 hover:bg-red-700"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Logging out...
                        </>
                      ) : (
                        "Logout"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </header>

        {/* Main Content - Centered Shops and Owners */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* =================== Shops Card =================== */}
            <Card className="w-full overflow-hidden border-0 shadow-lg rounded-xl">
              <CardHeader className="pb-4 px-4 sm:px-6 bg-gray-50">
                <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
                  <div className="flex items-center gap-3">
                    <Building className="h-6 w-6 text-purple-600" />
                    <CardTitle className="text-xl sm:text-2xl font-semibold break-words">Laundry Shops</CardTitle>
                  </div>
                  <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input 
                        placeholder="Search shop..." 
                        value={searchShop} 
                        onChange={(e) => setSearchShop(e.target.value)} 
                        className="flex-1 min-w-0 text-sm sm:text-base h-12 pl-12 text-lg" 
                      />
                    </div>
                    <Button 
                      className="w-full xs:w-auto text-sm sm:text-base h-12 min-h-12 whitespace-nowrap flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4"
                      onClick={() => { 
                        resetShopForm();
                        setOpenAddShop(true); 
                      }}
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Shop</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 sm:px-6">
                {isLoadingShops ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mr-3" />
                    <span className="text-lg text-gray-600">Loading shops...</span>
                  </div>
                ) : filteredShops.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-base sm:text-lg">
                    {searchShop ? "No shops match your search" : "No shops found"}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {paginatedShops.map((shop) => {
                      const isExpanded = expandedShops.has(shop.id);
                      const branchCount = shop.branches?.length || 0;
                      
                      return (
                        <div key={shop.id} className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-lg transition-all duration-200">
                          {/* Shop Header - Clickable for expansion */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleShopExpansion(shop.id)}
                          >
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                  <p className="font-semibold text-lg sm:text-xl break-words text-gray-900">
                                    {shop.name}
                                  </p>
                                  {branchCount > 0 && (
                                    <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                      {branchCount} branch{branchCount !== 1 ? 'es' : ''}
                                    </span>
                                  )}
                                </div>
                                {shop.description && (
                                  <p className="text-sm text-gray-600 break-words leading-relaxed mt-2">
                                    {shop.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Desktop Actions - ICONS ONLY */}
                                <div className="hidden sm:flex flex-wrap gap-1">
                                  {/* Edit Shop Icon */}
                                  <Button 
                                    size="icon"
                                    className="h-10 w-10 bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                                    onClick={(e) => { 
                                      e.stopPropagation();
                                      setEditingShop(shop); 
                                      setNewShopName(shop.name); 
                                      setNewShopAddress(shop.description || ""); 
                                      setOpenAddShop(true); 
                                    }}
                                    title="Edit Shop"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  
                                  {/* Add Branch Icon */}
                                  <Button 
                                    size="icon"
                                    className="h-10 w-10 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenAddBranch({ open: true, shopId: shop.id });
                                    }}
                                    title="Add Branch"
                                  >
                                    <MapPin className="h-4 w-4" />
                                  </Button>
                                  
                                  {/* Delete Shop Icon */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        size="icon"
                                        className="h-10 w-10 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Delete Shop"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl mx-2">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-lg sm:text-xl text-center sm:text-left">
                                          Delete Shop?
                                        </AlertDialogTitle>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex flex-row gap-3 sm:gap-0">
                                        <AlertDialogCancel 
                                          className="flex-1 text-sm h-12 min-h-12"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction 
                                          className="flex-1 text-sm h-12 min-h-12 bg-red-600 hover:bg-red-700"
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
                                </div>

                                {/* Mobile Menu */}
                                <div className="sm:hidden relative">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMobileMenu(shop.id);
                                    }}
                                  >
                                    <MoreVertical className="h-5 w-5" />
                                  </Button>
                                  
                                  {mobileMenuOpen === shop.id && (
                                    <div className="absolute right-0 top-12 z-10 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                                      <button
                                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-amber-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingShop(shop);
                                          setNewShopName(shop.name);
                                          setNewShopAddress(shop.description || "");
                                          setOpenAddShop(true);
                                          setMobileMenuOpen(null);
                                        }}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                        Edit Shop
                                      </button>
                                      <button
                                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-green-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenAddBranch({ open: true, shopId: shop.id });
                                          setMobileMenuOpen(null);
                                        }}
                                      >
                                        <MapPin className="h-4 w-4" />
                                        Add Branch
                                      </button>
                                      <button
                                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 text-red-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteShopId(shop.id);
                                          handleDeleteShop();
                                          setMobileMenuOpen(null);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete Shop
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 ml-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleShopExpansion(shop.id);
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Branches Section */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 px-4 pb-4">
                              <p className="text-base font-medium text-gray-700 my-3 flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Branches:
                              </p>
                              {shop.branches && shop.branches.length > 0 ? (
                                <div className="space-y-3">
                                  {shop.branches.map((b) => (
                                    <div key={b.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-base break-words text-gray-900 mb-1">{b.name}</p>
                                          <p className="text-sm text-gray-600 break-words leading-relaxed">{b.address}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1 justify-start">
                                          {/* Edit Branch Icon */}
                                          <Button 
                                            size="icon"
                                            className="h-9 w-9 bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                                            onClick={() => { 
                                              setEditingBranch(b); 
                                              setBranchName(b.name); 
                                              setBranchAddress(b.address); 
                                              setBranchLocation([b.lat || 9.308, b.lng || 123.308]); 
                                              setOpenAddBranch({ open: true, shopId: shop.id }); 
                                            }}
                                            title="Edit Branch"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          
                                          {/* Delete Branch Icon */}
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button 
                                                size="icon"
                                                className="h-9 w-9 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Delete Branch"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl mx-2">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle className="text-lg sm:text-xl text-center sm:text-left">
                                                  Delete Branch?
                                                </AlertDialogTitle>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter className="flex flex-row gap-3 sm:gap-0">
                                                <AlertDialogCancel 
                                                  className="flex-1 text-sm h-12 min-h-12"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction 
                                                  className="flex-1 text-sm h-12 min-h-12 bg-red-600 hover:bg-red-700"
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
                                <p className="text-sm text-gray-500 text-center py-4">No branches</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Shop Pagination */}
                    {totalShopPages > 1 && (
                      <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => setShopPage(prev => Math.max(prev - 1, 1))}
                          disabled={shopPage === 1}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        
                        <span className="text-sm text-gray-600">
                          Page {shopPage} of {totalShopPages}
                        </span>
                        
                        <Button
                          variant="outline"
                          onClick={() => setShopPage(prev => Math.min(prev + 1, totalShopPages))}
                          disabled={shopPage === totalShopPages}
                          className="flex items-center gap-2"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* =================== Owners Card =================== */}
            <Card className="w-full overflow-hidden border-0 shadow-lg rounded-xl">
              <CardHeader className="pb-4 px-4 sm:px-6 bg-gray-50">
                <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
                  <div className="flex items-center gap-3">
                    <User className="h-6 w-6 text-purple-600" />
                    <CardTitle className="text-xl sm:text-2xl font-semibold break-words">Owners</CardTitle>
                  </div>
                  <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input 
                        placeholder="Search owner..." 
                        value={searchOwner} 
                        onChange={(e) => setSearchOwner(e.target.value)} 
                        className="flex-1 min-w-0 text-sm sm:text-base h-12 pl-12 text-lg" 
                      />
                    </div>
                    <Button 
                      className="w-full xs:w-auto text-sm sm:text-base h-12 min-h-12 whitespace-nowrap flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4"
                      onClick={() => { 
                        resetOwnerForm();
                        setOpenAddOwner(true); 
                      }}
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Owner</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 sm:px-6">
                {isLoadingOwners ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mr-3" />
                    <span className="text-lg text-gray-600">Loading owners...</span>
                  </div>
                ) : filteredOwners.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-base sm:text-lg">
                    {searchOwner ? "No owners match your search" : "No owners found"}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {paginatedOwners.map((owner) => {
                      const shop = shops.find((s) => s.id === owner.shop_id);
                      return (
                        <div key={owner.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-lg transition-all duration-200">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-lg break-words text-gray-900 mb-2">{owner.full_name}</p>
                              <p className="text-sm text-gray-600 break-words mb-2">{owner.email}</p>
                              <p className="text-sm text-gray-700 flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Shop: <span className="font-medium break-words">{shop?.name || "Not assigned"}</span>
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-start mt-3 sm:mt-0">
                              {/* Edit Owner Icon */}
                              <Button 
                                size="icon"
                                className="h-12 w-12 bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setEditingOwner(owner); 
                                  setNewOwnerName(owner.full_name); 
                                  setNewOwnerEmail(owner.email); 
                                  setNewOwnerShop(owner.shop_id); 
                                  setOpenAddOwner(true); 
                                }}
                                title="Edit Owner"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              
                              {/* Delete Owner Icon */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="icon"
                                    className="h-12 w-12 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Delete Owner"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl mx-2">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-lg sm:text-xl text-center sm:text-left">
                                      Delete Owner?
                                    </AlertDialogTitle>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="flex flex-row gap-3 sm:gap-0">
                                    <AlertDialogCancel 
                                      className="flex-1 text-sm h-12 min-h-12"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction 
                                      className="flex-1 text-sm h-12 min-h-12 bg-red-600 hover:bg-red-700"
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

                    {/* Owner Pagination */}
                    {totalOwnerPages > 1 && (
                      <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => setOwnerPage(prev => Math.max(prev - 1, 1))}
                          disabled={ownerPage === 1}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        
                        <span className="text-sm text-gray-600">
                          Page {ownerPage} of {totalOwnerPages}
                        </span>
                        
                        <Button
                          variant="outline"
                          onClick={() => setOwnerPage(prev => Math.min(prev + 1, totalOwnerPages))}
                          disabled={ownerPage === totalOwnerPages}
                          className="flex items-center gap-2"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* =================== Account Requests Sidebar =================== */}
      <div className={`fixed lg:sticky top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 z-40 ${
        showAccountRequests ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:hidden'
      }`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-green-50">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-green-600" />
              <h2 className="text-xl font-semibold">Account Requests</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-8 w-8 p-0"
              onClick={() => setShowAccountRequests(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                  placeholder="Search requests..." 
                  value={searchRequests} 
                  onChange={(e) => setSearchRequests(e.target.value)} 
                  className="w-full pl-12 text-base h-12" 
                />
              </div>
            </div>

            <div className="p-4">
              {isLoadingRequests ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600 mr-3" />
                  <span className="text-lg text-gray-600">Loading requests...</span>
                </div>
              ) : filteredRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-base">
                  {searchRequests ? "No requests match your search" : "No account requests"}
                </p>
              ) : (
                <div className="space-y-4">
                  {paginatedRequests.map((request) => (
                    <div key={request.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-lg transition-all duration-200">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-lg break-words text-gray-900 mb-1">{request.name}</p>
                            <p className="text-sm text-gray-600 break-words mb-1">{request.email}</p>
                            <p className="text-sm text-gray-600 break-words">{request.contact}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status}
                          </div>
                        </div>
                        
                        <div className="border-t pt-3">
                          <p className="font-medium text-sm text-gray-700 mb-2">{request.shop_name}</p>
                          <p className="text-xs text-gray-600 break-words mb-2">{request.shop_address}</p>
                          <p className="text-xs text-gray-500">
                            Submitted: {new Date(request.submitted_at).toLocaleDateString()}
                          </p>
                        </div>

                        {request.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                              onClick={() => handleProcessRequest(request.id, 'approve')}
                              disabled={isProcessingRequest === request.id}
                            >
                              {isProcessingRequest === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Approve</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
                              onClick={() => handleProcessRequest(request.id, 'reject')}
                              disabled={isProcessingRequest === request.id}
                            >
                              {isProcessingRequest === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  <span>Reject</span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Requests Pagination */}
                  {totalRequestsPages > 1 && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                      <Button
                        variant="outline"
                        onClick={() => setRequestsPage(prev => Math.max(prev - 1, 1))}
                        disabled={requestsPage === 1}
                        className="flex items-center gap-2 text-sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      <span className="text-sm text-gray-600">
                        Page {requestsPage} of {totalRequestsPages}
                      </span>
                      
                      <Button
                        variant="outline"
                        onClick={() => setRequestsPage(prev => Math.min(prev + 1, totalRequestsPages))}
                        disabled={requestsPage === totalRequestsPages}
                        className="flex items-center gap-2 text-sm"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Button for Mobile */}
      {!showAccountRequests && (
        <Button
          className="fixed bottom-4 right-4 lg:hidden h-12 w-12 rounded-full shadow-lg bg-green-600 hover:bg-green-700 z-30"
          onClick={() => setShowAccountRequests(true)}
        >
          <Users className="h-5 w-5" />
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {pendingRequestsCount}
            </span>
          )}
        </Button>
      )}

      {/* =================== Dialogs =================== */}
      {/* Shop Dialog */}
      <Dialog open={openAddShop} onOpenChange={(open) => {
        if (!open) resetShopForm();
        setOpenAddShop(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl mx-2">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl text-center sm:text-left flex items-center gap-3">
              <Building className="h-6 w-6" />
              {editingShop ? "Edit Shop" : "Add Shop"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveShop();
          }}>
            <div className="space-y-4">
              <Input 
                placeholder="Shop Name" 
                value={newShopName} 
                onChange={(e) => setNewShopName(e.target.value)} 
                className="text-base h-12 text-lg"
                required
              />
              <Input 
                placeholder="Description" 
                value={newShopAddress} 
                onChange={(e) => setNewShopAddress(e.target.value)} 
                className="text-base h-12 text-lg"
              />
            </div>
            <DialogFooter className="mt-6 flex flex-col xs:flex-row gap-3">
              <Button 
                type="submit"
                disabled={isSubmittingShop}
                className="w-full xs:w-auto text-base h-12 min-h-12 bg-purple-600 hover:bg-purple-700 px-6"
              >
                {isSubmittingShop ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingShop ? "Update Shop" : "Add Shop"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={openAddBranch.open} onOpenChange={(open) => {
        if (!open) resetBranchForm();
        else setOpenAddBranch({ ...openAddBranch, open });
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl w-full h-[90vh] sm:h-[80vh] rounded-xl mx-2">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl text-center sm:text-left flex items-center gap-3">
              <MapPin className="h-6 w-6" />
              {editingBranch ? "Edit Branch" : "Add Branch"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveBranch();
          }} className="h-full flex flex-col">
            <div className="space-y-4 flex-1 overflow-y-auto">
              <Input 
                placeholder="Branch Name" 
                value={branchName} 
                onChange={(e) => setBranchName(e.target.value)} 
                className="text-base h-12 text-lg"
                required
              />
              <Input 
                placeholder="Address" 
                value={branchAddress} 
                onChange={(e) => setBranchAddress(e.target.value)} 
                className="text-base h-12 text-lg"
                required
              />
              <div className="h-64 xs:h-72 sm:h-80 w-full border-2 rounded-xl overflow-hidden">
                <BranchMap location={branchLocation} setLocation={setBranchLocation} />
              </div>
            </div>
            <DialogFooter className="mt-6 flex flex-col xs:flex-row gap-3">
              <Button 
                type="submit"
                disabled={isSubmittingBranch}
                className="w-full xs:w-auto text-base h-12 min-h-12 bg-purple-600 hover:bg-purple-700 px-6"
              >
                {isSubmittingBranch ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingBranch ? "Update Branch" : "Add Branch"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Owner Dialog */}
      <Dialog open={openAddOwner} onOpenChange={(open) => {
        if (!open) resetOwnerForm();
        setOpenAddOwner(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl mx-2">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl text-center sm:text-left flex items-center gap-3">
              <User className="h-6 w-6" />
              {editingOwner ? "Edit Owner" : "Add Owner"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSaveOwner();
          }}>
            <div className="space-y-4">
              <Input 
                placeholder="Full Name" 
                value={newOwnerName} 
                onChange={(e) => setNewOwnerName(e.target.value)} 
                className="text-base h-12 text-lg"
                required
              />
              <Input 
                placeholder="Email" 
                type="email"
                value={newOwnerEmail} 
                onChange={(e) => setNewOwnerEmail(e.target.value)} 
                className="text-base h-12 text-lg"
                required
              />
              {/* Only show password field when adding new owner */}
              {!editingOwner && (
                <Input 
                  placeholder="Password" 
                  type="password" 
                  value={newOwnerPassword} 
                  onChange={(e) => setNewOwnerPassword(e.target.value)} 
                  className="text-base h-12 text-lg"
                  required
                />
              )}
              <Select onValueChange={setNewOwnerShop} value={newOwnerShop} required>
                <SelectTrigger className="w-full text-base h-12 text-lg">
                  <SelectValue placeholder="Select Shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-base">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6 flex flex-col xs:flex-row gap-3">
              <Button 
                type="submit"
                disabled={isSubmittingOwner}
                className="w-full xs:w-auto text-base h-12 min-h-12 bg-purple-600 hover:bg-purple-700 px-6"
              >
                {isSubmittingOwner ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingOwner ? "Update Owner" : "Add Owner"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}