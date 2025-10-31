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

interface Order {
  id: string;
  customer_name: string;
  method: string;
  amount: number;
  created_at: string;
  status: string | null;
  items: any[];
}

interface Shop {
  id: string;
  name: string;
}

interface Analytics {
  totalSales: number;
  totalOrders: number;
  uniqueCustomers: number;
  chartData: { name: string; sales: number }[];
  methodDistribution: { name: string; value: number }[];
  customerGrowthData: { name: string; new: number; returning: number }[];
  period: string;
}

function DashboardContent() {
  const router = useRouter();
  const { selectedBranch, branchChangeTrigger } = useBranch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');

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
        console.log("📡 Fetching owner dashboard data for branch:", selectedBranch.id, "period:", timePeriod);

        const response = await fetch(
          `/api/owner/dashboard-data?branch_id=${selectedBranch.id}&period=${timePeriod}`
        );
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch data");
        }
        
        console.log("📊 API Response:", data);
        
        if (data.shop) {
          setShopName(data.shop.name);
          console.log("🏪 Shop found:", data.shop.name)
        } else {
          console.log("❌ No shop found for this owner")
        }
        
        const parsedOrders = (data.orders || []).map((o: any) => ({
          id: o.id,
          customer_name: o.customer_name,
          method: o.method,
          amount: Number(o.amount) || 0,
          created_at: o.created_at,
          status: o.status,
          items: o.items || []
        })) as Order[];

        setOrders(parsedOrders);
        
        // Set analytics data from API
        if (data.analytics) {
          setAnalytics(data.analytics);
          console.log("📈 Analytics loaded:", data.analytics);
        }
        
        console.log("📦 Orders loaded:", parsedOrders.length)
        
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load dashboard data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthorized, selectedBranch, branchChangeTrigger, timePeriod]);

  // ==============================
  // 📈 USE ANALYTICS FROM API INSTEAD OF CALCULATING
  // ==============================
  const {
    totalSales,
    totalOrders,
    uniqueCustomers,
    chartData,
    methodDistribution,
    customerGrowthData,
  } = useMemo(() => {
    if (!analytics) {
      return {
        totalSales: 0,
        totalOrders: 0,
        uniqueCustomers: 0,
        chartData: [],
        methodDistribution: [],
        customerGrowthData: [],
      };
    }

    return {
      totalSales: analytics.totalSales || 0,
      totalOrders: analytics.totalOrders || 0,
      uniqueCustomers: analytics.uniqueCustomers || 0,
      chartData: analytics.chartData || [],
      methodDistribution: analytics.methodDistribution || [],
      customerGrowthData: analytics.customerGrowthData || [],
    };
  }, [analytics]);

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
          <span className="ml-2 text-blue-600">• {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} View</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <Card className="bg-green-100">
          <CardHeader>
            <CardTitle>
              Sales {timePeriod === 'daily' ? 'Today' : `This ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">₱{totalSales.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-100">
          <CardHeader>
            <CardTitle>
              Orders {timePeriod === 'daily' ? 'Today' : `This ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-100">
          <CardHeader>
            <CardTitle>Unique Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-bold">{uniqueCustomers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts with Time Period Tabs */}
      <Tabs value={timePeriod} className="w-full">
        <TabsList className="flex flex-wrap justify-center gap-2 mb-4">
          <TabsTrigger 
            value="daily"
            onClick={() => setTimePeriod('daily')}
            className={timePeriod === 'daily' ? 'bg-blue-500 text-black' : ''}
          >
            Daily
          </TabsTrigger>
          <TabsTrigger 
            value="weekly"
            onClick={() => setTimePeriod('weekly')}
            className={timePeriod === 'weekly' ? 'bg-blue-500 text-black' : ''}
          >
            Weekly
          </TabsTrigger>
          <TabsTrigger 
            value="monthly"
            onClick={() => setTimePeriod('monthly')}
            className={timePeriod === 'monthly' ? 'bg-blue-500 text-black' : ''}
          >
            Monthly
          </TabsTrigger>
          <TabsTrigger 
            value="yearly"
            onClick={() => setTimePeriod('yearly')}
            className={timePeriod === 'yearly' ? 'bg-blue-500 text-black' : ''}
          >
            Yearly
          </TabsTrigger>
        </TabsList>

        <TabsContent value={timePeriod}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <ChartCard title={`Sales Overview - ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}>
              <LineChartComp data={chartData} />
            </ChartCard>

            <ChartCard title={`Services Distribution - ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}>
              <PieChartComp data={methodDistribution} />
            </ChartCard>

            <ChartCard title={`Customer Growth - ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}>
              <BarChartComp data={customerGrowthData} />
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
      <CardHeader><CardTitle className="text-sm sm:text-base">{title}</CardTitle></CardHeader>
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
        <Tooltip 
          formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Sales']}
        />
        <Line 
          type="monotone" 
          dataKey="sales" 
          stroke="#8884d8" 
          strokeWidth={2} 
          dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartComp({ data }: { data: { name: string; value: number }[] }) {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie 
          data={data} 
          dataKey="value" 
          nameKey="name"
          outerRadius={80} 
          label={renderCustomizedLabel}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, 'Orders']} />
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
        <Bar dataKey="new" name="New Customers" fill="#82ca9d" />
        <Bar dataKey="returning" name="Returning Customers" fill="#8884d8" />
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