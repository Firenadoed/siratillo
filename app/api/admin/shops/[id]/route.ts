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
    const { id } = await params // Await params first
    
    const { error } = await supabaseAdmin
      .from('shops')
      .delete()
      .eq('id', id) // Use the awaited id

    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}