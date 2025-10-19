import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [1] Starting employee orders API (Server-side)');
    
    // Use server-side client with getUser (recommended)
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      console.log('❌ [2] No user found in API route');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('✅ [3] User authenticated in API:', user.email);

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    console.log('🏪 [4] Branch ID from request:', branchId);

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Verify employee assignment
    console.log('👨‍💼 [5] Checking employee assignment for branch:', branchId);
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id, shop_id, user_id')
      .eq('user_id', user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    console.log('📋 [6] Assignment check result:', { 
      assignment, 
      assignmentError: assignmentError?.message 
    });

    if (assignmentError || !assignment) {
      return NextResponse.json({ 
        error: 'Not assigned to this branch'
      }, { status: 403 });
    }

    console.log('✅ [7] Employee assignment verified');

    // 1. INBOX: Get orders that don't have order_items
    console.log('📥 [8] Fetching orders for branch:', branchId);
    const { data: allOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customer:users(full_name, phone),
        branch:shop_branches(name, address, shop_id),
        method:shop_methods(code, label),
        service:shop_services(id, name, price_per_kg),
        detergent:detergent_types(name),
        softener:softener_types(name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });

    console.log('📦 [9] Orders query result:', { 
      ordersCount: allOrders?.length, 
      ordersError: ordersError?.message 
    });

    // Get order_ids that already have order_items
    console.log('🔄 [10] Fetching processed order IDs');
    const { data: processedOrderIds, error: processedError } = await supabaseAdmin
      .from('order_items')
      .select('order_id')
      .not('order_id', 'is', null);

    const processedIds = processedOrderIds?.map(item => item.order_id) || [];
    const pendingOrders = allOrders?.filter(order => !processedIds.includes(order.id)) || [];

    // 2. WORK QUEUE: Get active order_items with order data
    console.log('🛒 [11] Fetching all active order_items');
    const { data: activeOrderItems, error: activeError } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        order:orders(
          *,
          customer:users(full_name, phone),
          branch:shop_branches(name, address, shop_id),
          method:shop_methods(code, label),
          detergent:detergent_types(name),
          softener:softener_types(name)
        ),
        service:shop_services(id, name, price_per_kg)
      `)
      .in('status', ['in_progress', 'ready', 'delivering'])
      .order('started_at', { ascending: true });

    // Filter by branch_id manually
    const filteredActiveItems = activeOrderItems?.filter(item => 
      item.order?.branch_id === branchId
    ) || [];

    // 3. COMPLETED: Get from order_history table
    console.log('✅ [12] Fetching completed orders from order_history');
    const { data: completedOrders, error: completedError } = await supabaseAdmin
      .from('order_history')
      .select('*')
      .eq('branch_id', branchId)
      .order('completed_at', { ascending: false })
      .limit(20);

    console.log('📊 [13] FINAL QUERY RESULTS:', {
      pending: pendingOrders.length,
      active: filteredActiveItems.length, 
      completed: completedOrders?.length || 0
    });

    // Transform data
    const transformOrderItem = (orderItem: any) => {
      const order = orderItem.order;
      return {
        id: order.id,
        order_item_id: orderItem.id,
        customer_name: order.customer_name || order.customer?.full_name || 'Customer',
        detergent: order.detergent?.name || null,
        softener: order.softener?.name || null,
        method: order.method?.code || 'dropoff',
        method_label: order.method?.label || 'Drop-off',
        kilo: orderItem.quantity,
        amount: orderItem.subtotal,
        status: orderItem.status === 'in_progress' ? 'in_shop' : 
                orderItem.status === 'ready' ? 'in_shop' :
                orderItem.status === 'delivering' ? 'delivering' : 'done',
        created_at: order.created_at,
        started_at: orderItem.started_at,
        completed_at: orderItem.completed_at,
        services: orderItem.service ? {
          id: orderItem.service.id,
          name: orderItem.service.name,
          price: orderItem.service.price_per_kg
        } : undefined,
        customer_contact: order.customer_contact,
        delivery_location: order.delivery_location,
        shop_id: branchId
      };
    };

    const transformPendingOrder = (order: any) => ({
      id: order.id,
      order_item_id: null,
      customer_name: order.customer_name || order.customer?.full_name || 'Customer',
      detergent: order.detergent?.name || null,
      softener: order.softener?.name || null,
      method: order.method?.code || 'dropoff',
      method_label: order.method?.label || 'Drop-off',
      kilo: null,
      amount: null,
      status: 'pending',
      created_at: order.created_at,
      started_at: null,
      completed_at: null,
      services: order.service ? {
        id: order.service.id,
        name: order.service.name,
        price: order.service.price_per_kg
      } : undefined,
      customer_contact: order.customer_contact,
      delivery_location: order.delivery_location,
      shop_id: branchId
    });

    const transformHistoryOrder = (history: any) => ({
      id: history.id,
      order_item_id: history.id, // Use history id since order_item is deleted
      customer_name: history.customer_name,
      detergent: history.detergent_name,
      softener: history.softener_name,
      method: history.method_code,
      method_label: history.method_label,
      kilo: history.weight,
      amount: history.price,
      status: 'done',
      created_at: history.created_at,
      started_at: history.created_at,
      completed_at: history.completed_at,
      services: {
        id: '', // Not available in history
        name: history.service_name,
        price: history.price / history.weight
      },
      customer_contact: history.customer_contact,
      delivery_location: history.delivery_location,
      shop_id: branchId
    });

    const result = {
      pendingOrders: pendingOrders.map(transformPendingOrder),
      ongoingOrders: filteredActiveItems.map(transformOrderItem),
      orderHistory: completedOrders?.map(transformHistoryOrder) || []
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('💥 Employee orders API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [POST] Starting order processing API');
    
    // Authentication
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { orderId, weight, serviceId, pricePerKg } = await request.json();
    
    console.log('📦 [POST] Processing order:', { orderId, weight, serviceId, pricePerKg });

    if (!orderId || !weight || !serviceId || !pricePerKg) {
      return NextResponse.json({ 
        error: 'Missing required fields: orderId, weight, serviceId, pricePerKg' 
      }, { status: 400 });
    }

    // Calculate subtotal
    const kilo = parseFloat(weight);
    const subtotal = kilo * pricePerKg;

    // TWO-BUCKET SYSTEM: Move from ORDERS to ORDER_ITEMS
    const { data: orderItem, error: insertError } = await supabaseAdmin
      .from('order_items')
      .insert({
        order_id: orderId,
        service_id: serviceId,
        quantity: kilo,
        price_per_unit: pricePerKg,
        subtotal: subtotal,
        status: 'in_progress', // Start in work queue
        started_at: new Date().toISOString()
      })
      .select(`
        *,
        order:orders(
          *,
          branch:shop_branches(shop_id),
          method:shop_methods(code, label),
          service:shop_services(name),
          detergent:detergent_types(name),
          softener:softener_types(name)
        )
      `)
      .single();

    if (insertError) {
      console.error('❌ [POST] Error creating order item:', insertError);
      return NextResponse.json({ 
        error: 'Failed to process order: ' + insertError.message 
      }, { status: 500 });
    }

    console.log('✅ [POST] Order successfully moved to work queue:', orderItem.id);

    return NextResponse.json({ 
      success: true,
      message: 'Order moved to work queue successfully',
      orderItem 
    });

  } catch (error: any) {
    console.error('💥 [POST] Order processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process order: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    console.log('🔄 [PATCH] Starting order status update API');
    
    // Authentication
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { orderItemId, status } = await request.json();
    
    console.log('📦 [PATCH] Updating order item status:', { orderItemId, status });

    if (!orderItemId || !status) {
      return NextResponse.json({ 
        error: 'Missing required fields: orderItemId, status' 
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['in_progress', 'ready', 'delivering', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      }, { status: 400 });
    }

    const updateData: any = {
      status: status
    };

    // Set completed_at if marking as completed
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Get order item details first
    const { data: orderItem, error: fetchError } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        order:orders(
          *,
          branch:shop_branches(shop_id),
          method:shop_methods(code, label),
          service:shop_services(name),
          detergent:detergent_types(name),
          softener:softener_types(name)
        )
      `)
      .eq('id', orderItemId)
      .single();

    if (fetchError) {
      console.error('❌ [PATCH] Error fetching order item:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch order details: ' + fetchError.message 
      }, { status: 500 });
    }

    // Update order item status in ORDER_ITEMS table (WORK QUEUE)
    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('order_items')
      .update(updateData)
      .eq('id', orderItemId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [PATCH] Error updating order item:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update order status: ' + updateError.message 
      }, { status: 500 });
    }

    console.log('✅ [PATCH] Order status updated successfully:', updatedItem.id);

    // If status is completed, move to order_history and clean up
    if (status === 'completed') {
      console.log('📚 Moving completed order to order_history');
      
      const order = orderItem.order;
      
      // Insert into order_history
      const { error: historyError } = await supabaseAdmin
        .from('order_history')
        .insert({
          shop_id: order.branch.shop_id,
          branch_id: order.branch_id,
          customer_name: order.customer_name || order.customer?.full_name || 'Customer',
          customer_contact: order.customer_contact,
          delivery_location: order.delivery_location,
          method_id: order.method_id,
          method_code: order.method?.code,
          method_label: order.method?.label,
          service_name: order.service?.name || orderItem.service?.name,
          detergent_name: order.detergent?.name,
          softener_name: order.softener?.name,
          weight: orderItem.quantity,
          price: orderItem.subtotal,
          status: 'completed',
          completed_at: new Date().toISOString()
        });

      if (historyError) {
        console.error('❌ [PATCH] Error saving to order_history:', historyError);
        // Don't fail the whole request, just log the error
      } else {
        console.log('✅ [PATCH] Order saved to order_history');
      }

      // Delete from order_items (work queue)
      const { error: deleteError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (deleteError) {
        console.error('❌ [PATCH] Error deleting from order_items:', deleteError);
        // Don't fail the whole request, just log the error
      } else {
        console.log('✅ [PATCH] Order removed from order_items');
      }

      // Delete from orders (inbox) if it exists
      const { error: deleteOrderError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteOrderError) {
        console.error('❌ [PATCH] Error deleting from orders:', deleteOrderError);
        // This might be expected if order was already deleted
      } else {
        console.log('✅ [PATCH] Order removed from orders');
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Order status updated to ${status}`,
      orderItem: updatedItem
    });

  } catch (error: any) {
    console.error('💥 [PATCH] Order status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update order status: ' + error.message },
      { status: 500 }
    );
  }
}