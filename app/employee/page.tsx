// app/employee/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Type
type Order = {
  id: number;  
  name: string;
  detergent: string;
  type: string;
  kilo: number;
  method: string;
  amount: string;
  status: string;
  date?: string;
};

export default function EmployeePage() {
  const [searchOngoing, setSearchOngoing] = useState("");
  const [searchHistory, setSearchHistory] = useState("");

  const [ongoingOrders, setOngoingOrders] = useState<Order[]>([
    {
      id: 1,
      name: "Alex Rivera",
      detergent: "Pride",
      type: "Dry Wash",
      kilo: 2,
      method: "Pick Up",
      amount: "₱60",
      status: "In Shop",
    },
    {
      id: 2,
      name: "Pryde Gonzales",
      detergent: "Pride",
      type: "Dry Wash",
      kilo: 2,
      method: "Drop Off",
      amount: "₱60",
      status: "In Shop",
    },
  ]);

  const [pendingOrders, setPendingOrders] = useState([
    { id: 2, name: "Mia Santos" },
    { id: 3, name: "Jordan Cruz" },
    { id: 4, name: "Sophia Ramirez" },
  ]);

  const [orderHistory, setOrderHistory] = useState<Order[]>([
    {
      id: 5,
      name: "Ava Delgado",
      detergent: "Pride",
      type: "Dry Wash",
      kilo: 3,
      method: "Delivery",
      amount: "₱60",
      status: "Done",
      date: "09/25/25 10:20 AM",
    },
    {
      id: 6,
      name: "Noah Castillo",
      detergent: "Surf",
      type: "Wash Only",
      kilo: 2,
      method: "Pick Up",
      amount: "₱100",
      status: "Done",
      date: "09/25/25 10:30 AM",
    },
  ]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [weight, setWeight] = useState("");

  // Formula for computing amount (₱30/kg)
  const computeAmount = (kilo: number) => `₱${kilo * 30}`;

  // Confirm pending order → open modal
  const handleConfirm = (order: any) => {
    setCurrentOrder(order);
    setShowModal(true);
  };

  // Save weight & move to ongoing
  const handleSaveWeight = () => {
    if (!currentOrder) return;

    const kilo = parseFloat(weight);
    if (isNaN(kilo) || kilo <= 0) {
      alert("Invalid weight. Please enter a valid number.");
      return;
    }

    const newOrder: Order = {
      id: currentOrder.id,
      name: currentOrder.name,
      detergent: "Pride",
      type: "Wash and Fold",
      kilo,
      method: "Pick Up",
      amount: computeAmount(kilo),
      status: "In Shop",
    };

    setOngoingOrders([...ongoingOrders, newOrder]);
    setPendingOrders(pendingOrders.filter((o) => o.id !== currentOrder.id));
    setShowModal(false);
    setWeight("");
    setCurrentOrder(null);
  };

  // Handle status change
  const handleStatusChange = (order: Order) => {
    if (order.method === "Drop Off") {
      // move to history as Done
      const finishedOrder = {
        ...order,
        status: "Done",
        date: new Date().toLocaleString(),
      };
      setOrderHistory([...orderHistory, finishedOrder]);
      setOngoingOrders(ongoingOrders.filter((o) => o.id !== order.id));
    } else {
      // Pick Up or Delivery → set to Delivery
      setOngoingOrders(
        ongoingOrders.map((o) =>
          o.id === order.id ? { ...o, status: "Delivering" } : o
        )
      );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="bg-blue-600 text-white py-4 px-6 rounded-md shadow-md">
        <h1 className="text-2xl font-bold text-center">
          (Brand) Laundry Shop
        </h1>
      </header>

      {/* Ongoing Orders */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Ongoing Orders</h2>
            <Input
              placeholder="Search Order"
              value={searchOngoing}
              onChange={(e) => setSearchOngoing(e.target.value)}
              className="w-60"
            />
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Order #</th>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Detergent</th>
                <th className="p-2 border">Type of Wash</th>
                <th className="p-2 border">Kilo</th>
                <th className="p-2 border">Service Method</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {ongoingOrders
                .filter((o) =>
                  o.name.toLowerCase().includes(searchOngoing.toLowerCase())
                )
                .map((o) => (
                  <tr key={o.id} className="text-center">
                    <td className="p-2 border">{o.id}</td>
                    <td className="p-2 border">{o.name}</td>
                    <td className="p-2 border">{o.detergent}</td>
                    <td className="p-2 border">{o.type}</td>
                    <td className="p-2 border">{o.kilo}</td>
                    <td className="p-2 border">{o.method}</td>
                    <td className="p-2 border">{o.amount}</td>
                    <td className="p-2 border">
                      <Button
                        size="sm"
                        className={`${
                          o.status === "In Shop"
                            ? "bg-yellow-400"
                            : o.status === "Delivery"
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Orders */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">Pending Orders</h2>
            <table className="w-full border-collapse text-sm">
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
                    <td className="p-2 border">{o.id}</td>
                    <td className="p-2 border">{o.name}</td>
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
          </CardContent>
        </Card>

        {/* Order History */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Order History</h2>
              <Input
                placeholder="Search Order"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                className="w-60"
              />
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Type of Wash</th>
                  <th className="p-2 border">Service Method</th>
                  <th className="p-2 border">Amount</th>
                  <th className="p-2 border">Date Finished</th>
                </tr>
              </thead>
              <tbody>
                {orderHistory
                  .filter((o) =>
                    o.name.toLowerCase().includes(searchHistory.toLowerCase())
                  )
                  .map((o) => (
                    <tr key={o.id} className="text-center">
                      <td className="p-2 border">{o.name}</td>
                      <td className="p-2 border">{o.type}</td>
                      <td className="p-2 border">{o.method}</td>
                      <td className="p-2 border">{o.amount}</td>
                      <td className="p-2 border">{o.date}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">
              Enter weight for {currentOrder?.name}
            </h3>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter kilos"
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveWeight} className="bg-blue-500 text-white">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
