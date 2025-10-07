"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar,
  ResponsiveContainer
} from "recharts";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Sample orders data (mock for today)
const orders = [
  { id: 1, type: "Drop Off", amount: 280, customer: "John" },
  { id: 2, type: "Pick Up", amount: 420, customer: "Jane" },
  { id: 3, type: "Delivery", amount: 510, customer: "Mike" },
  { id: 4, type: "Drop Off", amount: 360, customer: "Anna" },
  { id: 5, type: "Pick Up", amount: 470, customer: "Chris" },
  { id: 6, type: "Delivery", amount: 600, customer: "Ella" },
];

// Weekly data
const weeklySales = [
  { name: "Mon", sales: 3200 },
  { name: "Tue", sales: 4100 },
  { name: "Wed", sales: 3600 },
  { name: "Thu", sales: 4800 },
  { name: "Fri", sales: 6200 },
  { name: "Sat", sales: 7500 },
  { name: "Sun", sales: 5400 },
];

// Monthly data (mock)
const monthlySales = [
  { name: "Week 1", sales: 15800 },
  { name: "Week 2", sales: 17600 },
  { name: "Week 3", sales: 19200 },
  { name: "Week 4", sales: 21000 },
  { name: "Week 5", sales: 21000 },
];

// Weekly pie data
const weeklyPie = [
  { name: "Drop Off", value: 2 },
  { name: "Pick Up", value: 2 },
  { name: "Delivery", value: 2 },
];

// Monthly pie data
const monthlyPie = [
  { name: "Drop Off", value: 28 },
  { name: "Pick Up", value: 34 },
  { name: "Delivery", value: 38 },
];

// Weekly Customer Growth (mock)
const weeklyCustomerGrowth = [
  { name: "Mon", new: 5, returning: 3 },
  { name: "Tue", new: 7, returning: 4 },
  { name: "Wed", new: 6, returning: 5 },
  { name: "Thu", new: 8, returning: 6 },
  { name: "Fri", new: 9, returning: 7 },
  { name: "Sat", new: 12, returning: 9 },
  { name: "Sun", new: 10, returning: 8 },
];

// Monthly Customer Growth (mock)
const monthlyCustomerGrowth = [
  { name: "Week 1", new: 35, returning: 20 },
  { name: "Week 2", new: 40, returning: 28 },
  { name: "Week 3", new: 50, returning: 32 },
  { name: "Week 4", new: 55, returning: 38 },
  { name: "Week 5", new: 60, returning: 42 },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

export default function Dashboard() {
  const [totalSales, setTotalSales] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [uniqueCustomers, setUniqueCustomers] = useState(0);

  useEffect(() => {
    // Compute totals dynamically
    const sales = orders.reduce((acc, order) => acc + order.amount, 0);
    setTotalSales(sales);

    setOrdersToday(orders.length);

    const customers = new Set(orders.map(o => o.customer));
    setUniqueCustomers(customers.size);
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Daily Analytics</h1>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="bg-green-100">
          <CardHeader>
            <CardTitle>Sales Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱{totalSales.toLocaleString()}</p>
            <p className="text-green-600">+8% vs Yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-100">
          <CardHeader>
            <CardTitle>Orders Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ordersToday}</p>
            <p className="text-red-600">-1% vs Yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-100">
          <CardHeader>
            <CardTitle>Unique Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{uniqueCustomers}</p>
            <p className="text-green-600">+3% vs Yesterday</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        {/* Weekly Charts */}
        <TabsContent value="weekly">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Services Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weeklyPie}
                      dataKey="value"
                      outerRadius={90}
                      fill="#8884d8"
                      label
                    >
                      {weeklyPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Customer Growth Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Growth Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyCustomerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="new" stackId="a" fill="#82ca9d" barSize={40} />
                    <Bar dataKey="returning" stackId="a" fill="#8884d8" barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Monthly Charts */}
        <TabsContent value="monthly">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#82ca9d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Services Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monthlyPie}
                      dataKey="value"
                      outerRadius={90}
                      fill="#8884d8"
                      label
                    >
                      {monthlyPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Customer Growth Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Growth Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyCustomerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="new" stackId="a" fill="#ffc658" barSize={40} />
                    <Bar dataKey="returning" stackId="a" fill="#8884d8" barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
