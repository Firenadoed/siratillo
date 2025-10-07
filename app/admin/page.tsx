"use client";

import { useState, useEffect } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

// Types
type Shop = {
  id: string;
  name: string;
  address: string;
  owner_id: string | null;
};

type Owner = {
  id: string;
  name: string;
  email: string;
  password: string;
  shop_id: string;
};

export default function ManageShops() {
  const supabase = useSupabaseClient();

  const [shops, setShops] = useState<Shop[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [searchShop, setSearchShop] = useState("");
  const [searchOwner, setSearchOwner] = useState("");

  const [openAddShop, setOpenAddShop] = useState(false);
  const [openAddOwner, setOpenAddOwner] = useState(false);

  const [newShopName, setNewShopName] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");

  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newOwnerShop, setNewOwnerShop] = useState("");

  useEffect(() => {
    fetchShops();
    fetchOwners();
  }, []);

  const fetchShops = async () => {
    const { data, error } = await supabase.from("shops").select("*");
    if (!error && data) setShops(data);
  };

  const fetchOwners = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "owner");
    if (!error && data) setOwners(data);
  };

  const handleAddShop = async () => {
    const { error } = await supabase.from("shops").insert([
      { name: newShopName, address: newShopAddress },
    ]);
    if (error) return alert("Failed to add shop: " + error.message);
    setOpenAddShop(false);
    setNewShopName("");
    setNewShopAddress("");
    fetchShops();
  };

  const handleAddOwner = async () => {
    // 1️⃣ Create owner in 'users' table
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newOwnerEmail,
        password: newOwnerPassword,
        name: newOwnerName,
        role: "owner",
        shop_id: newOwnerShop,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.message}`);
      return;
    }

    const createdOwner = await res.json(); // This should return the new owner object including `id`

    // 2️⃣ Update shop with owner_id
    const { error: updateError } = await supabase
      .from("shops")
      .update({ owner_id: createdOwner.id })
      .eq("id", newOwnerShop);

    if (updateError) {
      alert("Owner created, but failed to update shop: " + updateError.message);
    }

    // 3️⃣ Reset form and fetch
    setOpenAddOwner(false);
    setNewOwnerName("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setNewOwnerShop("");
    fetchOwners();
    fetchShops();
  };

  const filteredShops = shops.filter((s) =>
    s.name.toLowerCase().includes(searchShop.toLowerCase())
  );
  const filteredOwners = owners.filter((o) =>
    o.name.toLowerCase().includes(searchOwner.toLowerCase())
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Superadmin Header */}
      <header className="bg-purple-700 text-white py-3 px-4 md:px-6 rounded-md shadow-md flex flex-col md:flex-row justify-between items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-center md:text-left">
          Superadmin
        </h1>
        <Button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white w-full md:w-auto"
        >
          Logout
        </Button>
      </header>

      {/* Shops Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-xl font-semibold">Laundry Shops</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search shop..."
              value={searchShop}
              onChange={(e) => setSearchShop(e.target.value)}
              className="flex-1 sm:w-60"
            />
            <Button onClick={() => setOpenAddShop(true)}>+ Add Shop</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-1/3">Name</th>
                  <th className="p-2 w-1/3">Address</th>
                  <th className="p-2 w-1/3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map((shop) => {
                  const owner = owners.find((o) => o.id === shop.owner_id);
                  return (
                    <tr key={shop.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{shop.name}</td>
                      <td className="p-2">{shop.address}</td>
                      <td className="p-2">{owner?.name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-xl font-semibold">Owners</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search owner..."
              value={searchOwner}
              onChange={(e) => setSearchOwner(e.target.value)}
              className="flex-1 sm:w-60"
            />
            <Button onClick={() => setOpenAddOwner(true)}>+ Add Owner</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 w-1/3">Name</th>
                  <th className="p-2 w-1/3">Email</th>
                  <th className="p-2 w-1/3">Shop</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.map((owner) => {
                  const shop = shops.find((s) => s.id === owner.shop_id);
                  return (
                    <tr key={owner.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{owner.name}</td>
                      <td className="p-2">{owner.email}</td>
                      <td className="p-2">{shop?.name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Shop Modal */}
      <Dialog open={openAddShop} onOpenChange={setOpenAddShop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Shop name"
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
            />
            <Input
              placeholder="Address"
              value={newShopAddress}
              onChange={(e) => setNewShopAddress(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAddShop}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Owner Modal */}
      <Dialog open={openAddOwner} onOpenChange={setOpenAddOwner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Owner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
            />
            <Input
              placeholder="Email"
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={newOwnerPassword}
              onChange={(e) => setNewOwnerPassword(e.target.value)}
            />
            <select
              className="border rounded p-2 w-full"
              value={newOwnerShop}
              onChange={(e) => setNewOwnerShop(e.target.value)}
            >
              <option value="">Select Shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button onClick={handleAddOwner}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
