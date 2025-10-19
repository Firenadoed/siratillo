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

    const { error } = await supabaseAdmin.from('shop_branches').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}