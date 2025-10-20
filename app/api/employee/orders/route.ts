// app/api/employee/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'

// 🔔 Notification Helper Function
async function createOrderNotification(notificationData: {
  userId: string | null; // Allow null for guests
  title: string;
  body: string;
  payload: any;
}) {
  try {
    // If it's a guest order (customer_id is null), don't create notification
    if (!notificationData.userId) {
      console.log('👤 Guest order - skipping notification');
      return;
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: notificationData.userId,
        title: notificationData.title,
        body: notificationData.body,
        payload: notificationData.payload,
        sent_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Error creating notification:', error);
    } else {
      console.log('✅ Notification created for user:', notificationData.userId);
    }
  } catch (error) {
    console.error('💥 Error in createOrderNotification:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting employee orders API');
    
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      console.log('❌ No user found in API route');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('✅ User authenticated in API:', user.email);

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    console.log('🏪 Branch ID from request:', branchId);

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Verify employee assignment
    console.log('👨‍💼 Checking employee assignment for branch:', branchId);
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id, shop_id, user_id')
      .eq('user_id', user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    console.log('📋 Assignment check result:', { 
      assignment, 
      assignmentError: assignmentError?.message 
    });

    if (assignmentError || !assignment) {
      return NextResponse.json({ 
        error: 'Not assigned to this branch'
      }, { status: 403 });
    }

    console.log('✅ Employee assignment verified');

    // 1. INBOX: Get orders that don't have order_items
    console.log('📥 Fetching orders for branch:', branchId);
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

    console.log('📦 Orders query result:', { 
      ordersCount: allOrders?.length, 
      ordersError: ordersError?.message 
    });

    // Get order_ids that already have order_items
    console.log('🔄 Fetching processed order IDs');
    const { data: processedOrderIds, error: processedError } = await supabaseAdmin
      .from('order_items')
      .select('order_id')
      .not('order_id', 'is', null);

    const processedIds = processedOrderIds?.map(item => item.order_id) || [];
    const pendingOrders = allOrders?.filter(order => !processedIds.includes(order.id)) || [];

    // 2. WORK QUEUE: Get active order_items with order data
    console.log('🛒 Fetching all active order_items');
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
    console.log('✅ Fetching completed orders from order_history');
    const { data: completedOrders, error: completedError } = await supabaseAdmin
      .from('order_history')
      .select('*')
      .eq('branch_id', branchId)
      .order('completed_at', { ascending: false })
      .limit(20);

    console.log('📊 FINAL QUERY RESULTS:', {
      pending: pendingOrders.length,
      active: filteredActiveItems.length, 
      completed: completedOrders?.length || 0
    });

    // Transform data with CORRECT status mapping
    const transformOrderItem = (orderItem: any) => {
      const order = orderItem.order;
      
      // CORRECT STATUS MAPPING - FIXED
      let frontendStatus: 'in_shop' | 'delivering' | 'done';
      switch (orderItem.status) {
        case 'in_progress':
        case 'ready':
          frontendStatus = 'in_shop';
          break;
        case 'delivering':
          frontendStatus = 'delivering';
          break;
        case 'completed':
          frontendStatus = 'done';
          break;
        default:
          frontendStatus = 'in_shop';
      }

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
        status: frontendStatus,
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
      order_item_id: history.id,
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
        id: '',
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
        status: 'in_progress',
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

    // 🔔 CREATE NOTIFICATION FOR ORDER CONFIRMATION
    await createOrderNotification({
      userId: orderItem.order.customer_id,
      title: 'Order Confirmed! ✅',
      body: `Your laundry order has been confirmed. Weight: ${kilo}kg. Total: ₱${subtotal.toFixed(2)}`,
      payload: {
        order_id: orderItem.order.id,
        order_status: 'confirmed',
        shop_name: orderItem.order.branch?.name,
        branch_name: orderItem.order.branch?.address,
        total_amount: subtotal,
        weight: kilo,
        price_per_kg: pricePerKg,
        service_name: orderItem.order.service?.name
      }
    });

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
    
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { orderItemId } = await request.json();
    
    console.log('📦 [PATCH] Updating order item status:', { orderItemId });

    if (!orderItemId) {
      return NextResponse.json({ 
        error: 'Missing required field: orderItemId' 
      }, { status: 400 });
    }

    // Get order item details first - use .maybeSingle() to handle empty results
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
      .maybeSingle(); // Use maybeSingle instead of single

    if (fetchError) {
      console.error('❌ [PATCH] Error fetching order item:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch order details: ' + fetchError.message 
      }, { status: 500 });
    }

    // Check if order item was found
    if (!orderItem) {
      console.log('❌ [PATCH] Order item not found, might be already completed:', orderItemId);
      return NextResponse.json({ 
        success: false,
        message: 'Order item not found. It may have been already completed or deleted.',
        orderItemId: orderItemId
      });
    }

    const orderMethod = orderItem.order.method?.code;
    const currentStatus = orderItem.status;
    
    console.log('🚚 Order details:', {
      method: orderMethod,
      currentStatus: currentStatus,
      orderId: orderItem.order.id,
      customer_id: orderItem.order.customer_id
    });

    // SMART STATUS TRANSITION LOGIC
    let nextStatus: string;
    
    if (currentStatus === 'in_progress' || currentStatus === 'ready') {
      if (orderMethod === 'delivery' || orderMethod === 'pickup') {
        // For delivery/pickup: in_shop → delivering
        nextStatus = 'delivering';
      } else {
        // For dropoff: in_shop → completed (direct to done)
        nextStatus = 'completed';
      }
    } else if (currentStatus === 'delivering') {
      // delivering → completed (final step for delivery/pickup)
      nextStatus = 'completed';
    } else {
      nextStatus = currentStatus; // No change
    }

    console.log('🔄 Status transition:', {
      from: currentStatus,
      to: nextStatus,
      method: orderMethod
    });

    const updateData: any = {
      status: nextStatus,
    };

    // Set completed_at if marking as completed
    if (nextStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Update order item status in ORDER_ITEMS table
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

    // 🔔 CREATE NOTIFICATIONS BASED ON STATUS CHANGE
    if (nextStatus === 'delivering') {
      // Order is now being delivered
      await createOrderNotification({
        userId: orderItem.order.customer_id,
        title: 'Order is Being Delivered! 🚚',
        body: `Your laundry order is now out for delivery to ${orderItem.order.delivery_location || 'your location'}.`,
        payload: {
          order_id: orderItem.order.id,
          order_status: 'delivering',
          delivery_status: 'delivering',
          shop_name: orderItem.order.branch?.name,
          branch_name: orderItem.order.branch?.address,
          delivery_location: orderItem.order.delivery_location
        }
      });
    } else if (nextStatus === 'completed') {
      console.log('📚 Moving completed order to order_history');
      
      const order = orderItem.order;
      
      // Insert into order_history - USING EXACT SCHEMA FROM YOUR DATABASE
      const historyData = {
        shop_id: order.branch.shop_id,
        branch_id: order.branch_id,
        customer_name: order.customer_name || order.customer?.full_name || 'Customer',
        customer_contact: order.customer_contact || null,
        delivery_location: order.delivery_location || null,
        method_id: order.method_id || null,
        method_code: order.method?.code || null,
        method_label: order.method?.label || null,
        service_name: order.service?.name || 'Standard Service',
        detergent_name: order.detergent?.name || null,
        softener_name: order.softener?.name || null,
        weight: orderItem.quantity,
        price: orderItem.subtotal,
        status: 'completed',
        completed_at: new Date().toISOString(),
        created_at: order.created_at || new Date().toISOString(),
        customer_id: order.customer_id || null
      };

      console.log('📝 Inserting into order_history with exact schema match');

      const { error: historyError } = await supabaseAdmin
        .from('order_history')
        .insert(historyData);

      if (historyError) {
        console.error('❌ [PATCH] Error saving to order_history:', historyError);
        return NextResponse.json({ 
          error: 'Failed to save order to history: ' + historyError.message 
        }, { status: 500 });
      } else {
        console.log('✅ [PATCH] Order saved to order_history');
        
        // 🔔 CREATE NOTIFICATION FOR ORDER COMPLETION
        await createOrderNotification({
          userId: order.customer_id,
          title: 'Order Completed! 🎉',
          body: `Your laundry order has been completed and is ready for ${order.method?.code === 'delivery' ? 'delivery' : 'pickup'}.`,
          payload: {
            order_id: order.id,
            order_status: 'completed',
            shop_name: order.branch?.name,
            branch_name: order.branch?.address,
            total_amount: orderItem.subtotal,
            weight: orderItem.quantity,
            price_per_kg: orderItem.price_per_unit,
            service_name: order.service?.name
          }
        });
      }

      // Delete from order_items (work queue) - ONLY after successful history insert
      const { error: deleteError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (deleteError) {
        console.error('❌ [PATCH] Error deleting from order_items:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to clean up order items: ' + deleteError.message 
        }, { status: 500 });
      } else {
        console.log('✅ [PATCH] Order removed from order_items');
      }

      // Delete from orders (inbox) if it exists
      const { error: deleteOrderError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteOrderError) {
        console.log('ℹ️ Order already removed from orders table or delete failed:', deleteOrderError.message);
      } else {
        console.log('✅ [PATCH] Order removed from orders');
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Order status updated to ${nextStatus}`,
      orderItem: updatedItem,
      nextStatus: nextStatus
    });

  } catch (error: any) {
    console.error('💥 [PATCH] Order status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update order status: ' + error.message },
      { status: 500 }
    );
  }
}