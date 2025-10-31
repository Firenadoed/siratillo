// app/api/owner/dashboard-data/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const period = searchParams.get('period') || 'weekly';
    
    console.log("🎯 Dashboard request:", { branchId, period });

    // Check session first
    const supabaseAuth = await supabaseServer()
    const { data: { session } } = await supabaseAuth.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("📊 Fetching dashboard data for owner:", session.user.id)

    // Verify owner role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        roles (name)
      `)
      .eq("user_id", session.user.id)

    const hasOwnerRole = roleData?.some((role: any) => role.roles?.name === 'owner')
    if (!hasOwnerRole) {
      return NextResponse.json({ error: "Owner access required" }, { status: 403 })
    }

    // Get owner's shop
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, description')
      .eq('owner_id', session.user.id)
      .single()

    if (shopError || !shop) {
      console.log("No shop found for owner:", session.user.id)
      return NextResponse.json({ 
        shop: null, 
        orders: [], 
        error: "No shop found for this owner" 
      })
    }

    console.log("🏪 Found shop:", shop.name)

    // ==============================
    // 🎯 BRANCH FILTERING
    // ==============================
    let branchIds: string[] = [];
    let selectedBranchName = "All Branches";

    if (branchId) {
      // Single branch mode
      const { data: branch, error: branchError } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name, shop_id')
        .eq('id', branchId)
        .eq('is_active', true)
        .single()

      if (branchError || !branch) {
        return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
      }

      if (branch.shop_id !== shop.id) {
        return NextResponse.json({ error: "Branch access denied" }, { status: 403 })
      }

      branchIds = [branchId];
      selectedBranchName = branch.name;
    } else {
      // All branches mode
      const { data: branches, error: branchesError } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name')
        .eq('shop_id', shop.id)
        .eq('is_active', true)

      if (branchesError || !branches || branches.length === 0) {
        return NextResponse.json({ 
          shop, 
          orders: [], 
          error: "No active branches found" 
        })
      }

      branchIds = branches.map(branch => branch.id);
      selectedBranchName = `${branches.length} Active Branches`;
    }

    // ==============================
    // 📅 DATE RANGE CALCULATION
    // ==============================
    const getDateRange = (period: string) => {
      const now = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'daily':
          // Last 24 hours
          startDate.setDate(now.getDate() - 1);
          break;
        case 'weekly':
          // Last 7 days
          startDate.setDate(now.getDate() - 7);
          break;
        case 'monthly':
          // Last 30 days
          startDate.setDate(now.getDate() - 30);
          break;
        case 'yearly':
          // Last 365 days
          startDate.setDate(now.getDate() - 365);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }
      
      return { startDate, endDate: now };
    };

    const { startDate, endDate } = getDateRange(period);
    console.log(`📅 Date range for ${period}:`, { startDate, endDate });

    // ==============================
    // 📊 GET ORDERS FROM ALL SOURCES
    // ==============================
    
    // 1. CURRENT ORDERS (orders table + order_items)
    const { data: currentOrders, error: currentOrdersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_contact,
        created_at,
        branch_id,
        method_id,
        order_items (
          id,
          quantity,
          price_per_unit,
          subtotal,
          status,
          shop_services (
            name
          )
        ),
        shop_methods (
          label
        )
      `)
      .in('branch_id', branchIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    // 2. COMPLETED ORDERS (order_history table)
    const { data: completedOrders, error: completedOrdersError } = await supabaseAdmin
      .from('order_history')
      .select(`
        id,
        customer_name,
        customer_contact,
        created_at,
        completed_at,
        branch_id,
        method_label,
        service_name,
        weight,
        price,
        status
      `)
      .in('branch_id', branchIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (currentOrdersError) console.error("Current orders error:", currentOrdersError)
    if (completedOrdersError) console.error("Completed orders error:", completedOrdersError)

    // ==============================
    // 🔄 TRANSFORM DATA FOR DASHBOARD
    // ==============================

    // Transform current orders
    const transformedCurrentOrders = (currentOrders || []).map((order: any) => {
      const mainItem = order.order_items?.[0];
      const totalAmount = order.order_items?.reduce((sum: number, item: any) => 
        sum + (item.subtotal || 0), 0) || 0;
      
      return {
        id: order.id,
        customer_name: order.customer_name || 'Walk-in Customer',
        method: order.shop_methods?.label || 'Unknown',
        amount: totalAmount,
        created_at: order.created_at,
        status: mainItem?.status || 'pending',
        branch_id: order.branch_id,
        items: order.order_items?.map((item: any) => ({
          service: item.shop_services?.[0]?.name || 'Unknown Service',
          quantity: item.quantity || 0,
          price: item.price_per_unit || 0,
          status: item.status
        })) || []
      }
    });

    // Transform completed orders
    const transformedCompletedOrders = (completedOrders || []).map((order: any) => ({
      id: order.id,
      customer_name: order.customer_name || 'Walk-in Customer',
      method: order.method_label || 'Unknown',
      amount: Number(order.price) || 0,
      created_at: order.completed_at || order.created_at,
      status: order.status || 'completed',
      branch_id: order.branch_id,
      items: [{
        service: order.service_name || 'Unknown Service',
        quantity: order.weight || 0,
        price: order.price / (order.weight || 1),
        status: 'completed'
      }]
    }));

    // Combine all orders (current + completed)
    const allOrders = [...transformedCurrentOrders, ...transformedCompletedOrders];
    
    console.log(`📦 Found ${allOrders.length} total orders (${transformedCurrentOrders.length} current + ${transformedCompletedOrders.length} completed) for period: ${period}`);

    // ==============================
    // 📈 DYNAMIC CHART DATA GENERATION
    // ==============================
    
    const generateChartData = (period: string, orders: any[]) => {
      switch (period) {
        case 'daily':
          return generateHourlyData(orders);
        case 'weekly':
          return generateWeeklyData(orders);
        case 'monthly':
          return generateMonthlyData(orders);
        case 'yearly':
          return generateYearlyData(orders);
        default:
          return generateWeeklyData(orders);
      }
    };

    const generateHourlyData = (orders: any[]) => {
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        return {
          name: `${hour}:00`,
          key: i
        };
      });

      return hours.map(hour => {
        const hourSales = orders
          .filter(order => {
            const orderHour = new Date(order.created_at).getHours();
            return orderHour === hour.key;
          })
          .reduce((sum, order) => sum + order.amount, 0);
        
        return {
          name: hour.name,
          sales: hourSales
        };
      });
    };

    const generateWeeklyData = (orders: any[]) => {
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i); // Last 7 days including today
        return {
          name: d.toLocaleDateString("en-US", { weekday: "short" }),
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        };
      });

      return weekDays.map(day => ({
        name: day.name,
        sales: orders
          .filter(order => order.created_at.startsWith(day.key))
          .reduce((sum, order) => sum + order.amount, 0)
      }));
    };

    const generateMonthlyData = (orders: any[]) => {
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const start = new Date();
        start.setDate(start.getDate() - (3 - i) * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return {
          name: `W${i + 1}`,
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      });

      return weeks.map(week => ({
        name: week.name,
        sales: orders
          .filter(order => {
            const orderDate = order.created_at.split('T')[0];
            return orderDate >= week.start && orderDate <= week.end;
          })
          .reduce((sum, order) => sum + order.amount, 0)
      }));
    };

    const generateYearlyData = (orders: any[]) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          name: d.toLocaleDateString("en-US", { month: "short" }),
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        };
      });

      return months.map(month => ({
        name: month.name,
        sales: orders
          .filter(order => order.created_at.startsWith(month.key))
          .reduce((sum, order) => sum + order.amount, 0)
      }));
    };

    // Generate customer growth data
    // Replace the generateCustomerGrowthData function with this corrected version:

