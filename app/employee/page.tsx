// app/employee/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { Toaster, toast } from "sonner";
import { ChevronDown, ChevronUp, Clock, CheckCircle, Truck, AlertCircle, LogOut, MapPin, User, Loader2 } from "lucide-react";

// Updated Types
type Order = {
  id: string;
  order_item_id: string | null;
  customer_name: string;
  detergent: string | null;
  softener: string | null;
  method: "pickup" | "dropoff" | "delivery";
  method_label: string;
  kilo: number | null;
  amount: number | null;
  status: "pending" | "in_shop" | "delivering" | "done";
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  services?: { id: string; name: string; price: number };
  customer_contact?: string;
  delivery_location?: string;
  shop_id: string;
};

// Compact Order Card Component
function CompactOrderCard({ 
  order, 
  action,
  isProcessing = false
}: { 
  order: Order; 
  action?: React.ReactNode;
  isProcessing?: boolean;
}) {
  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "in_shop": return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "delivering": return <Truck className="h-4 w-4 text-purple-600" />;
      case "done": return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCardColor = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-yellow-50 border-yellow-200";
      case "in_shop": return "bg-blue-50 border-blue-200";
      case "delivering": return "bg-purple-50 border-purple-200";
      case "done": return "bg-green-50 border-green-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Card className={`${getCardColor(order.status)} border-l-4 border-l-blue-500 hover:shadow-md transition-all ${isProcessing ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(order.status)}
              <h4 className="font-semibold text-gray-900 truncate">{order.customer_name}</h4>
              {isProcessing && (
                <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
              )}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Service: {order.services?.name || "Standard"}</p>
              <p>Method: <span className="capitalize">{order.method_label}</span></p>
              {order.kilo && <p>Weight: {order.kilo} kg</p>}
              {order.amount && (
                <p className="font-medium text-blue-700">₱{order.amount.toFixed(2)}</p>
              )}
            </div>
          </div>
          <div className="ml-3 flex-shrink-0">
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Order Card Component
function OrderCard({ 
  order, 
  onStatusChange,
  showDetails = true,
  isProcessing = false
}: { 
  order: Order; 
  onStatusChange?: (order: Order) => void;
  showDetails?: boolean;
  isProcessing?: boolean;
}) {
  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "in_shop": return "bg-blue-100 text-blue-800 border-blue-300";
      case "delivering": return "bg-purple-100 text-purple-800 border-purple-300";
      case "done": return "bg-green-100 text-green-800 border-green-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getCardColor = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-yellow-50 border-yellow-200";
      case "in_shop": return "bg-blue-50 border-blue-200";
      case "delivering": return "bg-purple-50 border-purple-200";
      case "done": return "bg-green-50 border-green-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  const getNextAction = (order: Order) => {
    if (order.status === "in_shop") {
      if (order.method === "dropoff") {
        return "Mark as Done";
      } else {
        return "Start Delivery";
      }
    }
    if (order.status === "delivering") {
      return "Mark as Delivered";
    }
    return "Update Status";
  };

  return (
    <Card className={`${getCardColor(order.status)} hover:shadow-lg transition-all border-2 ${isProcessing ? 'opacity-60' : ''}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{order.customer_name}</h3>
            <p className="text-sm text-gray-600">Order #{order.id.slice(-8)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)} capitalize`}>
              {order.status.replace('_', ' ')}
            </span>
            {isProcessing && (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>
        </div>

        {showDetails && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 font-medium">Service:</span>
              <span className="font-semibold text-gray-900">{order.services?.name || "Standard"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 font-medium">Method:</span>
              <span className="font-semibold text-gray-900 capitalize">{order.method_label}</span>
            </div>
            {order.detergent && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Detergent:</span>
                <span className="font-semibold text-gray-900">{order.detergent}</span>
              </div>
            )}
            {order.softener && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Softener:</span>
                <span className="font-semibold text-gray-900">{order.softener}</span>
              </div>
            )}
            {order.kilo && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Weight:</span>
                <span className="font-semibold text-gray-900">{order.kilo} kg</span>
              </div>
            )}
            {order.customer_contact && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Contact:</span>
                <span className="font-semibold text-gray-900">{order.customer_contact}</span>
              </div>
            )}
            {order.delivery_location && order.method === 'delivery' && (
              <div className="flex justify-between items-start py-2">
                <span className="text-gray-600 font-medium">Delivery:</span>
                <span className="font-semibold text-gray-900 text-right">{order.delivery_location}</span>
              </div>
            )}
            {order.amount && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-gray-800 font-bold">Total Amount:</span>
                <span className="font-bold text-blue-700 text-lg">₱{order.amount.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {onStatusChange && order.status !== "pending" && order.status !== "done" && (
          <Button
            onClick={() => onStatusChange(order)}
            disabled={isProcessing}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              getNextAction(order)
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="bg-white border-2 border-blue-200">
      <CardHeader 
        className="cursor-pointer hover:bg-blue-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between text-lg font-semibold text-gray-900">
          {title}
          {isOpen ? <ChevronUp className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-blue-600" />}
        </CardTitle>
      </CardHeader>
      {isOpen && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  );
}

// Temporary debug component - remove after fixing
function DebugInfo({ processingOrders }: { processingOrders: Set<string> }) {
  if (processingOrders.size === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 p-2 rounded text-xs z-50">
      <strong>Processing Orders:</strong>
      <div>
        {Array.from(processingOrders).map(id => (
          <div key={id}>🔄 {id.slice(-8)}</div>
        ))}
      </div>
    </div>
  );
}

function EmployeeContent() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");
  const [branchAddress, setBranchAddress] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [weight, setWeight] = useState("");
  
  // Search states
  const [searchOngoing, setSearchOngoing] = useState("");

  // 🔄 ADD: Processing states for button timeouts
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [savingWeight, setSavingWeight] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Helper functions for processing management
  const addToProcessing = (orderId: string) => {
    setProcessingOrders(prev => new Set([...prev, orderId]));
  };

  const removeFromProcessing = (orderId: string) => {
    setProcessingOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
  };

  const isProcessing = (orderId: string) => {
    return processingOrders.has(orderId);
  };

  // Authentication Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔄 Checking employee authentication...")
        
        const response = await fetch('/api/employee/check-auth');
        const { authorized, error, assignments } = await response.json();
        
        console.log('Employee auth check result:', { authorized, error, assignments });
        
        if (!response.ok || !authorized) {
          toast.error(error || "Employee access required");
          router.replace("/login");
          return;
        }

        console.log("✅ Employee authenticated")
        setIsAuthorized(true);
        
        // Set shop and branch info from assignments
        if (assignments && assignments.length > 0) {
          const assignment = assignments[0];
          setShopName(assignment.shop.name);
          setBranchName(assignment.branch.name);
          setBranchAddress(assignment.branch.address);
          setCurrentShopId(assignment.branch_id);
          console.log("🏪 Set shop:", assignment.shop.name, "Branch:", assignment.branch.name, "Branch ID:", assignment.branch_id);
        } else {
          console.warn("⚠️ Authorized but no assignments found");
          toast.error("No shop assignments found");
        }
        
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("Authentication failed");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch Orders When Authorized - IMPROVED with better error handling
  const fetchOrders = async () => {
    if (!isAuthorized || !currentShopId) {
      console.log("Skipping order fetch - not ready:", { 
        isAuthorized, 
        currentShopId
      });
      return;
    }

    try {
      setRefreshing(true);
      console.log("📦 Fetching orders for branch:", currentShopId);
      
      const response = await fetch(`/api/employee/orders?branch_id=${currentShopId}`, {
        credentials: 'include',
        cache: 'no-store' // Prevent caching
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const { pendingOrders, ongoingOrders, orderHistory, error } = await response.json();

      if (error) {
        console.error("❌ Error fetching orders:", error);
        toast.error("Failed to load orders");
        return;
      }

      console.log("✅ Orders fetched:", { 
        pending: pendingOrders?.length || 0, 
        ongoing: ongoingOrders?.length || 0, 
        history: orderHistory?.length || 0 
      });
      
      // Combine for display
      const allOrders = [
        ...(pendingOrders || []),
        ...(ongoingOrders || []), 
        ...(orderHistory || [])
      ];
      setOrders(allOrders);
      
    } catch (error) {
      console.error("💥 Error in fetchOrders:", error);
      toast.error("Error loading orders: " + (error as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Set up polling for real-time updates
    const interval = setInterval(fetchOrders, 15000); // Reduced to 15 seconds

    return () => {
      clearInterval(interval);
    };
  }, [isAuthorized, currentShopId]);

  // Order Filtering & Calculations
  const { pendingOrders, ongoingOrders, orderHistory } = useMemo(() => {
    if (orders.length === 0) {
      return { pendingOrders: [], ongoingOrders: [], orderHistory: [] };
    }

    const pending = orders.filter((o) => o.status === "pending");
    const ongoing = orders.filter((o) => 
      o.status === "in_shop" || o.status === "delivering"
    );
    const history = orders.filter((o) => o.status === "done");

    return { 
      pendingOrders: pending, 
      ongoingOrders: ongoing, 
      orderHistory: history
    };
  }, [orders]);

  // Filtered orders for search
  const filteredOngoingOrders = useMemo(() => {
    return ongoingOrders.filter((o) =>
      o.customer_name.toLowerCase().includes(searchOngoing.toLowerCase())
    );
  }, [ongoingOrders, searchOngoing]);

  // Order Management Functions
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push("/login");
      } else {
        toast.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  // 🔄 FIXED: handleConfirm with better timeout management
  const handleConfirm = (order: Order) => {
    if (isProcessing(order.id)) {
      console.log('🛑 Order already being processed:', order.id);
      return;
    }

    addToProcessing(order.id);
    setCurrentOrder(order);
    setShowModal(true);
    
    // Set timeout to clear processing state if modal stays open too long
    const timeoutId = setTimeout(() => {
      if (showModal && currentOrder?.id === order.id) {
        console.log('🕒 Auto-clearing processing state for modal order:', order.id);
        removeFromProcessing(order.id);
      }
    }, 15000);

    // Cleanup function
    return () => clearTimeout(timeoutId);
  };

  // 🔄 FIXED: handleSaveWeight with immediate feedback
  const handleSaveWeight = async () => {
    if (!currentOrder) return;
    
    if (savingWeight) {
      toast.error('Already saving weight...');
      return;
    }

    const kilo = parseFloat(weight);
    if (isNaN(kilo) || kilo <= 0) {
      toast.error("Invalid weight. Please enter a valid number.");
      return;
    }

    setSavingWeight(true);

    try {
      const pricePerKg = currentOrder.services?.price ?? 0;
      const serviceId = currentOrder.services?.id;

      if (!serviceId) {
        toast.error("Service information missing");
        return;
      }

      console.log("🔄 Moving order to work queue:", {
        orderId: currentOrder.id,
        weight: kilo,
        serviceId,
        pricePerKg
      });

      const response = await fetch('/api/employee/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          orderId: currentOrder.id,
          weight: kilo,
          serviceId: serviceId,
          pricePerKg: pricePerKg
        }),
      });

      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        console.error("Server error:", result);
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (!result.success) {
        console.error("Business logic error:", result);
        throw new Error(result.error || 'Failed to process order');
      }

      // ✅ SUCCESS: Update UI immediately instead of reloading
      toast.success(result.message || "Order moved to work queue!");
      
      // Remove from pending orders immediately
      setOrders(prev => prev.filter(order => order.id !== currentOrder.id));
      
      // Close modal and reset
      setShowModal(false);
      setWeight("");
      setCurrentOrder(null);
      removeFromProcessing(currentOrder.id);
      
    } catch (error) {
      console.error("Error saving weight:", error);
      toast.error("An error occurred: " + (error as Error).message);
      removeFromProcessing(currentOrder.id);
    } finally {
      setSavingWeight(false);
    }
  };

  // 🔄 FIXED: handleStatusChange with proper state cleanup
  const handleStatusChange = async (order: Order) => {
    // Use order_item_id if available, otherwise fall back to order.id
    const orderItemId = order.order_item_id || order.id;
    
    if (isProcessing(orderItemId)) {
      console.log('🛑 Status change already in progress for:', orderItemId);
      return;
    }

    addToProcessing(orderItemId);

    console.log("🔄 Updating order status for:", {
      orderItemId: orderItemId,
      currentStatus: order.status,
      method: order.method
    });

    try {
      // Send the correct parameter that backend expects
      const response = await fetch('/api/employee/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          orderItemId: orderItemId
        }),
      });

      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        console.error("Server error:", result);
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (!result.success) {
        console.error("Business logic error:", result);
        throw new Error(result.error || 'Failed to update status');
      }

      toast.success(result.message || `Order status updated successfully!`);
      
      // ✅ Force refresh orders to get updated status
      await fetchOrders();
      
      // ✅ CRITICAL: Remove from processing after successful update
      removeFromProcessing(orderItemId);
      
    } catch (error) {
      console.error("Error changing status:", error);
      toast.error("Error updating status: " + (error as Error).message);
      
      // Ensure processing state is cleared on error
      removeFromProcessing(orderItemId);
    }
  };

  // Add modal close handler
  const handleModalClose = () => {
    if (currentOrder) {
      removeFromProcessing(currentOrder.id);
    }
    setShowModal(false);
    setWeight("");
    setCurrentOrder(null);
  };

  // Add cleanup effect for modal
  useEffect(() => {
    return () => {
      // Clean up any processing states when component unmounts
      if (showModal && currentOrder) {
        removeFromProcessing(currentOrder.id);
      }
    };
  }, [showModal, currentOrder]);

  // Render Logic
  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-sky-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">
            {!isAuthorized ? "Checking permissions..." : "Loading employee portal..."}
          </p>
        </div>
      </div>
    );
  }

  if (!currentShopId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-sky-100">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border-2 border-blue-200">
          <p className="text-gray-700 text-lg font-semibold">No shop assignment found</p>
          <p className="text-gray-500 mt-2">Please contact administrator</p>
          <Button onClick={handleLogout} className="mt-6 bg-blue-600 hover:bg-blue-700">
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 p-3 sm:p-4 md:p-6">
      <Toaster position="top-right" richColors />
      
      {/* Modern Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card className="bg-gradient-to-r from-blue-600 to-sky-600 border-0 shadow-xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                {/* Shop and Branch Info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                      {shopName}
                    </h1>
                    <p className="text-blue-100 text-sm sm:text-base">
                      {branchName} • {branchAddress}
                    </p>
                  </div>
                </div>
                
                {/* Welcome Message */}
                <div className="flex items-center gap-2 bg-white/10 p-3 rounded-lg">
                  <User className="h-4 w-4 text-white" />
                  <p className="text-white text-sm sm:text-base">
                    Welcome, Employee
                  </p>
                </div>
              </div>
              
              {/* Refresh Button */}
              <div className="flex gap-2">
                <Button
                  onClick={fetchOrders}
                  disabled={refreshing}
                  variant="outline"
                  className="bg-white/20 text-white hover:bg-white/30 border-white"
                  size="sm"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
                <Button
                  onClick={handleLogout}
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 text-sm sm:text-base"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Priority Column - Always show pending (INBOX) */}
          <section className="xl:col-span-1">
            <Card className="bg-white border-2 border-yellow-300 shadow-lg">
              <CardHeader className="bg-yellow-100 border-b-2 border-yellow-300">
                <CardTitle className="flex items-center gap-3">
                  <div className="bg-yellow-500 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      INBOX - Action Required
                    </h2>
                    <p className="text-yellow-700 text-sm font-medium">
                      {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} waiting
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-700 font-medium">No pending orders</p>
                    <p className="text-sm text-gray-500">All clear! Ready for new orders</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {pendingOrders.map(order => (
                      <CompactOrderCard 
                        key={order.id} 
                        order={order}
                        isProcessing={isProcessing(order.id)}
                        action={
                          <Button 
                            size="sm" 
                            onClick={() => handleConfirm(order)}
                            disabled={isProcessing(order.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                          >
                            {isProcessing(order.id) ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Processing...
                              </>
                            ) : (
                              'Confirm Weight'
                            )}
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Active Work Column - Wider (WORK QUEUE) */}
          <section className="xl:col-span-3">
            <Card className="bg-white border-2 border-blue-300 shadow-lg h-full">
              <CardHeader className="bg-blue-100 border-b-2 border-blue-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500 p-2 rounded-lg">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl font-bold text-gray-900">
                        WORK QUEUE - Active Orders
                      </CardTitle>
                      <p className="text-blue-700 text-sm font-medium">
                        {ongoingOrders.length} order{ongoingOrders.length !== 1 ? 's' : ''} in progress
                      </p>
                    </div>
                  </div>
                  <Input 
                    placeholder="Search by customer name..." 
                    className="w-full sm:w-64 bg-white border-blue-300 focus:border-blue-500"
                    value={searchOngoing}
                    onChange={(e) => setSearchOngoing(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {filteredOngoingOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium text-lg">No active orders</p>
                    <p className="text-gray-500">Orders will appear here once confirmed</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOngoingOrders.map(order => (
                      <OrderCard 
                        key={order.order_item_id || order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        isProcessing={isProcessing(order.order_item_id || order.id)}
                        showDetails={true}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Recent Completions - Collapsible */}
        <div className="mt-4 sm:mt-6">
          <CollapsibleSection 
            title={`Order History (${orderHistory.length})`}
            defaultOpen={orderHistory.length > 0}
          >
            {orderHistory.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No completed orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderHistory.slice(0, 10).map(order => (
                  <div key={order.order_item_id || order.id} className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">{order.customer_name}</p>
                      <p className="text-sm text-gray-600">
                        {order.services?.name} • {order.kilo ? `${order.kilo} kg` : 'Weight not set'} • 
                        <span className="capitalize"> {order.method_label}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">₱{(order.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {order.completed_at ? new Date(order.completed_at).toLocaleDateString() : 
                         order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* Weight Input Modal */}
      {showModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm border-2 border-blue-300">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Order Weight</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter weight for <strong className="text-blue-700">{currentOrder.customer_name}</strong>
              {currentOrder.services && (
                <><br />Service: <strong>{currentOrder.services.name}</strong><br />
                Price: <strong className="text-blue-700">₱{currentOrder.services.price}/kg</strong></>
              )}
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weight (kg) *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Enter weight in kilograms"
                  className="w-full border-blue-300 focus:border-blue-500"
                  autoFocus
                  disabled={savingWeight}
                />
              </div>
              
              {weight && !isNaN(parseFloat(weight)) && currentOrder.services && (
                <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">
                    Calculated amount: <strong>₱{(parseFloat(weight) * currentOrder.services.price).toFixed(2)}</strong>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Order will move to <strong>Work Queue</strong> after confirmation
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={handleModalClose}
                disabled={savingWeight}
                className="border-gray-400 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWeight}
                disabled={!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0 || savingWeight}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {savingWeight ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save & Move to Work Queue'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info - Remove after fixing */}
      <DebugInfo processingOrders={processingOrders} />
    </div>
  );
}

export default function EmployeePage() {
  return <EmployeeContent />;
}