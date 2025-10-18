// app/api/owner/dashboard-data/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

interface Role {
  name: string;
}

interface UserRole {
  user_id: string;
  role_id: string;
  roles: Role;
}

interface ShopService {
  name: string;
}

interface OrderItem {
  quantity: number;
  price_per_unit: number;
  subtotal: number;
  shop_services: ShopService[];
}

interface Customer {
  full_name: string;
}

interface Order {
  id: string;
  total_amount: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  customer_id: string;
  branch_id: string;
  method_id: string;
  customers: Customer[];
  order_items: OrderItem[];
}

export async function GET(request: Request) {
  try {
    // Get branch_id from query parameters
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    
    console.log("🎯 Dashboard request with branch_id:", branchId);

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
      .eq("user_id", session.user.id) as { data: UserRole[] | null, error: any }

    const hasOwnerRole = roleData?.some(role => role.roles?.name === 'owner')
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
    // 🎯 BRANCH FILTERING LOGIC
    // ==============================
    let branchIds: string[] = [];
    let selectedBranchName = "All Branches";

    if (branchId) {
      // Single branch mode - verify the branch belongs to owner's shop
      console.log("📍 Single branch mode, verifying branch:", branchId);
      
      const { data: branch, error: branchError } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name, shop_id')
        .eq('id', branchId)
        .eq('is_active', true)
        .single()

      if (branchError || !branch) {
        console.error("❌ Branch not found or inactive:", branchId);
        return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
      }

      // Verify the branch belongs to the owner's shop
      if (branch.shop_id !== shop.id) {
        console.error("🚫 Branch access denied - shop mismatch");
        return NextResponse.json({ error: "Branch access denied" }, { status: 403 })
      }

      branchIds = [branchId];
      selectedBranchName = branch.name;
      console.log("✅ Branch verified:", selectedBranchName);

    } else {
      // All branches mode - get all active branches for this shop
      console.log("🌐 All branches mode");
      
      const { data: branches, error: branchesError } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name')
        .eq('shop_id', shop.id)
        .eq('is_active', true)

      if (branchesError) {
        console.error("Branches fetch error:", branchesError)
        return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
      }

      if (!branches || branches.length === 0) {
        console.log("No active branches found for shop")
        return NextResponse.json({ 
          shop, 
          orders: [], 
          selectedBranch: null,
          branchContext: "no_branches",
          error: "No active branches found" 
        })
      }

      branchIds = branches.map(branch => branch.id);
      selectedBranchName = `${branches.length} Active Branch${branches.length !== 1 ? 'es' : ''}`;
      console.log(`✅ Found ${branches.length} active branches`);
    }

    // ==============================
    // 📊 ORDERS FETCHING
    // ==============================
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    console.log(`📦 Fetching orders for ${branchIds.length} branch(es) from last 30 days`);

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        total_amount,
        order_status,
        payment_status,
        created_at,
        customer_id,
        branch_id,
        method_id,
        customers:users!orders_customer_id_fkey (
          full_name
        ),
        order_items (
          quantity,
          price_per_unit,
          subtotal,
          shop_services (
            name
          )
        )
      `)
      .in('branch_id', branchIds)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error("Orders fetch error:", ordersError)
      // Don't return error here, just log and continue with empty orders
    }

    // Get method labels separately for better performance
    const { data: methods, error: methodsError } = await supabaseAdmin
      .from('shop_methods')
      .select('id, code, label')

    const methodsMap = new Map()
    methods?.forEach(method => {
      methodsMap.set(method.id, method.label || method.code)
    })

    // Get branch names for order breakdown
    const { data: branchDetails } = await supabaseAdmin
      .from('shop_branches')
      .select('id, name')
      .eq('shop_id', shop.id)
      .eq('is_active', true)

    const branchMap = new Map()
    branchDetails?.forEach(branch => {
      branchMap.set(branch.id, branch.name)
    })

    // ✅ Data transformation for nested arrays
    const transformedOrders = (orders || []).map((order: any) => {
      const customerName = order.customers?.[0]?.full_name || 'Walk-in Customer'
      
      const items = (order.order_items || []).map((item: any) => ({
        service: item.shop_services?.[0]?.name || 'Unknown Service',
        quantity: item.quantity || 0,
        price: item.price_per_unit || 0
      }))

      return {
        id: order.id,
        customer_name: customerName,
        method: methodsMap.get(order.method_id) || 'Unknown',
        amount: Number(order.total_amount) || 0,
        created_at: order.created_at,
        status: order.order_status,
        branch_id: order.branch_id,
        branch_name: branchMap.get(order.branch_id) || 'Unknown Branch',
        items: items
      }
    })

    console.log(`📦 Found ${transformedOrders.length} orders for ${selectedBranchName}`)

    // ==============================
    // 📈 ANALYTICS CALCULATIONS
    // ==============================
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    
    const todaysOrders = transformedOrders.filter(
      (order: any) => order.created_at.startsWith(todayKey)
    );

    const totalSalesToday = todaysOrders.reduce((sum: number, order: any) => sum + order.amount, 0);
    const ordersCountToday = todaysOrders.length;
    const uniqueCustomersToday = new Set(todaysOrders.map((order: any) => order.customer_name)).size;

    // Branch breakdown
    const branchBreakdown = transformedOrders.reduce((acc: any, order: any) => {
      const branchName = order.branch_name;
      if (!acc[branchName]) {
        acc[branchName] = { orders: 0, revenue: 0 };
      }
      acc[branchName].orders += 1;
      acc[branchName].revenue += order.amount;
      return acc;
    }, {});

    return NextResponse.json({
      shop,
      orders: transformedOrders,
      analytics: {
        totalSalesToday,
        ordersCountToday,
        uniqueCustomersToday,
        branchBreakdown,
        selectedBranch: branchId ? {
          id: branchId,
          name: selectedBranchName
        } : null,
        branchContext: branchId ? 'single_branch' : 'all_branches',
        totalBranches: branchIds.length
      },
      error: null
    })

  } catch (error: any) {
    console.error("Owner dashboard data error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}