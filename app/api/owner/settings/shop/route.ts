import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { shopId, name, description, logo_url } = await request.json()

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 })
    }

    // Verify the shop belongs to the user
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('id', shopId)
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "Shop not found or access denied" }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update({
        name,
        description,
        logo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId)
      .select()
      .single()

    if (error) {
      console.error('Error updating shop:', error)
      return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
    }

    return NextResponse.json({ shop: data })

  } catch (error: any) {
    console.error('Shop update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}