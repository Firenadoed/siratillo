// app/api/admin/shops/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// PUT /api/admin/shops/[id] - Update shop
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params // Await params first
    const { name, description } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .update({ 
        name: name.trim(), 
        description: description?.trim() || null 
      })
      .eq('id', id) // Use the awaited id
      .select()
      .single()

    if (error) throw error
    
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    return NextResponse.json({ shop })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/shops/[id] - Delete shop
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Delete related records in correct order (child tables first)
    
    // 1. Delete order history related to this shop
    const { error: orderHistoryError } = await supabaseAdmin
      .from('order_history')
      .delete()
      .eq('shop_id', id)

    if (orderHistoryError) throw orderHistoryError

    // 2. Delete shop user assignments
    const { error: userAssignmentsError } = await supabaseAdmin
      .from('shop_user_assignments')
      .delete()
      .eq('shop_id', id)

    if (userAssignmentsError) throw userAssignmentsError

    // 3. Get all branches for this shop first
    const { data: branches, error: branchesFetchError } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('shop_id', id)

    if (branchesFetchError) throw branchesFetchError

    // 4. If there are branches, delete all branch-related data first
    if (branches && branches.length > 0) {
      const branchIds = branches.map(b => b.id)

      // Delete branch contacts
      const { error: contactsError } = await supabaseAdmin
        .from('branch_contacts')
        .delete()
        .in('branch_id', branchIds)

      if (contactsError) throw contactsError

      // Delete branch detergents
      const { error: detergentsError } = await supabaseAdmin
        .from('branch_detergents')
        .delete()
        .in('branch_id', branchIds)

      if (detergentsError) throw detergentsError

      // Delete branch methods
      const { error: methodsError } = await supabaseAdmin
        .from('branch_methods')
        .delete()
        .in('branch_id', branchIds)

      if (methodsError) throw methodsError

      // Delete branch operating hours
      const { error: hoursError } = await supabaseAdmin
        .from('branch_operating_hours')
        .delete()
        .in('branch_id', branchIds)

      if (hoursError) throw hoursError

      // Delete branch service options
      const { error: optionsError } = await supabaseAdmin
        .from('branch_service_options')
        .delete()
        .in('branch_id', branchIds)

      if (optionsError) throw optionsError

      // Delete branch softeners
      const { error: softenersError } = await supabaseAdmin
        .from('branch_softeners')
        .delete()
        .in('branch_id', branchIds)

      if (softenersError) throw softenersError

      // Get shop services for branches first (to handle orders.service_id foreign key)
      const { data: shopServices, error: servicesFetchError } = await supabaseAdmin
        .from('shop_services')
        .select('id')
        .in('branch_id', branchIds)

      if (servicesFetchError) throw servicesFetchError

      // Get all orders for these branches first
      const { data: orders, error: ordersFetchError } = await supabaseAdmin
        .from('orders')
        .select('id')
        .in('branch_id', branchIds)

      if (ordersFetchError) throw ordersFetchError

      // Delete order-related records first
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id)
        
        // Delete order items
        const { error: orderItemsError } = await supabaseAdmin
          .from('order_items')
          .delete()
          .in('order_id', orderIds)

        if (orderItemsError) throw orderItemsError

        // Delete payments
        const { error: paymentsError } = await supabaseAdmin
          .from('payments')
          .delete()
          .in('order_id', orderIds)

        if (paymentsError) throw paymentsError

        // Delete deliveries and delivery attempts
        const { data: deliveries, error: deliveriesFetchError } = await supabaseAdmin
          .from('deliveries')
          .select('id')
          .in('order_id', orderIds)

        if (deliveriesFetchError) throw deliveriesFetchError

        if (deliveries && deliveries.length > 0) {
          const deliveryIds = deliveries.map(d => d.id)
          
          // Delete delivery attempts
          const { error: attemptsError } = await supabaseAdmin
            .from('delivery_attempts')
            .delete()
            .in('delivery_id', deliveryIds)

          if (attemptsError) throw attemptsError

          // Delete deliveries
          const { error: deliveriesDeleteError } = await supabaseAdmin
            .from('deliveries')
            .delete()
            .in('id', deliveryIds)

          if (deliveriesDeleteError) throw deliveriesDeleteError
        }

        // Finally delete the orders themselves
        const { error: ordersDeleteError } = await supabaseAdmin
          .from('orders')
          .delete()
          .in('id', orderIds)

        if (ordersDeleteError) throw ordersDeleteError
      }

      // Now delete shop services (after orders are deleted)
      if (shopServices && shopServices.length > 0) {
        const { error: servicesDeleteError } = await supabaseAdmin
          .from('shop_services')
          .delete()
          .in('id', shopServices.map(s => s.id))

        if (servicesDeleteError) throw servicesDeleteError
      }

      // Finally delete the branches themselves
      const { error: branchesDeleteError } = await supabaseAdmin
        .from('shop_branches')
        .delete()
        .eq('shop_id', id)

      if (branchesDeleteError) throw branchesDeleteError
    }

    // 5. Now delete the shop itself
    const { error } = await supabaseAdmin
      .from('shops')
      .delete()
      .eq('id', id)

    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}