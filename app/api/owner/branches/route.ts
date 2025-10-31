import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shop_id')

    // If you need to filter by shop, you can use the shopId
    let query = supabase
      .from('shop_branches')
      .select('*')
      .order('created_at', { ascending: true })

    // If shopId is provided, filter by shop
    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data: branches, error } = await query

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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, address, latitude, longitude, shopId } = await request.json()

    if (!name || !address || !shopId) {
      return NextResponse.json(
        { error: 'Name, address, and shop ID are required' },
        { status: 400 }
      )
    }

    // Create the branch
    const { data: branch, error: branchError } = await supabase
      .from('shop_branches')
      .insert([
        {
          shop_id: shopId,
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
    const { data: methods } = await supabase
      .from('shop_methods')
      .select('id')

    if (methods && methods.length > 0) {
      const methodAssignments = methods.map(method => ({
        branch_id: branch.id,
        method_id: method.id,
        is_enabled: true
      }))

      await supabase
        .from('branch_methods')
        .insert(methodAssignments)
    }

    // Enable default service options
    const { data: options } = await supabase
      .from('service_options')
      .select('id')

    if (options && options.length > 0) {
      const optionAssignments = options.map(option => ({
        branch_id: branch.id,
        option_id: option.id,
        is_enabled: true
      }))

      await supabase
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

    await supabase
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, address, latitude, longitude, is_active } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    if (!name && !address && latitude === undefined && longitude === undefined && is_active === undefined) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (address) updateData.address = address
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (is_active !== undefined) updateData.is_active = is_active

    // Update the branch
    const { data: branch, error: branchError } = await supabase
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('id')

    if (!branchId) {
      return NextResponse.json(
        { error: 'Branch ID is required' },
        { status: 400 }
      )
    }

    // Check if there are any orders associated with this branch
    const { data: orders, error: ordersError } = await supabase
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

    // Use a transaction to delete all related records
    const { error: deleteError } = await supabase
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

    // Note: Due to foreign key constraints with CASCADE, related records in 
    // branch_contacts, branch_operating_hours, branch_methods, etc. will be automatically deleted

    return NextResponse.json({ 
      success: true,
      message: 'Branch deleted successfully' 
    })

  } catch (error: any) {
    console.error('Error in branch deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}