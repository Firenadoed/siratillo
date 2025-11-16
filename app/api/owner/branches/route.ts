// app/api/owner/branches/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, isOwnerOfShop } from '@/lib/owner-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    // Verify owner access and get their shop ID
    const { userId, shopId } = await requireOwner()

    // Fetch branches only for this owner's shop
    const { data: branches, error } = await supabaseAdmin
      .from('shop_branches')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching branches:', error)
      return NextResponse.json(
        { error: 'Failed to fetch branches' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      branches: branches || [] 
    })

  } catch (error: any) {
    console.error('Error in branches fetch:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify owner access and get their shop ID
    const { userId, shopId } = await requireOwner()

    const { name, address, latitude, longitude } = await request.json()

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      )
    }

    // Create the branch under the owner's shop
    const { data: branch, error: branchError } = await supabaseAdmin
      .from('shop_branches')
      .insert([
        {
          shop_id: shopId, // Use the owner's shop ID
          name,
          address,
          latitude: latitude || null,
          longitude: longitude || null,
          is_active: true
        }
      ])
      .select()
      .single()

    if (branchError) {
      console.error('Error creating branch:', branchError)
      return NextResponse.json(
        { error: 'Failed to create branch' },
        { status: 500 }
      )
    }

    // Enable default methods for the new branch
    const { data: methods } = await supabaseAdmin
      .from('shop_methods')
      .select('id')

    if (methods && methods.length > 0) {
      const methodAssignments = methods.map(method => ({
        branch_id: branch.id,
        method_id: method.id,
        is_enabled: true
      }))

      await supabaseAdmin
        .from('branch_methods')
        .insert(methodAssignments)
    }

    // Enable default service options
    const { data: options } = await supabaseAdmin
      .from('service_options')
      .select('id')

    if (options && options.length > 0) {
      const optionAssignments = options.map(option => ({
        branch_id: branch.id,
        option_id: option.id,
        is_enabled: true
      }))

      await supabaseAdmin
        .from('branch_service_options')
        .insert(optionAssignments)
    }

    // Create default operating hours
    const operatingHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      branch_id: branch.id,
      day_of_week: dayOfWeek,
      open_time: '09:00',
      close_time: '17:00',
      is_closed: dayOfWeek === 0 // Closed on Sunday by default
    }))

    await supabaseAdmin
      .from('branch_operating_hours')
      .insert(operatingHours)

    return NextResponse.json({ 
      success: true, 
      branch,
      message: 'Branch created successfully' 
    })

  } catch (error: any) {
    console.error('Error in branch creation:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, shopId } = await requireOwner()
    const { id, name, address, latitude, longitude, is_active } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Verify the branch belongs to owner's shop
    const { data: branchCheck, error: checkError } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single()

    if (checkError || !branchCheck) {
      return NextResponse.json(
        { error: 'Branch not found or access denied' },
        { status: 404 }
      )
    }

    // Update the branch
    const updateData: any = {}
    if (name) updateData.name = name
    if (address) updateData.address = address
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: branch, error: branchError } = await supabaseAdmin
      .from('shop_branches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (branchError) {
      console.error('Error updating branch:', branchError)
      return NextResponse.json(
        { error: 'Failed to update branch' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      branch,
      message: 'Branch updated successfully' 
    })

  } catch (error: any) {
    console.error('Error in branch update:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, shopId } = await requireOwner()
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('id')

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Verify the branch belongs to owner's shop
    const { data: branchCheck, error: checkError } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', branchId)
      .eq('shop_id', shopId)
      .single()

    if (checkError || !branchCheck) {
      return NextResponse.json(
        { error: 'Branch not found or access denied' },
        { status: 404 }
      )
    }

    // Check if there are any orders associated with this branch
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('branch_id', branchId)
      .limit(1)

    if (ordersError) {
      console.error('Error checking orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to check branch orders' },
        { status: 500 }
      )
    }

    if (orders && orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete branch with existing orders. Please deactivate it instead.' },
        { status: 400 }
      )
    }

    // Delete the branch
    const { error: deleteError } = await supabaseAdmin
      .from('shop_branches')
      .delete()
      .eq('id', branchId)

    if (deleteError) {
      console.error('Error deleting branch:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete branch' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Branch deleted successfully' 
    })

  } catch (error: any) {
    console.error('Error in branch deletion:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}