import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// GET - Fetch detergents and softeners for a specific branch
export async function GET(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    // Get owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    // Verify the branch belongs to owner's shop
    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id, name')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    // Get all detergent types with branch availability
    const { data: detergents } = await supabaseAdmin
      .from('detergent_types')
      .select(`
        *,
        branch_detergents!left (
          custom_price,
          is_available,
          display_order
        )
      `)
      .eq('branch_detergents.branch_id', branchId)

    // Get all softener types with branch availability
    const { data: softeners } = await supabaseAdmin
      .from('softener_types')
      .select(`
        *,
        branch_softeners!left (
          custom_price,
          is_available,
          display_order
        )
      `)
      .eq('branch_softeners.branch_id', branchId)

    return NextResponse.json({
      detergents: detergents?.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        base_price: d.base_price,
        custom_price: d.branch_detergents?.[0]?.custom_price,
        is_available: d.branch_detergents?.[0]?.is_available ?? false,
        display_order: d.branch_detergents?.[0]?.display_order ?? 0,
        final_price: d.branch_detergents?.[0]?.custom_price ?? d.base_price
      })) || [],
      softeners: softeners?.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        base_price: s.base_price,
        custom_price: s.branch_softeners?.[0]?.custom_price,
        is_available: s.branch_softeners?.[0]?.is_available ?? false,
        display_order: s.branch_softeners?.[0]?.display_order ?? 0,
        final_price: s.branch_softeners?.[0]?.custom_price ?? s.base_price
      })) || [],
      error: null
    })

  } catch (error: any) {
    console.error("Detergents GET error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update detergent/softener availability and pricing
export async function PATCH(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { type, id, branchId, is_available, custom_price } = await request.json()

    if (!type || !id || !branchId || is_available === undefined) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Verify the branch belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    const tableName = type === 'detergent' ? 'branch_detergents' : 'branch_softeners'
    const foreignKey = type === 'detergent' ? 'detergent_id' : 'softener_id'

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('branch_id', branchId)
      .eq(foreignKey, id)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabaseAdmin
        .from(tableName)
        .update({ 
          is_available,
          custom_price: custom_price !== undefined ? custom_price : null
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Insert new
      const { error } = await supabaseAdmin
        .from(tableName)
        .insert([{
          branch_id: branchId,
          [foreignKey]: id,
          is_available,
          custom_price: custom_price !== undefined ? custom_price : null
        }])

      if (error) throw error
    }

    return NextResponse.json({ error: null })

  } catch (error: any) {
    console.error("Detergents PATCH error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add new detergent/softener type (Owner can add for their shop)
export async function POST(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { type, name, description, base_price, branchId } = await request.json()

    if (!type || !name || !description || base_price === undefined || !branchId) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Verify the branch belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    const tableName = type === 'detergent' ? 'detergent_types' : 'softener_types'

    // Check if name already exists
    const { data: existing } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `${type} with this name already exists` }, { status: 409 })
    }

    // Insert new type with owner's custom price
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .insert([{
        name: name.trim(),
        description: description.trim(),
        base_price: parseFloat(base_price) // This is the owner's price
      }])
      .select()

    if (error) throw error

    // Automatically enable it for the current branch
    const branchTableName = type === 'detergent' ? 'branch_detergents' : 'branch_softeners'
    const foreignKey = type === 'detergent' ? 'detergent_id' : 'softener_id'

    await supabaseAdmin
      .from(branchTableName)
      .insert([{
        branch_id: branchId,
        [foreignKey]: data[0].id,
        is_available: true,
        custom_price: parseFloat(base_price) // Use the same price as custom price
      }])

    return NextResponse.json({ 
      [type]: {
        ...data[0],
        is_available: true,
        final_price: parseFloat(base_price)
      },
      error: null 
    })

  } catch (error: any) {
    console.error("Detergents POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}