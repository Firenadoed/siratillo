"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

const toDayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekdayShort = (d: Date): string => d.toLocaleDateString("en-US", { weekday: "short" });

interface Order {
  id: string;
  service_id: string | null;
  customer_name: string;
  method: string;
  amount: number;
  created_at: string;
  status: string | null;
  detergent: string | null;
  kilo: number | null;
}

interface Shop {
  id: string;
  name: string;
}

export default function Dashboard() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);

  // redirect if not logged in
  useEffect(() => {
    if (session === null) router.push("/login");
  }, [session, router]);

  // fetch shop + orders
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: shop } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", session.user.id)
        .maybeSingle<Shop>();

      if (!shop?.id) {
        setLoading(false);
        return;
      }

      setShopName(shop.name);

      const start = new Date();
      start.setDate(start.getDate() - 365);

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("id, service_id, customer_name, method, amount, created_at, status, detergent, kilo")
        .eq("shop_id", shop.id)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true });

      if (error) console.error("Error fetching orders:", error);

      const parsed = (ordersData || []).map((o) => ({
        ...o,
        amount: Number(o.amount) || 0,
      })) as Order[];

      setOrders(parsed);
      setLoading(false);
    };

    fetchData();
  }, [session, supabase]);

  // --- ANALYTICS CALCULATIONS ---
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

  if (loading) {
    return (
      <DashboardLayout>
        <p className="p-6 text-center text-gray-600">Loading dashboard…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">
        {shopName ? `${shopName} — ` : ""}Analytics
      </h1>

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
    </DashboardLayout>
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
