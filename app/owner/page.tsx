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

interface ActivityLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_name: string;
  actor_name: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Helper function to generate empty chart data based on time period
const generateEmptyChartData = (period: string) => {
  switch (period) {
    case 'daily':
      // 24 hours
      return Array.from({ length: 24 }, (_, i) => ({
        name: `${i.toString().padStart(2, '0')}:00`,
        sales: 0
      }));
    case 'weekly':
      // Last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i);
        return {
          name: d.toLocaleDateString("en-US", { weekday: "short" }),
          sales: 0
        };
      });
    case 'monthly':
      // 4 weeks
      return Array.from({ length: 4 }, (_, i) => ({
        name: `W${i + 1}`,
        sales: 0
      }));
    case 'yearly':
      // 12 months
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          name: d.toLocaleDateString("en-US", { month: "short" }),
          sales: 0
        };
      });
    default:
      return Array.from({ length: 7 }, (_, i) => ({
        name: `Day ${i + 1}`,
        sales: 0
      }));
  }
};

function DashboardContent() {
  const router = useRouter();
  const { selectedBranch, branchChangeTrigger } = useBranch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const logsPerPage = 10;

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
  // 📝 FETCH ACTIVITY LOGS
  // ==============================
  useEffect(() => {
    if (!isAuthorized || !selectedBranch) return;

    const fetchActivityLogs = async () => {
      try {
        setLogsLoading(true);
        console.log("📝 Fetching activity logs for branch:", selectedBranch.id);

        const response = await fetch(
          `/api/owner/activity-logs?branch_id=${selectedBranch.id}&limit=${logsPerPage}&page=${logsPage}`
        );
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch activity logs");
        }
        
        console.log("📝 Activity logs loaded:", data.logs?.length || 0);
        setActivityLogs(data.logs || []);
        setHasMoreLogs(data.hasMore || false);
        
      } catch (error: any) {
        console.error("Error fetching activity logs:", error);
        // Don't show toast for logs failure - it's not critical
      } finally {
        setLogsLoading(false);
      }
    };

    fetchActivityLogs();
  }, [isAuthorized, selectedBranch, branchChangeTrigger, logsPage]);

  // ==============================
  // 📈 GENERATE EMPTY CHART DATA WHEN NO ANALYTICS
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
      // Generate empty chart data structures
      const emptyChartData = generateEmptyChartData(timePeriod);
      const emptyMethodDistribution = [
        { name: "Drop Off", value: 0 },
        { name: "Pick Up", value: 0 },
        { name: "Delivery", value: 0 },
      ];
      const emptyCustomerGrowthData = emptyChartData.map(item => ({
        name: item.name,
        new: 0,
        returning: 0
      }));

      return {
        totalSales: 0,
        totalOrders: 0,
        uniqueCustomers: 0,
        chartData: emptyChartData,
        methodDistribution: emptyMethodDistribution,
        customerGrowthData: emptyCustomerGrowthData,
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
  }, [analytics, timePeriod]);

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

  // Format date for activity logs
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get action label
  const getActionLabel = (action: string) => {
    const actions: Record<string, string> = {
      'order_created': 'Order Created',
      'order_status_changed': 'Status Updated',
      'payment_successful': 'Payment Received',
      'payment_failed': 'Payment Failed',
      'delivery_assigned': 'Delivery Assigned',
      'delivery_completed': 'Delivery Completed',
      'customer_complaint': 'Customer Complaint',
      'shop_settings_updated': 'Settings Updated',
      'employee_action': 'Employee Action',
      'login_success': 'Login Successful',
      'login_failed': 'Login Failed',
      'logout': 'User Logout',
      'manual_order_created': 'Manual Order Created',
      'order_processed': 'Order Processed',
      'order_weighted': 'Order Weighed',
      'order_status_updated': 'Order Status Updated',
      'order_completed': 'Order Completed',
    };
    return actions[action] || action.replace(/_/g, ' ');
  };

  // Pagination handlers
  const handleNextPage = () => {
    setLogsPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setLogsPage(prev => Math.max(1, prev - 1));
  };

  // ==============================
  // 🎨 RENDER DASHBOARD
  // ==============================
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
        {orders.length === 0 && (
          <p className="text-blue-600 text-sm mt-2">
            No orders found. Charts are showing empty data.
          </p>
        )}
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
              <LineChartComp data={chartData} isEmpty={totalSales === 0} />
            </ChartCard>

            <ChartCard title={`Services Distribution - ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}>
              <PieChartComp data={methodDistribution} isEmpty={totalOrders === 0} />
            </ChartCard>

            <ChartCard title={`Customer Growth - ${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}`}>
              <BarChartComp data={customerGrowthData} isEmpty={uniqueCustomers === 0} />
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>

      {/* 🔥 ACTIVITY LOGS TABLE - ADDED HERE 🔥 */}
      <div className="mt-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading activity logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent activity found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {getActionLabel(log.action)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {log.actor_name || 'System'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {log.entity_name || log.entity_type}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(log.severity)}`}>
                              {log.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {log.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Simple Pagination Controls */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-500">
                    Showing {activityLogs.length} activities
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={logsPage === 1}
                      className={`px-3 py-1 text-sm rounded border ${
                        logsPage === 1
                          ? 'text-gray-400 border-gray-300 cursor-not-allowed'
                          : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700">Page {logsPage}</span>
                    <button
                      onClick={handleNextPage}
                      disabled={!hasMoreLogs}
                      className={`px-3 py-1 text-sm rounded border ${
                        !hasMoreLogs
                          ? 'text-gray-400 border-gray-300 cursor-not-allowed'
                          : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
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

function LineChartComp({ data, isEmpty }: { data: { name: string; sales: number }[]; isEmpty?: boolean }) {
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
          strokeDasharray={isEmpty ? "5 5" : "0"} // Dashed line when empty
        />
        {isEmpty && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#666">
            No sales data
          </text>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartComp({ data, isEmpty }: { data: { name: string; value: number }[]; isEmpty?: boolean }) {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    // Don't show labels when all values are zero
    if (isEmpty) return null;
    
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
            <Cell 
              key={i} 
              fill={isEmpty ? "#e5e7eb" : COLORS[i % COLORS.length]} // Gray when empty
              opacity={isEmpty ? 0.5 : 1}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, 'Orders']} />
        {isEmpty && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#666">
            No orders
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarChartComp({ data, isEmpty }: { data: { name: string; new: number; returning: number }[]; isEmpty?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar 
          dataKey="new" 
          name="New Customers" 
          fill={isEmpty ? "#9ca3af" : "#82ca9d"} 
          opacity={isEmpty ? 0.5 : 1}
        />
        <Bar 
          dataKey="returning" 
          name="Returning Customers" 
          fill={isEmpty ? "#6b7280" : "#8884d8"} 
          opacity={isEmpty ? 0.5 : 1}
        />
        {isEmpty && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#666">
            No customer data
          </text>
        )}
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