"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { Toaster, toast } from "sonner";
import { ChevronDown, ChevronUp, Clock, CheckCircle, Truck, AlertCircle, LogOut, MapPin, User } from "lucide-react";

// Types
type Order = {
  id: string;
  customer_name: string;
  detergent: string | null;
  method: "pickup" | "dropoff" | "delivery";
  kilo: number | null;
  amount: number | null;
  status: "pending" | "in_shop" | "delivering" | "done";
  created_at?: string;
  services?: { name: string; price: number };
  shop_id: string;
};

type EmployeeAssignment = {
  shop_id: string;
  branch_id: string;
  role_in_shop: string;
  shop: {
    name: string;
    description?: string;
  };
  branch: {
    name: string;
    address: string;
    is_active: boolean;
  };
};

// Compact Order Card Component
function CompactOrderCard({ 
  order, 
  action 
}: { 
  order: Order; 
  action?: React.ReactNode;
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
    <Card className={`${getCardColor(order.status)} border-l-4 border-l-blue-500 hover:shadow-md transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(order.status)}
              <h4 className="font-semibold text-gray-900 truncate">{order.customer_name}</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Service: {order.services?.name || "Standard"}</p>
              <p>Method: <span className="capitalize">{order.method}</span></p>
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
  showDetails = true 
}: { 
  order: Order; 
  onStatusChange?: (order: Order) => void;
  showDetails?: boolean;
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
    if (order.status === "in_shop" && order.method === "dropoff") return "Mark as Done";
    if (order.status === "in_shop" && order.method === "delivery") return "Start Delivery";
    if (order.status === "delivering") return "Mark as Delivered";
    return "Update Status";
  };

  return (
    <Card className={`${getCardColor(order.status)} hover:shadow-lg transition-all border-2`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{order.customer_name}</h3>
            <p className="text-sm text-gray-600">Order #{order.id.slice(-8)}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)} capitalize`}>
            {order.status.replace('_', ' ')}
          </span>
        </div>

        {showDetails && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 font-medium">Service:</span>
              <span className="font-semibold text-gray-900">{order.services?.name || "Standard"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600 font-medium">Method:</span>
              <span className="font-semibold text-gray-900 capitalize">{order.method}</span>
            </div>
            {order.detergent && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Detergent:</span>
                <span className="font-semibold text-gray-900">{order.detergent}</span>
              </div>
            )}
            {order.kilo && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Weight:</span>
                <span className="font-semibold text-gray-900">{order.kilo} kg</span>
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
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            size="sm"
          >
            {getNextAction(order)}
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

function EmployeeContent() {
  const supabase = useSupabaseClient();
  const session = useSession();
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

  // ==============================
  // 🔐 AUTHENTICATION CHECK FIRST
  // ==============================
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
          setCurrentShopId(assignment.shop_id);
          console.log("🏪 Set shop:", assignment.shop.name, "Branch:", assignment.branch.name);
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

  // ==============================
  // 📊 FETCH ORDERS WHEN AUTHORIZED
  // ==============================
  useEffect(() => {
    if (!isAuthorized || !currentShopId || !session) {
      console.log("Skipping order fetch - not ready:", { 
        isAuthorized, 
        currentShopId, 
        hasSession: !!session 
      });
      return;
    }

    const fetchOrders = async () => {
      try {
        console.log("📦 Fetching orders for shop:", currentShopId);
        const { data, error } = await supabase
          .from("orders")
          .select("*, services(name, price)")
          .eq("shop_id", currentShopId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("❌ Error fetching orders:", error);
          toast.error("Failed to load orders");
          return;
        }

        console.log("✅ Orders fetched:", data?.length);
        setOrders(data || []);
        
      } catch (error) {
        console.error("💥 Error in fetchOrders:", error);
        toast.error("Error loading orders");
      }
    };

    fetchOrders();

    // Real-time subscription for order updates
    const subscription = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `shop_id=eq.${currentShopId}`
        },
        () => {
          fetchOrders(); // Refetch when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthorized, currentShopId, session, supabase]);

  // ==============================
  // 📈 ORDER FILTERING & CALCULATIONS
  // ==============================
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

  // ==============================
  // 🎯 ORDER MANAGEMENT FUNCTIONS
  // ==============================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleConfirm = (order: Order) => {
    setCurrentOrder(order);
    setShowModal(true);
  };

  const handleSaveWeight = async () => {
    if (!currentOrder) return;
    
    const kilo = parseFloat(weight);
    if (isNaN(kilo) || kilo <= 0) {
      toast.error("Invalid weight. Please enter a valid number.");
      return;
    }

    try {
      const pricePerKg = currentOrder.services?.price ?? 0;
      const amount = kilo * pricePerKg;
      const method = currentOrder.method;
      const newStatus =
        method === "pickup" ? "done" : 
        method === "dropoff" ? "in_shop" : 
        "delivering";

      const { error } = await supabase
        .from("orders")
        .update({ kilo, amount, status: newStatus })
        .eq("id", currentOrder.id);

      if (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to update order");
        return;
      }

      // Success - close modal and reset
      setShowModal(false);
      setWeight("");
      setCurrentOrder(null);
      toast.success("Order confirmed successfully!");
      
    } catch (error) {
      console.error("Error saving weight:", error);
      toast.error("An error occurred");
    }
  };

  const handleStatusChange = async (order: Order) => {
    try {
      let newStatus = order.status;

      if (order.method === "dropoff") newStatus = "done";
      else if (order.method === "delivery" && order.status === "in_shop")
        newStatus = "delivering";
      else if (order.status === "delivering") newStatus = "done";

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.id);

      if (error) {
        console.error("Error updating order status:", error);
        toast.error("Failed to update status");
        return;
      }

      toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
      
    } catch (error) {
      console.error("Error changing status:", error);
      toast.error("Error updating status");
    }
  };

  // ==============================
  // 🎯 RENDER LOGIC
  // ==============================
  
  // Show loading while checking auth OR fetching data
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

  // Show empty state if no shop assigned
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
                    Welcome, <span className="font-semibold">{session?.user?.email?.split('@')[0]}</span>
                  </p>
                </div>
              </div>
              
              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 text-sm sm:text-base"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Priority Column - Always show pending */}
          <section className="xl:col-span-1">
            <Card className="bg-white border-2 border-yellow-300 shadow-lg">
              <CardHeader className="bg-yellow-100 border-b-2 border-yellow-300">
                <CardTitle className="flex items-center gap-3">
                  <div className="bg-yellow-500 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      Action Required
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
                        action={
                          <Button 
                            size="sm" 
                            onClick={() => handleConfirm(order)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                          >
                            Confirm
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Active Work Column - Wider */}
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
                        Active Orders
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
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
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
            title={`Recent Completions (${orderHistory.length})`}
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
                  <div key={order.id} className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">{order.customer_name}</p>
                      <p className="text-sm text-gray-600">
                        {order.services?.name} • {order.kilo ? `${order.kilo} kg` : 'Weight not set'} • 
                        <span className="capitalize"> {order.method}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">₱{(order.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Order</h3>
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
                />
              </div>
              
              {weight && !isNaN(parseFloat(weight)) && currentOrder.services && (
                <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">
                    Calculated amount: <strong>₱{(parseFloat(weight) * currentOrder.services.price).toFixed(2)}</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowModal(false);
                  setWeight("");
                  setCurrentOrder(null);
                }}
                className="border-gray-400 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWeight}
                disabled={!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Save & Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main export
export default function EmployeePage() {
  return <EmployeeContent />;
}