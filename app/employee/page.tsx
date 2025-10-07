"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
};

export default function EmployeePage() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [ongoingOrders, setOngoingOrders] = useState<Order[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [searchOngoing, setSearchOngoing] = useState("");
  const [searchHistory, setSearchHistory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [weight, setWeight] = useState("");
  const [shopName, setShopName] = useState<string>("(Brand) Laundry Shop");

  useEffect(() => {
    if (!session) router.push("/login");
  }, [session, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const fetchShopAndOrders = async () => {
      if (!session) return;

      const { data: userData } = await supabase
        .from("users")
        .select("shop_id")
        .eq("id", session.user.id)
        .single();

      if (!userData?.shop_id) return;

      const { data: shopData } = await supabase
        .from("shops")
        .select("name")
        .eq("id", userData.shop_id)
        .single();

      if (shopData?.name) setShopName(shopData.name);

      const { data } = await supabase
        .from("orders")
        .select("*, services(name, price)")
        .eq("shop_id", userData.shop_id)
        .order("created_at", { ascending: false });

      if (!data) return;

      const pending = data.filter((o) => o.status === "pending");
      const ongoing = data.filter(
        (o) => o.status === "in_shop" || o.status === "delivering"
      );
      const history = data.filter((o) => o.status === "done");

      setOrders(data);
      setPendingOrders(pending);
      setOngoingOrders(ongoing);
      setOrderHistory(history);
    };

    fetchShopAndOrders();
  }, [session, supabase]);

  const handleConfirm = (order: Order) => {
    setCurrentOrder(order);
    setShowModal(true);
  };

  const handleSaveWeight = async () => {
    if (!currentOrder) return;
    const kilo = parseFloat(weight);
    if (isNaN(kilo) || kilo <= 0) {
      alert("Invalid weight. Please enter a valid number.");
      return;
    }

    const pricePerKg = currentOrder.services?.price ?? 0;
    const amount = kilo * pricePerKg;
    const method = currentOrder.method;
    const newStatus =
      method === "pickup" ? "done" : method === "dropoff" ? "in_shop" : "delivering";

    await supabase
      .from("orders")
      .update({ kilo, amount, status: newStatus })
      .eq("id", currentOrder.id);

    setPendingOrders(pendingOrders.filter((o) => o.id !== currentOrder.id));
    setOngoingOrders([
      ...ongoingOrders,
      { ...currentOrder, kilo, amount, status: newStatus },
    ]);
    setShowModal(false);
    setWeight("");
    setCurrentOrder(null);
  };

  const handleStatusChange = async (order: Order) => {
    let newStatus = order.status;

    if (order.method === "dropoff") newStatus = "done";
    else if (order.method === "delivery" && order.status === "in_shop")
      newStatus = "delivering";
    else if (order.status === "delivering") newStatus = "done";

    await supabase.from("orders").update({ status: newStatus }).eq("id", order.id);

    if (newStatus === "done") {
      setOrderHistory([
        ...orderHistory,
        { ...order, status: "done", created_at: new Date().toISOString() },
      ]);
      setOngoingOrders(ongoingOrders.filter((o) => o.id !== order.id));
    } else {
      setOngoingOrders(
        ongoingOrders.map((o) =>
          o.id === order.id ? { ...o, status: newStatus } : o
        )
      );
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="bg-blue-600 text-white py-3 px-4 md:px-6 rounded-md shadow-md flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left">
          {shopName}
        </h1>
        <Button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white w-full md:w-auto"
        >
          Logout
        </Button>
      </header>

      {/* Ongoing Orders */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Ongoing Orders</h2>
            <Input
              placeholder="Search Order"
              value={searchOngoing}
              onChange={(e) => setSearchOngoing(e.target.value)}
              className="w-full md:w-60"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Order #</th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Detergent</th>
                  <th className="p-2 border">Service</th>
                  <th className="p-2 border">Kilo</th>
                  <th className="p-2 border">Method</th>
                  <th className="p-2 border">Amount</th>
                  <th className="p-2 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {ongoingOrders
                  .filter((o) =>
                    o.customer_name
                      .toLowerCase()
                      .includes(searchOngoing.toLowerCase())
                  )
                  .map((o) => (
                    <tr key={o.id} className="text-center">
                      <td className="p-2 border">{o.id.slice(0, 5)}</td>
                      <td className="p-2 border">{o.customer_name}</td>
                      <td className="p-2 border">{o.detergent || "N/A"}</td>
                      <td className="p-2 border">{o.services?.name || "-"}</td>
                      <td className="p-2 border">{o.kilo ?? "-"}</td>
                      <td className="p-2 border">{o.method}</td>
                      <td className="p-2 border">
                        ₱{(o.amount ?? 0).toFixed(2)}
                      </td>
                      <td className="p-2 border">
                        <Button
                          size="sm"
                          className={`${
                            o.status === "in_shop"
                              ? "bg-yellow-400"
                              : o.status === "delivering"
                              ? "bg-blue-400"
                              : "bg-green-500"
                          } text-white`}
                          onClick={() => handleStatusChange(o)}
                        >
                          {o.status}
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending + History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Orders */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">Pending Orders</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[300px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Order #</th>
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((o) => (
                    <tr key={o.id} className="text-center">
                      <td className="p-2 border">{o.id.slice(0, 5)}</td>
                      <td className="p-2 border">{o.customer_name}</td>
                      <td className="p-2 border">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleConfirm(o)}
                        >
                          Confirm
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Order History */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Order History</h2>
              <Input
                placeholder="Search Order"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                className="w-full md:w-60"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Service</th>
                    <th className="p-2 border">Method</th>
                    <th className="p-2 border">Amount</th>
                    <th className="p-2 border">Date Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory
                    .filter((o) =>
                      o.customer_name
                        .toLowerCase()
                        .includes(searchHistory.toLowerCase())
                    )
                    .map((o) => (
                      <tr key={o.id} className="text-center">
                        <td className="p-2 border">{o.customer_name}</td>
                        <td className="p-2 border">{o.services?.name || "-"}</td>
                        <td className="p-2 border">{o.method}</td>
                        <td className="p-2 border">
                          ₱{(o.amount ?? 0).toFixed(2)}
                        </td>
                        <td className="p-2 border">
                          {new Date(o.created_at || "").toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      {showModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">
              Enter weight for {currentOrder.customer_name}
            </h3>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter kilos"
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveWeight}
                className="bg-blue-500 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
