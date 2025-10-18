"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/lib/ui/tabs";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { useBranch } from "@/lib/branchcontext";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

const toDayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekdayShort = (d: Date): string => d.toLocaleDateString("en-US", { weekday: "short" });

interface Order {
  id: string;
  customer_name: string;
  method: string;
  amount: number;
  created_at: string;
  status: string | null;
}

interface Shop {
  id: string;
  name: string;
}

function DashboardContent() { // 👈 RENAME this component
  const router = useRouter();
  const { selectedBranch, branchChangeTrigger } = useBranch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ==============================
  // 🔐 AUTHENTICATION CHECK FIRST
  // ==============================
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔄 Checking owner authentication...")
        
        const response = await fetch('/api/owner/check-auth');
        const { authorized, error, user } = await response.json();
        
        console.log('Owner auth check result:', { authorized, error, user });
        
        if (!response.ok || !authorized) {
          toast.error(error || "Owner access required");
          router.replace("/login");
          return;
        }

        console.log("✅ Owner authenticated, fetching data...")
        setIsAuthorized(true);
        
      } catch (error) {
        console.error("Auth check error:", error);
        toast.error("Authentication failed");
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router]);

  // ==============================
  // 📊 FETCH DATA ONLY WHEN AUTHORIZED + BRANCH CHANGES
  // ==============================
  useEffect(() => {
    if (!isAuthorized || !selectedBranch) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("📡 Fetching owner dashboard data for branch:", selectedBranch.id)

        const response = await fetch(`/api/owner/dashboard-data?branch_id=${selectedBranch.id}`);
        const { shop, orders, error } = await response.json();
        
        if (error) throw new Error(error);
        
        if (shop) {
          setShopName(shop.name);
          console.log("🏪 Shop found:", shop.name)
        } else {
          console.log("❌ No shop found for this owner")
        }
        
        const parsedOrders = (orders || []).map((o: any) => ({
          id: o.id,
          customer_name: o.customer_name,
          method: o.method,
          amount: Number(o.amount) || 0,
          created_at: o.created_at,
          status: o.status,
          items: o.items || []
        })) as Order[];

        setOrders(parsedOrders);
        console.log("📦 Orders loaded:", parsedOrders.length)
        
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load dashboard data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthorized, selectedBranch, branchChangeTrigger]);

  // ==============================
  // 📈 ANALYTICS CALCULATIONS
  // ==============================
  const {
    totalSales,
    ordersToday,
    uniqueCustomers,
    weeklySales,
    weeklyPie,
    weeklyCustomerGrowth,
  } = useMemo(() => {
    if (orders.length === 0) {
      return {
        totalSales: 0,
        ordersToday: 0,
        uniqueCustomers: 0,
        weeklySales: [],
        weeklyPie: [],
        weeklyCustomerGrowth: [],
      };
    }

    console.log("📊 Calculating analytics for", orders.length, "orders")

    const now = new Date();
    const todayKey = toDayKey(now);

    const earliestByCustomer = new Map<string, string>();
    for (const o of orders) {
      const key = toDayKey(new Date(o.created_at));
      const name = o.customer_name?.trim();
      if (name && (!earliestByCustomer.has(name) || key < earliestByCustomer.get(name)!)) {
        earliestByCustomer.set(name, key);
      }
    }

    const todaysOrders = orders.filter(
      (o) => toDayKey(new Date(o.created_at)) === todayKey
    );

    const totalSales = todaysOrders.reduce((sum, o) => sum + o.amount, 0);
    const ordersToday = todaysOrders.length;
    const uniqueCustomers = new Set(todaysOrders.map((o) => o.customer_name)).size;

    // weekly data
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { name: weekdayShort(d), key: toDayKey(d) };
    });

    const weeklySales = weekDays.map((wd) => ({
      name: wd.name,
      sales: orders
        .filter((o) => toDayKey(new Date(o.created_at)) === wd.key)
        .reduce((sum, o) => sum + o.amount, 0),
    }));

    const weeklyOrders = orders.filter((o) => {
      const k = toDayKey(new Date(o.created_at));
      return k >= weekDays[0].key && k <= weekDays[6].key;
    });

    const countMethods = (arr: Order[]) => {
      const counts = { DropOff: 0, PickUp: 0, Delivery: 0 };
      for (const o of arr) {
        const m = (o.method || "").toLowerCase();
        if (m.includes("drop")) counts.DropOff++;
        else if (m.includes("pick")) counts.PickUp++;
        else if (m.includes("del")) counts.Delivery++;
      }
      return [
        { name: "Drop Off", value: counts.DropOff },
        { name: "Pick Up", value: counts.PickUp },
        { name: "Delivery", value: counts.Delivery },
      ];
    };

    const weeklyPie = countMethods(weeklyOrders);

    const weeklyCustomerGrowth = weekDays.map((wd) => {
      const customers = new Set(
        orders
          .filter((o) => toDayKey(new Date(o.created_at)) === wd.key)
          .map((o) => o.customer_name)
      );
      let newCount = 0;
      customers.forEach((name) => {
        if (earliestByCustomer.get(name) === wd.key) newCount++;
      });
      return { name: wd.name, new: newCount, returning: customers.size - newCount };
    });

    return {
      totalSales,
      ordersToday,
      uniqueCustomers,
      weeklySales,
      weeklyPie,
      weeklyCustomerGrowth,
    };
  }, [orders]);

  // ==============================
  // 🎯 RENDER LOGIC
  // ==============================
  
  // Show loading while checking auth OR fetching data
  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!isAuthorized ? "Checking permissions..." : "Loading dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  // Show branch selection prompt if no branch selected
  if (!selectedBranch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Please select a branch to view analytics</p>
        <p className="text-gray-400 mt-2">Use the branch selector in the sidebar</p>
      </div>
    );
  }

  // Show empty state if no data
  if (orders.length === 0) {
    return (
      <>
        <h1 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">
          {shopName ? `${shopName} — ` : ""}Analytics
        </h1>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No orders found for {selectedBranch.name}</p>
          <p className="text-gray-400 mt-2">Start accepting orders to see analytics</p>
        </div>
      </>
    );
  }

  // Show dashboard with data
  return (
    <>
      <Toaster position="top-right" richColors />
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">
        {shopName ? `${shopName} — ` : ""}Analytics
      </h1>

      {/* Branch Info */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-700 font-medium">
          Viewing data for: <span className="font-bold">{selectedBranch.name}</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <Card className="bg-green-100">
          <CardHeader><CardTitle>Sales Today</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">₱{totalSales.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-100">
          <CardHeader><CardTitle>Orders Today</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{ordersToday}</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-100">
          <CardHeader><CardTitle>Unique Customers</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{uniqueCustomers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="flex flex-wrap justify-center gap-2 mb-4">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <ChartCard title="Sales Overview">
              <LineChartComp data={weeklySales} />
            </ChartCard>

            <ChartCard title="Services Distribution">
              <PieChartComp data={weeklyPie} />
            </ChartCard>

            <ChartCard title="Customer Growth Trend">
              <BarChartComp data={weeklyCustomerGrowth} />
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

// --- Reusable Chart Components ---
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-64 sm:h-72 p-2 sm:p-4">{children}</CardContent>
    </Card>
  );
}

function LineChartComp({ data }: { data: { name: string; sales: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartComp({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" outerRadius={80} label>
          {data.map((entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarChartComp({ data }: { data: { name: string; new: number; returning: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="new" stackId="a" fill="#82ca9d" />
        <Bar dataKey="returning" stackId="a" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 👈 MAIN EXPORT - WRAP DashboardContent with DashboardLayout
export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}