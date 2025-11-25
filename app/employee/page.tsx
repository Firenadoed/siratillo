// app/employee/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";
import { Input } from "@/lib/ui/input";
import { Toaster, toast } from "sonner";
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle, 
  Truck, 
  AlertCircle, 
  LogOut, 
  MapPin, 
  User, 
  Loader2,
  RefreshCw,
  Package,
  UserCheck,
  ShieldAlert,
  Calendar,
  Home,
  Plus,
  ShoppingBag
} from "lucide-react";

// Enhanced Types
type Order = {
  id: string;
  order_item_id: string | null;
  customer_name: string;
  detergent: string | null;
  softener: string | null;
  method: "dropoff" | "pickup" | "delivery";
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
  db_status?: string;
  driver_assigned?: boolean;
  driver_name?: string;
  driver_contact?: string;
  pickup_requested_at?: string;
  estimated_pickup_time?: string;
  last_status_update?: string;
};

type Service = {
  id: string;
  name: string;
  price_per_kg: number;
  description?: string;
};

type Detergent = {
  id: string;
  name: string;
  base_price: number;
  custom_price: number | null;
  final_price: number;
  is_available: boolean;
};

type Softener = {
  id: string;
  name: string;
  base_price: number;
  custom_price: number | null;
  final_price: number;
  is_available: boolean;
};

type Method = {
  code: "dropoff" | "pickup" | "delivery";
  label: string;
  enabled: boolean;
};

// Dynamically import Leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">Loading map...</div>
});