const generateCustomerGrowthData = (period: string, orders: any[]) => {
  const chartData = generateChartData(period, orders);
  
  const earliestByCustomer = new Map<string, string>();
  for (const order of orders) {
    const key = order.created_at.split('T')[0];
    const name = order.customer_name?.trim();
    if (name && (!earliestByCustomer.has(name) || key < earliestByCustomer.get(name)!)) {
      earliestByCustomer.set(name, key);
    }
  }

  return chartData.map((timeSlot, index) => {
    const customers = new Set(
      orders
        .filter(order => {
          const orderDate = order.created_at.split('T')[0];
          if (period === 'daily') {
            // For daily, group by hour - use index to match the hour
            const orderHour = new Date(order.created_at).getHours();
            return orderHour === index; // Use index since hours are 0-23
          } else if (period === 'weekly') {
            // For weekly, match by exact date
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - 6 + i);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            });
            return orderDate === weekDays[index];
          } else if (period === 'monthly') {
            // For monthly, match by week ranges
            const weeks = Array.from({ length: 4 }, (_, i) => {
              const start = new Date();
              start.setDate(start.getDate() - (3 - i) * 7);
              const end = new Date(start);
              end.setDate(start.getDate() + 6);
              return {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
              };
            });
            return orderDate >= weeks[index].start && orderDate <= weeks[index].end;
          } else if (period === 'yearly') {
            // For yearly, match by month
            const months = Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - (11 - i));
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            });
            return orderDate.startsWith(months[index]);
          }
          return false;
        })
        .map(order => order.customer_name)
    );
    
    let newCount = 0;
    customers.forEach(name => {
      const firstOrderDate = earliestByCustomer.get(name);
      if (firstOrderDate) {
        if (period === 'daily') {
          // For daily, check if first order was today
          const today = new Date().toISOString().split('T')[0];
          if (firstOrderDate === today) newCount++;
        } else if (period === 'weekly') {
          // For weekly, check if first order was in this week day
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - 6 + i);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          });
          if (firstOrderDate === weekDays[index]) newCount++;
        } else if (period === 'monthly') {
          // For monthly, check if first order was in this week
          const weeks = Array.from({ length: 4 }, (_, i) => {
            const start = new Date();
            start.setDate(start.getDate() - (3 - i) * 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
          });
          if (firstOrderDate >= weeks[index].start && firstOrderDate <= weeks[index].end) newCount++;
        } else if (period === 'yearly') {
          // For yearly, check if first order was in this month
          const months = Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (11 - i));
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          });
          if (firstOrderDate.startsWith(months[index])) newCount++;
        }
      }
    });
    
    return { 
      name: timeSlot.name, 
      new: newCount, 
      returning: customers.size - newCount 
    };
  });
};
    // Generate method distribution data
    const generateMethodDistribution = (orders: any[]) => {
      const counts = { DropOff: 0, PickUp: 0, Delivery: 0 };
      for (const order of orders) {
        const method = (order.method || "").toLowerCase();
        if (method.includes("drop")) counts.DropOff++;
        else if (method.includes("pick")) counts.PickUp++;
        else if (method.includes("del")) counts.Delivery++;
      }
      return [
        { name: "Drop Off", value: counts.DropOff },
        { name: "Pick Up", value: counts.PickUp },
        { name: "Delivery", value: counts.Delivery },
      ];
    };

    // Generate analytics data
    const chartData = generateChartData(period, allOrders);
    const customerGrowthData = generateCustomerGrowthData(period, allOrders);
    const methodDistribution = generateMethodDistribution(allOrders);

    // Calculate summary metrics for the selected period
    const totalSales = allOrders.reduce((sum: number, order: any) => sum + order.amount, 0);
    const totalOrders = allOrders.length;
    const uniqueCustomers = new Set(allOrders.map((order: any) => order.customer_name)).size;

    return NextResponse.json({
      shop,
      orders: allOrders,
      analytics: {
        // Summary metrics for the selected period
        totalSales,
        totalOrders,
        uniqueCustomers,
        
        // Chart data
        chartData,
        customerGrowthData,
        methodDistribution,
        
        // Metadata
        period,
        selectedBranch: branchId ? {
          id: branchId,
          name: selectedBranchName
        } : null,
        totalBranches: branchIds.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      error: null
    })

  } catch (error: any) {
    console.error("Owner dashboard data error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}