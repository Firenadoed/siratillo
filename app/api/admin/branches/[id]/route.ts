// app/api/admin/branches/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// PUT /api/admin/branches/[id] - Update branch
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { name, address, latitude, longitude } = await request.json()
    
    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json({ 
        error: "Branch name and address are required" 
      }, { status: 400 })
    }

    if (!latitude || !longitude) {
      return NextResponse.json({ 
        error: "Branch location is required" 
      }, { status: 400 })
    }

    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .update({ 
        name: name.trim(), 
        address: address.trim(), 
        latitude, 
        longitude 
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    return NextResponse.json({ branch })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/branches/[id] - Delete branch
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('shop_branches')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}