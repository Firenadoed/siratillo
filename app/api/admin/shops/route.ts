// app/api/admin/shops/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils' // Import from your existing utils
import { NextResponse } from 'next/server'

// GET /api/admin/shops - Get all shops with branches (Admin only)
export async function GET() {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { data: shops, error } = await supabaseAdmin
      .from('shops')
      .select(`
        id, 
        name, 
        description,
        created_at,
        shop_branches(
          id, 
          name, 
          address, 
          latitude, 
          longitude
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 })
    }

    // Transform the data to match frontend expectations
    const transformedShops = (shops || []).map(shop => ({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      created_at: shop.created_at,
      branches: (shop.shop_branches || []).map(branch => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        lat: branch.latitude,
        lng: branch.longitude
      }))
    }))

    return NextResponse.json({ shops: transformedShops })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 })
  }
}

// POST /api/admin/shops - Create new shop (Admin only)
export async function POST(request: Request) {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { name, description } = await request.json()
    
    // 🔒 Input validation
    if (!name?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Shop name too long" }, { status: 400 })
    }

    if (description && description.length > 500) {
      return NextResponse.json({ error: "Description too long" }, { status: 400 })
    }

    // Check for duplicate shop names
    const { data: existingShop, error: checkError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: "Failed to validate shop" }, { status: 500 })
    }

    if (existingShop) {
      return NextResponse.json({ error: "Shop name already exists" }, { status: 400 })
    }

    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .insert([{ 
        name: name.trim(), 
        description: description?.trim() || null 
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to create shop" }, { status: 500 })
    }

    // 🔒 Audit log the creation
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'shop_creation',
          target_shop_id: shop.id,
          description: `Created shop: ${shop.name}`,
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ shop })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create shop" }, { status: 500 })
  }
}