// Manual Order Creation Component
function ManualOrderCreation({ 
  branchId, 
  onOrderCreated,
  services,
  detergents,
  softeners,
  methods 
}: { 
  branchId: string;
  onOrderCreated: (tempOrder?: Order, revert?: boolean) => void;
  services: Service[];
  detergents: Detergent[];
  softeners: Softener[];
  methods: Method[];
}) {
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"dropoff" | "pickup" | "delivery">("dropoff");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDetergent, setSelectedDetergent] = useState<string>("");
  const [selectedSoftener, setSelectedSoftener] = useState<string>("");

  const availableMethods = methods.filter(m => m.enabled);
  const selectedServiceObj = services.find(s => s.id === selectedService);

  // Handle map location selection
  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    setDeliveryAddress(address);
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setSelectedMethod("dropoff");
    setDeliveryAddress("");
    setDeliveryLat(null);
    setDeliveryLng(null);
    setSelectedService("");
    setSelectedDetergent("");
    setSelectedSoftener("");
  };

  const handleCreateOrder = async () => {
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    
    if (!selectedService) {
      toast.error("Please select a service");
      return;
    }

    // For delivery and pickup orders, require address and coordinates
    if (selectedMethod === "delivery" || selectedMethod === "pickup") {
      if (!deliveryAddress.trim()) {
        toast.error("Please select a delivery location on the map");
        return;
      }
      if (!deliveryLat || !deliveryLng) {
        toast.error("Please select a valid delivery location on the map");
        return;
      }
    }

    setCreating(true);

    try {
      // 🔥 OPTIMISTIC UPDATE: Create temporary order immediately
      const tempOrder: Order = {
        id: `temp-${Date.now()}`,
        order_item_id: null,
        customer_name: customerName.trim(),
        detergent: detergents.find(d => d.id === selectedDetergent)?.name || null,
        softener: softeners.find(s => s.id === selectedSoftener)?.name || null,
        method: selectedMethod,
        method_label: methods.find(m => m.code === selectedMethod)?.label || selectedMethod,
        kilo: null,
        amount: null,
        status: 'pending',
        customer_contact: customerPhone.trim() || undefined,
        delivery_location: deliveryAddress.trim() || undefined,
        shop_id: branchId,
        db_status: selectedMethod === 'pickup' ? 'waiting_for_pickup' : undefined,
        created_at: new Date().toISOString()
      };

      // Add to orders list immediately
      onOrderCreated(tempOrder);

      const response = await fetch('/api/employee/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          method: selectedMethod,
          deliveryAddress: deliveryAddress.trim(),
          deliveryLat: deliveryLat,
          deliveryLng: deliveryLng,
          serviceId: selectedService,
          detergentId: selectedDetergent || null,
          softenerId: selectedSoftener || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // 🔥 REVERT optimistic update if failed
        onOrderCreated(tempOrder, true); // Remove temp order
        throw new Error(result.error || 'Failed to create order');
      }

      toast.success("Manual order created successfully!");
      setShowModal(false);
      resetForm();
      
      // Refresh to get the real order data
      onOrderCreated();
      
    } catch (error: any) {
      console.error("Error creating manual order:", error);
      toast.error("Failed to create order: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Manual Order
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-green-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Create Manual Order</h3>
                <p className="text-sm text-gray-600">For walk-in customers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Customer Information */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full"
                    type="tel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Service Method *
                  </label>
                  <div className="space-y-2">
                    {availableMethods.map((method) => (
                      <label key={method.code} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="method"
                          value={method.code}
                          checked={selectedMethod === method.code}
                          onChange={(e) => setSelectedMethod(e.target.value as typeof selectedMethod)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{method.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {(selectedMethod === "delivery" || selectedMethod === "pickup") && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {selectedMethod === "pickup" ? "Pickup Address *" : "Delivery Address *"}
                    </label>
                    <Input
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={selectedMethod === "pickup" ? "Enter pickup address" : "Enter delivery address"}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Service Selection */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Service *
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} - ₱{service.price_per_kg}/kg
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Detergent
                  </label>
                  <select
                    value={selectedDetergent}
                    onChange={(e) => setSelectedDetergent(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">No detergent</option>
                    {detergents.filter(d => d.is_available).map((detergent) => (
                      <option key={detergent.id} value={detergent.id}>
                        {detergent.name} - ₱{detergent.final_price}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fabric Softener
                  </label>
                  <select
                    value={selectedSoftener}
                    onChange={(e) => setSelectedSoftener(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">No softener</option>
                    {softeners.filter(s => s.is_available).map((softener) => (
                      <option key={softener.id} value={softener.id}>
                        {softener.name} - ₱{softener.final_price}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Delivery/Pickup Map */}
            {(selectedMethod === "delivery" || selectedMethod === "pickup") && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select {selectedMethod === "pickup" ? "Pickup" : "Delivery"} Location on Map *
                </label>
                <div className="space-y-3">
                  <div className="h-64 border border-gray-300 rounded-lg overflow-hidden">
                    <MapComponent 
                      onLocationSelect={handleLocationSelect}
                      selectedLat={deliveryLat}
                      selectedLng={deliveryLng}
                    />
                  </div>
                  {deliveryLat && deliveryLng && (
                    <p className="text-sm text-green-600">
                      Location selected: {deliveryLat.toFixed(6)}, {deliveryLng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                disabled={creating}
                className="border-gray-400 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={creating || !customerName.trim() || !selectedService || ((selectedMethod === "delivery" || selectedMethod === "pickup") && (!deliveryAddress || !deliveryLat || !deliveryLng))}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Enhanced Compact Order Card Component
function CompactOrderCard({ 
  order, 
  action,
  isProcessing = false,
  showDriverInfo = true
}: { 
  order: Order; 
  action?: React.ReactNode;
  isProcessing?: boolean;
  showDriverInfo?: boolean;
}) {
  const getStatusConfig = (order: Order) => {
    const baseStatus = order.status;
    const dbStatus = order.db_status;
    const method = order.method;
    
    // Handle different order types
    if (method === 'pickup') {
      if (dbStatus === 'waiting_for_pickup') {
        return {
          icon: <UserCheck className="h-4 w-4 text-orange-600" />,
          color: "bg-orange-50 border-orange-200",
          text: "Waiting for Driver",
          description: order.driver_assigned ? 
            `Driver assigned: ${order.driver_name || 'Unknown'}` : 
            "Awaiting driver pickup"
        };
      }
      
      if (dbStatus === 'collected') {
        return {
          icon: <Package className="h-4 w-4 text-blue-600" />,
          color: "bg-blue-50 border-blue-200",
          text: "Ready to Weigh",
          description: "Collected by driver"
        };
      }
    }

    if (method === 'delivery') {
      if (dbStatus === 'waiting_for_pickup') {
        return {
          icon: <UserCheck className="h-4 w-4 text-orange-600" />,
          color: "bg-orange-50 border-orange-200",
          text: "Ready for Delivery",
          description: order.driver_assigned ? 
            `Driver assigned: ${order.driver_name || 'Unknown'}` : 
            "Awaiting driver assignment"
        };
      }
    }

    // For dropoff orders that are pending but at the shop
    if (method === 'dropoff' && baseStatus === 'pending') {
      return {
        icon: <Home className="h-4 w-4 text-green-600" />,
        color: "bg-green-50 border-green-200",
        text: "Ready to Weigh",
        description: "At shop - dropoff order"
      };
    }

    // For delivery orders that are pending but at the shop
    if (method === 'delivery' && baseStatus === 'pending' && !dbStatus) {
      return {
        icon: <Package className="h-4 w-4 text-green-600" />,
        color: "bg-green-50 border-green-200",
        text: "Ready to Weigh",
        description: "At shop - delivery order"
      };
    }

    switch (baseStatus) {
      case "pending":
        return {
          icon: <Clock className="h-4 w-4 text-yellow-600" />,
          color: "bg-yellow-50 border-yellow-200",
          text: "Pending",
          description: "Awaiting processing"
        };
      case "in_shop":
        return {
          icon: <AlertCircle className="h-4 w-4 text-blue-600" />,
          color: "bg-blue-50 border-blue-200", 
          text: "In Progress",
          description: "Being processed in shop"
        };
      case "delivering":
        return {
          icon: <Truck className="h-4 w-4 text-purple-600" />,
          color: "bg-purple-50 border-purple-200",
          text: "Out for Delivery",
          description: order.driver_name ? `With ${order.driver_name}` : "With driver"
        };
      case "done":
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          color: "bg-green-50 border-green-200",
          text: "Completed",
          description: "Order delivered"
        };
      default:
        return {
          icon: <Clock className="h-4 w-4 text-gray-600" />,
          color: "bg-gray-50 border-gray-200",
          text: "Unknown",
          description: "Status unknown"
        };
    }
  };

  const statusConfig = getStatusConfig(order);
  const isWaitingForDriver = order.db_status === 'waiting_for_pickup';

  return (
    <Card className={`${statusConfig.color} border-l-4 border-l-current hover:shadow-md transition-all duration-200 ${
      isProcessing ? 'opacity-60 animate-pulse' : ''
    } ${isWaitingForDriver ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header with status */}
            <div className="flex items-center gap-2 mb-3">
              {statusConfig.icon}
              <h4 className="font-semibold text-gray-900 truncate">{order.customer_name}</h4>
              {isProcessing && (
                <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
              )}
            </div>
            
            {/* Status info */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 capitalize">
                {statusConfig.text}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {statusConfig.description}
              </p>
            </div>

            {/* Driver info if applicable */}
            {showDriverInfo && order.driver_assigned && order.db_status === 'waiting_for_pickup' && (
              <div className="flex items-center gap-1 mb-3 p-2 bg-orange-100 rounded-lg">
                <UserCheck className="h-3 w-3 text-orange-600" />
                <span className="text-xs font-medium text-orange-800">
                  Driver: {order.driver_name}
                </span>
              </div>
            )}

            {/* Order details */}
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between items-center">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">
                    {order.services?.name || "Standard"}
                  </span>
              </div>        
              <div className="flex justify-between items-center">
                  <span className="text-gray-600">Method:</span>
                  <span className="font-medium text-gray-900 capitalize whitespace-nowrap">
                    {order.method_label?.replace(/\s+/g, ' ') || order.method}
                  </span>
              </div>
              {order.kilo && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Weight:</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">{order.kilo} kg</span>
                </div>
              )}
              {order.amount && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-800">Total:</span>
                  <span className="font-bold text-blue-700 whitespace-nowrap">₱{order.amount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Time information */}
            {order.pickup_requested_at && isWaitingForDriver && (
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                Requested: {new Date(order.pickup_requested_at).toLocaleTimeString()}
              </div>
            )}
          </div>
          
          {/* Action button */}
          <div className="ml-3 flex-shrink-0">
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// FIXED: Enhanced OrderCard Component with Three Order Type Workflows
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
  const getStatusColor = (order: Order) => {
    const dbStatus = order.db_status;
    
    if (dbStatus === 'in_progress') return "bg-blue-100 text-blue-800 border-blue-300";
    if (dbStatus === 'ready_for_delivery') return "bg-purple-100 text-purple-800 border-purple-300";
    if (dbStatus === 'out_for_delivery') return "bg-orange-100 text-orange-800 border-orange-300";
    
    switch (order.status) {
      case "in_shop": return "bg-blue-100 text-blue-800 border-blue-300";
      case "delivering": return "bg-purple-100 text-purple-800 border-purple-300";
      case "done": return "bg-green-100 text-green-800 border-green-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getCardColor = (order: Order) => {
    const dbStatus = order.db_status;
    
    if (dbStatus === 'in_progress') return "bg-blue-50 border-blue-200";
    if (dbStatus === 'ready_for_delivery') return "bg-purple-50 border-purple-200";
    if (dbStatus === 'out_for_delivery') return "bg-orange-50 border-orange-200";
    
    switch (order.status) {
      case "in_shop": return "bg-blue-50 border-blue-200";
      case "delivering": return "bg-purple-50 border-purple-200";
      case "done": return "bg-green-50 border-green-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (order: Order) => {
    const dbStatus = order.db_status;
    
    if (dbStatus === 'in_progress') return <AlertCircle className="h-4 w-4 text-blue-600" />;
    if (dbStatus === 'ready_for_delivery') return <Package className="h-4 w-4 text-purple-600" />;
    if (dbStatus === 'out_for_delivery') return <Truck className="h-4 w-4 text-orange-600" />;
    
    switch (order.status) {
      case "in_shop": return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case "delivering": return <Truck className="h-4 w-4 text-purple-600" />;
      case "done": return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // FIXED: Correct next action based on order method and status
  const getNextAction = (order: Order) => {
    const dbStatus = order.db_status;
    const orderMethod = order.method;
    
    if (dbStatus === 'in_progress') {
      // DROP OFF: goes directly to completed
      if (orderMethod === 'dropoff') {
        return "Mark as Completed";
      }
      // PICK UP: goes to ready for delivery (back to customer)
      if (orderMethod === 'pickup') {
        return "Mark Ready for Delivery";
      }
      // DELIVER: goes to ready for delivery
      if (orderMethod === 'delivery') {
        return "Mark Ready for Delivery";
      }
    }
    
    if (dbStatus === 'ready_for_delivery') {
      // PICK UP & DELIVER: ready for driver to take (no employee action needed)
      if (orderMethod === 'pickup' || orderMethod === 'delivery') {
        return "Ready for Driver"; // Informational only
      }
    }
    
    if (dbStatus === 'out_for_delivery') {
      // PICK UP & DELIVER: driver has taken delivery - employee can mark as delivered
      return "Mark as Delivered";
    }
    
    return "Update Status";
  };

  const getStatusText = (order: Order) => {
    const dbStatus = order.db_status;
    const orderMethod = order.method;
    
    if (dbStatus === 'in_progress') {
      return "In Progress - Washing";
    }
    if (dbStatus === 'ready_for_delivery') {
      if (orderMethod === 'pickup') {
        return "Ready for Return";
      }
      return "Ready for Delivery";
    }
    if (dbStatus === 'out_for_delivery') {
      if (orderMethod === 'pickup') {
        return "Out for Return";
      }
      return "Out for Delivery";
    }
    return order.status.replace('_', ' ');
  };

  // FIXED: Only allow status updates for in_progress and out_for_delivery
  const canUpdateStatus = (order: Order) => {
    const allowedStatuses = ['in_progress', 'out_for_delivery'];
    return allowedStatuses.includes(order.db_status || '');
  };

  return (
    <Card className={`${getCardColor(order)} hover:shadow-lg transition-all border-2 ${isProcessing ? 'opacity-60' : ''}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{order.customer_name}</h3>
            <p className="text-sm text-gray-600">Order #{order.id.slice(-8)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${getStatusColor(order)} capitalize`}>
              {getStatusText(order)}
            </span>
            {isProcessing && (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>
        </div>

        {showDetails && (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-600 font-medium">Service:</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                {order.services?.name || "Standard"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-600 font-medium">Method:</span>
              <span className="font-semibold text-gray-900 capitalize whitespace-nowrap">
                {order.method_label?.replace(/\s+/g, ' ') || order.method}
              </span>
            </div>
            
            {/* Driver info for pickup and delivery orders */}
            {(order.method === 'pickup' || order.method === 'delivery') && order.driver_name && (
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 font-medium">Driver:</span>
                <span className="font-semibold text-gray-900 whitespace-nowrap">{order.driver_name}</span>
              </div>
            )}

            {order.detergent && (
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 font-medium">Detergent:</span>
                <span className="font-semibold text-gray-900 whitespace-nowrap">{order.detergent}</span>
              </div>
            )}
            {order.softener && (
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 font-medium">Softener:</span>
                <span className="font-semibold text-gray-900 whitespace-nowrap">{order.softener}</span>
              </div>
            )}
            {order.kilo && (
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 font-medium">Weight:</span>
                <span className="font-semibold text-gray-900 whitespace-nowrap">{order.kilo} kg</span>
              </div>
            )}
            {order.customer_contact && (
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600 font-medium">Contact:</span>
                <span className="font-semibold text-gray-900 whitespace-nowrap">{order.customer_contact}</span>
              </div>
            )}
            {order.delivery_location && (
              <div className="flex justify-between items-start py-1">
                <span className="text-gray-600 font-medium flex-shrink-0 mr-2">
                  {order.method === 'delivery' ? 'Delivery Address:' : 
                   order.method === 'pickup' ? 'Pickup Address:' : 'Location:'}
                </span>
                <span className="font-semibold text-gray-900 text-right break-words max-w-[200px]">
                  {order.delivery_location}
                </span>
              </div>
            )}
            {order.amount && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-gray-800 font-bold">Total Amount:</span>
                <span className="font-bold text-blue-700 text-lg whitespace-nowrap">₱{order.amount.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {onStatusChange && canUpdateStatus(order) && (
          <Button
            onClick={() => onStatusChange(order)}
            disabled={isProcessing}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
            size="sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                {getStatusIcon(order)}
                <span className="ml-2">{getNextAction(order)}</span>
              </>
            )}
          </Button>
        )}

        {/* Show informational text for ready_for_delivery status */}
        {(order.db_status === 'ready_for_delivery' && (order.method === 'pickup' || order.method === 'delivery')) && (
          <div className="w-full mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
            <Package className="h-4 w-4 text-purple-600 mx-auto mb-1" />
            <p className="text-sm text-purple-700 font-medium">
              {order.method === 'pickup' ? 'Ready for Return' : 'Ready for Delivery'}
            </p>
            <p className="text-xs text-purple-600">
              Waiting for driver to {order.method === 'pickup' ? 'return to customer' : 'take delivery'}
            </p>
          </div>
        )}

        {/* Show last update time if available */}
        {order.last_status_update && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Updated: {new Date(order.last_status_update).toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// CollapsibleSection Component
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

// Helper function for optimistic status updates
const getNextDbStatus = (currentStatus: string | undefined, method: string) => {
  if (method === 'dropoff') {
    if (currentStatus === 'in_progress') return 'completed';
  }
  if (method === 'pickup') {
    if (currentStatus === 'in_progress') return 'ready_for_delivery';
    if (currentStatus === 'ready_for_delivery') return 'completed';
  }
  if (method === 'delivery') {
    if (currentStatus === 'in_progress') return 'ready_for_delivery';
    if (currentStatus === 'ready_for_delivery') return 'out_for_delivery';
    if (currentStatus === 'out_for_delivery') return 'completed';
  }
  return currentStatus;
};

// Enhanced Main Component
function EmployeeContent() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("");
  const [branchAddress, setBranchAddress] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  
  // Enhanced state management
  const [showModal, setShowModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [weight, setWeight] = useState("");
  const [searchOngoing, setSearchOngoing] = useState("");
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [savingWeight, setSavingWeight] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // New state for manual order creation
  const [services, setServices] = useState<Service[]>([]);
  const [detergents, setDetergents] = useState<Detergent[]>([]);
  const [softeners, setSofteners] = useState<Softener[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);

  // Enhanced processing management
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

  // FIXED: Enhanced authentication with proper cleanup
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        console.log("🔄 Checking employee authentication...")
        
        const response = await fetch('/api/employee/check-auth');
        const { authorized, error, assignments } = await response.json();
        
        if (!mounted) return;
        
        if (!response.ok || !authorized) {
          toast.error(error || "Employee access required");
          router.replace("/login");
          return;
        }

        setIsAuthorized(true);
        
        if (assignments && assignments.length > 0) {
          const assignment = assignments[0];
          setShopName(assignment.shop.name);
          setBranchName(assignment.branch.name);
          setBranchAddress(assignment.branch.address);
          setCurrentShopId(assignment.branch_id);
        }
        
      } catch (error) {
        if (!mounted) return;
        console.error("Auth check error:", error);
        toast.error("Authentication failed");
        router.replace("/login");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  // FIXED: Fetch services, detergents, softeners, and methods for manual order creation
  const fetchShopData = useCallback(async () => {
    if (!currentShopId) return;

    try {
      const response = await fetch(`/api/employee/shop-data?branch_id=${currentShopId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch shop data');
      }

      setServices(data.services || []);
      setDetergents(data.detergents || []);
      setSofteners(data.softeners || []);
      setMethods(data.methods || []);
      
    } catch (error) {
      console.error("Error fetching shop data:", error);
      toast.error("Failed to load shop configuration");
    }
  }, [currentShopId]);

  // FIXED: Enhanced order fetching without infinite loop
  const fetchOrders = useCallback(async () => {
    if (!isAuthorized || !currentShopId) {
      return;
    }

    try {
      setRefreshing(true);
      
      const response = await fetch(`/api/employee/orders?branch_id=${currentShopId}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
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
      
      // Combine for display
      const allOrders = [
        ...(pendingOrders || []),
        ...(ongoingOrders || []), 
        ...(orderHistory || [])
      ];
      setOrders(allOrders);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error("💥 Error in fetchOrders:", error);
      toast.error("Error loading orders: " + (error as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [isAuthorized, currentShopId]);

  // FIXED: Main data loading effect with proper dependencies and cleanup
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted && isAuthorized && currentShopId) {
        await fetchOrders();
        await fetchShopData();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [isAuthorized, currentShopId, fetchOrders, fetchShopData]);

  // FIXED: Enhanced order filtering for three order types
  const { pendingOrders, ongoingOrders, orderHistory, waitingForDriverOrders } = useMemo(() => {
    if (orders.length === 0) {
      return { 
        pendingOrders: [], 
        ongoingOrders: [], 
        orderHistory: [], 
        waitingForDriverOrders: [] 
      };
    }

    const pending = orders.filter((o) => o.status === "pending");
    const ongoing = orders.filter((o) => 
      o.status === "in_shop" || o.status === "delivering"
    );
    const history = orders.filter((o) => o.status === "done");

    // Ready to weigh includes:
    // 1. DROP OFF orders that are at the shop (customer brings to shop)
    // 2. PICK UP orders that are collected by driver 
    // 3. DELIVER orders that are at shop without driver
    const readyToWeigh = pending.filter(o => {
      // DROP OFF orders: always ready to weigh (customer brings to shop)
      if (o.method === 'dropoff') {
        return true;
      }
      
      // PICK UP orders: collected by driver
      if (o.method === 'pickup') {
        return o.db_status === 'collected';
      }
      
      // DELIVER orders: at shop without driver
      if (o.method === 'delivery') {
        return !o.db_status || o.db_status === 'pending';
      }
      
      return false;
    });

    // Waiting for driver includes:
    // 1. PICK UP orders waiting for driver to collect from customer
    // 2. DELIVER orders waiting for driver to deliver to customer
    const waitingForDriver = pending.filter(o => 
      (o.method === 'pickup' || o.method === 'delivery') && 
      o.db_status === 'waiting_for_pickup'
    );

    return { 
      pendingOrders: readyToWeigh,
      waitingForDriverOrders: waitingForDriver, 
      ongoingOrders: ongoing, 
      orderHistory: history
    };
  }, [orders]);

  // Enhanced search
  const filteredOngoingOrders = useMemo(() => {
    return ongoingOrders.filter((o) =>
      o.customer_name.toLowerCase().includes(searchOngoing.toLowerCase()) ||
      o.customer_contact?.toLowerCase().includes(searchOngoing.toLowerCase()) ||
      o.driver_name?.toLowerCase().includes(searchOngoing.toLowerCase())
    );
  }, [ongoingOrders, searchOngoing]);

  // Enhanced logout
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

  // Handle manual order creation callback with optimistic updates
  const handleManualOrderCreated = useCallback((tempOrder?: Order, revert?: boolean) => {
    if (tempOrder) {
      if (revert) {
        // Remove temp order (revert)
        setOrders(prev => prev.filter(order => order.id !== tempOrder.id));
      } else {
        // Add temp order (optimistic update)
        setOrders(prev => [tempOrder, ...prev]);
      }
    } else {
      // Refresh orders normally
      fetchOrders();
    }
  }, [fetchOrders]);

  // FIXED: Enhanced weight confirmation for three order types
  const handleConfirm = (order: Order) => {
    if (isProcessing(order.id)) {
      return;
    }

    console.log('🔍 Handling confirm for order:', {
      id: order.id,
      method: order.method,
      db_status: order.db_status,
      status: order.status
    });

    // For PICK UP orders, check if they need driver collection
    if (order.method === 'pickup') {
      if (order.db_status === 'waiting_for_pickup') {
        toast.error("Order not collected yet. Waiting for driver to pick up from customer.");
        return;
      }
    }

    // For DELIVER orders, check if they need driver assignment
    if (order.method === 'delivery') {
      if (order.db_status === 'waiting_for_pickup') {
        toast.error("Order not ready yet. Waiting for delivery driver assignment.");
        return;
      }
    }

    // DROP OFF orders are always ready to weigh (customer brings to shop directly)

    addToProcessing(order.id);
    setCurrentOrder(order);
    setShowModal(true);
  };

  // 🔥 ENHANCED: Weight saving with optimistic updates
  const handleSaveWeight = async () => {
    if (!currentOrder) return;
    
    if (savingWeight) {
      return;
    }

    const kilo = parseFloat(weight);
    if (isNaN(kilo) || kilo <= 0) {
      toast.error("Please enter a valid weight greater than 0 kg");
      return;
    }

    if (kilo > 50) {
      toast.error("Weight seems too high. Please verify the amount.");
      return;
    }

    setSavingWeight(true);
    addToProcessing(currentOrder.id);

    try {
      const pricePerKg = currentOrder.services?.price ?? 0;
      const serviceId = currentOrder.services?.id;

      if (!serviceId) {
        toast.error("Service information missing");
        return;
      }

      // 🔥 OPTIMISTIC UPDATE: Remove from pending immediately
      setOrders(prev => prev.filter(order => order.id !== currentOrder.id));

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

      const result = await response.json();

      if (!response.ok || !result.success) {
        // 🔥 REVERT optimistic update if failed
        setOrders(prev => [...prev, currentOrder]);
        throw new Error(result.error || 'Failed to process order');
      }

      toast.success("Order moved to work queue!");
      
      // Refresh to get the actual order_item_id and updated data
      await fetchOrders();
      
      setShowModal(false);
      setWeight("");
      setCurrentOrder(null);
      
    } catch (error) {
      console.error("Error saving weight:", error);
      toast.error("An error occurred: " + (error as Error).message);
    } finally {
      setSavingWeight(false);
      removeFromProcessing(currentOrder.id);
    }
  };

  // 🔥 ENHANCED: Status change with optimistic updates
  const handleStatusChange = async (order: Order) => {
    if (!order.order_item_id) {
      toast.error("This order cannot be updated yet");
      return;
    }

    const orderItemId = order.order_item_id;
    
    if (isProcessing(orderItemId)) {
      return;
    }

    addToProcessing(orderItemId);

    try {
      // 🔥 OPTIMISTIC UPDATE: Update status immediately
      setOrders(prev => prev.map(o => 
        o.order_item_id === orderItemId 
          ? { 
              ...o, 
              // Optimistically update to next status
              db_status: getNextDbStatus(o.db_status, o.method),
              last_status_update: new Date().toISOString()
            }
          : o
      ));

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

      const result = await response.json();

      if (!response.ok || !result.success) {
        // 🔥 REVERT optimistic update if failed
        setOrders(prev => prev.map(o => 
          o.order_item_id === orderItemId 
            ? { ...o, db_status: order.db_status, last_status_update: order.last_status_update }
            : o
        ));
        throw new Error(result.error || 'Failed to update status');
      }

      toast.success("Order status updated!");
      
      // Refresh to get accurate data from server
      await fetchOrders();
      
    } catch (error) {
      console.error("Error changing status:", error);
      toast.error("Error updating status: " + (error as Error).message);
    } finally {
      removeFromProcessing(orderItemId);
    }
  };

  // Enhanced modal handling
  const handleModalClose = () => {
    if (currentOrder) {
      removeFromProcessing(currentOrder.id);
    }
    setShowModal(false);
    setWeight("");
    setCurrentOrder(null);
  };

  // Loading state
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
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
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
      
      {/* Enhanced Header with Real-time Info */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card className="bg-gradient-to-r from-blue-600 to-sky-600 border-0 shadow-xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
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
                
                {/* Real-time status */}
                <div className="flex flex-wrap items-center gap-4 bg-white/10 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-white" />
                    <p className="text-white text-sm">Welcome, Employee</p>
                  </div>
                  {lastUpdated && (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 text-white" />
                      <p className="text-blue-100 text-xs">
                        Updated: {lastUpdated.toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Enhanced Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
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
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* Manual Order Creation Button */}
                <ManualOrderCreation
                  branchId={currentShopId}
                  onOrderCreated={handleManualOrderCreated}
                  services={services}
                  detergents={detergents}
                  softeners={softeners}
                  methods={methods}
                />
                
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

      {/* Enhanced Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Priority Column - Enhanced with Driver Status */}
          <section className="xl:col-span-1 space-y-4">
            {/* Ready to Weigh */}
            <Card className="bg-white border-2 border-green-300 shadow-lg">
              <CardHeader className="bg-green-100 border-b-2 border-green-300">
                <CardTitle className="flex items-center gap-3">
                  <div className="bg-green-500 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Ready to Weigh
                    </h2>
                    <p className="text-green-700 text-sm font-medium">
                      {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-700 font-medium">All orders weighed</p>
                    <p className="text-sm text-gray-500">Ready for processing</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {pendingOrders.map(order => (
                      <CompactOrderCard 
                        key={order.id} 
                        order={order}
                        isProcessing={isProcessing(order.id)}
                        showDriverInfo={true}
                        action={
                          <Button 
                            size="sm" 
                            onClick={() => handleConfirm(order)}
                            disabled={isProcessing(order.id)}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                          >
                            {isProcessing(order.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Add Weight'
                            )}
                          </Button>
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Waiting for Driver */}
            {waitingForDriverOrders.length > 0 && (
              <Card className="bg-white border-2 border-orange-300 shadow-lg">
                <CardHeader className="bg-orange-100 border-b-2 border-orange-300">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-orange-500 p-2 rounded-lg">
                      <UserCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        Awaiting Driver
                      </h2>
                      <p className="text-orange-700 text-sm font-medium">
                        {waitingForDriverOrders.length} order{waitingForDriverOrders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {waitingForDriverOrders.map(order => (
                      <CompactOrderCard 
                        key={order.id} 
                        order={order}
                        isProcessing={isProcessing(order.id)}
                        showDriverInfo={true}
                        action={
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled
                            className="border-orange-300 text-orange-700 bg-orange-50"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Waiting
                          </Button>
                        }
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Active Work Column - Enhanced */}
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
                        Work Queue
                      </CardTitle>
                      <p className="text-blue-700 text-sm font-medium">
                        {ongoingOrders.length} active order{ongoingOrders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Input 
                    placeholder="Search customers, contacts, drivers..." 
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
                    <p className="text-gray-500">Orders will appear here once processed</p>
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

        {/* Enhanced History Section */}
        <div className="mt-4 sm:mt-6">
          <CollapsibleSection 
            title={`Order History • ${orderHistory.length} completed`}
            defaultOpen={orderHistory.length > 0}
          >
            {orderHistory.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No completed orders yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orderHistory.slice(0, 9).map(order => (
                  <div key={order.order_item_id || order.id} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-gray-900">{order.customer_name}</p>
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    </div>
                    <div className="text-sm text-gray-600 space-y-2">
                      <div>
                        <p className="text-gray-700 whitespace-nowrap">{order.services?.name} • {order.kilo ? `${order.kilo} kg` : 'No weight'}</p>
                        <p className="capitalize text-gray-500 whitespace-nowrap">{order.method_label?.replace(/\s+/g, ' ') || order.method}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-green-200">
                        <span className="font-medium text-gray-800">Total:</span>
                        <span className="font-bold text-green-700 whitespace-nowrap">₱{(order.amount || 0).toFixed(2)}</span>
                      </div>
                      {order.completed_at && (
                        <p className="text-xs text-gray-500 text-right">
                          {new Date(order.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* Enhanced Weight Modal */}
      {showModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm border-2 border-blue-300 animate-in fade-in-zoom-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Order Weight</h3>
                <p className="text-sm text-gray-600">Service: {currentOrder.services?.name}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weight (kg) *
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Enter weight in kilograms"
                  className="w-full border-blue-300 focus:border-blue-500 text-lg font-semibold"
                  autoFocus
                  disabled={savingWeight}
                />
                <p className="text-xs text-gray-500 mt-1">Typically between 1-20 kg</p>
              </div>
              
              {weight && !isNaN(parseFloat(weight)) && currentOrder.services && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg border-2 border-blue-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-700 mb-1">
                      ₱{(parseFloat(weight) * currentOrder.services.price).toFixed(2)}
                    </p>
                    <p className="text-sm text-blue-600">
                      {weight} kg × ₱{currentOrder.services.price}/kg
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
              >
                {savingWeight ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Move to Work
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeePage() {
  return <EmployeeContent />;
}