// app/api/admin/shops/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// GET /api/admin/shops - Get all shops with branches
export async function GET() {
  try {
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

    if (error) throw error

    // Transform the data to match frontend expectations
    const transformedShops = (shops || []).map(shop => ({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      created_at: shop.created_at,
      // Transform shop_branches to branches and lat/lng
      branches: (shop.shop_branches || []).map(branch => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        lat: branch.latitude,    // Transform latitude → lat
        lng: branch.longitude    // Transform longitude → lng
      }))
    }))

    return NextResponse.json({ shops: transformedShops })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/admin/shops - Create new shop
export async function POST(request: Request) {
  try {
    const { name, description } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .insert([{ name: name.trim(), description: description?.trim() || null }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ shop })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}