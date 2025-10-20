import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define the expected params type
interface RouteParams {
  id: string
}

// PUT /api/admin/branches/[id]
export async function PUT(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const params = await context.params
    const { id } = params
    const { name, address, latitude, longitude } = await request.json()

    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json(
        { error: 'Branch name and address are required' },
        { status: 400 }
      )
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Branch location is required' },
        { status: 400 }
      )
    }

    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .update({
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    return NextResponse.json({ branch })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/branches/[id]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const params = await context.params
    const { id } = params

    // Delete records that reference this branch first
    
    // 1. Delete branch contacts
    const { error: contactsError } = await supabaseAdmin
      .from('branch_contacts')
      .delete()
      .eq('branch_id', id)

    if (contactsError) throw contactsError

    // 2. Delete branch detergents
    const { error: detergentsError } = await supabaseAdmin
      .from('branch_detergents')
      .delete()
      .eq('branch_id', id)

    if (detergentsError) throw detergentsError

    // 3. Delete branch methods
    const { error: methodsError } = await supabaseAdmin
      .from('branch_methods')
      .delete()
      .eq('branch_id', id)

    if (methodsError) throw methodsError

    // 4. Delete branch operating hours
    const { error: hoursError } = await supabaseAdmin
      .from('branch_operating_hours')
      .delete()
      .eq('branch_id', id)

    if (hoursError) throw hoursError

    // 5. Delete branch service options
    const { error: optionsError } = await supabaseAdmin
      .from('branch_service_options')
      .delete()
      .eq('branch_id', id)

    if (optionsError) throw optionsError

    // 6. Delete branch softeners
    const { error: softenersError } = await supabaseAdmin
      .from('branch_softeners')
      .delete()
      .eq('branch_id', id)

    if (softenersError) throw softenersError

    // 7. Delete shop services for this branch
    const { error: servicesError } = await supabaseAdmin
      .from('shop_services')
      .delete()
      .eq('branch_id', id)

    if (servicesError) throw servicesError

    // 8. Delete shop user assignments for this branch
    const { error: assignmentsError } = await supabaseAdmin
      .from('shop_user_assignments')
      .delete()
      .eq('branch_id', id)

    if (assignmentsError) throw assignmentsError

    // 9. Delete order history for this branch
    const { error: orderHistoryError } = await supabaseAdmin
      .from('order_history')
      .delete()
      .eq('branch_id', id)

    if (orderHistoryError) throw orderHistoryError

    // 10. Get orders for this branch to delete related records
    const { data: orders, error: ordersFetchError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('branch_id', id)

    if (ordersFetchError) throw ordersFetchError

    // 11. Delete order-related records
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

      // Delete deliveries
      const { error: deliveriesError } = await supabaseAdmin
        .from('deliveries')
        .delete()
        .in('order_id', orderIds)

      if (deliveriesError) throw deliveriesError

      // Finally delete the orders themselves
      const { error: ordersDeleteError } = await supabaseAdmin
        .from('orders')
        .delete()
        .in('id', orderIds)

      if (ordersDeleteError) throw ordersDeleteError
    }

    // 12. Now delete the branch itself
    const { error } = await supabaseAdmin
      .from('shop_branches')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}