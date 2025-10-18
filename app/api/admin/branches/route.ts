// app/api/admin/branches/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// POST /api/admin/branches - Create new branch
export async function POST(request: Request) {
  try {
    const { shop_id, name, address, latitude, longitude } = await request.json()
    
    if (!shop_id || !name?.trim() || !address?.trim()) {
      return NextResponse.json({ 
        error: "Shop ID, branch name, and address are required" 
      }, { status: 400 })
    }

    if (!latitude || !longitude) {
      return NextResponse.json({ 
        error: "Branch location is required" 
      }, { status: 400 })
    }

    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .insert([{ 
        shop_id, 
        name: name.trim(), 
        address: address.trim(), 
        latitude, 
        longitude 
      }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ branch })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}