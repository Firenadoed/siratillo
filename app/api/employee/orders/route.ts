// app/api/employee/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'

// 🔔 ENHANCED Notification Helper Function with Push Notifications
async function createOrderNotification(notificationData: {
  userId: string | null;
  title: string;
  body: string;
  payload: any;
}) {
  try { 
    if (!notificationData.userId) {
      console.log('👤 Guest order - skipping notification');
      return;
    }

    console.log('📢 Creating notification for user:', notificationData.userId);

    // 1. Save to database
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: notificationData.userId,
        title: notificationData.title,
        body: notificationData.body,
        payload: notificationData.payload,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating notification:', error);
      return;
    }

    console.log('✅ Notification created in database:', notification.id);

    // 2. Send push notification to user's devices
    await sendPushNotificationToUser(notificationData.userId, {
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.payload
    });

  } catch (error) {
    console.error('💥 Error in createOrderNotification:', error);
  }
}

// ✅ NEW: Function to send push notifications via Expo
async function sendPushNotificationToUser(userId: string, notification: {
  title: string;
  body: string;
  data: any;
}) {
  try {
    console.log('📱 Getting push tokens for user:', userId);
    
    // 1. Get user's push tokens from database
    const { data: pushTokens, error } = await supabaseAdmin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId)
      .not('expo_push_token', 'is', null);

    if (error) {
      console.error('❌ Error fetching push tokens:', error);
      return;
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('📭 No push tokens found for user:', userId);
      return;
    }

    console.log(`📲 Sending push to ${pushTokens.length} device(s) for user:`, userId);

    // 2. Send to each device
    const sendPromises = pushTokens.map(async (tokenData) => {
      const message = {
        to: tokenData.expo_push_token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data
      };

      console.log('📤 Sending push notification:', {
        to: tokenData.expo_push_token?.substring(0, 20) + '...',
        title: notification.title
      });

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        
        if (result.data?.status === 'ok') {
          console.log('✅ Push notification sent successfully');
          return { success: true, result };
        } else {
          console.error('❌ Push notification failed:', result);
          return { success: false, result };
        }
      } catch (fetchError) {
        console.error('💥 Fetch error sending push notification:', fetchError);
        return { success: false, error: fetchError };
      }
    });

    const results = await Promise.all(sendPromises);
    const successfulSends = results.filter(r => r.success).length;
    
    console.log(`🎯 Push notification summary: ${successfulSends}/${results.length} successful`);

  } catch (error) {
    console.error('💥 Error in sendPushNotificationToUser:', error);
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

    if (assignmentError || !assignment) {
      return NextResponse.json({ 
        error: 'Not assigned to this branch'
      }, { status: 403 });
    }

    console.log('✅ Employee assignment verified');

    // 🔄 UPDATED: Get ALL orders with their order_items for proper three-type handling
    console.log('📥 Fetching orders for branch:', branchId);
    const { data: allOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items(
          id,
          status,
          quantity,
          subtotal,
          started_at,
          completed_at
        ),
        customer:users(full_name, phone),
        branch:shop_branches(name, address, shop_id),
        method:shop_methods(code, label),
        service:shop_services(id, name, price_per_kg),
        detergent:detergent_types(name),
        softener:softener_types(name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('❌ Orders query error:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // 🔄 UPDATED: Filter pending orders for all three order types
    const pendingOrders = allOrders?.filter(order => {
      const orderItem = order.order_items?.[0];
      const orderMethod = order.method?.code;
      
      // No order_items = pending (all order types)
      if (!orderItem) return true;
      
      // PICK UP orders: show in inbox until weighed (collected status)
      if (orderMethod === 'pickup') {
        return orderItem.status === 'collected'; // Only show when collected by driver
      }
      
      // DELIVERY orders: show in inbox if no weight set yet
      if (orderMethod === 'delivery') {
        return !orderItem.quantity; // No weight set yet
      }
      
      // DROP OFF orders: show in inbox if no weight set yet
      if (orderMethod === 'dropoff') {
        return !orderItem.quantity; // No weight set yet
      }
      
      return false;
    }) || [];

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
      .in('status', ['in_progress', 'ready_for_delivery', 'out_for_delivery'])
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

    // 🔄 UPDATED: Transform data with THREE ORDER TYPE status mapping
    const transformOrderItem = (orderItem: any) => {
      const order = orderItem.order;
      const orderMethod = order.method?.code;
      
      // 🔥 FIXED: Different status mapping based on THREE order methods
      let frontendStatus: 'pending' | 'in_shop' | 'delivering' | 'done';
      
      switch (orderItem.status) {
        case 'waiting_for_pickup':
          frontendStatus = 'pending'; // Show in INBOX for pickup orders
          break;
        case 'collected':
          frontendStatus = 'pending'; // Show in INBOX for pickup orders (ready to weigh)
          break;
        case 'in_progress':
          frontendStatus = 'in_shop'; // Show in WORK QUEUE
          break;
        case 'ready_for_delivery':
          // For pickup: "ready_for_delivery" means ready for driver to return to customer
          // For delivery: "ready_for_delivery" means ready for driver to deliver
          frontendStatus = 'in_shop'; // Still in shop until driver takes it
          break;
        case 'out_for_delivery':
          // Only delivery orders should show as "delivering"
          // Pickup returns don't use "out_for_delivery" status
          frontendStatus = orderMethod === 'delivery' ? 'delivering' : 'in_shop';
          break;
        case 'completed':
          frontendStatus = 'done'; // Completed
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
        method: orderMethod || 'dropoff',
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
        shop_id: branchId,
        db_status: orderItem.status // Keep for reference
      };
    };

    const transformPendingOrder = (order: any) => {
      const orderItem = order.order_items?.[0];
      const orderMethod = order.method?.code;
      
      let db_status = null;
      let status: 'pending' = 'pending';
      
      if (orderItem) {
        db_status = orderItem.status;
        // For all order types with order_items, still show as pending until weighed
        status = 'pending';
      }

      return {
        id: order.id,
        order_item_id: orderItem?.id || null,
        customer_name: order.customer_name || order.customer?.full_name || 'Customer',
        detergent: order.detergent?.name || null,
        softener: order.softener?.name || null,
        method: orderMethod || 'dropoff',
        method_label: order.method?.label || 'Drop-off',
        kilo: orderItem?.quantity || null,
        amount: orderItem?.subtotal || null,
        status: status,
        created_at: order.created_at,
        started_at: orderItem?.started_at || null,
        completed_at: orderItem?.completed_at || null,
        services: order.service ? {
          id: order.service.id,
          name: order.service.name,
          price: order.service.price_per_kg
        } : undefined,
        customer_contact: order.customer_contact,
        delivery_location: order.delivery_location,
        shop_id: branchId,
        db_status: db_status
      };
    };

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
      shop_id: branchId,
      db_status: 'completed'
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

    // Get order method and check if pickup order already has order_items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items(id, status),
        method:shop_methods(code)
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('❌ [POST] Error fetching order:', orderError);
      return NextResponse.json({ 
        error: 'Failed to fetch order details: ' + orderError.message 
      }, { status: 500 });
    }

    // Handle array response for method
    const orderMethod = Array.isArray(order.method) 
      ? order.method[0]?.code 
      : order.method?.code;

    const existingOrderItem = order.order_items?.[0];
    const kilo = parseFloat(weight);
    const subtotal = kilo * pricePerKg;

    console.log('🎯 Order details:', { 
      orderMethod, 
      existingOrderItem: existingOrderItem?.status,
      weight: kilo 
    });

    // 🔄 UPDATED: Handle THREE order types differently
    if (orderMethod === 'pickup') {
      // For PICK UP: must be collected before weighing
      if (!existingOrderItem || existingOrderItem.status !== 'collected') {
        return NextResponse.json({ 
          error: 'Pickup order not collected yet. Wait for delivery driver to collect from customer.' 
        }, { status: 400 });
      }

      // Update existing order_item with weight and move to in_progress
      const { data: orderItem, error: updateError } = await supabaseAdmin
        .from('order_items')
        .update({
          quantity: kilo,
          price_per_unit: pricePerKg,
          subtotal: subtotal,
          status: 'in_progress', // Move to washing stage
          started_at: new Date().toISOString()
        })
        .eq('id', existingOrderItem.id)
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

      if (updateError) {
        console.error('❌ [POST] Error updating pickup order:', updateError);
        return NextResponse.json({ 
          error: 'Failed to process pickup order: ' + updateError.message 
        }, { status: 500 });
      }

      console.log('✅ [POST] Pickup order weighted and moved to work queue:', orderItem.id);

      // 🔔 CREATE NOTIFICATION WITH PUSH
      await createOrderNotification({
        userId: orderItem.order.customer_id,
        title: 'Order Confirmed! ✅',
        body: `Your pickup laundry order has been weighed. Weight: ${kilo}kg. Total: ₱${subtotal.toFixed(2)}`,
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
        message: 'Pickup order weighted and moved to work queue',
        orderItem 
      });

    } else {
      // For DELIVERY/DROP OFF: create new order_items entry
      const { data: orderItem, error: insertError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: orderId,
          service_id: serviceId,
          quantity: kilo,
          price_per_unit: pricePerKg,
          subtotal: subtotal,
          status: 'in_progress', // Start washing immediately
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

      console.log('✅ [POST] Order moved to work queue:', orderItem.id);

      // 🔔 CREATE NOTIFICATION WITH PUSH
      const methodLabel = orderMethod === 'delivery' ? 'delivery' : 'dropoff';
      
      await createOrderNotification({
        userId: orderItem.order.customer_id,
        title: 'Order Confirmed! ✅',
        body: `Your ${methodLabel} laundry order has been confirmed. Weight: ${kilo}kg. Total: ₱${subtotal.toFixed(2)}`,
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
    }

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
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [PATCH] Error fetching order item:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch order details: ' + fetchError.message 
      }, { status: 500 });
    }

    if (!orderItem) {
      console.log('❌ [PATCH] Order item not found:', orderItemId);
      return NextResponse.json({ 
        success: false,
        message: 'Order item not found',
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

    // 🔥 FIXED: COMPLETE THREE ORDER TYPE WORKFLOW WITH CORRECT STATUS PROGRESSION
    let nextStatus: string;

    if (orderMethod === 'dropoff') {
      // 🔄 DROPOFF WORKFLOW: in_progress → completed (NO delivery steps)
      if (currentStatus === 'in_progress') {
        nextStatus = 'completed'; // Skip all delivery steps
      } else {
        nextStatus = currentStatus; // No change for other statuses
      }
    } 
    else if (orderMethod === 'pickup') {
      // 🔥 CORRECTED PICKUP WORKFLOW: 
      // waiting_for_pickup → collected → in_progress → ready_for_delivery → completed
      if (currentStatus === 'in_progress') {
        nextStatus = 'ready_for_delivery'; // Ready for driver to return to customer
      } else if (currentStatus === 'ready_for_delivery') {
        nextStatus = 'completed'; // Returned to customer (no out_for_delivery for pickup returns)
      } else {
        nextStatus = currentStatus;
      }
    }
    else if (orderMethod === 'delivery') {
      // 🔄 DELIVERY WORKFLOW: in_progress → ready_for_delivery → out_for_delivery → completed
      if (currentStatus === 'in_progress') {
        nextStatus = 'ready_for_delivery'; // Ready for driver to deliver
      } else if (currentStatus === 'ready_for_delivery') {
        nextStatus = 'out_for_delivery'; // Out for delivery
      } else if (currentStatus === 'out_for_delivery') {
        nextStatus = 'completed'; // Delivered to customer
      } else {
        nextStatus = currentStatus;
      }
    }
    else {
      // Default fallback
      nextStatus = currentStatus;
    }

    console.log('🔄 Status transition:', {
      method: orderMethod,
      from: currentStatus,
      to: nextStatus
    });

    const updateData: any = {
      status: nextStatus,
    };

    // Set completed_at if marking as completed
    if (nextStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Update order item status
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

    // 🔔 CREATE NOTIFICATIONS WITH PUSH BASED ON STATUS CHANGE AND ORDER METHOD
    if (nextStatus === 'ready_for_delivery') {
      if (orderMethod === 'pickup') {
        // Pickup: Ready for driver to return to customer
        await createOrderNotification({
          userId: orderItem.order.customer_id,
          title: 'Ready for Return! 📦',
          body: `Your laundry is cleaned, packed, and ready for return delivery.`,
          payload: {
            order_id: orderItem.order.id,
            order_status: 'ready_for_return',
            shop_name: orderItem.order.branch?.name,
            branch_name: orderItem.order.branch?.address
          }
        });
      } else if (orderMethod === 'delivery') {
        // Delivery: Ready for driver to deliver
        await createOrderNotification({
          userId: orderItem.order.customer_id,
          title: 'Ready for Delivery! 📦',
          body: `Your laundry is cleaned, packed, and ready for delivery.`,
          payload: {
            order_id: orderItem.order.id,
            order_status: 'ready_for_delivery',
            shop_name: orderItem.order.branch?.name,
            branch_name: orderItem.order.branch?.address
          }
        });
      }
    } 
    else if (nextStatus === 'out_for_delivery' && orderMethod === 'delivery') {
      // Only delivery orders go out for delivery
      await createOrderNotification({
        userId: orderItem.order.customer_id,
        title: 'Order is Being Delivered! 🚚',
        body: `Your laundry order is now out for delivery to ${orderItem.order.delivery_location || 'your location'}.`,
        payload: {
          order_id: orderItem.order.id,
          order_status: 'out_for_delivery',
          delivery_status: 'out_for_delivery',
          shop_name: orderItem.order.branch?.name,
          branch_name: orderItem.order.branch?.address,
          delivery_location: orderItem.order.delivery_location
        }
      });
    } 
    else if (nextStatus === 'completed') {
      console.log('📚 Moving completed order to order_history');
      
      const order = orderItem.order;
      
      // Insert into order_history
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

      console.log('📝 Inserting into order_history');

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
        
        // 🔔 CREATE NOTIFICATION FOR ORDER COMPLETION WITH PUSH
        let completionBody = '';
        if (orderMethod === 'dropoff') {
          completionBody = `Your dropoff laundry order has been completed! You can pick it up at the shop.`;
        } else if (orderMethod === 'pickup') {
          completionBody = `Your pickup laundry order has been completed and returned to you!`;
        } else if (orderMethod === 'delivery') {
          completionBody = `Your delivery laundry order has been completed and delivered!`;
        }

        await createOrderNotification({
          userId: order.customer_id,
          title: 'Order Completed! 🎉',
          body: completionBody,
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

      // Delete from order_items (work queue)
      const { error: deleteError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (deleteError) {
        console.error('❌ [PATCH] Error deleting from order_items:', deleteError);
      } else {
        console.log('✅ [PATCH] Order removed from order_items');
      }

      // Delete from orders (inbox)
      const { error: deleteOrderError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteOrderError) {
        console.log('ℹ️ Order already removed from orders table:', deleteOrderError.message);
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

// 🔥 FIXED: Manual Orders API Route - Handles all three order types
export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 [MANUAL ORDER] Starting manual order creation API');
    
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      branchId,
      customerName,
      customerPhone,
      method,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      serviceId,
      detergentId,
      softenerId,
    } = await request.json();
    
    console.log('📦 [MANUAL ORDER] Creating order with data:', { 
      branchId, customerName, method, serviceId,
      deliveryLat, deliveryLng
    });

    // Validate required fields
    if (!branchId || !customerName || !serviceId) {
      return NextResponse.json({ 
        error: 'Missing required fields: branchId, customerName, serviceId' 
      }, { status: 400 });
    }

    // Verify employee assignment to this branch
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id, shop_id, user_id')
      .eq('user_id', user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ 
        error: 'Not assigned to this branch or unauthorized' 
      }, { status: 403 });
    }

    // Get method ID
    const { data: methodData, error: methodError } = await supabaseAdmin
      .from('shop_methods')
      .select('id')
      .eq('code', method)
      .single();

    if (methodError) {
      console.error('❌ [MANUAL ORDER] Error fetching method:', methodError);
      return NextResponse.json({ 
        error: 'Invalid service method' 
      }, { status: 400 });
    }

    // 🔄 UPDATED: Handle PICKUP orders differently - create order_item immediately
    let createdOrder = null;
    let orderItemData = null;
    
    if (method === 'pickup') {
      // For PICKUP orders, create order_item with 'waiting_for_pickup' status
      console.log('🚚 [MANUAL ORDER] Creating pickup order with driver assignment needed');
      
      // First create the order
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          branch_id: branchId,
          customer_name: customerName,
          customer_contact: customerPhone || null,
          method_id: methodData.id,
          delivery_location: deliveryAddress || null,
          delivery_latitude: deliveryLat || null,
          delivery_longitude: deliveryLng || null,
          service_id: serviceId,
          detergent_id: detergentId || null,
          softener_id: softenerId || null,
          created_at: new Date().toISOString(),
          customer_id: null // Manual orders don't have registered customers
        })
        .select()
        .single();

      if (orderError) {
        console.error('❌ [MANUAL ORDER] Error creating order:', orderError);
        return NextResponse.json({ 
          error: 'Failed to create order: ' + orderError.message 
        }, { status: 500 });
      }

      createdOrder = order; // ✅ Store the order for later use

      // Then create order_item for pickup
      const { data: orderItem, error: itemError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          service_id: serviceId,
          status: 'waiting_for_pickup', // Needs driver to collect
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (itemError) {
        console.error('❌ [MANUAL ORDER] Error creating order item:', itemError);
        return NextResponse.json({ 
          error: 'Failed to create pickup order item: ' + itemError.message 
        }, { status: 500 });
      }

      orderItemData = orderItem;
      console.log('✅ [MANUAL ORDER] Pickup order created with driver assignment needed');

    } else {
      // For DELIVERY and DROP OFF: create order only (no order_item until weighed)
      console.log('💾 [MANUAL ORDER] Creating order record...');
      
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          branch_id: branchId,
          customer_name: customerName,
          customer_contact: customerPhone || null,
          method_id: methodData.id,
          delivery_location: deliveryAddress || null,
          delivery_latitude: deliveryLat || null,
          delivery_longitude: deliveryLng || null,
          service_id: serviceId,
          detergent_id: detergentId || null,
          softener_id: softenerId || null,
          created_at: new Date().toISOString(),
          customer_id: null // Manual orders don't have registered customers
        })
        .select()
        .single();

      if (orderError) {
        console.error('❌ [MANUAL ORDER] Error creating order:', orderError);
        return NextResponse.json({ 
          error: 'Failed to create order: ' + orderError.message 
        }, { status: 500 });
      }

      createdOrder = order; // ✅ Store the order for later use
      console.log('✅ [MANUAL ORDER] Order created:', order.id);
    }

    // ✅ FIXED: Now we can use createdOrder which is defined in both code paths
    if (createdOrder) {
      // Log the manual order creation
      await supabaseAdmin
        .from('employee_actions')
        .insert({
          employee_id: user.id,
          branch_id: branchId,
          action_type: 'manual_order_creation',
          description: `Created manual ${method} order for ${customerName}`,
          order_id: createdOrder.id,  // ✅ Now using createdOrder instead of order
          metadata: {
            customer_name: customerName,
            method: method,
            service_id: serviceId,
            delivery_lat: deliveryLat,
            delivery_lng: deliveryLng
          },
          created_at: new Date().toISOString()
        });

      console.log('🎉 [MANUAL ORDER] Manual order creation completed successfully');

      return NextResponse.json({ 
        success: true,
        message: 'Manual order created successfully',
        order: {
          id: createdOrder.id,  // ✅ Now using createdOrder instead of order
          customer_name: customerName,
          method: method,
          service_id: serviceId,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          order_item: orderItemData
        }
      });
    } else {
      throw new Error('Failed to create order - no order was created');
    }

  } catch (error: any) {
    console.error('💥 [MANUAL ORDER] Manual order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create manual order: ' + error.message },
      { status: 500 }
    );
  }
}