// app/api/admin/branches/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

// PUT /api/admin/branches/[id] - Update branch (Admin only)
export async function PUT(
    request: Request,
  { params }: { params: { id: string } }  // ✅ Remove Promise
) {
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params;
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid branch ID" }, { status: 400 })
    }

    // 🔒 Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { name, address, latitude, longitude } = requestBody;

    // 🔒 Input validation
    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json(
        { error: 'Branch name and address are required' },
        { status: 400 }
      )
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Branch location is required' },
        { status: 400 }
      )
    }

    // Length validation
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Branch name too long" }, { status: 400 })
    }

    if (address.trim().length > 200) {
      return NextResponse.json({ error: "Address too long" }, { status: 400 })
    }

    // Coordinate validation
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinate values" }, { status: 400 })
    }

    // 🔒 Verify branch exists and get current data for audit
    const { data: currentBranch, error: branchCheckError } = await supabaseAdmin
      .from('shop_branches')
      .select(`
        id, 
        name, 
        address, 
        latitude,
        longitude,
        shop_id, 
        shops (
          name
        )
      `)
      .eq('id', id)
      .single()

    if (branchCheckError || !currentBranch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    // Update the branch
    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .update({
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        shops (
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating branch:', error)
      return NextResponse.json({ error: "Failed to update branch" }, { status: 500 })
    }
    
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    // 🔒 Audit log the update
    try {
      // Handle both array and object formats for shops
      const currentShopName = Array.isArray(currentBranch.shops) 
        ? currentBranch.shops[0]?.name 
        : (currentBranch as any).shops?.name;

      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'branch_update',
          target_branch_id: id,
          target_shop_id: currentBranch.shop_id,
          description: `Updated branch: ${currentBranch.name} → ${name.trim()}`,
          old_values: {
            name: currentBranch.name,
            address: currentBranch.address,
            latitude: currentBranch.latitude,
            longitude: currentBranch.longitude
          },
          new_values: {
            name: name.trim(),
            address: address.trim(),
            latitude: latitude,
            longitude: longitude
          },
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ branch })
  } catch (error: any) {
    console.error('Error in branch update:', error)
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 })
  }
}

// DELETE /api/admin/branches/[id] - Delete branch (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }  // ✅ Remove Promise
) {
  try {
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params;  // ✅ Remove await
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid branch ID" }, { status: 400 })
    }

    // 🔒 Verify branch exists and get data for audit logging
    const { data: branch, error: branchCheckError } = await supabaseAdmin
      .from('shop_branches')
      .select(`
        id, 
        name, 
        shop_id, 
        shops (
          name
        )
      `)
      .eq('id', id)
      .single()

    if (branchCheckError || !branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    let deletionErrors: string[] = []

    // Delete related records with error handling
    const deletionOperations = [
      () => supabaseAdmin.from('branch_contacts').delete().eq('branch_id', id),
      () => supabaseAdmin.from('branch_detergents').delete().eq('branch_id', id),
      () => supabaseAdmin.from('branch_methods').delete().eq('branch_id', id),
      () => supabaseAdmin.from('branch_operating_hours').delete().eq('branch_id', id),
      () => supabaseAdmin.from('branch_service_options').delete().eq('branch_id', id),
      () => supabaseAdmin.from('branch_softeners').delete().eq('branch_id', id),
      () => supabaseAdmin.from('shop_services').delete().eq('branch_id', id),
      () => supabaseAdmin.from('shop_user_assignments').delete().eq('branch_id', id),
      () => supabaseAdmin.from('order_history').delete().eq('branch_id', id),
    ]

    // Execute all deletion operations with error handling
    for (const operation of deletionOperations) {
      try {
        const { error } = await operation()
        if (error) deletionErrors.push(error.message)
      } catch (error: any) {
        deletionErrors.push(error.message)
      }
    }

    // Handle orders and related records
    try {
      const { data: orders, error: ordersFetchError } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('branch_id', id)

      if (!ordersFetchError && orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id)
        
        const orderDeletionOperations = [
          () => supabaseAdmin.from('order_items').delete().in('order_id', orderIds),
          () => supabaseAdmin.from('payments').delete().in('order_id', orderIds),
          () => supabaseAdmin.from('deliveries').delete().in('order_id', orderIds),
          () => supabaseAdmin.from('orders').delete().in('id', orderIds),
        ]

        for (const operation of orderDeletionOperations) {
          const { error } = await operation()
          if (error) deletionErrors.push(error.message)
        }
      }
    } catch (error: any) {
      deletionErrors.push(`Order cleanup: ${error.message}`)
    }

    // Final branch deletion
    try {
      const { error: finalDeleteError } = await supabaseAdmin
        .from('shop_branches')
        .delete()
        .eq('id', id)

      if (finalDeleteError) {
        console.error('Final delete error:', finalDeleteError)
        return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
      }
    } catch (error: any) {
      console.error('Error in final branch deletion:', error)
      return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
    }

    // 🔒 Audit log the deletion
    try {
      // Handle both array and object formats for shops
      const shopName = Array.isArray(branch.shops) 
        ? branch.shops[0]?.name 
        : (branch as any).shops?.name;

      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'branch_deletion',
          target_branch_id: id,
          target_shop_id: branch.shop_id,
          target_branch_name: branch.name,
          target_shop_name: shopName,
          description: `Deleted branch: ${branch.name} from shop: ${shopName}`,
          deletion_errors: deletionErrors.length > 0 ? deletionErrors : null,
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Log audit failure but don't fail the request
    }

    return NextResponse.json({ 
      success: true,
      message: "Branch successfully deleted",
      partialErrors: deletionErrors.length > 0 ? deletionErrors : undefined
    })
  } catch (error: any) {
    console.error('Error in branch deletion:', error)
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
  }
}

// GET /api/admin/branches/[id] - Get specific branch details (Admin only)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }  // ✅ Remove Promise
) {
  try {
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params;  // ✅ Remove await
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid branch ID" }, { status: 400 })
    }

    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .select(`
        *,
        shops (
          id,
          name,
          owner_id
        ),
        branch_contacts (
          id,
          contact_type,
          value,
          is_primary
        ),
        branch_operating_hours (
          id,
          day_of_week,
          open_time,
          close_time,
          is_closed
        )
      `)
      .eq('id', id)
      .single()

    if (error || !branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    return NextResponse.json({ branch })
  } catch (error: any) {
    console.error('Error fetching branch:', error)
    return NextResponse.json({ error: "Failed to fetch branch" }, { status: 500 })
  }
}