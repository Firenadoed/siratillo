// app/api/employee/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Verify employee assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Not assigned to this branch' }, { status: 403 });
    }

    // 🔄 CRITICAL CHANGE: Fetch from BOTH tables following the two-bucket system

    // 1. INBOX: Get pending orders from ORDERS table
    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customer:users(full_name, phone),
        branch:shop_branches(name, address),
        method:shop_methods(code, label),
        service:shop_services(name, price_per_kg)
      `)
      .eq('branch_id', branchId)
      .eq('status', 'pending') // Only pending orders in inbox
      .order('created_at', { ascending: true });

    // 2. WORK QUEUE: Get active orders from ORDER_ITEMS table
    const { data: activeOrderItems, error: activeError } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        order:orders(
          id,
          customer_id,
          customer_name,
          customer_contact,
          delivery_location,
          branch_id,
          method_id,
          detergent_id,
          softener_id,
          created_at,
          customer:users(full_name, phone),
          branch:shop_branches(name, address),
          method:shop_methods(code, label),
          detergent:detergent_types(name),
          softener:softener_types(name)
        ),
        service:shop_services(name, price_per_kg)
      `)
      .eq('order.branch_id', branchId)
      .in('status', ['in_progress', 'ready', 'delivering']) // Active statuses
      .order('started_at', { ascending: true });

    // 3. COMPLETED: Get completed orders from ORDER_ITEMS table
    const { data: completedOrderItems, error: completedError } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        order:orders(
          id,
          customer_id,
          customer_name,
          customer_contact,
          delivery_location,
          branch_id,
          method_id,
          detergent_id,
          softener_id,
          created_at,
          customer:users(full_name, phone),
          branch:shop_branches(name, address),
          method:shop_methods(code, label),
          detergent:detergent_types(name),
          softener:softener_types(name)
        ),
        service:shop_services(name, price_per_kg)
      `)
      .eq('order.branch_id', branchId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20); // Recent completions only

    if (pendingError || activeError || completedError) {
      console.error('Fetch errors:', { pendingError, activeError, completedError });
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Transform data to match your frontend expectations
    const transformOrderItem = (orderItem: any) => ({
      id: orderItem.order.id,
      customer_name: orderItem.order.customer_name || orderItem.order.customer?.full_name,
      detergent: orderItem.order.detergent?.name,
      method: orderItem.order.method?.code || 'dropoff',
      kilo: orderItem.quantity,
      amount: orderItem.subtotal,
      status: orderItem.status === 'in_progress' ? 'in_shop' : 
              orderItem.status === 'ready' ? 'in_shop' :
              orderItem.status === 'delivering' ? 'delivering' : 'done',
      created_at: orderItem.order.created_at,
      services: orderItem.service ? {
        name: orderItem.service.name,
        price: orderItem.service.price_per_kg
      } : undefined,
      shop_id: branchId
    });

    const transformPendingOrder = (order: any) => ({
      id: order.id,
      customer_name: order.customer_name || order.customer?.full_name,
      detergent: order.detergent?.name,
      method: order.method?.code || 'dropoff',
      kilo: null, // No weight yet in inbox
      amount: null, // No amount calculated yet
      status: 'pending',
      created_at: order.created_at,
      services: order.service ? {
        name: order.service.name,
        price: order.service.price_per_kg
      } : undefined,
      shop_id: branchId
    });

    return NextResponse.json({
      // INBOX: Pending orders from ORDERS table
      pendingOrders: (pendingOrders || []).map(transformPendingOrder),
      
      // WORK QUEUE: Active orders from ORDER_ITEMS table
      ongoingOrders: (activeOrderItems || []).map(transformOrderItem),
      
      // HISTORY: Completed orders from ORDER_ITEMS table
      orderHistory: (completedOrderItems || []).map(transformOrderItem)
    });

  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}